import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { paginar, resultado } from '../common/paginacao';
import type { UsuarioLogado } from '../common/usuario-logado';
import type { ConfiguracaoFiscal, Prisma } from '../generated/prisma/client';
import type { ModeloNota } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { assinar, digestValue } from './assinatura';
import { Certificado, gerarCertificadoTeste, lerPfx } from './certificado';
import { CODIGO_UF, codigoNumerico, montarChave } from './chave';
import { cifrar, decifrar } from './cripto';
import { cnpjValido, documentoValido } from './documento';
import { CancelarNotaDto, CertificadoDto, ConfiguracaoFiscalDto, CSOSN_SUPORTADOS, EmitirNfceDto, FiltroNotaDto } from './fiscal.dto';
import { chamarSefaz, ErroSefaz, lerRetornoAutorizacao, lerRetornoEvento, lerRetornoStatus } from './sefaz/cliente';
import { enderecosNfce, enderecosNfe } from './sefaz/enderecos';
import { dataHoraSefaz, montarCancelamento, montarNfe, NAMESPACE, type DadosNota, type ItemNota, type Pagamento } from './xml-nfe';

const TEXTO_SIMPLES = 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.';
const AUTORIZADA = [100, 150]; // 150 = autorizada fora de prazo
const DENEGADA = [110, 205, 301, 302, 303];
const EVENTO_REGISTRADO = [135, 136, 155];
const centavos = (v: number) => Math.round(v * 100) / 100;

const TPAG_PDV: Record<string, string> = { DINHEIRO: '01', CARTAO_CREDITO: '03', CARTAO_DEBITO: '04', CREDIARIO: '05', PIX: '17' };

// Certificado de teste reaproveitado no modo de simulação (gerar uma chave RSA leva ~1s).
const certificadosSimulacao = new Map<string, Certificado>();

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────── Configuração ───────────

  async configuracao(empresaId: string) {
    const c = await this.prisma.configuracaoFiscal.findUnique({ where: { empresaId } });
    return c ? this.publica(c) : null;
  }

  async salvarConfiguracao(empresaId: string, { cscToken, ...dto }: ConfiguracaoFiscalDto) {
    if (!cnpjValido(dto.cnpj)) throw new BadRequestException('CNPJ da empresa inválido (os dígitos verificadores não conferem)');
    const atual = await this.prisma.configuracaoFiscal.findUnique({ where: { empresaId } });
    if (dto.ambiente !== 'SIMULACAO' && !atual?.certificado) {
      throw new BadRequestException('Envie o certificado digital A1 antes de sair do modo de simulação');
    }
    const csc = cscToken === undefined || cscToken === '' ? {} : { cscToken: cscToken === null ? null : cifrar(cscToken.trim()) };
    const salvo = await this.prisma.configuracaoFiscal.upsert({
      where: { empresaId },
      create: { ...dto, ...csc, empresaId },
      update: { ...dto, ...csc },
    });
    return this.publica(salvo);
  }

  async enviarCertificado(empresaId: string, dto: CertificadoDto) {
    const config = await this.exigirConfiguracao(empresaId);
    const cert = lerPfx(Buffer.from(dto.arquivo, 'base64'), dto.senha);
    if (cert.validade < new Date()) throw new BadRequestException(`Este certificado venceu em ${cert.validade.toLocaleDateString('pt-BR')}`);
    if (cert.cnpj && cert.cnpj !== config.cnpj) {
      throw new BadRequestException(`O certificado é do CNPJ ${cert.cnpj}, mas a empresa está configurada com ${config.cnpj}`);
    }
    const salvo = await this.prisma.configuracaoFiscal.update({
      where: { empresaId },
      data: { certificado: cifrar(Buffer.from(dto.arquivo, 'base64')), certificadoSenha: cifrar(dto.senha), certificadoTitular: cert.titular, certificadoValidade: cert.validade },
    });
    return this.publica(salvo);
  }

  async removerCertificado(empresaId: string) {
    await this.exigirConfiguracao(empresaId);
    const salvo = await this.prisma.configuracaoFiscal.update({
      where: { empresaId },
      data: { certificado: null, certificadoSenha: null, certificadoTitular: null, certificadoValidade: null, ambiente: 'SIMULACAO' },
    });
    return this.publica(salvo);
  }

  /** Consulta o status do serviço na SEFAZ: confirma certificado, endereço e conexão. */
  async testarConexao(empresaId: string, modelo: ModeloNota = 'NFE') {
    const config = await this.exigirConfiguracao(empresaId);
    if (config.ambiente === 'SIMULACAO') return { ok: true, mensagem: 'Modo de simulação: nada é enviado à SEFAZ.' };
    const producao = config.ambiente === 'PRODUCAO';
    const urls = modelo === 'NFCE' ? enderecosNfce(config.uf, producao) : enderecosNfe(config.uf, producao);
    if (!urls) throw new BadRequestException(`A transmissão para ${config.uf} ainda não foi configurada no sistema`);
    const mensagem = `<consStatServ xmlns="${NAMESPACE}" versao="4.00"><tpAmb>${producao ? 1 : 2}</tpAmb><cUF>${CODIGO_UF[config.uf]}</cUF><xServ>STATUS</xServ></consStatServ>`;
    const status = lerRetornoStatus(await chamarSefaz(urls.status, 'status', mensagem, this.certificado(config)));
    return { ok: status.cStat === 107, mensagem: `${status.cStat} - ${status.motivo}` };
  }

  // ─────────── Emissão ───────────

  emitirNfe(usuario: UsuarioLogado, pedidoId: string) {
    return this.emitir(usuario.empresaId, pedidoId, 'NFE');
  }

  emitirNfce(usuario: UsuarioLogado, pedidoId: string, dto: EmitirNfceDto = {}) {
    return this.emitir(usuario.empresaId, pedidoId, 'NFCE', dto.documento ?? undefined);
  }

  private async emitir(empresaId: string, pedidoId: string, modelo: ModeloNota, documentoConsumidor?: string) {
    const config = await this.exigirConfiguracao(empresaId);
    const pedido = await this.prisma.pedidoVenda.findFirst({
      where: { id: pedidoId, empresaId },
      include: {
        cliente: true,
        itens: { include: { produto: true } },
        pagamentos: true,
        lancamentos: { where: { status: { not: 'CANCELADO' } }, orderBy: { parcela: 'asc' } },
        notas: { where: { modelo } },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.status !== 'FATURADO') throw new BadRequestException('Só pedidos faturados podem ter nota fiscal');
    const autorizada = pedido.notas.find((n) => n.status === 'AUTORIZADA');
    if (autorizada) throw new BadRequestException(`Este pedido já tem a ${rotulo(modelo)} nº ${autorizada.numero} autorizada`);
    // Uma tentativa recusada pela SEFAZ libera o mesmo número para a nova tentativa.
    const anterior = pedido.notas.find((n) => n.status === 'REJEITADA');

    const producao = config.ambiente === 'PRODUCAO';
    const tpAmb: 1 | 2 = producao ? 1 : 2;
    const nfce = modelo === 'NFCE';
    const urls = config.ambiente === 'SIMULACAO' ? null : nfce ? enderecosNfce(config.uf, producao) : enderecosNfe(config.uf, producao);
    if (config.ambiente !== 'SIMULACAO' && !urls) throw new BadRequestException(`A transmissão para ${config.uf} ainda não foi configurada no sistema`);
    if (nfce && config.ambiente !== 'SIMULACAO' && (!config.cscId || !config.cscToken)) throw new BadRequestException('Configure o CSC (código de segurança da NFC-e) antes de emitir');

    const destinatario = this.destinatario(pedido, modelo, documentoConsumidor, config.ambiente !== 'SIMULACAO');
    const interestadual = !!destinatario?.endereco && destinatario.endereco.uf !== config.uf;
    const itens = this.itens(config, pedido, modelo, interestadual);
    if (nfce && Number(pedido.total) >= 10_000 && !destinatario) throw new BadRequestException('NFC-e a partir de R$ 10.000 exige o CPF/CNPJ do consumidor');

    // Reserva o número: incremento atômico na configuração.
    let serie = nfce ? config.serieNfce : config.serieNfe;
    let numero: number;
    if (anterior) {
      serie = anterior.serie;
      numero = anterior.numero;
    } else {
      const campo = nfce ? 'proximoNumeroNfce' : 'proximoNumeroNfe';
      const atualizado = await this.prisma.configuracaoFiscal.update({ where: { empresaId }, data: { [campo]: { increment: 1 } } });
      numero = atualizado[campo] - 1;
    }

    const emissao = new Date();
    const cNF = codigoNumerico(numero);
    const chave = montarChave({ uf: config.uf, emissao, cnpj: config.cnpj, modelo: nfce ? '65' : '55', serie, numero, codigoNumerico: cNF });
    const dados: DadosNota = {
      modelo: nfce ? '65' : '55',
      serie,
      numero,
      chave,
      codigoNumerico: cNF,
      emissao,
      tpAmb,
      naturezaOperacao: 'VENDA',
      emitente: {
        cnpj: config.cnpj,
        razaoSocial: config.razaoSocial,
        nomeFantasia: config.nomeFantasia,
        ie: config.inscricaoEstadual,
        im: config.inscricaoMunicipal,
        cnae: config.cnae,
        crt: config.crt,
        endereco: { logradouro: config.logradouro, numero: config.numero, complemento: config.complemento, bairro: config.bairro, codigoMunicipio: config.codigoMunicipio, municipio: config.municipio, uf: config.uf, cep: config.cep, telefone: config.telefone },
      },
      destinatario,
      itens,
      ...this.pagamentos(pedido, nfce, emissao),
      informacoesComplementares: [config.informacoesAdicionais || TEXTO_SIMPLES, `Pedido nº ${pedido.numero}.`].join(' '),
      responsavelTecnico: process.env.RESP_TEC_CNPJ
        ? { cnpj: process.env.RESP_TEC_CNPJ, contato: process.env.RESP_TEC_CONTATO ?? 'Suporte', email: process.env.RESP_TEC_EMAIL ?? 'suporte@verissimo.com.br', fone: process.env.RESP_TEC_FONE ?? '0000000000' }
        : undefined,
      nfce: nfce
        ? {
            cscId: config.cscId ?? '1',
            csc: config.cscToken ? decifrar(config.cscToken).toString() : 'SIMULACAO',
            urlQrCode: (urls as { qrCode?: string } | null)?.qrCode ?? 'https://simulacao.verissimo.erp/nfce/qrcode',
            urlConsulta: (urls as { consulta?: string } | null)?.consulta ?? 'https://simulacao.verissimo.erp/nfce/consulta',
          }
        : undefined,
    };

    const { xml, valorNota, qrCode } = montarNfe(dados);
    if (Math.abs(valorNota - Number(pedido.total)) > 0.009) {
      throw new BadRequestException(`O total calculado para a nota (${valorNota.toFixed(2)}) não bate com o do pedido (${Number(pedido.total).toFixed(2)})`);
    }
    const cert = this.certificado(config);
    const assinado = assinar(xml, 'infNFe', cert);

    // Envio (ou simulação) e leitura do protocolo.
    let protocolo: { cStat: number; motivo: string; nProt?: string; dhRecbto?: string; xml?: string };
    if (!urls) {
      const nProt = `9${chave.slice(0, 2)}${String(emissao.getFullYear()).slice(2)}${String(randomInt(0, 1e10)).padStart(10, '0')}`;
      const dhRecbto = dataHoraSefaz(new Date());
      protocolo = {
        cStat: 100,
        motivo: 'Autorizado o uso da NF-e (SIMULAÇÃO - sem valor fiscal, não enviada à SEFAZ)',
        nProt,
        dhRecbto,
        xml: `<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>VERISSIMO-SIMULACAO</verAplic><chNFe>${chave}</chNFe><dhRecbto>${dhRecbto}</dhRecbto><nProt>${nProt}</nProt><digVal>${digestValue(assinado)}</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e (SIMULACAO)</xMotivo></infProt></protNFe>`,
      };
    } else {
      const lote = `<enviNFe xmlns="${NAMESPACE}" versao="4.00"><idLote>${Date.now()}</idLote><indSinc>1</indSinc>${assinado}</enviNFe>`;
      try {
        const retorno = lerRetornoAutorizacao(await chamarSefaz(urls.autorizacao, 'autorizacao', lote, cert));
        protocolo = retorno.protocolo ?? { cStat: retorno.cStatLote, motivo: retorno.motivoLote };
      } catch (erro) {
        if (!(erro instanceof ErroSefaz)) throw erro;
        // Sem resposta: guarda a tentativa como recusada para poder tentar de novo com o mesmo número.
        protocolo = { cStat: 0, motivo: erro.message };
      }
    }

    const status = AUTORIZADA.includes(protocolo.cStat) ? 'AUTORIZADA' : DENEGADA.includes(protocolo.cStat) ? 'DENEGADA' : 'REJEITADA';
    const registro: Prisma.NotaFiscalUncheckedCreateInput = {
      empresaId,
      modelo,
      serie,
      numero,
      chave,
      ambiente: config.ambiente,
      status,
      pedidoId: pedido.id,
      destinatarioNome: destinatario?.nome ?? (nfce ? 'Consumidor final' : null),
      destinatarioDocumento: destinatario?.documento ?? null,
      valorTotal: valorNota,
      xml: assinado,
      xmlAutorizado: status === 'AUTORIZADA' && protocolo.xml ? `<nfeProc xmlns="${NAMESPACE}" versao="4.00">${assinado}${protocolo.xml}</nfeProc>` : null,
      protocolo: protocolo.nProt ?? null,
      codigoStatus: protocolo.cStat || null,
      motivo: protocolo.motivo,
      qrCode: qrCode ?? null,
      urlConsulta: dados.nfce?.urlConsulta ?? null,
      autorizadaEm: status === 'AUTORIZADA' ? new Date() : null,
    };
    const nota = anterior
      ? await this.prisma.notaFiscal.update({ where: { id: anterior.id }, data: registro })
      : await this.prisma.notaFiscal.create({ data: registro });

    if (status !== 'AUTORIZADA') this.logger.warn(`${rotulo(modelo)} ${numero} ${status}: ${protocolo.cStat} ${protocolo.motivo}`);
    return this.resumo(nota);
  }

  /** Destinatário: obrigatório e completo na NF-e; na NFC-e só o CPF/CNPJ, se informado. */
  private destinatario(pedido: { cliente: Prisma.PessoaGetPayload<object> }, modelo: ModeloNota, documentoConsumidor: string | undefined, conferirDocumento: boolean): DadosNota['destinatario'] {
    const c = pedido.cliente;
    const doc = (c.documento ?? '').replace(/\D/g, '');
    // Fora da simulação, CPF/CNPJ com dígito errado seria recusado pela SEFAZ: avisamos antes.
    if (modelo === 'NFCE') {
      if (documentoConsumidor && conferirDocumento && !documentoValido(documentoConsumidor)) throw new BadRequestException('CPF/CNPJ informado para a nota é inválido');
      const documento = documentoConsumidor ?? (documentoValido(doc) ? doc : '');
      return documento ? { documento, nome: documentoConsumidor ? 'Consumidor' : c.nome, indIEDest: 9 } : undefined;
    }
    const faltando = [
      doc.length !== 11 && doc.length !== 14 && 'CPF/CNPJ',
      !c.endereco && 'endereço',
      !c.bairro && 'bairro',
      !c.cidade && 'cidade',
      !/^\d{7}$/.test(c.codigoMunicipio ?? '') && 'código do município (IBGE)',
      !c.uf && 'UF',
      !/^\d{8}$/.test((c.cep ?? '').replace(/\D/g, '')) && 'CEP',
    ].filter(Boolean);
    if (faltando.length) throw new BadRequestException(`Complete o cadastro de "${c.nome}" para emitir a NF-e: ${faltando.join(', ')}`);
    if (conferirDocumento && !documentoValido(doc)) throw new BadRequestException(`O CPF/CNPJ de "${c.nome}" é inválido (os dígitos verificadores não conferem)`);
    const ie = (c.inscricaoEstadual ?? '').trim();
    const indIEDest = ie.toUpperCase() === 'ISENTO' ? 2 : ie && doc.length === 14 ? 1 : 9;
    return {
      documento: doc,
      nome: c.nome,
      ie: indIEDest === 1 ? ie : null,
      indIEDest,
      email: c.email,
      endereco: { logradouro: c.endereco!, numero: c.numero ?? 'S/N', complemento: c.complemento, bairro: c.bairro!, codigoMunicipio: c.codigoMunicipio!, municipio: c.cidade!, uf: c.uf!, cep: c.cep!, telefone: c.telefone },
    };
  }

  /** Itens com dados fiscais conferidos e com o desconto e o frete do pedido rateados. */
  private itens(
    config: ConfiguracaoFiscal,
    pedido: { subtotal: Prisma.Decimal; desconto: Prisma.Decimal; frete: Prisma.Decimal; itens: Prisma.PedidoVendaItemGetPayload<{ include: { produto: true } }>[] },
    modelo: ModeloNota,
    interestadual: boolean,
  ): ItemNota[] {
    const problemas: string[] = [];
    const subtotal = Number(pedido.subtotal);
    const descontoPedido = Number(pedido.desconto);
    const fretePedido = Number(pedido.frete);
    let descontoRateado = 0;
    let freteRateado = 0;

    const itens = pedido.itens.map((item, i) => {
      const p = item.produto;
      const ultimo = i === pedido.itens.length - 1;
      const peso = subtotal > 0 ? Number(item.total) / subtotal : 0;
      const parteDesconto = ultimo ? centavos(descontoPedido - descontoRateado) : centavos(descontoPedido * peso);
      const parteFrete = ultimo ? centavos(fretePedido - freteRateado) : centavos(fretePedido * peso);
      descontoRateado += parteDesconto;
      freteRateado += parteFrete;

      if (p.servico) problemas.push(`"${p.nome}" é serviço (precisa de NFS-e, não vai na NF-e/NFC-e)`);
      const ncm = (p.ncm ?? '').replace(/\D/g, '');
      if (!/^\d{8}$/.test(ncm)) problemas.push(`"${p.nome}" sem NCM (8 dígitos)`);
      let cfop = p.cfop ?? config.cfopPadrao;
      if (interestadual) cfop = cfop.replace(/^5/, '6');
      if (modelo === 'NFCE' && !cfop.startsWith('5')) problemas.push(`"${p.nome}": NFC-e só aceita CFOP 5xxx`);
      const csosn = p.csosn ?? config.csosnPadrao;
      if (!CSOSN_SUPORTADOS.includes(csosn)) problemas.push(`"${p.nome}": CSOSN ${csosn} não suportado`);

      return {
        codigo: p.codigo,
        ean: p.codigoBarras,
        descricao: item.descricao,
        ncm,
        cest: p.cest,
        cfop,
        unidade: p.unidade,
        quantidade: Number(item.quantidade),
        valorUnitario: Number(item.precoUnitario),
        desconto: centavos(Number(item.desconto) + parteDesconto),
        frete: parteFrete,
        origem: p.origem,
        csosn,
      };
    });
    if (problemas.length) throw new BadRequestException(`Ajuste os produtos antes de emitir: ${problemas.join('; ')}`);
    return itens;
  }

  /** Pagamentos: no PDV, as formas usadas na venda; no pedido, crédito da loja com as parcelas como duplicatas. */
  private pagamentos(
    pedido: { total: Prisma.Decimal; parcelas: number; pagamentos: { forma: string; valor: Prisma.Decimal; troco: Prisma.Decimal }[]; lancamentos: { parcela: number; valor: Prisma.Decimal; vencimento: Date }[] },
    nfce: boolean,
    emissao: Date,
  ): { pagamentos: Pagamento[]; troco: number; duplicatas?: DadosNota['duplicatas'] } {
    if (pedido.pagamentos.length) {
      const troco = centavos(pedido.pagamentos.reduce((s, p) => s + Number(p.troco), 0));
      return {
        pagamentos: pedido.pagamentos.map((p) => ({ tPag: TPAG_PDV[p.forma] ?? '99', valor: centavos(Number(p.valor) + Number(p.troco)), aPrazo: p.forma === 'CREDIARIO' })),
        troco,
      };
    }
    const hoje = new Date(emissao.toISOString().slice(0, 10));
    const futuras = pedido.lancamentos.filter((l) => l.vencimento >= hoje);
    const aPrazo = pedido.parcelas > 1 || futuras.some((l) => l.vencimento > hoje);
    return {
      pagamentos: [{ tPag: '05', valor: Number(pedido.total), aPrazo }],
      troco: 0,
      duplicatas: !nfce && futuras.length ? futuras.map((l, i) => ({ numero: String(i + 1).padStart(3, '0'), vencimento: l.vencimento, valor: Number(l.valor) })) : undefined,
    };
  }

  // ─────────── Cancelamento ───────────

  async cancelar(empresaId: string, id: string, dto: CancelarNotaDto) {
    const nota = await this.prisma.notaFiscal.findFirst({ where: { id, empresaId } });
    if (!nota) throw new NotFoundException('Nota não encontrada');
    if (nota.status !== 'AUTORIZADA') throw new BadRequestException('Só notas autorizadas podem ser canceladas');
    const config = await this.exigirConfiguracao(empresaId);
    const producao = nota.ambiente === 'PRODUCAO';
    const evento = assinar(
      montarCancelamento({ chave: nota.chave, cnpj: config.cnpj, tpAmb: producao ? 1 : 2, protocolo: nota.protocolo ?? '', justificativa: dto.justificativa, data: new Date() }),
      'infEvento',
      this.certificado(config),
    );

    let retorno: { cStat: number; motivo: string; nProt?: string; xml: string };
    if (nota.ambiente === 'SIMULACAO') {
      retorno = { cStat: 135, motivo: 'Evento registrado (SIMULAÇÃO)', nProt: `9${Date.now()}`.slice(0, 15), xml: evento };
    } else {
      const urls = nota.modelo === 'NFCE' ? enderecosNfce(config.uf, producao) : enderecosNfe(config.uf, producao);
      if (!urls) throw new BadRequestException(`A transmissão para ${config.uf} ainda não foi configurada no sistema`);
      const lote = `<envEvento xmlns="${NAMESPACE}" versao="1.00"><idLote>${Date.now()}</idLote>${evento}</envEvento>`;
      retorno = lerRetornoEvento(await chamarSefaz(urls.evento, 'evento', lote, this.certificado(config)));
    }
    if (!EVENTO_REGISTRADO.includes(retorno.cStat)) throw new BadRequestException(`A SEFAZ recusou o cancelamento: ${retorno.cStat} - ${retorno.motivo}`);

    const atualizada = await this.prisma.notaFiscal.update({
      where: { id },
      data: { status: 'CANCELADA', canceladaEm: new Date(), protocoloCancelamento: retorno.nProt ?? null, justificativaCancelamento: dto.justificativa, xmlCancelamento: retorno.xml },
    });
    return this.resumo(atualizada);
  }

  // ─────────── Consulta ───────────

  async listar(empresaId: string, filtro: FiltroNotaDto) {
    const where: Prisma.NotaFiscalWhereInput = { empresaId, modelo: filtro.modelo, status: filtro.status, pedidoId: filtro.pedidoId };
    if (filtro.busca) {
      const numero = Number(filtro.busca);
      where.OR = [
        { destinatarioNome: { contains: filtro.busca, mode: 'insensitive' } },
        { chave: { contains: filtro.busca.replace(/\D/g, '') || '-' } },
        ...(Number.isInteger(numero) ? [{ numero }] : []),
      ];
    }
    const [itens, total] = await Promise.all([
      this.prisma.notaFiscal.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginar(filtro), include: { pedido: { select: { id: true, numero: true, origem: true } } } }),
      this.prisma.notaFiscal.count({ where }),
    ]);
    return resultado(itens.map((n) => ({ ...this.resumo(n), pedido: n.pedido })), total, filtro);
  }

  async buscar(empresaId: string, id: string) {
    const nota = await this.prisma.notaFiscal.findFirst({ where: { id, empresaId }, include: { pedido: { select: { id: true, numero: true, origem: true } } } });
    if (!nota) throw new NotFoundException('Nota não encontrada');
    return { ...this.resumo(nota), pedido: nota.pedido, xml: nota.xmlAutorizado ?? nota.xml };
  }

  // ─────────── Auxiliares ───────────

  private async exigirConfiguracao(empresaId: string) {
    const config = await this.prisma.configuracaoFiscal.findUnique({ where: { empresaId } });
    if (!config) throw new BadRequestException('Preencha os dados fiscais da empresa antes (Configurações → Fiscal)');
    return config;
  }

  /** Certificado da empresa; no modo de simulação sem certificado, um de teste. */
  private certificado(config: ConfiguracaoFiscal): Certificado {
    if (config.certificado && config.certificadoSenha) {
      return lerPfx(decifrar(config.certificado), decifrar(config.certificadoSenha).toString());
    }
    if (config.ambiente !== 'SIMULACAO') throw new BadRequestException('Envie o certificado digital A1 da empresa');
    let teste = certificadosSimulacao.get(config.cnpj);
    if (!teste) {
      const { pfx, senha } = gerarCertificadoTeste(config.razaoSocial, config.cnpj);
      teste = lerPfx(pfx, senha);
      certificadosSimulacao.set(config.cnpj, teste);
    }
    return teste;
  }

  private publica(c: ConfiguracaoFiscal) {
    const { certificado, certificadoSenha, cscToken, ...resto } = c;
    const dias = c.certificadoValidade ? Math.ceil((c.certificadoValidade.getTime() - Date.now()) / 86_400_000) : null;
    return {
      ...resto,
      cscConfigurado: !!cscToken,
      certificado: certificado ? { titular: c.certificadoTitular, validade: c.certificadoValidade, diasRestantes: dias } : null,
      transmissaoDisponivel: { nfe: !!enderecosNfe(c.uf, false), nfce: !!enderecosNfce(c.uf, false) },
      responsavelTecnicoConfigurado: !!process.env.RESP_TEC_CNPJ,
      certificadoSenhaGravada: !!certificadoSenha,
    };
  }

  private resumo(n: Prisma.NotaFiscalGetPayload<object>) {
    const { xml, xmlAutorizado, xmlCancelamento, ...resto } = n;
    void xml;
    void xmlCancelamento;
    return { ...resto, temXmlAutorizado: !!xmlAutorizado };
  }
}

const rotulo = (modelo: ModeloNota) => (modelo === 'NFCE' ? 'NFC-e' : 'NF-e');


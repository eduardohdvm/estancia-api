'use client';

import { AlertTriangle, KeyRound, PlugZap, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alerta, AreaTexto, Botao, Cabecalho, Caixa, Campo, Cartao, Selecao, Status } from '@/components/ui';
import { api } from '@/lib/api';
import { buscarCep } from '@/lib/cep';
import { CSOSN } from '@/lib/fiscal';
import { data } from '@/lib/formato';
import type { AmbienteFiscal, ConfiguracaoFiscal } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const vazio = {
  razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '', inscricaoMunicipal: '', cnae: '', crt: '1',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', codigoMunicipio: '', uf: 'SP', telefone: '',
  ambiente: 'SIMULACAO' as AmbienteFiscal, serieNfe: '1', proximoNumeroNfe: '1', serieNfce: '1', proximoNumeroNfce: '1',
  cfopPadrao: '5102', csosnPadrao: '102', informacoesAdicionais: '', emitirNfceNoPdv: false, cscId: '', cscToken: '',
};
type Form = typeof vazio;

export default function ConfiguracaoFiscalPagina() {
  const { dados: config, recarregar, carregando } = useDados<ConfiguracaoFiscal | null>('/fiscal/configuracao');
  const [form, setForm] = useState<Form>(vazio);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      ...vazio,
      ...Object.fromEntries(Object.entries(config).filter(([k]) => k in vazio).map(([k, v]) => [k, v === null ? '' : typeof v === 'number' ? String(v) : v])),
      cscToken: '',
    } as Form);
  }, [config]);

  const campo = (nome: keyof Form) => ({
    value: form[nome] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [nome]: e.target.value }),
  });

  async function preencherCep() {
    const e = await buscarCep(form.cep);
    if (e) setForm((f) => ({ ...f, logradouro: e.logradouro || f.logradouro, bairro: e.bairro || f.bairro, municipio: e.cidade, uf: e.uf, codigoMunicipio: e.codigoMunicipio }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    setSalvo('');
    try {
      await api('/fiscal/configuracao', {
        metodo: 'PUT',
        corpo: {
          ...form,
          crt: Number(form.crt),
          serieNfe: Number(form.serieNfe),
          proximoNumeroNfe: Number(form.proximoNumeroNfe),
          serieNfce: Number(form.serieNfce),
          proximoNumeroNfce: Number(form.proximoNumeroNfce),
          cscToken: form.cscToken || undefined,
        },
      });
      setSalvo('Configuração salva.');
      await recarregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando && config === null) return null;

  return (
    <>
      <Cabecalho titulo="Configuração fiscal" descricao="Dados da empresa para emitir NF-e e NFC-e" />

      {config && <Avisos config={config} />}

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Cartao className="grid gap-4 p-5 sm:grid-cols-6">
          <h2 className="font-semibold text-slate-900 sm:col-span-6">Empresa</h2>
          <Campo rotulo="Razão social" required className="sm:col-span-4" {...campo('razaoSocial')} />
          <Campo rotulo="Nome fantasia" className="sm:col-span-2" {...campo('nomeFantasia')} />
          <Campo rotulo="CNPJ" required className="sm:col-span-2" {...campo('cnpj')} />
          <Campo rotulo="Inscrição estadual" required className="sm:col-span-2" {...campo('inscricaoEstadual')} />
          <Selecao rotulo="Regime tributário" className="sm:col-span-2" {...campo('crt')}>
            <option value="1">Simples Nacional</option>
            <option value="4">MEI</option>
          </Selecao>
          <Campo rotulo="Inscrição municipal (opcional)" className="sm:col-span-3" {...campo('inscricaoMunicipal')} />
          <Campo rotulo="CNAE principal (opcional)" className="sm:col-span-3" {...campo('cnae')} />
        </Cartao>

        <Cartao className="grid gap-4 p-5 sm:grid-cols-6">
          <h2 className="font-semibold text-slate-900 sm:col-span-6">Endereço</h2>
          <Campo rotulo="CEP" required className="sm:col-span-2" {...campo('cep')} onBlur={preencherCep} />
          <Campo rotulo="Logradouro" required className="sm:col-span-4" {...campo('logradouro')} />
          <Campo rotulo="Número" required className="sm:col-span-1" {...campo('numero')} />
          <Campo rotulo="Complemento" className="sm:col-span-2" {...campo('complemento')} />
          <Campo rotulo="Bairro" required className="sm:col-span-3" {...campo('bairro')} />
          <Campo rotulo="Município" required className="sm:col-span-3" {...campo('municipio')} />
          <Selecao rotulo="UF" className="sm:col-span-1" {...campo('uf')}>
            {UFS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Selecao>
          <Campo rotulo="Código IBGE do município" required className="sm:col-span-2" {...campo('codigoMunicipio')} />
          <Campo rotulo="Telefone" className="sm:col-span-3" {...campo('telefone')} />
          <p className="text-xs text-slate-500 sm:col-span-3 sm:self-end">Digite o CEP e saia do campo: o endereço e o código IBGE são preenchidos sozinhos.</p>
        </Cartao>

        <Cartao className="grid gap-4 p-5 sm:grid-cols-6">
          <h2 className="font-semibold text-slate-900 sm:col-span-6">Emissão</h2>
          <Selecao rotulo="Ambiente" className="sm:col-span-6" {...campo('ambiente')}>
            <option value="SIMULACAO">Simulação: gera e assina a nota, mas não envia à SEFAZ (para testar o sistema)</option>
            <option value="HOMOLOGACAO">Homologação: envia à SEFAZ de teste, sem valor fiscal</option>
            <option value="PRODUCAO">Produção: notas com valor fiscal</option>
          </Selecao>
          <Campo rotulo="Série da NF-e" type="number" min="0" max="889" className="sm:col-span-1" {...campo('serieNfe')} />
          <Campo rotulo="Próximo nº NF-e" type="number" min="1" className="sm:col-span-2" {...campo('proximoNumeroNfe')} />
          <Campo rotulo="Série da NFC-e" type="number" min="0" max="889" className="sm:col-span-1" {...campo('serieNfce')} />
          <Campo rotulo="Próximo nº NFC-e" type="number" min="1" className="sm:col-span-2" {...campo('proximoNumeroNfce')} />
          <Campo rotulo="CFOP padrão" className="sm:col-span-2" {...campo('cfopPadrao')} />
          <Selecao rotulo="CSOSN padrão" className="sm:col-span-4" {...campo('csosnPadrao')}>
            {CSOSN.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Selecao>
          <p className="-mt-2 text-xs text-slate-500 sm:col-span-6">
            Valem para os produtos sem CFOP/CSOSN próprios. Vendas para outro estado trocam o CFOP para 6xxx automaticamente. Confirme os códigos com o seu contador.
          </p>
          <AreaTexto rotulo="Informações complementares (saem em todas as notas)" className="sm:col-span-6" placeholder="Padrão: Documento emitido por ME ou EPP optante pelo Simples Nacional..." {...campo('informacoesAdicionais')} />
        </Cartao>

        <Cartao className="grid gap-4 p-5 sm:grid-cols-6">
          <h2 className="font-semibold text-slate-900 sm:col-span-6">NFC-e (cupom no PDV)</h2>
          <Campo rotulo="Identificador do CSC (ID token)" className="sm:col-span-2" placeholder="ex.: 000001" {...campo('cscId')} />
          <Campo
            rotulo={config?.cscConfigurado ? 'Código CSC (já gravado; preencha só para trocar)' : 'Código CSC'}
            type="password"
            autoComplete="off"
            className="sm:col-span-4"
            {...campo('cscToken')}
          />
          <p className="-mt-2 text-xs text-slate-500 sm:col-span-6">O CSC é gerado de graça no site da SEFAZ do seu estado e serve para montar o QR Code do cupom.</p>
          <div className="sm:col-span-6">
            <Caixa rotulo="Emitir NFC-e automaticamente em cada venda do PDV" checked={form.emitirNfceNoPdv} onChange={(e) => setForm({ ...form, emitirNfceNoPdv: e.target.checked })} />
          </div>
        </Cartao>

        <Alerta>{erro}</Alerta>
        {salvo && <p className="text-sm text-emerald-700">{salvo}</p>}
        <div className="flex justify-end">
          <Botao type="submit" carregando={salvando}>
            Salvar configuração
          </Botao>
        </div>
      </form>

      {config && <CartaoCertificado config={config} aoMudar={recarregar} />}
    </>
  );
}

function Avisos({ config }: { config: ConfiguracaoFiscal }) {
  const avisos: string[] = [];
  if (config.ambiente === 'SIMULACAO') avisos.push('Modo de simulação: as notas são geradas e assinadas, mas não vão para a SEFAZ e não têm valor fiscal.');
  if (!config.transmissaoDisponivel.nfe || !config.transmissaoDisponivel.nfce) {
    avisos.push(`A transmissão para a SEFAZ de ${config.uf} ainda não está configurada no sistema: por enquanto só o modo de simulação funciona.`);
  }
  if (!config.certificado) avisos.push('Sem certificado digital A1: só é possível usar o modo de simulação.');
  else if (config.certificado.diasRestantes <= 30) avisos.push(`O certificado digital vence em ${config.certificado.diasRestantes} dia(s). Renove para não parar de emitir.`);
  if (!config.responsavelTecnicoConfigurado) avisos.push('Os dados do responsável técnico (sua software house) não estão configurados no servidor (RESP_TEC_CNPJ). Alguns estados exigem.');
  if (!avisos.length) return null;
  return (
    <Cartao className="mb-4 flex gap-3 border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="size-5 shrink-0 text-amber-600" />
      <ul className="flex flex-col gap-1 text-sm text-amber-900">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </Cartao>
  );
}

function CartaoCertificado({ config, aoMudar }: { config: ConfiguracaoFiscal; aoMudar: () => Promise<void> }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [teste, setTeste] = useState<string>('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setErro('');
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      let binario = '';
      bytes.forEach((b) => (binario += String.fromCharCode(b)));
      await api('/fiscal/certificado', { metodo: 'POST', corpo: { arquivo: btoa(binario), senha } });
      setArquivo(null);
      setSenha('');
      await aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    if (!confirm('Remover o certificado? O sistema volta para o modo de simulação.')) return;
    await api('/fiscal/certificado', { metodo: 'DELETE' });
    await aoMudar();
  }

  async function testar() {
    setTeste('Testando…');
    try {
      const r = await api<{ ok: boolean; mensagem: string }>('/fiscal/testar-conexao', { metodo: 'POST' });
      setTeste(`${r.ok ? '✔' : '✖'} ${r.mensagem}`);
    } catch (e) {
      setTeste(`✖ ${(e as Error).message}`);
    }
  }

  return (
    <Cartao className="mt-6 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <KeyRound className="size-5 text-indigo-600" /> Certificado digital A1
        </h2>
        <div className="flex items-center gap-2">
          <Status valor={config.ambiente} />
          <Botao variante="secundario" onClick={testar}>
            <PlugZap className="size-4" /> Testar conexão com a SEFAZ
          </Botao>
        </div>
      </div>
      {teste && <p className="mt-2 text-sm text-slate-600">{teste}</p>}

      {config.certificado ? (
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-emerald-600" />
            <div className="text-sm">
              <p className="font-medium text-slate-900">{config.certificado.titular}</p>
              <p className="text-slate-600">
                Válido até {data(config.certificado.validade)} ({config.certificado.diasRestantes} dias)
              </p>
            </div>
          </div>
          <Botao variante="fantasma" onClick={remover}>
            <Trash2 className="size-4" /> Remover
          </Botao>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Envie o arquivo .pfx (ou .p12) do e-CNPJ A1 da empresa. Ele fica guardado criptografado.</p>
      )}

      <form onSubmit={enviar} className="mt-4 grid gap-3 sm:grid-cols-6 sm:items-end">
        <label className="flex flex-col gap-1.5 sm:col-span-3">
          <span className="text-sm font-medium text-slate-700">{config.certificado ? 'Trocar certificado' : 'Arquivo do certificado'}</span>
          <input type="file" accept=".pfx,.p12" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
        </label>
        <Campo rotulo="Senha do certificado" type="password" autoComplete="off" className="sm:col-span-2" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Botao type="submit" carregando={enviando} disabled={!arquivo || !senha}>
          <Upload className="size-4" /> Enviar
        </Botao>
      </form>
      <div className="mt-3">
        <Alerta>{erro}</Alerta>
      </div>
    </Cartao>
  );
}

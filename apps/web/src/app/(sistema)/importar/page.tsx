'use client';

import { CheckCircle2, Download, FileUp, RotateCcw, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { Alerta, Botao, Cabecalho, Cartao, Celula, Etiqueta, Indicador, Selecao, Tabela } from '@/components/ui';
import { api } from '@/lib/api';
import { baixarModelo, lerPlanilha, type LinhaPlanilha } from '@/lib/planilha';
import { useSessao } from '@/lib/sessao';
import type { Perfil } from '@/lib/tipos';

type Tipo = 'produtos' | 'pessoas' | 'estoque';

interface Resultado {
  simulado: boolean;
  total: number;
  criar: number;
  atualizar: number;
  comErro: number;
  erros: { linha: number; resumo: string; erros: string[] }[];
  amostra: { linha: number; acao: 'criar' | 'atualizar' | 'erro'; resumo: string }[];
}

const TIPOS: Record<Tipo, { titulo: string; perfis: Perfil[]; descricao: string; colunas: string; modelo: [string[], (string | number)[][]]; destino: string }> = {
  produtos: {
    titulo: 'Produtos',
    perfis: ['GERENTE', 'ESTOQUISTA'],
    descricao: 'Cadastra produtos novos e atualiza os que já existem (pelo código).',
    colunas: 'Obrigatórias: Código e Nome (ou Descrição). Opcionais: Código de barras, Categoria, Unidade, Preço de custo, Preço de venda, Estoque mínimo, Serviço (Sim/Não).',
    modelo: [
      ['Código', 'Nome', 'Código de barras', 'Categoria', 'Unidade', 'Preço de custo', 'Preço de venda', 'Estoque mínimo', 'Serviço'],
      [
        ['001', 'Café torrado 500g', '7891000000017', 'Mercearia', 'UN', 12.5, 21.9, 10, 'Não'],
        ['S01', 'Entrega em domicílio', '', 'Serviços', 'UN', 0, 10, 0, 'Sim'],
      ],
    ],
    destino: '/produtos',
  },
  pessoas: {
    titulo: 'Clientes',
    perfis: ['GERENTE', 'VENDEDOR', 'FINANCEIRO'],
    descricao: 'Cadastra pessoas novas e atualiza as existentes (pelo CPF/CNPJ ou, sem documento, pelo nome).',
    colunas: 'Obrigatória: Nome (ou Razão social). Opcionais: CPF/CNPJ, Nome fantasia, Tipo (PF/PJ), E-mail, Telefone, CEP, Endereço, Número, Bairro, Cidade, UF, Observações, Cliente (Sim/Não), Fornecedor (Sim/Não).',
    modelo: [
      ['Nome', 'CPF/CNPJ', 'Nome fantasia', 'E-mail', 'Telefone', 'CEP', 'Endereço', 'Número', 'Bairro', 'Cidade', 'UF'],
      [
        ['Maria Oliveira', '111.444.777-35', '', 'maria@email.com', '(11) 99999-0001', '01001-000', 'Praça da Sé', '100', 'Sé', 'São Paulo', 'SP'],
        ['Mercado Bom Preço Ltda', '11.222.333/0001-81', 'Bom Preço', 'compras@bompreco.com.br', '(19) 3333-0002', '13010-000', 'Rua Barão de Jaguara', '500', 'Centro', 'Campinas', 'SP'],
      ],
    ],
    destino: '/clientes',
  },
  estoque: {
    titulo: 'Estoque',
    perfis: ['GERENTE', 'ESTOQUISTA'],
    descricao: 'Lança o saldo dos produtos já cadastrados, por código ou código de barras.',
    colunas: 'Obrigatórias: Código (ou código de barras) e Quantidade. Opcionais: Custo unitário e Depósito (sem depósito, vai para o padrão).',
    modelo: [
      ['Código', 'Quantidade', 'Custo unitário', 'Depósito'],
      [
        ['001', 40, 12.5, ''],
        ['7891000000024', 15, '', ''],
      ],
    ],
    destino: '/estoque',
  },
};

export default function Pagina() {
  return (
    <Suspense>
      <Importar />
    </Suspense>
  );
}

function Importar() {
  const { pode } = useSessao();
  const permitidos = (Object.keys(TIPOS) as Tipo[]).filter((t) => pode(...TIPOS[t].perfis));
  const pedido = useSearchParams().get('tipo') as Tipo | null;
  const [tipo, setTipo] = useState<Tipo>(pedido && permitidos.includes(pedido) ? pedido : (permitidos[0] ?? 'produtos'));

  return (
    <>
      <Cabecalho titulo="Importar planilhas" descricao="Traga seus cadastros de outro sistema ou do Excel (.xlsx ou .csv)" />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {permitidos.map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tipo === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {TIPOS[t].titulo}
          </button>
        ))}
      </div>
      {/* A chave recria o formulário ao trocar de aba, limpando o arquivo escolhido. */}
      <FormularioImportacao key={tipo} tipo={tipo} />
    </>
  );
}

function FormularioImportacao({ tipo }: { tipo: Tipo }) {
  const config = TIPOS[tipo];
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<{ nome: string; linhas: LinhaPlanilha[]; cabecalhos: string[] } | null>(null);
  const papel = 'cliente';
  const [modo, setModo] = useState<'AJUSTE' | 'ENTRADA'>('AJUSTE');
  const [simulacao, setSimulacao] = useState<Resultado | null>(null);
  const [concluido, setConcluido] = useState<Resultado | null>(null);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState<'' | 'lendo' | 'simulando' | 'importando'>('');
  const [arrastando, setArrastando] = useState(false);

  const opcoes = tipo === 'pessoas' ? { papel } : tipo === 'estoque' ? { modo } : {};
  const enviar = (linhas: LinhaPlanilha[], simular: boolean) =>
    api<Resultado>(`/importacao/${tipo}`, { metodo: 'POST', corpo: { linhas, simular, ...opcoes } });

  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro('');
    setSimulacao(null);
    setConcluido(null);
    setProcessando('lendo');
    try {
      const lida = await lerPlanilha(f);
      setArquivo({ nome: f.name, ...lida });
      setProcessando('simulando');
      setSimulacao(await enviar(lida.linhas, true));
    } catch (e) {
      setErro((e as Error).message);
      setArquivo(null);
    } finally {
      setProcessando('');
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function resimular() {
    if (!arquivo) return;
    setProcessando('simulando');
    try {
      setSimulacao(await enviar(arquivo.linhas, true));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setProcessando('');
    }
  }

  async function importar() {
    if (!arquivo || !simulacao) return;
    setProcessando('importando');
    try {
      setConcluido(await enviar(arquivo.linhas, false));
      setSimulacao(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setProcessando('');
    }
  }

  function recomecar() {
    setArquivo(null);
    setSimulacao(null);
    setConcluido(null);
    setErro('');
  }

  if (concluido) {
    return (
      <Cartao className="mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="mt-3 text-xl font-semibold text-slate-900">Importação concluída</h2>
        <p className="mt-2 text-slate-600">
          {tipo === 'estoque'
            ? `${concluido.atualizar} produto(s) com estoque lançado.`
            : `${concluido.criar} cadastrado(s) e ${concluido.atualizar} atualizado(s).`}
          {concluido.comErro > 0 && ` ${concluido.comErro} linha(s) com erro ficaram de fora.`}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Botao variante="secundario" onClick={recomecar}>
            <RotateCcw className="size-4" /> Importar outra planilha
          </Botao>
          <Link href={config.destino} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Ver {config.titulo.toLowerCase()}
          </Link>
        </div>
      </Cartao>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm text-slate-700">{config.descricao}</p>
          <p className="mt-2 text-xs text-slate-500">{config.colunas}</p>
          <p className="mt-1 text-xs text-slate-500">Os nomes das colunas podem variar (com ou sem acento, "SKU", "EAN", "Razão social"…). Números aceitam vírgula: 1.234,56.</p>
        </div>
        <Botao variante="secundario" onClick={() => baixarModelo(`modelo-${tipo}`, ...config.modelo)} className="shrink-0">
          <Download className="size-4" /> Baixar modelo
        </Botao>
      </Cartao>

      {tipo === 'estoque' && (
        <Cartao className="p-5">
          <Selecao rotulo="O que a quantidade significa" value={modo} onChange={(e) => (setModo(e.target.value as typeof modo), setSimulacao(null))} className="max-w-md">
            <option value="AJUSTE">Saldo contado (substitui o saldo atual: inventário ou implantação)</option>
            <option value="ENTRADA">Entrada (soma ao saldo atual)</option>
          </Selecao>
          {arquivo && !simulacao && !processando && (
            <Botao variante="secundario" className="mt-3" onClick={resimular}>
              Conferir de novo com esta opção
            </Botao>
          )}
        </Cartao>
      )}

      <label
        onDragOver={(e) => (e.preventDefault(), setArrastando(true))}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void escolher(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${arrastando ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400'}`}
      >
        <FileUp className="size-8 text-slate-400" />
        <span className="text-sm text-slate-700">
          {processando === 'lendo' ? 'Lendo a planilha…' : processando === 'simulando' ? 'Conferindo as linhas…' : arquivo ? `${arquivo.nome} · ${arquivo.linhas.length} linha(s). Clique para trocar.` : 'Arraste a planilha aqui ou clique para escolher'}
        </span>
        <span className="text-xs text-slate-500">.xlsx ou .csv · até 5.000 linhas</span>
        <input ref={entrada} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
      </label>

      <Alerta>{erro}</Alerta>

      {simulacao && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {tipo === 'estoque' ? (
              <Indicador rotulo="Produtos que terão estoque lançado" valor={String(simulacao.atualizar)} tom="bom" />
            ) : (
              <>
                <Indicador rotulo="Novos cadastros" valor={String(simulacao.criar)} tom="bom" />
                <Indicador rotulo="Cadastros que serão atualizados" valor={String(simulacao.atualizar)} />
              </>
            )}
            <Indicador rotulo="Linhas com erro (ficam de fora)" valor={String(simulacao.comErro)} tom={simulacao.comErro ? 'ruim' : 'neutro'} />
          </div>

          {simulacao.erros.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Linhas com erro</h3>
              <Tabela cabecalhos={['Linha', 'Item', 'Problema']}>
                {simulacao.erros.slice(0, 200).map((e) => (
                  <tr key={e.linha}>
                    <Celula className="tabular-nums">{e.linha}</Celula>
                    <Celula className="max-w-64 truncate">{e.resumo}</Celula>
                    <Celula className="whitespace-normal text-rose-600">{e.erros.join(' · ')}</Celula>
                  </tr>
                ))}
              </Tabela>
              {simulacao.erros.length > 200 && <p className="mt-2 text-xs text-slate-500">Mostrando os primeiros 200 erros.</p>}
            </div>
          )}

          <div>
            <h3 className="mb-2 font-semibold text-slate-900">Prévia {simulacao.total > 100 && <span className="text-sm font-normal text-slate-500">(primeiras 100 linhas)</span>}</h3>
            <Tabela cabecalhos={['Linha', 'O que será feito', 'Item']}>
              {simulacao.amostra.map((a) => (
                <tr key={a.linha}>
                  <Celula className="tabular-nums">{a.linha}</Celula>
                  <Celula>
                    {a.acao === 'erro' ? (
                      <Etiqueta tom="vermelho">Erro</Etiqueta>
                    ) : a.acao === 'criar' ? (
                      <Etiqueta tom="verde">Novo</Etiqueta>
                    ) : (
                      <Etiqueta tom="azul">{tipo === 'estoque' ? 'Lançar' : 'Atualizar'}</Etiqueta>
                    )}
                  </Celula>
                  <Celula>{a.resumo}</Celula>
                </tr>
              ))}
            </Tabela>
          </div>

          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
            {simulacao.comErro > 0 && <p className="text-sm text-slate-500 sm:mr-auto">Corrija a planilha e envie de novo, ou importe só as linhas válidas.</p>}
            <Botao variante="secundario" onClick={recomecar}>
              Cancelar
            </Botao>
            <Botao onClick={importar} carregando={processando === 'importando'} disabled={simulacao.criar + simulacao.atualizar === 0}>
              <Upload className="size-4" /> Importar {simulacao.criar + simulacao.atualizar} linha(s)
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}

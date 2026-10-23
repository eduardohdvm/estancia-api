'use client';

import { FileUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AcoesFormulario, Alerta, AreaTexto, Botao, Busca, Cabecalho, Caixa, Campo, Celula, Etiqueta, Modal, Paginacao, Selecao, Tabela } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { moeda, numero } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { Categoria, Paginado, Produto } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

const vazio = {
  codigo: '',
  codigoBarras: '',
  nome: '',
  descricao: '',
  unidade: 'UN',
  categoriaId: '',
  precoCusto: '0',
  precoVenda: '0',
  estoqueMinimo: '0',
  servico: false,
  ativo: true,
};

type Formulario = typeof vazio;

export default function Produtos() {
  return (
    <Suspense>
      <PaginaProdutos />
    </Suspense>
  );
}

function PaginaProdutos() {
  const { pode } = useSessao();
  const podeEditar = pode('GERENTE', 'ESTOQUISTA');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [categoriaId, setCategoriaId] = useState('');
  const [estoqueBaixo, setEstoqueBaixo] = useState(useSearchParams().get('estoqueBaixo') === 'true');
  const { dados, erro, carregando, recarregar } = useDados<Paginado<Produto>>(
    `/produtos${qs({ busca, pagina, categoriaId, estoqueBaixo: estoqueBaixo || undefined })}`,
  );
  const categorias = useDados<Categoria[]>('/categorias');

  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const [form, setForm] = useState<Formulario>(vazio);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  function abrir(produto?: Produto) {
    setErroForm('');
    setEditando(produto?.id ?? null);
    setForm(
      produto
        ? {
            codigo: produto.codigo,
            codigoBarras: produto.codigoBarras ?? '',
            nome: produto.nome,
            descricao: produto.descricao ?? '',
            unidade: produto.unidade,
            categoriaId: produto.categoriaId ?? '',
            precoCusto: String(Number(produto.precoCusto)),
            precoVenda: String(Number(produto.precoVenda)),
            estoqueMinimo: String(Number(produto.estoqueMinimo)),
            servico: produto.servico,
            ativo: produto.ativo,
          }
        : { ...vazio, codigo: String((dados?.total ?? 0) + 1).padStart(3, '0') },
    );
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const corpo = {
      ...form,
      precoCusto: Number(form.precoCusto),
      precoVenda: Number(form.precoVenda),
      estoqueMinimo: Number(form.estoqueMinimo),
    };
    try {
      await api(editando ? `/produtos/${editando}` : '/produtos', { metodo: editando ? 'PATCH' : 'POST', corpo });
      setAberto(false);
      await recarregar();
    } catch (e) {
      setErroForm((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(produto: Produto) {
    if (!confirm(`Excluir "${produto.nome}"?`)) return;
    try {
      await api(`/produtos/${produto.id}`, { metodo: 'DELETE' });
      await recarregar();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const campo = (nome: keyof Formulario) => ({
    value: form[nome] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [nome]: e.target.value }),
  });
  const margem = Number(form.precoCusto) > 0 ? ((Number(form.precoVenda) - Number(form.precoCusto)) / Number(form.precoCusto)) * 100 : null;

  return (
    <>
      <Cabecalho titulo="Produtos e serviços" descricao="Catálogo, preços e saldo em estoque">
        {podeEditar && (
          <>
            <Link href="/importar?tipo=produtos" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FileUp className="size-4" /> Importar
            </Link>
            <Botao variante="secundario" onClick={() => setCategoriasAberto(true)}>
              <Tags className="size-4" /> Categorias
            </Botao>
            <Botao onClick={() => abrir()}>
              <Plus className="size-4" /> Novo produto
            </Botao>
          </>
        )}
      </Cabecalho>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Busca valor={busca} aoMudar={(v) => (setBusca(v), setPagina(1))} placeholder="Nome, código ou código de barras" />
        <Selecao value={categoriaId} onChange={(e) => (setCategoriaId(e.target.value), setPagina(1))} className="sm:w-48">
          <option value="">Todas as categorias</option>
          {categorias.dados?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <Caixa rotulo="Só estoque baixo" checked={estoqueBaixo} onChange={(e) => (setEstoqueBaixo(e.target.checked), setPagina(1))} />
      </div>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Código', 'Nome', 'Categoria', 'Preço de venda', 'Saldo', '', '']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <Celula className="font-mono text-xs">{p.codigo}</Celula>
            <Celula>
              <p className="font-medium text-slate-900">{p.nome}</p>
              {p.servico && <p className="text-xs text-slate-500">Serviço</p>}
            </Celula>
            <Celula>{p.categoria?.nome ?? '—'}</Celula>
            <Celula className="tabular-nums">{moeda(p.precoVenda)}</Celula>
            <Celula className={`tabular-nums ${p.estoqueBaixo ? 'font-medium text-rose-600' : ''}`}>
              {p.servico ? '—' : `${numero(p.saldo)} ${p.unidade}`}
            </Celula>
            <Celula>
              {p.estoqueBaixo && <Etiqueta tom="vermelho">Estoque baixo</Etiqueta>}
              {!p.ativo && <Etiqueta>Inativo</Etiqueta>}
            </Celula>
            <Celula className="text-right">
              {podeEditar && (
                <>
                  <Botao variante="fantasma" onClick={() => abrir(p)} aria-label="Editar">
                    <Pencil className="size-4" />
                  </Botao>
                  <Botao variante="fantasma" onClick={() => remover(p)} aria-label="Excluir">
                    <Trash2 className="size-4" />
                  </Botao>
                </>
              )}
            </Celula>
          </tr>
        ))}
      </Tabela>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />}

      <Modal titulo={editando ? 'Editar produto' : 'Novo produto'} aberto={aberto} aoFechar={() => setAberto(false)} largura="max-w-2xl">
        <form onSubmit={salvar}>
          <div className="grid gap-4 sm:grid-cols-6">
            <Campo rotulo="Código" required className="sm:col-span-2" {...campo('codigo')} />
            <Campo rotulo="Código de barras" className="sm:col-span-4" {...campo('codigoBarras')} />
            <Campo rotulo="Nome" required className="sm:col-span-6" {...campo('nome')} />
            <Selecao rotulo="Categoria" className="sm:col-span-3" {...campo('categoriaId')}>
              <option value="">Sem categoria</option>
              {categorias.dados?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
            <Selecao rotulo="Unidade" className="sm:col-span-3" {...campo('unidade')}>
              {['UN', 'KG', 'G', 'L', 'ML', 'M', 'M2', 'CX', 'PC', 'PAR', 'HR'].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Selecao>
            <Campo rotulo="Preço de custo" type="number" step="0.01" min="0" className="sm:col-span-2" {...campo('precoCusto')} />
            <Campo rotulo="Preço de venda" type="number" step="0.01" min="0" className="sm:col-span-2" {...campo('precoVenda')} />
            <div className="flex flex-col justify-end pb-2 text-sm text-slate-500 sm:col-span-2">
              {margem !== null && <span>Margem: {margem.toFixed(1)}%</span>}
            </div>
            {!form.servico && <Campo rotulo="Estoque mínimo" type="number" step="0.001" min="0" className="sm:col-span-2" {...campo('estoqueMinimo')} />}
            <AreaTexto rotulo="Descrição" className="sm:col-span-6" {...campo('descricao')} />
          </div>
          <div className="mt-4 flex flex-wrap gap-5">
            <Caixa rotulo="É um serviço (não controla estoque)" checked={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.checked })} />
            <Caixa rotulo="Ativo" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          </div>
          <div className="mt-4">
            <Alerta>{erroForm}</Alerta>
          </div>
          <AcoesFormulario aoCancelar={() => setAberto(false)} salvando={salvando} />
        </form>
      </Modal>

      <ModalCategorias aberto={categoriasAberto} aoFechar={() => setCategoriasAberto(false)} categorias={categorias.dados ?? []} aoMudar={categorias.recarregar} />
    </>
  );
}

function ModalCategorias({ aberto, aoFechar, categorias, aoMudar }: { aberto: boolean; aoFechar: () => void; categorias: Categoria[]; aoMudar: () => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/categorias', { metodo: 'POST', corpo: { nome } });
      setNome('');
      setErro('');
      await aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function remover(c: Categoria) {
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
    try {
      await api(`/categorias/${c.id}`, { metodo: 'DELETE' });
      await aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Modal titulo="Categorias de produtos" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={criar} className="flex gap-2">
        <Campo placeholder="Nova categoria" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1" required />
        <Botao type="submit">Adicionar</Botao>
      </form>
      <div className="mt-3">
        <Alerta>{erro}</Alerta>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              {c.nome} <span className="text-slate-400">({c._count?.produtos ?? 0})</span>
            </span>
            <Botao variante="fantasma" onClick={() => remover(c)} aria-label="Excluir categoria">
              <Trash2 className="size-4" />
            </Botao>
          </li>
        ))}
        {categorias.length === 0 && <li className="py-4 text-center text-sm text-slate-500">Nenhuma categoria cadastrada.</li>}
      </ul>
    </Modal>
  );
}

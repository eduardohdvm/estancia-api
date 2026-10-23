'use client';

import { FileUp, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, qs } from '@/lib/api';
import type { Paginado, Pessoa } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import { AcoesFormulario, Alerta, AreaTexto, Botao, Busca, Cabecalho, Caixa, Campo, Celula, Etiqueta, Modal, Paginacao, Selecao, Tabela } from './ui';

const vazio = {
  tipo: 'FISICA' as Pessoa['tipo'],
  nome: '',
  nomeFantasia: '',
  documento: '',
  email: '',
  telefone: '',
  cep: '',
  endereco: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  observacoes: '',
  cliente: true,
  fornecedor: false,
  ativo: true,
};

type Formulario = typeof vazio;

/** Tela de clientes ou de fornecedores (a mesma pessoa pode ser os dois). */
export function PaginaPessoas({ papel }: { papel: 'cliente' | 'fornecedor' }) {
  const titulo = papel === 'cliente' ? 'Clientes' : 'Fornecedores';
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, recarregar } = useDados<Paginado<Pessoa>>(`/pessoas${qs({ papel, busca, pagina })}`);

  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Formulario>(vazio);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  function abrir(pessoa?: Pessoa) {
    setErroForm('');
    setEditando(pessoa?.id ?? null);
    setForm(
      pessoa
        ? (Object.fromEntries(Object.keys(vazio).map((k) => [k, pessoa[k as keyof Pessoa] ?? ''])) as Formulario)
        : { ...vazio, cliente: papel === 'cliente', fornecedor: papel === 'fornecedor' },
    );
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api(editando ? `/pessoas/${editando}` : '/pessoas', { metodo: editando ? 'PATCH' : 'POST', corpo: form });
      setAberto(false);
      await recarregar();
    } catch (e) {
      setErroForm((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(pessoa: Pessoa) {
    if (!confirm(`Excluir "${pessoa.nome}"?`)) return;
    try {
      await api(`/pessoas/${pessoa.id}`, { metodo: 'DELETE' });
      await recarregar();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const campo = (nome: keyof Formulario) => ({
    value: form[nome] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [nome]: e.target.value }),
  });
  const juridica = form.tipo === 'JURIDICA';

  return (
    <>
      <Cabecalho titulo={titulo} descricao={`Cadastro de ${titulo.toLowerCase()}`}>
        <Link href="/importar?tipo=pessoas" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <FileUp className="size-4" /> Importar
        </Link>
        <Botao onClick={() => abrir()}>
          <Plus className="size-4" /> Novo {papel}
        </Botao>
      </Cabecalho>

      <div className="mb-4">
        <Busca valor={busca} aoMudar={(v) => (setBusca(v), setPagina(1))} placeholder="Nome, documento ou e-mail" />
      </div>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Nome', 'Documento', 'Telefone', 'Cidade', '', '']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <Celula>
              <p className="font-medium text-slate-900">{p.nome}</p>
              {p.nomeFantasia && <p className="text-xs text-slate-500">{p.nomeFantasia}</p>}
            </Celula>
            <Celula>{p.documento ?? '—'}</Celula>
            <Celula>{p.telefone ?? '—'}</Celula>
            <Celula>{p.cidade ? `${p.cidade}${p.uf ? '/' + p.uf : ''}` : '—'}</Celula>
            <Celula>
              <div className="flex gap-1">
                {p.cliente && p.fornecedor && <Etiqueta tom="roxo">Cliente e fornecedor</Etiqueta>}
                {!p.ativo && <Etiqueta>Inativo</Etiqueta>}
              </div>
            </Celula>
            <Celula className="text-right">
              <Botao variante="fantasma" onClick={() => abrir(p)} aria-label="Editar">
                <Pencil className="size-4" />
              </Botao>
              <Botao variante="fantasma" onClick={() => remover(p)} aria-label="Excluir">
                <Trash2 className="size-4" />
              </Botao>
            </Celula>
          </tr>
        ))}
      </Tabela>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />}

      <Modal titulo={editando ? `Editar ${papel}` : `Novo ${papel}`} aberto={aberto} aoFechar={() => setAberto(false)} largura="max-w-2xl">
        <form onSubmit={salvar}>
          <div className="grid gap-4 sm:grid-cols-6">
            <Selecao rotulo="Tipo" className="sm:col-span-2" {...campo('tipo')}>
              <option value="FISICA">Pessoa física</option>
              <option value="JURIDICA">Pessoa jurídica</option>
            </Selecao>
            <Campo rotulo={juridica ? 'CNPJ' : 'CPF'} className="sm:col-span-4" {...campo('documento')} />
            <Campo rotulo={juridica ? 'Razão social' : 'Nome'} required className="sm:col-span-6" {...campo('nome')} />
            {juridica && <Campo rotulo="Nome fantasia" className="sm:col-span-6" {...campo('nomeFantasia')} />}
            <Campo rotulo="E-mail" type="email" className="sm:col-span-3" {...campo('email')} />
            <Campo rotulo="Telefone" className="sm:col-span-3" {...campo('telefone')} />
            <Campo rotulo="CEP" className="sm:col-span-2" {...campo('cep')} />
            <Campo rotulo="Endereço" className="sm:col-span-3" {...campo('endereco')} />
            <Campo rotulo="Número" className="sm:col-span-1" {...campo('numero')} />
            <Campo rotulo="Bairro" className="sm:col-span-2" {...campo('bairro')} />
            <Campo rotulo="Cidade" className="sm:col-span-3" {...campo('cidade')} />
            <Campo rotulo="UF" maxLength={2} className="sm:col-span-1" {...campo('uf')} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
            <AreaTexto rotulo="Observações" className="sm:col-span-6" {...campo('observacoes')} />
          </div>
          <div className="mt-4 flex flex-wrap gap-5">
            <Caixa rotulo="É cliente" checked={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.checked })} />
            <Caixa rotulo="É fornecedor" checked={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.checked })} />
            <Caixa rotulo="Ativo" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          </div>
          <div className="mt-4">
            <Alerta>{erroForm}</Alerta>
          </div>
          <AcoesFormulario aoCancelar={() => setAberto(false)} salvando={salvando} />
        </form>
      </Modal>
    </>
  );
}

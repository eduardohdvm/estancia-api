'use client';

import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { AcoesFormulario, Alerta, Botao, Cabecalho, Caixa, Campo, Celula, Etiqueta, Modal, Selecao, Tabela } from '@/components/ui';
import { api } from '@/lib/api';
import { data, rotuloPerfil } from '@/lib/formato';
import type { Perfil, UsuarioEmpresa } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

const descricaoPerfil: Record<Perfil, string> = {
  ADMIN: 'Acesso total, inclusive usuários',
  GERENTE: 'Tudo, exceto gerenciar usuários',
  VENDEDOR: 'Vendas, clientes e consulta de produtos',
  FINANCEIRO: 'Contas a pagar e receber, caixa e bancos',
  ESTOQUISTA: 'Produtos e movimentações de estoque',
};

const vazio = { nome: '', email: '', senha: '', perfil: 'VENDEDOR' as Perfil, ativo: true };

export default function Usuarios() {
  const { dados, erro, carregando, recarregar } = useDados<UsuarioEmpresa[]>('/usuarios');
  const [editando, setEditando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(vazio);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  function abrir(u?: UsuarioEmpresa) {
    setErroForm('');
    setEditando(u?.id ?? null);
    setForm(u ? { nome: u.nome, email: u.email, senha: '', perfil: u.perfil, ativo: u.ativo } : vazio);
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const corpo = { ...form, senha: form.senha || undefined };
    try {
      await api(editando ? `/usuarios/${editando}` : '/usuarios', { metodo: editando ? 'PATCH' : 'POST', corpo });
      setAberto(false);
      await recarregar();
    } catch (e) {
      setErroForm((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Quem acessa o sistema e o que cada um pode fazer">
        <Botao onClick={() => abrir()}>
          <Plus className="size-4" /> Novo usuário
        </Botao>
      </Cabecalho>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Nome', 'E-mail', 'Perfil', 'Desde', '', '']} vazio={dados?.length === 0} carregando={carregando && !dados}>
        {dados?.map((u) => (
          <tr key={u.id} className="hover:bg-slate-50">
            <Celula className="font-medium text-slate-900">{u.nome}</Celula>
            <Celula>{u.email}</Celula>
            <Celula>
              <Etiqueta tom={u.perfil === 'ADMIN' ? 'roxo' : 'azul'}>{rotuloPerfil[u.perfil]}</Etiqueta>
            </Celula>
            <Celula className="text-slate-500">{data(u.createdAt)}</Celula>
            <Celula>{!u.ativo && <Etiqueta tom="vermelho">Inativo</Etiqueta>}</Celula>
            <Celula className="text-right">
              <Botao variante="fantasma" onClick={() => abrir(u)} aria-label="Editar">
                <Pencil className="size-4" />
              </Botao>
            </Celula>
          </tr>
        ))}
      </Tabela>

      <Modal titulo={editando ? 'Editar usuário' : 'Novo usuário'} aberto={aberto} aoFechar={() => setAberto(false)}>
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Campo rotulo="Nome" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Campo rotulo="E-mail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Campo
            rotulo={editando ? 'Nova senha (deixe em branco para manter)' : 'Senha'}
            type="password"
            autoComplete="new-password"
            minLength={6}
            required={!editando}
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
          />
          <Selecao rotulo="Perfil" value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as Perfil })}>
            {(Object.keys(descricaoPerfil) as Perfil[]).map((p) => (
              <option key={p} value={p}>
                {rotuloPerfil[p]}
              </option>
            ))}
          </Selecao>
          <p className="-mt-2 text-xs text-slate-500">{descricaoPerfil[form.perfil]}</p>
          <Caixa rotulo="Usuário ativo" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          <Alerta>{erroForm}</Alerta>
          <AcoesFormulario aoCancelar={() => setAberto(false)} salvando={salvando} />
        </form>
      </Modal>
    </>
  );
}

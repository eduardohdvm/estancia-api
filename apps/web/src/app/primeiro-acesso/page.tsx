'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TelaAcesso } from '@/components/tela-acesso';
import { Alerta, Botao, Campo } from '@/components/ui';
import { api } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import type { UsuarioSessao } from '@/lib/tipos';

/** Cria o primeiro administrador. Só aparece enquanto o sistema não tem nenhum usuário. */
export default function PrimeiroAcesso() {
  const router = useRouter();
  const { entrar } = useSessao();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmacao: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campo = (nome: keyof typeof form) => ({
    value: form[nome],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [nome]: e.target.value }),
  });

  // Se já existe usuário, esta tela não serve mais: volta para o login.
  useEffect(() => {
    api<{ disponivel: boolean }>('/auth/primeiro-acesso')
      .then(({ disponivel }) => !disponivel && router.replace('/login'))
      .catch(() => undefined);
  }, [router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (form.senha !== form.confirmacao) return setErro('As senhas não conferem');
    setEnviando(true);
    setErro('');
    try {
      const { nome, email, senha } = form;
      entrar(await api<{ token: string; usuario: UsuarioSessao }>('/auth/primeiro-acesso', { metodo: 'POST', corpo: { nome, email, senha } }));
      router.replace('/painel');
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Boas-vindas à Estância Maciel" subtitulo="Crie a conta de administrador para começar">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo rotulo="Seu nome" required autoComplete="name" {...campo('nome')} />
        <Campo rotulo="E-mail" type="email" autoComplete="email" required {...campo('email')} />
        <Campo rotulo="Senha" type="password" autoComplete="new-password" minLength={8} required {...campo('senha')} />
        <Campo rotulo="Repita a senha" type="password" autoComplete="new-password" minLength={8} required {...campo('confirmacao')} />
        <p className="-mt-2 text-xs text-slate-500">Use pelo menos 8 caracteres. Esta conta pode tudo no sistema: guarde bem a senha.</p>
        <Alerta>{erro}</Alerta>
        <Botao type="submit" carregando={enviando} className="w-full">
          Criar conta e entrar
        </Botao>
      </form>
    </TelaAcesso>
  );
}

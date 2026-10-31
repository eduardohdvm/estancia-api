'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TelaAcesso } from '@/components/tela-acesso';
import { Alerta, Botao, Campo } from '@/components/ui';
import { api } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import type { UsuarioSessao } from '@/lib/tipos';

export default function Login() {
  const router = useRouter();
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Sistema recém-instalado, sem nenhum usuário: vai direto para a criação do administrador.
  useEffect(() => {
    api<{ disponivel: boolean }>('/auth/primeiro-acesso')
      .then(({ disponivel }) => disponivel && router.replace('/primeiro-acesso'))
      .catch(() => undefined);
  }, [router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      entrar(await api<{ token: string; usuario: UsuarioSessao }>('/auth/login', { metodo: 'POST', corpo: { email, senha } }));
      router.replace('/painel');
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Estância Maciel" subtitulo="Entre com sua conta para continuar">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo rotulo="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Link href="/esqueci-senha" className="-mt-2 self-end text-sm text-indigo-600 hover:underline">
          Esqueci minha senha
        </Link>
        <Alerta>{erro}</Alerta>
        <Botao type="submit" carregando={enviando} className="w-full">
          Entrar
        </Botao>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Não tem conta? Peça ao administrador para criar o seu acesso.</p>
    </TelaAcesso>
  );
}

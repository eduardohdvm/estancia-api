'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
    <TelaAcesso titulo="Verissimo ERP" subtitulo="Entre com sua conta para continuar">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo rotulo="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Alerta>{erro}</Alerta>
        <Botao type="submit" carregando={enviando} className="w-full">
          Entrar
        </Botao>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Ainda não tem conta?{' '}
        <Link href="/registrar" className="font-medium text-indigo-600 hover:underline">
          Cadastre sua empresa
        </Link>
      </p>
    </TelaAcesso>
  );
}

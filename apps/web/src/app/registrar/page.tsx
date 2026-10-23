'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TelaAcesso } from '@/components/tela-acesso';
import { Alerta, Botao, Campo } from '@/components/ui';
import { api } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import type { UsuarioSessao } from '@/lib/tipos';

export default function Registrar() {
  const router = useRouter();
  const { entrar } = useSessao();
  const [form, setForm] = useState({ empresa: '', cnpj: '', nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campo = (nome: keyof typeof form) => ({
    value: form[nome],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [nome]: e.target.value }),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      entrar(await api<{ token: string; usuario: UsuarioSessao }>('/auth/registrar', { metodo: 'POST', corpo: form }));
      router.replace('/painel');
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Cadastre sua empresa" subtitulo="Comece a usar o Verissimo ERP em poucos minutos">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo rotulo="Nome da empresa" required {...campo('empresa')} />
        <Campo rotulo="CNPJ (opcional)" {...campo('cnpj')} />
        <Campo rotulo="Seu nome" required {...campo('nome')} />
        <Campo rotulo="E-mail" type="email" autoComplete="email" required {...campo('email')} />
        <Campo rotulo="Senha" type="password" autoComplete="new-password" minLength={6} required {...campo('senha')} />
        <Alerta>{erro}</Alerta>
        <Botao type="submit" carregando={enviando} className="w-full">
          Criar conta
        </Botao>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Entrar
        </Link>
      </p>
    </TelaAcesso>
  );
}

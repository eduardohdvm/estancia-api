'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { TelaAcesso } from '@/components/tela-acesso';
import { Alerta, Botao, Campo } from '@/components/ui';
import { api } from '@/lib/api';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      setEnviado((await api<{ mensagem: string }>('/auth/esqueci-senha', { metodo: 'POST', corpo: { email } })).mensagem);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Esqueci minha senha" subtitulo="Enviaremos um link para você criar uma senha nova">
      {enviado ? (
        <div className="text-center">
          <MailCheck className="mx-auto size-10 text-emerald-500" />
          <p className="mt-3 text-sm text-slate-700">{enviado}</p>
          <p className="mt-2 text-xs text-slate-500">O link vale por 1 hora. Confira também a caixa de spam.</p>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo rotulo="E-mail da sua conta" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <Alerta>{erro}</Alerta>
          <Botao type="submit" carregando={enviando} className="w-full">
            Enviar link
          </Botao>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </TelaAcesso>
  );
}

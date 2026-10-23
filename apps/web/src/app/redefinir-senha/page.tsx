'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { TelaAcesso } from '@/components/tela-acesso';
import { Alerta, Botao, Campo } from '@/components/ui';
import { api } from '@/lib/api';

export default function Pagina() {
  return (
    <Suspense>
      <RedefinirSenha />
    </Suspense>
  );
}

function RedefinirSenha() {
  const token = useSearchParams().get('token') ?? '';
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmacao) {
      setErro('As senhas não são iguais');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await api('/auth/redefinir-senha', { metodo: 'POST', corpo: { token, senha } });
      setPronto(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaAcesso titulo="Criar senha nova" subtitulo="Escolha uma senha com pelo menos 6 caracteres">
      {pronto ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <p className="mt-3 text-sm text-slate-700">Senha alterada com sucesso.</p>
          <Link href="/login" className="mt-5 inline-flex w-full justify-center rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Entrar
          </Link>
        </div>
      ) : !token ? (
        <div className="text-center text-sm text-slate-600">
          <p>Este endereço está incompleto.</p>
          <Link href="/esqueci-senha" className="mt-3 inline-block font-medium text-indigo-600 hover:underline">
            Pedir um link novo
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo rotulo="Senha nova" type="password" autoComplete="new-password" minLength={6} required autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Campo rotulo="Repita a senha nova" type="password" autoComplete="new-password" minLength={6} required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          <Alerta>{erro}</Alerta>
          {erro.includes('expirou') && (
            <Link href="/esqueci-senha" className="text-center text-sm font-medium text-indigo-600 hover:underline">
              Pedir um link novo
            </Link>
          )}
          <Botao type="submit" carregando={enviando} className="w-full">
            Salvar senha nova
          </Botao>
        </form>
      )}
    </TelaAcesso>
  );
}

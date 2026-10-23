'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, token } from './api';
import type { Perfil, UsuarioSessao } from './tipos';

interface Sessao {
  usuario: UsuarioSessao | null;
  carregando: boolean;
  entrar: (resposta: { token: string; usuario: UsuarioSessao }) => void;
  sair: () => void;
  /** ADMIN sempre pode; os demais precisam estar na lista. */
  pode: (...perfis: Perfil[]) => boolean;
}

const SessaoContext = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!token.ler()) {
      setCarregando(false);
      return;
    }
    api<UsuarioSessao>('/auth/eu')
      .then(setUsuario)
      .catch(() => token.limpar())
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback((resposta: { token: string; usuario: UsuarioSessao }) => {
    token.salvar(resposta.token);
    setUsuario(resposta.usuario);
  }, []);

  const sair = useCallback(() => {
    token.limpar();
    setUsuario(null);
    router.replace('/login');
  }, [router]);

  const pode = useCallback(
    (...perfis: Perfil[]) => !!usuario && (usuario.perfil === 'ADMIN' || perfis.includes(usuario.perfil)),
    [usuario],
  );

  return <SessaoContext.Provider value={{ usuario, carregando, entrar, sair, pode }}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return ctx;
}

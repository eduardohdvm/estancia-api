'use client';

import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardList,
  KanbanSquare,
  LayoutDashboard,
  Landmark,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { rotuloPerfil } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { Perfil } from '@/lib/tipos';

type ItemMenu = { href: string; rotulo: string; icone: React.ElementType; perfis?: Perfil[] };

/** Todos os perfis menos o operador de caixa, que só usa o PDV. */
const RETAGUARDA: Perfil[] = ['GERENTE', 'VENDEDOR', 'FINANCEIRO', 'ESTOQUISTA'];

const menu: { grupo: string; itens: ItemMenu[] }[] = [
  { grupo: '', itens: [{ href: '/painel', rotulo: 'Painel', icone: LayoutDashboard, perfis: RETAGUARDA }] },
  {
    grupo: 'Cadastros',
    itens: [
      { href: '/clientes', rotulo: 'Clientes', icone: Users },
      { href: '/fornecedores', rotulo: 'Fornecedores', icone: Truck, perfis: RETAGUARDA },
      { href: '/produtos', rotulo: 'Produtos e serviços', icone: Package },
    ],
  },
  {
    grupo: 'Operação',
    itens: [
      { href: '/pdv', rotulo: 'Frente de caixa (PDV)', icone: Monitor, perfis: ['GERENTE', 'VENDEDOR', 'CAIXA'] },
      { href: '/vendas', rotulo: 'Vendas', icone: ShoppingCart, perfis: ['GERENTE', 'VENDEDOR'] },
      { href: '/compras', rotulo: 'Compras', icone: ClipboardList, perfis: ['GERENTE', 'ESTOQUISTA'] },
      { href: '/estoque', rotulo: 'Estoque', icone: Boxes, perfis: RETAGUARDA },
    ],
  },
  {
    grupo: 'CRM',
    itens: [
      { href: '/crm', rotulo: 'Funil de vendas', icone: KanbanSquare, perfis: ['GERENTE', 'VENDEDOR'] },
      { href: '/crm/tarefas', rotulo: 'Tarefas e follow-ups', icone: CalendarCheck, perfis: ['GERENTE', 'VENDEDOR'] },
    ],
  },
  {
    grupo: 'Financeiro',
    itens: [
      { href: '/financeiro', rotulo: 'Visão geral', icone: Wallet, perfis: ['GERENTE', 'FINANCEIRO'] },
      { href: '/financeiro/receber', rotulo: 'Contas a receber', icone: ArrowDownCircle, perfis: ['GERENTE', 'FINANCEIRO'] },
      { href: '/financeiro/pagar', rotulo: 'Contas a pagar', icone: ArrowUpCircle, perfis: ['GERENTE', 'FINANCEIRO'] },
      { href: '/financeiro/contas', rotulo: 'Caixa e bancos', icone: Landmark, perfis: ['GERENTE', 'FINANCEIRO'] },
      { href: '/pdv/caixas', rotulo: 'Fechamentos de caixa', icone: Receipt, perfis: ['GERENTE'] },
    ],
  },
  { grupo: 'Análises', itens: [{ href: '/relatorios', rotulo: 'Relatórios', icone: BarChart3, perfis: ['GERENTE', 'FINANCEIRO'] }] },
  { grupo: 'Configurações', itens: [{ href: '/usuarios', rotulo: 'Usuários', icone: UserCog, perfis: [] }] },
];

export default function LayoutSistema({ children }: { children: React.ReactNode }) {
  const { usuario, carregando, sair, pode } = useSessao();
  const router = useRouter();
  const caminho = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!carregando && !usuario) router.replace('/login');
  }, [carregando, usuario, router]);

  useEffect(() => setMenuAberto(false), [caminho]);

  if (carregando || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  // O item mais específico que bate com a URL fica destacado.
  const ativo = menu
    .flatMap((g) => g.itens)
    .filter((i) => caminho === i.href || caminho.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const barraLateral = (
    <nav className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500 font-bold text-white">V</div>
        <span className="text-lg font-semibold text-white">Verissimo ERP</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {menu.map(({ grupo, itens }) => {
          const visiveis = itens.filter((i) => !i.perfis || pode(...i.perfis));
          if (!visiveis.length) return null;
          return (
            <div key={grupo} className="mt-4 first:mt-0">
              {grupo && <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{grupo}</p>}
              {visiveis.map(({ href, rotulo, icone: Icone }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    ativo === href ? 'bg-slate-800 font-medium text-white' : 'hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icone className="size-4" />
                  {rotulo}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="size-4 shrink-0 text-slate-500" />
          <span className="truncate text-white">{usuario.empresa.nome}</span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {usuario.nome} · {rotuloPerfil[usuario.perfil]}
        </p>
        <button onClick={sair} className="mt-3 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{barraLateral}</aside>

      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{barraLateral}</aside>
          <button className="absolute left-66 top-4 rounded-lg bg-white p-1.5" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
            <X className="size-5" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          <Menu className="size-6 text-slate-700" />
        </button>
        <span className="font-semibold text-slate-900">Verissimo ERP</span>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

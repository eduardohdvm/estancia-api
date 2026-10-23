'use client';

import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

// ─────────── Botões ───────────

type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma';

const variantes: Record<VarianteBotao, string> = {
  primario: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  perigo: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  fantasma: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
};

export function Botao({
  variante = 'primario',
  carregando,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; carregando?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        variantes[variante],
        className,
      )}
      {...props}
    >
      {carregando && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

// ─────────── Campos de formulário ───────────

const estiloCampo =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50';

function Rotulo({ texto, children, className }: { texto?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      {texto && <span className="text-sm font-medium text-slate-700">{texto}</span>}
      {children}
    </label>
  );
}

export function Campo({ rotulo, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { rotulo?: string }) {
  return (
    <Rotulo texto={rotulo} className={className}>
      <input className={estiloCampo} {...props} />
    </Rotulo>
  );
}

export function Selecao({
  rotulo,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { rotulo?: string }) {
  return (
    <Rotulo texto={rotulo} className={className}>
      <select className={estiloCampo} {...props}>
        {children}
      </select>
    </Rotulo>
  );
}

export function AreaTexto({ rotulo, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo?: string }) {
  return (
    <Rotulo texto={rotulo} className={className}>
      <textarea className={estiloCampo} rows={3} {...props} />
    </Rotulo>
  );
}

export function Caixa({ rotulo, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="size-4 rounded border-slate-300 accent-indigo-600" {...props} />
      {rotulo}
    </label>
  );
}

/** Campo de busca que só dispara depois que a pessoa para de digitar. */
export function Busca({ valor, aoMudar, placeholder = 'Buscar...' }: { valor: string; aoMudar: (v: string) => void; placeholder?: string }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => texto !== valor && aoMudar(texto), 350);
    return () => clearTimeout(t);
  }, [texto, valor, aoMudar]);
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input className={cx(estiloCampo, 'pl-9')} placeholder={placeholder} value={texto} onChange={(e) => setTexto(e.target.value)} />
    </div>
  );
}

// ─────────── Estrutura de página ───────────

export function Cabecalho({ titulo, descricao, children }: { titulo: string; descricao?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Cartao({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>;
}

export function Indicador({ rotulo, valor, detalhe, tom = 'neutro' }: { rotulo: string; valor: string; detalhe?: string; tom?: 'neutro' | 'bom' | 'ruim' }) {
  return (
    <Cartao className="p-5">
      <p className="text-sm text-slate-500">{rotulo}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular-nums', tom === 'bom' && 'text-emerald-600', tom === 'ruim' && 'text-rose-600', tom === 'neutro' && 'text-slate-900')}>
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </Cartao>
  );
}

export function Alerta({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className="whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{children}</div>;
}

// ─────────── Tabela ───────────

export function Tabela({ cabecalhos, children, vazio, carregando }: { cabecalhos: React.ReactNode[]; children: React.ReactNode; vazio?: boolean; carregando?: boolean }) {
  return (
    <Cartao className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {cabecalhos.map((c, i) => (
                <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
      {carregando && (
        <div className="flex justify-center p-8 text-slate-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {!carregando && vazio && <p className="p-8 text-center text-sm text-slate-500">Nenhum registro encontrado.</p>}
    </Cartao>
  );
}

export function Celula({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx('whitespace-nowrap px-4 py-3 text-slate-700', className)} {...props}>
      {children}
    </td>
  );
}

export function Paginacao({ pagina, paginas, total, aoMudar }: { pagina: number; paginas: number; total: number; aoMudar: (p: number) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
      <span>{total} registro(s)</span>
      <div className="flex items-center gap-1">
        <Botao variante="fantasma" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft className="size-4" />
        </Botao>
        <span className="px-2">
          {pagina} de {paginas}
        </span>
        <Botao variante="fantasma" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)} aria-label="Próxima página">
          <ChevronRight className="size-4" />
        </Botao>
      </div>
    </div>
  );
}

// ─────────── Etiquetas de status ───────────

const tons = {
  cinza: 'bg-slate-100 text-slate-700',
  azul: 'bg-sky-100 text-sky-700',
  verde: 'bg-emerald-100 text-emerald-700',
  amarelo: 'bg-amber-100 text-amber-800',
  vermelho: 'bg-rose-100 text-rose-700',
  roxo: 'bg-indigo-100 text-indigo-700',
};

export function Etiqueta({ tom = 'cinza', children }: { tom?: keyof typeof tons; children: React.ReactNode }) {
  return <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tons[tom])}>{children}</span>;
}

const statusInfo: Record<string, [string, keyof typeof tons]> = {
  ORCAMENTO: ['Orçamento', 'cinza'],
  APROVADO: ['Aprovado', 'azul'],
  FATURADO: ['Faturado', 'verde'],
  CANCELADO: ['Cancelado', 'vermelho'],
  ABERTO: ['Em aberto', 'amarelo'],
  PAGO: ['Pago', 'verde'],
  VENCIDO: ['Vencido', 'vermelho'],
  ENTRADA: ['Entrada', 'verde'],
  SAIDA: ['Saída', 'vermelho'],
  AJUSTE: ['Ajuste', 'roxo'],
};

export function Status({ valor }: { valor: string }) {
  const [texto, tom] = statusInfo[valor] ?? [valor, 'cinza'];
  return <Etiqueta tom={tom}>{texto}</Etiqueta>;
}

// ─────────── Janela modal ───────────

export function Modal({
  titulo,
  aberto,
  aoFechar,
  children,
  largura = 'max-w-lg',
}: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: React.ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onMouseDown={aoFechar}>
      <div className={cx('w-full rounded-xl bg-white shadow-xl', largura)} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button onClick={aoFechar} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Rodapé padrão de formulários em modal. */
export function AcoesFormulario({ aoCancelar, salvando, textoSalvar = 'Salvar' }: { aoCancelar: () => void; salvando?: boolean; textoSalvar?: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Botao variante="secundario" onClick={aoCancelar}>
        Cancelar
      </Botao>
      <Botao type="submit" carregando={salvando}>
        {textoSalvar}
      </Botao>
    </div>
  );
}

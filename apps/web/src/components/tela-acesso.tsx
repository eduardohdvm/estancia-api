/** Moldura das telas de login e cadastro. */
export function TelaAcesso({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-[#f8f3ea] to-white p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo.jpg" alt="Estância Maciel — Culinária Caipira" width={112} height={112} className="mx-auto mb-3 size-28 rounded-full object-cover shadow-md ring-4 ring-white" />
          <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}

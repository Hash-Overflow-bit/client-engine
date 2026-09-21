import type { ReactNode } from 'react';
export function PageShell({ title, description, children }: Readonly<{ title: string; description: string; children?: ReactNode }>) {
  return <section className="mx-auto max-w-6xl">
    <header className="border-b border-slate-200 pb-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Client Engine</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></header>
    <div className="mt-6">{children ?? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8"><p className="text-sm text-slate-500">This workspace is ready for the next milestone.</p></div>}</div>
  </section>;
}

import Link from 'next/link';
import type { ReactNode } from 'react';
import { navigation } from '../lib/navigation';
export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
    <aside className="border-b border-slate-200 bg-white p-5 lg:min-h-screen lg:border-r lg:border-b-0">
      <Link className="flex items-center gap-3 text-base font-semibold text-slate-950" href="/dashboard"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">CE</span><span>Client Engine</span></Link>
      <p className="mt-2 pl-11 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Acquisition workspace</p>
      <nav aria-label="Primary navigation" className="mt-8 flex gap-2 overflow-x-auto lg:flex-col">
        {navigation.map((item) => <Link className="whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <div className="mt-8 hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:block"><p className="text-xs font-semibold text-slate-700">Development workspace</p><p className="mt-1 text-xs leading-5 text-slate-500">Demo data only. Sending is disabled until integrations are configured.</p></div>
    </aside>
    <main className="min-w-0 bg-[#f7f8fa] p-5 lg:p-10">{children}</main>
  </div>;
}

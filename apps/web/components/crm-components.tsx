import type { ReactNode } from 'react';

const stageLabels: Record<string, string> = {
  new: 'New', qualified: 'Qualified', ready: 'Ready', contacted: 'Contacted', replied: 'Replied', meeting: 'Meeting', proposal: 'Proposal', won: 'Won',
};

const stageStyles: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700',
  qualified: 'bg-blue-50 text-blue-700',
  ready: 'bg-indigo-50 text-indigo-700',
  contacted: 'bg-violet-50 text-violet-700',
  replied: 'bg-amber-50 text-amber-700',
  meeting: 'bg-teal-50 text-teal-700',
  proposal: 'bg-orange-50 text-orange-700',
  won: 'bg-emerald-50 text-emerald-700',
};

const metricStyles = {
  neutral: 'border-slate-200 bg-white',
  blue: 'border-blue-100 bg-blue-50/50',
  violet: 'border-violet-100 bg-violet-50/50',
  amber: 'border-amber-100 bg-amber-50/50',
  emerald: 'border-emerald-100 bg-emerald-50/50',
  teal: 'border-teal-100 bg-teal-50/50',
  orange: 'border-orange-100 bg-orange-50/50',
  green: 'border-green-100 bg-green-50/50',
} as const;

export function StageBadge({ stage }: Readonly<{ stage: string }>) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${stageStyles[stage]}`}>{stageLabels[stage]}</span>;
}

export function ScoreBadge({ score }: Readonly<{ score: number }>) {
  const color = score >= 85 ? 'text-emerald-700 bg-emerald-50' : score >= 70 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{score}/100</span>;
}

export function Avatar({ lead, size = 'md' }: Readonly<{ lead: { initials: string }; size?: 'sm' | 'md' | 'lg' }>) {
  const sizes = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-sm' } as const;
  return <div aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-semibold text-white ${sizes[size]}`}>{lead.initials}</div>;
}

export function MetricCard({ label, value, delta, tone }: Readonly<{ label: string; value: string; delta: string; tone: keyof typeof metricStyles }>) {
  return <article className={`rounded-2xl border p-4 shadow-sm shadow-slate-200/40 ${metricStyles[tone]}`}>
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p><span className="h-2 w-2 rounded-full bg-current text-slate-400" /></div>
    <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{delta}</p>
  </article>;
}

export function SectionCard({ title, description, action, children, className = '' }: Readonly<{ title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }>) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 ${className}`}>
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-950">{title}</h2>{description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}</div>{action}</div>
    {children}
  </section>;
}

export function EmptyState({ title, description, action }: Readonly<{ title: string; description: string; action?: ReactNode }>) {
  return <div className="flex flex-col items-center justify-center px-6 py-14 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">—</div><h2 className="mt-4 text-sm font-semibold text-slate-900">{title}</h2><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

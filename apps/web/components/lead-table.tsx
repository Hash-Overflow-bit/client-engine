'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { leads, type FunnelStage, type Lead } from '../lib/crm-data';
import { Avatar, ScoreBadge, StageBadge } from './crm-components';

const stages: ReadonlyArray<{ value: 'all' | FunnelStage; label: string }> = [
  { value: 'all', label: 'All stages' },
  { value: 'new', label: 'New' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'ready', label: 'Ready' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
];

export function LeadTable() {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<'all' | FunnelStage>('all');
  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStage = stage === 'all' || lead.stage === stage;
      const matchesQuery = !normalizedQuery || `${lead.name} ${lead.company} ${lead.email}`.toLowerCase().includes(normalizedQuery);
      return matchesStage && matchesQuery;
    });
  }, [query, stage]);

  return <>
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4"><label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="text-slate-400" aria-hidden="true">⌕</span><span className="sr-only">Search leads</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search people or companies" /></label><label className="sr-only" htmlFor="stage-filter">Filter by stage</label><select id="stage-filter" value={stage} onChange={(event) => setStage(event.target.value as 'all' | FunnelStage)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">{stages.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{filteredLeads.length} visible</span></div>
    {filteredLeads.length > 0 ? <><div className="hidden grid-cols-[1.8fr_1.2fr_0.8fr_0.8fr_1fr] gap-4 border-b border-slate-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400 md:grid"><span>Lead</span><span>Company</span><span>Stage</span><span>Score</span><span>Last activity</span></div><div className="divide-y divide-slate-100">{filteredLeads.map((lead) => <LeadTableRow key={lead.id} lead={lead} />)}</div></> : <div className="px-5 py-14 text-center"><p className="text-sm font-semibold text-slate-900">No matching leads</p><p className="mt-1 text-xs text-slate-500">Try a different name, company, or stage.</p></div>}
  </>;
}

function LeadTableRow({ lead }: Readonly<{ lead: Lead }>) {
  return <Link className="grid items-center gap-4 px-4 py-4 transition hover:bg-slate-50 md:grid-cols-[1.8fr_1.2fr_0.8fr_0.8fr_1fr] md:px-5" href={`/leads/${lead.id}`}><div className="flex min-w-0 items-center gap-3"><Avatar lead={lead} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p><p className="truncate text-xs text-slate-500">{lead.role}</p></div></div><div className="hidden min-w-0 md:block"><p className="truncate text-sm font-medium text-slate-700">{lead.company}</p><p className="truncate text-xs text-slate-400">{lead.companyDomain}</p></div><div className="mt-2 md:mt-0"><StageBadge stage={lead.stage} /></div><div className="mt-2 md:mt-0"><ScoreBadge score={lead.score} /></div><p className="mt-2 text-xs text-slate-500 md:mt-0">{lead.lastActivity}</p></Link>;
}

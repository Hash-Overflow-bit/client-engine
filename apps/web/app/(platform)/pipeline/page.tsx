import type { Metadata } from 'next';
import Link from 'next/link';
import { PipelineBoard } from '../../../components/crm-components';
import { PageShell } from '../../../components/page-shell';
export const metadata: Metadata = { title: 'Pipeline' };
export default function PipelinePage() {
  return <PageShell title="Pipeline" description="Track leads from discovery through won clients. Drag-and-drop is intentionally disabled until stage transitions are connected to the database.">
    <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><div><p className="text-sm font-semibold text-slate-900">8 visible leads</p><p className="mt-1 text-xs text-slate-500">Each card opens the complete lead record and next action.</p></div><Link className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" href="/leads">View list</Link></div><PipelineBoard /></div>
  </PageShell>;
}

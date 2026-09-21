import type { Metadata } from 'next';
import { LeadTable } from '../../../components/lead-table';
import { SectionCard } from '../../../components/crm-components';
import { PageShell } from '../../../components/page-shell';
import Link from 'next/link';
import { EmptyState } from '../../../components/crm-components';
import { authorizeWorkspace, loadWorkspaceLeads } from '../../../lib/live-crm';
import { CsvImportButton } from '../../../components/csv-import-button';
export const metadata: Metadata = { title: 'Leads' };
export const dynamic = 'force-dynamic';
export default async function LeadsPage() {
  let leads: Awaited<ReturnType<typeof loadWorkspaceLeads>> = [];
  let error: string | null = null;
  try { leads = await loadWorkspaceLeads(await authorizeWorkspace()); } catch (cause) { error = cause instanceof Error ? cause.message : 'Unable to load leads'; }
  return <PageShell title="Leads" description="Review discovered, enriched, and qualified leads before they enter outreach.">
    <SectionCard title="Lead workspace" description="Workspace-scoped records from Supabase." action={<div className="flex flex-wrap gap-2"><Link href="/leads/new" className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">+ Add Lead</Link><CsvImportButton /></div>}>
      {error ? <EmptyState title="Leads unavailable" description={error} /> : leads.length ? <LeadTable leads={leads} /> : <EmptyState title="No leads yet" description="Add a lead manually to start the workspace funnel." action={<Link href="/leads/new" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white">+ Add Lead</Link>} />}
    </SectionCard>
  </PageShell>;
}

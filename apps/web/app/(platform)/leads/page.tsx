import type { Metadata } from 'next';
import { LeadTable } from '../../../components/lead-table';
import { SectionCard } from '../../../components/crm-components';
import { PageShell } from '../../../components/page-shell';
export const metadata: Metadata = { title: 'Leads' };
export default function LeadsPage() {
  return <PageShell title="Leads" description="Review discovered, enriched, and qualified leads before they enter outreach.">
    <SectionCard title="Lead workspace" description="Demo records are shown until a workspace is connected to Supabase."><LeadTable /></SectionCard>
  </PageShell>;
}

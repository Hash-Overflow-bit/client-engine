import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '../../../../components/page-shell';
import { SectionCard } from '../../../../components/crm-components';
import { LeadForm } from '../../../../components/lead-form';
export const metadata: Metadata = { title: 'Add Lead' };
export default function NewLeadPage() { return <PageShell title="Add lead" description="Create a workspace-scoped manual lead. Duplicate identities are handled by the ingestion boundary."><SectionCard title="Lead details" description="Source is fixed to manual and workspace membership is resolved on the server."><LeadForm /></SectionCard><Link href="/leads" className="mt-4 inline-block text-xs font-semibold text-slate-600">← Back to leads</Link></PageShell>; }

import type { Metadata } from 'next';
import { PageShell } from '../../../components/page-shell';
export const metadata: Metadata = { title: 'Campaigns' };
export default function CampaignsPage() { return <PageShell title="Campaigns" description="Configure bounded, approval-only outreach campaigns." />; }

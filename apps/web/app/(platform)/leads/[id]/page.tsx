import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, ScoreBadge, SectionCard, StageBadge, EmptyState } from '../../../../components/crm-components';
import { PageShell } from '../../../../components/page-shell';
import { authorizeWorkspace, loadWorkspaceLead } from '../../../../lib/live-crm';
import { loadLiveLeadConversation } from '../../../../lib/live-lead-conversation';
import { LiveConversationPanel } from '../../../../components/live-conversation-panel';
import { LiveFollowUpPlan } from '../../../../components/live-follow-up-plan';
import { LiveProposalSummary } from '../../../../components/live-proposal-summary';
import { LiveDealSummary } from '../../../../components/live-deal-summary';
import { OutreachReviewActions, MarkSentButton, PrepareDeliveryButton } from '../../../../components/outreach-review-actions';
import { LeadWorkflowActions } from '../../../../components/lead-workflow-actions';

type Props = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Props): Promise<Metadata> { return { title: `Lead ${(await params).id}` }; }

export default async function LeadPage({ params }: Props) {
  const { id } = await params;
  let auth;
  try { auth = await authorizeWorkspace(); } catch (error) { return <PageShell title="Lead unavailable" description={error instanceof Error ? error.message : 'Authentication required'}><EmptyState title="Sign in required" description="An authenticated workspace is required to view this lead." /></PageShell>; }
  const lead = await loadWorkspaceLead(auth, id);
  if (!lead) notFound();
  const [{ data: company }, { data: drafts }, { data: deliveries }, { data: conversations }] = await Promise.all([
    auth.supabase.from('companies').select('name,domain,research_status,research_output,research_error,research_updated_at').eq('workspace_id', auth.workspaceId).eq('id', lead.companyId).maybeSingle(),
    auth.supabase.from('outreach_drafts').select('id,subject,body,status,version,confidence,warnings').eq('workspace_id', auth.workspaceId).eq('lead_id', id).order('version', { ascending: false }).limit(5),
    auth.supabase.from('delivery_records').select('id,status,subject,body,prepared_at').eq('workspace_id', auth.workspaceId).eq('lead_id', id).order('created_at', { ascending: false }).limit(5),
    auth.supabase.from('conversations').select('id').eq('workspace_id', auth.workspaceId).eq('lead_id', id).limit(1).maybeSingle(),
  ]);
  const liveConversation = await loadLiveLeadConversation(id);
  const research = (company?.research_output ?? {}) as Record<string, unknown>;
  return <PageShell title="Lead details" description="Workspace-scoped qualification, research, review and assisted delivery.">
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><Avatar lead={lead} size="lg" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-slate-950">{lead.name}</h2><StageBadge stage={lead.stage} /></div><p className="mt-1 text-sm text-slate-500">{lead.role} · <span className="font-medium text-slate-700">{lead.company}</span></p><p className="mt-2 text-xs text-slate-400">{lead.email} · Added via {lead.source}</p></div></div><Link className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" href="/leads">Back to leads</Link></div>
      <LeadWorkflowActions leadId={id} conversationId={conversations?.id ? String(conversations.id) : null} />
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"><div className="space-y-6"><SectionCard title="Company research" description={company?.research_status ? `Status: ${company.research_status}` : 'Research has not been run.'}><div className="space-y-4 p-5">{company?.research_error && <p className="text-sm text-amber-700">{company.research_error}</p>}<p className="text-sm leading-6 text-slate-600">{String(research.companySummary ?? 'No persisted research yet. Run Research Company to collect bounded public evidence.')}</p>{Array.isArray(research.verifiedSignals) && research.verifiedSignals.length > 0 && <ResearchList title="Verified signals" items={research.verifiedSignals.map((item) => { const value = item as Record<string, unknown>; return `${String(value.reasoning ?? value.excerpt ?? '')} · ${String(value.url ?? '')}`; })} />}</div></SectionCard><SectionCard title="Conversation" description="Canonical inbound and outbound messages.">{liveConversation.length ? <LiveConversationPanel messages={liveConversation} /> : <p className="p-5 text-sm text-slate-500">No messages recorded.</p>}</SectionCard><LiveFollowUpPlan leadId={id} /></div><div className="space-y-6"><SectionCard title="Fit score" description="Qualification is persisted separately from outreach approval."><div className="p-5"><div className="flex items-end justify-between"><div><p className="text-5xl font-semibold tracking-tight text-slate-950">{lead.score}</p><p className="mt-1 text-xs text-slate-500">out of 100</p></div><ScoreBadge score={lead.score} /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${lead.score}%` }} /></div></div></SectionCard>{drafts?.map((draft) => <SectionCard key={draft.id} title={`Outreach draft v${draft.version}`} description={`${draft.status} · ${draft.confidence ?? 0} confidence`}><div className="p-5"><p className="font-semibold text-slate-900">{draft.subject}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{draft.body}</p><OutreachReviewActions draftId={String(draft.id)} subject={String(draft.subject)} body={String(draft.body)} />{draft.status === 'approved' && <PrepareDeliveryButton draftId={String(draft.id)} />}</div></SectionCard>)}{deliveries?.map((delivery) => <SectionCard key={delivery.id} title="Delivery" description={String(delivery.status)}><div className="p-5"><p className="text-sm font-semibold">{delivery.subject}</p>{delivery.status === 'prepared' && <MarkSentButton deliveryId={String(delivery.id)} />}</div></SectionCard>)}<LiveProposalSummary leadId={id}/><LiveDealSummary leadId={id}/></div></div>
    </div>
  </PageShell>;
}
function ResearchList({ title, items }: Readonly<{ title: string; items: readonly string[] }>) { return <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">{title}</p><ul className="mt-2 space-y-2">{items.map((item) => <li className="text-sm leading-6 text-slate-600" key={item}>{item}</li>)}</ul></div>; }

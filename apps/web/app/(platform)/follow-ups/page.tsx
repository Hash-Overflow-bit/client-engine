import type { Metadata } from 'next';
import Link from 'next/link';
import { SupabaseFollowUpStore } from '@client-engine/database';
import { SupabaseFollowUpDraftStore } from '@client-engine/database';
import type { FollowUpTask } from '@client-engine/follow-ups';
import { PageShell } from '../../../components/page-shell';
import { FollowUpActions, ProcessDueQueueButton } from '../../../components/follow-up-actions';
import { createOptionalClient } from '../../../lib/supabase/server';
import { FollowUpDraftActions } from '../../../components/follow-up-draft-actions';
import { FollowUpDeliveryActions } from '../../../components/follow-up-delivery-actions';

export const metadata: Metadata = { title: 'Follow-ups' };
export const dynamic = 'force-dynamic';

export default async function FollowUpsPage() {
  const supabase = await createOptionalClient();
  if (!supabase) return <PageShell title="Follow-ups" description="Configure Supabase to review scheduled follow-up opportunities." />;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <PageShell title="Follow-ups" description="Sign in to review scheduled follow-up opportunities." />;
  const { data: membership } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!membership?.workspace_id) return <PageShell title="Follow-ups" description="No authorized workspace." />;
  const workspaceId = String(membership.workspace_id);
  const tasks = await new SupabaseFollowUpStore(supabase).list(workspaceId);
  const draftStore = new SupabaseFollowUpDraftStore(supabase);
  const draftLists = await Promise.all(tasks.map((task) => draftStore.listByTask(workspaceId, task.id)));
  const draftsByTask = new Map(tasks.map((task, index) => [task.id, draftLists[index] ?? []]));
  const leadIds = [...new Set(tasks.map((task) => task.leadId))];
  const deliveryIds = [...new Set(tasks.map((task) => task.deliveryId))];
  const conversationIds = [...new Set(tasks.map((task) => task.conversationId))];
  const taskIds = [...new Set(tasks.map((task) => task.id))];
  const [{ data: leads }, { data: deliveries }, { data: conversations }] = await Promise.all([
    leadIds.length ? supabase.from('leads').select('id,name,company_id,stage').eq('workspace_id', workspaceId).in('id', leadIds) : Promise.resolve({ data: [] }),
    deliveryIds.length ? supabase.from('delivery_records').select('id,subject,recipient,status').eq('workspace_id', workspaceId).in('id', deliveryIds) : Promise.resolve({ data: [] }),
    conversationIds.length ? supabase.from('conversations').select('id,status').eq('workspace_id', workspaceId).in('id', conversationIds) : Promise.resolve({ data: [] }),
  ]);
  const companyIds = [...new Set((leads ?? []).map((lead) => lead.company_id).filter(Boolean))];
  const { data: companies } = companyIds.length ? await supabase.from('companies').select('id,name').eq('workspace_id', workspaceId).in('id', companyIds) : { data: [] };
  const { data: followUpDeliveries } = taskIds.length ? await supabase.from('delivery_records').select('id,follow_up_task_id,follow_up_draft_id,status,sent_at').eq('workspace_id', workspaceId).in('follow_up_task_id', taskIds) : { data: [] };
  const enrich = (task: (typeof tasks)[number]): FollowUpRow => ({ task, drafts: draftsByTask.get(task.id) ?? [], followUpDelivery: (followUpDeliveries ?? []).find((item) => item.follow_up_task_id === task.id), lead: (leads ?? []).find((item) => item.id === task.leadId), company: (companies ?? []).find((item) => item.id === (leads ?? []).find((lead) => lead.id === task.leadId)?.company_id), delivery: (deliveries ?? []).find((item) => item.id === task.deliveryId), conversation: (conversations ?? []).find((item) => item.id === task.conversationId), dueCandidate: task.status === 'due' });
  const rows = tasks.map(enrich);
  const due = rows.filter((row) => row.dueCandidate && !['cancelled', 'skipped', 'completed'].includes(row.task.status));
  const upcoming = rows.filter((row) => row.task.status === 'scheduled' && !row.dueCandidate);
  const history = rows.filter((row) => ['cancelled', 'skipped', 'completed'].includes(row.task.status));
  return <PageShell title="Follow-ups" description="Bounded follow-up opportunities. Eligibility is re-checked before a task becomes due; this screen never sends or generates copy.">
    <div className="flex flex-wrap items-end justify-between gap-4"><div className="grid flex-1 gap-4 md:grid-cols-3"><Stat label="Due" value={due.length} /><Stat label="Upcoming" value={upcoming.length} /><Stat label="Blocked / history" value={history.length} /></div><ProcessDueQueueButton /></div>
    <FollowUpSection title="Due" description="A due timestamp is not send permission. Check eligibility before any later delivery milestone." rows={due} empty="No due follow-ups." />
    <FollowUpSection title="Upcoming" description="Scheduled opportunities created from an explicitly marked sent delivery." rows={upcoming} empty="No upcoming follow-ups." />
    <FollowUpSection title="Cancelled / skipped" description="Historical records remain visible for auditability." rows={history} empty="No follow-up history." />
  </PageShell>;
}

type FollowUpRow = Readonly<{ task: FollowUpTask; drafts: readonly { id: string; version: number; status: string; subject: string; body: string; confidence: number; warnings: readonly string[]; evidenceRefs: readonly { sourceUrl: string; claim: string }[]; serviceMatch: string | null; portfolioMatch: string | null }[]; followUpDelivery?: { id:string; follow_up_task_id:string; follow_up_draft_id:string; status:string; sent_at:string|null }; lead?: { id: string; name: string; company_id: string | null; stage: string }; company?: { id: string; name: string }; delivery?: { id: string; subject: string; recipient: string; status: string }; conversation?: { id: string; status: string }; dueCandidate: boolean }>;

function FollowUpSection({ title, description, rows, empty }: Readonly<{ title: string; description: string; rows: readonly FollowUpRow[]; empty: string }>) {
  return <section className="mt-8"><div className="mb-3"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>{rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">{empty}</div> : <div className="space-y-3">{rows.map((row) => <FollowUpCard key={row.task.id} row={row} />)}</div>}</section>;
}

function FollowUpCard({ row }: Readonly<{ row: FollowUpRow }>) {
  const { task, drafts, followUpDelivery, lead, company, delivery, conversation, dueCandidate } = row;
  const draft = drafts[0];
  const status = dueCandidate && task.status === 'scheduled' ? 'due_pending_check' : task.status;
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {task.sequenceStep} · {task.purpose.replaceAll('_', ' ')}</p><h3 className="mt-1 text-base font-semibold text-slate-950">{lead?.name ?? 'Unknown lead'}{company?.name ? ` · ${company.name}` : ''}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'due' || status === 'due_pending_check' ? 'bg-amber-100 text-amber-800' : status === 'scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>{status.replaceAll('_', ' ')}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-wide text-slate-400">Due</dt><dd className="mt-1 text-slate-700">{new Date(task.dueAt).toLocaleString()}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-400">Conversation</dt><dd className="mt-1 text-slate-700">{conversation?.status ?? 'Unknown'}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-400">Original outreach</dt><dd className="mt-1 text-slate-700">{delivery?.subject ?? 'Unknown delivery'} · {delivery?.status ?? 'Unknown'}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-400">Eligibility</dt><dd className="mt-1 text-slate-700">{task.cancellationReason ? task.cancellationReason.replaceAll('_', ' ') : status === 'due' ? 'Re-check passed' : status === 'due_pending_check' ? 'Pending re-check' : status === 'scheduled' ? 'Checked before due' : 'Historical'}</dd></div></dl>{draft && <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up draft v{draft.version} · {draft.status}</p><p className="mt-2 text-sm font-semibold text-slate-900">{draft.subject}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{draft.body}</p><p className="mt-2 text-xs text-slate-500">Confidence {Math.round(draft.confidence * 100)}%{draft.serviceMatch ? ` · ${draft.serviceMatch}` : ''}</p>{draft.evidenceRefs.map((ref) => <p key={ref.sourceUrl} className="mt-1 text-xs text-slate-500">Evidence: <a className="underline" href={ref.sourceUrl} target="_blank" rel="noreferrer">{ref.sourceUrl}</a></p>)}{draft.warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">Warnings: {draft.warnings.join(' ')}</p>}</div>}{followUpDelivery && <p className="mt-3 text-xs font-semibold text-slate-700">Delivery: {followUpDelivery.status}{followUpDelivery.sent_at ? ` · ${new Date(followUpDelivery.sent_at).toLocaleString()}` : ''}</p>}{task.cancellationReason && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Reason: {task.cancellationReason.replaceAll('_', ' ')}</p>}{lead?.id && <Link href={`/leads/${String(lead.id)}`} className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:underline">Open lead</Link>}{!['cancelled', 'skipped', 'completed'].includes(task.status) && <FollowUpActions taskId={String(task.id)} conversationId={String(task.conversationId)} status={task.status} dueAt={String(task.dueAt)} />}{task.status === 'due' && <><FollowUpDraftActions taskId={task.id} draftId={draft?.id} status={draft?.status} />{draft?.status==='approved'&&<FollowUpDeliveryActions draftId={draft.id} deliveryId={followUpDelivery?.id} status={followUpDelivery?.status} />}</>}</article>;
}

function Stat({ label, value }: Readonly<{ label: string; value: number }>) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p></div>; }

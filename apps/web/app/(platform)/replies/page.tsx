import type { Metadata } from 'next';
import Link from 'next/link';
import { getEffectiveReplyIntent, replyIntentSchema, type ReplyIntent } from '@client-engine/reply-classification';
import { PageShell } from '../../../components/page-shell';
import { ReplyClassificationActions } from '../../../components/reply-classification-actions';
import { createOptionalClient } from '../../../lib/supabase/server';
import { PrepareMeetingButton } from '../../../components/prepare-meeting-button';

export const metadata: Metadata = { title: 'Reply review' };
export const dynamic = 'force-dynamic';

type Props = { searchParams?: Promise<{ intent?: string; filter?: string }> };

export default async function RepliesPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedFilter = params?.filter === 'needs_review' ? 'needs_review' : replyIntentSchema.safeParse(params?.intent).success ? params?.intent : 'all';
  const supabase = await createOptionalClient();
  if (!supabase) return <PageShell title="Reply review" description="Configure Supabase to review persisted replies." />;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <PageShell title="Reply review" description="Sign in to review replies." />;
  const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!member?.workspace_id) return <PageShell title="Reply review" description="No authorized workspace." />;
  const { data: messages } = await supabase.from('messages').select('id,conversation_id,lead_id,body,subject,received_at').eq('workspace_id', member.workspace_id).eq('direction', 'inbound').order('received_at', { ascending: false }).limit(100);
  const ids = (messages ?? []).map((m) => m.id);
  const { data: classifications } = ids.length ? await supabase.from('reply_classifications').select('*').in('message_id', ids).order('created_at', { ascending: false }) : { data: [] };
  const classificationIds = (classifications ?? []).map((item) => item.id);
  const { data: overrides } = classificationIds.length ? await supabase.from('reply_classification_overrides').select('*').in('classification_id', classificationIds).order('created_at', { ascending: false }) : { data: [] };
  const { data: reviews } = classificationIds.length ? await supabase.from('reply_classification_reviews').select('*').in('classification_id', classificationIds).order('created_at', { ascending: false }) : { data: [] };
  const rows = (messages ?? []).map((item) => {
    const classification = (classifications ?? []).find((entry) => entry.message_id === item.id);
    const override = classification ? (overrides ?? []).find((entry) => entry.classification_id === classification.id) : undefined;
    const review = classification ? (reviews ?? []).find((entry) => entry.classification_id === classification.id) : undefined;
    const effectiveIntent = classification ? getEffectiveReplyIntent({ humanOverride: override?.selected_intent as ReplyIntent | null | undefined, confirmedAi: review?.status === 'confirmed' ? classification.intent as ReplyIntent : null, unresolvedAi: classification.intent as ReplyIntent | null }) : null;
    const needsReview = Boolean(classification?.needs_review || review?.status === 'needs_review');
    return { item, classification, override, review, effectiveIntent, needsReview };
  }).filter((row) => selectedFilter === 'all' || (selectedFilter === 'needs_review' ? row.needsReview : row.effectiveIntent === selectedFilter));
  return <PageShell title="Reply review" description="Classification is review-only and never sends a response.">
    <div className="mb-5 flex flex-wrap gap-2">
      <FilterLink href="/replies" active={selectedFilter === 'all'}>All</FilterLink>
      <FilterLink href="/replies?filter=needs_review" active={selectedFilter === 'needs_review'}>Needs Review</FilterLink>
      {replyIntentSchema.options.map((intent) => <FilterLink key={intent} href={`/replies?intent=${intent}`} active={selectedFilter === intent}>{intent}</FilterLink>)}
    </div>
    <div className="space-y-4">
      {rows.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No replies match this filter.</div>}
      {rows.map(({ item, classification, override, effectiveIntent, needsReview }) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-slate-500">Inbound · {item.received_at ? new Date(item.received_at).toLocaleString() : 'Unknown time'}</p><h2 className="mt-1 text-sm font-semibold text-slate-900">{item.subject || 'No subject'}</h2></div><Link href={`/leads/${String(item.lead_id)}`} className="text-xs font-semibold text-blue-700 hover:underline">Open lead</Link></div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.body}</p>
        {classification && <div className="mt-4 rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span>AI: {classification.intent ?? 'UNRESOLVED'}</span><span>Effective: {effectiveIntent ?? 'UNRESOLVED'}</span>{classification.confidence !== null && <span>{Math.round(Number(classification.confidence) * 100)}%</span>}{needsReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Needs review</span>}{override && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">Human override</span>}</div><p className="mt-1 text-sm">{classification.summary ?? 'Needs human review'}</p><p className="mt-1 text-xs text-slate-500">Recommended: {classification.recommended_action ?? 'MANUAL_REVIEW'} · Status: {override ? 'overridden' : needsReview ? 'needs_review' : 'unresolved'}</p></div>}
        <ReplyClassificationActions messageId={String(item.id)} classificationId={classification?.id ? String(classification.id) : undefined} currentIntent={classification?.intent as ReplyIntent | null | undefined} effectiveIntent={effectiveIntent} needsReview={needsReview} />{effectiveIntent==='POSITIVE'&&item.conversation_id&&<PrepareMeetingButton leadId={String(item.lead_id)} conversationId={String(item.conversation_id)} />}
      </article>)}
    </div>
  </PageShell>;
}

function FilterLink({ href, active, children }: Readonly<{ href: string; active: boolean; children: React.ReactNode }>) { return <Link href={href} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{children}</Link>; }

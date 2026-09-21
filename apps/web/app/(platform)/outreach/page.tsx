import type { Metadata } from 'next';
import { PageShell } from '../../../components/page-shell';
import { createOptionalClient } from '../../../lib/supabase/server';
import { SupabaseOutreachDraftStore } from '@client-engine/database';
import { OutreachReviewActions, PrepareDeliveryButton } from '../../../components/outreach-review-actions';
export const metadata: Metadata = { title: 'Outreach review' };
export const dynamic = 'force-dynamic';
export default async function OutreachPage() {
  const supabase = await createOptionalClient();
  if (!supabase) return <PageShell title="Outreach review" description="Configure Supabase to review persisted drafts." />;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <PageShell title="Outreach review" description="Sign in to review drafts." />;
  const { data: membership } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  const drafts = membership?.workspace_id ? await new SupabaseOutreachDraftStore(supabase).listReady(String(membership.workspace_id)) : [];
  return <PageShell title="Outreach review" description="Human review queue for evidence-grounded drafts. Approval changes state only; it never sends."><div className="space-y-4">{drafts.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">No drafts are ready for review.</p></div> : drafts.map((draft) => <article key={draft.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version {draft.version} · {draft.status}</p><span className="text-xs text-slate-500">{Math.round(draft.confidence * 100)}% confidence</span></div><h2 className="mt-2 text-lg font-semibold">{draft.subject}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{draft.body}</p><p className="mt-3 text-xs text-slate-500">{draft.personalizationSourceType} · {draft.personalizationSourceUrl ?? 'No source URL'} · {draft.serviceMatch ?? 'No service match'}</p><OutreachReviewActions draftId={draft.id} subject={draft.subject} body={draft.body} />{draft.status === 'approved' && <PrepareDeliveryButton draftId={draft.id} />}</article>)}</div></PageShell>;
}

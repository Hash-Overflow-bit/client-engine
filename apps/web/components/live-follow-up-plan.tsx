import { SupabaseFollowUpDraftStore, SupabaseFollowUpStore } from '@client-engine/database';
import { FollowUpDraftActions } from './follow-up-draft-actions';
import { SectionCard } from './crm-components';
import { createClient } from '../lib/supabase/server';

export async function LiveFollowUpPlan({ leadId }: Readonly<{ leadId: string }>) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return <SectionCard title="Follow-up plan" description="Persisted follow-up opportunities appear after a delivery is explicitly marked sent."><div className="p-5 text-sm text-slate-500">No persisted follow-up schedule is available in the demo workspace.</div></SectionCard>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!member?.workspace_id) return null;
  const tasks = await new SupabaseFollowUpStore(supabase).list(String(member.workspace_id), leadId);
  const drafts = await Promise.all(tasks.map((task) => new SupabaseFollowUpDraftStore(supabase).listByTask(String(member.workspace_id), task.id)));
  return <SectionCard title="Follow-up plan" description="Scheduling creates opportunities only; no follow-up is generated or sent here."><div className="space-y-3 p-5">{tasks.length === 0 ? <p className="text-sm text-slate-500">No follow-ups scheduled.</p> : tasks.map((task, index) => { const draft = drafts[index]?.[0]; return <div key={task.id} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-800">Step {task.sequenceStep} · {task.purpose.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-slate-500">Due {new Date(task.dueAt).toLocaleString()}</p></div><div className="text-right"><p className="text-xs font-semibold text-slate-700">{task.status.replaceAll('_', ' ')}</p>{task.cancellationReason && <p className="mt-1 text-[11px] text-slate-500">{task.cancellationReason.replaceAll('_', ' ')}</p>}</div></div>{draft && <div className="mt-3 border-t border-slate-100 pt-3"><p className="text-xs font-semibold">Draft v{draft.version} · {draft.status}</p><p className="mt-1 text-sm">{draft.subject}</p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{draft.body}</p></div>}{task.status === 'due' && <FollowUpDraftActions taskId={task.id} draftId={draft?.id} status={draft?.status} />}</div>; })}<Link href="/follow-ups" className="inline-block pt-1 text-xs font-semibold text-blue-700 hover:underline">Open follow-up queue</Link></div></SectionCard>;
}
import Link from 'next/link';

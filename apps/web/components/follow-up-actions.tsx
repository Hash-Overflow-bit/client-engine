'use client';

import { useState, useTransition } from 'react';
import { cancelFollowUpAction, cancelRemainingFollowUpsAction, processDueFollowUpAction, processDueFollowUpsAction, rescheduleFollowUpAction, skipFollowUpAction } from '../app/actions/follow-ups';

export function ProcessDueQueueButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  return <div><button disabled={pending} type="button" onClick={() => startTransition(async () => { const result = await processDueFollowUpsAction(); setMessage(result.ok ? 'Due tasks checked' : result.error ?? 'Unable to check due tasks'); })} className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Check due tasks</button>{message && <p role="status" className="mt-2 text-xs text-slate-500">{message}</p>}</div>;
}

export function FollowUpActions({ taskId, conversationId, status, dueAt }: Readonly<{ taskId: string; conversationId: string; status: string; dueAt: string }>) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [nextDue, setNextDue] = useState(new Date(dueAt).toISOString().slice(0, 16));
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => startTransition(async () => { const result = await action(); setMessage(result.ok ? success : result.error ?? 'Unable to update follow-up'); });
  if (['cancelled', 'skipped', 'completed'].includes(status)) return null;
  const reschedule = () => { const parsed = new Date(nextDue); if (Number.isNaN(parsed.getTime())) { setMessage('Choose a valid time'); return; } run(() => rescheduleFollowUpAction(taskId, parsed.toISOString()), 'Rescheduled'); };
  return <div className="mt-3 flex flex-wrap items-center gap-2">
    {status === 'scheduled' && <button disabled={pending} type="button" onClick={() => run(() => processDueFollowUpAction(taskId), 'Eligibility checked')} className="rounded-md border border-slate-300 px-3 py-2 text-xs disabled:opacity-50">Check eligibility</button>}
    <button disabled={pending} type="button" onClick={() => run(() => skipFollowUpAction(taskId), 'Skipped')} className="rounded-md border border-amber-300 px-3 py-2 text-xs text-amber-800 disabled:opacity-50">Skip</button>
    <button disabled={pending} type="button" onClick={() => run(() => cancelFollowUpAction(taskId), 'Cancelled')} className="rounded-md border border-slate-300 px-3 py-2 text-xs disabled:opacity-50">Cancel</button>
    <button disabled={pending} type="button" onClick={() => run(() => cancelRemainingFollowUpsAction(conversationId), 'Remaining follow-ups cancelled')} className="rounded-md border border-slate-300 px-3 py-2 text-xs disabled:opacity-50">Cancel remaining</button>
    <label className="flex items-center gap-2 text-xs text-slate-500"><span>Reschedule</span><input disabled={pending} type="datetime-local" value={nextDue} onChange={(event) => setNextDue(event.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" /><button disabled={pending} type="button" onClick={reschedule} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:opacity-50">Save</button></label>
    {message && <span role="status" className="text-xs text-slate-500">{message}</span>}
  </div>;
}

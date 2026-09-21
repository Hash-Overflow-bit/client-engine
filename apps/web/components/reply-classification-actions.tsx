'use client';

import { useState, useTransition } from 'react';
import { replyIntentSchema, type ReplyIntent } from '@client-engine/reply-classification';
import { classifyReplyAction, markReplyNeedsReviewAction, overrideReplyClassification } from '../app/actions/replies';

type Props = Readonly<{ messageId: string; classificationId?: string; currentIntent?: ReplyIntent | null; effectiveIntent?: ReplyIntent | null; needsReview?: boolean }>;

export function ReplyClassificationActions({ messageId, classificationId, currentIntent, effectiveIntent, needsReview }: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ReplyIntent>(effectiveIntent ?? currentIntent ?? 'OTHER');
  const [message, setMessage] = useState('');
  const intents = replyIntentSchema.options;
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => startTransition(async () => { const result = await action(); setMessage(result.ok ? success : result.error ?? 'Unable to save review'); });
  return <div className="mt-4 space-y-3" aria-busy={pending}>
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pending} type="button" onClick={() => run(() => classifyReplyAction(messageId), 'Classification saved')} className="rounded-md bg-slate-950 px-3 py-2 text-xs text-white">{classificationId ? 'Reclassify' : 'Classify'}</button>
      {classificationId && currentIntent && <button disabled={pending} type="button" onClick={() => run(() => overrideReplyClassification(classificationId, currentIntent, 'confirmed_ai'), 'AI classification confirmed')} className="rounded-md border border-slate-300 px-3 py-2 text-xs">Confirm AI Classification</button>}
      {classificationId && <button disabled={pending} type="button" onClick={() => run(() => overrideReplyClassification(classificationId, selected, 'human_override'), 'Classification changed')} className="rounded-md border border-slate-300 px-3 py-2 text-xs">Change Classification</button>}
      {classificationId && <button disabled={pending} type="button" onClick={() => run(() => markReplyNeedsReviewAction(classificationId), 'Marked needs review')} className="rounded-md border border-amber-300 px-3 py-2 text-xs text-amber-800">{needsReview ? 'Needs Review' : 'Mark Needs Review'}</button>}
    </div>
    {classificationId && <label className="flex max-w-xs items-center gap-2 text-xs text-slate-500"><span className="font-medium text-slate-700">Intent</span><select disabled={pending} value={selected} onChange={(event) => setSelected(event.target.value as ReplyIntent)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs">{intents.map((intent) => <option key={intent} value={intent}>{intent}</option>)}</select></label>}
    {effectiveIntent && <p className="text-xs text-slate-500">Effective intent: <span className="font-semibold text-slate-700">{effectiveIntent}</span></p>}
    {message && <span role="status" className="block text-xs text-slate-500">{message}</span>}
  </div>;
}

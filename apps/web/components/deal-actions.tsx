'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDealAction, markDealLostAction, markDealWonAction } from '../app/actions/deals';

export function DealActions({ proposalId, deal }: Readonly<{ proposalId?: string; deal?: { id: string; status: string; value: number | string | null; currency: string | null } }>) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<{ ok: boolean; error?: string }>) { setBusy(true); setError(null); const outcome = await action(); setBusy(false); if (!outcome.ok) setError(outcome.error ?? 'Action failed'); else router.refresh(); }
  async function won() { if (!deal) return; const amount = window.prompt('Final agreed value', deal.value === null ? '' : String(deal.value)); const currency = window.prompt('Currency (ISO code)', deal.currency ?? 'USD'); if (amount === null || currency === null) return; await run(() => markDealWonAction({ dealId: deal.id, value: Number(amount), currency: currency.trim().toUpperCase() })); }
  async function lost() { if (!deal) return; const reason = window.prompt('Loss reason: BUDGET, NO_RESPONSE, TIMING, COMPETITOR, SCOPE_MISMATCH, NO_DECISION, CLIENT_PAUSED, TECHNICAL_MISMATCH, OTHER', 'BUDGET'); if (!reason) return; const notes = window.prompt('Optional loss notes') ?? undefined; await run(() => markDealLostAction({ dealId: deal.id, reason: reason.trim().toUpperCase(), notes })); }
  return <div className="mt-3 flex flex-wrap gap-2">{proposalId && !deal && <button disabled={busy} onClick={() => void run(() => createDealAction(proposalId))} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Create Deal</button>}{deal?.status === 'open' && <><button disabled={busy} onClick={() => void won()} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Mark Won</button><button disabled={busy} onClick={() => void lost()} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Mark Lost</button></>}{error && <p className="basis-full text-xs text-red-700">{error}</p>}</div>;
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveProposalAction, editProposalAction, generateProposalAction, rejectProposalAction } from '../app/actions/proposals';

type Proposal = Readonly<Record<string, unknown>>;
export function ProposalReviewActions({ proposal }: Readonly<{ proposal: Proposal }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = String(proposal.status);
  const reviewable = status === 'draft' || status === 'ready_for_review';
  async function run(action: () => Promise<{ ok: boolean; error?: string }>) { setBusy(true); setError(null); const result = await action(); setBusy(false); if (!result.ok) setError(result.error ?? 'Action failed'); else router.refresh(); }
  async function edit() {
    const editable = { title: proposal.title, executiveSummary: proposal.executive_summary, problemStatement: proposal.problem_statement, proposedSolution: proposal.proposed_solution, scope: proposal.scope, deliverables: proposal.deliverables, exclusions: proposal.exclusions, assumptions: proposal.assumptions, timeline: proposal.timeline, milestones: proposal.milestones, pricing: proposal.pricing, clientResponsibilities: proposal.client_responsibilities, acceptanceCriteria: proposal.acceptance_criteria, unknowns: proposal.unknowns, nextStep: proposal.next_step };
    const raw = window.prompt('Edit proposal content as JSON. Pricing must use the documented controlled fields.', JSON.stringify(editable, null, 2));
    if (!raw) return;
    try { const patch = JSON.parse(raw) as Record<string, unknown>; await run(() => editProposalAction({ proposalId: proposal.id, ...patch })); } catch { setError('Enter valid JSON with only proposal content fields.'); }
  }
  return <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void run(() => generateProposalAction(String(proposal.meeting_id), true))} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Regenerate</button>{reviewable && <><button disabled={busy} onClick={() => void edit()} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Edit</button>{status === 'ready_for_review' && <><button disabled={busy} onClick={() => void run(() => approveProposalAction(String(proposal.id)))} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button><button disabled={busy} onClick={() => { const reason = window.prompt('Optional rejection reason') ?? undefined; void run(() => rejectProposalAction(String(proposal.id), reason)); }} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Reject</button></>}</>}{error && <p className="basis-full text-xs text-red-700">{error}</p>}</div>;
}

export const proposalStatuses = ['draft', 'ready_for_review', 'approved', 'rejected'] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];

const transitions: Readonly<Record<ProposalStatus, readonly ProposalStatus[]>> = {
  draft: ['ready_for_review'],
  ready_for_review: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus): boolean {
  return transitions[from].includes(to);
}

export function requireProposalTransition(from: ProposalStatus, to: ProposalStatus): void {
  if (!canTransitionProposal(from, to)) throw new Error(`Proposal cannot transition from ${from} to ${to}`);
}

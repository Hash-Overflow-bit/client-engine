import type { Evidence, Lead, ReplyIntent } from '@client-engine/shared';
export interface Qualification { score: number; reasons: string[]; evidence: Evidence[]; needsReview: boolean }
export interface OutreachDraft { subject: string; body: string; evidence: Evidence[] }
export interface AcquisitionAI {
  qualify(lead: Lead, evidence: Evidence[]): Promise<Qualification>;
  draft(lead: Lead, evidence: Evidence[]): Promise<OutreachDraft>;
  classifyReply(text: string): Promise<{ intent: ReplyIntent; confidence: number }>;
}

export * from './qualification/index';
export * from './research/index';
export * from './research/fetcher';
export * from './research/agent';
export * from './outreach';
export * from './follow-up';
export * from './meeting-brief';
export * from './proposal';

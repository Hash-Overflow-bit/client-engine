export const funnelStages = [
  'Discovered', 'Enriched', 'Qualified', 'Researched', 'Drafted',
  'Approved', 'In sequence', 'Replied', 'Interested', 'Booked',
  'Meeting brief ready', 'Proposal sent', 'Won'
] as const;
export type LeadStage = typeof funnelStages[number];
export type ReplyIntent = 'interested' | 'question' | 'not_now' | 'not_interested' | 'unsubscribe' | 'out_of_office' | 'unknown';
export interface Evidence { url: string; excerpt: string; retrievedAt: string }
export interface Lead { id: string; workspaceId: string; companyName: string; domain: string; email: string | null; stage: LeadStage }
export interface JobEnvelope<T> { id: string; workspaceId: string; idempotencyKey: string; attempt: number; payload: T }

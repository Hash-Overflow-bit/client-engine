import type { EnrichedProspect, Prospect } from '@client-engine/integrations';
import type { Lead } from '@client-engine/shared';

export interface LeadRepository {
  findById(workspaceId: string, leadId: string): Promise<Lead | null>;
  upsert(workspaceId: string, lead: Lead): Promise<Lead>;
}

export type ProspectIdentity = Readonly<{
  source: string;
  sourceExternalId: string;
  email: string | null;
  companyDomain: string | null;
  name: string;
}>;

export type CompanyUpsert = Readonly<{
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  linkedinUrl: string | null;
}>;

export type LeadUpsert = Readonly<{
  companyId: string;
  name: string;
  email: string | null;
  role: string | null;
  linkedinUrl: string | null;
  source: string;
  sourceExternalId: string;
}>;

export type DiscoveryActivity = Readonly<{
  leadId: string;
  companyId: string;
  effectKey: string;
  details: Readonly<Record<string, unknown>>;
}>;

/**
 * The ingestion service depends on this narrow port rather than Supabase
 * primitives. The concrete implementation must use a trusted server client
 * and scope every operation to workspaceId.
 */
export interface ProspectStore {
  countDiscoveries(workspaceId: string, day: string): Promise<number>;
  /** Must be implemented as an atomic workspace-scoped DB transaction. */
  tryReserveDiscoverySlot(workspaceId: string, day: string, limit: number): Promise<boolean>;
  findExistingProspect(workspaceId: string, identity: ProspectIdentity): Promise<{ leadId: string; companyId: string } | null>;
  upsertCompany(workspaceId: string, company: CompanyUpsert): Promise<{ id: string }>;
  upsertLead(workspaceId: string, lead: LeadUpsert): Promise<{ id: string; created: boolean }>;
  recordLeadDiscovered(workspaceId: string, activity: DiscoveryActivity): Promise<void>;
}

export function prospectIdentity(prospect: Prospect | EnrichedProspect): ProspectIdentity {
  return {
    source: prospect.source ?? prospect.provider,
    sourceExternalId: prospect.sourceExternalId,
    email: 'email' in prospect ? prospect.email?.trim().toLowerCase() ?? null : null,
    companyDomain: 'company' in prospect ? prospect.company.domain?.trim().toLowerCase() ?? null : prospect.domain?.trim().toLowerCase() ?? null,
    name: prospect.name.trim().toLowerCase(),
  };
}

export type AIRunRecord = Readonly<{ operation: 'qualification' | 'company_research' | 'outreach_generation' | 'follow_up_generation'; operationKey: string; leadId?: string; companyId?: string; conversationId?: string; followUpTaskId?: string; sequenceStep?: number; purpose?: 'VALUE_FOLLOW_UP'|'SECOND_TOUCH'|'CLOSE_LOOP'; provider: string; model: string; promptVersion: string; input: Readonly<Record<string, unknown>>; output: Readonly<Record<string, unknown>> | null; confidence: number | null; status: 'succeeded' | 'failed' | 'invalid'; error?: string | null; durationMs?: number | null }>;
export interface AIRunStore { record(workspaceId: string, run: AIRunRecord): Promise<void>; }

export type OutreachDraftStatus = 'draft' | 'ready_for_review' | 'approved' | 'rejected';
export type OutreachDraftRecord = Readonly<{ id: string; workspaceId: string; leadId: string; companyId: string; campaignId: string | null; researchVersion: string; version: number; subject: string; body: string; personalizationSourceType: 'verified_signal' | 'personalization_angle' | 'none'; personalizationSourceUrl: string | null; serviceMatch: string | null; portfolioMatch: string | null; confidence: number; warnings: readonly string[]; provider: string; model: string; promptVersion: string; status: OutreachDraftStatus; rejectionReason?: string | null; approvedAt?: string | null; createdAt: string; updatedAt: string }>;
export type OutreachDraftCreate = Omit<OutreachDraftRecord, 'id' | 'createdAt' | 'updatedAt'>;
export interface OutreachDraftStore {
  findByGenerationKey(workspaceId: string, key: string): Promise<OutreachDraftRecord | null>;
  listByLead(workspaceId: string, leadId: string): Promise<readonly OutreachDraftRecord[]>;
  listReady(workspaceId: string): Promise<readonly OutreachDraftRecord[]>;
  create(workspaceId: string, key: string, draft: OutreachDraftCreate): Promise<OutreachDraftRecord>;
  updateStatus(workspaceId: string, id: string, status: OutreachDraftStatus, reason?: string, actorUserId?: string): Promise<void>;
  edit(workspaceId: string, id: string, subject: string, body: string, actorUserId?: string): Promise<OutreachDraftRecord>;
  recordActivity(workspaceId: string, activity: OutreachActivity): Promise<void>;
}
export type OutreachActivity = Readonly<{ draftId: string; leadId: string; companyId: string; activityType: 'outreach_generated'|'outreach_generation_failed'|'outreach_edited'|'outreach_approved'|'outreach_rejected'|'outreach_regenerated'; effectKey: string; details: Readonly<Record<string, unknown>>; actorUserId?: string }>;
export const OUTREACH_TRANSITIONS: Readonly<Record<OutreachDraftStatus, readonly OutreachDraftStatus[]>> = { draft: ['ready_for_review', 'rejected'], ready_for_review: ['approved', 'rejected'], approved: [], rejected: [] };
export function assertOutreachTransition(from: OutreachDraftStatus, to: OutreachDraftStatus): void { if (from === to) return; if (!OUTREACH_TRANSITIONS[from].includes(to)) throw new Error(`Invalid outreach draft transition: ${from} -> ${to}`); }

export { APOLLO_DAILY_PROSPECT_LIMIT, CONTROLLED_LIVE_TEST_PROSPECT_LIMIT, resolveDiscoveryDailyLimit, runDiscovery, type DiscoveryRunOptions, type DiscoveryRunResult } from './discovery-ingestion';
export { SupabaseProspectStore } from './supabase-prospect-store';
export { SupabaseAIRunStore } from './supabase-ai-run-store';
export { SupabaseCompanyResearchStore } from './supabase-company-research-store';
export { SupabaseOutreachDraftStore } from './supabase-outreach-draft-store';
export { SupabaseDeliveryStore } from './supabase-delivery-store';
export { SupabaseConversationStore } from './supabase-conversation-store';
export { SupabaseReplyClassificationStore } from './supabase-reply-classification-store';
export { SupabaseFollowUpStore } from './supabase-follow-up-store';
export type FollowUpDraftStatus = 'draft'|'ready_for_review'|'approved'|'rejected';
export type FollowUpDraftRecord = Readonly<{id:string;workspaceId:string;followUpTaskId:string;leadId:string;companyId:string|null;conversationId:string;originalDeliveryId:string;sequenceStep:number;purpose:'VALUE_FOLLOW_UP'|'SECOND_TOUCH'|'CLOSE_LOOP';generationKey:string;contextVersion:string;version:number;subject:string;body:string;status:FollowUpDraftStatus;confidence:number;needsReview:boolean;warnings:readonly string[];evidenceRefs:readonly {type:'verified_signal'|'personalization_angle';sourceUrl:string;claim:string}[];conversationRefs:readonly string[];serviceMatch:string|null;portfolioMatch:string|null;provider:string;model:string;promptVersion:string;approvedAt:string|null;approvedBy:string|null;rejectedAt:string|null;rejectionReason:string|null;createdAt:string;updatedAt:string}>;
export type FollowUpDraftCreate = Omit<FollowUpDraftRecord,'id'|'createdAt'|'updatedAt'|'approvedAt'|'approvedBy'|'rejectedAt'|'rejectionReason'>;
export type FollowUpDraftActivity = Readonly<{draftId?:string;leadId:string;companyId:string|null;activityType:'follow_up_draft_generated'|'follow_up_generation_failed'|'follow_up_edited'|'follow_up_approved'|'follow_up_rejected'|'follow_up_regenerated';effectKey:string;details:Readonly<Record<string,unknown>>;actorUserId?:string}>;
export interface FollowUpDraftStore { findById(ws:string,id:string):Promise<FollowUpDraftRecord|null>; findByGenerationKey(ws:string,key:string):Promise<FollowUpDraftRecord|null>; listByTask(ws:string,task:string):Promise<readonly FollowUpDraftRecord[]>; create(ws:string,input:FollowUpDraftCreate):Promise<FollowUpDraftRecord>; updateStatus(ws:string,id:string,status:FollowUpDraftStatus,actor?:string,reason?:string):Promise<FollowUpDraftRecord>; edit(ws:string,id:string,subject:string,body:string):Promise<FollowUpDraftRecord>; supersedeActive(ws:string,task:string):Promise<void>; recordActivity(ws:string,a:FollowUpDraftActivity):Promise<void>; }
export const FOLLOW_UP_DRAFT_TRANSITIONS:Readonly<Record<FollowUpDraftStatus,readonly FollowUpDraftStatus[]>>={draft:['ready_for_review','rejected'],ready_for_review:['approved','rejected'],approved:[],rejected:[]};
export function assertFollowUpDraftTransition(from:FollowUpDraftStatus,to:FollowUpDraftStatus){if(from===to)return;if(!FOLLOW_UP_DRAFT_TRANSITIONS[from].includes(to))throw new Error(`Invalid follow-up draft transition: ${from} -> ${to}`);}
export { SupabaseFollowUpDraftStore } from './supabase-follow-up-draft-store';

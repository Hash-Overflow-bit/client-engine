import { outreachSchema, type OutreachDraft } from './schema';
import { generateOutreach, type OutreachInput } from './index';
import type { AIProvider } from '../qualification';

export type OutreachResearch = OutreachInput['research'] & { status?: string; version?: string; researchedAt?: string };
export type DraftRecordLike = Readonly<{ id:string; version:number; [key:string]: unknown }>;
export type DraftStore = { findByGenerationKey(workspaceId:string,key:string):Promise<DraftRecordLike|null>; listByLead(workspaceId:string,leadId:string):Promise<readonly DraftRecordLike[]>; create(workspaceId:string,key:string,draft:Readonly<Record<string,unknown>>):Promise<DraftRecordLike>; updateStatus(workspaceId:string,id:string,status:string,reason?:string):Promise<void>; edit(workspaceId:string,id:string,subject:string,body:string):Promise<DraftRecordLike> };
export type RunStore = { record(workspaceId:string, run:Readonly<Record<string,unknown>>):Promise<void> };
export type OutreachActivityWriter = (event: Readonly<{ workspaceId:string; leadId:string; companyId:string; activityType:'outreach_generated'|'outreach_generation_failed'|'outreach_regenerated'; effectKey:string; details:Readonly<Record<string,unknown>> }>) => Promise<void>;
export type OutreachServiceInput = { workspaceId:string; leadId:string; companyId:string; lead:OutreachInput['lead']; company:OutreachInput['company']; research:OutreachResearch };

export class OutreachService {
  constructor(private readonly provider: AIProvider, private readonly drafts: DraftStore, private readonly runs: RunStore, private readonly now = () => new Date(), private readonly activity?: OutreachActivityWriter) {}
  async generate(input: OutreachServiceInput, options: { regenerate?: boolean } = {}) {
    const r=input.research; const version=r.version ?? r.researchedAt ?? 'current';
    const stale = r.researchedAt ? this.now().getTime() - new Date(r.researchedAt).getTime() > 30 * 24 * 60 * 60 * 1000 : false;
    if (r.status !== 'researched' || r.needsReview || stale || !r.usableForOutreach || r.confidence < .75 || !r.verifiedSignals.length) throw new Error('Research is not eligible for outreach');
    const key=`${input.leadId}:${version}:${this.provider.promptVersion}${options.regenerate ? `:v${(await this.drafts.listByLead(input.workspaceId,input.leadId)).length+1}` : ''}`;
    if (!options.regenerate) { const existing=await this.drafts.findByGenerationKey(input.workspaceId,key); if(existing) return existing; }
    const started=Date.now(); let parsed: OutreachDraft | null=null; let error='';
    for(let attempt=0;attempt<2 && !parsed;attempt++) { try { const raw=this.provider.generateOutreach ? await this.provider.generateOutreach({lead:input.lead,company:input.company,research:r,repair:attempt===1}) : generateOutreach(input); parsed=outreachSchema.parse(raw); } catch(e) { error=e instanceof Error?e.message:'Invalid model output'; await this.runs.record(input.workspaceId,{operation:'outreach_generation',operationKey:`${key}:attempt-${attempt+1}`,leadId:input.leadId,companyId:input.companyId,provider:this.provider.provider,model:this.provider.model,promptVersion:this.provider.promptVersion,input:{researchVersion:version,attempt:attempt+1},output:null,confidence:null,status:attempt===1?'invalid':'failed',error,durationMs:Date.now()-started}); } }
    if(!parsed) { await this.activity?.({workspaceId:input.workspaceId,leadId:input.leadId,companyId:input.companyId,activityType:'outreach_generation_failed',effectKey:`outreach_generation_failed:${key}`,details:{researchVersion:version,error}}); throw new Error(`Outreach generation needs review: ${error}`); }
    await this.runs.record(input.workspaceId,{operation:'outreach_generation',operationKey:`${key}:success`,leadId:input.leadId,companyId:input.companyId,provider:this.provider.provider,model:this.provider.model,promptVersion:this.provider.promptVersion,input:{researchVersion:version},output:parsed,confidence:parsed.confidence,status:'succeeded',durationMs:Date.now()-started});
    const history=await this.drafts.listByLead(input.workspaceId,input.leadId); const next=(history[0]?.version ?? 0)+1;
    const created = await this.drafts.create(input.workspaceId,key,{workspaceId:input.workspaceId,leadId:input.leadId,companyId:input.companyId,campaignId:null,researchVersion:version,version:next,subject:parsed.subject,body:parsed.body,personalizationSourceType:parsed.personalization.sourceType,personalizationSourceUrl:parsed.personalization.sourceUrl,serviceMatch:parsed.serviceMatch,portfolioMatch:parsed.portfolioMatch,confidence:parsed.confidence,warnings:parsed.warnings,provider:this.provider.provider,model:this.provider.model,promptVersion:this.provider.promptVersion,status:'ready_for_review'});
    await this.activity?.({workspaceId:input.workspaceId,leadId:input.leadId,companyId:input.companyId,activityType:options.regenerate?'outreach_regenerated':'outreach_generated',effectKey:`${options.regenerate?'outreach_regenerated':'outreach_generated'}:${created.id}`,details:{draftId:created.id,version:created.version,researchVersion:version}});
    return created;
  }
}

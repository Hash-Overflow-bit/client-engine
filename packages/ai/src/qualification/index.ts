import { z } from 'zod';
import type { Evidence } from '@client-engine/shared';
import {
  expectedTier,
  qualificationJsonSchema,
  qualificationResultSchema,
  type QualificationResult,
} from './schema';
import { companyResearchJsonSchema, type CompanyResearch } from '../research/schema';
import { outreachJsonSchema } from '../outreach/schema';
import { followUpDraftJsonSchema } from '../follow-up/schema';
import { meetingBriefJsonSchema } from '../meeting-brief/schema';
import { proposalJsonSchema } from '../proposal/schema';
import { replyClassificationJsonSchema, type ReplyMessageContext } from '@client-engine/reply-classification';
import type { ResearchInput } from '../research';

export type QualificationMode = 'routine' | 'ambiguous' | 'high_value';

export interface QualificationLead {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
}

export interface QualificationCompany {
  name: string;
  domain: string;
  industry: string | null;
  employeeCount: number | null;
  liveProduct: boolean | null;
  facts: readonly Evidence[];
}

export interface QualifyLeadInput {
  lead: QualificationLead;
  company: QualificationCompany;
  mode?: QualificationMode;
}

export interface QualificationAgentConfig {
  apiKey: string;
  routineModel: string;
  strongModel: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
  promptVersion?: string;
  lowConfidenceThreshold?: number;
}
export type AIProvider = Readonly<{ provider: 'openai' | 'ollama'; model: string; promptVersion: string; qualifyLead(input: QualifyLeadInput): Promise<QualificationResult>; researchCompany(input: ResearchInput): Promise<CompanyResearch>; generateOutreach?(input: unknown): Promise<unknown>; generateFollowUp?(input: unknown): Promise<unknown>; generateMeetingBrief?(input: unknown): Promise<unknown>; generateProposal?(input: unknown): Promise<unknown>; classifyReply?(input: ReplyMessageContext): Promise<unknown> }>;

export class QualificationAgentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'QualificationAgentError';
  }
}

const responseEnvelopeSchema = z.object({
  output_text: z.string().optional(),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).optional(),
  }).passthrough()).optional(),
}).passthrough();

const SYSTEM_PROMPT = `You qualify sales leads for a solo freelance developer. Return only the requested structured result. Use only facts supplied in the input; never infer or invent company research. Reasons must be short and directly grounded in those facts. Score fit from 0 to 100, where A is 80-100, B is 60-79, and C is 0-59. A service match may say "No clear match" when the supplied facts do not support one.`;
function review(result: QualificationResult, threshold: number): QualificationResult { return { ...result, needsReview: result.needsReview || result.confidence < threshold }; }

function modelFor(mode: QualificationMode, config: QualificationAgentConfig): string {
  return mode === 'routine' ? config.routineModel : config.strongModel;
}

function extractOutputText(value: unknown): string {
  const parsed = responseEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new QualificationAgentError('OpenAI returned an invalid response envelope');
  if (parsed.data.output_text) return parsed.data.output_text;
  const text = parsed.data.output
    ?.flatMap((item) => item.content ?? [])
    .map((part) => part.text)
    .find((part): part is string => typeof part === 'string' && part.length > 0);
  if (!text) throw new QualificationAgentError('OpenAI response contained no structured output');
  return text;
}

export class OpenAIQualificationAgent implements AIProvider {
  readonly provider = 'openai' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  readonly promptVersion: string;
  private readonly lowConfidenceThreshold: number;

  constructor(private readonly config: QualificationAgentConfig) {
    if (!config.apiKey) throw new QualificationAgentError('OPENAI_API_KEY is required');
    if (!config.routineModel || !config.strongModel) throw new QualificationAgentError('Qualification models are required');
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.endpoint = config.endpoint ?? 'https://api.openai.com/v1/responses';
    this.promptVersion = config.promptVersion ?? 'qualification.v1';
    this.lowConfidenceThreshold = config.lowConfidenceThreshold ?? 0.75;
  }
  get model(): string { return this.config.routineModel; }

  async qualifyLead(input: QualifyLeadInput): Promise<QualificationResult> {
    const mode = input.mode ?? 'routine';
    const model = modelFor(mode, this.config);
    const payload = {
      model,
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ lead: input.lead, company: input.company }) },
      ],
      text: { format: { type: 'json_schema', name: 'lead_qualification', strict: true, schema: qualificationJsonSchema } },
    };
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new QualificationAgentError(`OpenAI request failed with status ${response.status}`);
    let body: unknown;
    try { body = await response.json(); } catch (error) { throw new QualificationAgentError('OpenAI returned invalid JSON', { cause: error }); }
    let result: QualificationResult;
    try { result = qualificationResultSchema.parse(JSON.parse(extractOutputText(body))); }
    catch (error) { throw new QualificationAgentError('OpenAI returned an invalid qualification result', { cause: error }); }
    if (result.tier !== expectedTier(result.score)) {
      throw new QualificationAgentError('Qualification tier does not match score');
    }
    return review(result, this.lowConfidenceThreshold);
  }
  async researchCompany(input: ResearchInput): Promise<CompanyResearch> {
    const response = await this.fetchImpl(this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.config.strongModel, input: [{ role: 'system', content: 'Research public company content safely. ' + input.company.name }, { role: 'user', content: JSON.stringify(input) }], text: { format: { type: 'json_schema', name: 'company_research', strict: true, schema: companyResearchJsonSchema } } }) });
    if (!response.ok) throw new QualificationAgentError(`OpenAI research failed with status ${response.status}`);
    const { validateResearch, extractResearchOutput } = await import('../research');
    try { return validateResearch(JSON.parse(extractResearchOutput(await response.json()))); } catch (error) { throw new QualificationAgentError('OpenAI returned invalid company research', { cause: error }); }
  }
  async generateOutreach(input: unknown): Promise<unknown> { const response = await this.fetchImpl(this.endpoint, { method:'POST', headers:{ Authorization:`Bearer ${this.config.apiKey}`, 'Content-Type':'application/json' }, body: JSON.stringify({ model:this.config.routineModel, input:[{role:'system',content:'Generate concise evidence-grounded outreach. Use only supplied evidence; return JSON.'},{role:'user',content:JSON.stringify(input)}], text:{format:{type:'json_schema',name:'outreach_draft',strict:true,schema:outreachJsonSchema}}}) }); if(!response.ok) throw new QualificationAgentError(`OpenAI outreach failed with status ${response.status}`); return JSON.parse(extractOutputText(await response.json())); }
  async generateFollowUp(input: unknown): Promise<unknown> { const response = await this.fetchImpl(this.endpoint, { method:'POST', headers:{ Authorization:`Bearer ${this.config.apiKey}`, 'Content-Type':'application/json' }, body: JSON.stringify({ model:this.config.routineModel, input:[{role:'system',content:'Generate concise evidence-grounded follow-up content only. Use verified evidence and never invent facts or send.'},{role:'user',content:JSON.stringify(input)}], text:{format:{type:'json_schema',name:'follow_up_draft',strict:true,schema:followUpDraftJsonSchema}}}) }); if(!response.ok) throw new QualificationAgentError(`OpenAI follow-up failed with status ${response.status}`); return JSON.parse(extractOutputText(await response.json())); }
  async generateMeetingBrief(input: unknown): Promise<unknown> { const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.config.routineModel,input:[{role:'system',content:'Generate a concise factual meeting brief. Separate verified facts, assumptions, and unknowns. Never propose a price, send a message, or invent facts.'},{role:'user',content:JSON.stringify(input)}],text:{format:{type:'json_schema',name:'meeting_brief',strict:true,schema:meetingBriefJsonSchema}}})});if(!response.ok)throw new QualificationAgentError(`OpenAI meeting brief failed with status ${response.status}`);return JSON.parse(extractOutputText(await response.json()));}
  async generateProposal(input: unknown): Promise<unknown> { const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.config.routineModel,input:[{role:'system',content:'Generate a concise factual proposal only from supplied discovery facts. Preserve supplied pricing exactly. Never invent pricing, send, negotiate, or create a contract.'},{role:'user',content:JSON.stringify(input)}],text:{format:{type:'json_schema',name:'proposal',strict:true,schema:proposalJsonSchema}}})});if(!response.ok)throw new QualificationAgentError(`OpenAI proposal failed with status ${response.status}`);return JSON.parse(extractOutputText(await response.json()));}
  async classifyReply(input: ReplyMessageContext): Promise<unknown> { const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:this.config.routineModel,input:[{role:'system',content:'Classify the target inbound reply. Return only structured JSON. Never recommend sending or scheduling automatically.'},{role:'user',content:JSON.stringify(input)}],text:{format:{type:'json_schema',name:'reply_classification',strict:true,schema:replyClassificationJsonSchema}}})});if(!response.ok)throw new QualificationAgentError(`OpenAI reply classification failed with status ${response.status}`);return JSON.parse(extractOutputText(await response.json())); }

  getPromptVersion(): string { return this.promptVersion; }
}

export type OllamaQualificationAgentConfig = Readonly<{ model: string; baseUrl?: string; fetchImpl?: typeof fetch; promptVersion?: string; lowConfidenceThreshold?: number }>;
const ollamaResponseSchema = z.object({ message: z.object({ content: z.string() }) }).passthrough();
export class OllamaQualificationAgent implements AIProvider {
  readonly provider = 'ollama' as const; readonly model: string; readonly promptVersion: string;
  private readonly fetchImpl: typeof fetch; private readonly endpoint: string; private readonly lowConfidenceThreshold: number;
  constructor(config: OllamaQualificationAgentConfig) { if (!config.model.trim()) throw new QualificationAgentError('Ollama model is required'); this.model = config.model; this.promptVersion = config.promptVersion ?? 'qualification.v1'; this.fetchImpl = config.fetchImpl ?? fetch; this.endpoint = `${(config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '')}/api/chat`; this.lowConfidenceThreshold = config.lowConfidenceThreshold ?? 0.75; }
  async qualifyLead(input: QualifyLeadInput): Promise<QualificationResult> { try { const response = await this.fetchImpl(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.model, stream: false, format: qualificationJsonSchema, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({ lead: input.lead, company: input.company }) }] }) }); if (!response.ok) throw new QualificationAgentError(`Ollama request failed with status ${response.status}`); const envelope = ollamaResponseSchema.parse(await response.json()); const result = qualificationResultSchema.parse(JSON.parse(envelope.message.content)); if (result.tier !== expectedTier(result.score)) throw new QualificationAgentError('Qualification tier does not match score'); return review(result, this.lowConfidenceThreshold); } catch (error) { if (error instanceof QualificationAgentError && error.message.includes('status')) throw error; return { score: 0, tier: 'C', reasons: ['Local AI output requires human review'], serviceMatch: 'No clear match', confidence: 0, needsReview: true }; } }
  async researchCompany(input: ResearchInput): Promise<CompanyResearch> { try { const response = await this.fetchImpl(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.model, stream: false, format: companyResearchJsonSchema, messages: [{ role: 'system', content: 'Research only supplied public website text. Hypotheses are not facts.' }, { role: 'user', content: JSON.stringify(input) }] }) }); if (!response.ok) throw new QualificationAgentError(`Ollama research failed with status ${response.status}`); const envelope = ollamaResponseSchema.parse(await response.json()); const { validateResearch } = await import('../research'); return validateResearch(JSON.parse(envelope.message.content)); } catch (error) { if (error instanceof QualificationAgentError && error.message.includes('status')) throw error; return { companySummary: 'Research requires human review', productSummary: 'Research requires human review', targetCustomer: 'Unknown', apparentStage: 'Unknown', recommendedService: 'No clear match', portfolioMatch: 'Unknown', verifiedSignals: [], possibleNeeds: [], personalizationAngles: [], confidence: 0, usableForOutreach: false, needsReview: true }; } }
  async generateOutreach(input: unknown): Promise<unknown> { const response = await this.fetchImpl(this.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:this.model,stream:false,format:outreachJsonSchema,messages:[{role:'system',content:'Generate concise evidence-grounded outreach. Never invent facts.'},{role:'user',content:JSON.stringify(input)}]}) }); if(!response.ok) throw new QualificationAgentError(`Ollama outreach failed with status ${response.status}`); const envelope=ollamaResponseSchema.parse(await response.json()); return JSON.parse(envelope.message.content); }
  async generateFollowUp(input: unknown): Promise<unknown> { const response = await this.fetchImpl(this.endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:this.model,stream:false,format:followUpDraftJsonSchema,messages:[{role:'system',content:'Generate concise evidence-grounded follow-up content only. Never invent facts or send.'},{role:'user',content:JSON.stringify(input)}]}) }); if(!response.ok) throw new QualificationAgentError(`Ollama follow-up failed with status ${response.status}`); const envelope=ollamaResponseSchema.parse(await response.json()); return JSON.parse(envelope.message.content); }
  async generateMeetingBrief(input: unknown): Promise<unknown> { const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:this.model,stream:false,format:meetingBriefJsonSchema,messages:[{role:'system',content:'Generate a concise factual meeting brief. Separate verified facts, assumptions, and unknowns. Never propose a price, send, or invent facts.'},{role:'user',content:JSON.stringify(input)}]})});if(!response.ok)throw new QualificationAgentError(`Ollama meeting brief failed with status ${response.status}`);const envelope=ollamaResponseSchema.parse(await response.json());return JSON.parse(envelope.message.content);}
  async generateProposal(input: unknown): Promise<unknown> { const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:this.model,stream:false,format:proposalJsonSchema,messages:[{role:'system',content:'Generate a concise factual proposal only from supplied discovery facts. Preserve supplied pricing exactly. Never invent pricing, send, negotiate, or create a contract.'},{role:'user',content:JSON.stringify(input)}]})});if(!response.ok)throw new QualificationAgentError(`Ollama proposal failed with status ${response.status}`);const envelope=ollamaResponseSchema.parse(await response.json());return JSON.parse(envelope.message.content);}
  async classifyReply(input: ReplyMessageContext): Promise<unknown> { const response=await this.fetchImpl(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:this.model,stream:false,format:replyClassificationJsonSchema,messages:[{role:'system',content:'Classify only the TARGET_MESSAGE. Never send or schedule anything.'},{role:'user',content:JSON.stringify(input)}]})});if(!response.ok)throw new QualificationAgentError(`Ollama reply classification failed with status ${response.status}`);const envelope=ollamaResponseSchema.parse(await response.json());return JSON.parse(envelope.message.content); }
}

export function createAIProviderFromEnv(env: NodeJS.ProcessEnv = process.env): AIProvider { const selected = env.AI_PROVIDER ?? (env.CLIENT_ENGINE_ENV === 'production' ? 'openai' : 'ollama'); if (selected === 'ollama') return new OllamaQualificationAgent({ model: env.OLLAMA_MODEL ?? 'llama3.1:8b', baseUrl: env.OLLAMA_BASE_URL, promptVersion: env.AI_PROMPT_VERSION }); if (selected === 'openai') return new OpenAIQualificationAgent({ apiKey: requiredEnv(env, 'OPENAI_API_KEY'), routineModel: requiredEnv(env, 'OPENAI_QUALIFICATION_ROUTINE_MODEL'), strongModel: requiredEnv(env, 'OPENAI_QUALIFICATION_STRONG_MODEL'), promptVersion: env.AI_PROMPT_VERSION }); throw new QualificationAgentError(`Unsupported AI_PROVIDER: ${selected}`); }
function requiredEnv(env: NodeJS.ProcessEnv, name: string): string { if (!env[name]) throw new QualificationAgentError(`${name} is required`); return env[name]; }

export function createQualificationAgentFromEnv(env: NodeJS.ProcessEnv = process.env): OpenAIQualificationAgent {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new QualificationAgentError(`${name} is required`);
    return value;
  };
  return new OpenAIQualificationAgent({
    apiKey: required('OPENAI_API_KEY'),
    routineModel: required('OPENAI_QUALIFICATION_ROUTINE_MODEL'),
    strongModel: required('OPENAI_QUALIFICATION_STRONG_MODEL'),
    promptVersion: env.OPENAI_QUALIFICATION_PROMPT_VERSION,
  });
}

export { qualificationResultSchema, qualificationJsonSchema, expectedTier } from './schema';
export type { QualificationResult } from './schema';

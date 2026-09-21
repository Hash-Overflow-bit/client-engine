import { z } from 'zod';
import { companyResearchSchema, type CompanyResearch } from './schema';
import type { AIProvider } from '../qualification';

export type ResearchDocument = Readonly<{ url: string; text: string }>;
export type ResearchInput = Readonly<{ company: { name: string; domain: string }; documents: readonly ResearchDocument[] }>;
export type ResearchProvider = AIProvider & { researchCompany(input: ResearchInput): Promise<CompanyResearch> };
const envelope = z.object({ output_text: z.string().optional(), output: z.array(z.object({ content: z.array(z.object({ text: z.string().optional() }).passthrough()).optional() }).passthrough()).optional() }).passthrough();
export function extractResearchOutput(value: unknown): string { const parsed = envelope.parse(value); if (parsed.output_text) return parsed.output_text; const text = parsed.output?.flatMap((i) => i.content ?? []).map((p) => p.text).find((t): t is string => !!t); if (!text) throw new Error('Research response contained no output'); return text; }
export function validateResearch(value: unknown): CompanyResearch { const result = companyResearchSchema.parse(value); return { ...result, usableForOutreach: result.usableForOutreach && result.verifiedSignals.length > 0 && !result.needsReview }; }
export { companyResearchSchema, companyResearchJsonSchema } from './schema';
export type { CompanyResearch } from './schema';

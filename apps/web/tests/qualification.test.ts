import { describe, expect, it } from 'vitest';
import { OpenAIQualificationAgent, OllamaQualificationAgent, QualificationAgentError, createAIProviderFromEnv } from '@client-engine/ai';

const input = {
  lead: { id: 'lead-1', name: 'Alex Johnson', role: 'Founder', email: 'alex@example.com' },
  company: {
    name: 'InvoiceAI', domain: 'invoice.ai', industry: 'AI SaaS', employeeCount: 12, liveProduct: true,
    facts: [{ url: 'https://invoice.ai', excerpt: 'AI invoicing product', retrievedAt: '2026-09-19T00:00:00.000Z' }],
  },
} as const;

function response(result: unknown): Response {
  return new Response(JSON.stringify({ output_text: JSON.stringify(result) }), { status: 200 });
}

describe('OpenAI qualification agent', () => {
  it('uses strict structured output and the routine model', async () => {
    let request: RequestInit | undefined;
    const agent = new OpenAIQualificationAgent({
      apiKey: 'test-key', routineModel: 'cheap-model', strongModel: 'strong-model',
      fetchImpl: async (_url, init) => { request = init; return response({ score: 88, tier: 'A', reasons: ['Founder', 'AI SaaS'], serviceMatch: 'AI SaaS development', confidence: 0.91 }); },
    });
    await expect(agent.qualifyLead(input)).resolves.toMatchObject({ score: 88, tier: 'A' });
    const body = JSON.parse(String(request?.body)) as { model: string; text: { format: { type: string; strict: boolean; schema: { additionalProperties: boolean } } } };
    expect(body.model).toBe('cheap-model');
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(body.text.format.schema.additionalProperties).toBe(false);
  });

  it('routes ambiguous and high-value work to the strong model', async () => {
    const models: string[] = [];
    const agent = new OpenAIQualificationAgent({
      apiKey: 'test-key', routineModel: 'cheap-model', strongModel: 'strong-model',
      fetchImpl: async (_url, init) => { models.push((JSON.parse(String(init?.body)) as { model: string }).model); return response({ score: 60, tier: 'B', reasons: ['Founder'], serviceMatch: 'Development', confidence: 0.7 }); },
    });
    await agent.qualifyLead({ ...input, mode: 'ambiguous' });
    await agent.qualifyLead({ ...input, mode: 'high_value' });
    expect(models).toEqual(['strong-model', 'strong-model']);
  });

  it('rejects invalid or inconsistent model output', async () => {
    const agent = new OpenAIQualificationAgent({ apiKey: 'test-key', routineModel: 'cheap', strongModel: 'strong', fetchImpl: async () => response({ score: 88, tier: 'B', reasons: [], serviceMatch: '', confidence: 2 }) });
    await expect(agent.qualifyLead(input)).rejects.toBeInstanceOf(QualificationAgentError);
  });
  it('marks invalid local-model output for review', async () => { const agent = new OllamaQualificationAgent({ model: 'local', fetchImpl: async () => response({ message: { content: 'not-json' } }) }); await expect(agent.qualifyLead(input)).resolves.toMatchObject({ needsReview: true, confidence: 0 }); });
  it('switches providers by environment', () => { expect(createAIProviderFromEnv({ CLIENT_ENGINE_ENV: 'development' }).provider).toBe('ollama'); expect(createAIProviderFromEnv({ CLIENT_ENGINE_ENV: 'production', OPENAI_API_KEY: 'key', OPENAI_QUALIFICATION_ROUTINE_MODEL: 'cheap', OPENAI_QUALIFICATION_STRONG_MODEL: 'strong' }).provider).toBe('openai'); });
});

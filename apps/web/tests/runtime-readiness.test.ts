import { describe, expect, it } from 'vitest';
import { toSafeOperationLog } from '../lib/observability';
import { getRuntimeReadiness } from '../lib/runtime-readiness';

const assistedOllama = {
  CLIENT_ENGINE_ENV: 'production',
  CLIENT_ENGINE_OPERATING_MODE: 'assisted',
  AI_PROVIDER: 'ollama',
  OLLAMA_BASE_URL: 'http://ollama.internal:11434',
  OLLAMA_MODEL: 'llama3.1:8b',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable',
  OUTBOUND_KILL_SWITCH: 'true',
  OUTREACH_SEND_ENABLED: 'false',
};

describe('runtime readiness', () => {
  it('accepts the zero-cost assisted Ollama configuration', () => {
    expect(getRuntimeReadiness(assistedOllama).ready).toBe(true);
  });

  it('fails closed when a selected provider or launch guard is misconfigured', () => {
    expect(getRuntimeReadiness({ ...assistedOllama, AI_PROVIDER: 'openai' }).issues).toContain('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
    expect(getRuntimeReadiness({ ...assistedOllama, OUTREACH_SEND_ENABLED: 'true' }).ready).toBe(false);
    expect(getRuntimeReadiness({ ...assistedOllama, LIVE_TEST_MODE: 'true', LIVE_TEST_MAX_PROSPECTS: '11' }).ready).toBe(false);
  });

  it('keeps operation logs bounded to operational identifiers and categories', () => {
    expect(toSafeOperationLog({ operation: 'proposal_generation', outcome: 'failed', durationMs: 12.3, workspaceId: 'workspace-a', entityId: 'proposal-a', errorCategory: 'provider_timeout' })).toEqual({ operation: 'proposal_generation', outcome: 'failed', duration_ms: 12, workspace_id: 'workspace-a', entity_id: 'proposal-a', error_category: 'provider_timeout' });
  });
});

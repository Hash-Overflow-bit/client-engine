import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIRunRecord, AIRunStore } from './index';
export class SupabaseAIRunStore implements AIRunStore {
  constructor(private readonly client: SupabaseClient) {}
  async record(workspaceId: string, run: AIRunRecord): Promise<void> {
    const existing = await this.client.from('ai_runs').select('id').eq('workspace_id', workspaceId).eq('operation_key', run.operationKey).maybeSingle();
    if (existing.error) throw new Error(`Unable to inspect AI run: ${existing.error.message}`);
    if (existing.data) return;
    const { error } = await this.client.from('ai_runs').insert({ workspace_id: workspaceId, lead_id: run.leadId ?? null, company_id: run.companyId ?? null, conversation_id: run.conversationId ?? null, follow_up_task_id: run.followUpTaskId ?? null, sequence_step: run.sequenceStep ?? null, purpose: run.purpose ?? null, operation: run.operation, operation_key: run.operationKey, provider: run.provider, model: run.model, prompt_version: run.promptVersion, input: run.input, output: run.output, confidence: run.confidence, status: run.status, error: run.error ?? null, duration_ms: run.durationMs ?? null, completed_at: run.status === 'succeeded' ? new Date().toISOString() : null });
    if (error) throw new Error(`Unable to record AI run: ${error.message}`);
  }
}

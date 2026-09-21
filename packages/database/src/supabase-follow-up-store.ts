import type { SupabaseClient } from '@supabase/supabase-js';
import type { FollowUpCancellationReason, FollowUpTask, FollowUpTaskCreate, FollowUpStatus } from '@client-engine/follow-ups';

function map(row: Record<string, unknown>): FollowUpTask {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    leadId: String(row.lead_id),
    conversationId: String(row.conversation_id),
    deliveryId: String(row.delivery_id),
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    policyId: String(row.policy_id),
    sequenceStep: Number(row.sequence_step),
    purpose: row.purpose as FollowUpTask['purpose'],
    dueAt: String(row.due_at),
    status: row.status as FollowUpStatus,
    eligibilityCheckedAt: row.eligibility_checked_at ? String(row.eligibility_checked_at) : null,
    cancellationReason: row.cancellation_reason as FollowUpCancellationReason | null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseFollowUpStore {
  constructor(private readonly client: SupabaseClient) {}

  async list(workspaceId: string, leadId?: string) {
    let query = this.client.from('follow_up_tasks').select('*').eq('workspace_id', workspaceId).order('due_at', { ascending: true });
    if (leadId) query = query.eq('lead_id', leadId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(map);
  }

  async findById(workspaceId: string, id: string) {
    const { data, error } = await this.client.from('follow_up_tasks').select('*').eq('workspace_id', workspaceId).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? map(data) : null;
  }

  async createMany(workspaceId: string, tasks: readonly FollowUpTaskCreate[]) {
    if (tasks.length === 0) return [];
    const rows = tasks.map((task) => ({ workspace_id: workspaceId, lead_id: task.leadId, conversation_id: task.conversationId, delivery_id: task.deliveryId, campaign_id: task.campaignId, policy_id: task.policyId, sequence_step: task.sequenceStep, purpose: task.purpose, due_at: task.dueAt, status: task.status ?? 'scheduled' }));
    const { error } = await this.client.from('follow_up_tasks').upsert(rows, { onConflict: 'workspace_id,delivery_id,policy_id,sequence_step', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return this.list(workspaceId, tasks[0]?.leadId);
  }

  async updateStatus(workspaceId: string, id: string, from: readonly FollowUpStatus[], status: FollowUpStatus, reason: FollowUpCancellationReason | null, checkedAt: string) {
    const values: Record<string, unknown> = { status, cancellation_reason: reason, eligibility_checked_at: checkedAt, updated_at: checkedAt };
    if (status === 'completed') values.completed_at = checkedAt;
    const { data, error } = await this.client.from('follow_up_tasks').update(values).eq('workspace_id', workspaceId).eq('id', id).in('status', from).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return map(data);
    return this.findById(workspaceId, id);
  }

  async reschedule(workspaceId: string, id: string, dueAt: string, actorId?: string) {
    const current = await this.findById(workspaceId, id);
    if (!current) throw new Error('Follow-up task not found');
    if (current.status === 'scheduled' && current.dueAt === dueAt) return current;
    if (!['scheduled', 'due'].includes(current.status)) throw new Error('Follow-up is not reschedulable');
    const now = new Date().toISOString();
    const { data, error } = await this.client.from('follow_up_tasks').update({ due_at: dueAt, status: 'scheduled', cancellation_reason: null, eligibility_checked_at: null, updated_at: now }).eq('workspace_id', workspaceId).eq('id', id).in('status', ['scheduled', 'due']).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Follow-up is not reschedulable');
    await this.recordActivity(workspaceId, 'follow_up_rescheduled', map(data), actorId, { due_at: dueAt });
    return map(data);
  }

  async cancelConversation(workspaceId: string, conversationId: string, reason: FollowUpCancellationReason, actorId?: string) {
    const now = new Date().toISOString();
    const { data, error } = await this.client.from('follow_up_tasks').update({ status: 'cancelled', cancellation_reason: reason, eligibility_checked_at: now, updated_at: now }).eq('workspace_id', workspaceId).eq('conversation_id', conversationId).in('status', ['scheduled', 'due']).select('*');
    if (error) throw new Error(error.message);
    for (const row of data ?? []) await this.recordActivity(workspaceId, 'follow_up_cancelled', map(row), actorId, { cancellation_reason: reason });
    return (data ?? []).map(map);
  }

  async recordActivity(workspaceId: string, type: 'follow_up_scheduled' | 'follow_up_due' | 'follow_up_cancelled' | 'follow_up_skipped' | 'follow_up_rescheduled', task: FollowUpTask, actorId?: string, details: Record<string, unknown> = {}) {
    const effectKey = type === 'follow_up_rescheduled' ? `${type}:${task.id}:${task.updatedAt}` : `${type}:${task.id}`;
    const { error } = await this.client.from('activities').upsert({ workspace_id: workspaceId, lead_id: task.leadId, company_id: null, actor_kind: actorId ? 'operator' : 'system', actor_user_id: actorId ?? null, activity_type: type, effect_key: effectKey, details: { follow_up_task_id: task.id, sequence_step: task.sequenceStep, due_at: task.dueAt, ...details } }, { onConflict: 'workspace_id,effect_key', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
}

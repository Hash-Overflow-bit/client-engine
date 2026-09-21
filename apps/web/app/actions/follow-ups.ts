'use server';

import { revalidatePath } from 'next/cache';
import { canFollowUp } from '@client-engine/conversations';
import { buildInitialTasks, cancellationReasonFor, evaluateDue, followUpDateSchema, type FollowUpCancellationReason } from '@client-engine/follow-ups';
import { SupabaseFollowUpStore } from '@client-engine/database';
import { createClient } from '../../lib/supabase/server';

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const { data: member, error } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error || !member?.workspace_id) throw new Error('No authorized workspace');
  return { supabase, user, workspaceId: String(member.workspace_id) };
}

function result(error?: unknown) { return error ? { ok: false, error: error instanceof Error ? error.message : 'Unable to update follow-up' } : { ok: true }; }

function outboundSafetyAllowed() {
  return process.env.CLIENT_ENGINE_ENV === 'production' && process.env.OUTBOUND_KILL_SWITCH !== 'true';
}

export async function loadFollowUpEligibility(auth: { supabase: Awaited<ReturnType<typeof createClient>>; workspaceId: string }, task: { leadId: string; conversationId: string; deliveryId: string; campaignId: string | null }) {
  const { supabase, workspaceId } = auth;
  const [{ data: lead, error: leadError }, { data: delivery, error: deliveryError }, { data: conversation, error: conversationError }] = await Promise.all([
    supabase.from('leads').select('id,email,stage,do_not_contact,replied_at,booked_at').eq('workspace_id', workspaceId).eq('id', task.leadId).maybeSingle(),
    supabase.from('delivery_records').select('id,status,lead_id').eq('workspace_id', workspaceId).eq('id', task.deliveryId).maybeSingle(),
    supabase.from('conversations').select('id,lead_id,status,replied_at').eq('workspace_id', workspaceId).eq('id', task.conversationId).maybeSingle(),
  ]);
  if (leadError || deliveryError || conversationError) throw new Error(leadError?.message ?? deliveryError?.message ?? conversationError?.message ?? 'Unable to read follow-up context');
  const { data: inbound } = await supabase.from('messages').select('id').eq('workspace_id', workspaceId).eq('conversation_id', task.conversationId).eq('direction', 'inbound').limit(1);
  const { data: suppression } = lead?.email ? await supabase.from('suppression_list').select('id').eq('workspace_id', workspaceId).eq('normalized_email', String(lead.email).trim().toLowerCase()).maybeSingle() : { data: null };
  let campaignActive = true;
  if (task.campaignId) {
    const { data: campaign, error: campaignError } = await supabase.from('campaigns').select('status').eq('workspace_id', workspaceId).eq('id', task.campaignId).maybeSingle();
    if (campaignError) throw new Error(campaignError.message);
    campaignActive = campaign?.status === 'active';
  }
  return { workspaceMatches: Boolean(lead && delivery && conversation && String(delivery.lead_id) === task.leadId && String(conversation.lead_id) === task.leadId), hasInboundReply: Boolean(inbound?.length || conversation?.status === 'replied' || conversation?.replied_at || lead?.replied_at), doNotContact: Boolean(lead?.do_not_contact), unsubscribed: Boolean(suppression), leadStage: String(lead?.stage ?? ''), deliverySent: delivery?.status === 'sent', outboundAllowed: outboundSafetyAllowed(), campaignActive };
}

async function createFollowUpsForSent(auth: Awaited<ReturnType<typeof authorize>>, deliveryId: string) {
  const { supabase, workspaceId } = auth;
  const { data: delivery, error: deliveryError } = await supabase.from('delivery_records').select('*').eq('workspace_id', workspaceId).eq('id', deliveryId).maybeSingle();
  if (deliveryError) throw new Error(deliveryError.message);
  if (!delivery || delivery.status !== 'sent') throw new Error('Only sent deliveries can schedule follow-ups');
  const { data: conversation, error: conversationError } = await supabase.from('conversations').select('id,lead_id,campaign_id').eq('workspace_id', workspaceId).eq('delivery_id', deliveryId).maybeSingle();
  if (conversationError || !conversation) throw new Error(conversationError?.message ?? 'Conversation not found for sent delivery');
  const store = new SupabaseFollowUpStore(supabase);
  const context = await loadFollowUpEligibility(auth, { leadId: String(delivery.lead_id), conversationId: String(conversation.id), deliveryId, campaignId: conversation.campaign_id ? String(conversation.campaign_id) : null });
  const creationContext = { ...context, outboundAllowed: true };
  if (!canFollowUp(creationContext)) throw new Error(`Follow-up is not eligible: ${cancellationReasonFor(creationContext) ?? 'OTHER'}`);
  const tasks = buildInitialTasks({ workspaceId, leadId: String(delivery.lead_id), conversationId: String(conversation.id), deliveryId, campaignId: conversation.campaign_id ? String(conversation.campaign_id) : null, sentAt: String(delivery.sent_at) });
  const created = await store.createMany(workspaceId, tasks);
  const matching = created.filter((task) => task.deliveryId === deliveryId);
  for (const task of matching) await store.recordActivity(workspaceId, 'follow_up_scheduled', task, auth.user.id, { policy_id: task.policyId });
  return matching;
}

export async function scheduleFollowUpsAfterSentAction(deliveryId: string) {
  try { const auth = await authorize(); await createFollowUpsForSent(auth, deliveryId); revalidatePath('/follow-ups'); return result(); } catch (error) { return result(error); }
}

async function processDueForAuthorized(auth: Awaited<ReturnType<typeof authorize>>, taskId: string) {
  const store = new SupabaseFollowUpStore(auth.supabase);
  const task = await store.findById(auth.workspaceId, taskId);
  if (!task) throw new Error('Follow-up task not found');
  const context = await loadFollowUpEligibility(auth, task);
  const decision = evaluateDue(task, context);
  const updated = await store.updateStatus(auth.workspaceId, task.id, ['scheduled'], decision.status, decision.reason, decision.checkedAt);
  if (!updated) throw new Error('Follow-up task disappeared');
  if (decision.status === 'due' && updated.status === 'due') {
    const finalContext = await loadFollowUpEligibility(auth, updated);
    if (!canFollowUp(finalContext)) {
      const reason = cancellationReasonFor(finalContext) ?? 'OTHER';
      const cancelled = await store.updateStatus(auth.workspaceId, updated.id, ['due'], 'cancelled', reason, new Date().toISOString());
      if (cancelled) await store.recordActivity(auth.workspaceId, 'follow_up_cancelled', cancelled, auth.user.id, { cancellation_reason: reason });
    } else {
      await store.recordActivity(auth.workspaceId, 'follow_up_due', updated, auth.user.id);
    }
  } else if (decision.status === 'cancelled') {
    await store.recordActivity(auth.workspaceId, 'follow_up_cancelled', updated, auth.user.id, { cancellation_reason: decision.reason });
  }
  return updated;
}

export async function processDueFollowUpAction(taskId: string) {
  try { const auth = await authorize(); const task = await processDueForAuthorized(auth, taskId); revalidatePath('/follow-ups'); revalidatePath(`/leads/${task.leadId}`); return result(); } catch (error) { return result(error); }
}

export async function processDueFollowUpsAction() {
  try {
    const auth = await authorize();
    const store = new SupabaseFollowUpStore(auth.supabase);
    const tasks = await store.list(auth.workspaceId);
    const now = Date.now();
    for (const task of tasks) if (task.status === 'scheduled' && new Date(task.dueAt).getTime() <= now) await processDueForAuthorized(auth, task.id);
    revalidatePath('/follow-ups');
    return result();
  } catch (error) { return result(error); }
}

async function transitionManual(taskId: string, status: 'cancelled' | 'skipped', reason: FollowUpCancellationReason) {
  const auth = await authorize();
  const store = new SupabaseFollowUpStore(auth.supabase);
  const task = await store.findById(auth.workspaceId, taskId);
  if (!task) throw new Error('Follow-up task not found');
  if (task.status === status) return;
  if (!['scheduled', 'due'].includes(task.status)) throw new Error('Follow-up task is no longer active');
  const updated = await store.updateStatus(auth.workspaceId, task.id, ['scheduled', 'due'], status, reason, new Date().toISOString());
  if (!updated) throw new Error('Follow-up task is no longer active');
  await store.recordActivity(auth.workspaceId, status === 'skipped' ? 'follow_up_skipped' : 'follow_up_cancelled', updated, auth.user.id, { cancellation_reason: reason });
  revalidatePath('/follow-ups');
  revalidatePath(`/leads/${task.leadId}`);
}

export async function skipFollowUpAction(taskId: string) { try { await transitionManual(taskId, 'skipped', 'MANUAL_SKIP'); return result(); } catch (error) { return result(error); } }
export async function cancelFollowUpAction(taskId: string) { try { await transitionManual(taskId, 'cancelled', 'MANUAL_CANCEL'); return result(); } catch (error) { return result(error); } }

export async function cancelRemainingFollowUpsAction(conversationId: string) {
  try {
    const auth = await authorize();
    const store = new SupabaseFollowUpStore(auth.supabase);
    const { data: conversation, error } = await auth.supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', auth.workspaceId)
      .eq('id', conversationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conversation) throw new Error('Conversation not found');
    await store.cancelConversation(auth.workspaceId, conversationId, 'MANUAL_CANCEL', auth.user.id);
    revalidatePath('/follow-ups');
    return result();
  } catch (error) { return result(error); }
}

export async function rescheduleFollowUpAction(taskId: string, dueAt: string) {
  try {
    const auth = await authorize();
    const parsedInput = followUpDateSchema.safeParse(dueAt);
    if (!parsedInput.success) throw new Error('Reschedule time must be an ISO datetime');
    const parsed = new Date(parsedInput.data);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new Error('Reschedule time must be in the future');
    const store = new SupabaseFollowUpStore(auth.supabase);
    const task = await store.findById(auth.workspaceId, taskId);
    if (!task) throw new Error('Follow-up task not found');
    const context = await loadFollowUpEligibility(auth, task);
    const stableContext = { ...context, outboundAllowed: true };
    if (!canFollowUp(stableContext)) {
      const reason = cancellationReasonFor(stableContext) ?? 'OTHER';
      const cancelled = await store.updateStatus(auth.workspaceId, task.id, ['scheduled', 'due'], 'cancelled', reason, new Date().toISOString());
      if (cancelled) await store.recordActivity(auth.workspaceId, 'follow_up_cancelled', cancelled, auth.user.id, { cancellation_reason: reason });
      throw new Error(`Follow-up is no longer eligible: ${reason}`);
    }
    await store.reschedule(auth.workspaceId, task.id, parsed.toISOString(), auth.user.id);
    revalidatePath('/follow-ups');
    revalidatePath(`/leads/${task.leadId}`);
    return result();
  } catch (error) { return result(error); }
}

export { createFollowUpsForSent };

'use server';

import { revalidatePath } from 'next/cache';
import { createAIProviderFromEnv } from '@client-engine/ai';
import { classifyInboundReply, replyIntentSchema } from '@client-engine/reply-classification';
import { SupabaseReplyClassificationStore } from '@client-engine/database';
import { createClient } from '../../lib/supabase/server';

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const { data: member, error } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error || !member?.workspace_id) throw new Error('No authorized workspace');
  return { supabase, user, workspaceId: String(member.workspace_id) };
}

async function recordActivity(auth: Awaited<ReturnType<typeof authorize>>, type: string, leadId: string, companyId: string | null, effectKey: string, details: Record<string, unknown>) {
  const { error } = await auth.supabase.from('activities').upsert({ workspace_id: auth.workspaceId, lead_id: leadId, company_id: companyId, actor_kind: 'operator', actor_user_id: auth.user.id, activity_type: type, effect_key: effectKey, details }, { onConflict: 'workspace_id,effect_key', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

async function loadClassification(auth: Awaited<ReturnType<typeof authorize>>, classificationId: string) {
  const { data: classification, error } = await auth.supabase.from('reply_classifications').select('*').eq('workspace_id', auth.workspaceId).eq('id', classificationId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!classification) throw new Error('Classification not found');
  const { data: lead, error: leadError } = await auth.supabase.from('leads').select('id,company_id').eq('workspace_id', auth.workspaceId).eq('id', classification.lead_id).maybeSingle();
  if (leadError || !lead) throw new Error(leadError?.message ?? 'Lead not found');
  return { classification, lead };
}

export async function classifyReplyAction(messageId: string) {
  try {
    const auth = await authorize();
    const { supabase, workspaceId } = auth;
    const { data: message } = await supabase.from('messages').select('id,conversation_id,lead_id,body,subject,received_at').eq('workspace_id', workspaceId).eq('id', messageId).eq('direction', 'inbound').maybeSingle();
    if (!message || !message.conversation_id) throw new Error('Inbound message not found');
    const { data: lead } = await supabase.from('leads').select('id,name,role,stage,company_id').eq('workspace_id', workspaceId).eq('id', message.lead_id).maybeSingle();
    const { data: company } = await supabase.from('companies').select('name').eq('workspace_id', workspaceId).eq('id', lead?.company_id).maybeSingle();
    if (!lead || !company) throw new Error('Reply context not found');
    const { data: context } = await supabase.from('messages').select('direction,body').eq('workspace_id', workspaceId).eq('conversation_id', message.conversation_id).order('created_at', { ascending: false }).limit(6);
    const result = await classifyInboundReply(createAIProviderFromEnv() as never, new SupabaseReplyClassificationStore(supabase), { workspaceId, conversationId: String(message.conversation_id), messageId: String(message.id), leadId: String(message.lead_id), companyId: String(lead.company_id), context: { latestMessage: { id: String(message.id), body: String(message.body), subject: message.subject ? String(message.subject) : null, receivedAt: String(message.received_at) }, recentContext: (context ?? []).reverse().map((item) => ({ direction: item.direction as 'inbound' | 'outbound', body: String(item.body).slice(0, 2000) })), lead: { name: String(lead.name), role: lead.role ? String(lead.role) : null, stage: String(lead.stage) }, company: { name: String(company.name) } } });
    if (result.intent === 'UNSUBSCRIBE') {
      const { error: suppressionError } = await supabase.from('leads').update({ do_not_contact: true, updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('id', lead.id);
      if (suppressionError) throw new Error(suppressionError.message);
      await recordActivity(auth, 'contact_suppressed', String(lead.id), String(lead.company_id), `contact_suppressed:reply:${message.id}`, { message_id: message.id, reason: 'unsubscribe_classification' });
    }
    revalidatePath('/replies');
    revalidatePath(`/leads/${String(lead.id)}`);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to classify reply' };
  }
}

/** Confirm or change an AI result. The override is immutable and idempotent. */
export async function overrideReplyClassification(classificationId: string, selectedIntent: string, reason?: string) {
  try {
    const auth = await authorize();
    const intent = replyIntentSchema.parse(selectedIntent);
    const { classification, lead } = await loadClassification(auth, classificationId);
    const trimmedReason = reason?.trim().slice(0, 500) || null;
    const { error } = await auth.supabase.from('reply_classification_overrides').upsert({ workspace_id: auth.workspaceId, classification_id: classificationId, message_id: classification.message_id, conversation_id: classification.conversation_id, lead_id: classification.lead_id, previous_intent: classification.intent, selected_intent: intent, reason: trimmedReason, actor_user_id: auth.user.id }, { onConflict: 'workspace_id,classification_id,selected_intent,actor_user_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    const { error: reviewError } = await auth.supabase.from('reply_classification_reviews').upsert({ workspace_id: auth.workspaceId, classification_id: classificationId, status: 'confirmed', note: trimmedReason, actor_user_id: auth.user.id }, { onConflict: 'workspace_id,classification_id,status,actor_user_id', ignoreDuplicates: true });
    if (reviewError) throw new Error(reviewError.message);
    await recordActivity(auth, trimmedReason === 'confirmed_ai' ? 'reply_classification_confirmed' : 'reply_classification_overridden', String(classification.lead_id), lead.company_id ? String(lead.company_id) : null, `${trimmedReason === 'confirmed_ai' ? 'reply_classification_confirmed' : 'reply_classification_overridden'}:${classificationId}:${intent}:${auth.user.id}`, { classification_id: classificationId, message_id: classification.message_id, selected_intent: intent, previous_intent: classification.intent, reason: trimmedReason });
    if (intent === 'UNSUBSCRIBE') {
      const { error: suppressionError } = await auth.supabase.from('leads').update({ do_not_contact: true, updated_at: new Date().toISOString() }).eq('workspace_id', auth.workspaceId).eq('id', classification.lead_id);
      if (suppressionError) throw new Error(suppressionError.message);
      await recordActivity(auth, 'contact_suppressed', String(classification.lead_id), lead.company_id ? String(lead.company_id) : null, `contact_suppressed:classification:${classificationId}`, { classification_id: classificationId, message_id: classification.message_id, reason: 'unsubscribe_override' });
    }
    revalidatePath('/replies');
    revalidatePath(`/leads/${String(classification.lead_id)}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to override classification' };
  }
}

export async function markReplyNeedsReviewAction(classificationId: string, note?: string) {
  try {
    const auth = await authorize();
    const { classification, lead } = await loadClassification(auth, classificationId);
    const { error } = await auth.supabase.from('reply_classification_reviews').upsert({ workspace_id: auth.workspaceId, classification_id: classificationId, status: 'needs_review', note: note?.trim().slice(0, 500) || 'Marked for human review', actor_user_id: auth.user.id }, { onConflict: 'workspace_id,classification_id,status,actor_user_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    await recordActivity(auth, 'reply_classification_reviewed', String(classification.lead_id), lead.company_id ? String(lead.company_id) : null, `reply_classification_reviewed:${classificationId}:${auth.user.id}`, { classification_id: classificationId, message_id: classification.message_id, status: 'needs_review' });
    revalidatePath('/replies');
    revalidatePath(`/leads/${String(classification.lead_id)}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to mark review state' };
  }
}

import { getEffectiveReplyIntent, type ReplyIntent } from '@client-engine/reply-classification';
import { createClient } from './supabase/server';

export type LiveLeadConversationMessage = Readonly<{
  id: string;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  timestamp: string | null;
  provider: string | null;
  status: string | null;
  classification: Readonly<{
    intent: ReplyIntent | null;
    effectiveIntent: ReplyIntent | null;
    confidence: number | null;
    summary: string | null;
    recommendedAction: string | null;
    needsReview: boolean;
    overridden: boolean;
  }> | null;
}>;

/** Reads the canonical conversation/message tables. A demo fallback remains available when Supabase is not configured. */
export async function loadLiveLeadConversation(leadId: string): Promise<readonly LiveLeadConversationMessage[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return [];
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!member?.workspace_id) return [];
    const { data: messages } = await supabase.from('messages').select('id,direction,subject,body,provider,status,received_at,sent_at,created_at').eq('workspace_id', member.workspace_id).eq('lead_id', leadId).order('created_at', { ascending: true });
    if (!messages?.length) return [];
    const ids = messages.map((message) => message.id);
    const { data: classifications } = await supabase.from('reply_classifications').select('*').in('message_id', ids).order('created_at', { ascending: false });
    const classificationIds = (classifications ?? []).map((row) => row.id);
    const { data: overrides } = classificationIds.length ? await supabase.from('reply_classification_overrides').select('*').in('classification_id', classificationIds).order('created_at', { ascending: false }) : { data: [] };
    const { data: reviews } = classificationIds.length ? await supabase.from('reply_classification_reviews').select('*').in('classification_id', classificationIds).order('created_at', { ascending: false }) : { data: [] };
    return messages.map((message) => {
      const classification = (classifications ?? []).find((row) => row.message_id === message.id);
      const override = classification ? (overrides ?? []).find((row) => row.classification_id === classification.id) : undefined;
      const review = classification ? (reviews ?? []).find((row) => row.classification_id === classification.id) : undefined;
      const effectiveIntent = classification ? getEffectiveReplyIntent({ humanOverride: override?.selected_intent as ReplyIntent | null | undefined, confirmedAi: review?.status === 'confirmed' ? classification.intent as ReplyIntent : null, unresolvedAi: classification.intent as ReplyIntent | null }) : null;
      return { id: String(message.id), direction: message.direction as 'inbound' | 'outbound', subject: message.subject ? String(message.subject) : null, body: String(message.body), timestamp: message.direction === 'inbound' ? (message.received_at ? String(message.received_at) : String(message.created_at)) : (message.sent_at ? String(message.sent_at) : String(message.created_at)), provider: message.provider ? String(message.provider) : null, status: message.status ? String(message.status) : null, classification: classification ? { intent: classification.intent as ReplyIntent | null, effectiveIntent, confidence: classification.confidence === null ? null : Number(classification.confidence), summary: classification.summary ? String(classification.summary) : null, recommendedAction: classification.recommended_action ? String(classification.recommended_action) : null, needsReview: Boolean(classification.needs_review || review?.status === 'needs_review'), overridden: Boolean(override) } : null };
    });
  } catch {
    return [];
  }
}

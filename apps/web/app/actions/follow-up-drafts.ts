'use server';

import { revalidatePath } from 'next/cache';
import { createAIProviderFromEnv, FollowUpGenerationService } from '@client-engine/ai';
import { SupabaseAIRunStore, SupabaseFollowUpDraftStore, SupabaseFollowUpStore } from '@client-engine/database';
import { canFollowUp } from '@client-engine/conversations';
import { cancellationReasonFor } from '@client-engine/follow-ups';
import { loadFollowUpEligibility } from './follow-ups';
import { createClient } from '../../lib/supabase/server';

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!member?.workspace_id) throw new Error('No authorized workspace');
  return { supabase, user, workspaceId: String(member.workspace_id) };
}
const safe = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Unable to update follow-up draft' });

async function contextFor(authz: Awaited<ReturnType<typeof auth>>, taskId: string) {
  const { supabase, workspaceId } = authz;
  const { data: task } = await supabase.from('follow_up_tasks').select('*').eq('workspace_id', workspaceId).eq('id', taskId).maybeSingle();
  if (!task) throw new Error('Follow-up task not found');
  if (task.status !== 'due') throw new Error('Follow-up task is not due');
  const leadQ = await supabase.from('leads').select('id,name,email,role,company_id,stage,do_not_contact').eq('workspace_id', workspaceId).eq('id', task.lead_id).maybeSingle();
  const companyQ = leadQ.data?.company_id ? await supabase.from('companies').select('id,name,domain,research_status,research_output,research_updated_at').eq('workspace_id', workspaceId).eq('id', leadQ.data.company_id).maybeSingle() : { data: null, error: null };
  const deliveryQ = await supabase.from('delivery_records').select('id,subject,body,status').eq('workspace_id', workspaceId).eq('id', task.delivery_id).maybeSingle();
  const messagesQ = await supabase.from('messages').select('id,direction,subject,body,sent_at,received_at').eq('workspace_id', workspaceId).eq('conversation_id', task.conversation_id).order('created_at', { ascending: false }).limit(20);
  if (!leadQ.data || !deliveryQ.data || deliveryQ.data.status !== 'sent') throw new Error('Sent delivery context is required');
  const eligibility = await loadFollowUpEligibility(authz, { leadId: String(task.lead_id), conversationId: String(task.conversation_id), deliveryId: String(task.delivery_id), campaignId: task.campaign_id ? String(task.campaign_id) : null });
  if (!canFollowUp(eligibility)) { const reason = cancellationReasonFor(eligibility) ?? 'OTHER'; await new SupabaseFollowUpStore(supabase).updateStatus(workspaceId, String(task.id), ['due'], 'cancelled', reason, new Date().toISOString()); throw new Error(`Follow-up is no longer eligible: ${reason}`); }
  const company = companyQ.data;
  if (!company?.research_output || company.research_status !== 'researched' || !company.research_updated_at || Date.now() - new Date(String(company.research_updated_at)).getTime() > 86_400_000) throw new Error('Fresh researched company context is required');
  const research = company.research_output as Record<string, unknown>;
  if (!Array.isArray(research.verifiedSignals) || research.verifiedSignals.length === 0 || research.needsReview === true || research.usableForOutreach === false) throw new Error('Research needs review before follow-up generation');
  const outbound = (messagesQ.data ?? []).filter((m) => m.direction === 'outbound').map((m) => ({ id: String(m.id), subject: String(m.subject ?? ''), body: String(m.body) }));
  return { task: { id: String(task.id), leadId: String(task.lead_id), conversationId: String(task.conversation_id), deliveryId: String(task.delivery_id), sequenceStep: Number(task.sequence_step), purpose: task.purpose as 'VALUE_FOLLOW_UP'|'SECOND_TOUCH'|'CLOSE_LOOP' }, lead: leadQ.data, company, delivery: deliveryQ.data, research: research as never, priorOutbound: outbound, contextVersion: `${company.research_updated_at}:${task.updated_at}:${outbound.map((m) => m.id).join(',')}` };
}

async function generate(taskId: string, regenerate = false) {
  const a = await auth(); const c = await contextFor(a, taskId); const drafts = new SupabaseFollowUpDraftStore(a.supabase);
  const service = new FollowUpGenerationService(createAIProviderFromEnv(), drafts, new SupabaseAIRunStore(a.supabase), async (event) => drafts.recordActivity(a.workspaceId, { ...event, activityType: event.activityType === 'follow_up_draft_regenerated' ? 'follow_up_regenerated' : event.activityType, effectKey: event.effectKey }));
  const result = await service.generate({ workspaceId: a.workspaceId, followUpTaskId: c.task.id, leadId: c.task.leadId, companyId: c.company?.id ? String(c.company.id) : null, conversationId: c.task.conversationId, originalDeliveryId: c.task.deliveryId, lead: { name: String(c.lead.name), role: c.lead.role ? String(c.lead.role) : null }, company: { name: String(c.company?.name ?? ''), domain: String(c.company?.domain ?? '') }, task: { sequenceStep: c.task.sequenceStep, purpose: c.task.purpose }, originalOutreach: { subject: String(c.delivery.subject), body: String(c.delivery.body ?? '') }, priorOutbound: c.priorOutbound, research: c.research, serviceMatch: null, portfolioMatch: null, contextVersion: c.contextVersion }, { regenerate, beforePersist: async () => { const latest = await contextFor(a, taskId); return latest.task.id === taskId; } });
  revalidatePath('/follow-ups'); revalidatePath(`/leads/${c.task.leadId}`); return { ok: true as const, draft: result };
}
export async function generateFollowUpDraftAction(taskId: string) { try { return await generate(taskId); } catch (e) { return safe(e); } }
export async function regenerateFollowUpDraftAction(taskId: string) { try { return await generate(taskId, true); } catch (e) { return safe(e); } }
export async function approveFollowUpDraftAction(draftId: string) { try { const a = await auth(); const drafts = new SupabaseFollowUpDraftStore(a.supabase); const d = await drafts.findById(a.workspaceId, draftId); if (!d || d.status !== 'ready_for_review') throw new Error('Draft is not approvable'); await contextFor(a, d.followUpTaskId); const updated = await drafts.updateStatus(a.workspaceId, draftId, 'approved', a.user.id); await drafts.recordActivity(a.workspaceId, { draftId, leadId: d.leadId, companyId: d.companyId, activityType: 'follow_up_approved', effectKey: `follow_up_approved:${draftId}`, details: { version: d.version }, actorUserId: a.user.id }); revalidatePath('/follow-ups'); return { ok: true as const, draft: updated }; } catch (e) { return safe(e); } }
export async function rejectFollowUpDraftAction(draftId: string, reason?: string) { try { const a = await auth(); const drafts = new SupabaseFollowUpDraftStore(a.supabase); const d = await drafts.findById(a.workspaceId, draftId); if (!d) throw new Error('Draft not found'); const updated = await drafts.updateStatus(a.workspaceId, draftId, 'rejected', undefined, reason); await drafts.recordActivity(a.workspaceId, { draftId, leadId: d.leadId, companyId: d.companyId, activityType: 'follow_up_rejected', effectKey: `follow_up_rejected:${draftId}`, details: { version: d.version }, actorUserId: a.user.id }); revalidatePath('/follow-ups'); return { ok: true as const, draft: updated }; } catch (e) { return safe(e); } }
export async function editFollowUpDraftAction(draftId: string, subject: string, body: string) { try { const a = await auth(); const drafts = new SupabaseFollowUpDraftStore(a.supabase); const d = await drafts.findById(a.workspaceId, draftId); if (!d) throw new Error('Draft not found'); const updated = await drafts.edit(a.workspaceId, draftId, subject, body); await drafts.recordActivity(a.workspaceId, { draftId: updated.id, leadId: d.leadId, companyId: d.companyId, activityType: 'follow_up_edited', effectKey: `follow_up_edited:${updated.id}`, details: { version: updated.version, previous_version: d.version }, actorUserId: a.user.id }); revalidatePath('/follow-ups'); return { ok: true as const, draft: updated }; } catch (e) { return safe(e); } }

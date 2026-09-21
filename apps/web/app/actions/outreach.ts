'use server';

import { revalidatePath } from 'next/cache';
import { createAIProviderFromEnv, OutreachService } from '@client-engine/ai';
import { SupabaseOutreachDraftStore } from '@client-engine/database';
import { createClient } from '../../lib/supabase/server';

type ActionResult = Readonly<{ ok: boolean; error?: string }>;
async function authorized() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const { data: membership, error } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error || !membership?.workspace_id) throw new Error('No authorized workspace');
  return { supabase, user, workspaceId: String(membership.workspace_id) };
}
function safe(error: unknown): ActionResult { return { ok: false, error: error instanceof Error ? error.message : 'Unable to update outreach draft' }; }

export async function approveOutreachAction(draftId: string): Promise<ActionResult> {
  try { const { supabase, user, workspaceId } = await authorized(); const store = new SupabaseOutreachDraftStore(supabase); const draft = await store.findByGenerationKey(workspaceId, `id:${draftId}`); const row = draft ?? (await supabase.from('outreach_drafts').select('*').eq('workspace_id', workspaceId).eq('id', draftId).maybeSingle()).data; if (!row) throw new Error('Draft not found'); await store.updateStatus(workspaceId, draftId, 'approved', undefined, user.id); await store.recordActivity(workspaceId, { draftId, leadId: String((row as Record<string, unknown>).lead_id), companyId: String((row as Record<string, unknown>).company_id), activityType: 'outreach_approved', effectKey: `outreach_approved:${draftId}`, details: { version: Number((row as Record<string, unknown>).version), previous_status: (row as Record<string, unknown>).status, new_status: 'approved' }, actorUserId: user.id }); revalidatePath('/outreach'); return { ok: true }; } catch (error) { return safe(error); }
}
export async function rejectOutreachAction(draftId: string, reason?: string): Promise<ActionResult> {
  try { const { supabase, user, workspaceId } = await authorized(); const store = new SupabaseOutreachDraftStore(supabase); const { data: row } = await supabase.from('outreach_drafts').select('*').eq('workspace_id', workspaceId).eq('id', draftId).maybeSingle(); if (!row) throw new Error('Draft not found'); await store.updateStatus(workspaceId, draftId, 'rejected', reason?.trim().slice(0, 500), user.id); await store.recordActivity(workspaceId, { draftId, leadId: String(row.lead_id), companyId: String(row.company_id), activityType: 'outreach_rejected', effectKey: `outreach_rejected:${draftId}`, details: { version: Number(row.version), previous_status: row.status, new_status: 'rejected', reason: reason?.trim().slice(0, 500) ?? null }, actorUserId: user.id }); revalidatePath('/outreach'); return { ok: true }; } catch (error) { return safe(error); }
}
export async function editOutreachAction(draftId: string, subject: string, body: string): Promise<ActionResult> {
  try { const { supabase, user, workspaceId } = await authorized(); const store = new SupabaseOutreachDraftStore(supabase); const edited = await store.edit(workspaceId, draftId, subject, body, user.id); revalidatePath('/outreach'); return { ok: Boolean(edited.id) }; } catch (error) { return safe(error); }
}
export async function regenerateOutreachAction(draftId: string): Promise<ActionResult> {
  try { const { supabase, user, workspaceId } = await authorized(); const { data: row } = await supabase.from('outreach_drafts').select('*').eq('workspace_id', workspaceId).eq('id', draftId).maybeSingle(); if (!row) throw new Error('Draft not found'); const { data: lead } = await supabase.from('leads').select('id,name,role,company_id').eq('workspace_id', workspaceId).eq('id', row.lead_id).maybeSingle(); const { data: company } = await supabase.from('companies').select('id,name,domain,research_status,research_output,research_updated_at').eq('workspace_id', workspaceId).eq('id', row.company_id).maybeSingle(); if (!lead || !company?.research_output) throw new Error('Research is not available for regeneration'); const service = new OutreachService(createAIProviderFromEnv(), new SupabaseOutreachDraftStore(supabase), { record: async (ws, run) => { const persisted = Object.fromEntries(Object.entries(run as Record<string, unknown>).filter(([key]) => key !== 'durationMs')); await supabase.from('ai_runs').insert({ workspace_id:ws, ...persisted, operation:'outreach_generation' }); } }); const generated = await service.generate({ workspaceId, leadId:String(lead.id), companyId:String(company.id), lead:{ name:String(lead.name), role:lead.role ? String(lead.role) : null }, company:{ name:String(company.name), domain:String(company.domain ?? '') }, research:{ ...(company.research_output as Record<string, unknown>), status:String(company.research_status), version:String(company.research_updated_at), researchedAt:String(company.research_updated_at) } } as never, { regenerate:true }); await supabase.from('activities').upsert({ workspace_id:workspaceId, lead_id:lead.id, company_id:company.id, actor_kind:'operator', actor_user_id:user.id, activity_type:'outreach_regenerated', effect_key:`outreach_regenerated:${generated.id}`, details:{ draft_id:generated.id, version:generated.version, previous_draft_id:draftId } }, { onConflict:'workspace_id,effect_key', ignoreDuplicates:true }); revalidatePath('/outreach'); return { ok:true }; } catch (error) { return safe(error); }
}

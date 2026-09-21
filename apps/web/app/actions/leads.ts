'use server';
import { revalidatePath } from 'next/cache';
import { CompanyResearchAgent, WebsiteResearchFetcher, createAIProviderFromEnv, qualificationResultSchema } from '@client-engine/ai';
import { manualLeadInputSchema, ManualLeadSource, parseLeadCsv } from '@client-engine/integrations';
import { runDiscovery, SupabaseAIRunStore, SupabaseCompanyResearchStore, SupabaseProspectStore } from '@client-engine/database';
import { authorizeWorkspace } from '../../lib/live-crm';

const safe = (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : 'Unable to update lead' });

export async function createManualLeadAction(input: unknown) {
  try {
    const auth = await authorizeWorkspace();
    const value = manualLeadInputSchema.parse(input);
    const sourceExternalId = value.sourceExternalId ?? `manual:${value.email?.toLowerCase() ?? value.name.toLowerCase()}:${value.companyName.toLowerCase()}`;
    const result = await runDiscovery({ workspaceId: auth.workspaceId, day: new Date().toISOString().slice(0, 10), criteria: { perPage: 1 }, provider: new ManualLeadSource([{ ...value, sourceExternalId }]), store: new SupabaseProspectStore(auth.supabase), dailyLimit: 15 });
    if (result.failures.length) throw new Error(result.failures[0]?.reason ?? 'Lead creation failed');
    const bySource = await auth.supabase.from('leads').select('id').eq('workspace_id', auth.workspaceId).eq('source', 'manual').eq('source_external_id', sourceExternalId).maybeSingle();
    const byEmail = !bySource.data && value.email ? await auth.supabase.from('leads').select('id').eq('workspace_id', auth.workspaceId).eq('normalized_email', value.email.toLowerCase()).maybeSingle() : { data: null, error: null };
    const lead = bySource.data ?? byEmail.data;
    const error = bySource.error ?? byEmail.error;
    if (error || !lead) throw new Error(error?.message ?? 'Lead was not persisted');
    revalidatePath('/leads');
    return { ok: true as const, leadId: String(lead.id), duplicate: result.inserted === 0 };
  } catch (error) { return safe(error); }
}

export async function importLeadsCsvAction(csv: string) {
  try {
    const records = parseLeadCsv(csv);
    if (!records.length) throw new Error('CSV contains no lead rows');
    const results = [];
    for (const record of records) results.push(await createManualLeadAction(record));
    const failures = results.filter((result) => !result.ok);
    return failures.length ? { ok: false as const, error: `${failures.length} of ${results.length} rows failed` } : { ok: true as const, imported: results.length };
  } catch (error) { return safe(error); }
}

export async function qualifyLeadAction(leadId: string) {
  try {
    const auth = await authorizeWorkspace();
    const [{ data: lead }, { data: company }] = await Promise.all([
      auth.supabase.from('leads').select('id,name,role,email,company_id').eq('workspace_id', auth.workspaceId).eq('id', leadId).maybeSingle(),
      auth.supabase.from('companies').select('id,name,domain,industry,employee_count,research_output').eq('workspace_id', auth.workspaceId).eq('id', (await auth.supabase.from('leads').select('company_id').eq('workspace_id', auth.workspaceId).eq('id', leadId).maybeSingle()).data?.company_id ?? '').maybeSingle(),
    ]);
    if (!lead || !company) throw new Error('Lead or company not found');
    const result = await createAIProviderFromEnv().qualifyLead({ lead: { id: String(lead.id), name: String(lead.name), role: lead.role ? String(lead.role) : null, email: lead.email ? String(lead.email) : null }, company: { name: String(company.name), domain: String(company.domain ?? ''), industry: company.industry ? String(company.industry) : null, employeeCount: company.employee_count === null ? null : Number(company.employee_count), liveProduct: null, facts: [] } });
    const parsed = qualificationResultSchema.parse(result);
    const { error } = await auth.supabase.from('leads').update({ fit_score: parsed.score, fit_tier: parsed.tier === 'A' ? 'high' : parsed.tier === 'B' ? 'medium' : 'low', stage: 'qualified', updated_at: new Date().toISOString() }).eq('workspace_id', auth.workspaceId).eq('id', leadId);
    if (error) throw new Error(error.message);
    await new SupabaseAIRunStore(auth.supabase).record(auth.workspaceId, { operation: 'qualification', operationKey: `qualification:${leadId}`, leadId, companyId: String(company.id), provider: createAIProviderFromEnv().provider, model: createAIProviderFromEnv().model, promptVersion: createAIProviderFromEnv().promptVersion, input: { lead_id: leadId }, output: parsed, confidence: parsed.confidence, status: 'succeeded' });
    revalidatePath(`/leads/${leadId}`); revalidatePath('/leads');
    return { ok: true as const, score: parsed.score };
  } catch (error) { return safe(error); }
}

export async function researchCompanyAction(leadId: string) {
  try {
    const auth = await authorizeWorkspace();
    const { data: lead } = await auth.supabase.from('leads').select('id,company_id').eq('workspace_id', auth.workspaceId).eq('id', leadId).maybeSingle();
    if (!lead?.company_id) throw new Error('Lead has no company');
    const { data: company } = await auth.supabase.from('companies').select('id,name,domain').eq('workspace_id', auth.workspaceId).eq('id', lead.company_id).maybeSingle();
    if (!company?.domain) throw new Error('Company has no domain to research');
    const provider = createAIProviderFromEnv();
    const run = await new CompanyResearchAgent(provider, new WebsiteResearchFetcher(), new SupabaseCompanyResearchStore(auth.supabase), 86_400_000, new SupabaseAIRunStore(auth.supabase)).research({ workspaceId: auth.workspaceId, companyId: String(company.id), company: { name: String(company.name), domain: String(company.domain) } });
    if (run.status === 'researched') await auth.supabase.from('leads').update({ stage: 'researched', updated_at: new Date().toISOString() }).eq('workspace_id', auth.workspaceId).eq('id', leadId);
    revalidatePath(`/leads/${leadId}`); revalidatePath('/leads');
    return run.status === 'researched' ? { ok: true as const } : safe(new Error(run.error ?? 'Research needs review'));
  } catch (error) { return safe(error); }
}

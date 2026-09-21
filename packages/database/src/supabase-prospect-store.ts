import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProspectStore, CompanyUpsert, DiscoveryActivity, LeadUpsert, ProspectIdentity } from './index';

type Row = Readonly<Record<string, unknown>>;

/**
 * Server-side persistence adapter for the discovery pipeline. Construct it
 * with a trusted service-role client only; never import this adapter into a
 * browser bundle or pass it a publishable client.
 */
export class SupabaseProspectStore implements ProspectStore {
  constructor(private readonly client: SupabaseClient) {}

  async countDiscoveries(workspaceId: string, day: string): Promise<number> {
    const { count, error } = await this.client.from('activities').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('activity_type', 'lead_discovered').gte('occurred_at', `${day}T00:00:00.000Z`).lt('occurred_at', `${nextDay(day)}T00:00:00.000Z`);
    if (error) throw databaseError('count discoveries', error);
    return count ?? 0;
  }

  async tryReserveDiscoverySlot(workspaceId: string, day: string, limit: number): Promise<boolean> {
    const { data, error } = await this.client.rpc('try_reserve_discovery_slot', { p_workspace_id: workspaceId, p_discovery_day: day, p_limit: limit });
    if (error) throw databaseError('reserve discovery slot', error);
    return data === true;
  }

  async findExistingProspect(workspaceId: string, identity: ProspectIdentity): Promise<{ leadId: string; companyId: string } | null> {
    const bySource = await this.client.from('leads').select('id, company_id').eq('workspace_id', workspaceId).eq('source', identity.source).eq('source_external_id', identity.sourceExternalId).maybeSingle();
    if (bySource.error) throw databaseError('find source prospect', bySource.error);
    if (bySource.data) return rowToLeadRef(bySource.data as Row);
    if (!identity.email) return null;
    const byEmail = await this.client.from('leads').select('id, company_id').eq('workspace_id', workspaceId).eq('normalized_email', identity.email).maybeSingle();
    if (byEmail.error) throw databaseError('find email prospect', byEmail.error);
    return byEmail.data ? rowToLeadRef(byEmail.data as Row) : null;
  }

  async upsertCompany(workspaceId: string, company: CompanyUpsert): Promise<{ id: string }> {
    if (company.domain) {
      const result = await this.client.from('companies').upsert({ workspace_id: workspaceId, name: company.name, domain: company.domain, website: company.website, industry: company.industry, employee_count: company.employeeCount, linkedin_url: company.linkedinUrl }, { onConflict: 'workspace_id,normalized_domain' }).select('id').single();
      if (result.error) throw databaseError('upsert company', result.error);
      return { id: String((result.data as Row).id) };
    }
    const result = await this.client.from('companies').insert({ workspace_id: workspaceId, name: company.name, domain: company.domain, website: company.website, industry: company.industry, employee_count: company.employeeCount, linkedin_url: company.linkedinUrl }).select('id').single();
    if (result.error) throw databaseError('upsert company', result.error);
    return { id: String((result.data as Row).id) };
  }

  async upsertLead(workspaceId: string, lead: LeadUpsert): Promise<{ id: string; created: boolean }> {
    const existing = await this.client.from('leads').select('id').eq('workspace_id', workspaceId).eq('source', lead.source).eq('source_external_id', lead.sourceExternalId).maybeSingle();
    if (existing.error) throw databaseError('find lead', existing.error);
    const result = await this.client.from('leads').upsert({ workspace_id: workspaceId, company_id: lead.companyId, name: lead.name, email: lead.email, role: lead.role, linkedin_url: lead.linkedinUrl, source: lead.source, source_external_id: lead.sourceExternalId }, { onConflict: 'workspace_id,source,source_external_id' }).select('id').single();
    if (result.error) throw databaseError('upsert lead', result.error);
    return { id: String((result.data as Row).id), created: !existing.data };
  }

  async recordLeadDiscovered(workspaceId: string, activity: DiscoveryActivity): Promise<void> {
    const { error } = await this.client.from('activities').upsert({ workspace_id: workspaceId, lead_id: activity.leadId, company_id: activity.companyId, actor_kind: 'system', activity_type: 'lead_discovered', effect_key: activity.effectKey, details: activity.details }, { onConflict: 'workspace_id,effect_key', ignoreDuplicates: true });
    if (error) throw databaseError('record lead discovery', error);
  }
}

function rowToLeadRef(row: Row): { leadId: string; companyId: string } {
  if (typeof row.id !== 'string' || typeof row.company_id !== 'string') throw new Error('Database returned an invalid lead reference.');
  return { leadId: row.id, companyId: row.company_id };
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Discovery day must be an ISO date.');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function databaseError(operation: string, error: { message: string }): Error {
  return new Error(`Unable to ${operation}: ${error.message}`);
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from './supabase/server';

export type LiveLead = Readonly<{
  id: string;
  name: string;
  role: string;
  company: string;
  companyDomain: string;
  email: string;
  initials: string;
  stage: 'new' | 'qualified' | 'ready' | 'contacted' | 'replied' | 'meeting' | 'proposal' | 'won';
  score: number;
  source: string;
  lastActivity: string;
  nextAction: string;
  companyId: string;
}>;

export type WorkspaceAuth = Readonly<{ supabase: SupabaseClient; userId: string; workspaceId: string }>;

export async function authorizeWorkspace(): Promise<WorkspaceAuth> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const { data: membership, error } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(`Unable to resolve workspace: ${error.message}`);
  if (!membership?.workspace_id) throw new Error('No authorized workspace');
  return { supabase, userId: user.id, workspaceId: String(membership.workspace_id) };
}

export async function loadWorkspaceLeads(auth: WorkspaceAuth): Promise<readonly LiveLead[]> {
  const { data, error } = await auth.supabase.from('leads').select('id,name,role,email,source,stage,fit_score,company_id,created_at,updated_at,companies(name,domain)').eq('workspace_id', auth.workspaceId).order('created_at', { ascending: false });
  if (error) throw new Error(`Unable to load leads: ${error.message}`);
  return (data ?? []).map((row) => mapLead(row as Record<string, unknown>));
}

export async function loadWorkspaceLead(auth: WorkspaceAuth, id: string): Promise<LiveLead | null> {
  const { data, error } = await auth.supabase.from('leads').select('id,name,role,email,source,stage,fit_score,company_id,created_at,updated_at,companies(name,domain)').eq('workspace_id', auth.workspaceId).eq('id', id).maybeSingle();
  if (error) throw new Error(`Unable to load lead: ${error.message}`);
  return data ? mapLead(data as Record<string, unknown>) : null;
}

export function mapLead(row: Record<string, unknown>): LiveLead {
  const company = Array.isArray(row.companies) ? row.companies[0] as Record<string, unknown> | undefined : row.companies as Record<string, unknown> | null;
  const stage = String(row.stage);
  const mappedStage = stage === 'discovered' || stage === 'enriched' ? 'new' : stage === 'researched' ? 'qualified' : stage === 'interested' ? 'replied' : stage === 'proposal' ? 'proposal' : stage === 'won' ? 'won' : stage as LiveLead['stage'];
  const name = String(row.name ?? 'Unnamed lead');
  return { id: String(row.id), name, role: row.role ? String(row.role) : 'Contact', company: String(company?.name ?? 'Unlinked company'), companyDomain: String(company?.domain ?? ''), email: row.email ? String(row.email) : 'No email', initials: name.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase(), stage: mappedStage, score: Number(row.fit_score ?? 0), source: String(row.source ?? 'manual'), lastActivity: formatActivity(row.updated_at ?? row.created_at), nextAction: nextAction(mappedStage), companyId: String(row.company_id ?? '') };
}

function formatActivity(value: unknown): string { if (!value) return 'No activity'; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString(); }
function nextAction(stage: LiveLead['stage']): string { return ({ new: 'Qualify lead', qualified: 'Research company', ready: 'Review outreach draft', contacted: 'Wait for reply', replied: 'Classify reply', meeting: 'Prepare meeting brief', proposal: 'Review proposal', won: 'Schedule kickoff' } satisfies Record<LiveLead['stage'], string>)[stage]; }

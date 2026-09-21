import Link from 'next/link';
import { createClient } from '../lib/supabase/server';

export async function LiveProposalSummary({ leadId }: Readonly<{ leadId: string }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!member?.workspace_id) return null;
  const { data: proposal } = await supabase.from('proposals').select('id,title,version,status,pricing,created_at,approved_at').eq('workspace_id', member.workspace_id).eq('lead_id', leadId).order('version', { ascending: false }).limit(1).maybeSingle();
  if (!proposal) return null;
  const pricing = proposal.pricing as Record<string, unknown>;
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Proposal</p><p className="mt-2 text-sm font-semibold text-slate-900">{proposal.title} · v{proposal.version}</p><p className="mt-1 text-xs text-slate-600">{proposal.status} · {String(pricing.mode ?? 'UNPRICED')} · generated {new Date(String(proposal.created_at)).toLocaleString()}</p>{proposal.approved_at && <p className="mt-1 text-xs text-emerald-700">Approved {new Date(String(proposal.approved_at)).toLocaleString()}</p>}<Link className="mt-3 inline-block text-xs font-semibold text-blue-700" href={`/proposals/${proposal.id}`}>View full proposal</Link></section>;
}

begin;
alter table public.ai_runs drop constraint if exists ai_runs_operation_check;
alter table public.ai_runs add constraint ai_runs_operation_check check (operation in ('qualification','company_research','outreach_generation','outreach_draft','reply_classification','meeting_brief','proposal_draft'));
create table public.outreach_drafts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 lead_id uuid not null references public.leads(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, campaign_id uuid references public.campaigns(id) on delete set null, generation_key text not null,
 research_version text not null, version integer not null check (version > 0), subject text not null, body text not null,
 personalization_source_type text not null check (personalization_source_type in ('verified_signal','personalization_angle','none')),
 personalization_source_url text, service_match text, portfolio_match text, confidence numeric(5,4) not null check (confidence between 0 and 1),
 warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'), provider text not null, model text not null, prompt_version text not null,
 status text not null check (status in ('draft','ready_for_review','approved','rejected')), rejection_reason text, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id, generation_key), unique(workspace_id, lead_id, research_version, version)
);
create index outreach_drafts_review_idx on public.outreach_drafts(workspace_id, status, created_at desc);
create index outreach_drafts_lead_idx on public.outreach_drafts(workspace_id, lead_id, version desc);
alter table public.outreach_drafts enable row level security;
commit;

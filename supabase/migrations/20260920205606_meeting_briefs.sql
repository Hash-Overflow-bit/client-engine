begin;
alter table public.ai_runs drop constraint if exists ai_runs_operation_check;
alter table public.ai_runs add constraint ai_runs_operation_check check(operation in ('qualification','company_research','outreach_generation','outreach_draft','follow_up_generation','reply_classification','meeting_brief_generation','meeting_brief','proposal_draft'));
alter table public.ai_runs add column if not exists meeting_id uuid;
alter table public.ai_runs add constraint ai_runs_meeting_fk foreign key(workspace_id,meeting_id) references public.meetings(workspace_id,id);
create table public.meeting_briefs(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),meeting_id uuid not null,lead_id uuid not null,company_id uuid,conversation_id uuid not null,version integer not null check(version>0),generation_key text not null,
 company_summary text not null,contact_summary text not null,conversation_summary text not null,interest_summary text not null,why_we_contacted text not null,prospect_needs jsonb not null default '[]',relevant_service text,relevant_portfolio text,verified_facts jsonb not null default '[]',assumptions jsonb not null default '[]',unknowns jsonb not null default '[]',discovery_questions jsonb not null default '[]',suggested_call_structure jsonb not null default '[]',confidence numeric(5,4) not null check(confidence between 0 and 1),needs_review boolean not null default false,warnings jsonb not null default '[]',provider text not null,model text not null,prompt_version text not null,context_version text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,id),unique(workspace_id,generation_key),unique(workspace_id,meeting_id,version),foreign key(workspace_id,meeting_id) references public.meetings(workspace_id,id),foreign key(workspace_id,lead_id) references public.leads(workspace_id,id),foreign key(workspace_id,company_id) references public.companies(workspace_id,id),foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id)
);
create index meeting_briefs_meeting_idx on public.meeting_briefs(workspace_id,meeting_id,version desc);
alter table public.meeting_briefs enable row level security;
create policy meeting_briefs_read_member on public.meeting_briefs for select to authenticated using(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy meeting_briefs_insert_member on public.meeting_briefs for insert to authenticated with check(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
grant select,insert on public.meeting_briefs to authenticated;
commit;

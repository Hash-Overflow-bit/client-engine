begin;
alter table public.ai_runs drop constraint if exists ai_runs_operation_check;
alter table public.ai_runs add constraint ai_runs_operation_check check (operation in ('qualification','company_research','outreach_generation','outreach_draft','follow_up_generation','reply_classification','meeting_brief','proposal_draft'));
alter table public.ai_runs add column if not exists conversation_id uuid;
alter table public.ai_runs add column if not exists follow_up_task_id uuid;
alter table public.ai_runs add column if not exists sequence_step integer;
alter table public.ai_runs add column if not exists purpose text;
alter table public.ai_runs add column if not exists duration_ms integer;
alter table public.ai_runs add constraint ai_runs_follow_up_task_fk foreign key(workspace_id,follow_up_task_id) references public.follow_up_tasks(workspace_id,id);
alter table public.ai_runs add constraint ai_runs_follow_up_conversation_fk foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id);
create table public.follow_up_drafts(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), follow_up_task_id uuid not null, lead_id uuid not null, company_id uuid, conversation_id uuid not null, original_delivery_id uuid not null, sequence_step integer not null check(sequence_step between 1 and 3), purpose text not null check(purpose in('VALUE_FOLLOW_UP','SECOND_TOUCH','CLOSE_LOOP')), generation_key text not null, context_version text not null, version integer not null check(version>0), subject text not null check(length(btrim(subject)) between 1 and 120), body text not null check(length(btrim(body)) between 1 and 1500), status text not null check(status in('draft','ready_for_review','approved','rejected')), confidence numeric(5,4) not null check(confidence between 0 and 1), needs_review boolean not null default false, warnings jsonb not null default '[]', evidence_refs jsonb not null default '[]', conversation_refs jsonb not null default '[]', service_match text, portfolio_match text, provider text not null, model text not null, prompt_version text not null, approved_at timestamptz, approved_by uuid references auth.users(id), rejected_at timestamptz, rejection_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,generation_key), unique(workspace_id,follow_up_task_id,version), foreign key(workspace_id,follow_up_task_id) references public.follow_up_tasks(workspace_id,id), foreign key(workspace_id,lead_id) references public.leads(workspace_id,id), foreign key(workspace_id,company_id) references public.companies(workspace_id,id), foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id), foreign key(workspace_id,original_delivery_id) references public.delivery_records(workspace_id,id), check(status<>'approved' or(approved_at is not null and approved_by is not null)), check(status<>'rejected' or rejected_at is not null)
);
create index follow_up_drafts_task_idx on public.follow_up_drafts(workspace_id,follow_up_task_id,version desc);
create index follow_up_drafts_review_idx on public.follow_up_drafts(workspace_id,status,created_at desc);
create or replace function public.guard_follow_up_draft_context() returns trigger language plpgsql security invoker as $$
begin
  if not exists (select 1 from public.follow_up_tasks t where t.workspace_id = new.workspace_id and t.id = new.follow_up_task_id and t.status = 'due') then
    raise exception 'follow-up task is not due';
  end if;
  if exists (select 1 from public.leads l where l.workspace_id = new.workspace_id and l.id = new.lead_id and l.do_not_contact = true) then
    raise exception 'lead is suppressed';
  end if;
  if exists (select 1 from public.messages m where m.workspace_id = new.workspace_id and m.conversation_id = new.conversation_id and m.direction = 'inbound') then
    raise exception 'conversation has an inbound reply';
  end if;
  return new;
end; $$;
create trigger follow_up_drafts_context_guard before insert on public.follow_up_drafts for each row execute function public.guard_follow_up_draft_context();
alter table public.follow_up_drafts enable row level security;
create policy follow_up_drafts_read on public.follow_up_drafts for select to authenticated using(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy follow_up_drafts_insert on public.follow_up_drafts for insert to authenticated with check(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy follow_up_drafts_update on public.follow_up_drafts for update to authenticated using(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid()))) with check(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
grant select,insert,update on public.follow_up_drafts to authenticated;
create policy ai_runs_follow_up_insert on public.ai_runs for insert to authenticated with check(operation='follow_up_generation' and workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
grant insert on public.ai_runs to authenticated;
commit;

begin;
create table public.delivery_records (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 lead_id uuid not null, company_id uuid not null, outreach_draft_id uuid not null, draft_version integer not null check (draft_version > 0), campaign_id uuid,
 channel text not null check (channel in ('email')), provider text not null check (provider = 'manual'), provider_message_id text, provider_thread_id text,
 recipient text not null check (length(btrim(recipient)) between 3 and 320), subject text not null check (length(btrim(subject)) between 1 and 120), body text not null check (length(btrim(body)) between 1 and 1500),
 status text not null default 'prepared' check (status in ('prepared','draft_created','sent','failed','cancelled')), prepared_at timestamptz not null default now(), sent_at timestamptz, sent_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,lead_id,outreach_draft_id,draft_version,channel),
 foreign key (workspace_id,lead_id) references public.leads(workspace_id,id) on delete restrict, foreign key (workspace_id,company_id) references public.companies(workspace_id,id) on delete restrict, foreign key (workspace_id,outreach_draft_id) references public.outreach_drafts(workspace_id,id) on delete restrict, foreign key (workspace_id,campaign_id) references public.campaigns(workspace_id,id) on delete restrict,
 check ((status = 'sent') = (sent_at is not null and sent_by is not null))
);
create index delivery_records_status_idx on public.delivery_records(workspace_id,status,created_at desc);
create index delivery_records_lead_idx on public.delivery_records(workspace_id,lead_id,created_at desc);
alter table public.delivery_records enable row level security;
create policy delivery_read_member on public.delivery_records for select to authenticated using (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy delivery_insert_member on public.delivery_records for insert to authenticated with check (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy delivery_update_member on public.delivery_records for update to authenticated using (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid()))) with check (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid())));
grant select,insert,update on public.delivery_records to authenticated;
commit;

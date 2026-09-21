begin;
create table public.conversations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict, lead_id uuid not null, campaign_id uuid, delivery_id uuid, channel text not null default 'email' check (channel='email'), provider text not null default 'manual', provider_thread_id text, status text not null default 'open' check (status in ('open','replied','closed')), replied_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,lead_id,channel), foreign key(workspace_id,lead_id) references public.leads(workspace_id,id) on delete restrict, foreign key(workspace_id,campaign_id) references public.campaigns(workspace_id,id) on delete restrict, foreign key(delivery_id) references public.delivery_records(id) on delete set null
);
alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete restrict;
alter table public.messages add column if not exists raw_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_metadata)='object');
create index conversations_lead_idx on public.conversations(workspace_id,lead_id,updated_at desc);
create index messages_conversation_idx on public.messages(workspace_id,conversation_id,created_at);
alter table public.conversations enable row level security;
create policy conversations_read_member on public.conversations for select to authenticated using (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy conversations_insert_member on public.conversations for insert to authenticated with check (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy conversations_update_member on public.conversations for update to authenticated using (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid()))) with check (workspace_id in (select workspace_id from public.workspace_members where user_id=(select auth.uid())));
grant select,insert,update on public.conversations to authenticated;
grant select,insert,update on public.messages to authenticated;
commit;

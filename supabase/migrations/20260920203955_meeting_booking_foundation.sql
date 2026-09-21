begin;
create table public.workspace_meeting_settings (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 booking_provider text not null default 'manual' check(booking_provider in ('manual','calendly')),
 booking_url text,
 default_meeting_duration integer not null default 15 check(default_meeting_duration between 5 and 240),
 default_timezone text not null default 'UTC' check(length(btrim(default_timezone)) between 1 and 80),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.workspace_meeting_settings enable row level security;
create policy workspace_meeting_settings_member_read on public.workspace_meeting_settings for select to authenticated using(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy workspace_meeting_settings_member_write on public.workspace_meeting_settings for all to authenticated using(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid()))) with check(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
grant select,insert,update on public.workspace_meeting_settings to authenticated;

alter table public.meetings alter column connection_key drop not null;
alter table public.meetings alter column external_meeting_id drop not null;
alter table public.meetings add column conversation_id uuid;
alter table public.meetings add column company_id uuid;
alter table public.meetings add column title text not null default 'Discovery call';
alter table public.meetings add column timezone text not null default 'UTC';
alter table public.meetings add column meeting_url text;
alter table public.meetings add column notes text;
alter table public.meetings add column booked_at timestamptz;
alter table public.meetings add column created_by uuid references auth.users(id) on delete set null;
alter table public.meetings add column idempotency_key text;
alter table public.meetings add constraint meetings_conversation_fk foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id) on delete restrict;
alter table public.meetings add constraint meetings_company_fk foreign key(workspace_id,company_id) references public.companies(workspace_id,id) on delete restrict;
create unique index meetings_manual_idempotency_unique on public.meetings(workspace_id,idempotency_key) where idempotency_key is not null;
create index meetings_conversation_idx on public.meetings(workspace_id,conversation_id,starts_at desc);
alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings add constraint meetings_status_check check(status in ('scheduled','completed','cancelled','no_show','canceled','rescheduled'));

alter table public.follow_up_tasks drop constraint if exists follow_up_tasks_cancellation_reason_check;
alter table public.follow_up_tasks add constraint follow_up_tasks_cancellation_reason_check check(cancellation_reason is null or cancellation_reason in ('INBOUND_REPLY','DO_NOT_CONTACT','UNSUBSCRIBED','DELIVERY_NOT_SENT','INVALID_LEAD_STATE','WORKSPACE_MISMATCH','CAMPAIGN_STOPPED','OUTBOUND_DISABLED','MANUAL_CANCEL','MANUAL_SKIP','RESCHEDULED','MEETING_BOOKED','OTHER'));
commit;

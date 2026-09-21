-- Milestone 2: persistence only. No provider calls, dispatch jobs or production activation.
-- Auth users and Supabase roles are platform-owned; never recreate them in migrations.
begin;

create type public.lead_stage as enum (
  'discovered', 'enriched', 'qualified', 'researched', 'ready', 'contacted',
  'replied', 'interested', 'meeting', 'proposal', 'won'
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  reporting_timezone text not null default 'UTC',
  sending_enabled boolean not null default false,
  daily_new_contact_limit integer not null default 10 check (daily_new_contact_limit between 0 and 1000),
  daily_message_limit integer not null default 20 check (daily_message_limit between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (daily_new_contact_limit <= daily_message_limit)
);
create index workspaces_owner_idx on public.workspaces(owner_user_id);

-- Trusted server provisions workspace + owner membership together in one transaction.
-- Clients never receive membership mutation grants, including self-enrollment.
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null default 'operator' check (role in ('owner', 'operator')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

-- Structural evidence validation only; source authenticity and claim support need review.
create function public.valid_research_sources(sources jsonb)
returns boolean language sql immutable security invoker set search_path = ''
as $$
  select case when jsonb_typeof(sources) <> 'array' then false else not exists (
    select 1 from jsonb_array_elements(sources) source
    where jsonb_typeof(source) <> 'object'
       or jsonb_typeof(source -> 'url') is distinct from 'string'
       or coalesce(source ->> 'url', '') !~ '^https?://[^[:space:]]+$'
       or jsonb_typeof(source -> 'excerpt') is distinct from 'string'
       or length(btrim(coalesce(source ->> 'excerpt', ''))) = 0
       or jsonb_typeof(source -> 'retrieved_at') is distinct from 'string'
       or length(btrim(coalesce(source ->> 'retrieved_at', ''))) = 0
  ) end;
$$;
revoke all on function public.valid_research_sources(jsonb) from public, anon, authenticated;
grant execute on function public.valid_research_sources(jsonb) to authenticated, service_role;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 240),
  domain text,
  normalized_domain text generated always as (lower(btrim(domain))) stored,
  website text,
  industry text,
  employee_count integer check (employee_count >= 0),
  linkedin_url text,
  research_summary text,
  research_sources jsonb not null default '[]'::jsonb,
  researched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, normalized_domain),
  check (domain is null or (length(btrim(domain)) between 1 and 253 and btrim(domain) !~ '[[:space:]/:@]')),
  check (public.valid_research_sources(research_sources)),
  check (research_summary is null or (jsonb_array_length(research_sources) > 0 and researched_at is not null))
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  company_id uuid,
  name text not null check (length(btrim(name)) between 1 and 240),
  email text,
  normalized_email text generated always as (lower(btrim(email))) stored,
  role text,
  linkedin_url text,
  source text not null default 'manual' check (length(btrim(source)) between 1 and 80),
  source_external_id text check (source_external_id is null or length(btrim(source_external_id)) > 0),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  fit_score numeric(5,2) check (fit_score between 0 and 100),
  fit_tier text check (fit_tier in ('high', 'medium', 'low', 'unknown')),
  stage public.lead_stage not null default 'discovered',
  do_not_contact boolean not null default false,
  email_verified_at timestamptz,
  replied_at timestamptz,
  booked_at timestamptz,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, normalized_email),
  unique (workspace_id, source, source_external_id),
  foreign key (workspace_id, company_id) references public.companies(workspace_id, id) on delete restrict,
  check (email is null or (length(btrim(email)) between 3 and 320 and btrim(email) ~ '^[^[:space:]@]+@[^[:space:]@]+$')),
  check (not (do_not_contact or replied_at is not null or booked_at is not null) or next_follow_up_at is null)
);
create index leads_company_idx on public.leads(workspace_id, company_id);
create index leads_stage_idx on public.leads(workspace_id, stage, created_at);
create index leads_follow_up_idx on public.leads(workspace_id, next_follow_up_at)
  where next_follow_up_at is not null and not do_not_contact and replied_at is null and booked_at is null;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 240),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  sending_enabled boolean not null default false,
  approval_mode text not null default 'human' check (approval_mode = 'human'),
  policy_version integer not null default 1 check (policy_version > 0),
  icp jsonb not null default '{}'::jsonb check (jsonb_typeof(icp) = 'object'),
  policy jsonb not null default '{}'::jsonb check (jsonb_typeof(policy) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  provider text not null check (length(btrim(provider)) between 1 and 80 and provider = lower(btrim(provider))),
  connection_key text not null check (length(btrim(connection_key)) between 1 and 240),
  external_event_id text not null check (length(btrim(external_event_id)) between 1 and 500),
  event_type text not null check (length(btrim(event_type)) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed', 'quarantined')),
  attempts integer not null default 0 check (attempts >= 0),
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, provider, connection_key, external_event_id),
  check ((status = 'processed') = (processed_at is not null)),
  check ((status = 'processing') = (lease_expires_at is not null))
);
create index integration_events_pending_idx on public.integration_events(workspace_id, next_attempt_at, received_at)
  where status in ('pending', 'failed');
create index integration_events_lease_idx on public.integration_events(lease_expires_at) where status = 'processing';

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  lead_id uuid,
  company_id uuid,
  campaign_id uuid,
  operation text not null check (operation in ('qualification', 'company_research', 'outreach_draft', 'reply_classification', 'meeting_brief', 'proposal_draft')),
  model text not null check (length(btrim(model)) > 0),
  prompt_version text not null check (length(btrim(prompt_version)) > 0),
  operation_key text not null check (length(btrim(operation_key)) > 0),
  provider_request_id text,
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  output jsonb check (output is null or jsonb_typeof(output) = 'object'),
  evidence jsonb not null default '[]'::jsonb check (public.valid_research_sources(evidence)),
  confidence numeric(5,4) check (confidence between 0 and 1),
  cost numeric(18,8) check (cost >= 0),
  cost_currency text not null default 'USD' check (cost_currency ~ '^[A-Z]{3}$'),
  cost_kind text check (cost_kind in ('estimated', 'reported')),
  input_tokens bigint check (input_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'invalid')),
  error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, operation_key),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete restrict,
  foreign key (workspace_id, company_id) references public.companies(workspace_id, id) on delete restrict,
  foreign key (workspace_id, campaign_id) references public.campaigns(workspace_id, id) on delete restrict,
  check (lead_id is not null or company_id is not null),
  check ((cost is null) = (cost_kind is null)),
  check (status <> 'succeeded' or (output is not null and completed_at is not null))
);
create index ai_runs_lead_idx on public.ai_runs(workspace_id, lead_id, created_at);
create index ai_runs_company_idx on public.ai_runs(workspace_id, company_id);
create index ai_runs_campaign_idx on public.ai_runs(workspace_id, campaign_id, operation, prompt_version);

-- Each row is one content revision. Approved content is immutable; create a new row to edit.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  lead_id uuid not null,
  campaign_id uuid,
  ai_run_id uuid,
  integration_event_id uuid,
  draft_id uuid not null default gen_random_uuid(),
  revision integer not null default 1 check (revision > 0),
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null check (message_type in ('initial', 'follow_up', 'reply', 'manual')),
  sequence_step integer check (sequence_step between 0 and 2),
  recipient_email text not null check (recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  sender_email text check (sender_email is null or sender_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  subject text not null default '',
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'queued', 'sending', 'accepted', 'delivered', 'failed', 'unknown', 'canceled', 'received')),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  provider text,
  connection_key text,
  provider_message_id text,
  provider_thread_id text,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  approved_policy_version integer check (approved_policy_version > 0),
  scheduled_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  received_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, draft_id, revision),
  unique (workspace_id, idempotency_key),
  unique (workspace_id, provider, connection_key, provider_message_id),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete restrict,
  foreign key (workspace_id, campaign_id) references public.campaigns(workspace_id, id) on delete restrict,
  foreign key (workspace_id, ai_run_id) references public.ai_runs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, integration_event_id) references public.integration_events(workspace_id, id) on delete restrict,
  check ((direction = 'inbound' and message_type = 'reply' and status = 'received' and received_at is not null and approved_at is null)
      or (direction = 'outbound' and message_type <> 'reply' and status <> 'received')),
  check ((message_type = 'initial' and sequence_step is not null and sequence_step = 0) or (message_type = 'follow_up' and sequence_step is not null and sequence_step in (1, 2))
      or (message_type in ('reply', 'manual') and sequence_step is null)),
  check (message_type not in ('initial', 'follow_up') or campaign_id is not null),
  check ((approved_at is null and approved_by is null and approved_policy_version is null)
      or (approved_at is not null and approved_by is not null and approved_policy_version is not null and provider is not null and connection_key is not null)),
  check (direction <> 'outbound' or status not in ('approved', 'queued', 'sending', 'accepted', 'delivered', 'unknown') or approved_at is not null),
  check (provider_message_id is null or (provider is not null and connection_key is not null)),
  check (status not in ('accepted', 'delivered') or accepted_at is not null),
  check (status <> 'delivered' or delivered_at is not null)
);
create index messages_lead_idx on public.messages(workspace_id, lead_id, created_at);
create index messages_campaign_idx on public.messages(workspace_id, campaign_id);
create index messages_ai_run_idx on public.messages(workspace_id, ai_run_id);
create index messages_event_idx on public.messages(workspace_id, integration_event_id);
create index messages_approver_idx on public.messages(approved_by);
create index messages_due_idx on public.messages(workspace_id, scheduled_at) where status = 'queued';
create unique index messages_one_live_revision_idx on public.messages(workspace_id, draft_id)
  where direction = 'outbound' and status in ('approved', 'queued', 'sending', 'accepted', 'delivered', 'unknown');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  lead_id uuid not null,
  campaign_id uuid,
  integration_event_id uuid,
  brief_ai_run_id uuid,
  provider text not null check (length(btrim(provider)) > 0),
  connection_key text not null check (length(btrim(connection_key)) > 0),
  external_meeting_id text not null check (length(btrim(external_meeting_id)) > 0),
  calendar_event_id text,
  rescheduled_from_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'canceled', 'rescheduled')),
  attendance text not null default 'unknown' check (attendance in ('unknown', 'attended', 'no_show')),
  booking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, provider, connection_key, external_meeting_id),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete restrict,
  foreign key (workspace_id, campaign_id) references public.campaigns(workspace_id, id) on delete restrict,
  foreign key (workspace_id, integration_event_id) references public.integration_events(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brief_ai_run_id) references public.ai_runs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, rescheduled_from_id) references public.meetings(workspace_id, id) on delete restrict,
  check (ends_at > starts_at),
  check (rescheduled_from_id is null or rescheduled_from_id <> id)
);
create index meetings_lead_idx on public.meetings(workspace_id, lead_id);
create index meetings_campaign_idx on public.meetings(workspace_id, campaign_id);
create index meetings_event_idx on public.meetings(workspace_id, integration_event_id);
create index meetings_brief_idx on public.meetings(workspace_id, brief_ai_run_id);
create index meetings_rescheduled_idx on public.meetings(workspace_id, rescheduled_from_id);
create index meetings_schedule_idx on public.meetings(workspace_id, starts_at) where status = 'scheduled';

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  company_id uuid not null,
  lead_id uuid,
  campaign_id uuid,
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'open' check (status in ('open', 'proposal', 'won', 'lost')),
  value numeric(18,2) check (value >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  proposal_version integer check (proposal_version > 0),
  proposal_sent_at timestamptz,
  won_at timestamptz,
  won_confirmed_by uuid references auth.users(id) on delete restrict,
  payment_evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id) references public.companies(workspace_id, id) on delete restrict,
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete restrict,
  foreign key (workspace_id, campaign_id) references public.campaigns(workspace_id, id) on delete restrict,
  check (status <> 'proposal' or (proposal_version is not null and proposal_sent_at is not null)),
  check ((status = 'won') = (won_at is not null)),
  check (status <> 'won' or (won_confirmed_by is not null and payment_evidence_reference is not null and length(btrim(payment_evidence_reference)) > 0))
);
create index deals_company_idx on public.deals(workspace_id, company_id, won_at);
create index deals_lead_idx on public.deals(workspace_id, lead_id);
create index deals_campaign_idx on public.deals(workspace_id, campaign_id);
create index deals_confirmer_idx on public.deals(won_confirmed_by);

-- Not linked to leads: deleting/reimporting a contact cannot remove its suppression.
create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  email text not null check (btrim(email) ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  normalized_email text generated always as (lower(btrim(email))) stored,
  reason text not null check (reason in ('unsubscribe', 'hard_bounce', 'manual', 'complaint')),
  source text not null check (length(btrim(source)) > 0),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, normalized_email)
);
create index suppression_list_actor_idx on public.suppression_list(created_by);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  lead_id uuid,
  company_id uuid,
  campaign_id uuid,
  message_id uuid,
  meeting_id uuid,
  deal_id uuid,
  ai_run_id uuid,
  integration_event_id uuid,
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('operator', 'system', 'provider')),
  activity_type text not null check (length(btrim(activity_type)) > 0),
  from_stage public.lead_stage,
  to_stage public.lead_stage,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  effect_key text not null check (length(btrim(effect_key)) > 0),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, effect_key),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete restrict,
  foreign key (workspace_id, company_id) references public.companies(workspace_id, id) on delete restrict,
  foreign key (workspace_id, campaign_id) references public.campaigns(workspace_id, id) on delete restrict,
  foreign key (workspace_id, message_id) references public.messages(workspace_id, id) on delete restrict,
  foreign key (workspace_id, meeting_id) references public.meetings(workspace_id, id) on delete restrict,
  foreign key (workspace_id, deal_id) references public.deals(workspace_id, id) on delete restrict,
  foreign key (workspace_id, ai_run_id) references public.ai_runs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, integration_event_id) references public.integration_events(workspace_id, id) on delete restrict,
  check (actor_kind <> 'operator' or actor_user_id is not null),
  check (activity_type <> 'stage_changed' or (lead_id is not null and to_stage is not null))
);
create index activities_lead_idx on public.activities(workspace_id, lead_id, occurred_at);
create index activities_company_idx on public.activities(workspace_id, company_id);
create index activities_campaign_idx on public.activities(workspace_id, campaign_id);
create index activities_message_idx on public.activities(workspace_id, message_id);
create index activities_meeting_idx on public.activities(workspace_id, meeting_id);
create index activities_deal_idx on public.activities(workspace_id, deal_id);
create index activities_ai_run_idx on public.activities(workspace_id, ai_run_id);
create index activities_event_idx on public.activities(workspace_id, integration_event_id);
create index activities_actor_idx on public.activities(actor_user_id);

-- All trigger functions use invoker privileges and fixed search paths.
create function public.protect_record_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id then
    raise exception 'Record identity and workspace are immutable' using errcode = '23514';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create function public.protect_lead_stops()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.do_not_contact := old.do_not_contact or new.do_not_contact;
    new.replied_at := coalesce(old.replied_at, new.replied_at);
    new.booked_at := coalesce(old.booked_at, new.booked_at);
    -- Address changes do not carry old verification or approval eligibility.
    if lower(btrim(new.email)) is distinct from lower(btrim(old.email)) then
      new.email_verified_at := null;
    end if;
  end if;
  if exists (select 1 from public.suppression_list s
             where s.workspace_id = new.workspace_id and s.normalized_email = lower(btrim(new.email))) then
    new.do_not_contact := true;
  end if;
  if new.do_not_contact or new.replied_at is not null or new.booked_at is not null then
    new.next_follow_up_at := null;
  end if;
  return new;
end;
$$;

create function public.cancel_stopped_messages()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.do_not_contact and new.email is not null then
    insert into public.suppression_list(workspace_id, email, reason, source)
    values (new.workspace_id, new.email, 'manual', 'lead_do_not_contact')
    on conflict (workspace_id, normalized_email) do nothing;
  end if;
  if new.do_not_contact or new.replied_at is not null or new.booked_at is not null then
    update public.messages set status = 'canceled'
    where workspace_id = new.workspace_id and lead_id = new.id
      and direction = 'outbound' and message_type in ('initial', 'follow_up')
      and status in ('draft', 'approved', 'queued');
  end if;
  return new;
end;
$$;

create function public.apply_suppression()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.leads set do_not_contact = true
  where workspace_id = new.workspace_id and normalized_email = new.normalized_email and not do_not_contact;
  return new;
end;
$$;

create function public.reject_record_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Append-only record cannot be changed or deleted' using errcode = '23514';
end;
$$;

create function public.protect_message_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.approved_at is not null and
     (to_jsonb(new) - array['status','provider_message_id','provider_thread_id','scheduled_at','accepted_at','delivered_at','error','updated_at'])
       is distinct from
     (to_jsonb(old) - array['status','provider_message_id','provider_thread_id','scheduled_at','accepted_at','delivered_at','error','updated_at']) then
    raise exception 'Approved content and approval identity are immutable; create a new revision' using errcode = '23514';
  end if;
  if new.direction = 'outbound' and new.message_type in ('initial', 'follow_up') and new.status in ('approved', 'queued', 'sending') then
    -- Serialize local authorization against stop writes to the same lead.
    perform 1 from public.leads where workspace_id = new.workspace_id and id = new.lead_id for update;
    if not exists (select 1 from public.leads l where l.workspace_id = new.workspace_id and l.id = new.lead_id
                   and not l.do_not_contact and l.replied_at is null and l.booked_at is null
                   and l.normalized_email = lower(btrim(new.recipient_email))) then
      raise exception 'Stopped or mismatched recipient is not eligible for outreach' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function public.record_inbound_stop()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.direction = 'inbound' then
    update public.leads set replied_at = coalesce(replied_at, new.received_at),
      stage = case when stage < 'replied'::public.lead_stage then 'replied'::public.lead_stage else stage end
    where workspace_id = new.workspace_id and id = new.lead_id;
  end if;
  return new;
end;
$$;

create function public.record_booking_stop()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'scheduled' then
    update public.leads set booked_at = coalesce(booked_at, new.created_at)
    where workspace_id = new.workspace_id and id = new.lead_id;
  end if;
  return new;
end;
$$;

create function public.protect_event_receipt()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if row(new.provider, new.connection_key, new.external_event_id, new.event_type, new.payload, new.received_at)
       is distinct from row(old.provider, old.connection_key, old.external_event_id, old.event_type, old.payload, old.received_at) then
    raise exception 'Event receipt is immutable' using errcode = '23514';
  end if;
  if old.status = 'processed' and (new.status <> 'processed' or new.processed_at is distinct from old.processed_at) then
    raise exception 'Processed events cannot be reopened' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger leads_stops before insert or update on public.leads for each row execute function public.protect_lead_stops();
create trigger leads_cancel_messages after insert or update on public.leads for each row execute function public.cancel_stopped_messages();
create trigger suppression_apply after insert on public.suppression_list for each row execute function public.apply_suppression();
create trigger suppression_immutable before update or delete on public.suppression_list for each row execute function public.reject_record_mutation();
create trigger activities_immutable before update or delete on public.activities for each row execute function public.reject_record_mutation();
create trigger messages_revision before insert or update on public.messages for each row execute function public.protect_message_revision();
create trigger messages_inbound_stop after insert on public.messages for each row execute function public.record_inbound_stop();
create trigger meetings_booking_stop after insert or update on public.meetings for each row execute function public.record_booking_stop();
create trigger integration_events_receipt before update on public.integration_events for each row execute function public.protect_event_receipt();

-- Explicit grants replace any platform default privileges. All browser access is read-only
-- except basic company fields. Operational mutation will use verified server services.
do $$
declare relation_name text;
begin
  foreach relation_name in array array['workspaces','workspace_members','companies','leads','campaigns','messages','activities','meetings','deals','suppression_list','integration_events','ai_runs'] loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', relation_name);
    execute format('grant select on table public.%I to authenticated', relation_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', relation_name);
    if relation_name = 'workspace_members' then
      execute 'create policy members_read_self on public.workspace_members for select to authenticated using (user_id = (select auth.uid()))';
    elsif relation_name = 'workspaces' then
      execute 'create policy workspaces_read_member on public.workspaces for select to authenticated using (id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())))';
    else
      execute format('create policy %I on public.%I for select to authenticated using (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())))', relation_name || '_read_member', relation_name);
    end if;
  end loop;
  foreach relation_name in array array['companies','leads','campaigns','messages','meetings','deals','integration_events','ai_runs'] loop
    execute format('create trigger record_identity before update on public.%I for each row execute function public.protect_record_identity()', relation_name);
  end loop;
end;
$$;
revoke update, delete on public.activities, public.suppression_list from service_role;
grant insert (workspace_id, name, domain, website, industry, employee_count, linkedin_url)
  on public.companies to authenticated;
grant update (name, domain, website, industry, employee_count, linkedin_url)
  on public.companies to authenticated;
create policy companies_insert_member on public.companies for insert to authenticated
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));
create policy companies_update_member on public.companies for update to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));

revoke all on function public.protect_record_identity(), public.protect_lead_stops(), public.cancel_stopped_messages(),
  public.apply_suppression(), public.reject_record_mutation(), public.protect_message_revision(),
  public.record_inbound_stop(), public.record_booking_stop(), public.protect_event_receipt()
  from public, anon, authenticated, service_role;

comment on table public.integration_events is 'Validated durable webhook inbox; use INSERT ON CONFLICT DO NOTHING. Not an implemented worker or exactly-once external delivery guarantee.';
comment on table public.ai_runs is 'Validated AI operation provenance. Unknown confidence, token usage and cost stay NULL. JSON must be minimized and contain no credentials.';
comment on table public.suppression_list is 'Append-only canonical email suppression; deletion/reimport of a lead must not erase it.';
comment on column public.workspaces.reporting_timezone is 'Operator-selected IANA zone before live activation; UTC is reporting-only initial default.';

commit;

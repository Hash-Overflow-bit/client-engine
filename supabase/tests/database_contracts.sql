-- Portable Postgres regression suite. Run after migrations in a disposable database.
-- Supabase provides auth.users/auth.uid/roles; embedded tests bootstrap only that boundary.
begin;

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.workspaces(id, name, owner_user_id) values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic workspace A', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'Synthetic workspace B', '00000000-0000-4000-8000-000000000002');
insert into public.workspace_members(workspace_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'owner');
insert into public.companies(id, workspace_id, name, domain) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Synthetic A', ' Example.test '),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Synthetic B', 'example.test');
insert into public.leads(id, workspace_id, company_id, name, email, source, source_external_id) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Synthetic one', ' One@example.test ', 'fixture', 'lead-1'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Synthetic two', 'two@example.test', 'fixture', 'lead-2'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Synthetic other workspace', 'one@example.test', 'fixture', 'lead-1');
insert into public.campaigns(id, workspace_id, name) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Synthetic campaign');

do $$
declare relation_name text;
begin
  foreach relation_name in array array['workspaces','workspace_members','companies','leads','campaigns','messages','activities','meetings','deals','suppression_list','integration_events','ai_runs'] loop
    assert (select relrowsecurity from pg_class where oid = ('public.' || relation_name)::regclass), 'Missing RLS: ' || relation_name;
    assert not has_table_privilege('anon', 'public.' || relation_name, 'SELECT'), 'Anonymous table grant: ' || relation_name;
  end loop;
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef), 'Unexpected SECURITY DEFINER';
  assert (select count(*) = 2 from public.leads where company_id = '20000000-0000-4000-8000-000000000001'), 'Company must have multiple contacts';
  assert (select bool_and(not sending_enabled) from public.workspaces), 'Workspace sending enabled by default';
  assert (select bool_and(not sending_enabled and approval_mode = 'human') from public.campaigns), 'Campaign sending unsafe default';
  assert enum_range(null::public.lead_stage)::text = '{discovered,enriched,qualified,researched,ready,contacted,replied,interested,meeting,proposal,won}', 'Wrong funnel';
end;
$$;

do $$
declare slot integer;
begin
  for slot in 1..15 loop
    assert public.try_reserve_discovery_slot('10000000-0000-4000-8000-000000000001', date '2026-09-19', 15), 'Discovery slot reservation failed';
  end loop;
  assert not public.try_reserve_discovery_slot('10000000-0000-4000-8000-000000000001', date '2026-09-19', 15), 'Discovery cap exceeded';
  assert (select count(*) = 15 from public.discovery_reservations where workspace_id = '10000000-0000-4000-8000-000000000001'), 'Wrong discovery reservation count';
end;
$$;

-- Deduplication is workspace-scoped; unrelated people can share one company.
do $$
begin
  begin
    insert into public.leads(workspace_id, name, email) values ('10000000-0000-4000-8000-000000000001', 'Duplicate', 'ONE@EXAMPLE.TEST');
    raise exception 'Duplicate email accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.leads(workspace_id, name, source, source_external_id) values ('10000000-0000-4000-8000-000000000001', 'Duplicate source', 'fixture', 'lead-1');
    raise exception 'Duplicate source accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.companies(workspace_id, name, domain) values ('10000000-0000-4000-8000-000000000001', 'Duplicate company', 'EXAMPLE.TEST');
    raise exception 'Duplicate domain accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.leads(workspace_id, company_id, name) values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'Wrong workspace');
    raise exception 'Cross-workspace company accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.leads set workspace_id = '10000000-0000-4000-8000-000000000002' where id = '30000000-0000-4000-8000-000000000001';
    raise exception 'Workspace reassignment accepted';
  exception when check_violation then null; end;
  begin
    update public.leads set fit_score = 101 where id = '30000000-0000-4000-8000-000000000001';
    raise exception 'Invalid fit score accepted';
  exception when check_violation then null; end;
  begin
    update public.companies set research_summary = 'Unsupported claim' where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Research without sources accepted';
  exception when check_violation then null; end;
end;
$$;

-- No RLS recursion: membership policy only reads its own user_id column.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare changed integer;
begin
  assert (select count(*) = 1 from public.workspaces), 'Cross-workspace workspace read';
  assert (select count(*) = 1 from public.workspace_members), 'Cross-workspace membership read';
  assert (select count(*) = 2 from public.leads), 'Cross-workspace lead read';
  assert (select count(*) = 1 from public.companies), 'Cross-workspace company read';
  update public.companies set name = 'Updated own company' where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics changed = row_count;
  assert changed = 1, 'Own company update denied';
  update public.companies set name = 'Unauthorized' where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  assert changed = 0, 'Cross-workspace company updated';
  insert into public.companies(workspace_id, name) values ('10000000-0000-4000-8000-000000000001', 'Permitted insert');
  begin
    insert into public.companies(workspace_id, name) values ('10000000-0000-4000-8000-000000000002', 'Unauthorized insert');
    raise exception 'Cross-workspace insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.workspace_members(workspace_id, user_id) values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001');
    raise exception 'Membership escalation accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.workspace_members set role = 'owner';
    raise exception 'Membership edit accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.leads set stage = 'won';
    raise exception 'Operational client write accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.companies set workspace_id = '10000000-0000-4000-8000-000000000002';
    raise exception 'Workspace column write accepted';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.leads;
    raise exception 'Client delete accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.leads;
    raise exception 'Anonymous read accepted';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;

-- The same external event ID can legitimately exist in another account/provider.
insert into public.integration_events(workspace_id, provider, connection_key, external_event_id, event_type, payload) values
  ('10000000-0000-4000-8000-000000000001', 'fixture', 'account-a', 'event-1', 'fixture.received', '{}'),
  ('10000000-0000-4000-8000-000000000001', 'fixture', 'account-b', 'event-1', 'fixture.received', '{}'),
  ('10000000-0000-4000-8000-000000000002', 'fixture', 'account-a', 'event-1', 'fixture.received', '{}');
insert into public.integration_events(workspace_id, provider, connection_key, external_event_id, event_type, payload)
values ('10000000-0000-4000-8000-000000000001', 'fixture', 'account-a', 'event-1', 'fixture.received', '{}')
on conflict (workspace_id, provider, connection_key, external_event_id) do nothing;
do $$ begin
  assert (select count(*) = 3 from public.integration_events), 'Event replay was not deduplicated';
  begin
    update public.integration_events set payload = '{"changed":true}' where connection_key = 'account-b';
    raise exception 'Receipt mutation accepted';
  exception when check_violation then null; end;
end; $$;
update public.integration_events set status = 'processing', lease_expires_at = now() + interval '1 minute', attempts = attempts + 1
where workspace_id = '10000000-0000-4000-8000-000000000001' and connection_key = 'account-a';
update public.integration_events set status = 'failed', lease_expires_at = null, next_attempt_at = now(), error = 'Synthetic retry'
where workspace_id = '10000000-0000-4000-8000-000000000001' and connection_key = 'account-a';
update public.integration_events set status = 'processed', processed_at = now(), next_attempt_at = null, error = null
where workspace_id = '10000000-0000-4000-8000-000000000001' and connection_key = 'account-a';
do $$ begin
  begin
    update public.integration_events set status = 'pending', processed_at = null where status = 'processed';
    raise exception 'Processed event reopened';
  exception when check_violation then null; end;
end; $$;

-- Every test uses a fictional provider/account and reserved .test email addresses.
insert into public.messages(id, workspace_id, lead_id, campaign_id, direction, message_type, sequence_step,
  recipient_email, subject, body, status, idempotency_key, provider, connection_key, approved_by, approved_at, approved_policy_version)
values ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001', 'outbound', 'follow_up', 1, 'one@example.test', 'Synthetic', 'Synthetic approved draft', 'queued',
  'send-1', 'fixture', 'account-a', '00000000-0000-4000-8000-000000000001', now(), 1);
do $$ begin
  begin
    update public.messages set body = 'Edited after approval' where id = '50000000-0000-4000-8000-000000000001';
    raise exception 'Approved body mutation accepted';
  exception when check_violation then null; end;
  begin
    update public.messages set approved_at = null, approved_by = null, approved_policy_version = null, status = 'draft' where id = '50000000-0000-4000-8000-000000000001';
    raise exception 'Approval erasure accepted';
  exception when check_violation then null; end;
end; $$;
update public.leads set next_follow_up_at = now() + interval '3 days' where id = '30000000-0000-4000-8000-000000000001';
insert into public.messages(workspace_id, lead_id, direction, message_type, recipient_email, sender_email,
  body, status, idempotency_key, received_at, provider, connection_key, provider_message_id)
values ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'inbound', 'reply', 'operator@example.test',
  'one@example.test', 'Synthetic out-of-office reply', 'received', 'inbound-1', now(), 'fixture', 'account-a', 'message-1');
do $$ begin
  assert (select replied_at is not null and next_follow_up_at is null and stage = 'replied' from public.leads where id = '30000000-0000-4000-8000-000000000001'), 'Reply failed to stop lead';
  assert (select status = 'canceled' from public.messages where id = '50000000-0000-4000-8000-000000000001'), 'Reply failed to cancel pending message';
  begin
    update public.messages set status = 'queued' where id = '50000000-0000-4000-8000-000000000001';
    raise exception 'Stopped message requeued';
  exception when check_violation then null; end;
end; $$;
update public.leads set replied_at = null, next_follow_up_at = now() where id = '30000000-0000-4000-8000-000000000001';
do $$ begin
  assert (select replied_at is not null and next_follow_up_at is null from public.leads where id = '30000000-0000-4000-8000-000000000001'), 'Import cleared reply latch';
end; $$;

insert into public.suppression_list(workspace_id, email, reason, source)
values ('10000000-0000-4000-8000-000000000001', ' TWO@EXAMPLE.TEST ', 'unsubscribe', 'fixture');
update public.leads set do_not_contact = false, next_follow_up_at = now() where id = '30000000-0000-4000-8000-000000000002';
do $$ begin
  assert (select do_not_contact and next_follow_up_at is null from public.leads where id = '30000000-0000-4000-8000-000000000002'), 'Suppression was cleared';
end; $$;
delete from public.leads where id = '30000000-0000-4000-8000-000000000002';
insert into public.leads(id, workspace_id, name, email)
values ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Reimported synthetic', 'two@example.test');
do $$ begin
  assert (select do_not_contact from public.leads where id = '30000000-0000-4000-8000-000000000002'), 'Reimport ignored durable suppression';
  begin
    delete from public.suppression_list;
    raise exception 'Suppression deletion accepted';
  exception when check_violation then null; end;
end; $$;
update public.leads set do_not_contact = true where id = '30000000-0000-4000-8000-000000000003';
do $$ begin
  assert exists (select 1 from public.suppression_list where workspace_id = '10000000-0000-4000-8000-000000000002' and normalized_email = 'one@example.test'), 'DNC did not persist suppression';
end; $$;

insert into public.meetings(id, workspace_id, lead_id, provider, connection_key, external_meeting_id, starts_at, ends_at)
values ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
  'fixture', 'account-a', 'booking-1', now() + interval '1 day', now() + interval '25 hours');
update public.meetings set status = 'canceled' where id = '60000000-0000-4000-8000-000000000001';
update public.leads set booked_at = null where id = '30000000-0000-4000-8000-000000000001';
do $$ begin
  assert (select booked_at is not null from public.leads where id = '30000000-0000-4000-8000-000000000001'), 'Canceled booking cleared stop';
  begin
    insert into public.meetings(workspace_id, lead_id, provider, connection_key, external_meeting_id, starts_at, ends_at)
    values ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'fixture', 'account-a', 'booking-1', now(), now() + interval '1 hour');
    raise exception 'Duplicate booking accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.deals(workspace_id, company_id, name, status, won_at, won_confirmed_by)
    values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Unsupported win', 'won', now(), '00000000-0000-4000-8000-000000000001');
    raise exception 'Win without payment evidence accepted';
  exception when check_violation then null; end;
end; $$;

insert into public.ai_runs(workspace_id, lead_id, operation, model, prompt_version, operation_key, input, output,
  confidence, cost, cost_kind, input_tokens, output_tokens, status, completed_at)
values ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'qualification', 'synthetic-model', 'v1',
  'qualification-1', '{"synthetic":true}', '{"unknown":true}', null, 0.00012345, 'estimated', 10, 20, 'succeeded', now());
do $$ begin
  assert (select cost = 0.00012345 and confidence is null from public.ai_runs where operation_key = 'qualification-1'), 'Cost precision or unknown confidence lost';
  begin
    update public.ai_runs set confidence = 1.5;
    raise exception 'Invalid AI confidence accepted';
  exception when check_violation then null; end;
  begin
    update public.ai_runs set lead_id = '30000000-0000-4000-8000-000000000003';
    raise exception 'AI cross-workspace lead accepted';
  exception when foreign_key_violation then null; end;
end; $$;

insert into public.activities(workspace_id, lead_id, actor_kind, activity_type, effect_key, to_stage)
values ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'system', 'stage_changed', 'effect-1', 'replied');
insert into public.activities(workspace_id, lead_id, actor_kind, activity_type, effect_key, to_stage)
values ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'system', 'stage_changed', 'effect-1', 'replied')
on conflict (workspace_id, effect_key) do nothing;
do $$ begin
  assert (select count(*) = 1 from public.activities), 'Duplicate logical effect recorded';
  begin
    update public.activities set details = '{"tampered":true}';
    raise exception 'Audit history modified';
  exception when check_violation then null; end;
end; $$;

rollback;

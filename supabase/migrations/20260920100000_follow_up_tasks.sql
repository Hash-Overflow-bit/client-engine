begin;

create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  lead_id uuid not null,
  conversation_id uuid not null,
  delivery_id uuid not null,
  campaign_id uuid,
  policy_id text not null check (length(btrim(policy_id)) between 1 and 80),
  sequence_step integer not null check (sequence_step between 1 and 3),
  purpose text not null check (purpose in ('VALUE_FOLLOW_UP', 'SECOND_TOUCH', 'CLOSE_LOOP')),
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'due', 'cancelled', 'completed', 'skipped')),
  eligibility_checked_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or cancellation_reason in ('INBOUND_REPLY', 'DO_NOT_CONTACT', 'UNSUBSCRIBED', 'DELIVERY_NOT_SENT', 'INVALID_LEAD_STATE', 'WORKSPACE_MISMATCH', 'CAMPAIGN_STOPPED', 'OUTBOUND_DISABLED', 'MANUAL_CANCEL', 'MANUAL_SKIP', 'RESCHEDULED', 'OTHER')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, delivery_id, policy_id, sequence_step),
  foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete restrict,
  foreign key (workspace_id, conversation_id) references public.conversations(workspace_id, id) on delete restrict,
  foreign key (workspace_id, delivery_id) references public.delivery_records(workspace_id, id) on delete restrict,
  foreign key (workspace_id, campaign_id) references public.campaigns(workspace_id, id) on delete restrict,
  check ((status = 'completed') = (completed_at is not null)),
  check (status in ('cancelled', 'skipped') or cancellation_reason is null),
  check (status not in ('cancelled', 'skipped') or cancellation_reason is not null)
);

create index follow_up_tasks_due_idx on public.follow_up_tasks(workspace_id, status, due_at)
  where status in ('scheduled', 'due');
create index follow_up_tasks_lead_idx on public.follow_up_tasks(workspace_id, lead_id, due_at);
create index follow_up_tasks_conversation_idx on public.follow_up_tasks(workspace_id, conversation_id, status);

alter table public.follow_up_tasks enable row level security;
create policy follow_up_tasks_read_member on public.follow_up_tasks
  for select to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));
create policy follow_up_tasks_insert_member on public.follow_up_tasks
  for insert to authenticated
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));
create policy follow_up_tasks_update_member on public.follow_up_tasks
  for update to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));
grant select, insert, update on public.follow_up_tasks to authenticated;

-- Existing activity reads had RLS, but server-side authenticated actions also
-- need a workspace-scoped insert policy for follow-up and stop audit events.
create policy activities_insert_member_for_follow_ups on public.activities
  for insert to authenticated
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));

create function public.cancel_stopped_follow_up_tasks()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare stop_reason text;
task_row record;
begin
  if new.replied_at is not null and old.replied_at is null then
    stop_reason := 'INBOUND_REPLY';
  elsif new.do_not_contact and not old.do_not_contact then
    stop_reason := 'DO_NOT_CONTACT';
  elsif new.booked_at is not null and old.booked_at is null then
    stop_reason := 'OTHER';
  end if;
  if stop_reason is not null then
    for task_row in
      select id, sequence_step, due_at from public.follow_up_tasks
       where workspace_id = new.workspace_id and lead_id = new.id
         and status in ('scheduled', 'due')
    loop
      update public.follow_up_tasks
         set status = 'cancelled', cancellation_reason = stop_reason,
             eligibility_checked_at = now(), updated_at = now()
       where workspace_id = new.workspace_id and id = task_row.id;
      insert into public.activities(workspace_id, lead_id, company_id, actor_kind,
        activity_type, effect_key, details)
      values (new.workspace_id, new.id, new.company_id, 'system',
        'follow_up_cancelled', 'follow_up_cancelled:' || task_row.id,
        jsonb_build_object('follow_up_task_id', task_row.id,
          'sequence_step', task_row.sequence_step, 'due_at', task_row.due_at,
          'cancellation_reason', stop_reason))
      on conflict (workspace_id, effect_key) do nothing;
    end loop;
  end if;
  return new;
end;
$$;
create trigger leads_cancel_follow_up_tasks after update on public.leads
  for each row execute function public.cancel_stopped_follow_up_tasks();

commit;

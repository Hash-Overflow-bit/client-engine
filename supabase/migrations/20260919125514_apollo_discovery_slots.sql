-- Milestone 4: reserve bounded discovery capacity before spending enrichment credits.
begin;

alter table public.workspaces alter column daily_new_contact_limit set default 15;

create table public.discovery_reservations (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  discovery_day date not null,
  slot_number integer not null check (slot_number between 1 and 15),
  reserved_at timestamptz not null default now(),
  primary key (workspace_id, discovery_day, slot_number)
);

alter table public.discovery_reservations enable row level security;
revoke all on table public.discovery_reservations from public, anon, authenticated, service_role;
grant select, insert on table public.discovery_reservations to service_role;

create function public.try_reserve_discovery_slot(
  p_workspace_id uuid,
  p_discovery_day date,
  p_limit integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_slot integer;
begin
  if p_limit < 1 then return false; end if;
  perform 1 from public.workspaces where id = p_workspace_id for update;
  if not found then return false; end if;

  select coalesce(max(slot_number), 0) + 1 into next_slot
  from public.discovery_reservations
  where workspace_id = p_workspace_id and discovery_day = p_discovery_day;

  if next_slot > least(p_limit, 15) then return false; end if;
  insert into public.discovery_reservations(workspace_id, discovery_day, slot_number)
  values (p_workspace_id, p_discovery_day, next_slot);
  return true;
end;
$$;

revoke all on function public.try_reserve_discovery_slot(uuid, date, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.try_reserve_discovery_slot(uuid, date, integer) to service_role;

comment on table public.discovery_reservations is 'Server-only atomic daily capacity reservations for Apollo discovery; capped at 15 slots per workspace/day.';

commit;

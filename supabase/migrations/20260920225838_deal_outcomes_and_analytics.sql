begin;

-- M17 makes the application deal record, not a payment/invoice, the source
-- of truth for a human-confirmed outcome.
alter type public.lead_stage add value if not exists 'lost';

alter table public.proposals add constraint proposals_workspace_id_unique unique (workspace_id, id);

alter table public.deals drop constraint if exists deals_status_check;
alter table public.deals drop constraint if exists deals_check;
alter table public.deals drop constraint if exists deals_check1;
alter table public.deals drop constraint if exists deals_check2;
update public.deals set status = 'open' where status = 'proposal';
alter table public.deals add constraint deals_status_check check (status in ('open', 'won', 'lost'));
alter table public.deals
  add column if not exists proposal_id uuid,
  add column if not exists meeting_id uuid,
  add column if not exists pricing_mode text check (pricing_mode in ('UNPRICED', 'FIXED', 'HOURLY', 'RANGE')),
  add column if not exists proposal_value numeric(18,2) check (proposal_value >= 0),
  add column if not exists source text,
  add column if not exists service_id text,
  add column if not exists portfolio_match text,
  add column if not exists closed_at timestamptz,
  add column if not exists lost_at timestamptz,
  add column if not exists loss_reason text check (loss_reason in ('BUDGET', 'NO_RESPONSE', 'TIMING', 'COMPETITOR', 'SCOPE_MISMATCH', 'NO_DECISION', 'CLIENT_PAUSED', 'TECHNICAL_MISMATCH', 'OTHER')),
  add column if not exists loss_notes text,
  add column if not exists created_by uuid references auth.users(id) on delete restrict,
  add column if not exists closed_by uuid references auth.users(id) on delete restrict;

update public.deals deal
set created_by = coalesce(deal.created_by, workspace.owner_user_id)
from public.workspaces workspace
where workspace.id = deal.workspace_id and deal.created_by is null;
update public.deals
set closed_by = coalesce(closed_by, won_confirmed_by, created_by),
    closed_at = coalesce(closed_at, won_at, updated_at),
    lost_at = case when status = 'lost' then coalesce(lost_at, updated_at) else lost_at end,
    loss_reason = case when status = 'lost' then coalesce(loss_reason, 'OTHER') else loss_reason end
where status in ('won', 'lost');

alter table public.deals drop constraint if exists deals_status_won_at_check;
alter table public.deals drop constraint if exists deals_status_won_confirmed_by_payment_evidence_reference_check;
alter table public.deals drop constraint if exists deals_status_proposal_version_proposal_sent_at_check;
alter table public.deals add constraint deals_outcome_fields_check check (
  (status = 'open' and won_at is null and lost_at is null and closed_at is null and closed_by is null and loss_reason is null)
  or (status = 'won' and won_at is not null and closed_at is not null and closed_by is not null)
  or (status = 'lost' and lost_at is not null and closed_at is not null and closed_by is not null and loss_reason is not null)
);
alter table public.deals add constraint deals_proposal_workspace_fk foreign key (workspace_id, proposal_id) references public.proposals(workspace_id, id) on delete restrict;
alter table public.deals add constraint deals_meeting_workspace_fk foreign key (workspace_id, meeting_id) references public.meetings(workspace_id, id) on delete restrict;

create unique index deals_one_per_proposal_idx on public.deals(workspace_id, proposal_id) where proposal_id is not null;
create index deals_workspace_status_created_idx on public.deals(workspace_id, status, created_at desc);
create index deals_workspace_outcome_idx on public.deals(workspace_id, won_at, lost_at);
create index deals_workspace_attribution_idx on public.deals(workspace_id, source, campaign_id, service_id);

grant select, insert, update on public.deals to authenticated;
create policy deals_insert_member on public.deals for insert to authenticated
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));
create policy deals_update_member on public.deals for update to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));

commit;

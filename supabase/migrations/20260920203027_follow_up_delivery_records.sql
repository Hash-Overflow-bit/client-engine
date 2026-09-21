begin;
alter table public.delivery_records alter column outreach_draft_id drop not null;
alter table public.delivery_records alter column company_id drop not null;
alter table public.delivery_records add column follow_up_task_id uuid;
alter table public.delivery_records add column follow_up_draft_id uuid;
alter table public.delivery_records add column conversation_id uuid;
alter table public.delivery_records add column sequence_step integer check(sequence_step between 1 and 3);
alter table public.delivery_records add column purpose text check(purpose in ('VALUE_FOLLOW_UP','SECOND_TOUCH','CLOSE_LOOP'));
alter table public.delivery_records add constraint delivery_records_follow_up_task_fk foreign key(workspace_id,follow_up_task_id) references public.follow_up_tasks(workspace_id,id) on delete restrict;
alter table public.delivery_records add constraint delivery_records_follow_up_draft_fk foreign key(workspace_id,follow_up_draft_id) references public.follow_up_drafts(workspace_id,id) on delete restrict;
alter table public.delivery_records add constraint delivery_records_follow_up_conversation_fk foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id) on delete restrict;
alter table public.delivery_records add constraint delivery_records_one_source check(
  (outreach_draft_id is not null and follow_up_draft_id is null and follow_up_task_id is null and sequence_step is null and purpose is null)
  or
  (outreach_draft_id is null and follow_up_draft_id is not null and follow_up_task_id is not null and sequence_step is not null and purpose is not null)
);
create unique index delivery_records_follow_up_active_unique on public.delivery_records(workspace_id,follow_up_task_id,follow_up_draft_id,draft_version,channel) where follow_up_draft_id is not null;
create index delivery_records_follow_up_task_idx on public.delivery_records(workspace_id,follow_up_task_id,created_at desc) where follow_up_task_id is not null;

create or replace function public.guard_follow_up_delivery_context() returns trigger language plpgsql security invoker as $$
begin
  if new.follow_up_task_id is null then return new; end if;
  if not exists (select 1 from public.follow_up_tasks t where t.workspace_id=new.workspace_id and t.id=new.follow_up_task_id and t.status='due') then raise exception 'follow-up task is not due'; end if;
  if exists (select 1 from public.leads l where l.workspace_id=new.workspace_id and l.id=new.lead_id and l.do_not_contact=true) then raise exception 'lead is suppressed'; end if;
  if exists (select 1 from public.messages m where m.workspace_id=new.workspace_id and m.conversation_id=(select conversation_id from public.follow_up_tasks where id=new.follow_up_task_id) and m.direction='inbound') then raise exception 'conversation has an inbound reply'; end if;
  return new;
end; $$;
create trigger delivery_records_follow_up_guard before insert or update on public.delivery_records for each row execute function public.guard_follow_up_delivery_context();
commit;

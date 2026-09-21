begin;

-- The classifier is already scoped by workspace, conversation, message and
-- lead. Company context is available from the lead and is not required on
-- every persisted classification row.
alter table public.reply_classifications
  alter column company_id drop not null;

-- Repeated confirmation/override requests from the same reviewer are a
-- no-op. A different intent or reviewer remains a separate immutable record.
create unique index if not exists reply_override_idempotency_idx
  on public.reply_classification_overrides(workspace_id, classification_id, selected_intent, actor_user_id);

create table if not exists public.reply_classification_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  classification_id uuid not null references public.reply_classifications(id) on delete restrict,
  status text not null check (status in ('confirmed', 'needs_review')),
  note text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, classification_id, status, actor_user_id)
);
create index if not exists reply_classification_reviews_lookup_idx
  on public.reply_classification_reviews(workspace_id, classification_id, created_at desc);
alter table public.reply_classification_reviews enable row level security;
create policy reply_classification_reviews_member on public.reply_classification_reviews
  for all to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid())));
grant select, insert on public.reply_classification_reviews to authenticated;

commit;

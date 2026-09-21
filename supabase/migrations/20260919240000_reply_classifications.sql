begin;
create table public.reply_classifications (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict, conversation_id uuid not null, message_id uuid not null, lead_id uuid not null, company_id uuid not null,
 intent text check (intent in ('POSITIVE','QUESTION','NOT_NOW','NOT_INTERESTED','REFERRAL','OUT_OF_OFFICE','UNSUBSCRIBE','OTHER')), confidence numeric(5,4) check (confidence between 0 and 1), summary text, reasoning text,
 recommended_action text check (recommended_action in ('REVIEW_AND_REPLY','PREPARE_MEETING_PATH','ANSWER_QUESTION','NURTURE','CLOSE','PROCESS_REFERRAL','WAIT_FOR_RETURN','SUPPRESS_CONTACT','MANUAL_REVIEW')), follow_up_allowed boolean not null default false, needs_review boolean not null default true,
 provider text not null, model text not null, prompt_version text not null, version integer not null check(version>0), created_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,message_id,prompt_version,version), foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id) on delete restrict, foreign key(workspace_id,lead_id) references public.leads(workspace_id,id) on delete restrict, foreign key(workspace_id,company_id) references public.companies(workspace_id,id) on delete restrict, foreign key(message_id) references public.messages(id) on delete restrict
);
create table public.reply_classification_overrides (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict, classification_id uuid not null, message_id uuid not null, conversation_id uuid not null, lead_id uuid not null, previous_intent text, selected_intent text not null check(selected_intent in ('POSITIVE','QUESTION','NOT_NOW','NOT_INTERESTED','REFERRAL','OUT_OF_OFFICE','UNSUBSCRIBE','OTHER')), reason text, actor_user_id uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), unique(workspace_id,id), foreign key(classification_id) references public.reply_classifications(id) on delete restrict, foreign key(message_id) references public.messages(id) on delete restrict, foreign key(workspace_id,conversation_id) references public.conversations(workspace_id,id) on delete restrict, foreign key(workspace_id,lead_id) references public.leads(workspace_id,id) on delete restrict
);
create index reply_classifications_message_idx on public.reply_classifications(workspace_id,message_id,created_at desc);
create index reply_classifications_review_idx on public.reply_classifications(workspace_id,needs_review,created_at desc);
create index reply_overrides_message_idx on public.reply_classification_overrides(workspace_id,message_id,created_at desc);
alter table public.reply_classifications enable row level security;
alter table public.reply_classification_overrides enable row level security;
create policy reply_classifications_member on public.reply_classifications for all to authenticated using(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid()))) with check(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
create policy reply_overrides_member on public.reply_classification_overrides for all to authenticated using(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid()))) with check(workspace_id in(select workspace_id from public.workspace_members where user_id=(select auth.uid())));
grant select,insert,update on public.reply_classifications,public.reply_classification_overrides to authenticated;
commit;

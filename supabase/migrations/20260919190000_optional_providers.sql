begin;
alter table public.ai_runs add column if not exists provider text not null default 'unknown' check (length(btrim(provider)) between 1 and 80 and provider = lower(btrim(provider)));
alter table public.workspaces add column if not exists outbound_kill_switch boolean not null default true;
comment on column public.ai_runs.provider is 'Provider used for this run, such as openai or ollama.';
comment on column public.workspaces.outbound_kill_switch is 'Global fail-closed outbound control; true blocks all sends.';
commit;

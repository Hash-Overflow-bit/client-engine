begin;
alter table public.companies add column if not exists research_status text not null default 'qualified' check (research_status in ('qualified','researching','researched','needs_review'));
alter table public.companies add column if not exists research_output jsonb check (research_output is null or jsonb_typeof(research_output) = 'object');
alter table public.companies add column if not exists research_confidence numeric(5,4) check (research_confidence between 0 and 1);
alter table public.companies add column if not exists research_updated_at timestamptz;
alter table public.companies add column if not exists research_error text;
commit;

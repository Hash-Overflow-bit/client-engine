-- Corrective ordering migration: this key must exist before delivery_records
-- creates its workspace-scoped foreign key to outreach_drafts.
begin;
alter table public.outreach_drafts
  add constraint outreach_drafts_workspace_id_id_unique unique (workspace_id, id);
commit;

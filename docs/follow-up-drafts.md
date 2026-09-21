# Follow-up drafts (Milestone 12)

Follow-up scheduling and follow-up content are separate concerns. A due M11 task is re-checked with `canFollowUp()` before AI generation and again immediately before persistence. Any inbound reply, suppression, invalid delivery, stopped campaign, or workspace mismatch wins the race and cancels the task; no actionable draft is persisted.

`follow_up_drafts` stores immutable versions (`draft`, `ready_for_review`, `approved`, `rejected`) keyed by workspace, task, context version, and prompt version. Normal retries reuse the generation key. Regeneration explicitly creates a new version and retains history. Human edits create a new version while retaining evidence and AI provenance.

Generation uses the existing provider abstraction (Ollama in development, OpenAI when configured), structured Zod output, controlled service/portfolio registries, and only verified research evidence. Possible needs remain hypotheses. Invalid, low-confidence, stale, or unsupported output is routed to review. One repair attempt is allowed.

Approval is content approval only. It records reviewer/timestamp and activity but never prepares or sends delivery and never completes the follow-up task. Delivery remains a later milestone. The M11 hosted Supabase and browser gates remain deployment-blocked until a dedicated project and Chromium are available.
An approved follow-up draft can enter M13 manual delivery, but approval itself neither sends content nor completes its task.

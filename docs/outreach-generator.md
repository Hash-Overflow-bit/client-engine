# Outreach generator

Outreach generation is review-only. It uses persisted company research and
controlled service/portfolio registries, retains evidence URLs, marks unsafe or
low-confidence drafts `needsReview`, and never invokes an outbound provider.
Possible needs remain hypotheses and are not copied into factual claims.

## Completion-pass lifecycle

`outreach_drafts` stores versioned generated content with `draft`,
`ready_for_review`, `approved`, and `rejected` states. Normal retries are
idempotent on lead, research version, and prompt version; explicit
regeneration creates a new version and retains prior history. Approval,
editing, and rejection are persistence-only operations and never send.

Generation calls the configured `AIProvider` (Ollama in development, OpenAI
when selected), validates the structured Zod result, and allows one repair
attempt. Every attempt is recorded as an `outreach_generation` AI run.
Missing, stale, failed, or `needs_review` research is blocked before
generation.

## Review integration

The `/outreach` page uses authenticated Next.js server actions backed by the
Supabase session and workspace membership. Approve/reject/edit/regenerate
never run in the browser with privileged credentials. Human edits create a
new review version, preserving the generated row and its AI provenance.
Transitions are centralized: `ready_for_review` can become `approved` or
`rejected`; immutable rejected/approved versions cannot be reopened. Activity
rows use idempotent effect keys and include only draft/version/status metadata.

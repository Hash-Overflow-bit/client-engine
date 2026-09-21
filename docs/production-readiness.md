# Production readiness and controlled launch

Status: **not yet ready for controlled live test**. This document is a checklist, not evidence that hosted validation has occurred.

## Supported operating topology

The supported zero-cost assisted topology is either fully local (Next.js + Ollama + Supabase local stack) or a hybrid setup with a hosted web app/Supabase project and AI-heavy work performed by a trusted local worker. A Vercel deployment cannot reach an Ollama instance running on a personal computer at `localhost`; do not expose Ollama publicly to work around this. Use an authenticated, private worker-to-application boundary before adopting the hybrid topology.

`CLIENT_ENGINE_OPERATING_MODE=assisted` is the only supported launch mode. `OUTREACH_SEND_ENABLED=false` and `OUTBOUND_KILL_SWITCH=true` remain required. Preparation and `Mark Sent` only record human-performed external actions; no provider send adapter exists.

## Environment contract

The server-side readiness model validates selected-provider configuration without disclosing values. `/api/health` is a configuration health endpoint: it reports `ok` or `degraded`, selected provider, environment and non-sensitive configuration issues. It does not contact Ollama or Supabase and is not proof of RLS or database reachability.

| Category | Required for assisted launch | Notes |
| --- | --- | --- |
| Core | `NEXT_PUBLIC_APP_URL`, Supabase URL, Supabase publishable key | Publishable key is the only browser Supabase credential. |
| Runtime | `CLIENT_ENGINE_ENV=production`, `CLIENT_ENGINE_OPERATING_MODE=assisted` | Preview/test/development remain fail-closed for sends. |
| Safety | `OUTBOUND_KILL_SWITCH=true`, `OUTREACH_SEND_ENABLED=false` | These must not be changed for this launch. |
| Zero-cost AI | `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Provider must be reachable from the execution environment. |
| Optional paid AI | `AI_PROVIDER=openai` plus key and configured model IDs | Optional; never required for the zero-cost launch. |
| Optional providers | Apollo, Calendly, Google and future email credentials | Leave blank when not configured. |

`.env.local` remains ignored. Never use `NEXT_PUBLIC_` for secret, service-role, provider, or webhook-signing credentials. Structured logs contain only operation/outcome/duration/entity identifiers/error category; never include prompt bodies, messages, tokens, or secrets.

## Launch gates

- [ ] Clean, reviewed release worktree with all prior milestone work committed.
- [ ] Dedicated **client-engine** Supabase staging project created and linked; no unrelated project is used.
- [ ] All migrations applied from an empty staging project in chronological order.
- [ ] Supabase database lint/security/performance advisors reviewed; accepted warnings documented.
- [ ] Two-workspace/two-user RLS matrix passed for every CRM domain; unauthenticated reads fail.
- [ ] Server-only credential audit passed and production build contains no secret.
- [ ] Ollama structured-generation smoke tests pass using the actual execution topology.
- [ ] Optional OpenAI smoke test recorded as pass or not-run.
- [ ] Playwright Chromium suite passes in CI against an authenticated staging deployment.
- [ ] Safety regression passes: kill switch, DNC, unsubscribe, reply suppression, booking suppression, idempotency, and SSRF controls.
- [ ] Migration/recovery/export procedures have been rehearsed and ownership is known.
- [ ] Controlled live-test cap is explicitly set to at most ten prospects.

## Hosted validation matrix

For each workspace-scoped domain—leads, companies/research, outreach/delivery, conversations/messages/classifications, follow-ups/drafts, meetings/briefs, discovery/proposals, deals, activities and AI runs—test both directions:

1. Workspace A user can read and perform its permitted operation.
2. Workspace A user cannot read, mutate, count, or infer Workspace B data.
3. Repeat for Workspace B.
4. Confirm unauthenticated access is rejected.

Run the full assisted happy path and separate no-reply follow-up path using fake staging prospects. Repeat requests at every mutation boundary to verify idempotency. Run reply/DNC races after delivery preparation and before follow-up draft/delivery persistence; the stop event must win and preserve historical records as non-actionable.

## Backup, recovery, retention and export

Supabase plan-level backups are not assumed until configured and verified in the project console. Record the plan, retention period, restore owner and restore procedure before launch. At minimum, preserve migrations in source control, keep environment configuration in the deployment secret store, and retain a tested procedure to recreate the schema from the full migration chain.

For initial recovery, use a workspace-scoped database export performed by an authorized operator to recover leads, companies, conversations/messages, meetings, proposals and deals. A self-service export endpoint is not implemented in this milestone.

Raw provider metadata is retained only where it supplies durable idempotency/audit value. Avoid storing raw HTML, secrets, tokens or whole webhook payloads when normalized records/evidence references are enough. Set explicit retention periods before onboarding real prospects.

## Controlled ten-lead test

Use at most ten carefully selected real prospects after every gate above is complete. `LIVE_TEST_MODE=true` makes the shared discovery service clamp each workspace's persisted daily discovery reservation to `LIVE_TEST_MAX_PROSPECTS`, with an absolute maximum of ten, before it calls any lead provider. For the first experiment, leave this mode enabled and import only the approved cohort; it is a launch guard, not permission to contact anyone. For each: manually verify fit and evidence, review content, send externally by hand, record the outcome, and monitor suppression/activities. Track delivered, replied, positive, meeting, proposal and won outcomes. Do not raise the cap or enable automated sending based on this test alone.

## Current blockers

- The local empty-database migration chain passes for all 18 migrations. Hosted application and advisor validation still require a dedicated project.
- No dedicated client-engine Supabase project is linked or configured in this environment.
- Docker/Podman is unavailable, so the local Supabase stack and full migration chain cannot run here.
- Supabase CLI is not authenticated, so hosted migrations/advisors/RLS validation cannot run.
- Playwright Chromium is not installed in this runtime, so browser smoke tests cannot run here.
- No reachable local Ollama service or configured OpenAI credential was provided for live provider validation.

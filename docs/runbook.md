# Runbook
## Local foundation
Run npm ci, copy .env.example to apps/web/.env.local, then npm run dev. Run npm run check before commit. No credentials are needed for the overview.

## First deployment, after authentication
Create a private remote repository and push main. Configure Vercel with apps/web as root and access to workspace packages outside that directory. Validate preview build before production. Keep production data and credentials separate from preview. No deployment is made by this scaffold.

## Before live campaigns
Implement and test Auth/RLS, durable job processing, signature verification, suppression handling, approved revision checks and provider reconciliation. Use provider sandbox/test recipients first. Sending is disabled by default. Activate auto-send only for an explicitly approved campaign policy, with a daily cap and emergency pause.

## Incident operations (future worker)
Pause campaign dispatch before investigating duplicates. Preserve message IDs and correlation IDs. Reconcile uncertain provider sends before retries. Replay only failed idempotent jobs. Unsubscribes must remain suppressed across imports. Monitor queue age, errors, bounce rates, API spend and webhook failures.

## Credentials
Set secrets in the appropriate deployment or n8n credential store. Never commit .env.local. Rotate leaked credentials and remove them from git history. Log entity IDs, not full private messages or credentials.

## Verification gate
Run npm run check and review the full git diff for every milestone. Run integration tests for database, webhook, provider and cross-service changes; document applicability. Never declare completion after a failed or unavailable required check. The send preflight refuses non-production execution, including auto-send. This is a pure guard; live reply cancellation and duplicate webhook processing still require implementation.

Set CLIENT_ENGINE_ENV=development locally and preview for preview deployments; only a real production worker may set production. The policy does not use NODE_ENV because optimized preview builds also use NODE_ENV=production. Do not source this trusted configuration from request data.

## Reply review deployment checks

Before enabling the review queue in a hosted environment, apply the
forward-only `20260919241000_reply_review_closure` migration after the reply
classification migration. Verify RLS with two authenticated workspaces,
including an attempted cross-workspace classification read and override.
Confirm that repeated confirmation/override requests produce one review
record and one activity effect, and that `UNSUBSCRIBE` latches
`do_not_contact` without a path to clear it from the review UI. Install the
Playwright browser in CI and run the review-route smoke tests. No review
action should have a send-capable provider dependency.

For follow-up scheduling, apply the follow-up migration after the delivery
and conversation migrations. Verify that Mark Sent creates exactly three
bounded tasks, duplicate Mark Sent is idempotent, an inbound reply cancels
all active tasks, and due processing refuses non-production or kill-switched
work. Confirm `/follow-ups` has only Skip, Cancel, and Reschedule controls;
there is no send or copy-generation action.
## Milestone 12 deployment gate

M12 local verification is complete, but hosted Supabase validation remains blocked until a dedicated client-engine project is configured. Apply `20260920201357_follow_up_drafts.sql` through the established migration workflow, then validate RLS with two workspaces. Install Chromium before running browser smoke tests. Do not use an unrelated Supabase project.
## Milestone 13 deployment gate

Apply `20260920203027_follow_up_delivery_records.sql` after the M12 migration. Validate the source constraint and multi-workspace RLS before enabling manual delivery. M11/M12 hosted validation remains blocked; no send provider is configured.
## Milestone 14 deployment gate

Apply `20260920203955_meeting_booking_foundation.sql` after the earlier migrations. Validate meeting and settings RLS with two workspaces. Do not mark the existing M11–M13 hosted or browser gates complete.
## Milestone 15 deployment gate

Apply `20260920205606_meeting_briefs.sql` after the M14 migration. Validate `meeting_briefs` RLS and AI run provenance in a dedicated client-engine project. Existing hosted and Chromium gates remain blocked.
## Milestone 16 deployment gate

Apply `20260920210947_discovery_outcomes_and_proposals.sql` after M15 and validate cross-workspace RLS for both new tables. Existing hosted and Chromium validation gates remain blocked.

## Milestone 16.1 deployment gate

No schema migration is required for the proposal lifecycle closure. In the dedicated client-engine project, validate authenticated cross-workspace edit/approve/reject denials, repeated-action idempotency, the `meeting` to `proposal` transition, and that approval has no outbound side effect. The existing hosted Supabase and Chromium/browser gates remain blocked until that project and browser runtime are available.

## Milestone 17 deployment gate

Apply `20260920225838_deal_outcomes_and_analytics.sql` after the M16 migration. Validate two-workspace RLS for read/create/close actions, legacy deal migration checks, one-open-deal-per-proposal uniqueness, idempotent WON/LOST effects, and that currency totals remain separate. Existing hosted Supabase and Chromium/browser gates remain blocked until a dedicated client-engine project and browser runtime are available.

## Milestone 18 controlled-launch gate

See [production-readiness.md](production-readiness.md) for the authoritative checklist and zero-cost topology. Do not declare the system ready merely because local tests pass: hosted migration chain, advisor, two-workspace RLS, real Ollama, and authenticated browser checks are required. `/api/health` reports configuration readiness only; it does not certify database connectivity, RLS, or provider availability.

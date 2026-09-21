# Database contract

Milestone 2 adds the first production database contract in
`supabase/migrations/20260918223912_client_acquisition_database.sql`. It is a
Supabase CLI-generated migration and is intentionally persistence-only: there
are no provider calls, dispatch workers, or automatic outreach in this
milestone.

## Ownership and tenancy

The requested business tables are workspace-scoped:

| Table | Role |
| --- | --- |
| `companies` | One account or startup; a company can have many leads. Domains are normalized per workspace. |
| `leads` | People at a company, source identity, fit, funnel stage, contact state, and stop latches. |
| `campaigns` | Human-approved campaign policy and conservative sending defaults. |
| `messages` | Draft, approval, delivery, and inbound-reply records. Approved content is immutable; edits create revisions. |
| `activities` | Append-only audit/timeline effects with an idempotency key. |
| `meetings` | Provider booking records with workspace/provider/external-ID deduplication. |
| `deals` | Proposal and won-client evidence; winning a deal requires an operator and payment evidence reference. |
| `suppression_list` | Append-only canonical email suppression independent of lead lifetime. |
| `integration_events` | Durable webhook inbox. The unique key is `(workspace_id, provider, connection_key, external_event_id)`. |
| `ai_runs` | AI provenance: operation, model, prompt version, JSON input/output, evidence, confidence, token usage, and cost. |

Two infrastructure tables are included so tenant isolation is explicit:
`workspaces` and `workspace_members`. A trusted server operation provisions a
workspace and its owner membership in one transaction; browser clients cannot
self-enroll or mutate membership.

The Apollo discovery migration adds the server-only `discovery_reservations`
capacity table and `try_reserve_discovery_slot` function. Reservations are
serialized per workspace/day and capped at 15; they prevent concurrent cron
runs from exceeding the initial enrichment budget.

Every cross-entity relationship uses a composite foreign key containing
`workspace_id`. This prevents a lead, message, meeting, or AI run from being
attached to an object owned by another workspace. `company_id` on a lead is
nullable because discovery can precede company resolution.

## Safety invariants

- Every public table has RLS enabled. Anonymous roles receive no table grants.
  Authenticated users can read only rows in their memberships; browser writes
  are limited to basic company fields. Operational writes use a verified server
  service with an explicit workspace context.
- Workspace, row identity, and provider receipt identity are immutable.
- `integration_events` should be inserted with `ON CONFLICT DO NOTHING`, so a
  duplicate Apollo, Gmail, Calendly, or calendar delivery becomes a no-op.
- `do_not_contact`, `replied_at`, and `booked_at` are sticky stop latches.
  Suppression is append-only, survives lead deletion/re-import, clears pending
  follow-up time, and cancels unsent initial/follow-up messages.
- An inbound reply latches the lead at `replied`; a booking latches `booked_at`.
  The database does not send messages and does not negotiate prices or accept
  contracts.
- Outreach records require an approval identity and policy version before they
  can enter a sendable state. Approved content cannot be edited in place.
- Research sources are structurally validated as URL/excerpt/retrieval records.
  A database-valid row is not proof that a source is accurate; the application
  still needs a human review step before activation.
- AI confidence and cost are nullable. Unknown values remain `NULL` instead of
  being fabricated; cost uses fixed-precision numeric storage.

## Verification

`supabase/tests/database_contracts.sql` is a disposable PostgreSQL regression
suite. It checks RLS metadata, cross-workspace reads/writes, composite foreign
keys, duplicate event delivery, immutable approved messages, suppression and
reply stop behavior, booking latches, AI cost precision, and append-only
activities.

The suite passes against PGlite in this repository. PGlite supplies a real
PostgreSQL-compatible engine for this Docker-free environment, but it does not
replace a hosted Supabase Auth/Data API check. When Docker is available, run:

```sh
npx supabase db reset
npx supabase test db
```

The Supabase CLI remains the source of truth for migration ordering and the
hosted project should be checked before production activation.

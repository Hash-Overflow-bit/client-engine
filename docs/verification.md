# Verification

## Milestone 18 — production readiness and controlled launch

M18 adds no new acquisition, delivery, payment, or autonomous-sales feature.
It adds a centralized server-side runtime-readiness contract, a safe
configuration-only `/api/health` endpoint, structured secret-free operation-log
helpers, a controlled live-test environment template, and the operational
checklist in `docs/production-readiness.md`. The dashboard now degrades to its
existing credential-free analytics-unavailable state when Supabase has not yet
been configured.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm test -- --run` | Passed; 105 tests across 23 files |
| `npm run build` | Passed; includes dynamic `/api/health` |
| `git diff --check` | Passed |
| Production dependency audit | Passed; `npm audit --omit=dev --json` reported 0 vulnerabilities |
| Local migration chain | Passed: all 18 migrations apply chronologically from an empty PGlite database; two missing composite workspace keys were corrected before deployment |
| Supabase advisors / hosted migration chain | Blocked: no dedicated client-engine project is linked, CLI has no access token, and Docker/Podman is unavailable for the local stack |
| Hosted RLS / assisted flows | Blocked: no dedicated client-engine staging project or two authenticated workspace users are configured |
| Ollama / OpenAI live smoke | Not run: no reachable local Ollama service or OpenAI credential was provided |
| Playwright | Blocked: Chromium installation was attempted but its executable is unavailable; the smoke suite now covers dashboard, leads, lead detail, outreach, replies, follow-ups, meetings, proposals, deals and the no-auto-send UI boundary |

The repository was already dirty with the accumulated M7–M17 uncommitted work
before this pass. It is not a clean release candidate and must be committed and
reviewed before a controlled launch. Browser, hosted migration, RLS, provider,
and controlled-live-test gates remain open; the correct current readiness status
is **NOT READY**.

## Milestone 11 — follow-up scheduling foundation

Implemented the bounded `assisted-v1` follow-up policy, canonical
`follow_up_tasks` persistence, sent-delivery schedule creation, due
eligibility re-checks, reply/stop cancellation, manual skip/cancel/reschedule
actions, `/follow-ups`, and lead-detail schedule visibility. No content
generation or outbound provider was introduced.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero ESLint errors or warnings |
| `npm test -- --run` | Passed; 78 tests across 15 files |
| Integration tests | Hosted Supabase checks not performed; no project credentials are available. The migration was reviewed but not applied to a hosted database. |
| `npm run build` | Passed; `/follow-ups` and dynamic lead detail compile successfully |
| `git diff --check` | Passed |
| `npm run test:e2e` | Attempted; all 8 existing Playwright smoke tests were blocked because the Chromium executable is unavailable in this environment |

The Supabase CLI is available through the repository toolchain, but local
database linting could not run because no local Postgres/Docker instance is
available (`supabase db lint --local` could not connect to port 54322), and no
hosted project credentials are configured. The migration remains a
forward-only versioned file; no database was changed directly. Before
deployment, apply the migration to a Supabase test project, verify RLS and
stop-trigger behavior with two workspaces, and install Chromium in CI for
browser checks.

## Milestone 10.1 — reply review UI and integration closure

This pass connected the canonical conversation/message records to lead
detail, added all controlled reply-intent review actions, centralized
effective-intent resolution, and added immutable review markers plus
idempotent override/suppression activities. No outbound provider is imported
or invoked.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero ESLint errors or warnings |
| `npm test -- --run` | Passed; 69 tests across 14 files |
| Integration tests | Hosted Supabase checks not performed; no project credentials are available. `npm run test:e2e` was attempted but all 8 existing Playwright smoke tests were blocked because the Chromium executable is not installed in this environment. |
| `npm run build` | Passed; `/leads/[id]` and `/replies` compile as dynamic server routes |
| `git diff --check` | Passed; reviewed modified and newly added review, conversation, migration, test and documentation files |

No Gmail, SMTP, Apollo, Instantly, Calendly, or other outbound operation was
run. Before deployment, apply the new migrations to a Supabase test project,
exercise RLS and authenticated workspace membership with at least two users,
install the Playwright browser in CI, and run the hosted review-action tests.

## Milestone 5 — AI qualification

Implemented `packages/ai/src/qualification` as the single server-side OpenAI
boundary. Qualification requests use the Responses API `text.format` strict
JSON Schema, Zod validates the returned object, score/tier mismatches are
rejected, and routine versus ambiguous/high-value work selects separate
configured models. Tests mock the HTTP boundary; no API key or live request was
used.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero ESLint errors or warnings |
| `npm test` | Passed; 37 tests across 5 files, including mocked structured-output and model-routing contracts |
| Integration tests | Passed at the HTTP contract boundary with mocked Responses API payloads; no live OpenAI request was made |
| `npm run build` | Passed; web workspace builds successfully with the AI package present |
| Git diff review | Passed; reviewed qualification adapter, schema, tests, dependency lockfile and docs; `git diff --check` passed |

No OpenAI credential was read and no production qualification or outreach was
run. The environment must provide explicit routine and strong model IDs before
the agent can be constructed from environment variables.

## Milestone 4 — Apollo integration

Implemented the provider-neutral `ProspectProvider` port, the validated
`ApolloProspectProvider`, the bounded discovery ingestion service, and a
server-only Supabase persistence adapter. Apollo search and enrichment payloads
are validated with Zod against the current official OpenAPI examples. Discovery
deduplicates before enrichment, upserts company then lead, records an
idempotent `lead_discovered` activity, and reserves capacity through an atomic
database function capped at 15 prospects per workspace/day.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero ESLint errors or warnings |
| `npm test` | Passed; 34 tests across 4 files, including mocked Apollo contracts and discovery pipeline behavior |
| Integration tests | Passed against mocked Apollo HTTP responses and PGlite migrations; no live Apollo credits or external writes used |
| `npm run build` | Passed; web workspace builds successfully with the integration packages present |
| Git diff review | Passed; reviewed provider adapter, Zod contracts, ingestion service, Supabase store, migration, tests, lockfile and docs; `git diff --check` passed |

No Apollo credential was read, no live search/enrichment was run, and no public
cron route was exposed. A trusted server job still needs to supply the API key,
workspace context, retry policy, and schedule.

## Milestone 3 — CRM dashboard

Implemented the functional CRM presentation layer with typed demo fixtures:
dashboard funnel metrics, lead search and stage filtering, a non-draggable
pipeline board, and lead detail views covering qualification, company research,
pain point, service match, conversation, AI activity, and next action. No write
action or automatic outreach was introduced.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero ESLint errors or warnings |
| `npm test` | Passed; 30 tests across 3 files |
| Integration tests | Existing Playwright route smoke suite remains configured; a browser binary is not available in this environment, so route rendering was verified by the production build and static fixture tests |
| `npm run build` | Passed; dashboard, leads, pipeline, and dynamic lead detail routes compiled successfully |
| Git diff review | Passed; reviewed route components, reusable CRM components, fixture contracts, and tests; `git diff --check` passed |

The CRM currently uses explicit demo data because no authenticated Supabase
workspace is connected. Connecting reads and mutation actions is the next
vertical slice; the UI deliberately does not imply that demo buttons sent
messages or changed production records.

## Milestone 2 — database

Implemented the CLI-generated Supabase migration and database contract suite.
The schema includes the ten requested tables plus `workspaces` and
`workspace_members` for explicit tenant isolation. It enforces composite
workspace foreign keys, RLS and explicit grants, webhook deduplication,
append-only suppression and activities, immutable approved message content,
and sticky reply/booking/do-not-contact stop latches.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed; root, web app, and the PGlite migration integration test typecheck |
| `npm run lint` | Passed with zero ESLint errors or warnings |
| `npm test` | Passed; 27 tests across 2 files, including migration execution and database contracts |
| Integration tests | Passed in PGlite; migration and `supabase/tests/database_contracts.sql` exercised real PostgreSQL-compatible SQL, RLS metadata, constraints, deduplication and stop behavior |
| `npm run build` | Passed; existing Next.js route shell builds successfully |
| Git diff review | Passed; reviewed migration, regression SQL, configuration, dependency lockfile and documentation; `git diff --check` passed |

The official Supabase local stack could not be started because Docker is not
available in this environment. Therefore hosted Supabase Auth/Data API behavior
and `npx supabase test db` remain a pre-production check, not an unverified
claim of completion. No provider call, live email, automatic outreach, or
production deployment was performed.

## Milestone 1 — application foundation

Implemented the Next.js App Router shell, strict TypeScript, Tailwind, Supabase browser/server client factories, ESLint, Vitest and Playwright. Added `/dashboard`, `/leads`, `/leads/[id]`, `/pipeline`, `/campaigns`, `/meetings` and `/settings`; `/` redirects to `/dashboard`.

| Required check | Result |
| --- | --- |
| `npm run typecheck` | Passed; root packages, unit tests, Playwright config/tests and web app checked |
| `npm run lint` | Passed with zero ESLint errors or warnings |
| `npm test` | Passed; 27 Vitest tests across 2 files |
| Integration tests | `PLAYWRIGHT_EXECUTABLE_PATH=/tmp/chromium npm run test:e2e` passed; 8 Chromium route/redirect checks |
| `npm run build` | Passed; all seven requested routes present in Next.js build output |
| Git diff review | Reviewed application shell, routes, clients, configs, tests, docs, manifests and lockfile; `git diff --check` passed |

A clean `npm ci` completed before the final runs. The standard Playwright CDN download was truncated by the execution proxy, so the local verification used a temporary npm-packaged Chromium 153 executable matching Playwright's requested browser generation. That package was not saved or committed. CI installs Playwright Chromium through the official installer and then runs `npm run check`.

No Supabase project was connected and no schema, migration, authentication, real provider operation, live email or deployment was introduced. Supabase clients use only the public URL and publishable key; the secret key remains server-only and unused in this milestone.

## Milestone 0 — product specification

Documentation-only change. No production code, dependency, migration, schema or workflow export changed. Prior scaffold remains prior work. Astra authored product-spec.md, threat-model.md and acceptance-tests.md; the coordinating agent authored architecture.md/funnel.md and reviewed the complete set. Review findings and resolutions are recorded in architecture.md.

- `npm run check`: passed on the existing scaffold (typecheck, lint, 26 unit tests and production build).
- Integration tests: not applicable to this documentation-only change; no provider/database/webhook implementation was added. The 31 acceptance scenarios are specifications, not executed tests.
- Git diff review: reviewed the five requested documents, README/roadmap changes and this verification record; checked documentation-only scope and whitespace with `git diff --check`.
- No real email, external provider operation or production deployment performed.

Milestone 0 document preparation and architecture review are complete. Live-pilot readiness and the two-client monthly business outcome are not claimed. The previously documented toolchain compatibility caveat still applies.

## Earlier foundation verification

Scope: engineering-rule adoption and foundation hardening. This does not complete database, provider or outreach-dispatch milestones.

Verified with Node.js 24.19.0 and npm 11.9.0:

| Required check | Result |
| --- | --- |
| Typecheck | npm run typecheck passed for domain packages, tests and web |
| Lint | npm run lint passed with zero errors and warnings |
| Unit tests | npm test: 26 passed, 0 failed, 0 skipped |
| Integration tests | Not applicable: no database, external adapter, webhook, dispatcher or cross-service implementation introduced |
| Build | npm run build passed, including Tailwind/PostCSS compilation and static generation |
| Git diff review | Reviewed code, configs, docs, dependency manifests and lockfile changes; git diff --check passed |

A clean npm ci --offline --no-audit --no-fund install succeeded, followed by another successful npm run check. CI invokes the same check command. Lockfile review found only npm registry sources with integrity values for external dependency records; TypeScript moved from 7.0.2 to 6.0.3 for lint parser compatibility.

Initial verification failures were corrected: the internal homepage link now uses next/link; the environment regression test uses Node 22-compatible APIs. No required check remains failed. npm emits a deprecation notice for ESLint 9, retained because the installed React/accessibility plugins exclude ESLint 10; see docs/dependencies.md.

Tests cover production approval, stale draft revision, disabled sends, do_not_contact, suppression, replies, booking, verification, quotas, automatic approval, all non-production environments, malformed input and missing deployment configuration. These tests verify a pure guard only. Durable reply cancellation, webhook deduplication, transactional dispatch, provider payload validation and database RLS remain future implementation/integration-test work.

No browser visual verification or production deployment performed. No real emails sent.

# Build order and acceptance gates

0. Product specification (current): product-spec.md, architecture.md, funnel.md, threat-model.md and acceptance-tests.md. Documentation only; a recorded architecture review is required at exit; further coding is a subsequent milestone. The earlier foundation exists as prior work and must be reconciled with this specification in a later milestone.
1. Foundation (completed): Next.js shell, TypeScript, Tailwind, Supabase client boundaries, ESLint, Vitest, Playwright, required routes, domain contracts and documentation.
2. Database (completed): CLI-generated Supabase migration for workspace tenancy, companies/leads, campaigns, messages, activities, meetings, deals, suppression, integration events and AI provenance. RLS, explicit grants, composite workspace foreign keys, sticky stop latches and a PostgreSQL-compatible regression suite are included. Gate passed locally; hosted Supabase Auth/Data API verification remains a pre-production operation because Docker and project credentials are not available here.
3. CRM dashboard (completed): Functional dashboard metrics, lead list with search/stage filtering, non-draggable funnel Kanban, and lead detail/research/review views backed by typed demo fixtures. Persistence and write actions remain intentionally disabled until the authenticated CRM slice is implemented.
4. Apollo acquisition (completed): provider-neutral prospect port, validated Apollo search/enrichment adapter, deterministic deduplication, Supabase company/lead/activity store, and atomic 15-prospect/day reservations. No public cron route or live credential is enabled yet.
5. AI qualification/research (qualification completed): server-only Responses API adapter, strict structured output validation, and explicit routine/strong model routing. Research and evidence review remain pending. Gate: unsupported claims cannot enter outreach.
6. Drafts and approval: immutable draft revisions and campaign setup. Gate: editing an approved draft invalidates permission to send.
7. Sequence dispatcher: outbound adapter, durable jobs, final preflight, quotas, reply ingestion and suppression. Gate: replaying events produces no duplicate sends; reply/unsubscribe cancels pending follow-ups.
8. Booking and meeting brief: Calendly webhooks, cancellation/reschedule handling, calendar reconciliation, verified briefing. Gate: one booking creates one meeting record, with no duplicate calendar entry.
9. Proposal and revenue tracking: proposal versions, explicit send action, won/lost transitions and funnel analytics. Gate: conversion metrics reconcile against source events.

Implement one vertical slice at a time. Before live dispatch, select the outbound provider and campaign ICP; no choices or credentials are assumed by this scaffold.

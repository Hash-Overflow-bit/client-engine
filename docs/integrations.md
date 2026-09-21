# Integration boundaries

## OpenAI qualification

`packages/ai/src/qualification` is the single boundary for lead qualification. It sends only supplied lead/company facts to the Responses API using `text.format` with a strict JSON Schema, then validates the returned object with Zod and rejects score/tier mismatches. Routine, ambiguous, and high-value tasks select configured models independently (`OPENAI_QUALIFICATION_ROUTINE_MODEL` and `OPENAI_QUALIFICATION_STRONG_MODEL`). The API key is server-only; tests mock `fetch` and never call OpenAI.

Provider adapters are added behind narrow ports. Blank environment values mean
unconfigured, not connected.

| Provider | Planned role | Setup requirement |
| --- | --- | --- |
| Apollo | Discover and enrich contacts | API credential, plan access and enrichment budget; server-only `ApolloProspectProvider` |
| Supabase | Auth and persistence | Project, Auth config, migration, RLS and generated types |
| OpenAI | Structured qualification, research synthesis, drafts, intent, briefs | API key, chosen model, schemas and per-job budget |
| Gmail / outbound provider | Send and ingest replies | Choose one first; OAuth or API credential and webhook verification |
| Calendly | Booking source of truth | Booking URL, webhook signing setup and identity matching |
| Google Calendar | Calendar visibility | Prefer Calendly native sync; OAuth for extra reads if needed |
| n8n | Background orchestration | Separate host, encrypted credentials, authenticated internal calls |
| Vercel | Next.js hosting | Repo connection, apps/web project root, workspace dependencies and secrets |

Do not use a user's inbox OAuth refresh token as a global environment variable for multiple accounts. Store encrypted per-connection tokens and rotate them. Never include tokens in logs or exported workflows.

Before each adapter, verify current official docs for endpoint shape, plan limitations, webhook signature algorithms, rate limits, retry semantics and OAuth scopes. Provider interfaces here do not assert a specific API endpoint. AI output needs runtime validation; provider text is untrusted. Research fetchers need redirect, size, timeout and private-network protections.

All provider payloads and AI outputs enter as unknown and must pass Zod schemas grounded in verified provider documentation. The send-context schema is an internal domain contract, not a provider API schema. Every webhook requires signature verification plus durable duplicate-event handling.

## Apollo discovery (Milestone 4)

`@client-engine/integrations` exposes the provider-neutral contract:

```ts
interface ProspectProvider {
  search(criteria: SearchCriteria): Promise<Prospect[]>;
  enrich(prospect: Prospect): Promise<EnrichedProspect>;
}
```

`ApolloProspectProvider` maps Apollo's documented [People API Search](https://docs.apollo.io/reference/people-api-search) and [People Enrichment](https://docs.apollo.io/reference/people-enrichment) endpoints. Search results are validated before mapping; Apollo's
search endpoint does not return email addresses, so enrichment is always a
separate validated step. API credentials stay in the server-side constructor
and are sent only in Apollo's `x-api-key` header.

`runDiscovery` in `@client-engine/database` performs the bounded pipeline:

1. search with the configured criteria and remaining capacity;
2. deduplicate by provider identity before spending enrichment credits;
3. skip existing workspace records;
4. enrich and validate the prospect;
5. upsert the company, then the lead;
6. write an idempotent `lead_discovered` activity.

The database migration adds server-only `discovery_reservations` and an
atomic `try_reserve_discovery_slot` function. It serializes reservations per
workspace/day and caps them at 15, so concurrent cron runs cannot exceed the
initial daily budget. The concrete Supabase store must be constructed with a
trusted service-role client and is never imported into browser code.

No public cron route is exposed yet. n8n or a server cron should invoke the
service only after workspace authentication, provider credential lookup, and
job-level retry policy are wired.

# Client Engine
AI Client Acquisition Engine — Milestone 1 application foundation.

## Product specification
- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Funnel](docs/funnel.md)
- [Threat model](docs/threat-model.md)
- [Acceptance tests](docs/acceptance-tests.md)

Milestone 1 provides the application shell, required routes, Supabase client boundaries, Vitest unit tests, and Playwright route smoke tests. Milestone 2 adds a versioned, workspace-scoped Supabase schema with RLS and database contract tests. Milestone 3 adds a functional CRM dashboard using typed demo fixtures; persistence and funnel automation are still gated behind the authenticated integration slice.

## Included
Next.js App Router shell; npm workspaces; strict TypeScript; Tailwind; ESLint; Supabase browser/server client factories; Vitest; Playwright; seven platform routes; domain package boundaries; environment template; implementation docs; CI.

## Not implemented yet
Authentication, hosted Supabase project connection, Apollo/API connections, AI requests, provider webhooks, active n8n workflows, email sending, booking sync and proposals. The route shell contains no live CRM data. No GitHub remote or deployment is created.

## Run
Requires Node.js 22.13+ and npm.

```sh
npm ci
cp .env.example apps/web/.env.local
npm run dev
```

Open http://localhost:3000. The overview runs without credentials.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Playwright route smoke tests run separately with `npm run test:e2e`. Install Chromium once with `npx playwright install chromium`. `npm run check` includes the browser tests.

## Ownership
| Location | Responsibility |
| --- | --- |
| apps/web | UI, session boundary, thin request handlers |
| packages/database | Workspace-scoped persistence contracts and future repositories |
| packages/ai | Qualification, research, drafting and classification contracts |
| packages/outreach | Send preflight; future approval, sequences and dispatch |
| packages/integrations | Provider interfaces; future adapters |
| packages/shared | Domain types and job envelopes |
| supabase | Versioned migrations, RLS contract tests, synthetic seeds, optional Edge Functions |
| workflows/n8n | Sanitized inactive workflow exports |
| docs | Architecture, data model, funnel, integrations and operations |

Engineering rules live in [AGENTS.md](AGENTS.md); dependency decisions in [docs/dependencies.md](docs/dependencies.md). `npm run check` runs typecheck, lint, unit tests and build. Integration checks are additionally required when applicable; each milestone also requires a git diff review. Failed or unavailable required checks mean the milestone is incomplete.

Start implementation with [docs/roadmap.md](docs/roadmap.md). See [docs/verification.md](docs/verification.md) for the actual checks performed.

## Documentation references
- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/docs/guides/database/postgres/row-level-security

Dependencies are pinned during scaffold and database verification; review updates before production deployment.

# Dependency decisions

Direct dependencies are pinned and the lockfile is committed. Record a justification before adding production dependencies.

| Dependency | Owner | Purpose / alternatives |
| --- | --- | --- |
| next | web | Requested App Router framework; a custom server would duplicate routing and rendering infrastructure. |
| react / react-dom | web | Rendering runtime required by Next.js. |
| zod | ai, outreach, integrations | Required runtime validation for structured AI output, send-context input, and Apollo payloads; TypeScript alone cannot validate untrusted provider responses. |
| @supabase/supabase-js | web | Official Supabase data/auth client required by the chosen stack; hand-written HTTP clients would duplicate session and API behavior. |
| @supabase/ssr | web | Official cookie-aware browser/server client helpers for Next.js SSR; avoids custom session-cookie plumbing. |

Workspace package dependencies are internal code boundaries, not external libraries.

Development/test/build tooling: TypeScript and @types packages for strict checks; ESLint and eslint-config-next for required lint and framework rules; Tailwind, its PostCSS plugin and PostCSS for the requested CSS build. These remain devDependencies; the build environment must install them. Vitest replaces the temporary Node test runner and Playwright provides route-level browser smoke tests. The Supabase CLI creates and verifies migrations with the project's pinned toolchain. PGlite executes database regression tests against a PostgreSQL-compatible WebAssembly runtime when Docker is unavailable; it validates migration SQL and database behavior but does not replace a hosted Supabase Auth/Data API check. `@supabase/supabase-js` is used by the server-only database adapter; the adapter receives an already-authenticated trusted client and does not expose credentials. All are development-only except the requested runtime libraries. No Apollo SDK is installed because the provider uses the documented HTTP API behind a validated adapter. The AI package uses the platform Responses API over server-side `fetch`; no OpenAI SDK is added, avoiding an additional runtime dependency while keeping the API key out of browser bundles.

References: https://zod.dev/basics, https://nextjs.org/docs/app/api-reference/config/eslint, https://tailwindcss.com/docs/installation/using-postcss.

Toolchain compatibility: TypeScript is pinned to 6.0.3 because the installed typescript-eslint peer range excludes TypeScript 7. ESLint 9 is retained for the Next.js React and accessibility plugins, whose peer ranges exclude ESLint 10. npm marks ESLint 9 deprecated; revisit the lint stack when those plugins support ESLint 10.

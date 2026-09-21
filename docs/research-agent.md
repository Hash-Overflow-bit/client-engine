# Company Research Agent

The research agent runs only for qualified leads and stores research at the
company level so multiple contacts reuse one fresh result. It fetches at most
six public pages from a small allowlist, follows at most two redirects,
enforces an eight-second timeout, caps response bytes and AI input text, strips
scripts/styles/HTML, and resolves every hostname before requesting it.

Localhost, loopback, private/internal ranges, cloud metadata, credentials in
URLs, and non-HTTP protocols are rejected. Structured output is Zod-validated:
verified signals and personalization angles require URL evidence, while
possible needs remain hypotheses. Missing evidence, inaccessible pages, invalid
output, or low confidence produce `needs_review` and
`usableForOutreach=false`.

Lifecycle: `qualified → researching → researched` or `needs_review`.
Fresh successful company research is reused for 24 hours by default. Each run
records provider, model, prompt version, input URL metadata, structured output,
confidence and status in `ai_runs`. Research never calls outreach or sending.

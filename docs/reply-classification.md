# Reply classification

Reply classification is review-only. The controlled intents are `POSITIVE`,
`QUESTION`, `NOT_NOW`, `NOT_INTERESTED`, `REFERRAL`, `OUT_OF_OFFICE`,
`UNSUBSCRIBE`, and `OTHER`. Recommended actions are suggestions, not
executed actions.

The latest inbound message is the target; only a bounded recent context is
provided for disambiguation. Ollama is the development default and OpenAI is
optional through the existing `AIProvider`. Structured output is validated by
Zod with one repair attempt. Every attempt is retained in `ai_runs`.

Explicit unsubscribe language is detected deterministically before model
output, sets `do_not_contact`, and always blocks follow-up. Any inbound reply
continues to block `canFollowUp`, including `NOT_NOW`, `OUT_OF_OFFICE`, and
`OTHER`. Human overrides are separate immutable records and take precedence
over confirmed AI results.

## Review closure

The `/replies` queue reads canonical message, classification, review, and
override records. It displays model intent and effective intent through
`getEffectiveReplyIntent`, whose precedence is human override, confirmed AI
classification, then unresolved AI output. Every controlled intent can be
selected; unsupported values are rejected by the shared Zod enum.

Confirmation, overrides, and needs-review markers are server-side,
workspace-authorized, immutable review events. Repeated requests are
idempotent. Selecting `UNSUBSCRIBE` sets `do_not_contact` and records a
deduplicated `contact_suppressed` activity. Later classification changes do
not clear suppression; removal is an explicit administrative action outside
this milestone.
Effective `POSITIVE` intent may prepare a meeting workflow. Raw AI intent is never read directly for this decision; override precedence remains central.

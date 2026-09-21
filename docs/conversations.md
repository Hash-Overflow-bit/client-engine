# Conversations and replies

Conversations are the application-level thread identity. Provider thread IDs
are optional metadata, never primary identity. A sent delivery seeds or links
one workspace/lead/email conversation; messages remain independent records and
retain their own immutable body and timestamps.

Manual reply capture uses `ManualInboundMessageSource`, authenticated server
actions, and workspace RLS. An inbound message is authoritative: the
conversation becomes `replied`, the lead moves to `replied`, and future
follow-up eligibility is false. Reply recording is separate from Mark Sent and
never performs an outbound operation.

The `canFollowUp` predicate is the required future guard. It rejects replies,
do-not-contact, unsubscribe state, workspace mismatch, unsent delivery, and
disallowed outbound state. Provider message IDs are deduplicated when present;
manual submissions use an explicit idempotency key without collapsing distinct
messages with identical bodies.

Milestone 10 adds immutable reply-classification records linked to the
conversation and inbound message. Classification does not change the
authoritative replied state or send a response; only explicit human review
may override the stored intent.

Lead detail reads the same canonical conversation and message records as the
reply review queue. Outbound snapshots and inbound bodies are rendered in
chronological order, and each classified inbound message shows AI intent,
effective intent, confidence, summary, recommended action, review state, and
whether a human override exists. The UI never derives precedence locally.

Classification review actions require an authenticated workspace member and
run only on the server. They create immutable review/override records and
deduplicated activities; they do not send mail or invoke an outbound provider.

Follow-up tasks reference the canonical conversation and sent delivery. An
inbound message remains the authoritative stop signal: the lead-stop trigger
cancels scheduled/due tasks while preserving their history, and any due
processor re-checks `canFollowUp()` before exposing work as due.
Follow-up draft generation treats the conversation as outbound-only context. An inbound message always suppresses generation through the canonical reply predicate.
Meeting briefs consume a bounded canonical timeline. Only inbound messages and outbound messages confirmed as sent are prospect-visible context.

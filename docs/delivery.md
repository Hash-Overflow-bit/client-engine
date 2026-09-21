# Delivery foundation

Milestone 8 deliberately stops at assisted delivery. An approved outreach
draft can be prepared through the provider-neutral `DeliveryProvider` port.
The current `ManualDeliveryProvider` snapshots recipient, subject, body,
draft ID, and version without making a network request.

## Lifecycle

`approved draft → prepared delivery → human sends externally → mark sent`.
Preparation is idempotent per workspace, lead, draft version, and channel.
The delivery row is an immutable content snapshot for audit history. Mark
Sent records the human actor and timestamp, then advances a `ready` lead to
`contacted`; it does not send, enqueue, or call Gmail/SMTP/Apollo.

The global outbound kill switch continues to govern real network sends.
Manual preparation and copying are allowed because they have no network side
effect. Gmail draft creation is intentionally not implemented in this
milestone; it can be added behind the same provider port later.

When Mark Sent succeeds, it also seeds the canonical conversation for the
lead. Reply capture is a separate action and transitions that conversation to
`replied`; it never changes the meaning of the original delivery record.

Milestone 11 additionally creates a bounded follow-up opportunity plan after
Mark Sent. These records reference the sent delivery and conversation but do
not contain copy or a sent state. Reply/suppression/booking stops cancel the
remaining tasks, and due processing re-checks the canonical follow-up gate.
## Follow-up delivery

M13 extends the same manual delivery records with a mutually exclusive follow-up source. Prepared and sent are distinct: only explicit human-confirmed Mark Sent completes the related follow-up task and creates the outbound conversation message.

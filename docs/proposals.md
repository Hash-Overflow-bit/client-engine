# Proposal drafts

Proposal versions are immutable, evidence-bound review artifacts generated only from a recorded discovery outcome. Human pricing is authoritative: absent price produces `UNPRICED`; mismatched AI pricing is flagged for review. Approval is content approval only—no email, contract, invoice, payment, acceptance, or deal-won transition occurs.

## Lifecycle

Generated proposals enter `draft` when they require extra review, otherwise `ready_for_review`. Only `ready_for_review` can transition to `approved` or `rejected`. Approved and rejected rows are historical and immutable. A human edit creates a new `ready_for_review` version, retaining the same meeting, discovery outcome, and original AI provider/model/prompt provenance. Regeneration likewise creates a new version and AI run.

## Pricing authority

The server validates every human price: `UNPRICED` has no numeric fields; `FIXED` has only `amount`; `HOURLY` has only `hourlyRate`; and `RANGE` has ordered `min`/`max`. An AI result is checked against the supplied human price and cannot alter it.

## Approval semantics

Approval records the operator and timestamp, emits an idempotent activity, and may move the canonical lead from `meeting` to `proposal`. It never sends a proposal, marks it accepted, creates a contract/invoice/payment, or marks a deal won.

An approved proposal may be explicitly linked to one OPEN deal. Creating or approving a proposal never records a win; only the later authenticated deal-outcome action can do that.

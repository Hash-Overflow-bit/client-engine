# Deals and outcomes

`deals` is the canonical, workspace-scoped record of commercial outcome. A deal is created explicitly from an approved proposal and begins `open`. Only an authenticated workspace member can close it as `won` or `lost`; closed deals are immutable in M17.

## Value and outcome

Proposal pricing remains historical. A fixed approved proposal can prefill an open deal's potential value, but Mark Won requires the operator to explicitly confirm the final agreed value and ISO currency. The final value may differ from the proposal. No AI, payment, contract, invoice, or external system determines an outcome.

`won` means the human confirmed the engagement was secured. It moves a lead from `proposal` to `won`. `lost` requires a controlled reason and may move the lead from `proposal` to `lost`; no customer history is deleted.

## Attribution

Deals retain proposal, lead, company, meeting, source, campaign (when known), and controlled service references. Missing attribution is represented as `UNKNOWN`, never guessed.

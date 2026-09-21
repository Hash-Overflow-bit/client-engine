# Funnel — Milestone 0

Canonical business journey:

`discovered → enriched → qualified → researched → ready → contacted → replied → interested → meeting → proposal → won`

The goal is two unique new paying clients per calendar month. This is an outcome target, not a conversion guarantee. The product specification defines counting and assumptions. Stage names below are authoritative for future implementation; prior scaffold labels must be aligned later.

## Stage entry and exit evidence

| Stage | Required entry evidence | Next action / owner |
| --- | --- | --- |
| discovered | Source identity and company captured; deduplicated contact | Enrichment job within API budget |
| enriched | Relevant company/contact fields populated with provenance; missing data explicit | AI qualification against operator ICP |
| qualified | Recorded fit decision, reasons, evidence and reviewed uncertainty | Company research job |
| researched | Source-linked observations reviewed; no fabricated or unsupported personalization | Draft outreach and follow-up revisions |
| ready | Verified usable address; operator-approved exact draft revision; policy eligibility and no stop flags | Schedule bounded dispatch; worker rechecks at send time |
| contacted | Initial message accepted by outbound provider with a recorded identifier | Await reply; eligible approved follow-ups only |
| replied | Authenticated incoming reply matched to contact, regardless of sentiment | Immediately stop all cold follow-ups; then classify |
| interested | Explicit positive intent in the conversation, confirmed by operator for pilot | Operator-approved booking invitation |
| meeting | Calendly booking reliably matched to the contact | Prepare evidence-backed brief; operator conducts meeting |
| proposal | Operator-approved proposal actually sent with manually chosen commercial terms | Operator follows up and negotiates manually |
| won | Operator confirms agreed work and first payment/deposit with evidence | Record unique new client win; close acquisition work |

An uncertain send outcome does not advance to contacted and must not cause blind retry. Delivery/bounce events remain separate message statuses. Preparing a proposal draft does not count as proposal sent. Booking or positive intent does not count as a win.

## Off-path outcomes

Rejected qualification, missing data, stale evidence and invalid addresses enter review or archive. Unsubscribe, do_not_contact and hard bounce suppress sending. A negative reply ends the cold sequence and may be archived. All out-of-office replies also stop; no automatic resume. Meeting cancellations, no-shows and reschedules change booking status and create an operator task without restarting outreach. Proposal rejection records lost and closes the opportunity.

Keep stage history, current opportunity stage, enrollment state, delivery status and suppression separate. Suppression always overrides stage. Re-importing or changing a stage never clears it. The linear funnel describes the usual journey, not a command to fabricate missing events: a direct booking can move an opportunity to meeting with booking provenance while reply/interest metrics stay uncounted if those events never occurred.

## Sequence policy

- Pilot: approval-only, production-only, with an explicit global enable switch and per-campaign activation.
- Proposed workspace caps: 10 first-contact recipients/day; 20 total outreach messages/day. Count across campaigns and workers, not per workflow execution.
- At most two individually approved follow-ups at 3 and 7 business days after initial contact, within the configured workspace timezone/sending window. Delayed execution never sends multiple overdue steps in one catch-up burst; send at most one and recalculate remaining eligibility.
- Any reply stops follow-ups before classification. No automatic post-reply sales sequence or automatic resumption. An interested reply creates a task for the operator, not permission to send a booking email.
- Unsubscribe/do_not_contact prevent future outreach across all campaigns and known contact aliases. No duplicate active contact enrollment; suppressions survive re-import.
- Recheck exact revision approval, stop flags, mailbox health and atomic caps immediately before each dispatch. Approval of the first email does not approve later edits or follow-ups.
- No price negotiation or contract acceptance by the engine. Drafts can support the operator; commercial decisions and sends remain explicit human actions.

See architecture.md for the reply-versus-in-flight-send limitation and the required serialized stop boundary.

## Metrics and attribution

Store immutable stage events with contact, company/client, opportunity, campaign, actor and occurrence/receipt timestamps. Use and display the configured workspace timezone before calculating monthly results. Calendar-month wins count distinct client organizations whose first confirmed paying engagement occurs in the month, once; returning engagements are separate revenue, not a new client. Contact aliases and multiple employees at one company must not inflate wins.

Track eligible unique leads, initial contacts, delivered initials, total sends, any replies, positive replies, bookings, held meetings, sent proposals and wins separately. A bounce does not count as delivery. Exclude internal tests. Use distinct contacts for reply rates and distinct client/opportunity counts for commercial outcomes; disclose denominators. Compare a fixed initial-contact cohort over a stated observation window so month-end lead volume is not divided into wins from older cohorts.

The product-spec planning model is a hypothesis. Weekly review identifies the stage with the largest evidence-backed loss and adjusts ICP, offer or message quality within approved limits. Never increase sending autonomously to chase the monthly target.

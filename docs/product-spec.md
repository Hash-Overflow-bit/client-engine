# Milestone 0 product specification

Status: specification prepared and coordinating-agent architecture review completed; see architecture.md and verification.md. This is a specification, not an implemented system. The existing foundation scaffold predates this milestone and is not a Milestone 0 production-code deliverable.

## Outcome and operator
Help one solo freelance developer acquire a target of **2 new clients per calendar month** through controlled, evidence-backed prospecting. This is a business target, never a guarantee or technical acceptance condition. The operator owns positioning, relationship decisions, prices, proposals and contracts.

The operator configures an ideal customer profile (ICP), reviews prospects and sources, approves individual messages, handles replies, prepares meetings, sends proposals and records outcomes. Start with one workspace and one operator; enforce membership isolation from the outset.

## Scope
V1 covers Apollo discovery/enrichment, deduplication, explainable qualification, sourced research, AI-assisted drafting, individual approval, bounded follow-ups, reply capture/classification, Calendly booking visibility, Google Calendar reconciliation, meeting briefs, proposal drafting and funnel reporting.

Use Next.js App Router, strict TypeScript and Tailwind for the interface; Supabase/Postgres for durable records and Auth; n8n for orchestration; OpenAI behind validated server-side adapters. External email sending/reply provider remains an explicit pre-pilot decision. Provider connections are planned, not working functionality.

Deferred: auto-send campaign policies, unattended outreach approval, mass campaigns, autonomous pricing/negotiation, contract acceptance, payments execution and multi-operator collaboration. AI may draft a proposal using operator-supplied terms; only the operator chooses or changes prices, sends a proposal or accepts a contract.

## Required journey and stage gates
The reporting funnel is exactly **discovered → enriched → qualified → researched → ready → contacted → replied → interested → meeting → proposal → won**. Store stage history and underlying facts separately; suppression and closure are independent states, not extra funnel stages. Never invent intermediate stage completions when real events skip a step.

| Stage | Evidence required to enter |
| --- | --- |
| discovered | Workspace-owned source record with stable source identity and import provenance; deduplication checked. |
| enriched | Usable contact/company information with field provenance; unresolved identity/email verification remains flagged. |
| qualified | Fit against the operator-approved ICP, with reasons, evidence and recorded threshold decision; unknown enters review. |
| researched | Reviewed factual observations linked to source URL, excerpt and retrieval timestamp; unsupported claims remain unknown. |
| ready | Verified usable address and exact initial draft recipient, subject and body approved as an immutable revision; current policy checks pass. Editing removes readiness. |
| contacted | Outbound provider acceptance confirmed or reconciled for the initial message; this does not assert inbox delivery. |
| replied | Any attributable inbound reply, including negative or out-of-office; stop the sequence before intent classification. |
| interested | Explicit positive intent confirmed by the operator for the pilot; AI suggests a classification, and uncertainty stays in review. |
| meeting | Confirmed booking, linked to contact and booking identity; track attendance, cancellation and reschedule separately. |
| proposal | Operator explicitly sent a versioned proposal with operator-approved price and terms. |
| won | Operator confirms agreed work and first payment/deposit for a new client, with evidence and acquisition date. |

## Outreach invariants
- Sending starts disabled. Every non-production environment, including development, hard-blocks real outbound delivery regardless of approval, credentials or campaign state.
- V1 requires individual human approval for **every** initial message and follow-up. Approval binds workspace, recipient identity/address, subject, body and immutable revision; relevant edits or policy/connection changes require fresh approval. Approval never overrides a stop condition.
- Any reply immediately latches a contact stop and cancels queued follow-ups before AI classification. Out-of-office, negative replies, uncertain intent, provider replay or later classification never automatically resume outreach. Post-reply human relationship handling is separate from cold outreach; the engine does not restart the cold sequence.
- Unsubscribe, `do_not_contact`, hard bounce and booking stop dispatch. Imports, enrichment, job retries, cancellation and rescheduling must not clear suppression or restart a sequence. Unsubscribe/`do_not_contact` cannot be cleared by ordinary campaign enrollment or draft approval.
- Recheck membership, recipient identity/address verification, approval, suppression, reply/booking stops, global/campaign enable switches, connection state, due time, environment and quota in the serialized dispatch path immediately before provider handoff. Record whether a racing stop arrived before or after that irreversible handoff; a message already handed off may be impossible to recall.
- Default configurable pilot caps: **10 new contacts/day and 20 total automated outreach messages/day per workspace**, across all campaigns and initial/follow-up attempts. Require explicit operator configuration for any increase; no AI adjustment. Reserve capacity atomically before handoff; uncertain outcomes retain reservations until reconciliation. Confirmed no-handoff failures may release them.
- At most **2 follow-ups**, eligible after **3 and 7 business days from the initial confirmed send**, respectively, subject to fresh individual approval. Business days are Monday–Friday in the configured workspace timezone; the pilot does not exclude holidays. Allowed local sending hours must be chosen before live use. A missed window never produces a catch-up burst or shifts the second offset from the first follow-up.
- Use persisted jobs and due times. A denied dispatch sends nothing and records a reason. Ambiguous provider outcomes pause that message and subsequent follow-ups for reconciliation; never blindly resend.
- One active prospect identity and sequence per workspace/contact; match canonical contact/email and provider identifiers with unique constraints. Resolve uncertain identity manually. Do not merge people merely because names match or strip email aliases without verified identity evidence.
- Personalization must be supported by captured evidence. No invented visits, shared interests, relationships, business problems or compliments presented as observations. Research and AI text have no instruction or tool authority.

## Operator surfaces and recoverability
Provide a funnel list with stop/review badges; contact detail with source evidence and activity; an approval queue showing the exact recipient/content; a reply inbox with stopped status; booking/brief and proposal views; and a health view showing failed jobs, ambiguous sends, credits and quota. Empty/unconfigured states must be explicit. Every material mutation records actor, workspace, timestamp and reason; sensitive message content is restricted to authorized records, not copied into routine logs.

The operator can disable sending immediately, inspect/reconcile provider outcomes and cancel pending work. A stopped contact remains visible for human relationship handling. An inbound failure, stale ingestion health beyond a configured bound, or unavailable suppression store fails dispatch closed; health thresholds must be configured before a live pilot.

## Measurement
Count **unique new client organizations** with their first confirmed paying engagement and `won_at` in the selected calendar month, evaluated in a persisted workspace reporting timezone. Repeat projects, duplicate contacts at the same client and replayed confirmations do not add new clients. Store contact-to-client identity and correction history; report wins without an attributable campaign separately. Select attribution rules before the pilot; proposed default is first accepted outreach campaign, retained through later touches.

Show distinct counts and timestamps for each stage plus accepted sends, delivered messages where confirmed, any replies, positive replies, confirmed bookings, attended meetings and sent proposals. Separate activity-in-period reports from conversion cohorts. Cohort conversion uses the same initial-contact cohort and observation cutoff; each denominator is explicit, with zero denominators shown as unavailable. Replies per unique contacted prospect must not use total follow-up messages as the denominator.

Illustrative planning only: 120 unique contacted prospects/month × 10% positive reply × 50% held meeting among positive replies × one-third won among held meetings = 2 clients. This compressed model does not remove the intermediate funnel stages; none of its rates is a measured benchmark or promise. A full three-message sequence for all 120 contacts consumes at most 360 messages, or 18/day averaged over 20 sending days. Actual scheduling must still obey each daily cap and include carryover from prior cohorts. At 20 total/day and three messages per prospect, steady-state capacity is about 6.7 new prospects/day, below the 10-new daily ceiling. Lower conversion calls for better fit, offer or conversion, never automatic quota increases.

## Exit criteria and decisions
Milestone 0 is technically complete only when the product, architecture, funnel, threat-model and acceptance specifications agree; all required repository verification commands and diff review are recorded honestly; open choices are named; and the coordinating agent records its architecture review. Until that review and verification, status remains pending. Acceptance scenarios describe future behavior and do not count as executed integration tests.

Live-pilot readiness additionally requires implemented and passing critical acceptance scenarios, authenticated workspace isolation, a verified outbound/reply provider, approved ICP/offer and evidence policy, working stop ingestion/reconciliation, configurable caps/timezone/hours and operator-approved test recipients. Production activation is a separate explicit operator action. The 2-client business target is assessed from actual monthly outcomes after launch.

Open decisions before implementation/pilot: ICP and offer; outbound/reply provider and verified API contract; email verification policy; supported research sources and retention/deletion periods; qualification/classification thresholds; send-hour policy and timezone; inbound-health freshness bound; client identity and attribution approval; consent/suppression recovery procedure. Do not assume credentials or provider capabilities to settle these choices.

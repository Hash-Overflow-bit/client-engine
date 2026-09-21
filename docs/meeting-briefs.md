# AI meeting briefs (Milestone 15)

Briefs are explicit, immutable human-preparation artifacts for upcoming scheduled meetings. They use only bounded canonical CRM context: lead/company data, current company research, actual inbound messages, and canonical outbound messages that were marked sent. Approved or rejected drafts are never represented as prospect-visible content.

The structured output separates verified facts, explicit prospect needs, assumptions, and unknowns. Possible needs remain assumptions. Controlled services and portfolio entries are validated. Pricing remains unknown unless explicitly stated; no price, proposal, calendar write, message, or meeting mutation is produced.

Company research older than 24 hours is allowed with a visible stale-context warning and `needs_review`. A new conversation message changes the context key, preserving the prior brief and enabling explicit regeneration. M11–M14 hosted and browser validation gates remain open.
Meeting briefs may inform human discovery capture, but they are never treated as a transcript or an authoritative discovery outcome.

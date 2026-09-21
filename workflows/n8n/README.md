# Workflow exports
No active workflows yet. Commit sanitized, inactive n8n JSON exports here after adapter implementation.

Planned workflows: discovery, enrichment, qualification, research, drafting, dispatch, reply ingestion, intent triage, booking sync, meeting brief.

Each job carries workspace ID, correlation ID and idempotency key. Verify webhook signatures before durable event insertion. Acknowledge after durable storage. Retry transient failures with bounded backoff; route exhausted jobs to review. Never retry an uncertain send blindly. Store credentials in n8n credentials, never exported JSON. Keep domain rules in packages, not Code nodes.

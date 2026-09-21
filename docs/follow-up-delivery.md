# Follow-up delivery (Milestone 13)

An approved follow-up draft remains content only. A workspace member may prepare one manual delivery snapshot for its due task, send it externally, then explicitly record that human action.

The delivery record has exactly one source: an initial outreach draft or a follow-up draft. Follow-up rows reference their task, draft/version, sequence step, purpose, and canonical conversation. Preparation and Mark Sent both re-run `canFollowUp()`. Reply, unsubscribe, do-not-contact, campaign stop, invalid task state, or workspace mismatch prevents a sent state.

Mark Sent creates the outbound canonical message and completes only that due task. Existing later M11 tasks remain unchanged. No provider send operation exists.

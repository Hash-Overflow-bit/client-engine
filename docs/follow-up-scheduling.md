# Follow-up scheduling

Milestone 11 provides a bounded, auditable opportunity schedule. It does not
generate follow-up copy and it has no send authority.

## Policy

The controlled `assisted-v1` policy creates three opportunities after an
explicitly marked sent delivery:

| Step | Offset | Purpose |
| --- | ---: | --- |
| 1 | 3 days | `VALUE_FOLLOW_UP` |
| 2 | 7 days | `SECOND_TOUCH` |
| 3 | 14 days | `CLOSE_LOOP` |

The policy is defined in `packages/follow-ups`, not scattered through route
handlers. Due timestamps are stored as `timestamptz`. The initial calculation
uses deterministic UTC calendar-day arithmetic; a trusted workspace timezone
or sending window can be introduced later without changing the task model.

## Lifecycle

`sent delivery → scheduled tasks → due candidate → canFollowUp re-check → due or cancelled`

All three bounded tasks are created after Mark Sent, with a unique
`workspace_id + delivery_id + policy_id + sequence_step` key. A retry reuses
the existing rows. Cancelled, skipped, and completed history is retained.
M11 does not mark a task completed because no follow-up delivery exists yet.

## Safety gate

`canFollowUp()` is the only eligibility predicate. It checks workspace scope,
inbound reply, suppression, do-not-contact, sent delivery, lead stage,
campaign activity, and outbound safety. The scheduler never copies these
rules into a second predicate. Every due candidate is checked again, and a
second read immediately before the due transition reduces the reply race
window. The database lead-stop trigger cancels scheduled/due rows when a
reply, suppression, or booking stop is persisted. A reply committed after
that final read can leave a transient `due` row until the trigger or the next
eligibility pass handles it; M11 has no send authority, and any future sender
must recheck the predicate transactionally before delivery.

The global kill switch and non-production environment rules prevent a task
from becoming actionable, while already-created schedules remain auditable.
This milestone never sends, queues, or generates a message.

## Manual controls

Authenticated workspace members can inspect `/follow-ups`, skip an active
task, cancel an active task, cancel remaining tasks in a conversation, or
reschedule a pending task. Every mutation is server-side, RLS-scoped, and
records an idempotent activity (`follow_up_scheduled`, `follow_up_due`,
`follow_up_cancelled`, `follow_up_skipped`, or `follow_up_rescheduled`).

No action is named or implemented as Send or Generate Follow-Up.
## Draft generation boundary

Milestone 12 may generate reviewable content for an eligible due task, but does not send it or complete the task. `canFollowUp()` is checked before and after generation; any reply cancels actionability.
When a canonical meeting is recorded, remaining cold follow-up tasks are cancelled with `MEETING_BOOKED`; historical completed tasks are retained.

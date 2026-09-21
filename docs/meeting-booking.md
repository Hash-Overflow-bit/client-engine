# Meeting booking (Milestone 14)

The application meeting is the canonical record. A `POSITIVE` effective reply intent, including authoritative human overrides, may prepare a manual booking action. Preparation returns a configured workspace booking URL when present, but it never sends, books, or changes lead stage.

Manual recording validates membership, lead/conversation ownership, time range and timezone, and an idempotency key. Only a persisted meeting moves the existing canonical lead stage to `meeting` (the project’s current equivalent of `meeting_booked`) and cancels remaining normal cold follow-up tasks with `MEETING_BOOKED` while preserving history.

`ManualBookingProvider` is the zero-cost default. The workspace setting may select `calendly` and store a URL, but no Calendly API/webhook or Google Calendar write is implemented. M11–M13 hosted/RLS/browser validation gates remain open.
Meeting briefs in M15 are read-only preparation artifacts; they do not alter the booked meeting, booking configuration, or delivery state.

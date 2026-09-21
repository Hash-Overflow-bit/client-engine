# Funnel analytics

M17 analytics are deterministic, workspace-scoped, and descriptive only. They do not rank leads, predict wins, or recommend campaign changes.

| Metric | Canonical source |
| --- | --- |
| Discovered | lead `created_at` |
| Qualified / researched | matching AI run timestamps |
| Contacted | sent delivery |
| Replied | inbound message |
| Positive replies | centralized effective reply intent |
| Meetings | persisted non-cancelled meeting |
| Proposals | persisted proposal version |
| Won / lost | human-closed deal |

All metrics use 7-day, 30-day, 90-day, or all-time rolling timestamp windows. Conversion rates return unavailable when their denominator is zero. Pipeline value is OPEN deals only; won revenue is WON deals only. Currency totals and averages are grouped by ISO currency—M17 does not fetch FX rates or combine currencies.

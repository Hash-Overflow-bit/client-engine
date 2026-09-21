# Discovery outcomes

Discovery outcomes are authenticated human-entered records linked to one meeting. Explicit facts, requested features, budget disclosure, constraints, and unknowns are stored separately. AI does not transcribe meetings or infer a budget.

Budget status is controlled (`UNKNOWN`, `DISCLOSED`, `RANGE_DISCLOSED`, `NOT_DISCLOSED`, or `NOT_APPLICABLE`). Numeric values are accepted only for a disclosed fixed amount or disclosed range with an explicit ISO currency. Updating an outcome creates an auditable `discovery_outcome_updated` activity without replacing proposal history.

---
"@beep/langextract": minor
---

Add a deterministic `match_minimal_fold` alignment tier between the existing
case-insensitive and fuzzy tiers. It collapses whitespace and tries both
interpretations of end-of-line hyphens while preserving the exact raw source
slice and failing closed when any fold variant is ambiguous.

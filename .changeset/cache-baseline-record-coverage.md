---
"@beep/repo-configs": patch
---

Cover the cache baseline record policies (`recordCachePolicyBaseline`,
`cachePolicyBaselineFailures` and the subject helpers) with package-owned unit tests, and build
the recorded `reviews` from the stamped and carried entries directly so no unreachable fallback
remains. This restores the package coverage ratchet after the per-subject baseline change.

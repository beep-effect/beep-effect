---
"@beep/schema": patch
---

Document the upstream-first rule in the package README. Where upstream covers a
`foundation/modeling` concept's intent, its covered facets retire in the same PR that migrates
their consumers, with no alias; the whole concept retires unless the lines reading its uncovered
members outnumber the lines using its covered facets (ADAPT, per the facet census).

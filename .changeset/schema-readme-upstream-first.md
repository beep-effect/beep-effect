---
"@beep/schema": patch
---

Document the upstream-first rule in the package README: concepts that upstream Effect covers are
retired in the same PR that migrates their consumers, with no alias left behind. The ADAPT exception
is stated too: covered facets retire, and uncovered facets that carry most consumer lines stay.

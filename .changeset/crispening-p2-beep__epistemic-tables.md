---
"@beep/epistemic-tables": patch
---

Crispen `@beep/epistemic-tables` for the P2 repo-crispening wave: add a package-local `S.toArbitrary` converter law proving generated `UsageRecord` entities round-trip through the table insert/select row converters while preserving concrete SQL `null` row absence, and record cross-package static-colocation ripples for the domain-owned `UsageRecord` schema as deferred exceptions. Public converter signatures and encoded row shapes remain unchanged.

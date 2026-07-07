---
"@beep/architecture-lab-tables": patch
---

Crispen `@beep/architecture-lab-tables` for the P2 repo-crispening wave: add internal WorkItem SQL insert/select row schemas that preserve concrete SQL `null` row absence, route WorkItem converters through those row codecs without changing public signatures, and add package-local fixed row-shape snapshots plus `S.toArbitrary` projection laws for WorkItem and Worker table converters. Public encoded row shapes remain unchanged.

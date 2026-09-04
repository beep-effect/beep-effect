---
"@beep/repo-cli": patch
---

Register `@beep/freshbooks` in the deterministic CI lane partition table so the
partitioned Lint and Test Unit lanes place its executable tasks. The new driver
package is assigned to the lightest bin in each lane (`lint-a`, `unit-a`) per the
recorded LPT methodology; the signed bin-count fixture is updated to match.

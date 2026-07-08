---
"@beep/fc-runs": patch
"@beep/test-utils": patch
"@beep/schema": patch
"@beep/utils": patch
"@beep/pglite": patch
---

one-round-loop P1: relocate the env-max `fcRuns` helper (with `DEFAULT_FC_NUM_RUNS`, `parseFcNumRunsFloor`, `envFcNumRunsFloor`) out of `@beep/test-utils` into a new leaf package `@beep/fc-runs`, upstream of the whole `@beep/test-utils` dependency closure. `@beep/test-utils` re-exports it, so existing `import { fcRuns } from "@beep/test-utils"` sites are unchanged. This lets `@beep/schema`, `@beep/utils`, and `@beep/pglite` — which `@beep/test-utils` depends on — import `fcRuns` directly from the leaf without forming a package cycle, closing the codemod carve-out that had left the schema property suite (the repo's most property-heavy package) opted out of the `BEEP_FC_NUM_RUNS` env-max floor. The numRuns→fcRuns codemod now routes closure files to `@beep/fc-runs` instead of skipping them.

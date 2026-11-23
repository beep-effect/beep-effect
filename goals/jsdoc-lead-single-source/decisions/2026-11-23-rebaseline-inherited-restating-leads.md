---
title: "Re-baseline restating-lead to 8,758 for the 32 leads two PRs added before #3496 merged"
date: 2026-11-23
lane: "fix/jsdoc-ratchet-restating-lead-main"
reversal: "Remove the 32 attributed leads in the last P1 sweep wave (PLAN.md: CI-closure and P5 runner packages last) and lower the baseline with jsdoc-ratchet --write-baseline"
---

Main at 37f350c4c4d failed `quality:jsdoc-ratchet:regenerated` with `restating-lead: 8758 > 8726 (+32)`.
#3496 computed the 8,726 baseline at its branch base (0e305a468a0). Two PRs merged between that base
and #3496's merge and added restating leads that the baseline never saw:

| PR | File | Rows |
| --- | --- | --- |
| #3439 | `packages/foundation/modeling/identity/src/Term.ts` | +17 |
| #3439 | `packages/tooling/tool/cli/src/commands/Identity/Registry.ts` | +3 |
| #3439 | `packages/foundation/modeling/rdf/src/NamespacePin.ts` | +2 |
| #3439 | `packages/foundation/modeling/identity/src/Registry.ts` | +1 |
| #3439 | `packages/tooling/tool/cli/src/commands/Identity/index.ts` | +1 |
| #3439 | `identity/src/Curie.ts`, `identity/src/Vocab.ts`, `rdf/src/Rdf.ts` (leads removed) | -4 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiFailures.ts` | +4 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiMainFeed.ts` | +4 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiJobAdapter.ts` | +3 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiFeedArtifact.ts` | +1 |

Net: #3439 +20, #3493 +12, total +32; #3497 added none. Every added row sits in a runner-bundle
package (`@beep/identity`) or in repo-cli `Ci/` closure source, so this lane may not sweep them
outside the orchestrator's sequencing. The baseline is rewritten to 8,758 and the 32 rows join the
last P1 sweep wave, the one the P1 checkpoint in PLAN.md schedules as "CI-closure and P5 runner
packages last". That wave covers `@beep/identity`, `@beep/infra-ci-runners`,
`@beep/alchemy-github-runners`, `@beep/schema` and the repo-cli `Ci/` closure files, these 32
rows included. The orchestrator merges it on the CI goals driver's sequencing, and its PR names
those packages.

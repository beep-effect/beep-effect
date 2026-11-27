# Cache baseline review: two cross-package reads declared on repo-cli

Dated 2026-11-27. Goal `route-soundness-repair`, slice 12 (PERIH-10). This is the review basis
for re-recording the cache baseline of the root subject and `@beep/repo-cli`.

## What changed

Classifying the 170 root-anchored cross-package literals in test code found two real reads that
no input declared and no dependency edge reaches. `@beep/repo-cli` now declares both on `test`,
`test:property` and `coverage`:

| Input added | Read by |
| --- | --- |
| `apps/professional-desktop/src/runtime/Layer.ts` | `observability-catalog.test.ts` runs the catalog check over it |
| `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json` | `goal-data-consumer-census.test.ts` asserts it is tracked and declared |

The root subject `//` records the digest of every per-package `turbo.json`, so it is re-recorded
for the changed file.

## What did not change

No task gained or lost an output. No environment entry, pass-through variable, dependency edge
or cache flag changed. The override starts from `$TURBO_EXTENDS$`, so the root inputs stay in
force.

## Effect on cached results

The new inputs change the `test`, `test:property` and `coverage` hashes of `@beep/repo-cli`, so
its cached results are not reused across this change. That is the intent: an edit to either file
now reruns, and under `--affected` selects, the repo-cli tests that read it.

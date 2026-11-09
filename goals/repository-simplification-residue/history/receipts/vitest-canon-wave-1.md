# #1875 Effect Vitest canon wave 1: record

Lane `residue-vitest-canon`, branch `test/residue-vitest-canon-w1` off `main`
`e3ee18dfd7`. Source evidence: the Stage 4 reconciliation receipt
[goals/repository-simplification-confidence/history/receipts/stage-4-vitest-reconciliation.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-4-vitest-reconciliation.md)
(cohort table, preserved exports, identity mapping). The detector lane #1855 owns
detector policy; the two repairs below are recorded for it.

## Fresh measurement at `e3ee18dfd7`

`bun run beep lint effect-vitest`: 1,466 files, 1,917 findings, `introduced=0
resolved=23`. The generated inventory `standards/effect-vitest.inventory.jsonc`
holds 1,940 rows: **751 open** and 1,189 exceptions, which matches the opening
snapshot. The 23 resolved rows are 19 open and 4 exception rows that main had
already fixed before this wave.

Open rows by rule at the base:

| Rule and class | Rows | Files |
| --- | --- | --- |
| EV002 unresolved-layer-provide | 179 | 36 |
| EV010 platform-resource-provenance-review | 163 | 162 |
| EV006 hand-rolled-data-assertion | 86 | 20 |
| EV014 resource-layer-without-hook-timeout | 46 | 23 |
| EV009 unjustified-live-test | 45 | 7 |
| EV010 platform-filesystem-candidate | 42 | 42 |
| EV003 resource-wrapper | 32 | 14 |
| EV004 shorter-scope-lifetime-review | 29 | 12 |
| EV004 inner-helper-scope-lifetime-review | 27 | 17 |
| EV015 shared-test-clock-adjustment | 27 | 10 |
| EV001 runtime-boundary-in-test | 23 | 9 |
| EV004 redundant-whole-body-scope | 12 | 6 |
| EV011 plain-vitest-with-effect | 10 | 10 |
| EV004 helper-scope-lifetime-review | 6 | 5 |
| EV007 direct-arbitrary-check | 6 | 6 |
| EV013 retry-loop-candidate | 5 | 3 |
| EV008 deferred-clock-wait-review | 4 | 3 |
| EV005 result-outcome-assertion | 3 | 2 |
| EV001 shared-helper-runtime-boundary-review | 2 | 1 |
| EV012 unproven-module-mock-review | 2 | 2 |
| EV004 shared-helper-scope-lifetime-review | 1 | 1 |
| EV008 controlled-clock-wait-review | 1 | 1 |

By package: `@beep/repo-cli` 623 rows in 196 files, `@beep/law-practice-server` 27,
`@beep/editor` 24, `@beep/libpff` 10, `@beep/test-runner` 9, and 58 rows across
30 further packages (5 or fewer each).

## Port of the preserved continuation

Every export cited by the Stage 4 receipt matches its recorded SHA256 (continuation
staged `70f994b8…` and committed `59a65a7c…`, detector-resources unstaged `fed0fc65…`
and committed `57b0379f…`, coverage follow-up `b09eed06…`, RDF unstaged `28028d3e…`,
RDF mbox `3f1f353b…`, Pacer mbox `7b54786d…`). The uncited
`continuation-code.patch` (SHA256 `357f5eac…`) is the committed continuation minus the
generated inventory, the exact `c921d9e11d..e4c608f9c1` delta #1575 applied.

[PR #1575](https://github.com/beep-effect/beep-effect/pull/1575) merged on 2026-10-09
as `4e82f6d942`, so the Port rows owned by #1875 were checked hunk by hunk against
current source. GNU `patch --dry-run` gave context results, and a line-presence check
tested each hunk's added lines in the current file.

- **Continuation code delta (52 files, 178 hunks): superseded, already on main.**
  139 hunks are present verbatim and 23 deletion-only hunks are already applied. The
  16 partial or absent hunks are equivalent-strength drift that #1575 resolved:
  per-module imports instead of the root `effect` barrel (person-match-portability,
  quality-scheduler, skills-command, step-git-exec, yeet-command-wiring,
  single-project-emit), `@effect/vitest` layer helpers instead of `Bun.spawnSync`
  in regenerate-merge-driver (same assertions, lines 48–59 and 136), a `Match`-based
  launcher parser in single-project-emit (lines 62–127), `A.map` projections in
  ratchet-diff (lines 68–108), and the full research card assertion set through
  `decodeFrontmatter` in research-command (lines 133–160). The `parseCard`
  test-kit export no longer has a source symbol to re-export.
- **Continuation staged notes (5 files): superseded by the #1575 correction.** The
  OPPORTUNITIES entry is already present, and `research/cli-consolidated-conflict-proof.md`
  exists as the "Post-#1506 integration record". That record deliberately replaced
  the staged note, which wrongly called local `e4c608f9c1` the head of #1506 (GitHub
  records `c921d9e11d`). Replaying the README, SPEC and digest hunks would restore
  that false claim, so they stay preserved in the export only.
- **Detector-resources WIP (6 files, 13 hunks): superseded, already on main.** 11
  hunks are present. The two partial hunks differ only in the
  `effect/process/ChildProcessSpawner` module path that main uses.
- **Coverage follow-up (2 files): superseded, already on main.** Both
  ci-lane-timings cases exist (`renders an unratified version without claiming a
  ratified context count`, `retains a pending job status and reports unavailable
  pickup timestamps`). The OPPORTUNITIES note exists in its rewritten form at
  line 2037.
- **RDF and Pacer Port rows:** owned by #1876 (`residue-rdf-pacer`), not this lane.

Net port result: zero source hunks to apply and nothing dropped. The preserved
exports remain the recovery path.

## Cohorts completed

Three whole packages, which together are every open row each package owned:

| Package | Rows | Files | Fix |
| --- | --- | --- | --- |
| `@beep/editor` | 24 EV009 | `test/mermaid-race.test.tsx` | `it.live` to `it.effect`. The bodies only bridge promises (`waitFor`, React `act`) and `Effect.yieldNow`, and never read the Effect clock or console. `waitFor` polls on JavaScript timers, which `TestClock` does not control. |
| `@beep/libpff` | 10 EV014 | `test/Libpff.pffexport.test.ts` | Explicit `{ timeout: 30_000 }` hook budget, the value the file already uses for its portable blocks. No test deadline changes. The 28 reviewed exception rows in this file are untouched. |
| `@beep/test-runner` | 7 EV014, 1 EV009, 1 EV015 | `test/Vitest.test.ts` | Four acquiring layer blocks get `{ timeout: "30 seconds" }`. The three `Layer.empty` blocks are detector false positives (repair 1). The live self-test now also asserts the live clock is past epoch zero after its sleep, a stronger check that repair 2 recognizes. The traced block no longer advances the clock its layer shares: it asserts `Clock.currentTimeMillis` is `0`, which a live clock never reports, so it still proves the test clock is installed. |

Rows after: `introduced=0 resolved=66` (the 23 pre-existing plus these 43). The
current scan has 1,874 findings, **689 open** and 1,185 exceptions. No exception,
baseline or inventory row was added, and the inventory was not rewritten.

## Detector repairs (for the #1855 owner)

Both live in `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestDetectors.ts`.
Their paired fixtures are in `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts`.
Each fixture fails with its repair removed and passes with it.

1. **EV014/EV002/EV003 `isPureStubLayer` accepts `Layer.empty`.** A provenance-checked
   `Layer.empty` reference (namespace, alias or named import) acquires nothing, like
   the already-pure `Layer.succeed`/`Layer.mock`.
   - Negatives (no EV014): `it.layer(L.empty)`, `it.layer(L.empty, { excludeTestServices: true })`,
     `L.mergeAll(L.empty, L.succeed(A, {}))`, and `import { empty } from "effect/Layer"`.
   - Positives (EV014 judgment kept): `Fixtures.empty`, a parameter-shadowed `L.empty`,
     and `L.mergeAll(L.empty, ImportedLive)`.
   - Rows it resolves: test-runner `Vitest.test.ts` lines 149, 153 and 363.
2. **EV009 recognizes Effect-valued live clock reads.** In Effect v4,
   `Clock.currentTimeMillis` and `Clock.currentTimeNanos` are `Effect` values
   (`node_modules/effect/dist/Clock.d.ts` lines 265 and 305), and `Clock.sleep` does
   not exist. The call-only check could never see a v4 live clock read.
   `liveClockRead` adds provenance-checked property-access references inside the
   live callback.
   - Negatives: `yield* Clock.currentTimeMillis` and `yield* Clock.currentTimeNanos`.
   - Positives: a `Fixtures.currentTimeMillis` lookalike, a locally shadowed `Clock`,
     and a bare `Fx.sleep`.
   - Rows it resolves: test-runner `Vitest.test.ts` line 120, together with that
     test's stronger assertion.

Neither repair resolved any other inventory row: the resolved count rose by exactly
the 43 rows above.

## Verification

Route: the wave started as a Cursor worker. Its argv is `cursor-agent -p --trust --force
--sandbox enabled --model claude-opus-5-5-medium --output-format stream-json`, under ruling
S38. The worker stopped on the Cursor Opus usage limit after the source, the receipt body and
the package runs were done. Under ruling S39, the driver session (`claude-opus-5-5`) finished
verification and the packet status.

Source heads. The checks below ran on the wave's tree, which is base `e3ee18dfd7` plus
this wave's changes, committed unchanged as `90ad185721`. The published branch then merged
main `7b2ee4f728` (`850823a6e7`). It also added the catalog-usage coverage commit
`a6138473f0` and this round's EV009 named-import repair. Both of those touch only
`@beep/repo-cli`, whose detector and catalog-usage suites, Effect diagnostics and the fallow audit were rerun on the final head. Hosted CI
on the PR head is the head-bound proof for the merged result.

| Check | Result |
| --- | --- |
| `bun run beep lint effect-vitest` | `introduced=0 resolved=66` (23 before this wave) |
| `@beep/editor` Node / Bun (`bunx vitest run`, `bunx --bun vitest run`) | 452 / 452 passed |
| `@beep/libpff` Node / Bun | 71 / 71 passed |
| `@beep/test-runner` Node / Bun | 41 passed, 5 expected fail, 3 skipped, 4 todo (53), on both runtimes |
| coverage ratchet: `@beep/editor`, `@beep/libpff`, `@beep/test-runner` | `ok` (epsilon 0.001); no floor dropped |
| detector suite `effect-vitest-detectors.test.ts` | 215 passed |
| `package-verify` `@beep/editor`, `@beep/libpff`, `@beep/test-runner`, `@beep/repo-cli` | all ok (audit and docgen) |
| `bun run beep goals doctor` | `blocking_new=0 blocking_inherited=0` |
| `oxlint` on the changed files | 1 inherited warning: `Vitest.test.ts` module-level `Effect.runSync(Clock.Clock)`, which main already has and this wave did not touch; no new findings |

## Remaining cohorts and order

689 open rows remain:

| Rule and class | Rows | Files |
| --- | --- | --- |
| EV002 unresolved-layer-provide | 179 | 36 |
| EV010 platform-resource-provenance-review | 146 | 145 |
| EV006 hand-rolled-data-assertion | 86 | 20 |
| EV010 platform-filesystem-candidate | 42 | 42 |
| EV003 resource-wrapper | 32 | 14 |
| EV014 resource-layer-without-hook-timeout | 29 | 21 |
| EV004 (all lifetime classes) | 73 | 40 |
| EV015 shared-test-clock-adjustment | 26 | 9 |
| EV001 (both classes) | 25 | 10 |
| EV009 unjustified-live-test | 20 | 5 |
| EV011 plain-vitest-with-effect | 10 | 10 |
| EV007 direct-arbitrary-check | 6 | 6 |
| EV013 retry-loop-candidate | 5 | 3 |
| EV008 (both classes) | 5 | 4 |
| EV005 result-outcome-assertion | 3 | 2 |
| EV012 unproven-module-mock-review | 2 | 2 |

By package: `@beep/repo-cli` 604 rows in 186 files, `@beep/law-practice-server` 27
(14 EV002, 9 EV004, 4 EV010), and 58 rows across 28 further packages.

Proposed order (each wave stays near 40 files):

1. **Wave 2:** close the timing and live-mode families this wave started: EV014 (29),
   EV009 (20) and EV015 (26), mostly in repo-cli.
2. **Wave 3:** `@beep/law-practice-server` EV002/EV004, plus the small leaf packages
   whose rows are not EV010.
3. **Wave 4:** repo-cli assertion and harness families: EV006 (74), EV005, EV007,
   EV011, EV012, EV013 and EV008.
4. **Wave 5:** the resource-lifetime families: EV001, EV003 and EV004.
5. **Wave 6:** EV002 unresolved-layer-provide (179 rows in 36 files), split by file
   cohort.
6. **Wave 7:** EV010 (188 rows), after the #1855 F-S31-EV010 provenance
   classification repair lands, so detector-owned false positives are not migrated
   by hand.
7. **Final wave:** a fresh zero scan, the canon goal's lifecycle to
   `completed-retained` and its reflection, in the same PR.

## Reversal

Revert the PR. The three test files return to their previous registrations, and the
two detector predicates and their fixtures are removed. The inventory was not
rewritten, so nothing generated needs regenerating.

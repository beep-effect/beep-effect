# Grok adversarial review, round 1 — effect-vitest-canon resource-next batch

Status: complete. Read-only. This batch review is not goal acceptance. Parent retains the original goal, including an empty final baseline.

Reviewed snapshot: `~/.cache/beep/effect-vitest-canon/resource-next-20261006/review`. Checkout named by the assignment: `effect-vitest-canon-resource-next`, base `ba4fe3389462a57445a22610dfc31d45566f2898`. Distinct from continuation PR 1506. Findings: `grok-findings-r1.jsonl` (three terminal findings).

Role: independent reviewer. No implementation, no git mutation, no snapshot or source edits, no network, no delegation, no other provider.

API source of truth: installed Effect in that checkout, `node_modules/effect` (4.0.1 layout). Cause is a flat `reasons` array.

- `findError` (`src/internal/effect.ts:157-164`) returns the first `Fail` and ignores later Fails, Dies, and Interrupts. `findErrorOption` is `Filter.toOption(findError)` (line 168).
- `hasDies` (`:171`) is `reasons.some(isDieReason)`.
- `hasInterruptsOnly` (`:218-219`) is `reasons.length > 0 && reasons.every(isInterruptReason)`. An extra Die fails it.
- `causeSquash` (`:261-269`) returns the first Fail immediately; otherwise the first Die defect; later Dies are ignored.
- `causePretty` (`:433-434`) joins `causePrettyErrors`. That walker (`:284-295`) pretty-prints every non-interrupt reason. `causePrettyMessage` (`:352-354`) uses `error.message` when it is a string.
- `SystemError.message` (`src/PlatformError.ts:128-131`) is `` `${_tag}: ${module}.${method} (${path})...` ``. An injected `PermissionDenied` Fail already contains the substring `PermissionDenied`.

## Examined scope

Bound on purpose. The unchanged bulk of `quality-scheduler.test.ts` and `quality-tasks.test.ts` was treated as hash-stable and was not re-read. Inspection of those two files stopped at the lifetime seams below.

After snapshot, full control bodies:

- `lint-security.test.ts` fault loop, lines 36-118. Native scenario registration remains at line 34.
- `purge-security.test.ts` two-root loop, lines 89-177. Native scenarios remain at lines 80-88.
- `regenerate-merge-driver.test.ts` entire layer, lines 57-142. Native allowlist/spawn tests remain at lines 40-55. `mergeDriverScenario` stays registered at line 58.
- `step-git-exec.test.ts` archive loop lines 348-423 and attributes-guard loop lines 513-584, including the `makeDirectory` path expect at 386-387 and the `realPath` expect at 548. Native scenario registrations remain at 344-347 and 509-512.
- `skills-command.test.ts` four-scenario layer, lines 269-349, including cwd capture, tapped remove error, and `assertExitFailure`.
- `version-sync-effect.test.ts` property at lines 313-321 (no options argument, no `fcRuns`) and the scoped temp at 324-329. `makeTempDirectory(` has zero remaining matches in this file.
- `yeet-pr-provenance.test.ts`: `makeTempDirectory(` has zero remaining matches. The delayed `FileSystem` is built after `makeTempDirectoryScoped`, so the scoped finalizer still closes over the original `remove`. Env restore is registered after the temp, so LIFO restores env and then removes the directory. Assertion bodies past the public-label seam were not re-read line by line.

Parent seams only:

- `quality-scheduler.test.ts` `acquireUseRelease` brackets at 5642-5650 (queue chmod `000`, restore `0700` with `orDie`) and 5677-5692 (leases chmod `0500`, `releases === 1` inside the use, queue-length expect after the bracket). The pre-existing helper at 273 and the bracket at 4935 were not re-read.
- `quality-tasks.test.ts` migrated `makeTempDirectoryScoped` sites at 1428, 1476, 1505, 1694, 1735, 1785, 1838, 1891, 2944, 3261, 4911. `makeTempDirectory(` has zero remaining matches. Other pre-existing `makeTempDirectoryScoped` calls were not the migration and were not re-read. `Cause.pretty` uses at 4351, 4371, 4414, and 4855 are pre-existing command-message assertions.

Runner and helper contracts read in the named checkout:

- `packages/tooling/tool/cli/vitest.config.ts`: `isolate: true`, `fileParallelism: false`, `sequence.concurrent: false`.
- `@effect/vitest` `internal.ts:346`: when `options.concurrent` is undefined, suite options stay `{}` and do not force concurrent.
- `packages/tooling/tool/cli/test/support/CommandTest.ts:61-75`: `temporaryWorkingDirectory` chdirs and documents shared process cwd for sequential bodies.

Controls read as claims, then checked against the after files: `a/a-source-report.md`, `b/b-source-report.md`, `controls/artifact-control-summary.json`, `controls/extraction.json`, `controls/permissions-node.json` (through the queue release-failure rows; the leases block starts at line 72 and was not read to the end). `permissions-bun.json` was not read. Writer pass counts, the 388/388 parent run, the 11-site copied suite, and 457/478 case arithmetic were not re-executed. Compiler exit JSON was not opened. A shell exit of 0 is not treated as source validity.

## Findings

Three. Details and fix intent are in `grok-findings-r1.jsonl`.

### Major — cleanup controls accept a mixed cause

Live cleanup modes inject a typed `PermissionDenied` Fail, write a child witness, and `chmod 000` the acquired root. The scoped `orDie(remove)` then dies because the child cannot be unlinked, and `exists` stays true. The assertions require some Die, the first Fail equal to the injected error, and `Cause.pretty(exit.cause)` containing `PermissionDenied`.

`causePrettyErrors` prints the Fail. `SystemError.message` already starts with `PermissionDenied:`. The substring check is therefore satisfied by the injected Fail even when the Die is a different defect.

Counterexample that passes every current assertion: scoped `remove` dies with `new Error("boom")` (or any Die whose message lacks `PermissionDenied`) while the directory remains. `findErrorOption` returns the injected Fail, `hasDies` is true, `Cause.pretty` still contains `PermissionDenied` from that Fail, and `exists` is true.

Running sites:

- `lint-security.test.ts:109-112` (injection at 76-82, Fail returned at 82).
- `purge-security.test.ts:163-165`, with the exists loop at 167-171 (injection at 135-143).
- `step-git-exec.test.ts:414-417` and `:575-578` (injection at 389-395 and 550-556). The `findErrorOption` arm at 409 and 570 is what identifies the Fail; it does not identify the Die.

`skills-command.test.ts:335-338` is the strict pattern already in this batch: tap the real `remove` error, require `method === "remove"` and `pathOrDescriptor === root`, then `assertExitFailure` against `Cause.die` of that error. Copy that shape. Do not search `Cause.pretty` for a tag that the injected Fail already carries. Optionally require exactly one Fail and one Die.

Severity is major. `hasDies` plus a retained directory still proves that some defect happened and that removal did not succeed. The hole is defect identity. This is a test-control defect, not a product-cleanup defect.

### Minor — non-cleanup arms ignore extra reasons

Setup and acquisition-failure arms check `Cause.findErrorOption` plus `exists === false`. `findError` returns only the first Fail, so a later Die passes when removal still succeeds. Body arms that use `Cause.squash` pass a later Die when the first Die defect is the injected object, and they also pass an earlier Fail whose error is that same object.

Interrupt arms call `Cause.hasInterruptsOnly` and reject an extra Die. Those arms are sound.

Pins: `lint-security.test.ts:99-104`; `purge-security.test.ts:156-159`; `step-git-exec.test.ts:404-409` and `:565-570`; `regenerate-merge-driver.test.ts:122-127`.

Fix: compare the cause to exactly one expected Fail, or exactly one expected Die, the way the skills layer uses `assertExitFailure`. This is a control gap. The tests do not currently install a second dying finalizer.

### Minor — mode arms that no registered case reaches

`regenerate-merge-driver.test.ts:59` loops `["setup failure", "body failure", "interruption"]`. The `cleanup failure` injection at 99-103 and the assertions at 132-135 are unreachable. Deleting those branches changes no passing test. A's report does not claim a merge-driver cleanup case. This is a coverage gap, not a passing false-green. The same pretty-match hole would apply if the mode were added without the Die-identity fix above.

`step-git-exec.test.ts:348` and `:513` loop `["setup failure", "interruption", "cleanup failure"]`. The `body failure` squash arms at 406-407 and 567-568 never run.

Fix: add the missing mode to the loop, with the Die-identity assertion from the major finding where the mode is a cleanup, or delete the dead arms.

## Checked and left unfiled

- Purge two-root cleanup. LIFO releases the external root, then the repository root. The exists check at `purge-security.test.ts:167-171` requires the denied index to remain and the other index to be gone. One surviving root fails the other index. That check fails closed against one finalizer aborting the other, on the assumption that a v4 scope still runs every finalizer. That scope policy was not re-read in this checkout beyond the LIFO contract.
- Skills annotation copy. `assertExitFailure(exit, Cause.annotate(expected, Cause.annotations(exit.cause)))` makes annotation equality tautological and still requires the reason list to match. Setup checks `AlreadyExists` / `makeDirectory` / `.git`. Cleanup checks `PermissionDenied` / `remove` / the acquired root, then `Cause.die` of the tapped error. Interrupt uses the fiber id captured before `Effect.scoped`.
- Skills cwd. `temporaryWorkingDirectory` shares process cwd. The CLI Vitest config sets `sequence.concurrent: false` and `fileParallelism: false`. The new `it.layer` calls do not pass `concurrent: false`; under this package runner the suite stays sequential. The layer itself is not a sequential contract outside this config.
- Scheduler brackets. `acquireUseRelease(..., orDie(chmod 0700))` restores on body failure. Queue length is asserted after the bracket (`quality-scheduler.test.ts:5692`). `releases === 1` stays inside the use. This is stronger than a post-success chmod. `controls/permissions-node.json` is a copied expression harness (`observedMode` 0 on release-failure is the failed `orDie` restore). It does not replace the installed suite.
- Version-sync and provenance scoped temps replace manual `fs.remove` calls. Env finalizers registered after the scoped temp run first on release (LIFO), so the use still sees the mutated env. The provenance delayed filesystem does not replace the `remove` already closed over by `makeTempDirectoryScoped`.
- Version property floor. `version-sync-effect.test.ts:313-321` has no options argument and no `fcRuns`, same as the before snapshot. `fcRuns` cannot be inherited from `BEEP_FC_NUM_RUNS`. An env value of 400 is not 400-run proof for this property. Pre-existing. Kept as a caveat. Not filed.
- Quality-tasks. The eleven migrated sites use `makeTempDirectoryScoped`. No `makeTempDirectory(` remains in that file. A previous `Effect.ignore` remove becoming `orDie` is stricter. The rest of the file was not read.
- Interrupt controls in this batch use `hasInterruptsOnly`, which rejects interrupt-plus-Die.
- Rescue finalizers sit outside the observed `Effect.scoped` (lint 52-60, regenerate 75-83, step-git 364-372 and 529-537, purge 109-118). The `exists` assertion runs in the test body, before that outer finalizer. A passing `exists === true` is the observed scope's residue. The rescue then chmod `0700` and removes. A failed assertion cannot leave mode `000` behind only if that outer finalizer runs; that is the stated comment, and it matches registration order.
- No reviewed diff hunk deletes an existing `it.effect` title inside the bodies that were read. Native subjects listed above stay registered. No runtime `concurrent: true` and no lowered property options were introduced in the read bodies.

## Unknowns

- Full mechanical case count (457 retained, 478 expected) was not re-counted.
- Canonical `package-test-typecheck` JSON compiler exit was not opened. Worker quick-check dependency gaps and parent `package-verify` hydration were not re-run.
- `permissions-bun.json` unread. `permissions-node.json` unread past the start of the leases block.
- `quality-scheduler.test.ts` and `quality-tasks.test.ts` outside the line lists above.
- Provenance assertion bodies after the delayed-filesystem / public-label seam.
- Effect v4 scope "run every finalizer" was not re-read in this checkout.
- `Effect.scoped` fiber-id equality was not re-read. The skills interrupt compares `Cause.interrupt(fiberId)` captured before `Effect.scoped`. A mismatch would fail that assertion closed. A writer pass is not proof of that equality.
- Parent 388/388, the 11-site copied suite, and the 12 permission-expression rows were not re-executed here. Copies do not replace installed-suite evidence.

## Verdict

The batch keeps native subjects, uses `hasInterruptsOnly` on interrupt arms, puts rescue cleanup outside the observed scope, and the skills cleanup control checks the real remove defect. Three test-control defects remain: live cleanup assertions identify the Die only by `hasDies` plus a pretty substring that the injected Fail already satisfies; several non-cleanup arms accept extra reasons; regenerate cleanup and step-git body arms are unreachable. None of these is goal acceptance, package acceptance, or a hosted-CI result.

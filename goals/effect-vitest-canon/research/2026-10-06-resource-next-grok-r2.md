# Grok adversarial review, round 2 — effect-vitest-canon resource-next repair

Status: complete. Read-only. This batch review is not goal acceptance. Parent retains the original goal, including an empty final baseline. Source package proof and current-main integration remain the parent's jobs.

Round 1 files were not rewritten:

- `grok-review-r1.md`
- `grok-findings-r1.jsonl`

Reviewed snapshot: `~/.cache/beep/effect-vitest-canon/resource-next-20261006/review-r2`. Hashes in `review-r2/source-hashes.json` bind the nine basename files to their original paths. Round 1 `review/after` remains the nested-path snapshot.

Findings file: `grok-findings-r2.jsonl`. No new defects. The file is empty on purpose.

Role: independent reviewer. No source or snapshot edits, no git mutation, no publication, no network, no delegation.

## What changed since round 1

Hashes are from `review-r2/source-hashes.json`, compared with `review/source-hashes.json` after entries.

A files, changed, control bodies re-read:

- `lint-security.test.ts` `b23db7b173554ef0686472223d0084b32efa8cd05de71c111593918e246e73cf`
- `purge-security.test.ts` `1ae8cd1de2401db26e627dfd0f0b48256a57ab283e503f3b99e832ecc4a137e2`
- `regenerate-merge-driver.test.ts` `9f6b9e3aa04877e60d6a88176583b78136025bea4071a78c57dccb2e44eb3ca0`
- `step-git-exec.test.ts` `b771f7ec433a7b3544914579dae6ccfcaed042f01a325f6b256d95db12f4831d`

B and parent files, identical to the round-1 after hashes, bodies not re-read:

- `skills-command.test.ts` `d8af32f8abd6b52cb19755ce390e35f75b14416c6e2da4e3dc88ddb21036f805`
- `version-sync-effect.test.ts` `8ad9b10f9c225e70d149bc62f8d640698c54d7cb2c08d3c33091023e368e118c`
- `yeet-pr-provenance.test.ts` `d4fb5f69eccb02b6bbb64371091e07ab075b63d6c6fe814ff0a45641b96750b9`
- `quality-scheduler.test.ts` `507e19341b15ea2fbd3ea36d951aa000e1c18af2ddae1e68a0a78d6ffb089dda`
- `quality-tasks.test.ts` `8e77c17bfb046d156ad0b573b3487cef05e15f58615e8927f2e3e2deb104f554`

Changed A after-files, complete control bodies re-read:

- `lint-security.test.ts` layer at line 33 through the mode loop ending at 152. Native `lintSecurityScenario` remains at line 34.
- `purge-security.test.ts` layer at line 80 through line 210. Native scenarios remain at lines 81-88.
- `regenerate-merge-driver.test.ts` native tests at lines 40-55, `mergeDriverScenario` at line 59, control layer at lines 58-174.
- `step-git-exec.test.ts` three named layers at lines 91, 249, and 460. Archive mode loop and attributes-guard mode loop, including the nested `makeDirectory` path expect and the guard `realPath` expect. No `body failure` string remains in this file.

Installed API used for the repair, from the resource-next checkout:

- `Cause.combine` concatenates reasons left then right and dedupes (`effect/src/internal/core.ts` `causeCombine`).
- Scope finalizer failure is `causeCombine(useCause, finalizerCause)` (`effect.ts` `combineFinalizerCause`, called from `OnExit` `contE`). Use reasons come first.
- `Effect.orDie` is `catch_(self, die)`. The die defect is the tapped error object.
- `PlatformError` extends `Cause.YieldableError`. `yield* failure` evaluates as `exitFail(this)` (`core.ts` YieldableError `[evaluate]`). `Effect.die(failure)` stays a Die (`exitDie`).
- `exitFailCause` stamps `fiber.cache.stackFrame` onto the whole cause when the fiber was created with one (`core.ts:586-588`). That frame is captured once at fiber construction (`effect.ts:752`), not per nested `fnUntraced`.
- `Cause.annotate` preserves existing keys by default (`core.ts` `causeAnnotate`). `Cause.annotations` merges every reason's map, later keys winning.
- `assertExitFailure` is `deepStrictEqual` on the cause (`@effect/vitest/src/utils.ts`).
- `NodeFileSystem.makeTempDirectoryScoped` closes over `removeFactory("makeTempDirectoryScoped")` (`NodeFileSystem.ts:203-207`). A later `remove` override does not see that release.
- Named `layer(layer, options)(name, fn)` passes `options.timeout` only to `beforeAll` and `afterAll` via `hookTimeout` (`@effect/vitest/src/internal/internal.ts:345-356`). `it.effect` does not receive it (`internal.ts:384-400`).

## Round-1 dispositions

### `cleanup-pretty-matches-injected-fail` — closed

The live cleanup arms no longer use `Cause.pretty`, `hasDies`, or `findErrorOption`.

Each cleanup release is `Effect.acquireRelease(fs.makeTempDirectory, fs.remove)`. `tapError` stores the native `remove` failure before `orDie`. The assertion reads that ref. It requires `SystemError`, `_tag === "PermissionDenied"`, `method === "remove"`, and `pathOrDescriptor` equal to the acquired root, then `assertExitFailure` against `Cause.combine(Cause.fail(failure), Cause.die(error))` with the observed cause's annotations copied on.

The round-1 counterexample, a Die of `new Error("boom")` while the injected Fail still says `PermissionDenied`, fails that equality. The identity checks also fail unless the tapped error is the permission failure of `remove` on that root.

Sites: `lint-security.test.ts:68-72` and `:124-146`; `purge-security.test.ts:125-132` and `:177-205`; `regenerate-merge-driver.test.ts` same shape at the cleanup arm (`:147-169`); `step-git-exec.test.ts` archive and attributes-guard cleanup arms (tapped `remove`, then the same `Cause.combine` and three mutants).

Cause order matches the installed scope: use failure, then finalizer die.

### `fault-controls-ignore-extra-reasons` — closed

Setup and body arms now call `assertExitFailure` with exactly `Cause.fail(failure)` or exactly `Cause.die(failure)`, annotations copied from the observed cause. An extra Die or extra Fail is a separate `expect(...).toThrow()` on `Cause.combine(expected, ...)`.

Interrupt arms still use `Cause.hasInterruptsOnly`, which rejects an extra Die.

`findErrorOption` and `Cause.squash` are gone from these four files.

### `unregistered-mode-arms` — closed

`regenerate-merge-driver.test.ts:60` now loops `cleanup failure` with the other three modes. The cleanup injection and the strict assertions run.

`step-git-exec.test.ts` has no `body failure` arm. Both loops are `["setup failure", "interruption", "cleanup failure"]`.

## Repair checks

Native acquisition is one `acquireRelease`. The release is registered before the body continues, and the root ref is set only after acquire returns. A failure or interrupt after acquire still runs `remove`. The rescue `chmod 0700` plus `remove` is an outer `addFinalizer` around the observed `Effect.scoped`, so the `exists` assertion sees the residue and a failed assertion does not skip the rescue.

The public `remove` tap is required. `makeTempDirectoryScoped` closes over `removeFactory("makeTempDirectoryScoped")`, so overriding `remove` on a real scoped temp would not observe that release. The control builds `acquireRelease(fs.makeTempDirectory, fs.remove)` and asserts method `remove`. The uninstrumented tests in the same files still call the production scenario on `NodeServices` / `NodeContext`, which uses the native constructor. The surrogate proves native `remove` of the acquired directory, including permission identity and path. It does not prove the production finalizer's method label `makeTempDirectoryScoped`. That limit matches the code that runs.

Annotation copy is the same pattern as the skills control. `exitFailCause` stamps one fiber stack frame onto each failure evaluated on that fiber. Copying `Cause.annotations(exit.cause)` onto a freshly built cause makes that frame match. `deepStrictEqual` still requires the reason list, the Fail error object, and the Die defect object. An extra reason fails. A wrong defect fails. This is not a pretty-text match.

The negative mutants are comparator checks against the expected cause, after the observed exit has already matched it. `wrongDie` is `Cause.die(new Error("boom"))`. `extraDie` and `extraFail` are `Cause.combine(expected, ...)`. Each must throw. They cannot pass by matching an unrelated error: the positive `assertExitFailure(exit, expected)` has already required the tapped remove error. An always-throwing comparator would fail that positive assertion first.

Six layer hook budgets, all named `layer(..., { timeout: "5 seconds" })`:

- `lint-security.test.ts:33`
- `purge-security.test.ts:80`
- `regenerate-merge-driver.test.ts:58`
- `step-git-exec.test.ts:91`, `:249`, `:460`

`hookTimeout` sets the Vitest hook budget on `beforeAll` (layer build) and `afterAll` (scope close). It is not passed to `it.effect`. Case timeout stays the package Vitest default. These four files are the only ones whose hashes moved; the parent test files did not gain a separate edit.

## Unknowns

- The combined 479-case proof, the compiler-exit JSON, and the 44/47/388 arithmetic were not re-run. Writer pass claims are not treated as source validity.
- B and parent bodies were not re-read. Their round-2 hashes equal the round-1 after hashes.
- `permissions-bun.json` and the rest of `permissions-node.json` were not re-read. They are not the installed suite.
- If a finalizer were evaluated on a child fiber, its stack frame would differ from the use failure and `deepStrictEqual` would fail the positive assertion. The scope close path read here continues on the same fiber (`effect.ts` `OnExit` `flatMap` / `combineFinalizerCause`). That mismatch would fail closed.
- Node's `rm` of a mode-000 directory is assumed to report the directory path passed to `remove`. A child path in `pathOrDescriptor` would fail the equality. It would not make a wrong defect pass.

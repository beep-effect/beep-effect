# Grok adversarial review — effect-vitest-canon nine-file wave

Status: full-body review complete. One confirmed minor. No blocker. No major.

This is a source-wave review. It is not goal acceptance and not merge readiness. Parent owns package, compiler, hosted proof, baseline rows, and upstream fix SHAs.

## Verdict

The nine after files keep every original test name and the meaningful assertions those tests made. The four new artifact setup controls are present and reject a revert to the old unscoped fixture acquisition. Native permission, filesystem, Turbo, and scheduler subjects stay in place. Property floors, seeds, and production schema operands are unchanged. Reply mutation coverage is stricter. The pending-monitor clock observes the production 10-second retry and fails closed if that sleep is absent.

Confirmed finding: interrupt controls do not require a clean interrupt cause, so a visible cleanup `Die` can pass beside the interrupt. Recorded in `grok-findings.jsonl` as `quality-artifact-interrupt-cleanup-die`. It does not reopen the setup leak.

## Reading coverage

Every before and after test body was read. Anchors below are after-snapshot lines. Line counts are `wc -l` of the snapshot files.

| File | Before | After | Bodies |
| --- | ---: | ---: | --- |
| `quality-artifact-generators.test.ts` | 371 | 393 | Full |
| `quality-scheduler-degraded-inputs.test.ts` | 140 | 158 | Full |
| `laws-package.test.ts` | 204 | 210 | Full |
| `laws-turbo-inputs.test.ts` | 252 | 248 | Full |
| `quality-scheduler-synthetic-scenario.test.ts` | 571 | 564 | Full |
| `yeet-artifact-writers.test.ts` | 384 | 373 | Full |
| `yeet-pr-session-registry.test.ts` | 117 | 118 | Full |
| `yeet-reply-engine.test.ts` | 781 | 801 | Full |
| `yeet-monitor-check-registration.test.ts` | 529 | 545 | Full |

Also read: goal `SPEC.md` sections 1.2–1.3 and D1–D14; lens charters `resource-authoritarian.md`, `flake-detective.md`, `property-tester.md`, `all-seeing-eye.md`; `history/2026-10-06-current-cohort-proof.md`; parent `quality-source-report.md` and `yeet-source-report.md`; `review/source-hashes.json`. Writer SHA256s match that hash file. Writer pass counts are corroboration, not proof.

Production seams read from the workspace, not treated as the changed tests: `NodeFileSystem.makeTempDirectoryScoped`; `Handler.ts` retry and census watch; `MonitorPolicy.ts` default settle timeout; `FastCheckRuns.fcRuns`; `TSMorph.service.ts` instance pools and `TSMorphServiceLive`; test-runner `Vitest.ts` and its prop/watchdog tests; `RuntimeRoot.provideRuntimeRootForTesting`; `ConfigProvider.layer`.

## Cohort pins used

Current receipt: Effect and `@effect/vitest` 4.0.1, Vitest 5.0.3, source base `2208622aa8d0a5765769e3950c44ec9e81be9ceb`, adapter commit `460272d30457f4697d8b8c52cad41caccbcace08`. Earlier packet cohort prose is dated and was not used as the pin. Detector and focused-suite claims in the receipt are not acceptance of this wave.

## Per-file evidence

### quality-artifact-generators.test.ts

`acquireFixtureRepo` (102–126) now calls `makeTempDirectoryScoped` before any fixture write. `acquireLabsFixtureRepo` (128–156) builds on that scope. The old `acquireUseRelease` and unscoped `makeTempDirectory` bracket are gone.

Four new controls (158–203): labs × interrupted. The injected filesystem taps the real scoped temp into a `Ref`, then fails or interrupts `makeDirectory`. Package setup fails on the first directory. Labs setup fails only when the path includes `/apps/labs/`, which matches `path.join(repoRoot, "apps", "labs", "demo")`. After a shorter `Effect.scoped`, the test requires a nonempty root and `exists(root) === false`.

A revert to unscoped `makeTempDirectory` never sets the `Ref`, so `expect(root).not.toBe("")` fails. A scope that closes the directory before the success tests use it fails those tests, which still read the fixture. Failure controls match `Cause.fail(failure)` exactly. Interrupt controls do not; that is the minor finding. Success cases still assert annotation gaps, both writers, labs exclusion, and both Turbo summarizers.

`ConfigProvider` is not involved. The serial `it.layer(PlatformLayer, { concurrent: false, timeout: "30 seconds" })` shares `TestClock` and `TestConsole`; these cases do not use them. Extra `effect/String` and `PlatformError` imports inside fixture source are unused by the assertions. The expected export-gap list is unchanged. That is optional style, not a filed finding. The scanner was not re-opened.

### quality-scheduler-degraded-inputs.test.ts

Three serial memory layers and one admission layer each use `it.layer(..., { concurrent: false, timeout: "30 seconds" })`. Parse cases still expect 62.5 and 125. Host fallback on a read error stays live. Degraded non-numeric lines still require a finite positive value other than 62.5 and 125. Admission keeps the unsafe `chmod 0755` observation and the empty lease/ticket non-quarantine result.

Temps are `makeTempDirectoryScoped` inside `it.effect`. `ConfigProvider.layer(fromUnknown(...))` is `Layer.succeed` (`ConfigProvider.ts` 925–928). `provideRuntimeRootForTesting` is `Effect.provideService` of `RuntimeRootTestOverride` (`RuntimeRoot.ts` 80–94). Both are pure provides inside the body, which D14 allows. The native permission subject remains.

### laws-package.test.ts

Outer serial `it.layer` is `FsUtilsLive` merged with `NodeServices.layer`, timeout 30 seconds. The property is now `it.effect.prop` over the same four production `Arbitrary.schema` operands (`Scope`, `Report`, `Finding`, `Law`), with the same four encode/decode equalities and `{ arbitrary: fcRuns(30) }`. The old `Arbitrary.checkEffect` plus `_tag === "Passed"` wrapper is gone; falsification now fails the effect directly.

Each of the other eight cases has its own inner `it.layer(TSMorphServiceLive, { concurrent: false, timeout: "30 seconds" })`. `TSMorphServiceLive` is `Layer.effect` (`TSMorph.service.ts` 1439–1440) and `createTSMorphService` allocates fresh pools per build (728–745). Separate `it.layer` calls are separate blocks, so each case gets its own project and symbol pools. Nested reuse would share; these calls are not nested.

The frozen-grant check now rebuilds the found value with `findingCount: 2` and `assertSome`. Every other field is copied from the found value, so the check is exactly as strong as the old `toMatchObject({ value: { findingCount: 2 } })`. `None` still fails. Scan counts, law ids, strict/advisory split, root-only absence, source-file counts, and empty reports remain. Not filed.

### laws-turbo-inputs.test.ts

Same platform layer, serial, 30-second hook. The property is `it.effect.prop` on `Arbitrary.schema(LawsRunSummary)` with encode, decode, equivalence, and re-encode, `{ arbitrary: fcRuns(25) }`. The native hash-isolation effect is unchanged: 180-second test, 20-second step capture, real `node_modules/.bin/turbo`, mutation matrix, artifact directories, and restoration. Repo-root and script assertions are unchanged.

Neither before nor after calls `providePlatform`. The historical EV002 rows at the original lines are already-fixed and need their upstream SHAs from the parent. No new fix is invented here. The property shares the layer with the Turbo test. The property body does not sleep. Whether `TestClock` can freeze `StepExec` was not re-opened; the writer’s focused proof is corroboration only.

### quality-scheduler-synthetic-scenario.test.ts

Outer serial `it.layer(NodeServices.layer, { timeout: "30 seconds" })`. The scenario acquires `makeTempDirectoryScoped` first, then provides the runtime-root override, `ConfigProvider.layer(fromUnknown(...))`, and `Layer.succeed(MemoryStats)`, and runs the generator through `TestClock.withLive`. Heartbeats, `Schedule.spaced("10 millis")`, and the 5-second timeout remain. The fake `systemctl` PATH bracket stays a shorter `acquireUseRelease` around reap only.

Scenario assertions are intact: protocol v2, capacity 3, contention, interrupt of B, dead owner, journal tags, V3 guards, export refusal, lock cleanup, and idempotent second reap. The codec property was already `it.effect.prop` with `fcRuns(32)` on `YeetAdmissionLease` and `YeetAdmissionTicket`; only nonce, checkout root, and re-encode are asserted. Historical EV001 and EV007 rows stay already-fixed. `withLive` restore semantics were not re-read.

### yeet-artifact-writers.test.ts

Three `it.layer(NodeServices.layer, { timeout: "30 seconds" })` blocks cover verdict (3), closeout (2), and snapshot (1). Each test makes its own scoped temp. `Option` payloads moved from `expect().toStrictEqual` to `assertSome` / `assertNone` with the same attempt id, SHAs, proof tier, `mergeReady` failure `"threads-resolved"`, Greptile 5/5, `envProfile: "local"`, and stage `pre-push`. The interrupted terminal is narrowed, then checked for reason `"interrupted"`, absent verdict, proof tier `"full"`, length 1, and a second interrupt still producing one terminal. Journal decode and the absence of `"_id":"Option"` remain. Verdict outcomes success and failure remain. The three-test verdict block shares clock and console and does not use them. Scoped removal uses `orDie`, which matches the old explicit `orDie(remove)`.

### yeet-pr-session-registry.test.ts

`it.layer(PlatformLayer, { timeout: "30 seconds" })` has no `concurrent: false`. Five tests remain. Unscoped temp file and directory calls are now scoped. The permission case is `acquireUseRelease(chmod 0500, append, orDie chmod 0700)`. The scoped directory finalizer is registered first and the chmod restore second, so LIFO restores mode `0700` before removal. Mode `0500` is not writable, so that order is required. Denied reason, private modes `0600` and `0700`, corrupt-line count, missing and empty files, and XDG/HOME paths remain. `ConfigProvider` is provided per case. These tests do not share clock or console state.

### yeet-reply-engine.test.ts

Pure `describe` cases are unchanged, including thread classification, operator surfaces, outcome target, verdict cases, and codec round-trip. `it` now comes from `@beep/test-runner`; pure cases still use that `it`.

The spawner is now built per test. Unlisted commands die with `Unscripted reply command`. `spawned` is an array of argv arrays local to the test, replacing the shared module-level string array. `replyTestLayer` merges pure `Layer.succeed` services and is provided through four single-test `it.layer` calls with a 30-second hook. Recording tests override the spawner with `Effect.provideService`.

The two-draft report (582–616) still expects statuses `["resolved","stale"]` and now also requires the filtered `mutation(` argv list to equal the post mutation and then the resolve mutation, with `spawned.length === 4`. A stale-thread mutation would add a third filtered element. That is stronger, not weaker. The follow-up case (618–647) still expects exactly one `addPullRequestReviewThreadReply` argv and zero `resolveReviewThread` argv. It does not assert the post body; the original test did not either. Denial preflight and batch continuation remain. Temps are scoped, so cleanup errors are defects. `Effect.ignore(remove)` is gone. The mutation query constant definitions were not opened. The 37/37 writer result implies the production argv contains the filtered substring; this review did not re-run it.

### yeet-monitor-check-registration.test.ts

Pure registration cases (7), await-registration cases (6), and the shipped backoff case are unchanged: three calls then green, stop at one on green, no retry on red, bound hands back exit 1 while still awaiting, operator logs `(1/2)` and `(2/2)`, spawn failure does not retry, five delays totaling at most two minutes, and the exhausted message names six attempts and path filters.

Phase success and phase red are each a single-test `it.layer` of `PlatformLayer` plus the spawner layer, with scoped temps. Assertions still require `"yeet monitor failed."`, exclusion of `"No checks registered"`, and exit code 1. Spawned handles return immediately, so `it.live` was not required. The explicit `provideScopedLayer(TestConsole.layer)` on the pause-log case is gone because `it.effect` supplies `TestConsole`. Log visibility is supported by the writer’s 76/76 result, not re-run here.

The recorder closes a fresh `Ref` in a per-test spawner and still expects two calls, one watch entry with exit 0, and the prior `monitor:01-pr-context` entry. Census cases are single-test layers and keep the optional-red log, the `"watch failed"` message, and recorded exit 1.

Pending-then-success (438–483, body timeout 20 seconds, own layer) installs a delegating clock. It forks the delegated sleep, yields, signals a `Deferred` only when `Duration.toMillis(duration) === 10_000`, then joins. The test awaits that deferred, adjusts `TestClock` by 10 seconds, and joins the watch. It still expects two calls and recorded exit codes `[0]`.

Production `retryPendingMonitorChecks` (`Handler.ts` 1406–1412) sleeps `Math.min(10_000, remaining)` and then applies `timeoutOption(remaining)`. The default settle timeout is `1_800_000` ms (`MonitorPolicy.ts` 58, `Handler.ts` 1491). The signaled sleep is therefore the production retry, not the deadline sleep. A shorter production sleep never signals, so the deferred hangs. That fails closed. The custom clock is local to this single-test layer.

The 0 ms and 20 ms pending-bound cases stay on `TestClock.withLive` with the same `>= 1` and `<= maxAttempts` bounds, the settle-timeout message, and recorded exit 1. The hook timeout changed from 10 seconds to 30 seconds. That is the D14 layer-acquisition hook, not a longer body timeout. The 0 ms path hits `remaining <= 0` and does not sleep. The 20 ms path is a real race between the retry sleep and `timeoutOption`. That native coverage stays. Do not delete it and do not zero a baseline to satisfy a count.

## Property and runner

`fcRuns` (`FastCheckRuns.ts` 164–170) takes the max of the inline count and `BEEP_FC_NUM_RUNS`. An env floor can raise an inline floor and cannot lower it. Seed is attached when `BEEP_FC_SEED` is set. Inline floors in this wave are 30, 25, and 32. The writer’s 400-run, seed `20260708` proof is corroboration that the env floor raises them. The runner test (`Vitest.test.ts` 105–115 and 234–249) shows `it.effect.prop` forwards `{ arbitrary: { ...fcRuns(n), seed } }` and uses one watchdog budget across trials and shrinking. This review did not typecheck the wave. Parent may be doing that.

## Historical rows

Six already-fixed rows stay historical: laws-turbo EV002 at original lines 141 and 246, and synthetic-scenario EV001 at 496 and 514 plus EV007 at 497 and 515. Parent should attach their upstream SHAs. This review does not fabricate replacements and does not propose deleting the native rows.

## Optional notes, not filed

- Frozen-grant `assertSome` spread has the same strength as the old partial match.
- Reply exact mutation argv and fail-closed unlisted commands are strengthenings.
- Artifact fixture source gained unused imports. Gap assertions did not change.
- Shared `TestClock` and `TestConsole` inside blocks that neither sleep nor read the console are legal. Mutable TSMorph state is per inner layer.

## Evidence limits

No package verify, no typecheck, no git, no broad tests, and no network. `source.diff`, `quality-preservation.json`, and `b-behavior-assertions.json` were not opened; bodies were read directly. `assertExitFailure`’s equality implementation, the reply mutation query constants, `yeet-pr-fixtures` `PlatformLayer`, `TestClock.withLive`, `StepExec`, and `FileSystem.of` were not opened. Workspace production files were used only for the seams named above. Writer totals 29/29, floor 14/14, and 76/76 were not re-executed. A parent typecheck may be in flight. Nothing in the workspace source was edited.

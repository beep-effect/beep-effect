# Grok adversarial review, round 2 — effect-vitest-canon nine-file wave

Status: repair-snapshot review complete. No new blocker, major, or minor.

Reviewed snapshot: `<private-continuation-cache>/review-r2/after`, with `review-r2/source-hashes.json` and `review-r2/source.diff`. Round 1 under `review/` and `grok-review.md` is unchanged. This round does not accept the package, the hosted proof, or the goal.

`grok-findings-r2.jsonl` is empty on purpose. The one round-1 finding is closed. Nothing new met the source-counterexample bar.

## Previous finding

`quality-artifact-interrupt-cleanup-die` is closed.

Round-1 interrupt controls asserted `Exit.isFailure` and `Cause.hasInterrupts` only. The repair keeps those, keeps `assertExitFailure(exit, Cause.fail(failure))` on the failure path, and adds `Cause.hasInterruptsOnly(exit.cause)` at `quality-artifact-generators.test.ts:210-216`. Nonempty root and `exists(root) === false` remain at 217-223.

Installed v4 `hasInterruptsOnly` (`node_modules/effect/src/internal/effect.ts:218-219`) is `reasons.length > 0 && reasons.every(isInterruptReason)`. `isInterruptReason` (`internal/core.ts:404`) is `_tag === "Interrupt"`. A cleanup `Die` is its own reason, so interrupt-plus-die is not interrupt-only. The round-1 counterexample, an `orDie(remove)` defect beside the injected interrupt, now fails the control. `NodeFileSystem.makeTempDirectoryScoped` (`NodeFileSystem.ts:203-210`) is still `acquireRelease` plus `Effect.orDie(remove)`.

## Round-1 qualification

`grok-review.md` is not rewritten. Its artifact-control section treated `Str.includes(directory, "/apps/labs/")` as a path filter that let package setup finish before the labs failure. That reading is wrong.

Installed `String.includes` (`String.ts:531-532`) and `String.endsWith` (`String.ts:567-568`) are both `(searchString, position?) => (self) => boolean`. The round-1 call passed the directory as `searchString` and `"/apps/labs/"` as `position`, so it returned a function. A function is truthy, so every labs `makeDirectory` took the injected branch, including the first `packages/demo/src` call. Those controls could still remove the temp root and pass. They did not prove the labs seam. The round-1 leak conclusion for an unscoped `makeTempDirectory` still holds, because the `Ref` is set only in the scoped tap. The labs-stage claim does not.

## What changed

`source.diff` is three files. SHA256 from `review-r2/source-hashes.json`, compared with round-1 after hashes:

| File | Round-2 SHA256 | Against round 1 |
| --- | --- | --- |
| `quality-artifact-generators.test.ts` | `9fa319e52d35aa89b58f01f4d0d8d3fd09dff2beb492fdf0ebdbb80d7a8f0fa9` | Changed from `5c49c0fe…` |
| `quality-scheduler-synthetic-scenario.test.ts` | `90307c047f22db7fa943e3ae6b889e15d4192a50ef5883b6e1ac0469f10f33ba` | Changed from `46094f27…` |
| `yeet-monitor-check-registration.test.ts` | `428179f1a1640ffef72a7a67a1721bf66dc462a788299b9ddc504ec9aff06056` | Changed from `0db2ce97…` |
| degraded-inputs, laws-package, laws-turbo, yeet-artifact-writers, yeet-pr-session-registry, yeet-reply-engine | unchanged | Byte-identical to round-1 after |

The six identical files were not re-read. Round-1 body conclusions stand for them.

## Injection repair

Controls are `quality-artifact-generators.test.ts:156-226`. `isTargetDirectory` is `Str.endsWith(`/${targetDirectory}`)` applied to the directory (`170`, `191`). That is the curried suffix predicate. Package target is `packages/demo/src`. Labs target is `apps/labs/demo/src`.

`acquireFixtureRepo` (`100-124`) creates the scoped temp, then `makeDirectory` of `packages/demo/src`, then writes, including `packageSource`. `acquireLabsFixtureRepo` (`126-154`) finishes that first, then `makeDirectory` of `apps/labs/demo/src`. The controls record every relative directory and the injected ones. Package expects attempts `["packages/demo/src"]` and one injection. Labs expects `["packages/demo/src", "apps/labs/demo/src"]` and injection of only the labs path (`219-222`). On the labs target, the real filesystem must already contain `packageSource` (`193-197`) before the interrupt or fail.

The old truthy call fails this. It injects at `packages/demo/src` and never attempts `apps/labs/demo/src`, so the labs arrays and the completed-package read fail. A predicate that matches nothing lets setup succeed, and `assertExitFailure` or the interrupt checks fail. A suffix collision that is not `path.join(root, targetDirectory)` fails the equality at line 192.

`makeDirectory` is `Effect.fnUntraced` (`184-203`). `fnUntraced` (`internal/effect.ts:1243-1258`) returns the generator effect and does not install a span or `CurrentStackFrame`. `Effect.fn` (`1298-1344`) does both, and `useSpan` (`6158-6173`) keeps the same exit while the stack frame is what the writer observed as `Cause` stack annotations under `assertExitFailure`'s `deepStrictEqual` (`@effect/vitest` `utils.ts:315-320`). The failure path still expects `Cause.fail(failure)` exactly. The scoped temp override stays `Effect.fn("FixtureSetup.makeTempDirectoryScoped")` (`180-183`). That span covers the successful acquire, which finishes before `makeDirectory`, so it is not the failing effect `assertExitFailure` compares.

`packageSource` and the inline annotation fixture no longer contain the extra `effect/String` or `effect/PlatformError` imports. Those imports remain on the test module (`16-18`), which is what the controls call. The round-1 before file has neither import in the fixture strings.

## Service and clock deltas

Synthetic scenario (`533-541`) replaces `Effect.provide(ConfigProvider.layer(fromUnknown(...)))` and `Effect.provide(Layer.succeed(MemoryStats, ...))` with `Effect.provideService` of the same `fromUnknown` provider and the same `MemoryStats.of({ availableGib: 25, totalGib: 128 })`. No `Layer` use remains in that file. `provideRuntimeRootForTesting` is still the first provide. `TestClock.withLive` is still outside that pipe (`541`). The scenario assertions and the `fcRuns(32)` property body are outside the diff hunk. This is the same pure service values without a layer build. It does not add a scope and does not move the live clock.

Monitor retry sleep (`450-459`) is `Effect.fn("YeetMonitorTest.retrySleep")` with the same body order: `forkChild` of `clock.sleep(duration)`, `yieldNow`, `Deferred.succeed` only when `Duration.toMillis(duration) === 10_000`, then `Fiber.join`. The span is acquired before that body and does not sleep 10 seconds. `TestClock.adjust("10 seconds")` still wakes the delegated sleep. A production sleep whose duration is not 10 seconds never signals, so the deferred waits. Calls `=== 2` and recorded exit `[0]` remain (`478-479`). The 0 ms and 20 ms `TestClock.withLive` bounds are not in the diff.

## Writer reports

Read as claims, not as proof of this snapshot.

Quality repair section says the round-1 labs predicate was the curried `includes` call, then `fnUntraced` after `Effect.fn` broke exact `Cause` equality. Its final artifact SHA256 is `69a47391d242bd4cc7b88183e303adb6cc393203c4d5f19f359409f40d73c95e`. This snapshot's artifact file is `9fa319e5…`. Those receipts do not identify the file reviewed here. Synthetic `90307c04…` matches the writer's post-repair hash. The other three quality files match both.

Yeet typing correction names the monitor SHA256 `428179f1…`, which is this snapshot. It reports a focused 28/28 after the `Effect.fn` sleep change. That receipt matches the monitor hash and still is not package or hosted acceptance. The other three yeet files match round 1.

## Evidence limits

No tests, typecheck, git, network, or source edits. `useSpan` ends the span with the fiber exit and does not rewrite it; this review did not re-execute the annotated-cause failure the writer describes. Parent is collecting typed and focused repair results. Historical fix SHAs are still not invented. Native coverage is unchanged in the six identical files and in the monitor bounds.

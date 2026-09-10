# P0f adversarial review round 1 (Grok lane)

Status: coverage completion finished for the listed gap ranges (same round 1, not round 2)

Lane: Grok review. Read-only. No remediation. Existing IDs P0F-R1-001 through 011 stay stable. Two findings appended as P0F-R1-012 and P0F-R1-013.

## Coverage completion

Root listed 13 files / 5016 remaining lines in `~/.cache/beep/effect-vitest-canon/p0f-round1-read-coverage-gaps.json`. This pass read those exact original-corpus ranges, remaining KG entries, store implementation, and missing focused-test portions. Concurrent live-checkout repairs were not used as snapshot truth.

Progress: 13 / 13 listed gap files finished.

- standards/effect-vitest.primitives.jsonc remaining ranges (51-89, 140-269, 360-449, 480-519, 570-1154, 1205-1287, 1328-1519): all 85 entries now read. D11 export/option/utils/README/charter coverage holds. New KG hole is P0F-R1-013 (`layer.option.timeout` and `TestClock.withLive` have empty `replaces`). The `it.layer.non-live` example uses public `layer()`, which is the same surface as P0F-R1-002.

- DuckDb.service.test.ts 1-599 and 680-1248: full body now complete. Confirms P0F-R1-001 (`provideScopedLayer(NodeServices.layer)` and `DuckDb.makeNodeLayer` throughout; fnUntraced second-arg form at 792, 826, 1205, 1245). Confirms P0F-R1-004 (unique `Effect.sleep("1 hour")` interrupt case). `withTempDirectory` / `withNativeDuckDbConnection` / `withDuckDbInstanceCreate` definitions are EV003; several `it.effect(..., () => withNativeDuckDbConnection(...))` sites (830, 911, 940, 980) are true body-root EV003. Nested `yield* withTempDirectory` is outside EV003's stated body-root predicate. New hole: `assertSchemaArbitraryRoundTrips` (107-123) hides `fc.assert` plus `Effect.runSync`; callers at 198-205 are plain `it`. Census EV007=1 and EV001=3, baseline has neither, matching a lexical-enclosure miss. Inline `Effect.scoped(Layer.build(...).pipe(Effect.provide(context)))` at 586-593 is a true EV002/EV004. `node:timers/promises` sleep is live wall-clock under `it.effect` and is not EV008.

- OpenClaw.test.ts 1-279, 329-389, 430-828: full body now complete. `import * as NodeServices from "@effect/platform-node/NodeServices"` at 38 is a subpath (P0F-R1-005). Three `it.layer(NodeServices.layer)` sites (397, 419, 751) remain EV014 misses (P0F-R1-003). Local `runCaptured` at 104-114 wraps `Effect.scoped`; the call at 767 is inside `it.effect`, so EV004 is hidden the same way EV002 is. `expect(Result.isSuccess/isFailure)` at 180-188 and `O.isNone` at 201, 211 are unmigrated EV006. `assertSchemaArbitraryDecodesToSelf(..., { numRuns: 25 })` at 374 is the kit round-trip helper, not `fc.assert`, so EV007 silence is correct; floor loss is property-lens residue. `for attempt in $(seq 1 30)` at 632 is bash source inside a string, not a TS loop, so EV013 silence is correct.

- step-capture-lifecycle.test.ts 1-279 and 380-559: full body now complete. Many `provideScopedLayer(Layer.succeed(ChildProcessSpawner, ...))` sites (413, 432, 455, 474, 500, 522, 549) are stub provides hidden in the helper. Allocating `NodeFileSystem.layer`/`NodePath.layer` still goes through the same helper (197, 214, 254, 310, 371, 389). `it.live` OS tests (135-310) have no Clock/Console/withLive, so EV009 judgment would fire; that is the same predicate hole as P0F-R1-007, not a new ID. `Effect.sleep("1 minute")` at 499 is paired with `TestClock.adjust` at 504, so EV008 is correctly silent. `@effect/platform-node/NodeFileSystem` subpath at 12-13 strengthens P0F-R1-005. `expect(Exit.isFailure(exit))` at 440 and 480 is unmigrated EV006, not a detector miss. No correction of existing IDs.

- Drizzle.errors.test.ts 51-319 and 370-459: full body now complete. Many `expect(O.isNone/isSome)` in plain `it` (EV006 true). Five `it.effect` cases at 375-457 all `provideScopedLayer(Drizzle.makeLayer(client))`. Even if makeLayer is a stub, the helper still rebuilds via Layer.build plus Effect.scoped. Strengthens P0F-R1-001. `import * as assert from "@effect/vitest/utils"` used for instance/deep equal, not Option predicates. No correction.

- IdentityRdfBinding.test.ts 1-79 and 179-296: full body now complete. More `assert.isTrue` on tagged errors (190, 194) plus `O.isSome`/`O.isNone` inside `assert.isTrue` (285-292) keep P0F-R1-009. `provideScopedLayer(layerDataset(...))` at 237 keeps P0F-R1-001. `Effect.provideService` of a mock at 266 is a stub, not a new EV002 hole.
- Pacer.test.ts 161-385: full body now complete. Many more `it.layer(mockLayer())` / `makePacerLayer(...).auth` blocks without timeout (P0F-R1-003). Line 227-237 is an `it.effect` that *calls* `provideScopedLayer(mockLayer(...))`, so the helper is not dead code. Strengthens P0F-R1-001. No correction.
- effect-vitest-primitives.test.ts 251-413: full. Example compile, pin refusal, graph decode, EV005/EV006 hint hydration. Does not change D11 completeness claim.

- chat-ui.test.tsx 81-248: full body now complete. Remaining tests are plain `it` DOM/key bounds plus the two `it.effect` toast cases. P0F-R1-006 pair at 226/245 confirmed in-body. `Effect.promise(waitFor)` under `it.effect` is a flake-lens wait, not EV008.
- DocumentIntake.test.ts 109-189: full body now complete. Three more `provideScopedLayer(DocumentsIntakeTestLayer)` sites (129, 169, 187) and `Effect.result` plus `Result.isFailure` at 121-124, 168. Strengthens P0F-R1-001 and P0F-R1-008. No correction.
- EffectVitestStore.ts 81-208: writeInventory/writeCensus/writeRows complete. Rows group by package, sort by id, delete only owned JSONL. D2 shape holds.
- effect-vitest-store.test.ts 1-60: full. Unrelated JSONL preserved.
- effect-vitest-contract.test.ts 1-49 and 130-190: full. Membership tests intentionally treat line-shifted identical evidence as the same key and ordinal `#2` as distinct (183-190). That confirms P0F-R1-006 rather than contradicting it: deleting the first of two identical fingerprints is untested and still remaps `#2` to `#1`.

Corpus: `~/.cache/beep/effect-vitest-canon/p0f-round1-corpus/`
Status addendum: `~/.cache/beep/effect-vitest-canon/p0f-round1-status-addendum/`
Pinned reference supplement: `~/.cache/beep/effect-vitest-canon/p0f-round1-reference-supplement/`

Findings file: `goals/effect-vitest-canon/history/2026-09-09-adversarial-round-1.jsonl`

## Completion status

Listed gap coverage is finished. Findings are 1 blocker, 7 majors, 5 minors (original 11 unchanged, plus P0F-R1-012 and P0F-R1-013). D1-D14 remain normative. Unmigrated tests and the nonempty baseline were detector/doctrine probes, not P1 defects. Rounds 2/3, P0g, P1, and P2 are not claimed complete. No tests, builds, or git commands were run. Predictions are from source, not from executing the detector.

## Findings by severity

- blocker: 1 (P0F-R1-001)
- major: 7 (P0F-R1-002 .. 007, P0F-R1-012)
- minor: 5 (P0F-R1-008 .. 011, P0F-R1-013)

## Corrections to existing IDs

No ID was withdrawn. Qualifiers from full-body reads:

- P0F-R1-001 still holds for allocating layers. step-capture also wraps legal `Layer.succeed` stubs in the same helper (413-549). That does not make the helper visible to EV002; it means the detector cannot tell stub from NodeFileSystem rebuild.
- P0F-R1-003 still holds. OpenClaw's three `it.layer(NodeServices.layer)` sites and Pacer's remaining `mockLayer()` blocks are now seen in full. Pacer line 227-237 *does* call `provideScopedLayer`; the earlier sample-table note that the helper was unused in those suites was wrong.
- P0F-R1-006 is confirmed, not contradicted, by effect-vitest-contract.test.ts:183-190. Line-shift sameness and `#2` distinctness are intended. Deleting the first of two identical fingerprints is still untested and still remaps `#2` to `#1`.
- P0F-R1-004 is unchanged after the rest of DuckDb. The hour sleep remains the unique baseline EV008. Additional live waits use `node:timers/promises` `sleep`, which EV008 does not see.
- P0F-R1-009 is strengthened by IdentityRdfBinding 285-292 (`O.isSome`/`O.isNone` inside `assert.isTrue`).

## Strongest findings

The mechanical D14 net misses the idiom this repo actually uses. `provideScopedLayer` and same-file `Layer.build` plus `Effect.provide` helpers rebuild allocating layers per test, which is the pattern SPEC 1.5 tells Resource to delete. EV002 only sees a lexical `Effect.provide` in the tester callback. EV003 only sees `withXyz` names. Host, DocumentIntake, ArchitectureLabProof, DuckDb, ClockCorrelator, Pacer, and IdentityRdfBinding all use the hidden helper. That is P0F-R1-001.

Public `layer` / `effect` / `live` exports are not harness. `file-inventory.test.ts` registers `layer(NodeServices.layer)(...)`. Inner `it.effect` callbacks and EV014 never attach. The KG still lists those exports. That is P0F-R1-002.

EV014 is inverted. `it.layer(EpistemicServerLive)` and `it.layer(NodeServices.layer)` produce no row. `it.layer(inMemoryClaimDispositions)` over `Layer.unwrap(Ref.make([]))` does. EV002 already has an unresolved-identifier judgment path. EV014 does not. That is P0F-R1-003.

EV008 ignores pinned `TestClock.withLive` waits (`NodeFileSystem.test.ts` startWatch, `SqlCleanupTest.ts` waitForCount) and the only baseline EV008 is DuckDb interrupting an hour-long sleep. TestClock.adjust would change that test. That is P0F-R1-004.

EV010 misses `@effect/platform-bun/BunFileSystem` subpaths and CJS `require("node:fs")`. That is P0F-R1-005.

Duplicate identical snippets share a membership key except for visit-order ordinal. Fixing the first remaps the second. chat-ui lines 226 and 245 are the pair. That is P0F-R1-006.

EV009 both flags `it.live` plus `Effect.sleep` in the detector tests and misses `Effect.fnUntraced` live bodies such as dock-shell's debounce wait. That is P0F-R1-007.

Same-file helpers hide EV001/EV007/EV004 the way provideScopedLayer hides EV002. DuckDb's `assertSchemaArbitraryRoundTrips` contains the only `fc.assert` in that file; census EV007=1 and baseline has none. OpenClaw `runCaptured` hides `Effect.scoped`. That is P0F-R1-012.

KG `layer.option.timeout` and `TestClock.withLive` have empty `replaces` while they are the public timeout and live-wait forms for EV014 and EV008. That is P0F-R1-013.

## What held up

D1-D14 are still locked in SPEC/DECISIONS. Cheap-gates registration exists (`GithubChecks.ts` 562-566). Pin refusal lives in `EffectVitestScan.ts` 60-90 and is tested. The 85-entry KG matches the portable index/utils/README/charter anchors in `effect-vitest-primitives.test.ts`. README Overview gotchas refuse to treat the feature table as Schema-capable sync `it.prop`. Charters add L-RES/L-FLAKE/L-PROP/L-OBS residue rules and keep P0g/P1 as real stops. D5 doctrine examples keep plain-value `expect` and utils helpers for Option/Result/Exit.

The instrumented runner is in better shape than the detector. It wraps call/skip/skipIf/runIf/only/each/fails/prop and named/unnamed/nested layer callbacks through public `makeMethods` testers. Watchdog sleep uses a module-load live `Clock` rather than `TestClock.withLive`, which is the right choice for `it.live` and `excludeTestServices`. Fixtures in `runtime.test.ts.txt` plus `Vitest.runtime.test.ts` cover TestHang last-log and name, finalizer release, tiny/disabled timeouts, concurrent each isolation, trace gating, defect/interrupt preservation, property shared deadline, and repeat/retry ALS reset. Native `Map` for property runs is the only weak Effect pattern filed (P0F-R1-010).

Published MemoryFileSystem documents the one-volume-per-`it.layer` gotcha (`MemoryFileSystem.test-kit.ts` 3148-3153). FileSystemConformance carries the D14 `strictEffectProvide:skip-file` exception. Upstream supplement helpers use `it.layer(layer, { timeout })` on the shared store/cache/queue/event-log layers.

## Mandatory groups

| Group | Status | Spans used |
| --- | --- | --- |
| 01-contract | Read. Addendum README/PLAN/ops supersede sealed status prose only. | SPEC.md D1-D14 and §7; DECISIONS.md 1-71, 69-72 exception ledger; addendum README.md 1-41, PLAN.md 1-148 and 186-210, ops/manifest.json 49-120; sealed README.md 1-34 for the stale-vs-corrected comparison; GOAL.md 1-44 |
| 02-pinned-grounding | Cited APIs, five recovered helpers, and complete 85-entry KG. | packages/vitest/src/index.ts 1-260, internal/internal.ts 24-373; utils.ts via KG/tests; README.md 1-50, 76-80, 226-282; Clock.ts 189, 326; Logger.ts 471-474, 914-936; TestClock.ts 507, 544, 580-581; Layer.ts 762-775, 2304-2326; Scope.ts 215, 542-545; NodeFileSystem.test.ts 11-42; supplement SqlCleanupTest.ts, KeyValueStoreTest.ts, PersistedCacheTest.ts, PersistedQueueTest.ts, SqlEventLogServerUnencryptedStorageTest.ts; standards/effect-vitest.primitives.jsonc 1-1519 |
| 03-detector | Full proposed detector/store/focused tests now read, including previously missing store and contract/primitives/store tests. | EffectVitest.ts; EffectVitestScan.ts 60-369; EffectVitestPolicy.ts 24-272; EffectVitestSyntax.ts 61-805; EffectVitestDetectors.ts 1-558; EffectVitestPrimitives.ts 1-64; EffectVitestStore.ts 1-208; Lint.schemas.ts 700-1316; GithubChecks.ts 562-566; effect-vitest-detectors.test.ts 1-324; effect-vitest-primitives.test.ts 1-413; effect-vitest-contract.test.ts 1-190; effect-vitest-store.test.ts 1-60 |
| 04-charters | Read all five prompts plus Vitest.ts, errors, runtime, instrumentation, both tests, fixture. | ops/prompts/*.md; Vitest.ts 1-43; Vitest.errors.ts 1-113; VitestRuntime.ts 1-51; VitestInstrumentation.ts 1-428; Vitest.test.ts 1-153; Vitest.runtime.test.ts 1-264; fixtures/vitest-instrumentation/runtime.test.ts.txt 1-240 |
| 05-doctrine | Read AGENTS testing lines via packet, 08-testing.md D5 example, D5 correction receipt. | 08-testing.md 66-93; history/lanes/d5-doctrine-corrections.md 1-80 |
| 06-samples | All 20 sample bodies now full-file reads from the original corpus, plus inventory rows and cited support. | See sample table |
| 07-local-support | Bounded helpers actually reached by samples. | test-utils Layer.ts 1-37, index.ts 1-51, SystemTemp.ts 1-80; DrainableWorker.ts 31-80; Host.ts import only as used by Host.test.ts |
| 08-filesystem-context | Conformance exception, Memory volume gotcha, D14 tsgo test. | FileSystemConformance.ts 1-80; MemoryFileSystem.test-kit.ts 3144-3168; quality-tsgo-directives.test.ts 10-64 |

## Sampled tests (20)

Coverage column: "full body" means this continuation finished every line of the file from the original corpus. "full body (earlier pass)" means the first pass already returned the complete file.

| # | Path | Coverage | Detector vs sample |
| --- | --- | --- | --- |
| 1 | apps/professional-desktop/test/theme-atoms.test.tsx | full body (earlier pass), 162 lines | EV011 true. EV014 miss on `it.layer(ProfessionalStorageLive)` (P0F-R1-003). `vi.spyOn(window, "matchMedia")` correctly not EV012 |
| 2 | apps/professional-desktop/test/chat-ui.test.tsx | full body this pass (earlier 1-80; remainder 81-248) | P0F-R1-006 pair at 226/245 confirmed in `it.effect`. Rest is plain `it` DOM/key bounds. `Effect.promise(waitFor)` is flake-lens, not EV008 |
| 3 | apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts | full body (earlier pass), 51 lines | EV007 true on `fc.assert`. Hidden `provideScopedLayer` (P0F-R1-001) |
| 4 | apps/professional-desktop/test/dock-shell.test.tsx | full body (earlier pass), 195 lines | EV011 true. EV009 miss on `it.live` plus `Effect.fnUntraced` plus `Effect.sleep` (P0F-R1-007) |
| 5 | apps/practice-kg-mcp/test/Host.test.ts | full body (earlier pass), 86 lines | P0F-R1-001, 005, 008 |
| 6 | infra/test/OpenClaw.test.ts | full body this pass (earlier 280-327, 397-423; remainder 1-279, 329-389, 430-828) | EV001 true for in-test `runSync`. EV014 miss on three `it.layer(NodeServices.layer)` sites. Hidden `Effect.scoped` in `runCaptured` (P0F-R1-012). Subpath NodeServices import (P0F-R1-005) |
| 7 | infra/ci-runners/sdks/ghaRunners/test/build.test.js | full body (earlier pass), 72 lines | EV010 miss on CJS require (P0F-R1-005) |
| 8 | packages/drivers/pacer/test/Pacer.test.ts | full body this pass (earlier 1-160; remainder 161-385) | Canonical `it.prop` is not EV007. `it.layer(mockLayer())` EV014 miss. Line 227-237 *does* call `provideScopedLayer` (corrects the earlier unused-helper note) |
| 9 | packages/foundation/capability/semantic-web/test/IdentityRdfBinding.test.ts | full body this pass (earlier 80-178; remainder 1-79, 179-296) | `it.effect.prop` wanted. `fc.assert` is EV007. `assert.isTrue(Result.isFailure)` and nested `O.isSome` (P0F-R1-009). `provideScopedLayer` at 237 (P0F-R1-001) |
| 10 | packages/drivers/drizzle/test/Drizzle.errors.test.ts | full body this pass (earlier 1-50, 320-369; remainder 51-319, 370-459) | `expect(O.isNone/isSome)` EV006 true. Lexical `fc.assert` EV007 true. Five `provideScopedLayer(Drizzle.makeLayer(client))` sites (P0F-R1-001) |
| 11 | packages/drivers/duckdb/test/DuckDb.service.test.ts | full body this pass (earlier 600-679; remainder 1-599, 680-1248) | Unique EV008 interrupt-sleep (P0F-R1-004). Helper-hidden `fc.assert`/`runSync` (P0F-R1-012). Body-root `withNativeDuckDbConnection` is EV003; nested `withTempDirectory` is not |
| 12 | packages/documents/server/test/DocumentIntake.test.ts | full body this pass (earlier 1-108; remainder 109-189) | More `provideScopedLayer` and `Effect.result` (P0F-R1-001, 008) |
| 13 | packages/epistemic/use-cases/test/ClaimDisposition.test.ts | full body (earlier pass), 114 lines | EV014 false positive on in-memory unwrap (P0F-R1-003) |
| 14 | packages/tooling/tool/cli/test/step-capture-lifecycle.test.ts | full body this pass (earlier 280-379; remainder 1-279, 380-559) | `it.live` OS tests (P0F-R1-007). Allocating and stub `provideScopedLayer` mixed (P0F-R1-001 qualifier). `TestClock.adjust` with `Effect.sleep` at 499/504 is EV008-negative |
| 15 | packages/drivers/obs/test/integration/Obs.live.test.ts | full body (earlier pass), 57 lines | Module-scope `runPromise` allowed. Lexical `Effect.provide(context)` is EV002 true |
| 16 | packages/tooling/library/ai-metrics/test/file-inventory.test.ts | full body (earlier pass), 69 lines | Standalone `layer()` (P0F-R1-002, 013) |
| 17 | packages/foundation/modeling/utils/test/DrainableWorker.test.ts | full body (earlier pass), 53 lines | EV004 whole-body scoped. EV009 unjustified live |
| 18 | packages/epistemic/server/test/EpistemicServer.test.ts | full body (earlier pass), 41 lines | EV014 miss on imported server layer (P0F-R1-003) |
| 19 | packages/tooling/library/qa-capture/test/integration/ClockCorrelator.integration.test.ts | full body (earlier pass), 132 lines | Genuine live. provideScopedLayer (P0F-R1-001). EV009 false positive (P0F-R1-007) |
| 20 | packages/foundation/modeling/schema/test/Csp.test.ts | full body (earlier pass), 25 lines | Lexical `fc.assert` EV007 true |

## Status addendum

Corrected README, PLAN phase table, and ops/manifest agree. P0a-P0.5 complete, P0f in progress, PR1047 merged by Benjamin as `03faddd` on `0fce23f`, P0g/P1 still closed. Remaining inconsistency is P0F-R1-011. The originally stale sealed README is not re-filed.

## Pinned reference supplement

The five recovered files at pin `2600f62f4532026928454dcea8d1c48557b3f942` close the grounding-2 extraction gap. They confirm shared `it.layer(..., { timeout })` plus inner per-test resources, and `TestClock.withLive` waits. No further missing pinned inputs were required for this round's claims.

## Unresolved evidence gaps

The 13 files / 5016 lines from `p0f-round1-read-coverage-gaps.json` are closed. Context.ts remains absent from the partial rc.112 extract. `Scope.Scope.use` in the runner was not re-derived from that file. Runtime fixtures already prove logger provision and watchdog behavior, so it was not filed. Installed `@effect/vitest` src is byte-identical to the pin (validation.json). Effect.ts/Schema.ts bodies outside the cited combinators and KG line anchors were not dumped.

## Limits

This is source review of the sealed original corpus only. Detector/ratchet were not executed. Live-checkout repairs happening in parallel were not read and are not this round's snapshot. Broad Effect.ts/Schema.ts were not dumped beyond the cited APIs. Support modules not in the 20 samples or the gap list (for example `@beep/repo-cli/test/Process`) were not newly opened. Coverage completeness here is the 13 listed files plus the already-complete 7 samples, complete KG, store, and focused tests. It is not a claim that every file in the 282-input corpus was reread.

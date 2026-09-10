# P0f adversarial round 2

Reviewer: Grok 4.6 (read-only). Snapshot: `~/.cache/beep/effect-vitest-canon/pr1067-resume/round-2-corpus`. Assigned outputs only. Root owns judgment and repairs.

Status: **required coverage complete** (same round 2; not round 3). Twelve JSONL findings `P0F-R2-001`..`P0F-R2-012` retained byte-for-byte. PLAN.md L251–469 is now a successful `read_file` body; it does not add a thirteenth claim. All claims remain source-derived predictions. This review does not execute tests, scans, or Git. R2-009 is retained as original-report evidence; Root reports 009/010/011/012 already fixed in later source, 001–007 under bounded triage, and 008 runtime binding verified separately. Those later repairs are not re-filed from this sealed snapshot.

Constraints observed: rc.113 pin `d3b837aee836f35d625d55205f7d6e61305fc198`; inherited Vitest 4.1.11 vs declared peer `>=5 <6` reviewed against supplied types and receipts, not a global upgrade; nonempty baseline/unmigrated tests treated as expected before P1/P2; no merge or phase change; closed R1 claims not reopened without new exact evidence. Missing supplied `runners.js` is a coverage limitation, not proof of an absent runtime function. Root will separately validate the actual runtime binding for R2-008.

## Counts

- Samples: 20/20 paths; candidate rows compared to bodies. Sample 13 full body now read.
- Findings JSONL: 12 sequential ids `P0F-R2-001` .. `P0F-R2-012` (byte-for-byte; no row appended from PLAN L251–469).
- Graph: 100 entries in `standards/effect-vitest.primitives.jsonc`.
- Detector rules in source: EV001–EV015.
- Closed R1 rows not reopened: P0F-R1-001..013 (R1-004 remainder is a new sleep-in-provided-service shape, not the waived callback-wide withLive claim).

## Exact coverage ledger (remaining-range closeout)

Every unread range from `round-2-required-remaining-ranges.json` was read as a successful `read_file` body against the sealed corpus. PLAN.md L251–469 was the remaining packet-doc gap after that list: this closeout reads that range only. Grep was used only to locate later citations. Unrelated `Lint.schemas.ts` families stay unread. Large unmodified pinned modules stay on cited API ranges. Background receipts and packet docs are cited only at the ranges actually read, not as whole-file complete.

| Group | Path | Lines read this continuation | Combined status |
| --- | --- | --- | --- |
| packet | `goals/effect-vitest-canon/PLAN.md` | 251–469 | P0a–P3 recipe, resume contract, verification block. Combined with prior L5–19 and L148–243 only. Not a whole-file read (L20–147 and L244–250 unread). |
| packet | `goals/effect-vitest-canon/SPEC.md` | 1–249, 330–399 | complete (plus prior 250–329, 400–470) |
| packet | `goals/effect-vitest-canon/DECISIONS.md` | 1–229, 350–429 | complete (plus prior 230–349, 430–494) |
| charter | `goals/effect-vitest-canon/ops/prompts/lane-contract.md` | 81–94 | complete |
| doctrine | `standards/architecture/08-testing.md` | 81–370 | complete |
| doctrine | `.patterns/testing-patterns.md` | 1–604 | complete |
| doctrine | `.claude/skills/effect-first-development/SKILL.md` | 1–154 | complete |
| doctrine | `goals/effect-vitest-canon/history/lanes/d5-doctrine-corrections.md` | 1–83 entire | complete |
| schemas | `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts` EffectVitest | 660–1481 (all EffectVitest exports through `decodeEffectVitestFindingJson`) | EffectVitest complete; unrelated families unread |
| tests | `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts` | 81–610 | complete |
| tests | `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts` | 170–217 | complete |
| tests | `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts` | 81–506 | complete |
| tests | `packages/tooling/tool/cli/test/effect-vitest-store.test.ts` | 81–101 | complete |
| graph | `standards/effect-vitest.primitives.jsonc` | 81–639, 670–1299, 1340–1454, 1505–1754 | complete with prior 1–80, 640–669, 1300–1339, 1455–1504, 1755–1821 |
| runtime | `packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` | 121–470 | complete |
| runtime | `.../fixtures/vitest-instrumentation/runtime.test.ts.txt` | 1–504 | complete |
| runtime | `packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts` | 1–46 | complete |
| runtime | `.../fixtures/vitest-instrumentation/diagnostic-reporter.ts.txt` | 1–32 | complete |
| sample 13 | `packages/tooling/tool/cli/test/quality-scheduler.test.ts` | 1–100, 101–879, 930–1069, 1120–1687, 1738–2727, 2758–3054, 3168–3237, 3368–3387, 3418–3624, 3805–4574, 4605–5099, 5130–5367 | complete with prior successful slices through 5395 |

Already-complete code/charters/graph/tests/twenty samples were not repeated. Packet README/GOAL and PLAN L5–19 / L148–243 remain prior-range reads, not a whole PLAN.

## Mandatory groups (combined)

### Guides

- `round-2-corpus/reading-guide.md` L1–9 complete.
- `round-2-corpus/manifest.json` groups and paths (full originalRelativePath inventory via search; body not line-walked past ~1000).
- `round-2-corpus/samples.json` L1–4582 complete (20 samples).

### 09 prior-round closure

- `goals/effect-vitest-canon/history/2026-09-09-adversarial-round-1-closure.md` L1–163 complete.
- `goals/effect-vitest-canon/DECISIONS.md` now complete, including L237–327 R1 dispositions, L270–291 R1-010 waiver, L449–464 Vitest 4.1.11 retention.
- Round-1 JSONL is not in this snapshot. Claims use the closure ledger, not a re-read of R1 JSONL.

### 01 packet / D1–D14

- SPEC and DECISIONS: range-complete as in the ledger. README/GOAL and `ops/manifest.json` remain prior-range reads for D1–D14 tables and current P0f prose, not re-read here.
- SPEC detector table L434–455; D1–D14 in DECISIONS L8–23; SPEC 1.7 L235–238 (P0F-R2-011).
- PLAN ranges actually read: phase gates L5–19; P0f current work L148–243; this closeout L251–469 (P0a grounding through P3 close, resume contract L455–460, verification L462–469).
- PLAN L251–469 is the original phase recipe: P0d still pins `@effect/vitest@4.0.0-rc.112` sha `2600f62f…` (L323–326), README Resource Safety 257 / flakyTest 280 (L315–317), and P0c “latest accepted P0e census” 970/105 (L307–309). Those are the same stale-narrative family already recorded in P0F-R2-009/010 against current-work PLAN L28 (100-entry rc.113 graph) and the live graph README 295–317. Not filed as a thirteenth defect. Later Root repairs of 009–012 are outside this snapshot.
- Verification receipts P0a–P0e, P0.5 hosted/local, rc.113 integration/timing: cited only at previously read headers/gates, not as whole-file receipt reads in this closeout.

### 02 pinned graph

- `standards/effect-vitest.primitives.jsonc` L1–1821 complete. 100 `id` fields. Every EV001–EV015 has a `replaces` edge. EV015's only replacement remains `it.layer.option.excludeTestServices` (P0F-R2-005). No `TestClock.setTime` / `advance` graph id.

### 03 detector source/tests

- Detector implementation files complete from the initial pass (`EffectVitest.ts`, Policy, Primitives, Detectors, Syntax, Scan, Store).
- `Lint.schemas.ts` EffectVitest L660–1481 complete (rule ids, finding invariant, graph invariant requiring every EV rule in `replaces`, `makeEffectVitestFindingKey`, JSON codecs).
- Tests: `effect-vitest-detectors.test.ts` complete including L170–217 instrumented-tester provenance; `effect-vitest-contract.test.ts` complete; `effect-vitest-primitives.test.ts` complete; `effect-vitest-store.test.ts` complete.
- EV015 fixture negative uses `beforeEach(() => TC.setTime(0))` plus `TC.adjust` (`effect-vitest-detectors.test.ts` L141–145). `detectLayerClockReset` matches only `adjust` (`EffectVitestDetectors.ts` L820–830). That matches SPEC EV015 (`TestClock.adjust` inside `it.layer`), so it is not filed as a detector FN.

### 04 charters and runner

- Four lens charters plus `lane-contract.md` complete.
- Runner sources complete from the initial pass.
- `test/Vitest.test.ts` L1–366 complete.
- `test/Vitest.runtime.test.ts` L1–470 complete. Watchdog / tiny-timeout / disabled-timeouts / property-deadline / setup-budget / late-success / concurrent-property / registration-identity / repeat-retry / each-titles / only cases are in the parent test body.
- `test/fixtures/vitest-instrumentation/runtime.test.ts.txt` L1–504 complete. `makeIt(controlled.clock)` keeps body `Clock.monotonicTimeNanos` at `0n` while the watchdog clock is independent (`runtime.test.ts.txt` L172–236). `TestRunner.getCurrentSuite` is imported from `@effect/vitest` at L3 and used at L411 for `each-titles` collection; that is not a substitute for pinned unnamed `it.layer` `V.TestRunner.getCurrentSuite`. Snapshot still has no `runners.js`.
- `src/test/Vitest.test-kit.ts` L1–46 complete (`makeIt(clock) => makeVitestRuntime(clock).it`; named `@beep/test-utils/test/Vitest` null publish + scoped wildcard).
- `diagnostic-reporter.ts.txt` L1–32 complete (`vitest/node` Reporter types; `Clock.monotonicTimeNanos`; `BEEP_VITEST_RAW_ERROR`; `Effect.runPromise` in reporter methods).

### 05 doctrine

- `standards/architecture/08-testing.md` complete. D5 helpers and legal plain `expect` are present. Standalone `layer(TestLayer)` examples at L137/L166 are the pinned `layer` export, not a D14 contradiction by themselves.
- `.patterns/testing-patterns.md` complete. D5 helper/plain-expect split is present (L62–79, L459–521). Concurrent example still calls `TestClock.advance` (P0F-R2-012).
- effect-first SKILL.md complete; D5 testing guidance at L33.
- `history/lanes/d5-doctrine-corrections.md` complete. Skill after-hash `1952a171…` is the D5 claim; 08-testing after-hash `eb490979…` and testing-patterns after-hash `7b9c8dad…` are D5-lane hashes, not re-hashed here. D5 L32 excludes inherited `TestClock.advance` timing prose from its proof.

### 06 samples

All 20 bodies compared to `samples.json` rows. Sample 13 is now a full-body read.

## Sample paths (20) vs candidate rows

| # | Path | Rows vs body |
| --- | --- | --- |
| 1 | `packages/drivers/wink/test/Layers.test.ts` | EV001 `runPromise` L13, EV003 wrapper def L6–9, EV011 vitest L4. Matches. No EV002: provide is inside plain `it`, SPEC EV002 is it.effect/it.live. |
| 2 | `packages/architecture-lab/server/test/WorkerServer.test.ts` | EV002 `provideScopedLayer` as `fnUntraced` second arg L34; EV003 def L11–13. Matches R1-007 extraction. |
| 3 | `packages/tooling/library/qa-capture/test/Witness.service.test.ts` | EV002 call sites L27/L35; EV003 def L6–8. Matches. |
| 4 | `packages/foundation/ui-system/brand/test/assets.test.ts` | EV003/EV004 `withBunServices` L10–11; EV010 BunServices L3. EV006 miss on L48–51 `O.getOrElse` (P0F-R2-002). |
| 5 | `packages/workspace/server/test/WorkspaceVaultStore.test.ts` | EV001/EV007 helper `runSync`+`checkEffect` L27–39; EV002 L70/L96; EV005 L87; EV006 L59/L90/L95; EV010 BunFileSystem+BunPath L4–5. EV006 miss on L68 `getOrUndefined` (P0F-R2-002). EV006 primitive always `assertSome` (P0F-R2-006). |
| 6 | `packages/foundation/capability/observability/test/DevTools.test.ts` | EV006 L19–20 `O.isSome`; EV011 L4. Matches. |
| 7 | `packages/tooling/library/ai-metrics/test/FlightRecordGeneration.test.ts` | EV007 `checkEffect` L13–30 inside `it.effect`. Matches. No EV001 (no runSync). |
| 8 | `packages/tooling/tool/cli/test/yeet-pr-provenance.test.ts` | EV002 PlatformLayer provides; EV006 Option `toStrictEqual`; EV008 L188 sleep. EV008 mechanization is detector despite forked TestClock drive (P0F-R2-001). |
| 9 | `packages/agents/client/test/selected-thread-lifetime.test.ts` | EV006 L37 `O.some`; EV009 `it.live` L18–39. Judgment is correct residue: flake charter says detached Atom TTL is not TestClock. Not reopened as a detector bug. |
| 10 | `packages/tooling/test-kit/test-utils/test/FileSystemConformance.node.test.ts` | EV010 NodeFileSystem L2. True platform-conformance candidate. |
| 11 | `packages/foundation/ui-system/ui/test/FormWidgets.test.ts` | EV011 L4 only. EV006 FN on L11/L16/L22 `getOrUndefined` (P0F-R2-002). |
| 12 | `packages/foundation/modeling/pandoc-ast/test/Pandoc.conformance-strict-failure.test.ts` | EV001 L27 `runSync`; EV006 L33 `O.some`; EV011 L5 `vi`; EV012 `vi.mock` codec module (P0F-R2-007). |
| 13 | `packages/tooling/tool/cli/test/quality-scheduler.test.ts` | 5395 lines, full body. EV001 mass `runPromise` (expected unmigrated). EV002 `provideScopedLayer` judgment rows. EV003 `withProcessPath` L261. EV006 `O.isSome`/`O.some` rows including L193/L202/L1167. EV007 L900/L3070. EV009 `it.live` L3639. EV010 L75–77 barrel+FS+Path (P0F-R2-003; original JSONL cited L18–20 — see provenance note). EV013 C-style retry L1092. `it.effect` L3959 forks reap then `TestClock.adjust`; no EV015 row (not an `it.layer` block; SPEC EV015 is layer-shared adjust). `Effect.sleep` / `Schedule.spaced` under `it`+`runPromise` correctly skip EV008 (SPEC is it.effect). |
| 14 | `packages/tooling/tool/docgen/test/version.test.ts` | EV010 BunServices L2; EV014 `layer(BunServices.layer)` L9 without timeout. Judgment; charter example also wants hook timeout on NodeServices. |
| 15 | `packages/foundation/capability/langextract/test/Service.test.ts` | EV014 four `layer(...)` blocks; EV015 TestClock.adjust L162/L196/L199 (P0F-R2-005). `@beep/utils/Option` getOrUndefined L168 not EV006 (P0F-R2-002). |
| 16 | `apps/labs/semantica/test/App.test.tsx` | Empty rows. vitest+RTL, no Effect. Clean. |
| 17 | `infra/lambda/turbo-cache/test/hmac.test.ts` | Empty rows. `bun:test`, no Effect. Unmigrated expected before P1; SPEC non-goal is Bun's runner. |
| 18 | `packages/foundation/ui-system/editor/test/Version.test.ts` | Empty rows. `@effect/vitest` plain value test. Clean. |
| 19 | `packages/_internal/db-admin/test/index.test.ts` | Empty rows. Clean. |
| 20 | `apps/labs/lejeune-bolt-workbench/test/App.test.tsx` | Empty rows. Same shape as 16. Clean. |

### P0F-R2-003 line-citation provenance

Original JSONL evidence cites `quality-scheduler.test.ts:18-20`. The sealed source body and `samples.json` place those three specifiers at L75–77 (`NodeChildProcessSpawner`/`NodeServices`, `NodeFileSystem`, `NodePath`). The over-flag claim is unchanged. Original JSONL is not rewritten.

## Pinned API coverage (actual ranges)

| File | Read |
| --- | --- |
| `packages/vitest/src/index.ts` | L1–284 complete (export-star, Methods, layer, it, makeMethods). |
| `packages/vitest/src/internal/internal.ts` | L1–400 complete (`getCurrentSuite`, `runTest` abort finalizers, `makeTester`/`each`→`it.for`, `layer` named/unnamed, `flakyTest`, `makeMethods`). |
| `packages/vitest/src/utils.ts` | L1–327 complete through `assertExitSuccess`. |
| `packages/vitest/README.md` | L1–50 install/Vitest 5 migration; L108–154 Exit+TestClock; L241–317 fails, logging, `## Resource Safety and Scope` (graph L295–317); L318–349 `it.flakyTest`. Charter still cites README 257–279 (P0F-R2-010). |
| `packages/vitest/package.json` | complete; peer vitest `>=5 <6`. |
| `packages/effect/src/testing/TestClock.ts` | L1–80 module docs; L490–581 `adjust`/`setTime`/`withLive`. No `advance` export. |
| `packages/effect/src/Clock.ts` | L1–130 interface including `currentTimeMillis` and `monotonicTimeNanos`. |
| `packages/effect/src/unstable/arbitrary/Arbitrary.ts` | L1–80; L530–549 `checkEffect`. |
| `packages/effect/src/Layer.ts` | L2295–2324 `mock`. |
| `packages/effect/src/Effect.ts` | L4698–4703 `sleep`. |
| `packages/effect/src/FileSystem.ts` | L140–191 `exists`/`makeTempDirectoryScoped`; L655–674 stub object (charter “service at 663” is this stub `exists()`, not the service). |
| `packages/effect/src/internal/effect.ts` | `sleep` at L6284 identified, body unread. |
| Installed `node_modules/vitest` | `package.json` 4.1.11; `dist/index.d.ts` L1–80 (types only; no `runners.js` in this snapshot). |
| Installed `@vitest/runner` | `aroundEach` and `getCurrentSuite` declarations; `Test.fullTestName`/`timeout`; `TestContext.signal`. |
| Installed `@effect/vitest` | `package.json` peer `>=5 <6`; `dist/internal/internal.js` L16 `V.TestRunner.getCurrentSuite`. |

Unread large pinned modules: `Effect.ts`/`Schema.ts`/`Logger.ts` beyond cited APIs, as allowed.

## Vitest 4.1.11 vs declared peer 5

Declared: `@effect/vitest` 4.0.0-rc.113 peer `vitest >=5.0.0 <6.0.0` (pin README L7–12, package.json, graph `readme.migrating-vitest5`).

Installed: vitest 4.1.11. DECISIONS L449–464 keeps that stack; silence is not upgrade authorization.

Public 4.1.11 APIs the runner actually uses and that exist on supplied types: `aroundEach`, `TestContext.task.fullTestName`, `task.timeout`, `signal`, `onTestFinished`, `it.for`. Watchdog uses live `Clock` via `Effect.provideService(Effect.sleep, Clock.Clock, clock)`, not `TestClock.withLive`, matching D7 and R1-013.

Concrete type risk, not demonstrated runtime failure here: unnamed `it.layer` in pinned `internal.ts:20` reads `V.TestRunner.getCurrentSuite`. 4.1.11 `index.d.ts` exports `TestRunner` as `VitestTestRunner` from `./runners.js` and does not re-export `getCurrentSuite` on that name. Snapshot `vitest/dist` is types-only. Missing `runners.js` is a coverage limitation, not proof the runtime function is absent. P0e receipt reports unnamed-layer tests passing — executed proof, not re-run. Finding P0F-R2-008. Root will separately validate the actual runtime binding.

## Runner clock / property / watchdog (no new execution)

- Module-load `liveClock = Effect.runSync(Clock.Clock)`; default instrumented testers pass that clock into watchdog sleep (`VitestInstrumentation.ts` L24, L214, L229, L452).
- `makeIt(clock)` binds only the watchdog/lifecycle clock; body TestEnv/TestClock remain (`Vitest.test-kit.ts` L16–18; fixture `runtime.test.ts.txt` L174–176, L224–231).
- Property registrations share one `propertyRegistration = {}` object and one deadline (`L369–380`, L216–232). R1-010 Map waiver not reopened. Runtime parent proves one absolute deadline, setup charged before arming, late `raceFirst` success, concurrent isolation, same-title isolation, and repeat/retry reset (`Vitest.runtime.test.ts` L333–453).
- `timeout <= 0` or non-finite disables the watchdog (`L78–80`). Covered in `Vitest.test.ts` L256–271 and fixture `disabled-timeouts` (`runtime.test.ts.txt` L105–108; parent L253–263).
- `excludeTestServices` layer still uses the live watchdog clock (`Vitest.test.ts` L145–151; fixture L153–157).
- `instrumentMethods` wraps `effect`/`live`/`layer` testers including `each`/`prop`; Methods-level sync `it.prop` is uninstrumented (sync, not D7 Effect watchdog).
- Charter All Seeing Eye vs source: live watchdog without assuming `TestClock.withLive`. Agrees.

## Remaining unread (allowed)

- `goals/effect-vitest-canon/PLAN.md` L20–147 and L244–250 (not in this closeout).
- `Lint.schemas.ts` non-EffectVitest inventory/schema families.
- Pinned `Effect.ts`/`Schema.ts`/`Logger.ts` except cited APIs.
- Installed vitest runtime JS (`runners.js` absent from snapshot).
- History receipts beyond previously cited headers/gates.

## Findings

See `2026-09-10-adversarial-round-2.jsonl`. Twelve rows unchanged. PLAN L251–469 added no JSONL row.

Not filed: nonempty baseline; unmigrated `runPromise`/`bun:test`; EV009 on selected-thread (judgment matches flake charter); EV014 on BunServices (charter example uses hook timeout on NodeServices); D4 10.319s post-adoption timing (already tracked; no global timeout change); R1-010 Map; R1-003 unwrap judgment; standalone `layer(TestLayer)` in 08-testing (pinned `layer` export); EV015 ignoring `setTime` as the mutation (SPEC EV015 names `adjust`); quality-scheduler `it.effect`+`TestClock.adjust` at L3959 (not an `it.layer` shared clock); PLAN P0d rc.112 pin / README 257 / P0c 970/105 (stale historical recipe already covered by P0F-R2-009/010).

## Completion

Required coverage listed in `round-2-required-remaining-ranges.json` plus PLAN.md L251–469 is complete. All 20 sample bodies remain previously read. JSONL has twelve rows, unchanged. Root should hash-verify these staging files and copy them to canonical history after review.

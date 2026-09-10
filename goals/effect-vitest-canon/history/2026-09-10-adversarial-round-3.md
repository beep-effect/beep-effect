# P0f adversarial round 3

Status: complete for required current implementation, tests, graph, packet, charters, and all 20 sample bodies
Reviewer: grok (read-only)
Snapshot: `~/.cache/beep/effect-vitest-canon/pr1067-resume/round-3-corpus`
Pin: Effect rc.113 `d3b837aee836f35d625d55205f7d6e61305fc198`
Findings: `2026-09-10-adversarial-round-3.jsonl` (4 rows: P0F-R3-001..004; unchanged this continuation)
Proof class: source-derived prediction unless a supplied runtime artifact is cited. No execution.

This file is a private staging ledger. Root owns judgment, hash-verify, and copy to goal history. P0g ratification/merge and P1 acknowledgement remain. No merge or phase change.

Coverage authority: Root audit `~/.cache/beep/effect-vitest-canon/pr1067-resume/round-3-read-coverage-audit.json` (223 successful reads, zero returned-slice mismatches, source hash manifest unchanged). This continuation finished only the audit's remaining required unread ranges listed by Root; it did not reread complete files.

## Mission constraints honored

- Read-only snapshot review. No source, config, corpus, baseline, git, test, build, install, scheduler, network, browser, agent, or extra-output writes.
- Closed prior-round claims not reopened without new exact evidence.
- Inherited Vitest 4.1.11 vs declared peer `>=5 <6` treated as declared-peer mismatch plus supplied runtime proof, not an automatic defect.
- No global configuration/timeout/property-floor change proposed.
- Nonempty baseline / unmigrated tests treated as expected before P1/P2.
- Not a claim of exhaustive read of all 361 corpus inputs.

## Mandatory groups (audit-corrected)

### Bootstrap

- `reading-guide.md` L1-9
- `manifest.json` walked for groups/roles (packet, charters, detector, four focused tests, graph, runner, samples)
- `samples.json` all 20 ordinals

### Prior-round closure

- `goals/effect-vitest-canon/history/2026-09-09-adversarial-round-1-closure.md` complete per prior verified slices
- `goals/effect-vitest-canon/history/2026-09-10-adversarial-round-2-closure.md` complete
- R2-001..012 dispositions retained; not reopened

### Packet / D1-D14 — now complete

- `GOAL.md` L1-48 complete (audit)
- `README.md` L1-57 complete (audit)
- `DECISIONS.md` L1-521 complete (audit L1-80 and L220-521; this turn L81-219)
- `SPEC.md` L1-473 complete (audit L97-316 and L400-469; this turn L1-96, L317-399, L470-473)
- `PLAN.md` L1-488 complete (audit L1-279; this turn L280-488)

### Graph — now complete

- `standards/effect-vitest.primitives.jsonc` L1-1821, 100 entries (audit L1-80 and L1420-1539; this turn L81-1419 and L1540-1821)
- EV015 edges: `it.layer.option.excludeTestServices` and `TestClock.adjust`; policy preferred primitive remains `TestClock.adjust`
- EV005 edges: `utils.assertExitFailure` and `utils.assertExitSuccess`
- Graph `it.live` startLine 166 / export `live` 195; `flakyTest` index 257-260; `internal.layer.fixture-hooks` 235-354

### Detector implementation — complete (audit; not restale partial ranges)

- `packages/tooling/tool/cli/src/commands/Lint/EffectVitest.ts` L1-136
- `internal/EffectVitestDetectors.ts` L1-1433
- `internal/EffectVitestPolicy.ts` complete
- `internal/EffectVitestPrimitives.ts` complete
- `internal/EffectVitestScan.ts` complete
- `internal/EffectVitestStore.ts` complete
- `internal/EffectVitestSyntax.ts` complete
- `Lint.schemas.ts` L660-1481 including `makeEffectVitestFindingKey` L1317-1329. **Unread: L1-659** (schema class preambles before the verified identity/scan-timing slice)

### Detector tests — now complete

- `test/effect-vitest-detectors.test.ts` L1-1546 complete (audit)
- `test/effect-vitest-contract.test.ts` L1-682 complete (audit L1-80; this turn L81-682). Identity, pin, exception inheritance, EV006 polarity hydration
- `test/effect-vitest-primitives.test.ts` L1-506 complete (audit L1-80; this turn L81-506). 100-anchor derivation; EV005 hydration **asserts** `replacement.primitive === utils.assertExitSuccess` while sketch concatenates both Exit helpers (confirms P0F-R3-003; not a new row)
- `test/effect-vitest-store.test.ts` L1-101 complete (audit L1-80; this turn L81-101)

### Charters — now complete

- `ops/prompts/all-seeing-eye.md` L1-88 (audit)
- `ops/prompts/flake-detective.md` L1-85 (audit; P0F-R3-004)
- `ops/prompts/property-tester.md` L1-90 (audit)
- `ops/prompts/resource-authoritarian.md` L1-97 (audit; FileSystem service 470 holds R2-010)
- `ops/prompts/lane-contract.md` L1-94 (audit L1-80; this turn L81-94)

### Runner design/source/tests/fixtures — complete for required current modules

- `src/Vitest.ts` L1-49
- `src/Vitest.errors.ts` L1-130
- `src/internal/VitestRuntime.ts` L1-54
- `src/internal/VitestInstrumentation.ts` L1-467
- `src/test/Vitest.test-kit.ts` L1-46 (this turn; `makeIt` binds watchdog clock only)
- `test/Vitest.test.ts` L1-366
- `test/Vitest.runtime.test.ts` L1-633
- fixture `test/fixtures/vitest-instrumentation/runtime.test.ts.txt` L1-586 (audit L150-249; this turn L1-149 and L250-586). Uses `TestRunner.getCurrentSuite` at L493
- fixture `diagnostic-reporter.ts.txt` L1-32 (this turn)

### ALL 20 samples — complete (audit; do not restale unread DuckDb/Anthropic/quality-tasks/tailscale)

| # | Path | Lines | Rows vs body |
| --- | --- | --- | --- |
| 1 | `packages/drivers/wink/test/Wink.models.test.ts` | 26 | EV001 `runSync`; EV006 Result polarity → assertTrue (R2-006) |
| 2 | `packages/tooling/tool/cli/test/create-package-identity-template.test.ts` | 35 | EV002 inline `provideScopedLayer(NodeServices.layer)` L33 |
| 3 | `packages/foundation/capability/observability/test/OtlpPacketLab.test.ts` | 47 | EV001/EV003/EV011. Unmigrated `runPromise` expected |
| 4 | `apps/professional-desktop/test/tauri-ipc-socket.test.ts` | 157 | EV004 CallExpression `Effect.scoped(...)`; L152 `pipe(Effect.scoped)` **no row** (P0F-R3-001) |
| 5 | `packages/drivers/tika/test/integration/Tika.server.live.test.ts` | 204 | EV005/EV009/EV010. Missing EV002 on `provideLive` (P0F-R3-002). Missing EV004 on interceptor `Effect.scoped` (P0F-R3-001). EV005 primitive `assertExitSuccess` vs `Result.isFailure` (P0F-R3-003) |
| 6 | `packages/foundation/modeling/schema/test/Json.test.ts` | 37 | EV006 `Exit.isFailure` → assertTrue. `Effect.exit` so EV005 correctly absent |
| 7 | `packages/documents/use-cases/test/FilingDecision.test.ts` | 44 | EV006 `O.isNone` → assertNone; EV007; EV001. Getters not EV006 (R2-002) |
| 8 | `packages/drivers/duckdb/test/DuckDb.service.test.ts` | 1254 | EV008 L650 `controlled-clock-wait-review` (R2-001). EV002 CallExpression `provideScopedLayer` present |
| 9 | `packages/ontology/client/test/workbench-state-lifetime.test.ts` | 65 | EV009 live TTL sleep; EV006 `O.some` → assertSome |
| 10 | `packages/tooling/test-kit/test-utils/test/FileSystemConformance.bun.test.ts` | 10 | EV010 BunFileSystem candidate; conformance subject |
| 11 | `packages/tooling/policy-pack/lint-rules/test/rules.test.ts` | 37 | EV001/EV011/EV010. Plain `it` helper so EV002 absent |
| 12 | `packages/agents/server/test/AnthropicTurnKernel.test.ts` | 255 | EV012 unproven-module-mock (R2-007); EV006; EV011; EV014 |
| 13 | `packages/tooling/tool/cli/test/quality-tasks.test.ts` | 6316 | EV013 retry loops; EV010 NodeFileSystem (R2-003); EV002 CallExpression; EV003; EV004 CallExpression `Effect.scoped`. Unmigrated `runPromise` expected |
| 14 | `packages/tooling/policy-pack/repo-configs/test/effect-steering-guidance.test.ts` | 38 | EV014/EV010 |
| 15 | `packages/drivers/tailscale/test/tailscale.test.ts` | 325 | EV015 `TestClock.adjust` judgment (R2-005); EV014 mockSpawnerLayer judgment |
| 16 | `apps/todox/test/app.test.tsx` | 28 | empty rows; no Effect import |
| 17 | `infra/lambda/turbo-cache/test/writer.test.ts` | 60 | empty rows; `bun:test` expected |
| 18 | `packages/foundation/modeling/pandoc-ast/test/Version.test.ts` | 8 | empty rows |
| 19 | `packages/foundation/modeling/html/test/ConformanceLedger.test.ts` | 9 | empty rows; plain-array expect |
| 20 | `apps/labs/api-docs/test/health.test.ts` | 23 | empty rows **and** L22 `pipe(Effect.scoped)` EV004 FN (P0F-R3-001) |

### Pinned rc.113 cited APIs (qualified; not exhaustive pin tree)

- README Resource Safety L280-318 (`:295-297`)
- `packages/vitest/src/index.ts` Methods.live/layer; `export const live` L195
- `internal.ts` `getCurrentSuite` L20; unnamed layer L250-358; `flakyTest` L357
- `utils.ts` L200-278 assertion helpers
- TestClock `adjust` 507-508, `withLive` 580-581
- Layer.mock 2308-2316
- FileSystem exists 143, `makeTempDirectoryScoped` 188, service 470
- Effect `as` 2459, `forkChild` 8533
- Fiber `join` 304
- Installed `@effect/vitest` peer `>=5 <6`; Vitest 4.1.11 `static getCurrentSuite` (`runners.d.ts:52`, chunk L4404)

## Vitest 4.1.11 peer mismatch

Declared peer `>=5.0.0 <6.0.0`. Installed 4.1.11. Graph `readme.installation` gotcha already records the mismatch. Demonstrated supplied runtime: pin binds `V.TestRunner.getCurrentSuite`; 4.1.11 exports that static; unnamed-layer and fixture `each-titles` use it. R2-008 not reopened. Declared-range violation remains explicit, not a missing-API defect on this cohort.

## Closed claims not reopened

R2-001..008, R2-010, R2-012, R1-010 Map identity, unmigrated `runPromise`/`bun:test`/nonempty baseline.

SPEC §6.1 L370-371 and §7 EV015 table still mention `excludeTestServices` as an EV015 remedy while policy prefers `TestClock.adjust`. Historical packet-table residue next to R2-005/R2-011; no new JSONL row. PLAN P0d still shows the rc.112 pin inside the historical phase plan; current D11/graph header is rc.113.

## Findings

Four source-derived rows, unchanged:

1. **P0F-R3-001 major** EV004 misses `pipe(Effect.scoped)` and fnUntraced `Effect.scoped` interceptors.
2. **P0F-R3-002 major** EV002 misses module-scoped curried `provideLive` interceptors.
3. **P0F-R3-003 minor** EV005 always prefers `assertExitSuccess` (confirmed by primitives test L431-451).
4. **P0F-R3-004 minor** flake-detective pin coordinates drift; resource-charter FileSystem:470 still matches.

No fifth row from this continuation.

## Observed remaining gaps (not required current implementation/tests/graph/packet/charters/samples)

- `Lint.schemas.ts` L1-659
- Shared lint command/errors/index (`Lint.command.ts`, `Lint.errors.ts`, `Lint/index.ts`)
- Grounding receipts, SOURCES, p05-platform-boundaries, packet `ops/manifest.json`, census JSON, historical P0a-P0e receipts
- Portable rc112/rc113 graph fixtures under `test/fixtures/effect-vitest-rc11*`
- test-utils `package.json`, `vitest.config.ts`, `src/index.ts`, `Layer.ts`, `Schema.ts` (not the instrumented runner)
- Unmodified pinned Effect/support modules beyond cited API ranges
- Entire remaining 361-input corpus

## Completion status

Required current detector implementation, four focused tests, 100-entry graph, packet D1-D14, five charters, instrumented runner plus regressions/fixtures, and all 20 sample bodies are complete against the audit plus this turn's unread-range fills. Four findings stand. JSONL unchanged. No execution. Root triages P0F-R3-001..004.

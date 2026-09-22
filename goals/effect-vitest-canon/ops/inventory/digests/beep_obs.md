# @beep/obs P1 four-lens digest

Root accepted this package’s source inventory after complete reads, strict row
validation and source/artifact hash checks. Full P1 remains incomplete; P2 is gated.

## Counts


| Lens | Rows | Review items | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 4 | 2 | 2 | 1 | 1 | 2 |
| flake | 4 | 1 | 3 | 1 | 0 | 3 |
| property | 4 | 0 | 4 | 0 | 0 | 4 |
| observability | 4 | 3 | 1 | 0 | 3 | 1 |


Severity: {"minor": 4, "major": 2, "info": 10}. Independent rows: 16. Scanner candidates reviewed separately: 13. No scanner row closes here.

## Files (top ten by row count)

- `packages/drivers/obs/test/Obs.equivalence.test.ts`: 4 rows; complete read 1–32, 1131 census bytes, SHA256 `03055e3e6f7a24f72efa85179a1545ee4bba6ebe4fcaa35df84b76c6150e5101`.
- `packages/drivers/obs/test/Obs.service.test.ts`: 4 rows; complete read 1–315, 12116 census bytes, SHA256 `734e3bfbda52622ea54b99da149578caa4ec71c2d661606b72b6119660cb8417`.
- `packages/drivers/obs/test/ObsProtocol.test.ts`: 4 rows; complete read 1–372, 14033 census bytes, SHA256 `81e5457ee801a5193dc35d60fd5ec13e0953c4dd1bb7b0d2624d483822b8d9eb`.
- `packages/drivers/obs/test/integration/Obs.live.test.ts`: 4 rows; complete read 1–57, 2129 census bytes, SHA256 `f3d4be74977c477db101114c4443415c50d0d0527dd2dc1b86cd718d91de2ae0`.

## Topology and native boundaries

withObs builds a fresh PubSub, calls Ref and Obs.layer for each of eight callbacks. makeService captures the supplied protocol; sharing one mutable stub would change isolation. Protocol tests use per-test Queue/Refs and scoped reader fibers; receive Deferred precedes drop and Fiber.join. Real live probe precedes registration and has no cancellation return.

In-memory socket is already the correct protocol seam, not MemoryFS. The live WebSocket integration is a real optional external OBS subject and must remain so. Never acquire OBS while auditing. Native probe socket cleanup and collection-time bound require separate treatment from body watchdog.

EV002/003 identify withObs rebuild syntax; L-RES-03 adds isolation constraints. EV004 inner handshake scopes close before error inspection; do not blindly delete them. The protocol failure checks preserve operation, close code, status comment/type and authoritative outputPath. Live collection can hang before it.live starts; absence of a reproduced stall is explicit.

## Findings and preservation

File-specific coverage-only explanations remain in the four lens JSONL files.
Review items include constraints on safe migration, not only defects.

- `L-RES-03` `packages/drivers/obs/test/Obs.service.test.ts:42-68` (minor, mutable-fixture-migration-risk): withObs constructs fresh events and calls for every use; handlers close over test-local Refs. Resolve EV002/EV003 with fresh case-local fixture blocks, not one shared mutable protocol for all tests. Preserve handler maps, request histories and subscribe-before-publish semantics.
- `L-RES-02` `packages/drivers/obs/test/integration/Obs.live.test.ts:15-29` (major, unowned-preflight-socket): Effect.callback opens WebSocket but returns no cancellation finalizer. Own probe socket/listeners with acquireRelease or callback cancellation; close on cancellation as well as success while preserving optional live OBS behavior.
- `L-FLAKE-02` `packages/drivers/obs/test/integration/Obs.live.test.ts:15-29` (major, unbounded-registration-probe): Top-level await Effect.runPromise(probeObsWebSocket) has no bounded completion. Use a named bounded live availability probe with owned cancellation before registration, or approved lifecycle setup. Preserve real OBS checks and distinguish unreachable from probe failure; no global timeout increase.
- `L-OBS-01` `packages/drivers/obs/test/Obs.service.test.ts:220-270` (minor, missing-stage-context): startRecording and stopRecording wait for protocol events under upstream it.effect. Adopt accepted instrumented it after fixture ownership repair; retain subscriptions, exact output paths and TestClock, label command/event stage without logging tokens.
- `L-OBS-01` `packages/drivers/obs/test/ObsProtocol.test.ts:153-369` (minor, missing-stage-context): Handshake and request waiting tests use upstream it.effect. Adopt accepted instrumented tester after scope/assertion review; preserve opaque authentication values, last-log redaction and all error payload assertions.
- `L-OBS-01` `packages/drivers/obs/test/integration/Obs.live.test.ts:15-29` (minor, missing-stage-context): Preflight reduces error and close events to false before named registration. Retain bounded preflight outcome/phase metadata without credentials; instrument named live case separately. Do not claim a body watchdog covers collection.

## Timing and hosted limits

Retained Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort: accepted-node-command-baseline; 20 registrations; exit 0; whole-command 3.9703565109998635 seconds. Source/config context is retained in [timing context](../timings/context/baseline/beep_obs.json) and hashed public timing inputs. No rerun or comparison speedup. The reported 20 registrations comprise 19 passed and one skipped live case, so file representation is not external execution proof. Hosted history: 0 mapped observations in 0 jobs; categories {}. Across the frozen 527 failed-run history, 21 logs are unavailable and one downloaded cause unresolved. Zero mapped observations is not absence of failures. No source-head comparison or reproduction establishes a current flake; no flakyTest proposal.

## Proposed P2 sequence and uncertainty

Scope → assertions → property → flake → observability. Preserve every original test, operand, polarity, timeout and native subject; properties retain explicit repository floor/seed, no weaker test schema. Resolve scanner candidates alongside the independent constraints above, then collect authorized package/runtime proofs and comparable timing. This audit performs no tests and grants no exceptions. Source-only hazards are not claimed observed failures. P2 remains gated.

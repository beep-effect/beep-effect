# @beep/graph-3d P1 four-lens digest

Root accepted this package’s source inventory after complete reads, strict row
validation and source/artifact hash checks. Full P1 remains incomplete; P2 is gated.

## Counts


| Lens | Rows | Review items | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 2 | 1 | 1 | 1 | 0 | 1 |
| flake | 2 | 0 | 2 | 0 | 0 | 2 |
| property | 2 | 1 | 1 | 0 | 1 | 1 |
| observability | 2 | 1 | 1 | 0 | 1 | 1 |


Severity: {"major": 1, "minor": 2, "info": 5}. Independent rows: 8. Scanner candidates reviewed separately: 5. No scanner row closes here.

## Files (top ten by row count)

- `packages/drivers/graph-3d/test/Graph3D.equivalence.test.ts`: 4 rows; complete read 1–16, 793 census bytes, SHA256 `6abebab0826a58609aa8d5be8308c3cf412a052ff2af61de778469dd12be5a44`.
- `packages/drivers/graph-3d/test/browser/Graph3D.renderer.test.ts`: 4 rows; complete read 1–140, 4933 census bytes, SHA256 `6706335b9c2e73010f84594de77a529ff9dddcefc979863c5255ecdb51bcd37f`.

## Topology and native boundaries

Equivalence test is pure. Each of five browser cases constructs a container and GPU renderer; the idempotency case deliberately creates/removes multiple instances. Renderer source owns RAF, ResizeObserver, DOM listeners, controls and GPU disposal. Preserve explicit destroy/remount order while adding fallback scope release.

Real browser renderer is the subject. MemoryFS is irrelevant and virtual TestClock does not drive RAF/GPU callbacks. EV009 needs this concrete native boundary judgment, not an automatic live-to-effect conversion.

Node configured cohort runs only the equivalence file; renderer is absent, not skipped. L-PROP-04 retains the negative programmatic select assertion and requests actual user-click positive proof; direct callback invocation would be tautological.

## Findings and preservation

File-specific coverage-only explanations remain in the four lens JSONL files.
Review items include constraints on safe migration, not only defects.

- `L-RES-02` `packages/drivers/graph-3d/test/browser/Graph3D.renderer.test.ts:19-35` (major, browser-failure-cleanup): mountContainer and renderGraph3D precede assertions; destroy/remove run only on success. Acquire the DOM container and each renderer handle with test-scope release; retain explicit destroy/idempotent/remount assertions and real GPU/RAF subject across all five cases.
- `L-PROP-04` `packages/drivers/graph-3d/test/browser/Graph3D.renderer.test.ts:67-85` (minor, missing-positive-interaction-oracle): The user-click case calls handle.select(3) and asserts calls length 0; it dispatches no user click. Keep the programmatic no-callback assertion; add a real browser hit-test interaction and assert callback identity/count. Do not replace click handling with a fake callback invocation.
- `L-OBS-01` `packages/drivers/graph-3d/test/browser/Graph3D.renderer.test.ts:17-138` (minor, missing-stage-context): Five native renderer bodies use upstream it.live without last-phase lifecycle instrumentation. Adopt accepted live tester after finalizer repair and retain browser runtime/RAF subject; label mount/update/destroy phases without changing native timing.

## Timing and hosted limits

Retained Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort: successful-configured-subset-pending-scope-disposition; 1 registrations; exit 0; whole-command 4.672892500000216 seconds. Source/config context is retained in [configured subset receipt](../timings/configured-subsets.json) and hashed public timing inputs. No rerun or comparison speedup. The browser suite is excluded by package config and has no accepted plain-Node baseline. Hosted history: 0 mapped observations in 0 jobs; categories {}. Across the frozen 527 failed-run history, 21 logs are unavailable and one downloaded cause unresolved. Zero mapped observations is not absence of failures. No source-head comparison or reproduction establishes a current flake; no flakyTest proposal.

## Proposed P2 sequence and uncertainty

Scope → assertions → property → flake → observability. Preserve every original test, operand, polarity, timeout and native subject; properties retain explicit repository floor/seed, no weaker test schema. Resolve scanner candidates alongside the independent constraints above, then collect authorized package/runtime proofs and comparable timing. This audit performs no tests and grants no exceptions. Source-only hazards are not claimed observed failures. P2 remains gated.

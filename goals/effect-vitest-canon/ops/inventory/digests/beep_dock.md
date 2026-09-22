# @beep/dock four-lens digest

DockEngineLive is Layer.effect around an Effect.succeed capability whose operations take workspace values (DockEngine.service.ts135-169). It is not a mutable global workspace. Named transition layers are already explicit and the scenario state is local. No container, database, HTTP, native window or filesystem is acquired by these transition tests. GestureParity proves command semantics, not browser gestures or visual geometry integration. Fixtures.ts and pre-M1 serialized support were read fully and must retain their intentional invalid/old shapes.

DockAtoms and DockPolicy session tests bracket makeDockAtoms/makeDockAtomsWith in acquireUseRelease. Graph disposal releases operation/runtime/persistence mounts and registry ownership (Dock.atoms.ts95-168); their state/feed/publication assertions use awaitIdle/getResult, not delay guesses. Geometry has two unclosed raw registries, Recency one. L-RES-02 requires per-case disposal while preserving each reactive assertion; this is missing lifetime ownership, not a measured OS handle leak.

Minima closes its own mounted registry correctly, but four yieldNow iterations do not certify that capture completed. The production atom maps Waiting, Error and Defect all to emptyMinima, while success maps captured widths (Minima.ts199-228). Therefore the empty-failure assertion can pass while still waiting, and nonempty assertions can depend on scheduler progress. Its Pretext fixture is a legal Layer.succeed service backed by canned metrics; missing words are typed fixtureCapture errors (PretextCapture.test-layer.ts110-149). Preserve that deterministic fixture and add a semantic completion/failure witness. L-FLAKE-02 and L-PROP-04 describe the same boundary from different lenses, not two observed flaky runs. No yield-count increase, sleep, timeout or real browser capture is proposed.

DockEngine's rejected-duplicate test compares before with opened.state after assigning before=opened.state. That equality cannot independently prove absence of in-place mutation; retain it and add a stable pre-call snapshot witness. Its literal runs24 and Floating's omitted property options do not use the shared fcRuns floor/seed seam. Retain all current minima/domains/laws and coordinate existing EV007 in P2. Floats, exact basis-point complements, hidden/maximize event order, group zipper preservation, constraints and legacy snapshot controls remain untouched. Allocation cost evidence is source-level only: registries, mounts and local service graphs, not an independently timed setup cost.

| Lens | Rows |
| --- | ---: |
| resource | 14 |
| flake | 14 |
| property | 15 |
| observability | 14 |

Severity: 50 info, 7 minor. 7 review items and 50 coverage-only rows.

Retained baseline: 112 cases, reporter span 4577.809326171875 ms, whole command 4.922280823000165 seconds. Node22.22.3/Bun1.4.2/Vitest4.1.11; no load adjustment. Passing configured runs are not race absence, coverage or full package proof.

## Top ten files by retained reporter duration

- packages/foundation/ui-system/dock/test/DockEngine.test.ts: 256.809326171875 ms, 19 tests.
- packages/foundation/ui-system/dock/test/Floating.test.ts: 37.5986328125 ms, 18 tests.
- packages/foundation/ui-system/dock/test/DockAtoms.test.ts: 25.587158203125 ms, 6 tests.
- packages/foundation/ui-system/dock/test/DockPolicy.test.ts: 18.658935546875 ms, 5 tests.
- packages/foundation/ui-system/dock/test/GestureParity.test.ts: 16.963623046875 ms, 9 tests.
- packages/foundation/ui-system/dock/test/PanelGroupUpdates.test.ts: 16.753173828125 ms, 8 tests.
- packages/foundation/ui-system/dock/test/HiddenMaximize.test.ts: 14.562255859375 ms, 7 tests.
- packages/foundation/ui-system/dock/test/Minima.test.ts: 10.806884765625 ms, 8 tests.
- packages/foundation/ui-system/dock/test/Geometry.test.ts: 9.8984375 ms, 22 tests.
- packages/foundation/ui-system/dock/test/dockview-anchored-box.test.ts: 2.54931640625 ms, 2 tests.

Full reporter file data, runtime/config metadata and hosted mappings are retained in the public timing context and hosted history summary. Support files remain census-covered despite lacking test registration. P2 remains gated; proposed order is scope, assertions, property, flake, observability. Resolve Minima completion once across its coordinated lenses. Preserve all prior assertions, operands, negative fixtures and run minima. Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

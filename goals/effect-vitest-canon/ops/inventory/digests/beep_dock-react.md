# @beep/dock-react four-lens digest

Four DOM suites are explicitly serial and run in the configured DOM harness. setup.dom.ts is fully covered support: controllable ResizeObserver, synthetic pointer IDs and no-op pointer-capture methods do not model real browser capture. Geometry/portal/focus assertions remain valuable adapter tests, not browser QA. No browser or provider ran in this audit.

makeDockAtoms owns registry/runtime/persistence/operation mounts; dispose releases them (Dock.atoms.ts90-169). The four suites place dispose at successful tails, while React cleanup intentionally does not own that graph. Register per-case disposal immediately after acquisition so setup/assertion/DOM-wait failures release it; preserve StrictMode nonownership and existing early unmount/observer assertions. Do not share mutable graphs across cases. These are four affected files for the same lifetime pattern, not four observed leaked processes.

Floating minimum-extent case only expands dimensions. Add a shrink below32 with exact clamped geometry while retaining expansion. Minima uses waitFor geometry and a synchronous estimate; the failure-labeled case alone does not distinguish capture completion from pending fallback. That is retained as an evidence limit rather than a fabricated observed race. Existing awaitIdle and event order must remain; no timeout/yield-count workaround. Source-level setup cost is one graph plus DOM mounts per scenario, unmeasured in isolation.

| Lens | Rows |
| --- | ---: |
| resource | 5 |
| flake | 5 |
| property | 5 |
| observability | 5 |

Severity: 5 minor, 15 info. 5 review items and 15 coverage-only rows.

Retained accepted configured Node baseline: 30 cases, reporter span 5640.06884765625 ms, whole command 6.171183184000256 seconds. Node22.22.3/Bun1.4.2/Vitest4.1.11; no load adjustment. Passing runs are not race absence, coverage, browser QA or full package proof.

## Top ten files by retained reporter duration

- packages/foundation/ui-system/dock-react/test/Floating.test.tsx: 261.06884765625 ms, 8 tests.
- packages/foundation/ui-system/dock-react/test/DockviewReact.test.tsx: 196.85400390625 ms, 8 tests.
- packages/foundation/ui-system/dock-react/test/Gestures.test.tsx: 185.647705078125 ms, 11 tests.
- packages/foundation/ui-system/dock-react/test/Minima.test.tsx: 68.65625 ms, 3 tests.

Hosted history: 0 observations across 0 jobs; categories {}. Zero mappings does not prove no failures; coverage-ratchet observations are not unique flakes or test failures. Exact provenance/config/host context is retained in the public timing context and hosted history summary.

Proposed P2 order: scope, assertions, property, flake, observability. Preserve all assertions, operands, run minima, negative controls and native subjects. P2 remains gated; Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

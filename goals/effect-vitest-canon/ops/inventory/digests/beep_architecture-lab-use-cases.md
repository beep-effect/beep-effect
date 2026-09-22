# @beep/architecture-lab-use-cases four-lens digest

WorkItem and Worker use cases consume per-case repository values; WorkItem owns one mutable entity and Worker a fresh HashMap. Neither factory is an acquired SQL layer. Do not hoist this state across concurrent cases. The production WorkItem create path calls repository.create (WorkItem.service.ts163-168), but the create/list test is preseeded with the same identity/title and its create stub returns without updating state. The existing two assertions do not witness forwarding/persistence in this case. Add an exact call/input witness or a truthful empty-to-created fake while preserving all current operands; no production persistence bug is established.

SchemaParity tests fourteen real public/repository schema families at fcRuns(10) and exact wire/error cases. Its loop discards the known case label and collapses property diagnostics into one generic Passed-tag assertion. Preserve case identity and native failure/replay details when adopting the existing public property registration. Tagged-error equivalence keeps both polarities across thirteen families. Public availability errors are intentionally redacted; the scripted database diagnostic must not become public output. No resource acquisition, external failure, native filesystem subject or measured rebuild cost was found. No MemoryFS replacement is relevant.

| Lens | Rows |
| --- | ---: |
| resource | 4 |
| flake | 4 |
| property | 4 |
| observability | 4 |

Severity: 14 info, 2 minor. 2 review items and 14 coverage-only rows.

Retained accepted Node baseline: 13 cases across 4 test files; reporter span 5593.5 ms; whole command 6.016591555000105 seconds. Every assigned test file is represented. Node22.22.3/Bun1.4.2/Vitest4.1.11. No timing was rerun or accepted by this lane. A pass does not prove absence of races, coverage or full package proof.

## Top ten files by row count

- packages/architecture-lab/use-cases/test/SchemaParity.test.ts: 4 rows; 1 review items.
- packages/architecture-lab/use-cases/test/TaggedError.equivalence.test.ts: 4 rows; 0 review items.
- packages/architecture-lab/use-cases/test/WorkItem.test.ts: 4 rows; 1 review items.
- packages/architecture-lab/use-cases/test/Worker.test.ts: 4 rows; 0 review items.

## Top ten files by retained reporter duration

- packages/architecture-lab/use-cases/test/SchemaParity.test.ts: 14.5 ms; 3 tests.
- packages/architecture-lab/use-cases/test/WorkItem.test.ts: 7.6494140625 ms; 4 tests.
- packages/architecture-lab/use-cases/test/Worker.test.ts: 6.46533203125 ms; 2 tests.
- packages/architecture-lab/use-cases/test/TaggedError.equivalence.test.ts: 2.0869140625 ms; 4 tests.

## Review items

- L-OBS-01 / minor, packages/architecture-lab/use-cases/test/SchemaParity.test.ts:47-68: The loop discards the known schemaParityCases label and reports fourteen schema families through one generic registration and Passed-tag assertion. In P2 retain the label in case identity/diagnostic output and preserve native failure/replay details. Keep all fourteen schemas, equivalence and fcRuns(10); do not weaken domains or convert a generation failure into a pass. Coordinate with existing EV001/EV007 instead of a second runner wrapper.
- L-PROP-04 / minor, packages/architecture-lab/use-cases/test/WorkItem.test.ts:44-56: The fixture is already seeded at lines 11-17; create at 19 merely returns its argument. The same-id/title create followed by list length 1 can pass if the public create path stops calling repository.create (production service.ts163-168). Preserve both assertions and add an exact call/input witness or an initially empty state updated by create, then assert listed identity/content. This is an orchestration-test gap, not proof of a production persistence bug.

Hosted history: 0 mapped observations across 0 jobs, categories {}. Zero mapped observations is not proof of zero historical failures. Global 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Full retained context/config, source-bound report provenance and slowest cases are retained in the public timing context and hosted history summary. Shared config reports forks/isolate, file parallelism and sequence concurrent; fresh mutable fixtures must remain case-local. Durations overlap and do not measure layer rebuild costs.

After separate P2 authorization: Retain case-local mutable repository state, add a real create-forwarding/input witness, and keep all fourteen schema labels and 10-run laws identifiable in property failures. Preserve all original operands, assertions and replay options; no timeout increase or generic MemoryFS replacement is justified.

Root-reviewed P1 inventory; P2 remains gated.

Recovery provenance: original supervisor exit 143 remains preserved. A separate recovery obtained fresh successful validation and outer exit 0; the original result was not relabeled.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

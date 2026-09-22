# @beep/architecture-lab-ui four-lens digest

The sole file exercises WorkItem view-model conversion and codecs without mounting UI or acquiring a browser. Open/archived status, visible actions, assigned wire shape and absent assignee are explicit. Native property checks retain fcRuns(20), full summary/action round trips and acceptance of generated WorkItems. This is not DOM/rendering coverage. Inputs/config are local immutable values; no layer rebuild, native FileSystem, live clock or shared mutable context was observed. Preserve the exact Option-None operand during the existing EV006 migration. No additional human finding or resource-cost claim is justified.

| Lens | Rows |
| --- | ---: |
| resource | 1 |
| flake | 1 |
| property | 1 |
| observability | 1 |

Severity: 4 info. 0 review items and 4 coverage-only rows.

Retained accepted Node baseline: 6 cases across 1 test files; reporter span 6031.590576171875 ms; whole command 6.421059946999776 seconds. Every assigned test file is represented. Node22.22.3/Bun1.4.2/Vitest4.1.11. No timing was rerun or accepted by this lane. A pass does not prove absence of races, coverage or full package proof.

## Top ten files by row count

- packages/architecture-lab/ui/test/WorkItemViewModel.test.ts: 4 rows; 0 review items.

## Top ten files by retained reporter duration

- packages/architecture-lab/ui/test/WorkItemViewModel.test.ts: 13.590576171875 ms; 6 tests.

## Review items

No additional human review items. File-specific no-findings rows qualify the source-only scope; existing scanner candidates remain open.

Hosted history: 0 mapped observations across 0 jobs, categories {}. Zero mapped observations is not proof of zero historical failures. Global 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Full retained context/config, source-bound report provenance and slowest cases are retained in the public timing context and hosted history summary. Shared config reports forks/isolate, file parallelism and sequence concurrent; fresh mutable fixtures must remain case-local. Durations overlap and do not measure layer rebuild costs.

After separate P2 authorization: Preserve pure view-model/codec assertions, the exact absent-assignee operand and fcRuns(20). No mounted UI or browser proof is claimed. Preserve all original operands, assertions and replay options; no timeout increase or generic MemoryFS replacement is justified.

Root-reviewed P1 inventory; P2 remains gated.

Recovery provenance: original supervisor exit 143 remains preserved. A separate recovery obtained fresh successful validation and outer exit 0; the original result was not relabeled.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

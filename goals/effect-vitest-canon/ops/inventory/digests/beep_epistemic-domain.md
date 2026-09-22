# @beep/epistemic-domain four-lens digest

The seven files exercise domain schemas and deterministic identity/seal computations. DateTime values are fixed epochs supplied to evaluation, not wall-clock calls. Network destinations and source locators are modeled strings; verified-anchor receipts are constructed, not fetched, and credential references are never resolved. No provider, graph database, SQL connection or execution permission is acquired. Shared module fixtures are read as values and tests construct changed copies.

Contradiction includes distinct at/over bounds, duplicate evidence, invalid intervals, canonical JSON limits, independent evidence partitions and a valid-seal outsider negative. Preserve all large/deep fixtures and the constructive fcRuns(50) arbitrary. ExecutionAuthority has eight denial axes, seal precedence, chain gaps/cross-run splices, outcome binding and exact golden digest vectors. EvaluationOptions owns deterministic time; do not replace it with live time or reset global clocks. Its schema tests use fcRuns with ten-run minima. EvidenceVerification binds keys to evidence/source/anchor changes, without proving actual source content. LogicalEdgeIdentity pins delimiter escaping, absent markers and relation symmetry.

The usage-append case has one independent gap: the null unitCount input is checked through a zero fallback, which also accepts Some(0). Add an explicit None witness while preserving the original assertion, input and all other fields. Other codec round trips do not independently establish the append function preserves absence. This is not a demonstrated production defect. Schema and hash allocations are local computation; there is no acquired layer rebuild cost to quantify from source alone.

| Lens | Rows |
| --- | ---: |
| resource | 7 |
| flake | 7 |
| property | 7 |
| observability | 7 |

Severity: 27 info, 1 minor. 1 review items and 27 coverage-only rows.

Retained accepted Node command baseline: 82 cases, reporter span 13225.4248046875 ms, whole command 14.841577613000027 seconds. Node22.22.3/Bun1.4.2/Vitest4.1.11; no load adjustment. Passing configured runs are not race absence, coverage or full package proof.

## Top ten files by retained reporter duration

- packages/epistemic/domain/test/Contradiction.test.ts: 274.4248046875 ms, 18 tests.
- packages/epistemic/domain/test/EpistemicDomain.test.ts: 99.45703125 ms, 10 tests.
- packages/epistemic/domain/test/ExecutionAuthority.test.ts: 72.472412109375 ms, 30 tests.
- packages/epistemic/domain/test/EvidenceVerification.test.ts: 41.453369140625 ms, 6 tests.
- packages/epistemic/domain/test/LogicalEdgeIdentity.test.ts: 8.506591796875 ms, 15 tests.
- packages/epistemic/domain/test/EntityMaterialization.test.ts: 4.35791015625 ms, 1 tests.
- packages/epistemic/domain/test/TaggedError.equivalence.test.ts: 3.066650390625 ms, 2 tests.

Hosted mapping: 11 coverage-ratchet observations in 1 job, not unique flakes or test failures. Exact job provenance, runtime/settings, file/test timings and host qualification are retained in the public timing context and hosted history summary. No current failure is reproduced here.

P2 remains gated. Proposed order: scope, assertions, property, flake, observability; retain pure local subjects, all assertions/operands/polarity and current native arbitrary floors. No timeout, dependency or provider change is proposed. Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

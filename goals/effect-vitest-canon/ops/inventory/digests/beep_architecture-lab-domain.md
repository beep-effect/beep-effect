# @beep/architecture-lab-domain four-lens digest

WorkItem aggregate effects have no service requirements. requireMutable returns the typed WorkItemAlreadyArchived error and its actual ID before reopen transition checking (WorkItem.model.ts189-205,334-340). The archived test only checks Failure, so the review asks for a typed error/ID witness while retaining that assertion. This is a test discrimination gap, not an observed incorrect production transition. No assertion or current assignee behavior is proposed for deletion.

The round-trip helper creates one schema arbitrary, encoder, decoder and equivalence per schema, with a literal default ten runs. The shared fcRuns helper is not used at that site, so a configured higher floor or replay seed does not reach this call. Preserve all ten domains, ten-run minimum and equivalence law through eventual property migration. Worker table configuration is Drizzle metadata, not database I/O. WorkPriority and all tagged-error comparisons are local pure values. No reusable resource layer or measured acquisition/rebuild cost exists in these four files; do not add shared mutable state just to introduce it.layer.

| Lens | Rows |
| --- | ---: |
| resource | 4 |
| flake | 4 |
| property | 4 |
| observability | 4 |

Severity: 14 info, 2 minor. 2 review items and 14 coverage-only rows.

Retained accepted Node command baseline: 8 cases, reporter span 7652.38525390625 ms, whole command 8.022865896999974 seconds. Node22.22.3/Bun1.4.2/Vitest4.1.11; no load adjustment. Passing configured runs are not race absence, coverage or full package proof.

## Top ten files by retained reporter duration

- packages/architecture-lab/domain/test/WorkItem.test.ts: 17.38525390625 ms, 4 tests.
- packages/architecture-lab/domain/test/Worker.test.ts: 6.490966796875 ms, 2 tests.
- packages/architecture-lab/domain/test/TaggedError.equivalence.test.ts: 1.390869140625 ms, 1 tests.
- packages/architecture-lab/domain/test/WorkPriority.test.ts: 0.8984375 ms, 1 tests.

Hosted mapping: 11 coverage-ratchet observations in 1 job, not unique flakes or test failures. Exact job provenance, runtime/settings, file/test timings and host qualification are retained in the public timing context and hosted history summary. No current failure is reproduced here.

P2 remains gated. Proposed order: scope, assertions, property, flake, observability; retain pure local subjects, all assertions/operands/polarity and current native arbitrary floors. No timeout, dependency or provider change is proposed. Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

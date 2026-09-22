# @beep/ontology — four-lens source audit

4 census files read completely; 16 rows, 2 review items, 14 coverage-only rows. Root-reviewed P1 inventory; P2 remains gated.

## Counts

- resource: 4 rows.
- flake: 4 rows.
- property: 4 rows.
- observability: 4 rows.

Severity: 14 info, 1 minor, 1 major.

## Top files

- `packages/foundation/modeling/ontology/test/Fold.test.ts`: 4 rows.
- `packages/foundation/modeling/ontology/test/Ontology.models.test.ts`: 4 rows.
- `packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts`: 4 rows.
- `packages/foundation/modeling/ontology/test/TaggedError.equivalence.test.ts`: 4 rows.

## Topology, boundaries and uncertainty

Fold and model tests assemble local schema annotations, facts and DTOs. TaxonomyLoader.layer is Layer.succeed and obtains FileSystem at load execution, so the pure block itself has no vendor acquisition. Most semantic-foundation cases supply canned readFileString and realPath methods; three cases use scoped native temporary directories. The symlink escape case proves host realPath confinement and should remain native. The mocked Windows path does not prove Windows execution. Keep exact failure paths, both temporary root lifetimes and positive alignment controls. No remote taxonomy load occurs. The generated FilingSegment law omits floor-bearing options; all separate traversal assertions remain intact.

## Review items

- **L-RES-04 native-path-confinement-boundary** at `packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts:420-531`: Scoped real directories and a symlink test vendor-root escape; missing-root and missing-slice cases inspect native failures. Preserve the real symlink/realPath confinement test as a native filesystem subject. Keep both temporary roots scoped and all exact error paths. Other mocked readFileString/realPath cases are pure subject fixtures. A blanket MemoryFileSystem substitution would cease proving host symlink behavior; EV010 is not independent authorization to do so.
- **L-PROP-03 filing-segment-floor-seed-loss** at `packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts:588-602`: The FilingSegment native checkEffect supplies no options and nests runSync inside Effect.sync. Adopt the unchanged generated segment round-trip and guard assertions with fcRuns() options, preserving default trials and repository seed/floor. Keep the separate traversal-input rejection, every operand and native scope case. EV001/EV007 own wrapper syntax; this row records the otherwise lost environment-driven run contract.

## Retained timing and history

The configured Node baseline has 70 passed registrations across 4 files, reporter duration 4989.217 ms and whole command 5.315566 s. Source head: 662823dd960367046ba7d73dd8fd25d15782865a. Node22.22.3/Bun1.4.2/Vitest4.1.11; these are retained receipts, not new runs or package/coverage proof.

Hosted history maps 6 coverage-ratchet observations in 2 jobs. These are production coverage metrics, not failed test identities or unique flakes. No historical/current source comparison was performed. Zero observations does not prove no failures.

- [Hosted job](https://github.com/beep-effect/beep-effect/actions/runs/31986265095/job/95265008664), head `d07d6addbe90b5243135e3ba02c9a864dd20c8a6`, 2026-08-17T01:52:59Z.

- [Hosted job](https://github.com/beep-effect/beep-effect/actions/runs/33083659254/job/98557333046), head `608c024293a9d3565aeccb6e84e87b110701da77`, 2026-08-27T14:41:46Z.

## Proposed P2 order

After separate authorization: scope and preserve native/cache boundaries; migrate assertions without changing polarity or operands; retain property floors and add the identified discriminating oracles; review flake evidence without adding retry/skip; then preserve names and improve schema-failure context while adopting instrumentation. No source change is authorized by these recommendations. All scanner rows remain open candidates.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

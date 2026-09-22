# @beep/nlp-processing — four-lens source audit

9 census files read completely; 37 rows, 5 review items, 32 coverage-only rows. Root-reviewed P1 inventory; P2 remains gated.

## Counts

- resource: 9 rows.
- flake: 9 rows.
- property: 10 rows.
- observability: 9 rows.

Severity: 32 info, 4 minor, 1 major.

## Top files

- `packages/foundation/capability/nlp-processing/test/Graph/GraphOperations.test.ts`: 5 rows.
- `packages/foundation/capability/nlp-processing/test/Backend/Composition.test.ts`: 4 rows.
- `packages/foundation/capability/nlp-processing/test/Backend/NLPBackend.test.ts`: 4 rows.
- `packages/foundation/capability/nlp-processing/test/Graph/AnnotatedTextGraph.test.ts`: 4 rows.
- `packages/foundation/capability/nlp-processing/test/Graph/EffectGraph.test.ts`: 4 rows.
- `packages/foundation/capability/nlp-processing/test/Graph/TextGraph.test.ts`: 4 rows.
- `packages/foundation/capability/nlp-processing/test/Graph/TypeClass.test.ts`: 4 rows.
- `packages/foundation/capability/nlp-processing/test/TaggedError.equivalence.test.ts`: 4 rows.
- `packages/foundation/capability/nlp-processing/test/Tools/Schemas.test.ts`: 4 rows.

## Topology, boundaries and uncertainty

Backend stubs and annotated graphs stay local; schema tool imports do not execute provider tools. ResultStoreTest aliases an effectful Ref<HashMap> layer and GraphExecutorTest merges it with GraphExecutorLive. Cache state is per layer instance. Preserve independent test cache state when addressing mechanical per-test rebuilds; sharing all cases can change size/hit assertions. Most round-trip helpers retain fcRuns(50), while three metrics laws omit floor-bearing options. The finite normalized metric generator is narrower than unrestricted numeric durations; no full production-domain law or numeric defect was executed or established here. Cost scaling and alt identity have concrete local oracle gaps. One aggregate schema helper obscures which of thirteen schemas failed. No acquisition-time measurement or predicted speedup is available.

## Review items

- **L-RES-03 cache-isolation-preservation** at `packages/foundation/capability/nlp-processing/test/Graph/GraphOperations.test.ts:211-305`: ResultStore stats require size=1 and totalHits=1; executor expects a first miss followed by a hit. EV002 owns the per-test layer syntax. Preserve independent cache instances or explicit scoped reset when adopting block layers: ResultStoreTest aliases Layer.effect with a fresh Ref<HashMap>. Sharing all cases without isolation can contaminate stats and cache state. Keep all cache-hit/miss operands and cleanup behavior; do not claim measured rebuild savings.
- **L-PROP-03 monoid-floor-seed-loss** at `packages/foundation/capability/nlp-processing/test/Graph/GraphOperations.test.ts:58-92`: Three ExecutionMetrics checkEffect calls omit options while the adjacent round-trip helper uses fcRuns(50). Carry all three laws and the existing normalized generator into native property registration with floor-bearing fcRuns() options, preserving at least the default count and configured seed/floor. Do not reduce or remove any existing fcRuns(50) round-trip. The semantic floor omission is additional to EV007 syntax.
- **L-PROP-04 singleton-cost-oracle** at `packages/foundation/capability/nlp-processing/test/Graph/GraphOperations.test.ts:318-325`: The test named estimateCost scales by number of leaf nodes uses one leaf and asserts only complexity O(1). Keep the singleton and exact O(1) assertion. Add a second valid graph with multiple leaves and assert the expected numeric time/token cost relation using the operation cost contract. A constant estimate with the same complexity label satisfies the current oracle. This is a source-derived weakness, not an executed production bug.
- **L-PROP-04 alt-identity-not-exercised** at `packages/foundation/capability/nlp-processing/test/Graph/TypeClass.test.ts:125-132`: The test named empty is the identity for alt only applies empty and checks length zero. Retain the zero-result assertion. Exercise alt(empty, nonempty) and alt(nonempty, empty) and compare their payloads with the nonempty operation. Current assertions never invoke alt in this identity case, so a broken combination law can pass. Preserve fresh node identity semantics by comparing observable data, not incidental generated IDs.
- **L-OBS-01 aggregate-schema-failure-context** at `packages/foundation/capability/nlp-processing/test/Tools/Schemas.test.ts:34-90`: Each of two tests calls one round-trip helper for thirteen schemas, sharing a boolean assertion location. Retain every schema, equality operand and fcRuns(50) minimum. Give each schema an explicit diagnostic label or public named parameterized registration so a failing generated round-trip identifies the schema without reconstructing the aggregate call sequence. Do not replace failures with logging or swallow defects.

## Retained timing and history

The configured Node baseline has 84 passed registrations across 9 files, reporter duration 5256.039 ms and whole command 5.615981 s. Source head: 662823dd960367046ba7d73dd8fd25d15782865a. Node22.22.3/Bun1.4.2/Vitest4.1.11; these are retained receipts, not new runs or package/coverage proof.

Hosted history maps 1 coverage-ratchet observations in 1 jobs. These are production coverage metrics, not failed test identities or unique flakes. No historical/current source comparison was performed. Zero observations does not prove no failures.

- [Hosted job](https://github.com/beep-effect/beep-effect/actions/runs/31986265095/job/95265008664), head `d07d6addbe90b5243135e3ba02c9a864dd20c8a6`, 2026-08-17T01:52:59Z.

## Proposed P2 order

After separate authorization: scope and preserve native/cache boundaries; migrate assertions without changing polarity or operands; retain property floors and add the identified discriminating oracles; review flake evidence without adding retry/skip; then preserve names and improve schema-failure context while adopting instrumentation. No source change is authorized by these recommendations. All scanner rows remain open candidates.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

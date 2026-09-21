# @beep/semantic-web — four-lens source audit

4 census files read completely; 16 rows, 1 review items, 15 coverage-only rows. Root-reviewed P1 inventory; P2 remains gated.

## Counts

- resource: 4 rows.
- flake: 4 rows.
- property: 4 rows.
- observability: 4 rows.

Severity: 15 info, 1 major.

## Top files

- `packages/foundation/capability/semantic-web/test/IdentityRdfBinding.test.ts`: 4 rows.
- `packages/foundation/capability/semantic-web/test/IdentityRdfBindingCoverage.test.ts`: 4 rows.
- `packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts`: 4 rows.
- `packages/foundation/capability/semantic-web/test/TaggedError.equivalence.test.ts`: 4 rows.

## Topology, boundaries and uncertainty

Dataset registry fixtures use Layer.unwrap to decode local RDF once and delegate to IdentityRegistry.layerLocal. Mechanical wrapper/layer migration is already recorded; do not replace datasets with a remote store. ServicesAndSurface uses one shared canonicalization/unsupported-SPARQL layer, tests real local canonicalization with distinct blank-node labels and compares fingerprint text. SHACL requests elsewhere are captured by a local stub, not validated by a real engine. No native filesystem or MemoryFileSystem is needed for those subjects. Three identity properties use literal 40-run options; retain later fcRuns(50), dataset fcRuns(5), sample seed and all fixed error controls. No measured layer-construction savings are claimed.

## Review items

- **L-PROP-03 identity-floor-seed-loss** at `packages/foundation/capability/semantic-web/test/IdentityRdfBinding.test.ts:136-200`: Two checkEffect calls and the EntrySeed it.effect.prop use literal runs:40. Use fcRuns(40) for each of the three properties, preserving the pairwise-distinct predicates, unique required fibers and exact generated entry round-trip. Retain the later fcRuns(50) generation-link check unchanged. Literal options bypass the repository floor and seed even where registration already uses it.effect.prop.

## Retained timing and history

The configured Node baseline has 31 passed registrations across 4 files, reporter duration 3918.771 ms and whole command 4.271093 s. Source head: 662823dd960367046ba7d73dd8fd25d15782865a. Node22.22.3/Bun1.4.2/Vitest4.1.11; these are retained receipts, not new runs or package/coverage proof.

Hosted history maps 7 coverage-ratchet observations in 2 jobs. These are production coverage metrics, not failed test identities or unique flakes. No historical/current source comparison was performed. Zero observations does not prove no failures.

- [Hosted job](https://github.com/beep-effect/beep-effect/actions/runs/32909952650/job/98002083531), head `02b47acfa991b2c6b321735474bac22c614b28e5`, 2026-08-25T23:15:31Z.

- [Hosted job](https://github.com/beep-effect/beep-effect/actions/runs/34438997453/job/102749878919), head `bb078d815af12a29f48ef76c83837c8719f59c25`, 2026-09-10T04:54:36Z.

## Proposed P2 order

After separate authorization: scope and preserve native/cache boundaries; migrate assertions without changing polarity or operands; retain property floors and add the identified discriminating oracles; review flake evidence without adding retry/skip; then preserve names and improve schema-failure context while adopting instrumentation. No source change is authorized by these recommendations. All scanner rows remain open candidates.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

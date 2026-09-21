# @beep/n3 — four-lens source audit

2 census files read completely; 8 rows, 0 review items, 8 coverage-only rows. Root-reviewed P1 inventory; P2 remains gated.

## Counts

- resource: 2 rows.
- flake: 2 rows.
- property: 2 rows.
- observability: 2 rows.

Severity: 8 info.

## Top files

- `packages/drivers/n3/test/N3.equivalence.test.ts`: 4 rows.
- `packages/drivers/n3/test/N3TurtleCodec.test.ts`: 4 rows.

## Topology, boundaries and uncertainty

N3TurtleCodecLive is a pure Layer.succeed service table; its local wrapper rebuild is already a scanner candidate, but no allocating layer cost is established. Parser/writer operations remain the actual native N3 library subject, with no disk or provider acquisition in the tests. The Writer.prototype spy is restored with ensuring. This audit does not prove safety under a future concurrent configuration; retain restoration and do not broaden overlap around global prototype mutation. The selected Turtle substrings are finite smoke assertions, not complete RDF round-trip equivalence or graph-isomorphism proof. No new independent defect is asserted on that basis.

## Review items

No additional judgment findings beyond the open mechanical candidates. The four file-specific lens explanations remain in JSONL.

## Retained timing and history

The configured Node baseline has 6 passed registrations across 2 files, reporter duration 3546.875 ms and whole command 3.920523 s. Source head: 662823dd960367046ba7d73dd8fd25d15782865a. Node22.22.3/Bun1.4.2/Vitest4.1.11; these are retained receipts, not new runs or package/coverage proof.

Hosted history maps 0 coverage-ratchet observations in 0 jobs. These are production coverage metrics, not failed test identities or unique flakes. No historical/current source comparison was performed. Zero observations does not prove no failures.

## Proposed P2 order

After separate authorization: scope and preserve native/cache boundaries; migrate assertions without changing polarity or operands; retain property floors and add the identified discriminating oracles; review flake evidence without adding retry/skip; then preserve names and improve schema-failure context while adopting instrumentation. No source change is authorized by these recommendations. All scanner rows remain open candidates.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

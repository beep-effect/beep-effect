# @beep/rdf-canonize — four-lens audit

1 files; 4 rows; 1 minor review items; 3 coverage-only rows. All rows are open P1 judgments; P2 remains gated.

## Topology and evidence

The security suite intentionally serializes one hoisted vendor mock and resets it after each case. Keep that isolation when migrating wrappers; mock call counts and one-shot rejections must not cross registrations. The resource-control case delegates the mock to the actual vendor canonicalizer. Other cases inject explicit iteration/abort/TimeoutError rejections to test error mapping, not actual elapsed deadlines. Production supplies maxWorkFactor and native AbortSignal.timeout to the semantic algorithm. The lexical algorithm and result wire shape are separate assertions. These are local CPU/vendor operations, not remote services or MemoryFileSystem subjects.

Two generated round-trip laws use fcRuns(5) and 30000ms limits. Their post-generation slice caps observed quad collections but not the preceding generator cost; preserve floors, timeouts and valid richer boundary coverage. No timeout or budget bug was executed here. A call-is-defined assertion precedes the optional call branch, so that branch is not a missing-call false pass. Nested runPromise/orDie wrappers are mechanical migration candidates; preserve Promise rejection reasons and do not silently turn typed failure into success. No quantitative rebuild savings are claimed.

## Findings

- **L-PROP-05 post-generation-size-bound**, `packages/drivers/rdf-canonize/test/CanonicalizationSecurity.test.ts:174-231`: Both properties slice generated dataset quads to three only after Arbitrary.schema generated the full object. Preserve fcRuns(5), both 30000ms test limits, schema validity and exact round-trip assertions. If bounding generation is intended, constrain the generator before allocation through supported schema/arbitrary size annotations; post-generation truncation does not cap generation cost and narrows the observed collection sizes. Retain richer valid boundary evidence rather than lowering runs. No actual timeout is inferred.

## Retained timing/history

Node22.22.3, Bun1.4.2, Vitest4.1.11 at frozen head 662823dd960367046ba7d73dd8fd25d15782865a: 7 passed registrations; reporter 12400.664551ms; whole command 13.947837s. Full executable-file representation is retained, not compiler, coverage or package acceptance. No timing rerun or adjustment occurred.

0 mapped historical observations across 0 jobs. Zero mapped observations does not mean no historical failures. Historical evidence is retained in the [hosted history summary](../hosted-history-summary.json). No historical/current source comparison or causal disposition was performed.

## Top files

- `packages/drivers/rdf-canonize/test/CanonicalizationSecurity.test.ts`: 4 rows, 1 review items.

## P2 order and uncertainty

Only after explicit authorization: Preserve the serial hoisted mock, actual vendor delegation, typed rejection mapping, both 30000ms limits and fcRuns(5). If bounding generation cost, constrain generation before allocation while retaining richer valid round-trip evidence. Preserve original operands, assertions, seeds and run floors. No retries, timeout increases or numerical speedup claim is justified.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

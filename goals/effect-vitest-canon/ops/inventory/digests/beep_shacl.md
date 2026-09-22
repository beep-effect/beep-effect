# @beep/shacl — four-lens audit

3 files; 12 rows; 1 minor review items; 11 coverage-only rows. All rows are open P1 judgments; P2 remains gated.

## Topology and evidence

The service layer is Layer.succeed; validator and RDFJS shape/data instances are created per validation. Sharing the outer layer does not eliminate those per-call allocations. The tests exercise the actual local shacl-engine with one violating and one conforming graph. Both retain exact conforms/truncated flags, nonempty/empty results, focusNode and path assertions. No remote SHACL endpoint, database or host filesystem is used, so MemoryFileSystem is not a substitute for this engine subject. The separate lazy-import assertion proves a defined export, not the absence of vendor construction; a first-use positive control would make the negative observation meaningful. No current eager construction defect is established.

## Findings

- **L-OBS-03 lazy-construction-unobserved**, `packages/drivers/shacl/test/ShaclLazyImport.test.ts:5-11`: The lazy-import case asserts only that the exported live layer is defined. Preserve the real import and defined-value assertion. Add an isolated module/constructor observation through an approved dependency seam to prove no construction during import, with a first-use positive control. A module that eagerly constructs then exports a layer passes this assertion. This is not an observed eager import defect or a reason to alter production loading.

## Retained timing/history

Node22.22.3, Bun1.4.2, Vitest4.1.11 at frozen head 662823dd960367046ba7d73dd8fd25d15782865a: 4 passed registrations; reporter 5836.948730ms; whole command 6.209758s. Full executable-file representation is retained, not compiler, coverage or package acceptance. No timing rerun or adjustment occurred.

0 mapped historical observations across 0 jobs. Zero mapped observations does not mean no historical failures. Historical evidence is retained in the [hosted history summary](../hosted-history-summary.json). No historical/current source comparison or causal disposition was performed.

## Top files

- `packages/drivers/shacl/test/Shacl.equivalence.test.ts`: 4 rows, 0 review items.
- `packages/drivers/shacl/test/ShaclEngineValidation.test.ts`: 4 rows, 0 review items.
- `packages/drivers/shacl/test/ShaclLazyImport.test.ts`: 4 rows, 1 review items.

## P2 order and uncertainty

Only after explicit authorization: Preserve actual shacl-engine conforming/violating graph assertions. Add an isolated construction observation and first-use positive control for the lazy-import claim without inferring an existing eager-load defect. Preserve original operands, assertions, seeds and run floors. No retries, timeout increases or numerical speedup claim is justified.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

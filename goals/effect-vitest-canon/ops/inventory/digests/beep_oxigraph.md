# @beep/oxigraph — four-lens audit

2 files; 8 rows; 2 minor review items; 6 coverage-only rows. All rows are open P1 judgments; P2 remains gated.

## Topology and evidence

The equivalence test is pure. OxigraphLazyImport builds one live layer for two queries over the same dataset. Production allocates a MutableHashMap at layer acquisition, imports WASM on first query and retains the most recent store; it clears the map when populating a new dataset. This is a real local WASM/query subject, not a remote database or filesystem fixture. Preserve same-acquisition reuse and do not replace it with MemoryFileSystem. Equal outputs and a defined layer are insufficient proof of cache reuse or absence of eager construction; they remain useful functional assertions. The conditional SELECT payload check follows a fail-fast profile assertion and is not vacuous. Store construction/population may cost work, but this audit has no isolated construction timing or evidence of a store-disposal leak.

## Findings

- **L-PROP-04 cache-reuse-unobserved**, `packages/drivers/oxigraph/test/OxigraphLazyImport.test.ts:20-44`: The reuse case asserts equal SELECT results and one row; rebuilding the store on both queries still passes. Keep both real queries, profile assertion and row count. Add an authorized public adapter/constructor observation showing one store population for repeated input and a distinct dataset control. Do not infer cache identity from value equality, expose private maps or replace the real WASM query subject. The current production cache exists; this finding concerns its proof.
- **L-OBS-03 lazy-construction-unobserved**, `packages/drivers/oxigraph/test/OxigraphLazyImport.test.ts:13-18`: The lazy-import case asserts only that the exported live layer is defined. Preserve the real import and defined-value assertion. Add an isolated module/constructor observation through an approved dependency seam to prove no construction during import, with a first-use positive control. A module that eagerly constructs then exports a layer passes this assertion. This is not an observed eager import defect or a reason to alter production loading.

## Retained timing/history

Node22.22.3, Bun1.4.2, Vitest4.1.11 at frozen head 662823dd960367046ba7d73dd8fd25d15782865a: 3 passed registrations; reporter 16694.608398ms; whole command 18.435542s. Full executable-file representation is retained, not compiler, coverage or package acceptance. No timing rerun or adjustment occurred.

0 mapped historical observations across 0 jobs. Zero mapped observations does not mean no historical failures. Historical evidence is retained in the [hosted history summary](../hosted-history-summary.json). No historical/current source comparison or causal disposition was performed.

## Top files

- `packages/drivers/oxigraph/test/Oxigraph.equivalence.test.ts`: 4 rows, 0 review items.
- `packages/drivers/oxigraph/test/OxigraphLazyImport.test.ts`: 4 rows, 2 review items.

## P2 order and uncertainty

Only after explicit authorization: Preserve the real WASM/query subject and same-acquisition cache behavior. Retain functional query assertions while adding a supported constructor/population observation, a distinct-dataset control, and an isolated import observation with first-use positive control. Preserve original operands, assertions, seeds and run floors. No retries, timeout increases or numerical speedup claim is justified.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

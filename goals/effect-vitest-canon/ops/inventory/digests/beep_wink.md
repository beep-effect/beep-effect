# @beep/wink — four-lens audit

11 files; 44 rows; 6 minor review items; 38 coverage-only rows. All rows are open P1 judgments; P2 remains gated.

## Topology and evidence

The eleven files cover real model-backed backend/tokenization/facade/toolkit behavior, graph operations and pure model/error boundaries. Per-test scoped wrappers rebuild the engine in many read-only cases. TextGraph tokenization and WinkTokenization document assembly additionally build independent engines multiple times inside a single test; these are useful consolidation candidates already represented mechanically. The combined Layers case deliberately checks public bundle wiring and must still acquire that bundle.

Wink.service.ts initializes a model and state/counter Refs per acquisition. Its custom-entity learner mutates currentState.nlp and then updates the Ref; read-only outer sharing must not absorb independent learning/error scenarios blindly. Instance IDs include a counter, so the changed-ID assertion does not depend on wall-clock milliseconds advancing. Keep engine/ref identity and update assertions, invalid-pattern Cause text, missing-corpus structured failures and actual local model behavior. No external NLP provider or host filesystem fixture is acquired; MemoryFileSystem is not relevant.

The entity loops can pass with an empty array. The catalog metadata check accepts any Some operation value. Token graph idempotence compares count only, allowing same-count payload/edge changes. These are concrete oracle limitations, not inferred vendor failures. Tool properties retain fcRuns(25); the model sample has a distinct fixed 32-count/0x5eed smoke contract that should remain alongside a floor-bearing property. All similarity range checks, exact encoded models, token offsets, sentence text and expected unsupported operations remain intact. Current source contains observability wrappers, but this audit does not invent a logging defect without a promised missing log assertion.

## Findings

- **L-PROP-04 empty-entity-loop**, `packages/drivers/wink/test/Backend/WinkBackend.test.ts:62-72`: The fixed temporal-input case loops over entities without first requiring any entity. Preserve every entity type/span assertion and the real installed Wink model. Establish an expected temporal-entity positive control for this exact fixture, then require a nonempty result before the loop. An adapter returning [] currently satisfies all these assertions. Confirm exact vendor entity expectations before adding a more specific value oracle; do not substitute a fake backend.
- **L-PROP-04 empty-entity-loop**, `packages/drivers/wink/test/NLPService.test.ts:39-46`: The fixed temporal-input case loops over entities without first requiring any entity. Preserve every entity type/span assertion and the real installed Wink model. Establish an expected temporal-entity positive control for this exact fixture, then require a nonempty result before the loop. An adapter returning [] currently satisfies all these assertions. Confirm exact vendor entity expectations before adding a more specific value oracle; do not substitute a fake backend.
- **L-OBS-03 operation-value-unobserved**, `packages/drivers/wink/test/Graph/GraphOperationsCatalog.test.ts:59-66`: The case named records its operation name asserts only metadata.operation._tag === Some. Keep the Some assertion and actual Catalog.tokenize call. Also assert the recorded value is the expected tokenize operation name; a wrong present name currently passes. Do not claim every catalog operation is covered by this one case.
- **L-PROP-04 count-only-idempotence**, `packages/drivers/wink/test/Graph/TextGraph.test.ts:62-71`: The second tokenizeNodes call is compared only by token count. Retain nonempty and equal-count assertions. Compare stable token payloads and graph relationships across the second application using the public graph representation. Same-count replacement or corruption passes the current oracle. Account for intentionally volatile metadata rather than requiring arbitrary object identity.
- **L-PROP-03 finite-sample-not-floor-bearing**, `packages/drivers/wink/test/Wink.models.test.ts:20-24`: The arbitrary validity smoke check samples 32 values with seed 0x5eed and uses every. Preserve the 32-value fixed-seed smoke control, schema alias and explicit positive/negative examples. Add a floor-bearing property registration for the same validity law using fcRuns, retaining CI seed/run behavior and shrinking. A finite sample is useful replay evidence but not a replacement for the normal property lane.
- **L-RES-03 mutable-engine-sharing-constraint**, `packages/drivers/wink/test/WinkEngineRef.test.ts:51-68`: learnCustomEntities mutates the live model and shared state ref inside this test-specific layer. During EV002/EV003 scope migration, keep mutable learning scenarios in independent engine acquisitions or restore exact state through a proven public lifecycle. Read-only cases may share a separate layer. Production Wink.service.ts247-266 mutates currentState.nlp before updating the Ref; merely sharing the same layer across all cases would change isolation. No current cross-test race is claimed.

## Retained timing/history

Node22.22.3, Bun1.4.2, Vitest4.1.11 at frozen head 662823dd960367046ba7d73dd8fd25d15782865a: 47 passed registrations; reporter 7002.062256ms; whole command 7.369370s. Full executable-file representation is retained, not compiler, coverage or package acceptance. No timing rerun or adjustment occurred.

7 mapped historical observations across 1 jobs. Wink observations are seven production coverage metrics from one job, not seven test failures or flakes. Historical evidence is retained in the [hosted history summary](../hosted-history-summary.json). No historical/current source comparison or causal disposition was performed.
- https://github.com/beep-effect/beep-effect/actions/runs/32719153529/job/97406665477, head `87d3479f21f440c32582ce2e67093bdad4fb9569`, 2026-08-24T10:54:45Z.

## Top files

- `packages/drivers/wink/test/Backend/WinkBackend.test.ts`: 4 rows, 1 review items.
- `packages/drivers/wink/test/Graph/GraphOperationsCatalog.test.ts`: 4 rows, 1 review items.
- `packages/drivers/wink/test/Graph/TextGraph.test.ts`: 4 rows, 1 review items.
- `packages/drivers/wink/test/Layers.test.ts`: 4 rows, 0 review items.
- `packages/drivers/wink/test/NLPService.test.ts`: 4 rows, 1 review items.
- `packages/drivers/wink/test/ParityTools.test.ts`: 4 rows, 0 review items.
- `packages/drivers/wink/test/ToolValidation.test.ts`: 4 rows, 0 review items.
- `packages/drivers/wink/test/Wink.equivalence.test.ts`: 4 rows, 0 review items.
- `packages/drivers/wink/test/Wink.models.test.ts`: 4 rows, 1 review items.
- `packages/drivers/wink/test/WinkEngineRef.test.ts`: 4 rows, 1 review items.

## P2 order and uncertainty

Only after explicit authorization: Keep mutable learning scenarios isolated from shared read-only engines. Establish model-specific entity positive controls, strengthen stable graph payload/relationship and operation-name witnesses, and retain the fixed 32-value/0x5eed smoke test alongside a floor-bearing property. Preserve original operands, assertions, seeds and run floors. No retries, timeout increases or numerical speedup claim is justified.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

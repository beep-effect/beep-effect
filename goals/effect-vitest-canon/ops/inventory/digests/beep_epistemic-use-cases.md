# @beep/epistemic-use-cases — four-lens audit

7 files; 28 rows; 1 review items; 27 coverage-only rows. Severity: 27 info, 1 minor. All rows are open P1 judgments; P2 remains gated.

## Topology and evidence

The seven files separate pure command/RPC/error schemas from two small in-process service tests. ClaimDisposition uses one it.layer containing a Ref-backed repository. Its record operation uses atomic Ref.update and listByClaim filters by distinct IDs, so the two current tests do not depend on a shared total or execution order. The resolver reads DateTime.now for rejection metadata, but tests do not race that timestamp against a live clock. The word durable describes the port contract; an in-memory append is not database durability proof. Keep this limitation and the exact persisted rejection assertions.

EpistemicUseCases supplies a pure SHACL stub once with it.layer. It admits when the projected dataset has more than one quad and rejects otherwise; this is explicitly a use-case port test, not real SHACL conformance. The comment points to server integration outside this audit. Preserve separate admitted/rejected controls, illegal transition fields and fixed projection results. No server-side integration was run or claimed reviewed. The rejected payload guard is preceded by a fail-fast verdict assertion, so it cannot silently avoid all failure checks.

The RPC tests inspect descriptors and narrow schema fields, not authentication or HTTP transport. Their exact four-request map is valuable but does not substantiate the authenticated wording; the open observation item requires linkage to the actual server boundary before claiming that guarantee. No exposed endpoint or missing production auth is inferred. Four source-page properties retain fcRuns(25), command/as-of/projection laws retain fcRuns(50), and the one seed520 sample is boundary setup alongside a normal property rather than a floor replacement.

Edge write commands deliberately use correlated organization fixtures; generating independent org values and filtering would be an unsuitable replacement. Both epoch axes, issue paths, bounded vocabulary, seal structures, client-safe error shape and opaque-cause exclusion remain. ExecutionLedger resolves a pure supplied service and checks error domains; it does not perform appends or persistence. There are no native process/HTTP/SQL subjects acquired by these assigned tests, no plausible MemoryFileSystem candidate and no measured layer-rebuild savings.

## Findings

- **L-OBS-03 authentication-not-observed**, `packages/epistemic/use-cases/test/ContradictionTriage.rpc.test.ts:60-66`: The authenticated-RPC case compares only the request map to the same four exported descriptors. Retain the exact four-request map and every payload/schema assertion. Link or add a separately authorized observation of the actual authenticated server boundary, including an unauthenticated negative control and authenticated positive control. The pure RpcGroup.make descriptors do not execute authentication here. Do not infer an exposed endpoint or absent server auth from this unit test; no provider/session operation is authorized by this audit.

## Retained timing/history

Node22.22.3, Bun1.4.2, Vitest4.1.11 at frozen head 662823dd960367046ba7d73dd8fd25d15782865a: 43 passed registrations; reporter 4538.377441ms; whole command 4.872736s. Full executable-file representation is retained, not compiler, coverage or package acceptance. No timing rerun or adjustment occurred.

8 mapped historical observations across 2 jobs. The use-cases observations are eight package-level coverage metrics across two jobs, not eight tests or unique flakes. Historical evidence is retained in the [hosted history summary](../hosted-history-summary.json). No historical/current source comparison or causal classification was performed.
- https://github.com/beep-effect/beep-effect/actions/runs/31732343285/job/94555577088, head `dacc0adc9eb20a7a4ff8630837b3e77cf6a72d71`, 2026-08-13T18:45:00Z.
- https://github.com/beep-effect/beep-effect/actions/runs/31738022919/job/94574275173, head `c0d59c20299f42b642c5f778488114f2a8fd2f03`, 2026-08-13T19:52:30Z.

## Top files

- `packages/epistemic/use-cases/test/ClaimDisposition.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/use-cases/test/ContradictionTriage.commands.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/use-cases/test/ContradictionTriage.rpc.test.ts`: 4 rows, 1 review items.
- `packages/epistemic/use-cases/test/EdgeAuthorityCommands.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/use-cases/test/EpistemicUseCases.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/use-cases/test/ExecutionLedger.test.ts`: 4 rows, 0 review items.
- `packages/epistemic/use-cases/test/TaggedError.equivalence.test.ts`: 4 rows, 0 review items.

## P2 ordering and uncertainty

Only after explicit authorization: Preserve atomic Ref/per-claim isolation, fixed-time correlated fixtures, actual port-test scope and 25/50-run laws. Link the authentication claim to an actual server-boundary observation with negative and positive controls before claiming authentication coverage. Preserve every existing assertion, operand and replay seed. No timeout increase, retry or provider acquisition is justified by this audit.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

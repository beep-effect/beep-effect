# @beep/drizzle — P1 wave006-b digest

P1 source inventory reviewed by Root; P2 remains gated. All 3 assigned files were read completely through all four lenses. No source or canonical edits, tests or optional service gates were executed.

Rows: 12 = 3 actionable judgment candidates + 9 file-specific coverage rows. Lens counts: resource 3, flake 3, property 3, observability 3. Severity counts: info 9, minor 2, major 1. All are open; every row passed the strict public decoder.

Layer topology and native boundaries: Unit adapters are verified pure Layer.succeed and do not acquire connections. The optional integration merges an actual PGlite layer and migrations behind a 2-minute hook timeout; its SQL transaction boundary is the subject. Keep the backing SQL/driver selection and original rollback Cause. Connection/transaction ownership must be proved before replacing its manual protocol; no database was acquired here.

Top files by actionable count (all assigned files; fewer than ten):

- packages/drivers/drizzle/test/Drizzle.errors.test.ts: 2 actions, 4 rows; read 1–491.
- packages/drivers/drizzle/test/integration/Drizzle.pglite.test.ts: 1 actions, 4 rows; read 1–112.
- packages/drivers/drizzle/test/Drizzle.equivalence.test.ts: 0 actions, 4 rows; read 1–32.

Detailed findings:

- L-PROP-04, packages/drivers/drizzle/test/Drizzle.errors.test.ts:427 (minor, confidence 1): The root and transaction execute stubs both return [statement,parameters]. Passing the root adapter into the transaction callback would still satisfy select 2/tx. Use distinguishable root/transaction capture or sentinel state to prove the callback uses the supplied transaction client, preserving both original SQL/parameter expectations and all existing error-identity cases. Drizzle.service.ts:142-146 correctly maps the transaction adapter; this finding concerns the test oracle.
- L-OBS-01, packages/drivers/drizzle/test/Drizzle.errors.test.ts:348 (minor, confidence 1): Three manual native property callbacks throw via getOrThrow/assertions and summarize the result. Use named adapter properties to normalize thrown failures and retain formatted shrink/replay context, with fcRuns(50) for each. Preserve parameter/query round-trips, cause-presence policy, hostile-cause controls and existing errors; do not demand object identity across serialization.
- L-RES-02, packages/drivers/drizzle/test/integration/Drizzle.pglite.test.ts:46 (major, confidence 0.9): The fixture yields BEGIN, then captures use(client), then yields COMMIT or ROLLBACK without a surrounding interruption-safe ownership/finalizer protocol. Cancellation after BEGIN or a COMMIT error is not covered by the existing typed rollback example. Review the backing SQL transaction operation and connection ownership before replacing this adapter; preserve original callback value/Cause and actual SQL visibility, and add an armed cancellation/cleanup probe. Do not assert that Effect.exit alone guarantees rollback under interruption. This is a static failure-path risk, not an acquired/leaked database; no pinned SqlClient implementation was available in this reference bundle.

Recorded runtime evidence: Root accepted one configured Node command baseline: 25 registered tests, {'passed': 25}; whole command 7.873747 seconds, reporter total 7448.775146 ms. These are different measurements. Slowest files (up to ten, including all represented files):

- packages/drivers/drizzle/test/integration/Drizzle.pglite.test.ts: 918.775146 ms, 1 registered tests.
- packages/drivers/drizzle/test/Drizzle.errors.test.ts: 36.557129 ms, 23 registered tests.
- packages/drivers/drizzle/test/Drizzle.equivalence.test.ts: 1.328125 ms, 1 registered tests.

Global collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. No timing is rerun, normalized or selected as best-of. Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 are the recorded runtimes; rc113 API semantics are pinned separately. No supported Vitest peer claim, code coverage or full package proof follows from these passes. A passed optional integration registration is not independent evidence of live provider/container branch execution; this lane inspected no credential values or gate runtime.

Hosted evidence: 4 matching observations across 1 jobs in the completed 527-failed-run collection. All matching observations concern coverage-ratchet production paths, not failed test names or unique flakes. The collection includes 21 unavailable logs and one unresolved cause; causal attribution and unique-flake counts remain unproved. Exact matching records and source summary hashes are retained privately.

Proposed internal P2 order remains scope, assertions, property, flake, observability. First review ownership/native boundaries and any resource candidates; then preserve complete tagged/plain assertion operands; address the listed oracle/generator gaps; make any demonstrated clock/cancellation corrections without retries; finally migrate manual property diagnostics through the accepted instrumented public tester. This order proposes review work only. Existing scanner candidates and the 90 inherited-main ratchet additions remain open and unchanged. No waiver, threshold change or P2 implementation is authorized.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

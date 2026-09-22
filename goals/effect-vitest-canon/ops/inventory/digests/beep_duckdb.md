# @beep/duckdb — P1 wave006-b digest

P1 source inventory reviewed by Root; P2 remains gated. All 2 assigned files were read completely through all four lenses. No source or canonical edits, tests or optional service gates were executed.

Rows: 9 = 5 actionable judgment candidates + 4 file-specific coverage rows. Lens counts: resource 3, flake 2, property 2, observability 2. Severity counts: info 4, major 3, minor 2. All are open; every row passed the strict public decoder.

Layer topology and native boundaries: Two main describe groups explicitly disable concurrency because fixtures temporarily replace DuckDBInstance.create. Native instance/connection, stream, SQL, Parquet and caller-owned connection lifetimes are tested. withTempDirectory owns real OS files, and MemoryFS substitution would erase native compatibility. Production waits uninterruptibly for native operations before releasing permits. Repeated scoped layers may have real setup cost, but no allocation count or savings were measured; preserve lifecycle subjects before sharing.

Top files by actionable count (all assigned files; fewer than ten):

- packages/drivers/duckdb/test/DuckDb.service.test.ts: 5 actions, 5 rows; read 1–1254.
- packages/drivers/duckdb/test/DuckDb.equivalence.test.ts: 0 actions, 4 rows; read 1–29.

Detailed findings:

- L-RES-02, packages/drivers/duckdb/test/DuckDb.service.test.ts:51 (major, confidence 1): The fixture registers release only after instance.connect resolves. If create succeeds and connect rejects, no release owns the instance. Its release also calls connection.closeSync before instance.closeSync in one block, so a throwing first close skips the second. Match the failure-safe ownership already present in DuckDb.service.ts:240-266 and DuckDbNative.ts:35-63 while keeping real native SQL/Parquet subjects and caller-owned connection semantics. No native resource was acquired by this audit.
- L-RES-02, packages/drivers/duckdb/test/DuckDb.service.test.ts:374 (major, confidence 0.98): The negative permit assertion executes before releaseFirst.resolve; a failed assertion prevents the controlled native Promise from settling. The driver deliberately makes native operations uninterruptible (DuckDb.service.ts:200-230), so sibling cancellation can then wait indefinitely. Register failure-safe release of each controlled latch before starting native work, retain the exact negative/positive permit assertions and joins, and keep production ownership unchanged. Review equivalent releaseRun/copy latches individually. This is a concrete exceptional fixture path, not a reproduced hang.
- L-FLAKE-01, packages/drivers/duckdb/test/DuckDb.service.test.ts:367 (major, confidence 0.98): Five permit cases (367,424,481,1012,1078) combine Effect.timeoutOption(50 millis) with node:timers/promises sleep(75), under ordinary it.effect TestClock with no adjust. Wall time does not prove Effect timeout fired, and Effect.ignore discards its result. Explicitly request/observe interruption after the first operation is armed, or control the installed TestClock and assert timeout outcome; still prove the native permit stays held until native completion. Retain native work, all SQL payloads and explicit BEGIN interruption cases at602/655. Do not merely increase delays or convert real native work to virtual time.
- L-PROP-02, packages/drivers/duckdb/test/DuckDb.service.test.ts:103 (minor, confidence 0.95): Both error arbitraries discard every Some cause, although the schema admits causes and fixed tests exercise them. Keep existing None coverage and add representable valid Some-cause generation with explicit normalization/codec expectations. Do not require raw Error identity after serialization, widen an unknown cause domain blindly, or remove filtering merely to produce failures. Preserve the original fcRuns(20) floor and all reason/message/equivalence controls. This is a known generated-domain gap, not a claim every arbitrary Unknown cause is serializable.
- L-OBS-01, packages/drivers/duckdb/test/DuckDb.service.test.ts:118 (minor, confidence 1): The helper runs seven schema families through checkEffect and toMatchObject(Passed), with nested synchronous codec execution. A false result is not formatted into its native shrink/replay report and thrown codec defects bypass adapter normalization. Use named adapter properties retaining each custom arbitrary, S.toEquivalence and fcRuns(options.runs ?? 20). Keep the Some-cause expansion as a separate reviewed property change; do not silently change input coverage during runner migration.

Recorded runtime evidence: Root accepted one configured Node command baseline: 29 registered tests, {'passed': 29}; whole command 8.981994 seconds, reporter total 7965.808105 ms. These are different measurements. Slowest files (up to ten, including all represented files):

- packages/drivers/duckdb/test/DuckDb.service.test.ts: 1734.808105 ms, 28 registered tests.
- packages/drivers/duckdb/test/DuckDb.equivalence.test.ts: 2.216553 ms, 1 registered tests.

Global collection is complete: 139 first attempts, 132 accepted full-file-representation baselines, four configured subsets and three failures. No timing is rerun, normalized or selected as best-of. Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 are the recorded runtimes; rc113 API semantics are pinned separately. No supported Vitest peer claim, code coverage or full package proof follows from these passes.

Hosted evidence: 0 matching observations across 0 jobs in the completed 527-failed-run collection. No matching observation is not a claim of no historical or rare failures. The collection includes 21 unavailable logs and one unresolved cause; causal attribution and unique-flake counts remain unproved. Exact matching records and source summary hashes are retained privately.

Proposed internal P2 order remains scope, assertions, property, flake, observability. First review ownership/native boundaries and any resource candidates; then preserve complete tagged/plain assertion operands; address the listed oracle/generator gaps; make any demonstrated clock/cancellation corrections without retries; finally migrate manual property diagnostics through the accepted instrumented public tester. This order proposes review work only. Existing scanner candidates and the 90 inherited-main ratchet additions remain open and unchanged. No waiver, threshold change or P2 implementation is authorized.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).

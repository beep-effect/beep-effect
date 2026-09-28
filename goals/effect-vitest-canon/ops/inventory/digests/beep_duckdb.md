# @beep/duckdb — completed database D12 reconciliation

Reviewed 2 current test files. Ledger: 65 rows; 52 fixed historical findings, 9 justified exceptions and 4 open no-findings coverage rows. Fixed IDs preserve the frozen inventory; active detector exceptions use current occurrence IDs and exact source anchors. No unresolved actionable finding is hidden as an exception.

Scope ownership uses bounded native layers, scoped temporary directories and independent instance/connection finalizers. Scope commit `abcc7974229060e61ff7c6e523b8da75b3456df5` removes ordinary wrapper ownership while retaining the production lifetimes that close before cleanup-count assertions. Assertions commit `bda048be32292708366ad703470ef877d99e3a0b` preserves every polarity and reference oracle.

Seven original codec domains use named native properties at floor20 in `6d4fb717df53c486d075d1745414e97771834f7a`. Both original None filters remain. Two representable Some-cause laws added separately in `a964e75f40f1a476217d09fa69bd3e206709fa83` check independent full wire expectations, JSON decoding and schema equivalence; raw normalizer identity is checked only before serialization.

Flake commit `663b9809fef3e3ae43de99d08e5ebe4cf85b2464` arms native work, explicitly requests interruption, retains before-release/after-release permit probes, joins exact second rows and observes interrupted exits. Release finalizers are installed before native work starts. Serialization uses controlled overlap and exact both results, retaining maxActiveExecutions1. The first-acquisition release registration gap is also closed.

Nine active detector exceptions are deliberate subjects: two close-oracle provider calls, their documented helper, interrupted-acquisition scoped/context ownership, two managed-client shorter scopes, one-hour pending transaction callback and native NodeServices provenance. Native database/Parquet files, zero/one cleanup counts, BEGIN/ROLLBACK and failed-BEGIN controls, no-Parquet and nested rollback oracles remain. MemoryFileSystem would erase host-native compatibility.

All registrations use the public @beep/test-runner harness after `4d1e87568ae850a8b769e0fb29834efd5fcc89d4`. Explicit ordinary hook budgets preserve the existing ten-second setting; native/SQL subject budgets remain unchanged. Instrumentation receives no credit for fixes completed in earlier phases. No production repair, suppressed diagnostic, weakened oracle or raised timeout was needed.

Parent reports final configured Node and Bun suites passing (DuckDB37, Drizzle29, Postgres46), and all16 generated laws passing at400 runs with seed20260708. Those are parent-owned final proofs; this reconciliation ran only the existing strict inventory validator. Safe database proofs explicitly clear BEEP_TEST_DATABASE_URL and choose pglite-inprocess. Native resources remain real where they are the subject.

Frozen timing and hosted-history receipts retain their original provenance; this digest does not replace first-attempt data, normalize timings, claim performance savings or infer absence of rare failures. Current source/reference behavior is separate from historical rc113 receipts. See [baseline timing index](../timings/baseline-index.json), [timing failures](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json). Parent owns final timing/trace/cache/history records and publication gates.

Current file membership (unchanged from the frozen eight-file database cohort):

- `packages/drivers/duckdb/test/DuckDb.equivalence.test.ts`.
- `packages/drivers/duckdb/test/DuckDb.service.test.ts`.

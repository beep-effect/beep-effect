# @beep/drizzle — completed database D12 reconciliation

Reviewed 3 current test files. Ledger: 42 rows; 32 fixed historical findings, 1 justified exceptions and 9 open no-findings coverage rows. Fixed IDs preserve the frozen inventory; active detector exceptions use current occurrence IDs and exact source anchors. No unresolved actionable finding is hidden as an exception.

Five pure client fixtures are harness-owned in `251dd312f21f6c8738ce3cbbefe50bb14fadcf1e`. The PGlite adapter delegates transaction ownership to installed SqlClient.withTransaction while preserving error mapping. An independent fresh fixture inserts inside an armed transaction, interrupts, verifies rollback and then proves subsequent commit/usability; hook/body budgets and original SQL arrays remain.

Assertions commit `0e0402ef7f5b4bb3c631fa0733f511720a1dbcc9` preserves hostile-proxy/Cause, redaction and strict identity controls. Three named native properties retain floor50 and all original domains in `3ff3b8a971871c1b5b34c005c81ed2529ee2520a`. Distinguishable root/transaction counters supplement the unchanged SQL/parameter results. The final runner commit resets both counters at each invocation, repairing the separately identified capture-state persistence gap.

The sole active detector exception retains O.isSome(decoded.cause) equal to O.isSome(error.cause). Both generated branches matter; neither unconditional Some/None nor an invented expected payload is equivalent. Newer upstream unredacted-params rejection remains covered; the assertion phase handles its Exit predicate. The interruption test preserves exact interrupt presence without inventing a Cause. No fixture change claims rollback after a failing COMMIT.

All registrations use the public @beep/test-runner harness after `4d1e87568ae850a8b769e0fb29834efd5fcc89d4`. Explicit ordinary hook budgets preserve the existing ten-second setting; native/SQL subject budgets remain unchanged. Instrumentation receives no credit for fixes completed in earlier phases. No production repair, suppressed diagnostic, weakened oracle or raised timeout was needed.

Parent reports final configured Node and Bun suites passing (DuckDB37, Drizzle29, Postgres46), and all16 generated laws passing at400 runs with seed20260708. Those are parent-owned final proofs; this reconciliation ran only the existing strict inventory validator. Safe database proofs explicitly clear BEEP_TEST_DATABASE_URL and choose pglite-inprocess. Native resources remain real where they are the subject.

Frozen timing and hosted-history receipts retain their original provenance; this digest does not replace first-attempt data, normalize timings, claim performance savings or infer absence of rare failures. Current source/reference behavior is separate from historical rc113 receipts. See [baseline timing index](../timings/baseline-index.json), [timing failures](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json). Parent owns final timing/trace/cache/history records and publication gates.

Current file membership (unchanged from the frozen eight-file database cohort):

- `packages/drivers/drizzle/test/Drizzle.equivalence.test.ts`.
- `packages/drivers/drizzle/test/Drizzle.errors.test.ts`.
- `packages/drivers/drizzle/test/integration/Drizzle.pglite.test.ts`.

# Instance

- id: `duckdb-transaction-began-closed`
- file:line: `packages/drivers/duckdb/src/DuckDb.service.ts:374`
- symbol: `withTransaction.latches`
- members: `began`, `closed`
- evidence classes:
  - E4 at `packages/drivers/duckdb/src/DuckDb.service.ts:377` — `rollbackIfOpen` only runs when `began && !closed`; `closed` is written only after BEGIN succeeded, so `!began && closed` is unrepresentable in practice.
  - E1 at `packages/drivers/duckdb/src/DuckDb.service.ts:384` — BEGIN sets `began=true` with `closed` still false; COMMIT/ROLLBACK then set `closed=true`, flattening `idle|open|closed` into two bits.

# Current shape

Live sibling declarations and cleanup at `packages/drivers/duckdb/src/DuckDb.service.ts:373`:

```ts
return Effect.suspend(() => {
  let began = false;
  let closed = false;
  const rollbackIfOpen = Effect.suspend(() =>
    began && !closed
      ? runOnConnection("withTransaction", options, connection, "ROLLBACK").pipe(Effect.ignore)
      : Effect.void
  );
```

# Cardinality gap

The latches represent four combinations but the transaction has three legal states:

- `idle` — `BEGIN TRANSACTION` has not completed.
- `open` — begin completed and neither commit nor rollback completed.
- `closed` — commit or rollback completed.

`began: false, closed: true` is illegal. This is mutable internal lifecycle state, so one stored literal is the honest replacement.

# Target schema

Import `LiteralKit` from `@beep/schema` and define the local lifecycle next to `$I`:

```ts
const DuckDbTransactionPhase = LiteralKit(["idle", "open", "closed"]).pipe(
  $I.annoteSchema("DuckDbTransactionPhase", {
    description: "Lifecycle phase of a native DuckDB transaction during scoped cleanup.",
  })
);
type DuckDbTransactionPhase = typeof DuckDbTransactionPhase.Type;
```

Use one mutable value inside `Effect.suspend`:

```ts
let transactionPhase: DuckDbTransactionPhase = DuckDbTransactionPhase.Enum.idle;
```

Set it to `open` only after `BEGIN TRANSACTION` succeeds, and to `closed` only after commit or rollback completes. `rollbackIfOpen` checks the single `open` value. Do not retain derived `began`/`closed` helpers.

# Migration inventory

- `packages/drivers/duckdb/src/DuckDb.service.ts:15-18` — add the `LiteralKit` import.
- `packages/drivers/duckdb/src/DuckDb.service.ts:26` — define and annotate `DuckDbTransactionPhase` beside the file identity composer.
- `packages/drivers/duckdb/src/DuckDb.service.ts:373-380` — replace both boolean declarations with `transactionPhase = idle`; cleanup reads only whether the phase is `open`.
- `packages/drivers/duckdb/src/DuckDb.service.ts:383-384` — after successful begin, transition `idle -> open`.
- `packages/drivers/duckdb/src/DuckDb.service.ts:386-389` — after successful commit, transition `open -> closed`.
- `packages/drivers/duckdb/src/DuckDb.service.ts:392-394` — after rollback completes, transition `open -> closed` before propagating the failure.

Repository-wide search finds no other source or test access to the private `began` and `closed` latches.

# Guard-deletion accounting

- `packages/drivers/duckdb/src/DuckDb.service.ts:376-380` — delete `began && !closed`, the runtime coherence conjunction required to recognize the only cleanup state. `open` names it directly.
- `packages/drivers/duckdb/src/DuckDb.service.ts:374-375` — delete the independently mutable latch pair and its comment-only ordering invariant (“closed is assigned only after began”). The literal type prevents a closed-before-begin combination.

# Encoded-side impact

none (internal)

# Test impact

- `packages/drivers/duckdb/test/DuckDb.service.test.ts:610-659` — preserves the interruption-after-begin proof: phase becomes `open`, ensuring emits one rollback, then cleanup completes.
- `packages/drivers/duckdb/test/DuckDb.service.test.ts:662-701` — preserves the begin-failure proof: phase remains `idle` and no rollback occurs.
- `packages/drivers/duckdb/test/DuckDb.service.test.ts:704-735` — preserves failure rollback behavior for nested transaction use.
- No test directly reads the latches. Existing statement-order assertions are the correct boundary proof; no schema encoding test is needed for a private local phase.

# Risk & sequencing

This Tier 1 change is concurrency-sensitive despite its small scope. Preserve the exact uninterruptible-mask boundaries and assign phases only after the corresponding native operation resolves. In particular, do not set `closed` before COMMIT/ROLLBACK succeeds: ensuring must still observe `open` and attempt rollback if a close operation is interrupted or fails.

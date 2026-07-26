---
"@beep/epistemic-tables": patch
"@beep/epistemic-use-cases": patch
"@beep/epistemic-server": patch
"@beep/db-admin": patch
"@beep/professional-desktop": patch
---

Add the append-only execution ledger: tables, migration, port, and Drizzle adapter.

Two insert-only tables land — `epistemic_execution_decision` (chained per run by
`PRIMARY KEY (run_key, seq)`) and `epistemic_execution_outcome` (one outcome per decision
by `PRIMARY KEY (decision_hash)`, bound to its write-ahead decision by a composite foreign
key). Both are raw drizzle `pgTable` projections rather than `EntityTable.pgTableFrom`
over `BaseEntity`, settling the fork the packet recorded: `BaseEntity` bakes in
`row_version`/`updated_at`/`updated_by_principal`, update vocabulary that would be a lie in
the schema of rows that must never mutate.

The migration ships the repo's first plpgsql triggers — row-level `BEFORE UPDATE OR
DELETE` guards plus statement-level `BEFORE TRUNCATE` guards, because a truncated run
would read back as an empty chain the verifier certifies intact — authored inside the
statement splitter's narrower rule (no `;` + newline + boundary keyword inside the body)
and proven through the real `migrate()` path. Bounded CHECKs enforce the nine-member
denial-reason domain at the table, so free text cannot be smuggled into a no-payload
ledger even by a writer that bypasses every schema; a second composite foreign key pins
the settled decision's verdict to `allowed`, so an outcome fabricated for a denied
decision is unrepresentable rather than merely detectable.

`ExecutionLedger` is the new port in `epistemic/use-cases` (append and read only — no
update or delete is expressible), with its Drizzle adapter in `epistemic/server` mapping
constraint rejections to typed errors by name. The derived "decided, outcome unknown"
predicate is scoped to allowed decisions, so an ordinary denial is never reported as a
crash. Integration proof: a tampered mid-chain row is detected at its exact index by the
domain verifier after the owner drops the trigger — tamper-evident, not tamper-proof, as
documented.

This is PR 3 of goals/agent-execution-authority.

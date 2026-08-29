# S6 — Cycle-Enforcement Decision From Evidence

**Date:** 2026-07-25
**Spike:** P0 / S6 of `goals/epistemic-bitemporal-edge-core`
**Contract:** `ops/handoffs/p0-spike-contract.md` § "S6 — Cycle enforcement from evidence"

## Verdict

**DECIDED: cycle prevention stays application-side** (the ratified default holds). The
DB contributes exactly two cheap guards — the lineage FK (`spike_edge_supersedes_fk`)
and the self-reference CHECK (`spike_edge_no_self_supersede`) — and no *simple* DB
mechanism prevents longer lineage cycles.

## Evidence

Fixture: `cycle probe: DB accepts a constructed supersession cycle; recursive CTE
detects it` (PGlite suite, run log
[`../s3-postgres-ddl/vitest-pglite.log`](../s3-postgres-ddl/vitest-pglite.log)).

1. Both cheap guards are in the DDL and probed elsewhere: the self-supersede CHECK
   rejects `supersedes_id = id` by name (S3 probe), and the FK rejects dangling lineage.
2. A 2-cycle (`21 → 22 → 21`) **was constructible** via a raw `UPDATE` on
   `supersedes_id`: the database offers no declarative guard against it. Preventing it
   at the DB layer would require a recursive constraint trigger — which the contract
   pre-classified as an automatic "stay application-side".
3. A recursive CTE (path-array walk with an `is_cycle` revisit flag) **detects** the
   constructed cycle as a query — so cycle detection is available to diagnostics and
   invariant sweeps without being a constraint.

## Why the sanctioned write path cannot construct a cycle

Under the S5 rule, a supersession only ever (a) closes the current open head it locked
and (b) inserts a **new** row whose `supersedes_id` points at that head, with
`version = head.version + 1` under `UNIQUE (logical_key, version)`. Lineage edges always
point from a strictly newer version to a strictly older one; fact rows are immutable and
`supersedes_id` is never updated through the sanctioned path (the probe's raw `UPDATE`
is exactly the kind of write the repository never issues). A cycle requires re-pointing
an existing row — P1's repository surface simply does not expose that operation, and the
typed command layer enforces it.

**P1 obligations recorded:** keep `supersedes_id` immutable in the repository contract
(no update command touches it), and optionally ship the recursive CTE as a diagnostic
query, not a constraint.

# S5 — Concurrent Supersession Determinism

**Date:** 2026-07-25
**Spike:** P0 / S5 of `goals/epistemic-bitemporal-edge-core`
**Contract:** `ops/handoffs/p0-spike-contract.md` § "S5 — Concurrent supersession determinism"

## Verdict

**PASS — chosen rule: READ COMMITTED + `SELECT ... FOR UPDATE` on the open metadata rows
for the logical key + `expectedVersion` compare + metadata-only close + insert, all in
ONE transaction, with the L2 open-head index catching the creation race and the L1
exclusion constraint catching lock-skipping writers.** All three races resolved
deterministically on real Postgres with two genuinely parallel connections. The
advisory-lock fallback (`pg_advisory_xact_lock`) was **not needed** and stays a recorded
fallback only. No last-writer-wins anywhere. No stop condition fired.

## Lane setup

- Server: PostgreSQL 17.10, image `pgvector/pgvector:pg17`, dedicated disposable
  container `beep-spike-pg` on `127.0.0.1:55432`. **Substitution note:** the compose
  `beep-db` service could not bind host port 5432 — it is held by an unrelated container
  (`workflow-postgres`) on this workstation — so the spike ran the *same image* as a
  dedicated throwaway container instead. Strictly tighter isolation than the shared
  compose dev database; recorded here rather than silently worked around.
  ```sh
  docker run -d --name beep-spike-pg -e POSTGRES_PASSWORD=postgres \
    -p 55432:5432 pgvector/pgvector:pg17
  ```
- Client: `@effect/sql-pg` `PgClient` pool (`maxConnections: 4`); each racing
  transaction runs `sql.withTransaction` on its own fiber → its own pooled connection.
- Suite: `packages/drivers/pglite/test/integration/spike/EpistemicBitemporalSpike.pg.test.ts`
  — 4/4, run log [`vitest-pg-external.log`](./vitest-pg-external.log). Migration +
  extension + constraint-catalog proof on the real server is the suite's first test
  (journal isolated in schema `epistemic_spike_journal`).

## Race A — two superseders over the same open head

Choreography (Deferred-coordinated, two connections): the winner locks the open head
with `FOR UPDATE` inside its transaction; the loser then issues the same
`SELECT ... WHERE logical_key = ... AND expired_at IS NULL FOR UPDATE` and **blocks on
the row lock**; the winner closes (`UPDATE ... SET expired_at = 2000 WHERE id = 11 AND
expired_at IS NULL`) and inserts v2 with lineage, then commits; the loser wakes,
READ COMMITTED re-evaluates the predicate against the committed row version
(EvalPlanQual), the head no longer satisfies `expired_at IS NULL`, and the loser
observes **zero open rows** → the typed-conflict path, with nothing written.

Asserted deterministic outcome: winner saw version 1; loser saw `[]`; exactly 2 version
rows; exactly one open head `{version: 2, supersedes_id: 11}`; intact lineage; no
partial write. Note the winner's close predicate `AND expired_at IS NULL` is exactly the
donor's idempotent transaction-axis guard S1 verified at
`edge_operations.py:569-570` — an already-expired head is never re-stamped.

## Race B — two creators, nothing to lock

Both transactions insert an open head for the same brand-new logical key concurrently.
`FOR UPDATE` cannot serialize what does not exist; the DB backstop resolves it: exactly
one insert commits, the other rejects with a named `spike_edge_*` backstop (on this
server the blocked second insert errors after the first commits), mapped to the typed
conflict. Asserted: exactly one failure containing `spike_edge_`, exactly one row.

## Race C — a lock-skipping writer

A writer that ignores the locking rule and inserts an overlapping closed interval is
rejected by the exclusion constraint (`spike_edge_no_overlap`) — the L1 backstop holds
even against misbehaving write paths, which is precisely why the enforcement ladder
keeps DB backstops under the service rule.

## PGlite sequential equivalents (documented mechanism substitution)

In-process PGlite is single-connection (`maxConnections: 1` by design), so a true
parallel race cannot be constructed there. The PGlite suite proves the same loser
outcomes sequentially (run log
[`../s3-postgres-ddl/vitest-pglite.log`](../s3-postgres-ddl/vitest-pglite.log)):

- `sequential supersession loser: stale expectedVersion closes zero rows and aborts` —
  the guarded close (`WHERE ... version = 1 AND expired_at IS NULL RETURNING id`)
  returns zero rows after another writer superseded; the loser aborts without inserting;
  final state identical to race A's.
- `sequential creation race loser: second open head is rejected by a spike_edge
  backstop` — the DB rejects the second open head, as in race B.

## Harness gotchas recorded for P1's test authors

- `@effect/vitest` `layer()` testers run under the **TestClock**: an `Effect.sleep`
  inside the winner's transaction never fires and the choreography deadlocks into the
  test timeout (observed: first run failed at 120s). The layer-scoped `it` exposes no
  `.live`, and JS-timer workarounds (`new Promise` + `setTimeout`) trip the repo's
  effect lint. The clean fix: **let the database be the timer** —
  `yield* sql\`SELECT pg_sleep(0.25)\`` on the winner's own connection, which also keeps
  the row lock held for the full delay.
- `describe.sequential` is deprecated by the repo's lint (`@typescript-eslint/no-deprecated`);
  PGlite/serialized suites use `describe(name, { concurrent: false }, ...)` (the
  `UsageRecordSink.pglite.test.ts` form).
- Read lane-selector env via a Config boot snapshot, never `process.env` (effect lint) —
  the `makePgliteIntegrationGate` precedent:
  `Effect.runSync(Config.option(Config.string("BEEP_SPIKE_PG_URL")))`.
- The gate variable is **spike-dedicated** (`BEEP_SPIKE_PG_URL`), NOT the shared
  `BEEP_TEST_DATABASE_URL`: the repo's integration lane exports the shared variable
  pointing at a single-connection pglite-socket server with no btree_gist, which can
  neither load the extension nor host a race — keying on it broke `yeet verify`'s
  integration lane until the dedicated variable was introduced.

## How to run

```sh
docker run -d --name beep-spike-pg -e POSTGRES_PASSWORD=postgres \
  -p 55432:5432 pgvector/pgvector:pg17
cd packages/drivers/pglite
BEEP_SPIKE_PG_URL=postgres://postgres:postgres@localhost:55432/postgres \
  npx vitest run test/integration/spike/EpistemicBitemporalSpike.pg.test.ts
docker rm -f beep-spike-pg   # cleanup
```

# S4 — PGlite Parity, Portable Substitution, and Restart Proof

**Date:** 2026-07-25
**Spike:** P0 / S4 of `goals/epistemic-bitemporal-edge-core`
**Contract:** `ops/handoffs/p0-spike-contract.md` § "S4 — PGlite parity or explicit substitution + restart proof"

## Verdict

**PASS — full L1 parity, substitution proven anyway.** The production no-overlap
mechanism (`btree_gist` + GiST exclusion) works identically in the PGlite proof lane, so
no substitution is *required*. The L2 portable substitution was prototyped and proven
regardless, with its one residual documented honestly. The restart proof holds:
history, lineage, dispositions, both as-of answers, and live constraint enforcement
survive closing and reopening the same `dataDir`. No stop condition fired.

## Parity matrix (mechanism × lane × result)

Lanes: **PGlite** = in-process 0.5.4, PostgreSQL 18.3 wasm; **PG** = external
PostgreSQL 17.10 (`pgvector/pgvector:pg17`). Evidence: PGlite —
[`../s3-postgres-ddl/vitest-pglite.log`](../s3-postgres-ddl/vitest-pglite.log) (21/21);
PG — [`../s5-concurrency/vitest-pg-external.log`](../s5-concurrency/vitest-pg-external.log) (4/4).

| Mechanism | PGlite (18.3 wasm) | PG (17.10) | Notes |
| --- | --- | --- | --- |
| `CREATE EXTENSION btree_gist` | works (bundled `contrib/btree_gist`) | works (contrib image) | PGlite needs the extension registered at construction (`makeLayer({ extensions })`) |
| `EXCLUDE USING gist (text WITH =, int8range WITH &&) WHERE (...)` | enforces, rejects by name | enforces, rejects by name | L1 — full parity |
| Ordered-interval CHECKs (both axes) | identical | identical | core SQL |
| `UNIQUE (logical_key, version)` | identical | identical | core SQL |
| Endpoint + lineage FKs, bounded CHECKs | identical | identical | core SQL |
| Partial unique open-head index (L2) | enforces, rejects by name | candidate backstop in race B | core SQL |
| `int8range`/`tstzrange` half-open + NULL-unbounded semantics | identical | identical (implied by constraint behavior) | core SQL |
| Canonical asOf answers (both axes, boundaries) | exact | not re-run (PGlite-proven; core SQL) | |
| Migration via `migrate()` + journal idempotence | works, 1 journal row | works (fresh journal schema) | |
| dataDir restart survival | proven | n/a (server-durable by definition) | |
| True two-connection races | **impossible — single connection** | proven (S5) | documented mechanism substitution |

## The L2 substitution, proven with its residual named

Lane: `EpistemicBitemporalSpike.pglite.test.ts`, no-extension fixture
(`fixtures/epistemic-bitemporal-spike-noext/`) over a bare `Pglite.makeLayer()` with no
extensions — simulating an environment where `btree_gist`/EXCLUDE is unavailable.

- `no-extension lane: bare DDL applies and the open-head partial unique index rejects by
  name` — the DDL minus `CREATE EXTENSION` and minus the EXCLUDE applies cleanly, and a
  second open head for the same logical key rejects naming `spike_edge_open_head_idx`.
  Same fixture, same rejection semantics as the L1 lane (different constraint name —
  that is the substitution).
- `no-extension lane residual: closed-interval overlap is not rejected at DB level` —
  **the honest residual:** without the EXCLUDE, two overlapping *closed* authoritative
  intervals coexist at the DB level (probe records 2 rows). That residual is owned by
  the locked write path: the S5 rule (`FOR UPDATE` + `expectedVersion` + close-and-insert
  in one transaction) never constructs overlapping closed intervals through the
  sanctioned path, and on production Postgres L1 additionally rejects even misbehaving
  writers (S5 race C). Semantics preserved; mechanism substituted; residual named. This
  is the ratified "explicit portable backstop, not weakened semantics".

Because L1 has full parity in the actual proof lane, the substitution is a **ratified
fallback**, not the operating mode.

## Restart proof

`restart proof: history, lineage, dispositions, as-of answers, and constraints survive
reopen` (precedent: `packages/drivers/pglite/test/integration/PgliteClient.persistent.test.ts`):

1. Scope 1 over a temp `dataDir`: migrate the full DDL, seed claims, write the
   retroactive-correction chain (v1 open → close transaction axis → v2 with lineage) and
   a rejected disposition; close the layer scope (PGlite shuts down).
2. Scope 2 over the **same** `dataDir`, extension re-registered: both as-of answers
   return exactly (`(1500,1500) → "100"`, `(1500,2500) → "150"`), lineage
   (`supersedes_id = 1`) and the disposition row survive, and a fresh overlap probe
   still rejects naming `spike_edge_no_overlap` — the constraint itself, not just the
   data, survives the process boundary.

## Scoped exceptions (named, not silent)

- **`@beep/test-utils` has no extensions seam** — `PgliteInProcessTestDriver` hardcodes
  `PgliteClient.layer({ dataDir, relaxedDurability: true })`
  (`packages/tooling/test-kit/test-utils/src/SqlTest.ts:1394`). The spike deliberately
  bypasses the shared harness and builds its own layer via `@beep/pglite`
  `makeLayer({ dataDir, extensions: { btree_gist } })` — which is also what supplies the
  restart `dataDir`. Threading an `extensions` option through the shared harness is a
  P1 decision recorded in the handoff; not spike scope.
- **`pglite-testcontainers` lane is out of scope** for the extension proof: its
  Dockerfile pins `@electric-sql/pglite@0.4.5` and the `pglite-server` CLI accepts no
  extensions map. Named substitution: extension-dependent proofs run on
  `pglite-inprocess` and `pg-external` only.

## How to run

```sh
cd packages/drivers/pglite
npx vitest run test/integration/spike/EpistemicBitemporalSpike.pglite.test.ts
```

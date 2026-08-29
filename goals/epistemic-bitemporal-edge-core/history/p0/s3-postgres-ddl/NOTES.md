# S3 — Postgres DDL Prototype + Migration Shape Through the db-admin Path

**Date:** 2026-07-25
**Spike:** P0 / S3 of `goals/epistemic-bitemporal-edge-core`
**Contract:** `ops/handoffs/p0-spike-contract.md` § "S3 — Postgres DDL prototype + migration shape"

## Verdict

**PASS.** The candidate storage design holds on both lanes with no substitution needed
for the production mechanism: `btree_gist` loads under PGlite 0.5.4 (PostgreSQL 18.3
wasm), the mixed scalar+range GiST exclusion constraint enforces and rejects by name,
the full DDL applies through the real `@beep/postgres` `migrate()` path idempotently,
every ratified backstop has a named-constraint adversarial rejection, and the as-of
fixtures return exact answers on both time axes — including the donor's
close-valid-time-at-invalidating-`valid_from` semantics. No stop condition fired.

## Pinned inputs

| Input | Value |
| --- | --- |
| Branch / base | `feat/epistemic-bitemporal-p0-spike` / `18c36b5dc5` |
| `@electric-sql/pglite` | 0.5.4 (wasm reports PostgreSQL 18.3) |
| `@effect/sql-pglite` / `@effect/sql-pg` / `effect` | 4.0.0-beta.101 |
| `drizzle-orm` | 1.0.0-rc.4-de6c356 |
| External lane | `pgvector/pgvector:pg17` → PostgreSQL 17.10 (see S5 notes) |
| Graphiti donor pin (S1) | `v0.29.2` @ `ff7e29ccd127d8d9721b5cbb2163a6407ef915fe` |

## The candidate design under test

Archived verbatim as the committed migration fixture:
`packages/drivers/pglite/test/integration/fixtures/epistemic-bitemporal-spike/20260725000000_epistemic_bitemporal_spike/migration.sql`
(the no-extension variant used by S4 sits beside it under
`.../epistemic-bitemporal-spike-noext/`).

- **Time representation:** two nullable-`BIGINT` epoch-millis pairs per axis
  (`valid_from`/`valid_to`, `recorded_at`/`expired_at`), `NULL` = open end, matching the
  repo's `persist.timestampMillis` convention. Ranges exist **only inside constraint
  expressions** as `int8range(lo, hi, '[)')` — no range column, no `customType`, drizzle
  metadata stays clean.
- **No-overlap (L1, production mechanism):**
  `EXCLUDE USING gist (logical_key WITH =, int8range(valid_from, valid_to, '[)') WITH &&)
  WHERE (expired_at IS NULL)` — needs `btree_gist` for the scalar `=`.
- **L2 portable backstop (always present):** partial unique open-head index
  `(logical_key) WHERE valid_to IS NULL AND expired_at IS NULL`, plus
  `UNIQUE (logical_key, version)`, ordered-interval CHECKs on both axes, self-FK lineage
  with a no-self CHECK, and the bounded-endpoint CHECKs/FKs (S2).
- **Canonical asOf predicate** (the shape P1's repository owns):
  `valid_from <= $v AND (valid_to IS NULL OR $v < valid_to) AND recorded_at <= $k AND
  (expired_at IS NULL OR $k < expired_at)`. "Latest" is the same predicate at now/now —
  no persisted flag anywhere in the DDL.

## Assertion evidence

Suite: `packages/drivers/pglite/test/integration/spike/EpistemicBitemporalSpike.pglite.test.ts`
— 21/21, run log [`vitest-pglite.log`](./vitest-pglite.log). External-lane counterpart in
S5's notes. Highlights, keyed to the contract:

1. **btree_gist smoke** — `btree_gist loads and a gist exclusion constraint rejects
   overlap by name`: extension loads via `@beep/pglite`
   `makeLayer({ extensions: { btree_gist } })`; adjacency `[10,20)`+`[20,30)` and a
   different key both insert green; the overlap rejects naming
   `spike_smoke_no_overlap`.
2. **Migration shape** — `candidate DDL applies through the db-admin migrate path and
   re-running is idempotent`: the fixture folder (drizzle journal-less format) is applied
   by the real `migrate()` (statement re-split by `LegacyStatementBoundary`, single
   transaction); a second `migrate()` is a no-op with exactly one
   `drizzle.__drizzle_migrations` journal row; `pg_constraint` lists all 13 expected
   `spike_edge_*` constraints and `pg_indexes` all 6 expected indexes. The migration SQL
   is flat top-level statements only — no `DO $$` blocks — per the splitter's contract.
3. **Range semantics** — `int8range half-open semantics...`: `NULL` upper behaves as
   `[a,∞)` (overlaps any later interval), adjacency is disjoint, and `tstzrange`
   (the fallback representation) answers identically. **Decision: BIGINT millis +
   expression `int8range` confirmed; `tstzrange` recorded as the tested, unneeded
   fallback.**
4. **Index plan** — `temporal indexes serve the overlap and as-of predicate shapes`:
   with `enable_seqscan = off`, EXPLAIN shows the GiST exclusion index
   (`spike_edge_no_overlap`) serving the `&&` probe and `spike_edge_asof_idx` serving
   the asOf shape.
5. **Adversarial backstops** — each violation is the last statement of its isolated
   effect and asserts the constraint NAME (PG17-vs-PG18 message-prose skew makes prose
   assertions unportable):
   ordered valid-time (`spike_edge_valid_ordered`), ordered transaction-time
   (`spike_edge_txn_ordered`), duplicate `(logical_key, version)`
   (`spike_edge_logical_version_unique`), dangling endpoint FK
   (`spike_edge_source_claim_fk`), arbitrary kind + kind/column mismatch
   (`spike_edge_source_bounded`), self-supersession
   (`spike_edge_no_self_supersede`), closed-interval overlap
   (`spike_edge_no_overlap`).
6. **asOf fixtures** —
   `retroactive correction: same validAt, two knownAt values give former and corrected
   facts`: with `validAt=1500`, `knownAt=1500` → `"100"` and `knownAt=2500` → `"150"`
   (SPEC acceptance criterion verbatim); exactly one derived open head; lineage intact;
   `valid_from` boundary instant included, the instant before excluded.
   `fact-became-false supersession closes valid-time at the invalidating valid_from`:
   the replacement history row carries `valid_to = 1800` (the invalidating fact's
   `valid_from`), NOT the ingestion instant 2200 — per the donor semantics S1 verified
   at `graphiti_core/utils/maintenance/edge_operations.py:569-570`; as-of answers at
   `(1900, 2100)`, `(1900, 2300)`, `(1500, 2300)` and both `valid_to` boundary instants
   are exact.
7. **Durable disposition** — `rejected verdict lands as a durable disposition row`: a
   `ClaimGateViolation`-shaped payload persists and reads back; the vocabulary CHECK
   (`spike_disposition_bounded`) rejects an out-of-domain member. The landing place for
   the `ClaimLifecycle.service.ts:116` rejected no-op is plain relational work.
8. **Out-of-order ingestion (S1-derived addendum, donor `edge_operations.py:820-839`)** —
   `late-arriving older fact inserts already-closed without displacing the newer open
   head`: with an existing open head `[2000,∞)`, a late-arriving older fact inserts as an
   already-closed `[1000,2000)` row (`recorded_at` = its actual late arrival, no lineage —
   nothing was superseded); both coexist under the exclusion constraint via half-open
   adjacency, the newer head stays the single open head, and as-of answers are exact:
   `"older"` inside the late window, `"newer"` after it, and empty for the late window at
   a `knownAt` before the late fact arrived. This is the case S1 flagged as
   distinguishing a real bitemporal store from append-with-tombstones. The suite (22
   tests) is green — run log [`vitest-pglite.log`](./vitest-pglite.log).

## Donor-alignment notes (S1 findings mapped to this design)

- **Unknown valid-time never defaults to -infinity** (donor skips invalidation when
  either `valid_at` is null): structurally unrepresentable here — `valid_from` is
  `NOT NULL`, so no row can enter supersession with unknown validity. The residual duty
  (require a known `validFrom` before a fact participates in supersession) transfers to
  P1's command layer.
- **Disjoint intervals are supersession no-ops** (donor `<=` boundary comparison at
  `:553-562`): matches the half-open `[)` convention; proven at the DB level by the
  adjacency fixtures (smoke test + range-semantics probes).
- **`reference_time` (donor `edges.py:280-282`)** is a third time-ish field carrying the
  producing episode's timestamp — NOT a bitemporal axis. If P1 ever wants it, it belongs
  with lineage/provenance, never as a query axis.

## Load-bearing finding for P1 — the table-kit ceiling

`EntityTable.pgTableFrom` (`packages/drivers/drizzle/src/EntityTable.models.ts:502`)
expresses only 9 storage kinds and 5 single-column index hints; drizzle-orm
1.0.0-rc.4 has **no exclusion builder and no range columns**
(`PgTableExtraConfigValue` has no exclusion member). Every constraint above therefore
enters the schema as raw SQL in the hand-authored migration — drizzle table metadata
does not know the EXCLUDE, the partial index, the CHECKs, or the FKs exist. P1 must
either extend the persist-descriptor vocabulary or ratify "raw migration SQL owns what
the kit cannot express" as a SPEC Exception Ledger entry. Drafted entry text is in
`ops/handoffs/p0-to-p1-handoff.md`.

## How to run

```sh
cd packages/drivers/pglite
npx vitest run test/integration/spike/EpistemicBitemporalSpike.pglite.test.ts
```

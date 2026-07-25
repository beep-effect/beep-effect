# P0 Spike Contract — Storage, Concurrency, and Provenance

Date opened: 2026-07-25. Phase: P0 (`ops/manifest.json` `phases[0]`). This contract is authored
before any spike runs (openclaw `p0-gauntlet-contract.md` precedent). Each spike passes only when
its assertions are demonstrated with archived evidence under `history/p0/<spike-id>/NOTES.md`;
a failed assertion records its failure signature against the SPEC stop conditions. Semantics are
LOCKED (SPEC Constraints / exploration Decision 7); this phase selects enforcement mechanisms only.

## Common rules (all spikes)

- **Isolation / damage boundary.** All spike tables use a `spike_` name prefix. PGlite lanes run
  over scoped temp `dataDir`s. The external-Postgres lane uses the disposable docker-compose
  database only. Nothing touches `packages/_internal/db-admin/drizzle/` (production migrations),
  `src/targets.ts`, desktop codegen, `AcceptedProofManifest.ts`, or any `packages/epistemic/*`
  source file. Shared `ClaimLifecycle`, `EntityTable`/`StorageKind`, and `@beep/test-utils` are
  untouched.
- **Spike code is disposable but committed.** Suite + fixtures live under
  `packages/drivers/pglite/test/integration/spike/` and
  `packages/drivers/pglite/test/integration/fixtures/epistemic-bitemporal-spike/`, marked
  `// P0 SPIKE — disposable; superseded by P1` at file top. P1 either promotes or deletes them;
  the verdict records which.
- **Pinned inputs** (record exact values in every NOTES.md): `@electric-sql/pglite` 0.5.4
  (PG 18.3 wasm), `@effect/sql-pglite` 4.0.0-beta.101, drizzle-orm `1.0.0-rc.4-de6c356`,
  compose image `pgvector/pgvector:pg17`, effect `4.0.0-beta.101`, Graphiti live SHA (from S1),
  repo branch `feat/epistemic-bitemporal-p0-spike` base `18c36b5dc5`.
- **Test discipline.** `npx vitest run` only (never `bun test`); every spike suite opts out of
  the global concurrency default with `describe(name, { concurrent: false }, ...)` (the global
  `vitest.shared.ts` sets `sequence.concurrent: true`; `describe.sequential` is deprecated by
  repo lint; the existing db-admin `describe.concurrent` files are not the precedent).
  Constraint-violation assertions are the LAST statement of their effect (PGlite
  implicit-transaction rollback chain, documented in `DocumentsSyncMigration.pglite.test.ts`).
  Assertions match **constraint names, never message prose** (PG 18.3 wasm vs PG17 compose skew).
- **Migration SQL discipline.** Flat top-level statements only — no `DO $$` blocks (the
  `LegacyStatementBoundary` splitter in `@beep/postgres` re-splits on `;\n` before keyword
  boundaries and can mangle block bodies). Applied through the real `migrate()` path.
- **Cleanup.** Scratchpad clones and temp dataDirs are session-scoped; no repo pollution.
- **Timebox.** ~1 week of the cycle. Exhaustion without a verdict is itself a stop trigger.

## S1 — Provenance/license inventory (no code; blocks porting, not prototyping)

Assertions:
1. Live `getzep/graphiti` default-branch SHA + latest tag recorded; LICENSE still Apache-2.0.
2. Root `NOTICE` file presence/absence recorded explicitly (§4(d) duty attaches only if present).
3. The three mined locations re-cited at live line ranges (drift from `edges.py:263-285`,
   `nodes.py:318-351`, `edge_operations.py:538-847` recorded as old→new).
4. Supersession gotcha captured with quoted live code: valid-time closes at the invalidating
   fact's `valid_at`; only the transaction axis stamps now.
5. `THIRD_PARTY_NOTICES.md` Graphiti entry DRAFTED in evidence (file edit deferred to P1).
6. Zero-hit proof that no donor is a runtime dependency; agentmemory deferral and SSPL/AGPL
   exclusions recorded.

Fail → stop condition: donor license changed or attribution duties undischargeable.

## S2 — Logical identity + bounded endpoint model

Assertions:
1. The no-overlap partition key is defined over source endpoint, target endpoint, relation,
   organization/matter scope, canonicalized predicate qualifiers, and evidence scope, with a
   deterministic digest `logical_key` and symmetric-relation endpoint normalization.
2. Adversarial cases enumerated and mapped to S3 fixtures: symmetric orderings collapse; distinct
   asymmetric orderings do not; qualifier permutations collapse; different matter scope or
   evidence scope partitions facts apart.
3. Bounded endpoint model: kind discriminator + per-kind columns + exactly-one CHECK; claim and
   evidence kinds carry real FKs; entity/observation kinds are typed opaque refs with FK deferred
   (recorded as a P1 design point). Arbitrary and dangling endpoints have a named rejection path.

Fail → stop condition: partition merges distinct facts or admits overlapping duplicates.

## S3 — Postgres DDL prototype + migration shape through the db-admin path

Assertions:
1. btree_gist smoke: `CREATE EXTENSION` + minimal `EXCLUDE USING gist (k WITH =, int8range(...)
   WITH &&)` works under the bespoke PGlite layer; overlap probe rejects with the constraint NAME.
2. Full candidate DDL applies through the real `migrate()` (splitter, single transaction) from the
   spike-local migrations folder; second `migrate()` is a journal no-op; constraints/indexes
   verified via `pg_constraint`/`pg_indexes` probes.
3. Range semantics: NULL upper bound behaves as unbounded `[a,∞)`; adjacent `[a,b)`+`[b,c)` do not
   violate; `tstzrange` fallback behaves identically; `EXPLAIN` shows the GiST exclusion index
   serves `&&` and the btree serves the canonical asOf predicate shape.
4. Every ratified backstop has a named-constraint adversarial rejection: ordered-interval CHECKs
   (both axes), `UNIQUE (logical_key, version)`, dangling-FK endpoint, arbitrary-kind CHECK,
   kind/column-mismatch CHECK, self-supersede CHECK, open-head partial-unique dupe,
   closed-interval EXCLUDE overlap.
5. Green path: accepted edge with full identity/lineage/both axes; durable
   `spike_claim_disposition` row for a rejected verdict.
6. asOf fixtures: retroactive correction (one `validAt`, two `knownAt`s → former vs corrected
   fact); fact-became-false supersession closes valid-time at the invalidating `valid_from`
   (S1 gotcha); derived-latest single open head; boundary instants (`valid_from` included,
   `valid_to` excluded).

Fail → engage substitution ladder (S4); only if the L2 backstop also fails semantics does the
hard gate fire.

## S4 — PGlite parity or explicit substitution + restart proof

Assertions:
1. Parity matrix (mechanism × lane × result) covering every S3 backstop on PGlite 0.5.4.
2. The L2 portable substitution (partial unique open-head index + lock rule) is prototyped and
   produces the SAME rejections on the SAME fixtures regardless of L1 availability.
3. Restart proof: migrate + write supersession chain + disposition over an explicit `dataDir`,
   close the layer scope, reopen the SAME `dataDir` fresh, re-assert both as-of answers, lineage,
   dispositions, and one live constraint rejection.
4. The `pglite-testcontainers` lane is recorded as out of scope for the extension proof
   (pins pglite 0.4.5, no extensions map) — a named substitution, not silent breakage.

Fail → stop condition: no mechanism or substitution preserves identical rejection semantics.

## S5 — Concurrent supersession determinism

Chosen rule to prove: READ COMMITTED + `SELECT ... FOR UPDATE` on the open metadata rows for the
`logical_key`, `expectedVersion` compare, metadata-only close + insert in ONE transaction.
Fallback: `pg_advisory_xact_lock(hashtextextended(logical_key, 0))`.

Assertions (pg-external lane, two real connections, latch-coordinated):
1. Race A (existing head): loser blocks on the lock, wakes after winner commits, observes the
   changed head, returns a typed conflict — not silent success, not last-writer-wins.
2. Race B (creation, nothing to lock): both insert; the open-head partial unique index rejects the
   second; loser maps to a typed conflict.
3. Race C (lock-skipping writer): the EXCLUDE constraint rejects an overlapping closed interval.
4. Post-race state: exactly one open head, single version increment, intact lineage, no partial
   writes.
5. PGlite lane proves the sequential loser-path equivalents (documented mechanism substitution —
   in-process PGlite is single-connection; true races are impossible there).

Fail → stop condition: no candidate rule yields deterministic outcomes on real Postgres.

## S6 — Cycle enforcement from evidence

Assertions:
1. Self-reference CHECK and lineage FK are present in the DDL and probed.
2. A recursive-CTE probe (query, not constraint) documents that no *simple* DB mechanism prevents
   lineage cycles; anything needing recursive triggers is an automatic "stay application-side".
3. Decision recorded: application-side prevention via the sanctioned write path (ratified
   default), with the S5 lock + version rule making cycles unconstructible through it.

## Addendum (2026-07-25) — S1-derived assertions

S1's live donor read (`edge_operations.py:538-847`) surfaced three semantics the original
S3/S5 lists did not name. Added to the contract on the day they were found:

1. **Out-of-order ingestion** (donor `:820-839`): a late-arriving OLDER fact is written
   with its valid-time already closed at the existing newer head's `valid_from`; the newer
   head is NOT displaced. New S3 fixture: `late-arriving older fact inserts already-closed
   without displacing the newer open head`.
2. **Unknown valid-time never defaults to -infinity**: the donor skips invalidation when
   either `valid_at` is null. In this design the case is structurally unrepresentable at
   the storage layer (`valid_from BIGINT NOT NULL`); the duty transfers to P1's command
   layer (no supersession without a known `validFrom`). Recorded, no DB fixture possible.
3. **Disjoint-interval no-op with `<=` boundaries** (donor `:553-562`): confirms half-open
   upper bounds; already proven by the adjacency fixtures (S3 smoke + range semantics).

## Verdict

`history/<YYYY-MM-DD>-p0-verdict.md` holds the invariant → Postgres-evidence → PGlite-evidence
matrix. Every row needs both lane pointers (mechanism or named substitution) or the verdict is
STOP-and-reshape. On PROCEED, `ops/handoffs/p0-to-p1-handoff.md` carries the P1-feeding decisions.

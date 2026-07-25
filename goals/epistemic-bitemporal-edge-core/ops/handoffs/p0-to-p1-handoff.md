# P0 → P1 Handoff

**Date:** 2026-07-25. Written on the PROCEED verdict
([`history/2026-07-25-p0-verdict.md`](../../history/2026-07-25-p0-verdict.md)).
P1 implements the vertical slice (domain → tables → use-cases → server → db-admin
migration) on the enforcement design P0 ratified. Locked semantics (SPEC Constraints /
Decision 7) are unchanged and not restated here.

## 1. Ratified enforcement design (implement exactly this)

- **Time axes:** two nullable-BIGINT epoch-millis pairs — `valid_from NOT NULL`,
  `valid_to NULL`, `recorded_at NOT NULL`, `expired_at NULL` — `NULL` = open end,
  modeled as `Option` over the repo's `persist.timestampMillis` codec convention.
  Ranges appear only inside constraint expressions: `int8range(lo, hi, '[)')`.
  (`tstzrange` is the tested fallback; not needed.)
- **Partition key:** application-computed `logical_key text NOT NULL` — sha256 of the
  canonical `v1|relation|endpoint|endpoint|org|matter|evidence|qualifiers` encoding with
  symmetric-endpoint normalization, sorted qualifier entries, and `some:`/`<none>` scope
  markers. Prototype to lift: `EpistemicBitemporalIdentity.test.ts` → a schema-first
  `LogicalEdgeIdentity` value object in `@beep/epistemic-domain`; the symmetry flag
  belongs on the relation literal domain. Component columns stay on the row.
- **Constraints (names modulo the real table prefix):** ordered-interval CHECKs both
  axes; `UNIQUE (logical_key, version)`; self-FK lineage + no-self CHECK;
  bounded-endpoint CHECKs with per-kind columns and real FKs for claim/evidence;
  `EXCLUDE USING gist (logical_key WITH =, int8range(valid_from, valid_to, '[)') WITH &&)
  WHERE (expired_at IS NULL)` after `CREATE EXTENSION IF NOT EXISTS btree_gist`;
  partial unique open-head index `(logical_key) WHERE valid_to IS NULL AND expired_at
  IS NULL` (the L2 backstop, kept unconditionally).
- **Indexes:** the GiST exclusion index (serves `&&`), btree
  `(logical_key, valid_from, recorded_at)` (serves asOf), GIN on `qualifiers`.
- **Canonical asOf predicate** (repository-owned):
  `valid_from <= $v AND (valid_to IS NULL OR $v < valid_to) AND recorded_at <= $k AND
  (expired_at IS NULL OR $k < expired_at)`; latest = same predicate at now/now.
- **Concurrency rule (proven, race-tested):** READ COMMITTED;
  `SELECT ... FOR UPDATE` on the open metadata rows for the `logical_key`;
  `expectedVersion` compare → typed `SupersessionConflict` on mismatch; metadata-only
  close `UPDATE ... SET expired_at = $now WHERE id = $head AND expired_at IS NULL`
  (idempotent guard — donor semantics); insert replacement (`version + 1`,
  `supersedes_id = head`) — all in ONE `db.transaction`. Creation race is caught by the
  open-head index; constraint violations from racing writers map to the same typed
  conflict. Advisory-lock fallback (`pg_advisory_xact_lock(hashtextextended(logical_key,
  0))`) recorded but NOT needed.
- **Supersession semantics (donor-verified):** fact-became-false closes the replacement
  history row's `valid_to` at the **invalidating fact's `valid_from`** — never `now()`;
  only the transaction axis stamps now, idempotently. Retroactive correction leaves
  valid-time alone and moves only the transaction axis. Three further donor semantics
  (S1, live `edge_operations.py`): **out-of-order ingestion** writes a late-arriving
  older fact already-closed at the newer head's `valid_from` without displacing the head
  (fixture proven); **unknown valid-time never defaults to -infinity** — no supersession
  without a known `validFrom` (structural here via `NOT NULL`; enforce in the command
  layer); **disjoint intervals are supersession no-ops** (half-open boundaries).
  Donor `reference_time` is provenance, not a time axis — if wanted, it rides with
  lineage.
- **Cycles:** application-side (S6). `supersedes_id` is immutable through the repository
  surface; the recursive-CTE detector may ship as a diagnostic query only.

## 2. Named P1 decisions (with recommendations)

1. **Table-kit ceiling — recommend "raw SQL owns it" + Exception Ledger entry.**
   `EntityTable.pgTableFrom` cannot express CHECK/FK/EXCLUDE/partial/composite
   constraints and drizzle-orm 1.0.0-rc.4 has no exclusion builder, so the migration SQL
   is authoritative for them and drizzle table metadata is knowingly lossy. Widening
   `EntitySchema.StorageKind`/`IndexHintKind` is a foundation-package change touching
   every slice's projection — out of proportion for one consumer. Drafted SPEC
   Exception Ledger row:
   > | Raw-SQL constraint ownership | `@beep/epistemic-tables` edge/disposition tables | epistemic slice | `EntityTable.pgTableFrom` and drizzle-orm 1.0.0-rc.4 cannot express CHECK/FK/EXCLUDE/partial-index constraints; the hand-authored db-admin migration owns them and table metadata is knowingly lossy for these backstops. | Remove when the persist-descriptor vocabulary (or drizzle) can express exclusion and composite constraints and the migration is regenerated from metadata. |
2. **`@beep/test-utils` extensions seam — recommend threading it in P1.** Add an
   optional `extensions` pass-through to `PgliteInProcessTestDriver` /
   `makePgliteSqlTestLayer` / `makePgliteIntegrationGate` so the real integration tests
   (not just the spike) can run the btree_gist migration under the shared harness; the
   bespoke `@beep/pglite.makeLayer` remains for restart/dataDir tests. Until then the
   spike's bypass pattern works.
3. **`ClaimDisposition` vocabulary — recommend `active | rejected | superseded`,**
   with `conflicted` left OUT until `epistemic-contradiction-triage` actually needs it
   (adding a LiteralKit member later is cheap; removing one is not). Orthogonal to
   extraction review state per Decision 5. Carries `reason`, `violations`
   (`ClaimGateViolation[]`), `resolvedAt`/`resolvedBy` audit fields.
4. **Disposition write placement — recommend a new use-case command** (compose
   ClaimGate + ClaimTransition + a disposition repository port) that closes the
   `ClaimLifecycle.service.ts:116` no-op by persisting the rejected verdict, keeping
   `ClaimTransitionShape.advance` pure and shared `ClaimLifecycle` untouched.
5. **Endpoint FKs for `entity`/`observation` kinds** stay typed opaque refs until those
   tables exist; revisit when they land. Schema-level endpoint union rejects arbitrary
   kinds regardless.
6. **Migration target** — new `DbAdminMigrationTarget` (e.g. `epistemic-edge`)
   registered in `src/targets.ts` alongside `epistemic-usage`, not an extension of it.
   `schemaName` stays the existing decorative pattern (`"epistemic"` with tables in the
   default schema) unless P1 deliberately introduces real PG schemas repo-wide.
7. **Three-place migration registration checklist** (all enforced or drift-gated):
   (a) `packages/_internal/db-admin/drizzle/<ts>_<name>/migration.sql` + target in
   `src/targets.ts`; (b) `bun run --cwd apps/professional-desktop codegen` to regenerate
   the bundled `Migrations.ts` (drift-gated by `codegen:check`); (c) the
   `AcceptedProofManifest.ts` entry. **Plus, because of `CREATE EXTENSION btree_gist`:**
   the desktop sidecar's own PGlite construction
   (`apps/professional-desktop/src/runtime/Pglite.ts`) must register
   `extensions: { btree_gist }` or the bundled migration fails at boot — a production
   code change, not a test change. Managed-production Postgres needs `CREATE EXTENSION`
   allow-listing named as an operator prerequisite.
8. **Migration SQL + test discipline:** flat top-level statements only (the
   `LegacyStatementBoundary` splitter mis-splits `DO $$` bodies); assert constraint
   NAMES in tests (PG 17 vs 18 prose skew); `describe(name, { concurrent: false }, ...)`
   on PGlite suites (`describe.sequential` is lint-deprecated); the TestClock swallows
   `Effect.sleep` under `layer()` testers — use `SELECT pg_sleep(...)` for race
   choreography (DB-side timer, holds the lock); read lane-selector env via a Config
   boot snapshot, never `process.env`.
9. **Spike disposal:** P1 promotes the fixture DDL into the real generated migration
   and real tests, then DELETES `test/integration/spike/` and both fixture folders in
   the same PR. The three db-admin devDependencies added for the spike
   (`@beep/pglite`, `@electric-sql/pglite`, `@effect/platform-node`) stay if the real
   integration tests keep using them (expected), else revert.

## 3. Provenance duties (from S1 — discharge in P1 with the ported material)

- Land the drafted Graphiti section into root `THIRD_PARTY_NOTICES.md` — full text in
  [`history/p0/s1-provenance/NOTES.md`](../../history/p0/s1-provenance/NOTES.md)
  § "Drafted THIRD_PARTY_NOTICES.md section". Pin: tag `v0.29.2`, commit
  `ff7e29ccd127d8d9721b5cbb2163a6407ef915fe`; copyright line
  "Copyright 2024, 2025 Zep Software, Inc.". No upstream NOTICE file exists → §4(d)
  does not attach; §4(a)/(b)/(c) discharge via the notices entry + modified-file marking
  plan (each ported beep file carries a derivation header). **§4(a) nuance (S1):** the
  donor's LICENSE deviates from canonical ASF text by one §6 trademark clause — vendor
  the DONOR'S OWN LICENSE bytes (e.g. `licenses/Apache-2.0.txt`), not a fresh apache.org
  download; we redistribute under the copy the grant was made under.
- No donor runtime dependency. Cite S1's **dependency-field-scoped** proof (every
  dependency field across all non-node_modules manifests + bun.lock = zero entries) —
  NOT a naive `rg -i graphiti` over package.json, which hits our own local
  `graphiti:proxy`/CLI tooling names. Agentmemory deferred (deliberately NO notices
  entry until a retention goal adopts its algorithm); FalkorDB (SSPL) and mike (AGPL)
  remain excluded.

## 4. Not P0, do not forget

- The **Graphiti retirement record** is P1/P3: a dated entry in
  `standards/memory-architecture/04-decision-log.md` plus the drafted-cleanup surfaces
  in `docs/agent-memory-infra/00-recommendation.md` § "Drafted cleanup (NOT applied)"
  (CLAUDE.md/AGENTS.md line, `.mcp.json`, hooks, skill deprecation) — recorded only when
  the port milestone actually lands, never coupling product tables to operator memory.
- Shared `ClaimLifecycle` stays untouched; contradiction triage stays queued
  (Deferred spike B belongs to `epistemic-contradiction-triage`).

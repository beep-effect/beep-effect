// P0 SPIKE — disposable; superseded by P1.
// goals/epistemic-bitemporal-edge-core, phase P0 (ops/handoffs/p0-spike-contract.md).
// Proves the bitemporal storage design (S3), PGlite parity + substitution + restart (S4),
// the sequential loser paths of the concurrency rule (S5), and the cycle probe (S6)
// against the ratified invariants. Constraint assertions match names, never message prose.
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import * as Pglite from "@beep/pglite";
import { makeDrizzle, migrate } from "@beep/postgres";
import { A } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const gistMigrationsFolder = fileURLToPath(new URL("../fixtures/epistemic-bitemporal-spike", import.meta.url));
const noextMigrationsFolder = fileURLToPath(new URL("../fixtures/epistemic-bitemporal-spike-noext", import.meta.url));
const migrationsSchema = "drizzle";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const makeGistLayer = () => Pglite.makeLayer({ extensions: { btree_gist }, relaxedDurability: true });
const makeNoextLayer = () => Pglite.makeLayer({ relaxedDurability: true });
const makePersistentGistLayer = (dataDir: string) =>
  Pglite.makeLayer({ dataDir, extensions: { btree_gist }, relaxedDurability: true });

const TempDirServices = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const migrateSpike = Effect.fnUntraced(function* (migrationsFolder: string) {
  const db = yield* makeDrizzle();
  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const currentSql = Effect.map(Effect.service(SqlClient.SqlClient), (client) => client.withoutTransforms());

const seedClaims = Effect.fnUntraced(function* () {
  const sql = yield* currentSql;
  yield* sql`
    INSERT INTO spike_claim (id, payload)
    VALUES (1, '{"fixtureKey":"claim.alpha"}'::jsonb), (2, '{"fixtureKey":"claim.beta"}'::jsonb)
  `;
});

describe("EpistemicBitemporalSpike (PGlite)", { concurrent: false }, () => {
  // S3 assertion 1 — cheapest refutation of the dominant unknown: does the PGlite wasm
  // build load btree_gist and enforce a mixed scalar+range gist exclusion constraint?
  it.effect(
    "btree_gist loads and a gist exclusion constraint rejects overlap by name",
    Effect.fnUntraced(function* () {
      const sql = yield* currentSql;
      yield* sql`CREATE EXTENSION IF NOT EXISTS btree_gist`;
      yield* sql`
          CREATE TABLE spike_smoke (
            k TEXT NOT NULL,
            a BIGINT NOT NULL,
            b BIGINT,
            CONSTRAINT spike_smoke_no_overlap EXCLUDE USING gist (
              k WITH =,
              int8range(a, b, '[)') WITH &&
            )
          )
        `;
      yield* sql`INSERT INTO spike_smoke (k, a, b) VALUES ('k1', 10, 20)`;
      yield* sql`INSERT INTO spike_smoke (k, a, b) VALUES ('k1', 20, 30)`;
      yield* sql`INSERT INTO spike_smoke (k, a, b) VALUES ('k2', 15, 25)`;
      const violation = yield* Effect.flip(sql`INSERT INTO spike_smoke (k, a, b) VALUES ('k1', 15, 25)`);
      expect(inspect(violation, { depth: 10 })).toContain("spike_smoke_no_overlap");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 assertion 2 — the full candidate DDL applies through the real repo-owned
  // migrate() path (LegacyStatementBoundary splitter, single transaction) and re-running
  // is a journal no-op; constraints and indexes are present in the catalogs.
  it.effect(
    "candidate DDL applies through the db-admin migrate path and re-running is idempotent",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* migrateSpike(gistMigrationsFolder);
      const sql = yield* currentSql;
      const constraints = yield* sql<{ readonly conname: string }>`
          SELECT conname
          FROM pg_constraint
          WHERE conname LIKE 'spike_edge_%' AND contype IN ('c', 'f', 'p', 'u', 'x')
          ORDER BY conname ASC
        `;
      expect(
        pipe(
          constraints,
          A.map((row) => row.conname)
        )
      ).toEqual([
        "spike_edge_logical_version_unique",
        "spike_edge_no_overlap",
        "spike_edge_no_self_supersede",
        "spike_edge_source_bounded",
        "spike_edge_source_claim_fk",
        "spike_edge_source_evidence_fk",
        "spike_edge_supersedes_fk",
        "spike_edge_target_bounded",
        "spike_edge_target_claim_fk",
        "spike_edge_target_evidence_fk",
        "spike_edge_txn_ordered",
        "spike_edge_valid_ordered",
        "spike_edge_version_pkey",
      ]);
      const indexes = yield* sql<{ readonly indexname: string }>`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'spike_edge_version'
          ORDER BY indexname ASC
        `;
      expect(
        pipe(
          indexes,
          A.map((row) => row.indexname)
        )
      ).toEqual([
        "spike_edge_asof_idx",
        "spike_edge_logical_version_unique",
        "spike_edge_no_overlap",
        "spike_edge_open_head_idx",
        "spike_edge_qualifiers_gin_idx",
        "spike_edge_version_pkey",
      ]);
      const journal = yield* sql<{ readonly n: number }>`
          SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations
        `;
      expect(
        pipe(
          journal,
          A.map((row) => row.n)
        )
      ).toEqual([1]);
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 assertion 3 — half-open range semantics: a NULL upper bound is unbounded, adjacent
  // half-open intervals do not overlap, and tstzrange (the fallback representation)
  // behaves identically.
  it.effect(
    "int8range half-open semantics: NULL upper unbounded, adjacency disjoint, tstzrange parity",
    Effect.fnUntraced(function* () {
      const sql = yield* currentSql;
      const rows = yield* sql<{
        readonly unbounded_overlaps: string;
        readonly adjacent_overlaps: string;
        readonly tstz_unbounded: string;
        readonly tstz_adjacent: string;
      }>`
          SELECT
            (int8range(10, NULL, '[)') && int8range(1000, 2000, '[)'))::text AS unbounded_overlaps,
            (int8range(10, 20, '[)') && int8range(20, 30, '[)'))::text AS adjacent_overlaps,
            (tstzrange(to_timestamp(1), NULL, '[)') && tstzrange(to_timestamp(1000), to_timestamp(2000), '[)'))::text
              AS tstz_unbounded,
            (tstzrange(to_timestamp(10), to_timestamp(20), '[)') && tstzrange(to_timestamp(20), to_timestamp(30), '[)'))::text
              AS tstz_adjacent
        `;
      expect(rows).toEqual([
        {
          adjacent_overlaps: "false",
          tstz_adjacent: "false",
          tstz_unbounded: "true",
          unbounded_overlaps: "true",
        },
      ]);
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 assertion 3 (index plan) — the gist exclusion index serves the overlap probe and
  // the btree serves the canonical asOf predicate shape.
  it.effect(
    "temporal indexes serve the overlap and as-of predicate shapes",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-plan', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"amount":"100"}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `;
      yield* sql`SET enable_seqscan = off`;
      const overlapPlan = yield* sql<{ readonly "QUERY PLAN": string }>`
          EXPLAIN SELECT id FROM spike_edge_version
          WHERE logical_key = 'lk-plan'
            AND expired_at IS NULL
            AND int8range(valid_from, valid_to, '[)') && int8range(1500, 1600, '[)')
        `;
      const asofPlan = yield* sql<{ readonly "QUERY PLAN": string }>`
          EXPLAIN SELECT id FROM spike_edge_version
          WHERE logical_key = 'lk-plan' AND valid_from <= 1500 AND recorded_at <= 1500
        `;
      const overlapText = pipe(
        overlapPlan,
        A.map((row) => row["QUERY PLAN"]),
        A.join("\n")
      );
      const asofText = pipe(
        asofPlan,
        A.map((row) => row["QUERY PLAN"]),
        A.join("\n")
      );
      expect(overlapText).toContain("spike_edge_no_overlap");
      expect(asofText).toContain("spike_edge_asof_idx");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 assertion 4 — per-backstop adversarial probes. Each violation is the LAST
  // statement of its own isolated effect (PGlite implicit-transaction rollback chain).
  it.effect(
    "ordered valid-time interval CHECK rejects inverted bounds",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-a', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 2000, 1000, 1000, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_valid_ordered");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  it.effect(
    "ordered transaction-time interval CHECK rejects inverted bounds",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-b', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, NULL, 2000, 1000
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_txn_ordered");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  it.effect(
    "unique logical-version identity rejects a duplicate (logical_key, version)",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-c', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, 2000, 1000, 1500
          )
        `;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-c', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 3000, 4000, 3000, 3500
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_logical_version_unique");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  it.effect(
    "dangling claim endpoint is rejected by the endpoint foreign key",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-d', 'claim', 999, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_source_claim_fk");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  it.effect(
    "arbitrary endpoint kind is rejected by the bounded-endpoint CHECK",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_entity_ref, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-e', 'banana', 'entity:iri', 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_source_bounded");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  it.effect(
    "endpoint kind/column mismatch is rejected by the bounded-endpoint CHECK",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_entity_ref, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-f', 'claim', 'entity:iri', 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_source_bounded");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  it.effect(
    "self-supersession is rejected by CHECK",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, supersedes_id,
            valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            42, 'lk-g', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 42, 1000, NULL, 1000, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_no_self_supersede");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  it.effect(
    "closed-interval overlap among authoritative versions is rejected by the exclusion constraint",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-h', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, 2000, 1000, NULL
          )
        `;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-h', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 2, 1500, 2500, 1200, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_no_overlap");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 assertion 6 — retroactive correction: same validAt, two knownAt values return the
  // former and the corrected fact (SPEC acceptance criterion), latest is derived from
  // open intervals, and the valid_from boundary instant is included.
  it.effect(
    "retroactive correction: same validAt, two knownAt values give former and corrected facts",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-corr', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"amount":"100"}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `;
      yield* sql`UPDATE spike_edge_version SET expired_at = 2000 WHERE id = 1`;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, supersedes_id,
            valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-corr', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"amount":"150"}'::jsonb, 2, 1,
            1000, NULL, 2000, NULL
          )
        `;
      const before = yield* sql<{ readonly amount: string }>`
          SELECT fact->>'amount' AS amount FROM spike_edge_version
          WHERE logical_key = 'lk-corr'
            AND valid_from <= 1500 AND (valid_to IS NULL OR 1500 < valid_to)
            AND recorded_at <= 1500 AND (expired_at IS NULL OR 1500 < expired_at)
        `;
      const after = yield* sql<{ readonly amount: string }>`
          SELECT fact->>'amount' AS amount FROM spike_edge_version
          WHERE logical_key = 'lk-corr'
            AND valid_from <= 1500 AND (valid_to IS NULL OR 1500 < valid_to)
            AND recorded_at <= 2500 AND (expired_at IS NULL OR 2500 < expired_at)
        `;
      const atValidFrom = yield* sql<{ readonly amount: string }>`
          SELECT fact->>'amount' AS amount FROM spike_edge_version
          WHERE logical_key = 'lk-corr'
            AND valid_from <= 1000 AND (valid_to IS NULL OR 1000 < valid_to)
            AND recorded_at <= 1000 AND (expired_at IS NULL OR 1000 < expired_at)
        `;
      const beforeValidFrom = yield* sql<{ readonly amount: string }>`
          SELECT fact->>'amount' AS amount FROM spike_edge_version
          WHERE logical_key = 'lk-corr'
            AND valid_from <= 999 AND (valid_to IS NULL OR 999 < valid_to)
            AND recorded_at <= 2500 AND (expired_at IS NULL OR 2500 < expired_at)
        `;
      const openHeads = yield* sql<{ readonly n: number }>`
          SELECT COUNT(*)::int AS n FROM spike_edge_version
          WHERE logical_key = 'lk-corr' AND valid_to IS NULL AND expired_at IS NULL
        `;
      const lineage = yield* sql<{ readonly supersedes_id: number }>`
          SELECT supersedes_id FROM spike_edge_version WHERE id = 2
        `;
      expect(
        pipe(
          before,
          A.map((row) => row.amount)
        )
      ).toEqual(["100"]);
      expect(
        pipe(
          after,
          A.map((row) => row.amount)
        )
      ).toEqual(["150"]);
      expect(
        pipe(
          atValidFrom,
          A.map((row) => row.amount)
        )
      ).toEqual(["100"]);
      expect(beforeValidFrom).toEqual([]);
      expect(
        pipe(
          openHeads,
          A.map((row) => row.n)
        )
      ).toEqual([1]);
      expect(
        pipe(
          lineage,
          A.map((row) => row.supersedes_id)
        )
      ).toEqual([1]);
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 assertion 6 (donor semantics) — fact-became-false supersession closes the
  // valid-time axis at the invalidating fact's valid_from, NOT at the ingestion instant;
  // only the transaction axis moves to "now". The valid_to boundary instant is excluded.
  it.effect(
    "fact-became-false supersession closes valid-time at the invalidating valid_from",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-false', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"state":"employed"}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `;
      yield* sql`UPDATE spike_edge_version SET expired_at = 2200 WHERE id = 1`;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, supersedes_id,
            valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-false', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"state":"employed"}'::jsonb, 2, 1,
            1000, 1800, 2200, NULL
          )
        `;
      const knownBefore = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-false'
            AND valid_from <= 1900 AND (valid_to IS NULL OR 1900 < valid_to)
            AND recorded_at <= 2100 AND (expired_at IS NULL OR 2100 < expired_at)
        `;
      const knownAfter = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-false'
            AND valid_from <= 1900 AND (valid_to IS NULL OR 1900 < valid_to)
            AND recorded_at <= 2300 AND (expired_at IS NULL OR 2300 < expired_at)
        `;
      const earlierValid = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-false'
            AND valid_from <= 1500 AND (valid_to IS NULL OR 1500 < valid_to)
            AND recorded_at <= 2300 AND (expired_at IS NULL OR 2300 < expired_at)
        `;
      const atValidTo = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-false'
            AND valid_from <= 1800 AND (valid_to IS NULL OR 1800 < valid_to)
            AND recorded_at <= 2300 AND (expired_at IS NULL OR 2300 < expired_at)
        `;
      const justBeforeValidTo = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-false'
            AND valid_from <= 1799 AND (valid_to IS NULL OR 1799 < valid_to)
            AND recorded_at <= 2300 AND (expired_at IS NULL OR 2300 < expired_at)
        `;
      expect(
        pipe(
          knownBefore,
          A.map((row) => row.state)
        )
      ).toEqual(["employed"]);
      expect(knownAfter).toEqual([]);
      expect(
        pipe(
          earlierValid,
          A.map((row) => row.state)
        )
      ).toEqual(["employed"]);
      expect(atValidTo).toEqual([]);
      expect(
        pipe(
          justBeforeValidTo,
          A.map((row) => row.state)
        )
      ).toEqual(["employed"]);
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 addendum (S1 finding, donor edge_operations.py:820-839) — out-of-order ingestion:
  // a late-arriving OLDER fact inserts with its valid-time already closed at the existing
  // newer head's valid_from, coexists under the exclusion constraint (half-open adjacency),
  // and does NOT displace the newer open head. Append-with-tombstones cannot represent this.
  it.effect(
    "late-arriving older fact inserts already-closed without displacing the newer open head",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-late', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"state":"newer"}'::jsonb, 1, 2000, NULL, 2000, NULL
          )
        `;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-late', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"state":"older"}'::jsonb, 2, 1000, 2000, 2500, NULL
          )
        `;
      const openHead = yield* sql<{ readonly version: number }>`
          SELECT version FROM spike_edge_version
          WHERE logical_key = 'lk-late' AND valid_to IS NULL AND expired_at IS NULL
        `;
      const olderWindow = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-late'
            AND valid_from <= 1500 AND (valid_to IS NULL OR 1500 < valid_to)
            AND recorded_at <= 3000 AND (expired_at IS NULL OR 3000 < expired_at)
        `;
      const newerWindow = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-late'
            AND valid_from <= 2500 AND (valid_to IS NULL OR 2500 < valid_to)
            AND recorded_at <= 3000 AND (expired_at IS NULL OR 3000 < expired_at)
        `;
      const beforeLateArrival = yield* sql<{ readonly state: string }>`
          SELECT fact->>'state' AS state FROM spike_edge_version
          WHERE logical_key = 'lk-late'
            AND valid_from <= 1500 AND (valid_to IS NULL OR 1500 < valid_to)
            AND recorded_at <= 2200 AND (expired_at IS NULL OR 2200 < expired_at)
        `;
      expect(
        pipe(
          openHead,
          A.map((row) => row.version)
        )
      ).toEqual([1]);
      expect(
        pipe(
          olderWindow,
          A.map((row) => row.state)
        )
      ).toEqual(["older"]);
      expect(
        pipe(
          newerWindow,
          A.map((row) => row.state)
        )
      ).toEqual(["newer"]);
      expect(beforeLateArrival).toEqual([]);
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S3 assertion 5 — a rejected gate verdict has a durable, plain-relational landing
  // place (closing the ClaimLifecycle.service.ts rejected no-op gap in P1).
  it.effect(
    "rejected verdict lands as a durable disposition row",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_claim_disposition (claim_id, disposition, reason, violations, resolved_at)
          VALUES (
            1, 'rejected', 'shape violations from claim gate',
            '[{"focusNode":"claim.alpha","path":"snapshot.amount","message":"missing required amount","severity":"violation"}]'::jsonb,
            1500
          )
        `;
      const rows = yield* sql<{ readonly disposition: string; readonly message: string }>`
          SELECT disposition, violations->0->>'message' AS message
          FROM spike_claim_disposition
          WHERE claim_id = 1
        `;
      expect(rows).toEqual([{ disposition: "rejected", message: "missing required amount" }]);
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_claim_disposition (claim_id, disposition, reason, violations, resolved_at)
          VALUES (1, 'exploded', 'invalid vocabulary member', '[]'::jsonb, 1500)
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_disposition_bounded");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S4 assertion 2 — L2 portable substitution lane: the DDL minus extension/EXCLUDE
  // applies on a bare PGlite, and the partial unique open-head index rejects a second
  // open authoritative head for the same logical key.
  it.effect(
    "no-extension lane: bare DDL applies and the open-head partial unique index rejects by name",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(noextMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-l2', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-l2', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 2, 3000, NULL, 3000, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_open_head_idx");
    }, provideScopedLayer(makeNoextLayer())),
    120_000
  );

  // S4 assertion 2 (residual, documented honestly) — without the exclusion constraint the
  // DB does NOT reject overlapping CLOSED intervals; that residual belongs to the locked
  // write path (S5 rule). This green probe records the residual for the parity matrix.
  it.effect(
    "no-extension lane residual: closed-interval overlap is not rejected at DB level",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(noextMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-resid', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, 2000, 1000, NULL
          )
        `;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-resid', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 2, 1500, 2500, 1200, NULL
          )
        `;
      const rows = yield* sql<{ readonly n: number }>`
          SELECT COUNT(*)::int AS n FROM spike_edge_version WHERE logical_key = 'lk-resid'
        `;
      expect(
        pipe(
          rows,
          A.map((row) => row.n)
        )
      ).toEqual([2]);
    }, provideScopedLayer(makeNoextLayer())),
    120_000
  );

  // S5 (PGlite sequential half) — the loser path of the supersession rule: a writer whose
  // expectedVersion is stale closes zero rows and must abort without inserting.
  it.effect(
    "sequential supersession loser: stale expectedVersion closes zero rows and aborts",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-race', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"amount":"100"}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `;
      yield* sql`UPDATE spike_edge_version SET expired_at = 2000 WHERE id = 1`;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, supersedes_id,
            valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-race', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{"amount":"150"}'::jsonb, 2, 1,
            1000, NULL, 2000, NULL
          )
        `;
      const loserClose = yield* sql<{ readonly id: number }>`
          UPDATE spike_edge_version SET expired_at = 2100
          WHERE logical_key = 'lk-race' AND version = 1 AND expired_at IS NULL
          RETURNING id
        `;
      const versions = yield* sql<{ readonly n: number }>`
          SELECT COUNT(*)::int AS n FROM spike_edge_version WHERE logical_key = 'lk-race'
        `;
      const openHead = yield* sql<{ readonly version: number }>`
          SELECT version FROM spike_edge_version
          WHERE logical_key = 'lk-race' AND valid_to IS NULL AND expired_at IS NULL
        `;
      expect(loserClose).toEqual([]);
      expect(
        pipe(
          versions,
          A.map((row) => row.n)
        )
      ).toEqual([2]);
      expect(
        pipe(
          openHead,
          A.map((row) => row.version)
        )
      ).toEqual([2]);
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S5 (PGlite sequential half) — the creation race loser: a second open head for the
  // same logical key is rejected by a DB backstop even when nothing existed to lock.
  it.effect(
    "sequential creation race loser: second open head is rejected by a spike_edge backstop",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            1, 'lk-create', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, NULL, 1000, NULL
          )
        `;
      const violation = yield* Effect.flip(sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            2, 'lk-create', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 2, 1500, NULL, 1500, NULL
          )
        `);
      expect(inspect(violation, { depth: 10 })).toContain("spike_edge_");
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S6 — cycle probe: the DB accepts a constructed supersession cycle (no simple DB
  // mechanism prevents it); a recursive CTE detects it as a query, so cycle prevention
  // stays application-side per the ratified default.
  it.effect(
    "cycle probe: DB accepts a constructed supersession cycle; recursive CTE detects it",
    Effect.fnUntraced(function* () {
      yield* migrateSpike(gistMigrationsFolder);
      yield* seedClaims();
      const sql = yield* currentSql;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            21, 'lk-cycle', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, 2000, 1000, 1500
          )
        `;
      yield* sql`
          INSERT INTO spike_edge_version (
            id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
            relation, org_scope, qualifiers, fact, version, supersedes_id,
            valid_from, valid_to, recorded_at, expired_at
          ) VALUES (
            22, 'lk-cycle', 'claim', 1, 'claim', 2,
            'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 2, 21, 1000, 2000, 1500, 1800
          )
        `;
      yield* sql`UPDATE spike_edge_version SET supersedes_id = 22 WHERE id = 21`;
      const cycles = yield* sql<{ readonly n: number }>`
          WITH RECURSIVE chain AS (
            SELECT id, supersedes_id, ARRAY[id] AS path, false AS is_cycle
            FROM spike_edge_version WHERE id = 22
            UNION ALL
            SELECT e.id, e.supersedes_id, chain.path || e.id, e.id = ANY(chain.path)
            FROM spike_edge_version e
            JOIN chain ON e.id = chain.supersedes_id
            WHERE NOT chain.is_cycle
          )
          SELECT COUNT(*)::int AS n FROM chain WHERE is_cycle
        `;
      expect(
        pipe(
          cycles,
          A.map((row) => row.n)
        )
      ).toEqual([1]);
    }, provideScopedLayer(makeGistLayer())),
    120_000
  );

  // S4 assertion 3 — restart proof: history, lineage, dispositions, both as-of answers,
  // and live constraint enforcement survive closing and reopening the same dataDir.
  it.effect(
    "restart proof: history, lineage, dispositions, as-of answers, and constraints survive reopen",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-epistemic-spike-" });
      const dataDir = path.join(tempDir, "pgdata");

      yield* Effect.gen(function* () {
        yield* migrateSpike(gistMigrationsFolder);
        yield* seedClaims();
        const sql = yield* currentSql;
        yield* sql`
            INSERT INTO spike_edge_version (
              id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
              relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
            ) VALUES (
              1, 'lk-corr', 'claim', 1, 'claim', 2,
              'supports', 'org-1', '{}'::jsonb, '{"amount":"100"}'::jsonb, 1, 1000, NULL, 1000, NULL
            )
          `;
        yield* sql`UPDATE spike_edge_version SET expired_at = 2000 WHERE id = 1`;
        yield* sql`
            INSERT INTO spike_edge_version (
              id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
              relation, org_scope, qualifiers, fact, version, supersedes_id,
              valid_from, valid_to, recorded_at, expired_at
            ) VALUES (
              2, 'lk-corr', 'claim', 1, 'claim', 2,
              'supports', 'org-1', '{}'::jsonb, '{"amount":"150"}'::jsonb, 2, 1,
              1000, NULL, 2000, NULL
            )
          `;
        yield* sql`
            INSERT INTO spike_claim_disposition (claim_id, disposition, reason, violations, resolved_at)
            VALUES (1, 'rejected', 'shape violations', '[]'::jsonb, 1500)
          `;
      }).pipe(provideScopedLayer(makePersistentGistLayer(dataDir)));

      yield* Effect.gen(function* () {
        const sql = yield* currentSql;
        const before = yield* sql<{ readonly amount: string }>`
            SELECT fact->>'amount' AS amount FROM spike_edge_version
            WHERE logical_key = 'lk-corr'
              AND valid_from <= 1500 AND (valid_to IS NULL OR 1500 < valid_to)
              AND recorded_at <= 1500 AND (expired_at IS NULL OR 1500 < expired_at)
          `;
        const after = yield* sql<{ readonly amount: string }>`
            SELECT fact->>'amount' AS amount FROM spike_edge_version
            WHERE logical_key = 'lk-corr'
              AND valid_from <= 1500 AND (valid_to IS NULL OR 1500 < valid_to)
              AND recorded_at <= 2500 AND (expired_at IS NULL OR 2500 < expired_at)
          `;
        const lineage = yield* sql<{ readonly supersedes_id: number }>`
            SELECT supersedes_id FROM spike_edge_version WHERE id = 2
          `;
        const dispositions = yield* sql<{ readonly disposition: string }>`
            SELECT disposition FROM spike_claim_disposition WHERE claim_id = 1
          `;
        expect(
          pipe(
            before,
            A.map((row) => row.amount)
          )
        ).toEqual(["100"]);
        expect(
          pipe(
            after,
            A.map((row) => row.amount)
          )
        ).toEqual(["150"]);
        expect(
          pipe(
            lineage,
            A.map((row) => row.supersedes_id)
          )
        ).toEqual([1]);
        expect(
          pipe(
            dispositions,
            A.map((row) => row.disposition)
          )
        ).toEqual(["rejected"]);
        const violation = yield* Effect.flip(sql`
            INSERT INTO spike_edge_version (
              id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
              relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
            ) VALUES (
              3, 'lk-corr', 'claim', 1, 'claim', 2,
              'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 3, 1200, 1400, 2600, NULL
            )
          `);
        expect(inspect(violation, { depth: 10 })).toContain("spike_edge_no_overlap");
      }).pipe(provideScopedLayer(makePersistentGistLayer(dataDir)));
    }, provideScopedLayer(TempDirServices)),
    180_000
  );
});

// P0 SPIKE — disposable; superseded by P1.
// goals/epistemic-bitemporal-edge-core, phase P0 (ops/handoffs/p0-spike-contract.md).
// External-Postgres lane: proves the production no-overlap mechanism on a real server and
// the S5 concurrent-supersession determinism with two genuinely parallel connections.
// Opt-in via the spike-dedicated BEEP_SPIKE_PG_URL (NOT the shared BEEP_TEST_DATABASE_URL:
// the repo's integration lane exports that pointing at a single-connection pglite-socket
// server with no btree_gist, which can neither load the extension nor race):
//   docker run -d --name beep-spike-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 pgvector/pgvector:pg17
//   BEEP_SPIKE_PG_URL=postgres://postgres:postgres@localhost:55432/postgres npx vitest run test/integration/spike
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { makeDrizzle, migrate } from "@beep/postgres";
import { A } from "@beep/utils";
import * as PgClient from "@effect/sql-pg/PgClient";
import { describe, expect, layer } from "@effect/vitest";
import { Config, Deferred, Effect, pipe, Redacted } from "effect";
import * as O from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Config-based boot snapshot of the lane selector, per the makePgliteIntegrationGate
// precedent (Node-safe, law-clean; the operator exports the variable before the process
// starts). Spike-dedicated variable so shared harness lanes never opt this suite in.
const externalUrl = pipe(
  Effect.runSync(Config.option(Config.string("BEEP_SPIKE_PG_URL"))),
  O.getOrElse(() => "")
);
const gistMigrationsFolder = fileURLToPath(new URL("../fixtures/epistemic-bitemporal-spike", import.meta.url));
const migrationsSchema = "epistemic_spike_journal";

const makeExternalLayer = () =>
  PgClient.layerFrom(
    PgClient.make({
      maxConnections: 4,
      url: Redacted.make(externalUrl),
    })
  );

const currentSql = Effect.map(Effect.service(SqlClient.SqlClient), (client) => client.withoutTransforms());

const insertOpenHead = Effect.fnUntraced(function* (
  logicalKey: string,
  id: number,
  version: number,
  validFrom: number
) {
  const sql = yield* currentSql;
  yield* sql`
    INSERT INTO spike_edge_version (
      id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
      relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
    ) VALUES (
      ${id}, ${logicalKey}, 'claim', 1, 'claim', 2,
      'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, ${version}, ${validFrom}, NULL, ${validFrom}, NULL
    )
  `;
});

if (externalUrl.length === 0) {
  describe.skip("EpistemicBitemporalSpike (external Postgres) — BEEP_SPIKE_PG_URL not set", () => {});
} else {
  describe("EpistemicBitemporalSpike (external Postgres)", { concurrent: false }, () => {
    layer(makeExternalLayer(), { timeout: "2 minutes" })((it) => {
      // S3 external half — the production mechanism: btree_gist extension, candidate DDL
      // through the real migrate() path, and the exclusion constraint on a real server.
      it.effect(
        "resets, migrates the candidate DDL, and the exclusion constraint enforces on real Postgres",
        Effect.fnUntraced(function* () {
          const sql = yield* currentSql;
          yield* sql`DROP TABLE IF EXISTS spike_claim_disposition, spike_edge_version, spike_evidence, spike_claim CASCADE`;
          yield* sql`DROP SCHEMA IF EXISTS epistemic_spike_journal CASCADE`;
          const db = yield* makeDrizzle();
          yield* migrate(db, { migrationsFolder: gistMigrationsFolder, migrationsSchema });
          yield* sql`
            INSERT INTO spike_claim (id, payload)
            VALUES (1, '{"fixtureKey":"claim.alpha"}'::jsonb), (2, '{"fixtureKey":"claim.beta"}'::jsonb)
          `;
          const constraints = yield* sql<{ readonly conname: string }>`
            SELECT conname
            FROM pg_constraint
            WHERE conname IN ('spike_edge_no_overlap', 'spike_edge_logical_version_unique', 'spike_edge_valid_ordered')
            ORDER BY conname ASC
          `;
          expect(
            pipe(
              constraints,
              A.map((row) => row.conname)
            )
          ).toEqual(["spike_edge_logical_version_unique", "spike_edge_no_overlap", "spike_edge_valid_ordered"]);
          yield* insertOpenHead("lk-pg-smoke", 1, 1, 1000);
          const violation = yield* Effect.flip(insertOpenHead("lk-pg-smoke", 2, 2, 1500));
          expect(inspect(violation, { depth: 10 })).toContain("spike_edge_no_overlap");
        }),
        120_000
      );

      // S5 Race A — two superseders over the same open head on separate connections.
      // The loser blocks on FOR UPDATE, wakes after the winner commits, re-evaluates the
      // predicate (READ COMMITTED EvalPlanQual), observes no open head, and aborts with a
      // typed conflict. Deterministic: exactly one new head, one version increment,
      // intact lineage, no partial write.
      it.effect(
        "race A: concurrent supersession is deterministic — loser observes no open head and aborts",
        Effect.fnUntraced(function* () {
          const sql = yield* currentSql;
          yield* insertOpenHead("lk-ra", 11, 1, 1000);
          const winnerLocked = yield* Deferred.make<void>();
          const loserStarting = yield* Deferred.make<void>();

          const winner = sql.withTransaction(
            Effect.gen(function* () {
              const head = yield* sql<{ readonly id: number; readonly version: number }>`
                SELECT id, version FROM spike_edge_version
                WHERE logical_key = 'lk-ra' AND expired_at IS NULL
                FOR UPDATE
              `;
              yield* Deferred.succeed(winnerLocked, undefined);
              yield* Deferred.await(loserStarting);
              // Real-time delay so the loser is parked inside its blocking FOR UPDATE before
              // the winner closes and commits. The database is the timer: Effect.sleep would
              // hang here (layer() testers run under the TestClock), and pg_sleep also keeps
              // the row lock held for the full delay on the winner's own connection.
              yield* sql`SELECT pg_sleep(0.25)`;
              yield* sql`UPDATE spike_edge_version SET expired_at = 2000 WHERE id = 11 AND expired_at IS NULL`;
              yield* sql`
                INSERT INTO spike_edge_version (
                  id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
                  relation, org_scope, qualifiers, fact, version, supersedes_id,
                  valid_from, valid_to, recorded_at, expired_at
                ) VALUES (
                  12, 'lk-ra', 'claim', 1, 'claim', 2,
                  'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 2, 11,
                  1000, NULL, 2000, NULL
                )
              `;
              return head;
            })
          );

          const loser = sql.withTransaction(
            Effect.gen(function* () {
              yield* Deferred.await(winnerLocked);
              yield* Deferred.succeed(loserStarting, undefined);
              return yield* sql<{ readonly id: number; readonly version: number }>`
                SELECT id, version FROM spike_edge_version
                WHERE logical_key = 'lk-ra' AND expired_at IS NULL
                FOR UPDATE
              `;
            })
          );

          const results = yield* Effect.all([winner, loser], { concurrency: "unbounded" });
          const winnerHead = results[0];
          const loserHead = results[1];

          expect(
            pipe(
              winnerHead,
              A.map((row) => row.version)
            )
          ).toEqual([1]);
          expect(loserHead).toEqual([]);

          const versions = yield* sql<{ readonly n: number }>`
            SELECT COUNT(*)::int AS n FROM spike_edge_version WHERE logical_key = 'lk-ra'
          `;
          const openHead = yield* sql<{ readonly version: number; readonly supersedes_id: number }>`
            SELECT version, supersedes_id FROM spike_edge_version
            WHERE logical_key = 'lk-ra' AND valid_to IS NULL AND expired_at IS NULL
          `;
          expect(
            pipe(
              versions,
              A.map((row) => row.n)
            )
          ).toEqual([2]);
          expect(openHead).toEqual([{ supersedes_id: 11, version: 2 }]);
        }),
        120_000
      );

      // S5 Race B — two creators, nothing to lock: both insert an open head for the same
      // new logical key; the DB backstop rejects exactly one. Deterministic: one row,
      // one named-constraint rejection.
      it.effect(
        "race B: concurrent creation is deterministic — the second open head is rejected by a backstop",
        Effect.fnUntraced(function* () {
          const sql = yield* currentSql;
          const attempt = (id: number, validFrom: number) =>
            sql.withTransaction(insertOpenHead("lk-rb", id, id, validFrom)).pipe(
              Effect.as(""),
              Effect.catch((error) => Effect.succeed(inspect(error, { depth: 10 })))
            );

          const outcomes = yield* Effect.all([attempt(21, 1000), attempt(22, 1500)], {
            concurrency: "unbounded",
          });
          const failures = pipe(
            outcomes,
            A.filter((text) => text.length > 0)
          );
          expect(failures).toHaveLength(1);
          expect(A.join(failures, "|")).toContain("spike_edge_");

          const rows = yield* sql<{ readonly n: number }>`
            SELECT COUNT(*)::int AS n FROM spike_edge_version WHERE logical_key = 'lk-rb'
          `;
          expect(
            pipe(
              rows,
              A.map((row) => row.n)
            )
          ).toEqual([1]);
        }),
        120_000
      );

      // S5 Race C — a writer that skips the locking rule entirely and inserts an
      // overlapping closed interval is still rejected by the exclusion constraint:
      // the DB backstop holds even against misbehaving write paths.
      it.effect(
        "race C: a lock-skipping writer inserting an overlapping closed interval is rejected",
        Effect.fnUntraced(function* () {
          const sql = yield* currentSql;
          yield* sql`
            INSERT INTO spike_edge_version (
              id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
              relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
            ) VALUES (
              31, 'lk-rc', 'claim', 1, 'claim', 2,
              'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 1, 1000, 2000, 1000, NULL
            )
          `;
          const violation = yield* Effect.flip(sql`
            INSERT INTO spike_edge_version (
              id, logical_key, source_kind, source_claim_id, target_kind, target_claim_id,
              relation, org_scope, qualifiers, fact, version, valid_from, valid_to, recorded_at, expired_at
            ) VALUES (
              32, 'lk-rc', 'claim', 1, 'claim', 2,
              'supports', 'org-1', '{}'::jsonb, '{}'::jsonb, 2, 1500, 2500, 1200, NULL
            )
          `);
          expect(inspect(violation, { depth: 10 })).toContain("spike_edge_no_overlap");
        }),
        120_000
      );
    });
  });
}

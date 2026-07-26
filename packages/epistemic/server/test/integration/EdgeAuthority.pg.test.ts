// External-Postgres true-race lane (opt-in). Proves the S5 concurrency rule against a
// REAL server with genuinely parallel connections, driving the production repository
// rather than raw SQL: two superseders over one open head, two creators of one new key,
// and one writer that skips the locking rule entirely.
//
// PGlite cannot host this: the in-process driver is single-connection, so nothing there
// can contend. The lane is gated on its OWN variable — BEEP_TEST_DATABASE_URL points the
// shared harness at a single-connection pglite-socket server with no btree_gist, which can
// neither load the extension nor race.
//
//   docker run -d --name beep-epistemic-pg -e POSTGRES_PASSWORD=postgres -p 55433:5432 \
//     pgvector/pgvector:pg17
//   BEEP_EPISTEMIC_PG_URL=postgres://postgres:postgres@localhost:55433/postgres \
//     npx vitest run test/integration/EdgeAuthority.pg.test.ts
//   docker rm -f beep-epistemic-pg
//
// Real time is measured by the DATABASE (`SELECT pg_sleep`): the layer() tester runs under
// the TestClock, where Effect.sleep would never wake, and pg_sleep additionally holds the
// contended row lock on its own connection for the whole delay.
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values";
import { makeDrizzleEdgeAuthorityRepository } from "@beep/epistemic-server";
import { DbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { RecordEdgeFact, SupersedeEdgeFact, SupersessionConflict } from "@beep/epistemic-use-cases/EdgeAuthority";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as PgClient from "@effect/sql-pg/PgClient";
import { describe, expect, layer } from "@effect/vitest";
import { Config, Deferred, Effect, Layer, pipe, Redacted, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import type { EdgeAuthorityError, EdgeAuthorityRepositoryShape } from "@beep/epistemic-use-cases/EdgeAuthority";

// Config boot snapshot of the lane selector, per the makePgliteIntegrationGate precedent:
// Node-safe and law-clean, and the operator exports the variable before the process starts.
const externalUrl = pipe(
  Effect.runSync(Config.option(Config.string("BEEP_EPISTEMIC_PG_URL"))),
  O.getOrElse(() => "")
);

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const migrationsSchema = "epistemic_edge_journal";

// Four connections: the blocker holds one and each contending writer takes its own, so
// the race is real rather than pool-serialized.
const makeExternalLayer = () =>
  makeDrizzleLayer().pipe(
    Layer.provideMerge(
      PgClient.layerFrom(
        PgClient.make({
          maxConnections: 4,
          url: Redacted.make(externalUrl),
        })
      )
    )
  );

const decodeClaim = S.decodeUnknownSync(CandidateClaim);
const decodeEvidence = S.decodeUnknownSync(Evidence);
const decodeIdentity = S.decodeUnknownSync(LogicalEdgeIdentity);
const decodeRecord = S.decodeUnknownSync(RecordEdgeFact);
const decodeSupersede = S.decodeUnknownSync(SupersedeEdgeFact);

const systemPrincipal = { component: "Runtime", kind: "System" } as const;

// Raw SQL reads snake_case columns straight from the server, so transforms stay off.
const currentSql = Effect.map(Effect.service(SqlClient.SqlClient), (client) => client.withoutTransforms());

const requireHead = <Row>(rows: ReadonlyArray<Row>, what: string): Effect.Effect<Row> =>
  pipe(
    rows,
    A.head,
    O.match({
      onNone: () => Effect.die(`expected ${what}`),
      onSome: Effect.succeed,
    })
  );

const encodedIdentity = (claimId: number, evidenceId: number, scenario: string) =>
  ({
    evidenceScope: null,
    matterScope: null,
    orgScope: "1",
    qualifiers: { scenario },
    relation: "supports",
    source: { claimId, kind: "claim" },
    target: { evidenceId, kind: "evidence" },
  }) as const;

/**
 * Seed the endpoint rows one race points at. Every race seeds its own pair, so the
 * database-assigned ids differ and each race owns a distinct logical edge.
 */
const seedScenario = Effect.fnUntraced(function* (scenario: string, fixture: number) {
  const db = yield* makeDrizzle();
  const claimRows = yield* db
    .insert(DbSchema.candidateClaim)
    .values(
      toCandidateClaimInsert(
        decodeClaim({
          ...baseEntityFixtureInput("EpistemicCandidateClaim", fixture),
          fixtureKey: `claim.${scenario}`,
          lifecycle: "candidate",
          snapshot: {},
        })
      )
    )
    .returning();
  const evidenceRows = yield* db
    .insert(DbSchema.evidence)
    .values(
      toEvidenceInsert(
        decodeEvidence({
          ...baseEntityFixtureInput("EpistemicEvidence", fixture),
          artifactFixtureKey: `artifact.${scenario}`,
          span: { confidence: 0.9, endChar: 14, quote: "a claimed fact", startChar: 0 },
          spanFixtureKey: `span.${scenario}`,
        })
      )
    )
    .returning();
  const claimRow = yield* requireHead(claimRows, "the seeded candidate claim row");
  const evidenceRow = yield* requireHead(evidenceRows, "the seeded evidence row");

  const identity = encodedIdentity(claimRow.id, evidenceRow.id, scenario);
  return {
    claimId: claimRow.id,
    evidenceId: evidenceRow.id,
    identity,
    logicalKey: logicalEdgeKey(decodeIdentity(identity)),
  };
});

const recordFact = (
  identity: typeof LogicalEdgeIdentity.Encoded,
  fact: Record<string, unknown>,
  validFrom: number,
  recordedAt: number
) =>
  decodeRecord({
    fact,
    identity,
    orgId: 1,
    recordedAt,
    recordedBy: systemPrincipal,
    schemaVersion: "0.0.0",
    source: "Agent",
    validFrom,
    validTo: null,
  });

const supersedeFact = (
  identity: typeof LogicalEdgeIdentity.Encoded,
  fact: Record<string, unknown>,
  recordedAt: number
) =>
  decodeSupersede({
    expectedVersion: 1,
    fact,
    identity,
    orgId: 1,
    recordedAt,
    recordedBy: systemPrincipal,
    schemaVersion: "0.0.0",
    source: "Agent",
    validFrom: 1_000,
    validTo: null,
  });

const partitionOutcomes = (outcomes: ReadonlyArray<Result.Result<EdgeVersion, EdgeAuthorityError>>) => ({
  failures: pipe(
    outcomes,
    A.filter(Result.isFailure),
    A.map((outcome) => outcome.failure)
  ),
  successes: pipe(
    outcomes,
    A.filter(Result.isSuccess),
    A.map((outcome) => outcome.success)
  ),
});

/**
 * Two repository INSTANCES, not two calls on one. The in-process write semaphore is
 * per-instance, so a single instance would serialize the two writers locally and prove
 * nothing about the database. Separate instances model separate processes, which is the
 * only contention the backstops actually have to survive.
 */
const twoWriters = Effect.fnUntraced(function* () {
  const first = yield* makeDrizzleEdgeAuthorityRepository();
  const second = yield* makeDrizzleEdgeAuthorityRepository();
  return [first, second] as const;
});

const contend = (
  writers: readonly [EdgeAuthorityRepositoryShape, EdgeAuthorityRepositoryShape],
  run: (writer: EdgeAuthorityRepositoryShape, index: number) => Effect.Effect<EdgeVersion, EdgeAuthorityError>
) => Effect.all([Effect.result(run(writers[0], 0)), Effect.result(run(writers[1], 1))], { concurrency: "unbounded" });

if (externalUrl.length === 0) {
  describe.skip("Epistemic EdgeAuthority external Postgres races — BEEP_EPISTEMIC_PG_URL not set", () => {});
} else {
  describe("Epistemic EdgeAuthority external Postgres races", { concurrent: false }, () => {
    layer(makeExternalLayer(), { timeout: "5 minutes" })((it) => {
      it.effect(
        "resets the database and applies the epistemic-edge migration on real Postgres",
        Effect.fnUntraced(function* () {
          const sql = yield* currentSql;
          // The whole db-admin folder is applied, so the reset drops everything it owns
          // and the journal with it; the lane is then re-runnable against one container.
          yield* sql`DROP SCHEMA IF EXISTS public CASCADE`;
          yield* sql`CREATE SCHEMA public`;
          yield* sql`DROP SCHEMA IF EXISTS ${sql.unsafe(migrationsSchema)} CASCADE`;

          const db = yield* makeDrizzle();
          yield* migrate(db, { migrationsFolder, migrationsSchema });

          const constraints = yield* sql<{ readonly conname: string }>`
            SELECT conname FROM pg_constraint
            WHERE conname IN ('epistemic_edge_no_overlap', 'epistemic_edge_logical_version_unique')
            ORDER BY conname ASC
          `;
          const indexes = yield* sql<{ readonly indexname: string }>`
            SELECT indexname FROM pg_indexes WHERE indexname = 'epistemic_edge_open_head_idx'
          `;

          expect(A.map(constraints, (row) => row.conname)).toEqual([
            "epistemic_edge_logical_version_unique",
            "epistemic_edge_no_overlap",
          ]);
          expect(A.map(indexes, (row) => row.indexname)).toEqual(["epistemic_edge_open_head_idx"]);
        }),
        120_000
      );

      // Race A — two superseders over one open head on separate connections. A third
      // connection holds the head's row lock until both writers are parked inside their own
      // FOR UPDATE, so the overlap is guaranteed rather than hoped for. When the blocker
      // commits, one writer closes the head and inserts; the other re-evaluates under READ
      // COMMITTED and finds the head it was promised is gone. Deterministic: one version
      // increment, one typed conflict, intact lineage, no partial write.
      it.effect(
        "race A: concurrent supersession is deterministic — one writer wins, the other gets a typed conflict",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario("race-a", 11);
          const sql = yield* currentSql;
          const writers = yield* twoWriters();

          yield* writers[0].record(recordFact(scenario.identity, { amount: "100" }, 1_000, 1_000));

          const lockHeld = yield* Deferred.make<void>();
          const blocker = sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`
                SELECT id FROM epistemic_edge_version
                WHERE logical_key = ${scenario.logicalKey} AND expired_at IS NULL
                FOR UPDATE
              `;
              yield* Deferred.succeed(lockHeld, undefined);
              // The database is the timer: both writers park on this lock for the delay.
              yield* sql`SELECT pg_sleep(0.25)`;
            })
          );

          const [, raced] = yield* Effect.all(
            [
              Effect.asVoid(blocker),
              Deferred.await(lockHeld).pipe(
                Effect.andThen(
                  contend(writers, (writer, index) =>
                    writer.supersede(supersedeFact(scenario.identity, { amount: `15${index}` }, 2_000 + index))
                  )
                )
              ),
            ],
            { concurrency: "unbounded" }
          );

          const { failures, successes } = partitionOutcomes(raced);

          expect(A.length(successes)).toBe(1);
          expect(A.map(successes, (version) => version.version)).toEqual([2]);
          expect(A.length(failures)).toBe(1);
          expect(A.every(failures, SupersessionConflict.is)).toBe(true);

          const versions = yield* sql<{ readonly n: number }>`
            SELECT COUNT(*)::int AS n FROM epistemic_edge_version WHERE logical_key = ${scenario.logicalKey}
          `;
          const openHead = yield* sql<{ readonly version: number; readonly supersedes_id: number }>`
            SELECT version, supersedes_id FROM epistemic_edge_version
            WHERE logical_key = ${scenario.logicalKey} AND valid_to IS NULL AND expired_at IS NULL
          `;

          expect(A.map(versions, (row) => row.n)).toEqual([2]);
          expect(A.map(openHead, (row) => row.version)).toEqual([2]);
          expect(A.every(openHead, (row) => row.supersedes_id !== null)).toBe(true);
        }),
        120_000
      );

      // Race B — two creators of one brand-new key. There is nothing to lock, so the
      // application rule cannot serialize them at all: the database backstop is the entire
      // guarantee, and it holds.
      it.effect(
        "race B: concurrent creation is deterministic — the second open head is rejected by a backstop",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario("race-b", 12);
          const sql = yield* currentSql;
          const writers = yield* twoWriters();

          const raced = yield* contend(writers, (writer, index) =>
            writer.record(recordFact(scenario.identity, { attempt: `${index}` }, 1_000 + index, 1_000 + index))
          );
          const { failures, successes } = partitionOutcomes(raced);

          expect(A.length(successes)).toBe(1);
          expect(A.length(failures)).toBe(1);
          expect(A.every(failures, SupersessionConflict.is)).toBe(true);
          // Both creators derive version 1 over an empty key, so the btree unique index on
          // (logical_key, version) is what actually catches the loser here — the open-head
          // index never gets the chance. That name is a lost race too, and the mapping says
          // so; the raw-SQL spike could not surface it because it hard-coded distinct
          // versions per writer.
          expect(inspect(failures, { depth: 12 })).toMatch(
            /epistemic_edge_(?:open_head_idx|no_overlap|logical_version_unique)/u
          );

          const rows = yield* sql<{ readonly n: number }>`
            SELECT COUNT(*)::int AS n FROM epistemic_edge_version WHERE logical_key = ${scenario.logicalKey}
          `;
          expect(A.map(rows, (row) => row.n)).toEqual([1]);
        }),
        120_000
      );

      // Race C — a writer that skips the repository, and therefore the locking rule,
      // entirely. The exclusion constraint still refuses the overlap, which is why the rule
      // is a fast path and the constraint is the guarantee. Probe stays LAST.
      it.effect(
        "race C: a lock-skipping writer inserting an overlapping closed interval is rejected",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario("race-c", 13);
          const sql = yield* currentSql;
          const writers = yield* twoWriters();

          const head = yield* writers[0].record(recordFact(scenario.identity, { state: "held" }, 1_000, 1_000));
          expect(head.version).toBe(1);

          const violation = yield* Effect.flip(sql`
            INSERT INTO epistemic_edge_version (
              created_at, created_by_principal, org_id, public_id, row_version, schema_version, source,
              updated_at, updated_by_principal, entity_type,
              logical_key, fact, qualifiers, relation, recorded_at,
              source_kind, source_claim_id, target_kind, target_evidence_id,
              valid_from, valid_to, version
            ) VALUES (
              1200, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 'epistemic_edge_version_alockskipper', 1,
              '0.0.0', 'Agent', 1200, '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicEdgeVersion',
              ${scenario.logicalKey}, '{"state":"smuggled"}'::jsonb, '{}'::jsonb, 'supports', 1200,
              'claim', ${scenario.claimId}, 'evidence', ${scenario.evidenceId},
              1500, 2500, 2
            )
          `);

          expect(inspect(violation, { depth: 12 })).toContain("epistemic_edge_no_overlap");
        }),
        120_000
      );
    });
  });
}

import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values";
import { makeDrizzleEdgeAuthorityRepository } from "@beep/epistemic-server";
import { DbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { RecordEdgeFact, SupersedeEdgeFact, SupersessionConflict } from "@beep/epistemic-use-cases/EdgeAuthority";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as PgClient from "@effect/sql-pg/PgClient";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { expectBothWritersWaiting } from "./PostgresLock.test-kit.ts";
import type { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import type { EdgeAuthorityError, EdgeAuthorityRepositoryShape } from "@beep/epistemic-use-cases/EdgeAuthority";

const { BEEP_EPISTEMIC_PG_URL: externalUrl = "" } = process.env;

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const migrationsSchema = "epistemic_edge_journal";

const unpooledRaceConnections = 4;
const makeExternalLayer = () =>
  makeDrizzleLayer().pipe(
    Layer.provideMerge(
      PgClient.layerFrom(
        PgClient.make({
          maxConnections: unpooledRaceConnections,
          url: Redacted.make(externalUrl),
        })
      )
    )
  );

const decodeClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);
const decodeIdentity = S.decodeUnknownEffect(LogicalEdgeIdentity);
const decodeRecord = S.decodeUnknownEffect(RecordEdgeFact);
const decodeSupersede = S.decodeUnknownEffect(SupersedeEdgeFact);

const systemPrincipal = { component: "Runtime", kind: "System" } as const;

const rawSnakeCaseSql = Effect.map(Effect.service(SqlClient.SqlClient), (client) => client.withoutTransforms());

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

const seedScenario = Effect.fnUntraced(function* (scenario: string, fixture: number) {
  const db = yield* makeDrizzle();
  const argument = db.insert(DbSchema.candidateClaim);
  const decodedClaim = yield* decodeClaim({
    ...productEntityFixtureInput("EpistemicCandidateClaim", fixture),
    fixtureKey: `claim.${scenario}`,
    lifecycle: "candidate",
    snapshot: {},
  });
  const fromResult1 = yield* Effect.fromResult(toCandidateClaimInsert(decodedClaim));
  const claimRows = yield* argument.values(fromResult1).returning();
  const argument1 = db.insert(DbSchema.evidence);
  const decodedEvidence = yield* decodeEvidence({
    ...productEntityFixtureInput("EpistemicEvidence", fixture),
    artifactFixtureKey: `artifact.${scenario}`,
    span: {
      version: "evidence-position/v2",
      position: { endChar: 14, quote: "a claimed fact", startChar: 0 },
      extractorConfidence: {
        _tag: "Present",
        value: { _tag: "ReportedConfidence", value: 0.9, method: "synthetic-fixture" },
      },
    },
    spanFixtureKey: `span.${scenario}`,
  });
  const fromResult2 = yield* Effect.fromResult(toEvidenceInsert(decodedEvidence));
  const evidenceRows = yield* argument1.values(fromResult2).returning();
  const claimRow = yield* requireHead(claimRows, "the seeded candidate claim row");
  const evidenceRow = yield* requireHead(evidenceRows, "the seeded evidence row");

  const identity = encodedIdentity(claimRow.id, evidenceRow.id, scenario);
  const decodedIdentity = yield* decodeIdentity(identity);
  return {
    claimId: claimRow.id,
    evidenceId: evidenceRow.id,
    identity,
    logicalKey: logicalEdgeKey(decodedIdentity),
  };
});

const recordFact = Effect.fnUntraced(function* (
  identity: typeof LogicalEdgeIdentity.Encoded,
  fact: Record<string, unknown>,
  validFrom: number,
  recordedAt: number
) {
  return yield* decodeRecord({
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
});

const supersedeFact = Effect.fnUntraced(function* (
  identity: typeof LogicalEdgeIdentity.Encoded,
  fact: Record<string, unknown>,
  recordedAt: number
) {
  return yield* decodeSupersede({
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

const twoRepositoryInstances = Effect.fnUntraced(function* () {
  const first = yield* makeDrizzleEdgeAuthorityRepository();
  const second = yield* makeDrizzleEdgeAuthorityRepository();
  return [first, second] as const;
});

const contend = (
  writers: readonly [EdgeAuthorityRepositoryShape, EdgeAuthorityRepositoryShape],
  run: (writer: EdgeAuthorityRepositoryShape, index: number) => Effect.Effect<EdgeVersion, EdgeAuthorityError>
) => Effect.all([Effect.result(run(writers[0], 0)), Effect.result(run(writers[1], 1))], { concurrency: "unbounded" });

if (externalUrl.length === 0) {
  describe.skip("Epistemic EdgeAuthority external Postgres races — BEEP_EPISTEMIC_PG_URL not set (the pglite-socket harness cannot race)", () => {});
} else {
  describe("Epistemic EdgeAuthority races on parallel Postgres connections, which single-connection PGlite cannot host", {
    concurrent: false,
  }, () => {
    it.layer(
      Layer.effectDiscard(
        Effect.gen(function* () {
          const sql = yield* rawSnakeCaseSql;
          yield* sql`DROP SCHEMA IF EXISTS public CASCADE`;
          yield* sql`CREATE SCHEMA public`;
          yield* sql`DROP SCHEMA IF EXISTS ${sql.unsafe(migrationsSchema)} CASCADE`;

          const db = yield* makeDrizzle();
          yield* migrate(db, { migrationsFolder, migrationsSchema });
        })
      ).pipe(Layer.provideMerge(makeExternalLayer())),
      { timeout: "5 minutes" }
    )((it) => {
      it.effect(
        "resets the database and applies the epistemic-edge migration on real Postgres",
        Effect.fnUntraced(function* () {
          const sql = yield* rawSnakeCaseSql;

          const constraints = yield* sql<{ readonly conname: string }>`
            SELECT conname FROM pg_constraint
            WHERE conname IN ('epistemic_edge_no_overlap', 'epistemic_edge_logical_version_unique')
            ORDER BY conname ASC
          `;
          const indexes = yield* sql<{ readonly indexname: string }>`
            SELECT indexname FROM pg_indexes WHERE indexname = 'epistemic_edge_open_head_idx'
          `;

          expect(
            A.map(constraints, (row) => row.conname),
            "the reset drops the journal too, so the lane re-runs against one container"
          ).toEqual(["epistemic_edge_logical_version_unique", "epistemic_edge_no_overlap"]);
          expect(A.map(indexes, (row) => row.indexname)).toEqual(["epistemic_edge_open_head_idx"]);
        }),
        120_000
      );

      it.effect(
        "race A: concurrent supersession is deterministic — one writer wins, the other gets a typed conflict",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario("race-a", 11);
          const sql = yield* rawSnakeCaseSql;
          const writers = yield* twoRepositoryInstances();

          const argument2 = writers[0];
          const recordFact3 = yield* recordFact(scenario.identity, { amount: "100" }, 1_000, 1_000);
          yield* argument2.record(recordFact3);

          const lockHeld = yield* Deferred.make<void>();
          const firstPid = yield* Deferred.make<number>();
          const secondPid = yield* Deferred.make<number>();
          const blocker = sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`
                SELECT id FROM epistemic_edge_version
                WHERE logical_key = ${scenario.logicalKey} AND expired_at IS NULL
                FOR UPDATE
              `;
              yield* Deferred.succeed(lockHeld, undefined);
              const [firstWriterPid, secondWriterPid] = yield* Effect.all(
                [Deferred.await(firstPid), Deferred.await(secondPid)],
                { concurrency: 1 }
              );
              expect(firstWriterPid).not.toBe(secondWriterPid);
              yield* expectBothWritersWaiting(sql, firstWriterPid, secondWriterPid);
            })
          );

          const [, raced] = yield* Effect.all(
            [
              Effect.asVoid(blocker),
              Deferred.await(lockHeld).pipe(
                Effect.andThen(
                  contend(writers, (writer, index) =>
                    sql
                      .withTransaction(
                        Effect.gen(function* () {
                          const rows = yield* sql<{ readonly pid: number }>`SELECT pg_backend_pid()::int AS pid`;
                          const backend = yield* requireHead(rows, "the writer backend PID");
                          yield* Deferred.succeed(index === 0 ? firstPid : secondPid, backend.pid);
                          return yield* supersedeFact(scenario.identity, { amount: `15${index}` }, 2_000 + index).pipe(
                            Effect.orDie,
                            Effect.flatMap((fact) => writer.supersede(fact))
                          );
                        })
                      )
                      .pipe(Effect.catchTag("SqlError", Effect.die))
                  )
                )
              ),
            ],
            { concurrency: "unbounded" }
          );

          const { failures, successes } = partitionOutcomes(raced);

          expect(A.length(successes), "the blocker parks both writers inside FOR UPDATE, so they overlap").toBe(1);
          expect(A.map(successes, (version) => version.version)).toEqual([2]);
          expect(A.length(failures), "the loser re-reads under READ COMMITTED and finds its head gone").toBe(1);
          pipe(A.every(failures, SupersessionConflict.is), assertTrue);

          const versions = yield* sql<{ readonly n: number }>`
            SELECT COUNT(*)::int AS n FROM epistemic_edge_version WHERE logical_key = ${scenario.logicalKey}
          `;
          const openHead = yield* sql<{ readonly version: number; readonly supersedes_id: number }>`
            SELECT version, supersedes_id FROM epistemic_edge_version
            WHERE logical_key = ${scenario.logicalKey} AND valid_to IS NULL AND expired_at IS NULL
          `;

          expect(A.map(versions, (row) => row.n)).toEqual([2]);
          expect(A.map(openHead, (row) => row.version)).toEqual([2]);
          pipe(
            A.every(openHead, (row) => row.supersedes_id !== null),
            assertTrue
          );
        }),
        120_000
      );

      it.effect(
        "race B: concurrent creation is deterministic — the second open head is rejected by a backstop",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario("race-b", 12);
          const sql = yield* rawSnakeCaseSql;
          const writers = yield* twoRepositoryInstances();

          const raced = yield* contend(writers, (writer, index) =>
            recordFact(scenario.identity, { attempt: `${index}` }, 1_000 + index, 1_000 + index).pipe(
              Effect.orDie,
              Effect.flatMap((fact) => writer.record(fact))
            )
          );
          const { failures, successes } = partitionOutcomes(raced);

          expect(A.length(successes)).toBe(1);
          expect(
            A.length(failures),
            "a brand-new key has nothing to lock; the database backstop is the guarantee"
          ).toBe(1);
          pipe(A.every(failures, SupersessionConflict.is), assertTrue);
          expect(
            NodeUtil.inspect(failures, { depth: 12 }),
            "both creators derive version 1 and one public id, so any equivalent unique index may reject the loser"
          ).toMatch(/epistemic_edge_(?:open_head_idx|no_overlap|logical_version_unique|version_public_id_unique_idx)/u);

          const rows = yield* sql<{ readonly n: number }>`
            SELECT COUNT(*)::int AS n FROM epistemic_edge_version WHERE logical_key = ${scenario.logicalKey}
          `;
          expect(A.map(rows, (row) => row.n)).toEqual([1]);
        }),
        120_000
      );

      it.effect(
        "race C, run last: a lock-skipping writer inserting an overlapping closed interval is rejected",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario("race-c", 13);
          const sql = yield* rawSnakeCaseSql;
          const writers = yield* twoRepositoryInstances();

          const argument3 = writers[0];
          const recordFact4 = yield* recordFact(scenario.identity, { state: "held" }, 1_000, 1_000);
          const head = yield* argument3.record(recordFact4);
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

          expect(
            NodeUtil.inspect(violation, { depth: 12 }),
            "the exclusion constraint is the guarantee; the repository's locking rule is a fast path"
          ).toContain("epistemic_edge_no_overlap");
        }),
        120_000
      );
    });
  });
}

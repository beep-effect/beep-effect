// External-Postgres contradiction-review race lane (opt-in). PGlite uses one
// in-process connection, so it cannot prove the production row-lock contract.
//
// Use a disposable database: this proof resets its public schema.
//
//   docker run -d --name beep-contradiction-pg -e POSTGRES_PASSWORD=postgres -p 55434:5432 \
//     pgvector/pgvector:pg17
//   BEEP_EPISTEMIC_CONTRADICTION_PG_URL=postgres://postgres:postgres@localhost:55434/postgres \
//     bunx --bun vitest run test/integration/ContradictionTriage.pg.test.ts
//   docker rm -f beep-contradiction-pg
import { fileURLToPath } from "node:url";
import { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction";
import * as Epistemic from "@beep/epistemic-domain/identity/Epistemic";
import {
  BeliefVersionRef,
  ContradictionAssessment,
  ContradictionBeliefPair,
  ContradictionMatchBasis,
  ContradictionProposalId,
  ContradictionResolutionProposal,
  canonicalizeContradiction,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import { makeDrizzleContradictionTriageRepository, makeDrizzleEdgeAuthorityRepository } from "@beep/epistemic-server";
import { DbSchema } from "@beep/epistemic-tables";
import { toContradictionCandidateInsert } from "@beep/epistemic-tables/entities/Contradiction";
import { ReviewContradictionCandidate } from "@beep/epistemic-use-cases/public";
import {
  ContradictionReviewConflict,
  ContradictionReviewScope,
  ContradictionTriageRepository,
  EdgeAuthorityRepository,
  GetExpandedContradictionCandidate,
  RecordEdgeFact,
  SupersessionConflict,
} from "@beep/epistemic-use-cases/server";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as SharedEpistemic from "@beep/shared-domain/identity/Epistemic";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { systemPrincipal as systemPrincipalInput } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as PgClient from "@effect/sql-pg/PgClient";
import { describe, expect, layer } from "@effect/vitest";
import { Config, Context, DateTime, Deferred, Effect, Layer, pipe, Redacted } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";

const externalUrl = pipe(
  Effect.runSync(Config.option(Config.string("BEEP_EPISTEMIC_CONTRADICTION_PG_URL"))),
  O.getOrElse(() => "")
);

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const migrationsSchema = "epistemic_contradiction_acceptance";

const makeExternalLayer = (maxConnections: number) =>
  makeDrizzleLayer().pipe(
    Layer.provideMerge(
      PgClient.layerFrom(
        PgClient.make({
          maxConnections,
          url: Redacted.make(externalUrl),
        })
      )
    )
  );

const makeRepositoryStackLayer = () =>
  Layer.merge(
    Layer.effect(ContradictionTriageRepository, makeDrizzleContradictionTriageRepository()),
    Layer.effect(EdgeAuthorityRepository, makeDrizzleEdgeAuthorityRepository())
  ).pipe(Layer.provideMerge(makeExternalLayer(1)), Layer.fresh);

const systemPrincipal = Result.getOrThrow(S.decodeResult(Principal)(systemPrincipalInput));
const candidatePublicId = PublicEntityId.factory(Epistemic.ContradictionCandidateId);
const instant = DateTime.makeUnsafe(1_000);

const leftEvidenceIds: readonly [SharedEpistemic.EvidenceId] = [SharedEpistemic.EvidenceId.make(1)];
const rightEvidenceIds: readonly [SharedEpistemic.EvidenceId] = [SharedEpistemic.EvidenceId.make(2)];
const left = BeliefVersionRef.make({
  edgeVersionId: SharedEpistemic.EdgeVersionId.make(1),
  logicalKey: LogicalEdgeKey.make(Str.repeat(64)("a")),
  version: PosInt.make(1),
});
const right = BeliefVersionRef.make({
  edgeVersionId: SharedEpistemic.EdgeVersionId.make(2),
  logicalKey: LogicalEdgeKey.make(Str.repeat(64)("b")),
  version: PosInt.make(1),
});
const pair = ContradictionBeliefPair.make({ left, right });
const matchBasis = ContradictionMatchBasis.make({
  detector: "postgres-race-proof",
  detectorVersion: SemanticVersion.make("0.0.0"),
  evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
  kind: "independent-evidence",
  leftEvidenceIds,
  rightEvidenceIds,
});
const proposalContent = {
  fact: { amount: "125" },
  losingBelief: left,
  proposalId: ContradictionProposalId.make(Str.repeat(64)("c")),
  rationale: "The signed amendment controls.",
  validFrom: instant,
  validTo: O.none<DateTime.Utc>(),
};
const proposal = ContradictionResolutionProposal.make({
  ...proposalContent,
  proposalDigest: Result.getOrThrow(contradictionProposalDigest(proposalContent)),
});
const assessment = ContradictionAssessment.make({
  confidence: Confidence.make(0.95),
  proposals: [proposal],
});
const normalized = canonicalizeContradiction(pair, matchBasis);
const candidateContent = {
  assessment,
  matchBasis: normalized.matchBasis,
  pair: normalized.pair,
  validFrom: instant,
  validTo: O.none<DateTime.Utc>(),
};
const candidate = ContradictionCandidate.make({
  ...candidateContent,
  candidateDigest: Result.getOrThrow(contradictionCandidateDigest(candidateContent)),
  candidateKey: contradictionCandidateKey(pair, matchBasis),
  createdAt: instant,
  createdByPrincipal: systemPrincipal,
  entityType: Epistemic.ContradictionCandidateId.entityType,
  id: Epistemic.ContradictionCandidateId.make(1),
  orgId: Shared.OrganizationId.make(1),
  publicId: candidatePublicId.fromUnknown("epistemic_contradiction_candidate_apostgresrace"),
  recordedAt: instant,
  rowVersion: PosInt.make(1),
  schemaVersion: SemanticVersion.make("0.0.0"),
  source: "System",
  updatedAt: instant,
  updatedByPrincipal: systemPrincipal,
});

const recordRaceEdge = (suffix: string, amount: string) =>
  Result.getOrThrow(
    S.decodeUnknownResult(RecordEdgeFact)({
      fact: { amount },
      identity: {
        evidenceScope: null,
        matterScope: null,
        orgScope: "1",
        qualifiers: { race: suffix },
        relation: "supports",
        source: { entityRef: `postgres-race:${suffix}:source`, kind: "entity" },
        target: { entityRef: `postgres-race:${suffix}:target`, kind: "entity" },
      },
      orgId: 1,
      recordedAt: 1_000,
      recordedBy: systemPrincipal,
      schemaVersion: "0.0.0",
      source: "Agent",
      validFrom: 1_000,
      validTo: null,
    })
  );

const beliefVersionRef = (edge: EdgeVersion) =>
  BeliefVersionRef.make({
    edgeVersionId: edge.id,
    logicalKey: edge.logicalKey,
    version: edge.version,
  });

const makeSupersessionCandidate = (
  suffix: string,
  losingBelief: BeliefVersionRef,
  competingBelief: BeliefVersionRef,
  proposalIdHex: string,
  replacementAmount: string,
  evidenceOrdinal: number
) => {
  const candidatePair = ContradictionBeliefPair.make({
    left: losingBelief,
    right: competingBelief,
  });
  const candidateLeftEvidenceIds: readonly [SharedEpistemic.EvidenceId] = [
    SharedEpistemic.EvidenceId.make(evidenceOrdinal),
  ];
  const candidateRightEvidenceIds: readonly [SharedEpistemic.EvidenceId] = [
    SharedEpistemic.EvidenceId.make(evidenceOrdinal + 1),
  ];
  const candidateMatchBasis = ContradictionMatchBasis.make({
    detector: `postgres-supersession-race-${suffix}`,
    detectorVersion: SemanticVersion.make("0.0.0"),
    evidenceDigest: contradictionEvidenceDigest(candidateLeftEvidenceIds, candidateRightEvidenceIds),
    kind: "independent-evidence",
    leftEvidenceIds: candidateLeftEvidenceIds,
    rightEvidenceIds: candidateRightEvidenceIds,
  });
  const candidateProposalContent = {
    fact: { amount: replacementAmount },
    losingBelief,
    proposalId: ContradictionProposalId.make(Str.repeat(64)(proposalIdHex)),
    rationale: `Competing supersession proposal ${suffix}.`,
    validFrom: instant,
    validTo: O.none<DateTime.Utc>(),
  };
  const candidateProposal = ContradictionResolutionProposal.make({
    ...candidateProposalContent,
    proposalDigest: Result.getOrThrow(contradictionProposalDigest(candidateProposalContent)),
  });
  const candidateAssessment = ContradictionAssessment.make({
    confidence: Confidence.make(0.95),
    proposals: [candidateProposal],
  });
  const normalizedCandidate = canonicalizeContradiction(candidatePair, candidateMatchBasis);
  const candidateKey = contradictionCandidateKey(candidatePair, candidateMatchBasis);
  const content = {
    assessment: candidateAssessment,
    matchBasis: normalizedCandidate.matchBasis,
    pair: normalizedCandidate.pair,
    validFrom: instant,
    validTo: O.none<DateTime.Utc>(),
  };
  return ContradictionCandidate.make({
    ...content,
    candidateDigest: Result.getOrThrow(contradictionCandidateDigest(content)),
    candidateKey,
    createdAt: instant,
    createdByPrincipal: systemPrincipal,
    entityType: Epistemic.ContradictionCandidateId.entityType,
    id: Epistemic.ContradictionCandidateId.make(1),
    orgId: Shared.OrganizationId.make(1),
    publicId: candidatePublicId.fromUnknown(`${Epistemic.ContradictionCandidateId.tableName}_a${candidateKey}`),
    recordedAt: instant,
    rowVersion: PosInt.make(1),
    schemaVersion: SemanticVersion.make("0.0.0"),
    source: "System",
    updatedAt: instant,
    updatedByPrincipal: systemPrincipal,
  });
};

const openStack = Effect.fnUntraced(function* () {
  const context = yield* Layer.build(makeRepositoryStackLayer());
  return {
    edges: Context.get(context, EdgeAuthorityRepository),
    repository: Context.get(context, ContradictionTriageRepository),
    sql: Context.get(context, SqlClient.SqlClient).withoutTransforms(),
  };
});

const readBackendPid = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
  const rows = yield* sql<{ readonly pid: number }>`SELECT pg_backend_pid()::int AS pid`;
  return yield* pipe(
    rows,
    A.head,
    O.match({
      onNone: () => Effect.die("expected a PostgreSQL backend pid"),
      onSome: (row) => Effect.succeed(row.pid),
    })
  );
});

const expectBothWritersWaiting = Effect.fnUntraced(function* (
  sql: SqlClient.SqlClient,
  firstPid: number,
  secondPid: number
) {
  yield* sql`SELECT pg_sleep(0.25)`;
  const waiters = yield* sql<{ readonly count: number }>`
    SELECT COUNT(*)::int AS count
    FROM pg_stat_activity
    WHERE pid IN (${firstPid}, ${secondPid})
      AND wait_event_type = 'Lock'
  `;
  expect(A.map(waiters, (row) => row.count)).toEqual([2]);
});

if (Str.isEmpty(externalUrl)) {
  describe.skip("ContradictionTriage external Postgres race — BEEP_EPISTEMIC_CONTRADICTION_PG_URL not set", () => {});
} else {
  describe("ContradictionTriage external Postgres race", { concurrent: false }, () => {
    layer(makeExternalLayer(2), { timeout: "5 minutes" })((it) => {
      it.effect(
        "allows exactly one reviewer and preserves the disposition across a fresh repository/client stack",
        Effect.fnUntraced(function* () {
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          yield* sql`DROP SCHEMA IF EXISTS public CASCADE`;
          yield* sql`CREATE SCHEMA public`;
          yield* sql`DROP SCHEMA IF EXISTS ${sql.unsafe(migrationsSchema)} CASCADE`;

          const db = yield* makeDrizzle();
          yield* migrate(db, { migrationsFolder, migrationsSchema });
          const candidateInsert = yield* Effect.fromResult(toContradictionCandidateInsert(candidate));
          const candidateRows = yield* db.insert(DbSchema.contradictionCandidate).values(candidateInsert).returning();
          const candidateRow = yield* pipe(
            candidateRows,
            A.head,
            O.match({
              onNone: () => Effect.die("expected the seeded contradiction candidate"),
              onSome: Effect.succeed,
            })
          );
          const candidateId = Epistemic.ContradictionCandidateId.make(candidateRow.id);
          const command = ReviewContradictionCandidate.make({
            candidateId,
            decision: {
              decision: "reject",
              reason: "The passages concern different obligations.",
            },
            expectedCandidateVersion: candidate.rowVersion,
          });
          const scope = ContradictionReviewScope.of({
            orgId: candidate.orgId,
            sourceScopeRef: "workspace:postgres-race",
          });
          yield* TestClock.setTime(2_000);

          const outcomes = yield* Effect.scoped(
            Effect.gen(function* () {
              const first = yield* openStack();
              const second = yield* openStack();
              const [firstPid, secondPid] = yield* Effect.all([readBackendPid(first.sql), readBackendPid(second.sql)]);
              expect(firstPid).not.toBe(secondPid);

              const lockHeld = yield* Deferred.make<void>();
              const blocker = sql.withTransaction(
                Effect.gen(function* () {
                  yield* sql`
                    SELECT id
                    FROM epistemic_contradiction_candidate
                    WHERE id = ${candidateId}
                    FOR UPDATE
                  `;
                  yield* Deferred.succeed(lockHeld, undefined);
                  yield* expectBothWritersWaiting(sql, firstPid, secondPid);
                })
              );
              const review = (repository: ContradictionTriageRepository["Service"]) =>
                Effect.result(repository.review(command, systemPrincipal, scope));
              const [, raced] = yield* Effect.all(
                [
                  Effect.asVoid(blocker),
                  Deferred.await(lockHeld).pipe(
                    Effect.andThen(
                      Effect.all([review(first.repository), review(second.repository)], {
                        concurrency: "unbounded",
                      })
                    )
                  ),
                ],
                { concurrency: "unbounded" }
              );
              return raced;
            })
          );

          const successes = A.filter(outcomes, Result.isSuccess);
          const failures = A.filter(outcomes, Result.isFailure);
          expect(A.length(successes)).toBe(1);
          expect(A.length(failures)).toBe(1);
          expect(A.every(failures, (outcome) => ContradictionReviewConflict.is(outcome.failure))).toBe(true);
          expect(
            A.every(
              failures,
              (outcome) =>
                ContradictionReviewConflict.is(outcome.failure) && Eq.equals(outcome.failure.reason, "already-resolved")
            )
          ).toBe(true);

          const dispositionCounts = yield* sql<{ readonly count: number }>`
            SELECT COUNT(*)::int AS count
            FROM epistemic_contradiction_disposition
            WHERE candidate_id = ${candidateId}
          `;
          expect(A.map(dispositionCounts, (row) => row.count)).toEqual([1]);

          const persisted = yield* Effect.scoped(
            Effect.gen(function* () {
              const restarted = yield* openStack();
              return yield* restarted.repository.get(
                GetExpandedContradictionCandidate.make({
                  candidateId,
                  knownAt: DateTime.makeUnsafe(2_000),
                  orgId: candidate.orgId,
                  sourceScopeRef: "workspace:postgres-race",
                  validAt: DateTime.makeUnsafe(2_000),
                })
              );
            })
          );
          expect(O.isSome(persisted)).toBe(true);
          if (O.isNone(persisted)) {
            return yield* Effect.die("expected the reviewed candidate after rebuilding the repository stack");
          }
          expect(persisted.value.candidate.rowVersion).toBe(1);
          expect(O.map(persisted.value.disposition, (disposition) => disposition.rowVersion)).toStrictEqual(
            O.some(PosInt.make(1))
          );
          expect(O.map(persisted.value.disposition, (disposition) => disposition.decision.status)).toStrictEqual(
            O.some("rejected")
          );
        }),
        180_000
      );

      it.effect(
        "allows one competing approval to supersede a shared edge and preserves the winner across restart",
        Effect.fnUntraced(function* () {
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          yield* sql`DROP SCHEMA IF EXISTS public CASCADE`;
          yield* sql`CREATE SCHEMA public`;
          yield* sql`DROP SCHEMA IF EXISTS ${sql.unsafe(migrationsSchema)} CASCADE`;

          const db = yield* makeDrizzle();
          yield* migrate(db, { migrationsFolder, migrationsSchema });
          const edgeRepository = yield* makeDrizzleEdgeAuthorityRepository();
          const shared = yield* edgeRepository.record(recordRaceEdge("shared", "100"));
          const competingA = yield* edgeRepository.record(recordRaceEdge("competing-a", "150"));
          const competingB = yield* edgeRepository.record(recordRaceEdge("competing-b", "175"));
          const sharedBelief = beliefVersionRef(shared);
          const firstCandidate = makeSupersessionCandidate(
            "a",
            sharedBelief,
            beliefVersionRef(competingA),
            "d",
            "125",
            11
          );
          const secondCandidate = makeSupersessionCandidate(
            "b",
            sharedBelief,
            beliefVersionRef(competingB),
            "e",
            "130",
            21
          );
          const insertCandidate = Effect.fnUntraced(function* (seed: ContradictionCandidate) {
            const insert = yield* Effect.fromResult(toContradictionCandidateInsert(seed));
            const rows = yield* db.insert(DbSchema.contradictionCandidate).values(insert).returning();
            return yield* pipe(
              rows,
              A.head,
              O.match({
                onNone: () => Effect.die("expected the seeded supersession candidate"),
                onSome: Effect.succeed,
              })
            );
          });
          const [firstRow, secondRow] = yield* Effect.all(
            [insertCandidate(firstCandidate), insertCandidate(secondCandidate)],
            { concurrency: 1 }
          );
          const firstId = Epistemic.ContradictionCandidateId.make(firstRow.id);
          const secondId = Epistemic.ContradictionCandidateId.make(secondRow.id);
          const firstProposal = firstCandidate.assessment.proposals[0];
          const secondProposal = secondCandidate.assessment.proposals[0];
          const firstCommand = ReviewContradictionCandidate.make({
            candidateId: firstId,
            decision: {
              decision: "supersedeProposal",
              proposalDigest: firstProposal.proposalDigest,
              proposalId: firstProposal.proposalId,
              reason: "Approve the first correction.",
            },
            expectedCandidateVersion: firstCandidate.rowVersion,
          });
          const secondCommand = ReviewContradictionCandidate.make({
            candidateId: secondId,
            decision: {
              decision: "supersedeProposal",
              proposalDigest: secondProposal.proposalDigest,
              proposalId: secondProposal.proposalId,
              reason: "Approve the second correction.",
            },
            expectedCandidateVersion: secondCandidate.rowVersion,
          });
          const scope = ContradictionReviewScope.of({
            orgId: firstCandidate.orgId,
            sourceScopeRef: "workspace:postgres-supersession-race",
          });
          yield* TestClock.setTime(2_000);

          const outcomes = yield* Effect.scoped(
            Effect.gen(function* () {
              const first = yield* openStack();
              const second = yield* openStack();
              const [firstPid, secondPid] = yield* Effect.all([readBackendPid(first.sql), readBackendPid(second.sql)]);
              expect(firstPid).not.toBe(secondPid);

              const lockHeld = yield* Deferred.make<void>();
              const blocker = sql.withTransaction(
                Effect.gen(function* () {
                  yield* sql`
                    SELECT id
                    FROM epistemic_edge_version
                    WHERE id = ${shared.id} AND expired_at IS NULL
                    FOR UPDATE
                  `;
                  yield* Deferred.succeed(lockHeld, undefined);
                  yield* expectBothWritersWaiting(sql, firstPid, secondPid);
                })
              );
              const [, raced] = yield* Effect.all(
                [
                  Effect.asVoid(blocker),
                  Deferred.await(lockHeld).pipe(
                    Effect.andThen(
                      Effect.all(
                        [
                          Effect.result(first.repository.review(firstCommand, systemPrincipal, scope)),
                          Effect.result(second.repository.review(secondCommand, systemPrincipal, scope)),
                        ],
                        { concurrency: "unbounded" }
                      )
                    )
                  ),
                ],
                { concurrency: "unbounded" }
              );
              return raced;
            })
          );

          const successes = pipe(
            outcomes,
            A.filter(Result.isSuccess),
            A.map((outcome) => outcome.success)
          );
          const failures = A.filter(outcomes, Result.isFailure);
          expect(A.length(successes)).toBe(1);
          expect(A.every(successes, (disposition) => Eq.equals(disposition.decision.status, "superseded"))).toBe(true);
          expect(A.length(failures)).toBe(1);
          expect(A.every(failures, (outcome) => SupersessionConflict.is(outcome.failure))).toBe(true);
          const successfulDisposition = yield* pipe(
            successes,
            A.head,
            O.match({
              onNone: () => Effect.die("expected one successful supersession disposition"),
              onSome: Effect.succeed,
            })
          );
          if (successfulDisposition.decision.status !== "superseded") {
            return yield* Effect.die("expected the successful disposition to supersede the shared edge");
          }

          const recovered = yield* Effect.scoped(
            Effect.gen(function* () {
              const restarted = yield* openStack();
              const candidates = yield* Effect.all([
                restarted.repository.get(
                  GetExpandedContradictionCandidate.make({
                    candidateId: firstId,
                    knownAt: DateTime.makeUnsafe(2_000),
                    orgId: firstCandidate.orgId,
                    sourceScopeRef: "workspace:postgres-supersession-race",
                    validAt: DateTime.makeUnsafe(2_000),
                  })
                ),
                restarted.repository.get(
                  GetExpandedContradictionCandidate.make({
                    candidateId: secondId,
                    knownAt: DateTime.makeUnsafe(2_000),
                    orgId: secondCandidate.orgId,
                    sourceScopeRef: "workspace:postgres-supersession-race",
                    validAt: DateTime.makeUnsafe(2_000),
                  })
                ),
              ]);
              const latest = yield* restarted.edges.readLatest(shared.logicalKey);
              const edgeCounts = yield* restarted.sql<{
                readonly count: number;
                readonly openCount: number;
              }>`
                SELECT
                  COUNT(*)::int AS count,
                  COUNT(*) FILTER (WHERE expired_at IS NULL)::int AS "openCount"
                FROM epistemic_edge_version
                WHERE logical_key = ${shared.logicalKey}
              `;
              const dispositionCounts = yield* restarted.sql<{ readonly count: number }>`
                SELECT COUNT(*)::int AS count
                FROM epistemic_contradiction_disposition
                WHERE candidate_id = ${firstId} OR candidate_id = ${secondId}
              `;
              return { candidates, dispositionCounts, edgeCounts, latest };
            })
          );

          expect(A.map(recovered.edgeCounts, (row) => row.count)).toEqual([2]);
          expect(A.map(recovered.edgeCounts, (row) => row.openCount)).toEqual([1]);
          expect(A.map(recovered.dispositionCounts, (row) => row.count)).toEqual([1]);
          const candidateViews = A.getSomes(recovered.candidates);
          expect(A.length(candidateViews)).toBe(2);
          const persistedDispositions = A.getSomes(A.map(candidateViews, (view) => view.disposition));
          expect(A.length(persistedDispositions)).toBe(1);
          const persistedDisposition = yield* pipe(
            persistedDispositions,
            A.head,
            O.match({
              onNone: () => Effect.die("expected one persisted supersession disposition"),
              onSome: Effect.succeed,
            })
          );
          if (persistedDisposition.decision.status !== "superseded") {
            return yield* Effect.die("expected the persisted disposition to supersede the shared edge");
          }
          expect(persistedDisposition.id).toBe(successfulDisposition.id);
          expect(O.isSome(recovered.latest)).toBe(true);
          if (O.isNone(recovered.latest)) {
            return yield* Effect.die("expected the replacement edge after rebuilding the repository stack");
          }
          expect(recovered.latest.value.version).toBe(2);
          expect(recovered.latest.value.supersedesId).toStrictEqual(O.some(shared.id));
          expect(recovered.latest.value.id).toBe(successfulDisposition.decision.replacementEdgeVersionId);
          expect(recovered.latest.value.id).toBe(persistedDisposition.decision.replacementEdgeVersionId);
        }),
        180_000
      );
    });
  });
}

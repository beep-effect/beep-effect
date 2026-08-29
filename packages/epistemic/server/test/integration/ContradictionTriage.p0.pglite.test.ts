import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values";
import { makeDrizzleEdgeAuthorityRepository } from "@beep/epistemic-server";
import { DbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { EdgeAsOfQuery, RecordEdgeFact, SupersedeEdgeFact } from "@beep/epistemic-use-cases/EdgeAuthority";
import * as Pglite from "@beep/pglite";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { makePgliteIntegrationGate, productEntityFixtureInput, provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { bigint, jsonb, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { Data, Effect, FileSystem, flow, Layer, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const TempDirServices = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const makePersistentLayer = (dataDir: string) =>
  makeDrizzleLayer().pipe(
    Layer.provideMerge(Pglite.makeLayer({ dataDir, extensions: { btree_gist }, relaxedDurability: true }))
  );

const candidateTable = pgTable(
  "epistemic_contradiction_p0_candidate",
  {
    candidateKey: text("candidate_key").notNull(),
    id: serial("id").primaryKey(),
    payloadDigest: text("payload_digest").notNull(),
    recordedAt: bigint("recorded_at", { mode: "number" }).notNull(),
    validFrom: bigint("valid_from", { mode: "number" }).notNull(),
    validTo: bigint("valid_to", { mode: "number" }),
  },
  (table) => [uniqueIndex("epistemic_contradiction_p0_candidate_key_unique").on(table.candidateKey)]
);

const receiptTable = pgTable("epistemic_contradiction_p0_receipt", {
  candidateId: bigint("candidate_id", { mode: "number" }).notNull(),
  id: serial("id").primaryKey(),
  receivedAt: bigint("received_at", { mode: "number" }).notNull(),
});

const dispositionTable = pgTable(
  "epistemic_contradiction_p0_disposition",
  {
    candidateId: bigint("candidate_id", { mode: "number" }).notNull(),
    decision: jsonb("decision").notNull(),
    id: serial("id").primaryKey(),
    resolvedAt: bigint("resolved_at", { mode: "number" }).notNull(),
  },
  (table) => [uniqueIndex("epistemic_contradiction_p0_disposition_candidate_unique").on(table.candidateId)]
);

type BeliefRef = {
  readonly edgeVersionId: number;
  readonly logicalKey: string;
  readonly version: number;
};

type MatchBasisKind = "independent-evidence" | "same-source-overlap";

class CandidatePayloadConflict extends Data.TaggedError("CandidatePayloadConflict")<{
  readonly candidateKey: string;
}> {}

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const encodeBeliefRef = (ref: BeliefRef): string => `${ref.logicalKey}:${ref.edgeVersionId}:${ref.version}`;

const evidenceDigest = (evidenceIds: ReadonlyArray<number>): string =>
  digest(
    pipe(
      evidenceIds,
      A.map((id) => `${id}`),
      A.sort(Order.String),
      A.join("|")
    )
  );

const candidateKey = (
  pair: readonly [BeliefRef, BeliefRef],
  basis: { readonly evidenceDigest: string; readonly kind: MatchBasisKind }
): string =>
  digest(
    [
      "v1",
      ...pipe(pair, A.fromIterable, A.map(encodeBeliefRef), A.sort(Order.String)),
      basis.kind,
      basis.evidenceDigest,
    ].join("|")
  );

const decodeClaim = flow(S.decodeUnknownResult(CandidateClaim), Result.getOrThrow);
const decodeEvidence = flow(S.decodeUnknownResult(Evidence), Result.getOrThrow);
const decodeIdentity = flow(S.decodeUnknownResult(LogicalEdgeIdentity), Result.getOrThrow);
const decodeRecord = flow(S.decodeUnknownResult(RecordEdgeFact), Result.getOrThrow);
const decodeSupersede = flow(S.decodeUnknownResult(SupersedeEdgeFact), Result.getOrThrow);
const decodeAsOf = flow(S.decodeUnknownResult(EdgeAsOfQuery), Result.getOrThrow);
const systemPrincipal = { component: "Runtime", kind: "System" } as const;

const requireHead = <Row>(rows: ReadonlyArray<Row>, what: string): Effect.Effect<Row> =>
  pipe(
    rows,
    A.head,
    O.match({
      onNone: () => Effect.die(`expected ${what}`),
      onSome: Effect.succeed,
    })
  );

const fixtureIdentity = (
  sourceClaimId: number,
  targetEvidenceId: number,
  qualifier: string,
  evidenceScope: string | null = null
) =>
  ({
    evidenceScope,
    matterScope: null,
    orgScope: "1",
    qualifiers: { fixture: qualifier },
    relation: "supports",
    source: { claimId: sourceClaimId, kind: "claim" },
    target: { evidenceId: targetEvidenceId, kind: "evidence" },
  }) as const;

const recordFact = (
  identity: typeof LogicalEdgeIdentity.Encoded,
  fact: Record<string, unknown>,
  recordedAt: number,
  validFrom: number
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
  expectedVersion: number,
  fact: Record<string, unknown>,
  recordedAt: number,
  validFrom: number
) =>
  decodeSupersede({
    expectedVersion,
    fact,
    identity,
    orgId: 1,
    recordedAt,
    recordedBy: systemPrincipal,
    schemaVersion: "0.0.0",
    source: "User",
    validFrom,
    validTo: null,
  });

const asOf = (identity: typeof LogicalEdgeIdentity.Encoded, validAt: number, knownAt: number) =>
  decodeAsOf({ knownAt, logicalKey: logicalEdgeKey(decodeIdentity(identity)), validAt });

const createFixtureTables = Effect.fnUntraced(function* () {
  const db = yield* makeDrizzle();
  yield* db.execute(sql`
    CREATE TABLE epistemic_contradiction_p0_candidate (
      id SERIAL PRIMARY KEY,
      candidate_key TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      recorded_at BIGINT NOT NULL,
      valid_from BIGINT NOT NULL,
      valid_to BIGINT,
      CONSTRAINT epistemic_contradiction_p0_valid_interval_ordered
        CHECK (valid_to IS NULL OR valid_from < valid_to)
    )
  `);
  yield* db.execute(sql`
    CREATE UNIQUE INDEX epistemic_contradiction_p0_candidate_key_unique
      ON epistemic_contradiction_p0_candidate (candidate_key)
  `);
  yield* db.execute(sql`
    CREATE TABLE epistemic_contradiction_p0_receipt (
      id SERIAL PRIMARY KEY,
      candidate_id BIGINT NOT NULL REFERENCES epistemic_contradiction_p0_candidate(id),
      received_at BIGINT NOT NULL
    )
  `);
  yield* db.execute(sql`
    CREATE TABLE epistemic_contradiction_p0_disposition (
      id SERIAL PRIMARY KEY,
      candidate_id BIGINT NOT NULL REFERENCES epistemic_contradiction_p0_candidate(id),
      decision JSONB NOT NULL,
      resolved_at BIGINT NOT NULL,
      CONSTRAINT epistemic_contradiction_p0_disposition_candidate_unique UNIQUE (candidate_id)
    )
  `);
});

const runFirstScope = Effect.fnUntraced(function* () {
  const db = yield* makeDrizzle();
  yield* migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });
  yield* createFixtureTables();

  const claims = yield* db
    .insert(DbSchema.candidateClaim)
    .values([
      toCandidateClaimInsert(
        decodeClaim({
          ...productEntityFixtureInput("EpistemicCandidateClaim", 801),
          fixtureKey: "claim-a",
          lifecycle: "candidate",
          snapshot: {},
        })
      ),
      toCandidateClaimInsert(
        decodeClaim({
          ...productEntityFixtureInput("EpistemicCandidateClaim", 802),
          fixtureKey: "claim-b",
          lifecycle: "candidate",
          snapshot: {},
        })
      ),
    ])
    .returning();
  const evidence = yield* db
    .insert(DbSchema.evidence)
    .values([
      toEvidenceInsert(
        decodeEvidence({
          ...productEntityFixtureInput("EpistemicEvidence", 801),
          artifactFixtureKey: "contradiction-p0.source-a",
          span: { confidence: 0.95, endChar: 8, quote: "amount A", startChar: 0 },
          spanFixtureKey: "span-a",
        })
      ),
      toEvidenceInsert(
        decodeEvidence({
          ...productEntityFixtureInput("EpistemicEvidence", 802),
          artifactFixtureKey: "contradiction-p0.source-b",
          span: { confidence: 0.94, endChar: 8, quote: "amount B", startChar: 0 },
          spanFixtureKey: "span-b",
        })
      ),
    ])
    .returning();
  const claimA = yield* requireHead(claims, "claim A");
  const claimB = yield* requireHead(A.drop(claims, 1), "claim B");
  const evidenceA = yield* requireHead(evidence, "evidence A");
  const evidenceB = yield* requireHead(A.drop(evidence, 1), "evidence B");

  const identityA = fixtureIdentity(claimA.id, evidenceA.id, "lineage-a", "anchor-a");
  const sameIdentityA = fixtureIdentity(claimA.id, evidenceA.id, "lineage-a", "anchor-a");
  const distinctAnchorA = fixtureIdentity(claimA.id, evidenceA.id, "lineage-a", "anchor-b");
  expect(logicalEdgeKey(decodeIdentity(identityA))).toBe(logicalEdgeKey(decodeIdentity(sameIdentityA)));
  expect(logicalEdgeKey(decodeIdentity(identityA))).not.toBe(logicalEdgeKey(decodeIdentity(distinctAnchorA)));

  const symmetricForward = decodeIdentity({
    evidenceScope: null,
    matterScope: null,
    orgScope: "1",
    qualifiers: { fixture: "symmetric" },
    relation: "contradicts",
    source: { claimId: claimA.id, kind: "claim" },
    target: { claimId: claimB.id, kind: "claim" },
  });
  const symmetricBackward = decodeIdentity({
    evidenceScope: null,
    matterScope: null,
    orgScope: "1",
    qualifiers: { fixture: "symmetric" },
    relation: "contradicts",
    source: { claimId: claimB.id, kind: "claim" },
    target: { claimId: claimA.id, kind: "claim" },
  });
  expect(logicalEdgeKey(symmetricForward)).toBe(logicalEdgeKey(symmetricBackward));

  const identityB = fixtureIdentity(claimB.id, evidenceB.id, "lineage-b");
  const repository = yield* makeDrizzleEdgeAuthorityRepository();
  const beliefA = yield* repository.record(recordFact(identityA, { amount: "100" }, 1_000, 1_000));
  const beliefB = yield* repository.record(recordFact(identityB, { amount: "150" }, 1_100, 1_000));
  const refA: BeliefRef = {
    edgeVersionId: beliefA.id,
    logicalKey: beliefA.logicalKey,
    version: beliefA.version,
  };
  const refB: BeliefRef = {
    edgeVersionId: beliefB.id,
    logicalKey: beliefB.logicalKey,
    version: beliefB.version,
  };
  const basis = {
    evidenceDigest: evidenceDigest([evidenceA.id, evidenceB.id]),
    kind: "independent-evidence" as const,
  };
  const forwardKey = candidateKey([refA, refB], basis);
  const backwardKey = candidateKey([refB, refA], basis);
  expect(forwardKey).toBe(backwardKey);

  const proposal = {
    fact: { amount: "125" },
    losingBelief: refA,
    proposalId: digest("contradiction-p0.proposal-a"),
    rationale: "Independent records disagree; the signed amendment controls.",
    validFrom: 1_000,
    validTo: null,
  };
  const proposalDigest = digest(
    [
      "v1",
      proposal.proposalId,
      encodeBeliefRef(proposal.losingBelief),
      proposal.fact.amount,
      proposal.validFrom,
      "<none>",
      proposal.rationale,
    ].join("|")
  );
  const payloadDigest = digest(["v1", "0.95", proposalDigest].join("|"));

  const submit = Effect.fnUntraced(function* (key: string, candidatePayloadDigest: string, receivedAt: number) {
    const existing = yield* db.select().from(candidateTable).where(eq(candidateTable.candidateKey, key));
    const current = pipe(existing, A.head);
    if (O.isSome(current) && current.value.payloadDigest !== candidatePayloadDigest) {
      return yield* new CandidatePayloadConflict({ candidateKey: key });
    }
    const candidate = yield* pipe(
      current,
      O.match({
        onNone: () =>
          pipe(
            db
              .insert(candidateTable)
              .values({
                candidateKey: key,
                payloadDigest: candidatePayloadDigest,
                recordedAt: 1_200,
                validFrom: 1_000,
                validTo: null,
              })
              .returning(),
            Effect.flatMap((rows) => requireHead(rows, "inserted contradiction candidate"))
          ),
        onSome: Effect.succeed,
      })
    );
    yield* db.insert(receiptTable).values({ candidateId: candidate.id, receivedAt });
    return candidate;
  });

  const candidate = yield* submit(forwardKey, payloadDigest, 1_200);
  const repeated = yield* submit(backwardKey, payloadDigest, 1_300);
  expect(repeated.id).toBe(candidate.id);
  const receipts = yield* db.select().from(receiptTable).where(eq(receiptTable.candidateId, candidate.id));
  expect(receipts).toHaveLength(2);
  const payloadConflict = yield* Effect.flip(submit(forwardKey, digest("materially-different"), 1_400));
  expect(payloadConflict._tag).toBe("CandidatePayloadConflict");

  const openAt = (validAt: number, knownAt: number) =>
    db
      .select({ id: candidateTable.id })
      .from(candidateTable)
      .leftJoin(
        dispositionTable,
        and(eq(dispositionTable.candidateId, candidateTable.id), lte(dispositionTable.resolvedAt, knownAt))
      )
      .where(
        and(
          lte(candidateTable.validFrom, validAt),
          or(isNull(candidateTable.validTo), gt(candidateTable.validTo, validAt)),
          lte(candidateTable.recordedAt, knownAt),
          isNull(dispositionTable.id)
        )
      );

  expect(yield* openAt(1_500, 1_500)).toHaveLength(1);
  const unchangedA = yield* repository.readAsOf(asOf(identityA, 1_500, 1_900));
  const unchangedB = yield* repository.readAsOf(asOf(identityB, 1_500, 1_900));
  expect(O.map(unchangedA, (edge) => edge.fact.amount)).toStrictEqual(O.some("100"));
  expect(O.map(unchangedB, (edge) => edge.fact.amount)).toStrictEqual(O.some("150"));

  const replacement = yield* db.transaction((tx) =>
    Effect.gen(function* () {
      const next = yield* repository.supersede(
        supersedeFact(identityA, beliefA.version, proposal.fact, 2_000, proposal.validFrom)
      );
      yield* tx.insert(dispositionTable).values({
        candidateId: candidate.id,
        decision: {
          proposalDigest,
          proposalId: proposal.proposalId,
          replacementEdgeVersionId: next.id,
          status: "superseded",
        },
        resolvedAt: 2_000,
      });
      return next;
    })
  );
  expect(replacement.supersedesId).toStrictEqual(O.some(beliefA.id));
  expect(yield* openAt(1_500, 1_999)).toHaveLength(1);
  expect(yield* openAt(1_500, 2_000)).toHaveLength(0);

  const historicalA = yield* repository.readAsOf(asOf(identityA, 1_500, 1_500));
  const correctedA = yield* repository.readAsOf(asOf(identityA, 1_500, 2_500));
  const stillOpenB = yield* repository.readAsOf(asOf(identityB, 1_500, 2_500));
  expect(O.map(historicalA, (edge) => edge.fact.amount)).toStrictEqual(O.some("100"));
  expect(O.map(correctedA, (edge) => edge.fact.amount)).toStrictEqual(O.some("125"));
  expect(O.map(stillOpenB, (edge) => edge.fact.amount)).toStrictEqual(O.some("150"));

  const lateB = yield* repository.record(recordFact(identityB, { amount: "140" }, 2_600, 500));
  expect(lateB.version).toBe(2);
  expect(O.map(yield* repository.readAsOf(asOf(identityB, 750, 3_000)), (edge) => edge.fact.amount)).toStrictEqual(
    O.some("140")
  );
  expect(O.map(yield* repository.readAsOf(asOf(identityB, 1_500, 3_000)), (edge) => edge.fact.amount)).toStrictEqual(
    O.some("150")
  );

  const rejectedKey = candidateKey(
    [
      refA,
      {
        edgeVersionId: lateB.id,
        logicalKey: lateB.logicalKey,
        version: lateB.version,
      },
    ],
    {
      evidenceDigest: evidenceDigest([evidenceA.id]),
      kind: "same-source-overlap",
    }
  );
  const rejected = yield* submit(rejectedKey, digest("rejected-payload"), 2_700);
  yield* db.insert(dispositionTable).values({
    candidateId: rejected.id,
    decision: { rationale: "Overlapping text is a quotation, not a factual conflict.", status: "rejected" },
    resolvedAt: 2_800,
  });
  const rejectedDisposition = yield* db
    .select()
    .from(dispositionTable)
    .where(eq(dispositionTable.candidateId, rejected.id));
  expect(rejectedDisposition[0]?.decision).toMatchObject({ status: "rejected" });

  return {
    candidateId: candidate.id,
    candidateKey: forwardKey,
    identityA,
    identityB,
    replacementId: replacement.id,
  };
});

type FirstScopeResult = {
  readonly candidateId: number;
  readonly candidateKey: string;
  readonly identityA: typeof LogicalEdgeIdentity.Encoded;
  readonly identityB: typeof LogicalEdgeIdentity.Encoded;
  readonly replacementId: number;
};

const runSecondScope = Effect.fnUntraced(function* (written: FirstScopeResult) {
  const db = yield* makeDrizzle();
  const repository = yield* makeDrizzleEdgeAuthorityRepository();

  const candidateRows = yield* db
    .select()
    .from(candidateTable)
    .where(and(eq(candidateTable.id, written.candidateId), eq(candidateTable.candidateKey, written.candidateKey)));
  const dispositionRows = yield* db
    .select()
    .from(dispositionTable)
    .where(eq(dispositionTable.candidateId, written.candidateId));
  const correctedA = yield* repository.readAsOf(asOf(written.identityA, 1_500, 2_500));
  const standingB = yield* repository.readAsOf(asOf(written.identityB, 1_500, 3_000));

  expect(candidateRows).toHaveLength(1);
  expect(dispositionRows).toHaveLength(1);
  expect(dispositionRows[0]?.decision).toMatchObject({
    replacementEdgeVersionId: written.replacementId,
    status: "superseded",
  });
  expect(O.map(correctedA, (edge) => edge.fact.amount)).toStrictEqual(O.some("125"));
  expect(O.map(standingB, (edge) => edge.fact.amount)).toStrictEqual(O.some("150"));
});

if (!shouldRunPgliteIntegration) {
  describe.skip("Contradiction-triage P0 fixture gate", () => {});
} else {
  describe("Contradiction-triage P0 fixture gate", { concurrent: false }, () => {
    it.effect(
      "passes identity, symmetry, suppression, visibility, transition, ordering, competing-lineage, and restart gates",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-contradiction-p0-" });
        const dataDir = path.join(tempDir, "pgdata");

        const written = yield* runFirstScope().pipe(provideScopedLayer(makePersistentLayer(dataDir)));
        yield* runSecondScope(written).pipe(provideScopedLayer(makePersistentLayer(dataDir)));
      }, provideScopedLayer(TempDirServices)),
      300_000
    );
  });
}

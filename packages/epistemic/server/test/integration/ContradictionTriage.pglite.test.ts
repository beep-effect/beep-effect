import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { CandidateClaim, ContradictionCandidate, Evidence, EvidenceVerification } from "@beep/epistemic-domain";
import * as ContradictionIdentity from "@beep/epistemic-domain/identity/Epistemic";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values";
import {
  BeliefVersionRef,
  ContradictionAssessment,
  ContradictionBeliefPair,
  ContradictionCandidateContent,
  ContradictionMatchBasis,
  ContradictionProposalDigest,
  ContradictionProposalId,
  ContradictionReceiptKey,
  ContradictionResolutionProposal,
  canonicalizeContradiction,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { EpistemicServerDrizzleLive } from "@beep/epistemic-server/layer";
import { DbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { toContradictionCandidateInsert } from "@beep/epistemic-tables/entities/Contradiction";
import { fromEvidenceRow, toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { toEvidenceVerificationInsert } from "@beep/epistemic-tables/entities/EvidenceVerification";
import { ReviewContradictionCandidate } from "@beep/epistemic-use-cases/public";
import {
  ContradictionReviewConflict,
  ContradictionReviewScope,
  ContradictionSubmissionConflict,
  ContradictionTriageRepository,
  EdgeAsOfQuery,
  EdgeAuthorityRepository,
  GetExpandedContradictionCandidate,
  ListContradictionCandidates,
  RecordEdgeFact,
  SubmitContradictionCandidate,
} from "@beep/epistemic-use-cases/server";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { PosixPath } from "@beep/schema/PosixPath";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import * as SharedIdentity from "@beep/shared-domain/identity/Shared";
import {
  baseEntityFixtureInput,
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, flow, Layer, pipe } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";
import type { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const makeMigrationCapableLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const ContradictionTestLayer = EpistemicServerDrizzleLive.pipe(
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makeMigrationCapableLayer())
);

const decodeClaim = flow(S.decodeUnknownResult(CandidateClaim), Result.getOrThrow);
const decodeEvidence = flow(S.decodeUnknownResult(Evidence), Result.getOrThrow);
const decodeIdentity = flow(S.decodeUnknownResult(LogicalEdgeIdentity), Result.getOrThrow);
const decodeVerification = flow(S.decodeUnknownResult(EvidenceVerification), Result.getOrThrow);
const decodeRecord = flow(S.decodeUnknownResult(RecordEdgeFact), Result.getOrThrow);
const decodeAsOf = flow(S.decodeUnknownResult(EdgeAsOfQuery), Result.getOrThrow);
const instant = flow(S.decodeUnknownResult(EntitySchema.DateTimeFromMillis), Result.getOrThrow);
const decodeEvidenceIds = flow(S.decodeUnknownResult(S.NonEmptyArray(EpistemicIdentity.EvidenceId)), Result.getOrThrow);
const isReceiptKey = S.is(ContradictionReceiptKey);
const receiptKeyEquivalent = S.toEquivalence(ContradictionReceiptKey);
const systemPrincipalEncoded = { component: "Runtime", kind: "System" } as const;
const systemPrincipal = Result.getOrThrow(S.decodeUnknownResult(Principal)(systemPrincipalEncoded));
const contradictionCandidatePublicId = PublicEntityId.factory(ContradictionIdentity.ContradictionCandidateId);
const reviewScope = (orgId: SharedIdentity.OrganizationId) =>
  ContradictionReviewScope.of({ orgId, sourceScopeRef: "workspace:1" });

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

const verifiedAnchorFor = (scenario: number, label: string, anchor: TextAnchor, sourceScopeRef = "workspace:1") =>
  TextAnchorVerificationReceipt.make({
    anchor,
    source: SourceTextIdentity.make({
      extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
      locator: PosixPath.make(`sources/${scenario}-${label}.txt`),
      normalizationVersion: "1",
      scopeRef: sourceScopeRef,
      sourceDigest: SourceTextDigest.make(`sha256:${digest(`source-${scenario}-${label}`)}`),
      sourceRef: `source:${scenario}:${label}`,
      textDigest: SourceTextDigest.make(`sha256:${digest(`text-${scenario}-${label}`)}`),
    }),
  });

const insertVerification = Effect.fnUntraced(function* (
  scenario: number,
  ordinal: number,
  evidenceRow: EvidenceRow,
  createdAt: number,
  sourceScopeRef = "workspace:1"
) {
  const db = yield* makeDrizzle();
  const evidence = fromEvidenceRow(evidenceRow);
  const verifiedAnchor = verifiedAnchorFor(
    scenario,
    `${ordinal}`,
    TextAnchor.make({
      endChar: evidence.span.endChar,
      quote: evidence.span.quote,
      startChar: evidence.span.startChar,
    }),
    sourceScopeRef
  );
  const manifestationKey = yield* Effect.fromResult(
    EvidenceVerification.manifestationKeyFor(evidence.id, verifiedAnchor)
  );
  const verification = decodeVerification({
    ...baseEntityFixtureInput("EpistemicEvidenceVerification", scenario * 100 + ordinal),
    createdAt,
    evidenceId: evidence.id,
    manifestationKey,
    updatedAt: createdAt,
    verifiedAnchor,
  });
  const insert = yield* Effect.fromResult(toEvidenceVerificationInsert(verification, evidence));
  yield* db.insert(DbSchema.evidenceVerification).values(insert);
  return verification;
});

const migrateSchema = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );
  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const requireHead = <Row>(rows: ReadonlyArray<Row>, what: string): Effect.Effect<Row> =>
  pipe(
    rows,
    A.head,
    O.match({
      onNone: () => Effect.die(`expected ${what}`),
      onSome: Effect.succeed,
    })
  );

const seedScenario = Effect.fnUntraced(function* (
  scenario: number,
  organizationId = SharedIdentity.OrganizationId.make(1)
) {
  yield* migrateSchema();
  const db = yield* makeDrizzle();
  const claims = yield* db
    .insert(DbSchema.candidateClaim)
    .values([
      toCandidateClaimInsert(
        decodeClaim({
          ...baseEntityFixtureInput("EpistemicCandidateClaim", scenario * 10 + 1),
          fixtureKey: `contradiction.claim-${scenario}-a`,
          lifecycle: "candidate",
          orgId: organizationId,
          snapshot: {},
        })
      ),
      toCandidateClaimInsert(
        decodeClaim({
          ...baseEntityFixtureInput("EpistemicCandidateClaim", scenario * 10 + 2),
          fixtureKey: `contradiction.claim-${scenario}-b`,
          lifecycle: "candidate",
          orgId: organizationId,
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
          ...baseEntityFixtureInput("EpistemicEvidence", scenario * 10 + 1),
          artifactFixtureKey: `contradiction.source-${scenario}-a`,
          orgId: organizationId,
          span: { confidence: 0.95, endChar: 8, quote: "amount A", startChar: 0 },
          spanFixtureKey: `contradiction.span-${scenario}-a`,
        })
      ),
      toEvidenceInsert(
        decodeEvidence({
          ...baseEntityFixtureInput("EpistemicEvidence", scenario * 10 + 2),
          artifactFixtureKey: `contradiction.source-${scenario}-b`,
          orgId: organizationId,
          span: { confidence: 0.94, endChar: 8, quote: "amount B", startChar: 0 },
          spanFixtureKey: `contradiction.span-${scenario}-b`,
        })
      ),
    ])
    .returning();
  const claimA = yield* requireHead(claims, "claim A");
  const claimB = yield* requireHead(A.drop(claims, 1), "claim B");
  const evidenceA = yield* requireHead(evidence, "evidence A");
  const evidenceB = yield* requireHead(A.drop(evidence, 1), "evidence B");
  const identityA = {
    evidenceScope: null,
    matterScope: null,
    orgScope: `${organizationId}`,
    qualifiers: { scenario: `${scenario}-a` },
    relation: "supports",
    source: { claimId: claimA.id, kind: "claim" },
    target: { evidenceId: evidenceA.id, kind: "evidence" },
  } as const;
  const identityB = {
    evidenceScope: null,
    matterScope: null,
    orgScope: `${organizationId}`,
    qualifiers: { scenario: `${scenario}-b` },
    relation: "supports",
    source: { claimId: claimB.id, kind: "claim" },
    target: { evidenceId: evidenceB.id, kind: "evidence" },
  } as const;
  const edges = yield* EdgeAuthorityRepository;
  const beliefA = yield* edges.record(
    decodeRecord({
      fact: { amount: "100" },
      identity: identityA,
      orgId: organizationId,
      recordedAt: 1_000,
      recordedBy: systemPrincipalEncoded,
      schemaVersion: "0.0.0",
      source: "Agent",
      validFrom: 1_000,
      validTo: null,
    })
  );
  const beliefB = yield* edges.record(
    decodeRecord({
      fact: { amount: "150" },
      identity: identityB,
      orgId: organizationId,
      recordedAt: 1_100,
      recordedBy: systemPrincipalEncoded,
      schemaVersion: "0.0.0",
      source: "Agent",
      validFrom: 1_000,
      validTo: null,
    })
  );
  return { beliefA, beliefB, evidenceA, evidenceB, identityA, identityB };
});

type SeededScenario = {
  readonly beliefA: EdgeVersion;
  readonly beliefB: EdgeVersion;
  readonly evidenceA: EvidenceRow;
  readonly evidenceB: EvidenceRow;
  readonly identityA: typeof LogicalEdgeIdentity.Encoded;
  readonly identityB: typeof LogicalEdgeIdentity.Encoded;
};

interface SubmissionOptions {
  readonly candidateValidFrom?: number;
  readonly candidateValidTo?: number;
  readonly confidence?: number;
  readonly kind?: "independent-evidence" | "same-source-overlap";
  readonly leftEvidenceId?: EpistemicIdentity.EvidenceId;
  readonly leftEvidenceIds?: ReadonlyArray<EpistemicIdentity.EvidenceId>;
  readonly proposalValidFrom?: number;
  readonly proposalValidTo?: number;
  readonly receipt?: string;
  readonly recordedAt?: number;
  readonly reversed?: boolean;
  readonly rightEvidenceId?: EpistemicIdentity.EvidenceId;
  readonly rightEvidenceIds?: ReadonlyArray<EpistemicIdentity.EvidenceId>;
}

const makeSubmission = (scenario: number, seeded: SeededScenario, options: SubmissionOptions = {}) => {
  const beliefA = BeliefVersionRef.make({
    edgeVersionId: seeded.beliefA.id,
    logicalKey: seeded.beliefA.logicalKey,
    version: seeded.beliefA.version,
  });
  const beliefB = BeliefVersionRef.make({
    edgeVersionId: seeded.beliefB.id,
    logicalKey: seeded.beliefB.logicalKey,
    version: seeded.beliefB.version,
  });
  const {
    candidateValidFrom = 1_000,
    candidateValidTo,
    confidence = 0.95,
    kind = "independent-evidence",
    leftEvidenceId,
    leftEvidenceIds: requestedLeftEvidenceIds,
    recordedAt = 1_200,
    proposalValidFrom = 1_000,
    proposalValidTo,
    receipt = `receipt-${scenario}`,
    reversed = false,
    rightEvidenceId,
    rightEvidenceIds: requestedRightEvidenceIds,
  } = options;
  const [pairLeft, pairRight, defaultLeftEvidenceId, defaultRightEvidenceId] = reversed
    ? [beliefB, beliefA, seeded.evidenceB.id, seeded.evidenceA.id]
    : [beliefA, beliefB, seeded.evidenceA.id, seeded.evidenceB.id];
  const pair = ContradictionBeliefPair.make({
    left: pairLeft,
    right: pairRight,
  });
  const leftEvidenceIds = decodeEvidenceIds(requestedLeftEvidenceIds ?? [leftEvidenceId ?? defaultLeftEvidenceId]);
  const rightEvidenceIds = decodeEvidenceIds(requestedRightEvidenceIds ?? [rightEvidenceId ?? defaultRightEvidenceId]);
  const matchBasis = ContradictionMatchBasis.make({
    detector: "fixture",
    detectorVersion: seeded.beliefA.schemaVersion,
    evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
    kind,
    leftEvidenceIds,
    rightEvidenceIds,
  });
  const proposalContent = {
    fact: { amount: "125" },
    losingBelief: beliefA,
    proposalId: ContradictionProposalId.make(digest(`proposal-${scenario}`)),
    rationale: "The signed amendment controls.",
    validFrom: instant(proposalValidFrom),
    validTo: pipe(O.fromNullishOr(proposalValidTo), O.map(instant)),
  };
  const proposal = ContradictionResolutionProposal.make({
    ...proposalContent,
    proposalDigest: Result.getOrThrow(contradictionProposalDigest(proposalContent)),
  });
  return SubmitContradictionCandidate.make({
    assessment: ContradictionAssessment.make({
      confidence: Confidence.make(confidence),
      proposals: [proposal],
    }),
    matchBasis,
    orgId: seeded.beliefA.orgId,
    pair,
    receiptKey: ContradictionReceiptKey.make(digest(receipt)),
    recordedAt: instant(recordedAt),
    receivedBy: systemPrincipal,
    schemaVersion: seeded.beliefA.schemaVersion,
    source: "Agent",
    validFrom: instant(candidateValidFrom),
    validTo: pipe(O.fromNullishOr(candidateValidTo), O.map(instant)),
  });
};

const asOf = (identity: typeof LogicalEdgeIdentity.Encoded, validAt: number, knownAt: number) =>
  decodeAsOf({
    knownAt,
    logicalKey: logicalEdgeKey(decodeIdentity(identity)),
    validAt,
  });

const recordHistoricalBeliefA = Effect.fnUntraced(function* (seeded: SeededScenario, recordedAt: number) {
  const edges = yield* EdgeAuthorityRepository;
  return yield* edges.record(
    decodeRecord({
      fact: { amount: "90" },
      identity: seeded.identityA,
      orgId: seeded.beliefA.orgId,
      recordedAt,
      recordedBy: systemPrincipalEncoded,
      schemaVersion: seeded.beliefA.schemaVersion,
      source: "Agent",
      validFrom: 0,
      validTo: 900,
    })
  );
});

const listQuery = (disposition: "all" | "open" | "rejected" | "superseded", knownAt: number) =>
  ListContradictionCandidates.make({
    disposition,
    knownAt: instant(knownAt),
    limit: PosInt.make(20),
    offset: NonNegativeInt.make(0),
    orgId: 1,
    validAt: instant(1_500),
  });

if (!shouldRunPgliteIntegration) {
  describe.skip("ContradictionTriage repository PGlite integration", () => {});
} else {
  describe("ContradictionTriage repository PGlite integration", { concurrent: false }, () => {
    layer(ContradictionTestLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "canonicalizes repeats, appends receipts, and rejects material payload changes",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(101);
          const repository = yield* ContradictionTriageRepository;
          const first = yield* repository.submit(makeSubmission(101, seeded));
          const repeated = yield* repository.submit(
            makeSubmission(101, seeded, { receipt: "receipt-101-b", reversed: true })
          );
          const retroactiveReceiptConflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(101, seeded, {
                receipt: "receipt-101-retroactive",
                recordedAt: 1_199,
              })
            )
          );

          expect(first.duplicateCandidate).toBe(false);
          expect(repeated.duplicateCandidate).toBe(true);
          expect(repeated.candidate.id).toBe(first.candidate.id);
          expect(ContradictionSubmissionConflict.is(retroactiveReceiptConflict)).toBe(true);
          expect(
            ContradictionSubmissionConflict.is(retroactiveReceiptConflict) && retroactiveReceiptConflict.reason
          ).toBe("receipt-predates-candidate");
          const detail = yield* repository.get(
            GetExpandedContradictionCandidate.make({
              candidateId: first.candidate.id,
              knownAt: instant(1_500),
              orgId: first.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          expect(O.map(detail, (value) => value.receipts.length)).toStrictEqual(O.some(2));

          const conflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(101, seeded, {
                confidence: 0.75,
                receipt: "receipt-101-c",
              })
            )
          );
          expect(ContradictionSubmissionConflict.is(conflict)).toBe(true);
          expect(ContradictionSubmissionConflict.is(conflict) && conflict.reason).toBe("candidate-payload-mismatch");
        }),
        120_000
      );

      it.effect(
        "duplicate-suppresses retries that reorder evidence within one side",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(111);
          const repository = yield* ContradictionTriageRepository;
          const evidenceAId = EpistemicIdentity.EvidenceId.make(seeded.evidenceA.id);
          const evidenceBId = EpistemicIdentity.EvidenceId.make(seeded.evidenceB.id);
          const first = yield* repository.submit(
            makeSubmission(111, seeded, {
              kind: "same-source-overlap",
              leftEvidenceIds: [evidenceBId, evidenceAId],
              receipt: "receipt-111-a",
              rightEvidenceIds: [evidenceBId],
            })
          );
          const repeated = yield* repository.submit(
            makeSubmission(111, seeded, {
              kind: "same-source-overlap",
              leftEvidenceIds: [evidenceAId, evidenceBId],
              receipt: "receipt-111-b",
              rightEvidenceIds: [evidenceBId],
            })
          );

          expect(repeated.duplicateCandidate).toBe(true);
          expect(repeated.candidate.id).toBe(first.candidate.id);
          expect(repeated.candidate.candidateDigest).toBe(first.candidate.candidateDigest);
          expect(repeated.candidate.matchBasis).toStrictEqual(first.candidate.matchBasis);
        }),
        120_000
      );

      it.effect(
        "scopes receipt idempotency to the organization without cross-selecting",
        Effect.fnUntraced(function* () {
          const firstOrganizationId = SharedIdentity.OrganizationId.make(1);
          const secondOrganizationId = SharedIdentity.OrganizationId.make(2);
          const receipt = "shared-organization-receipt";
          const firstSeeded = yield* seedScenario(107, firstOrganizationId);
          const secondSeeded = yield* seedScenario(108, secondOrganizationId);
          const repository = yield* ContradictionTriageRepository;
          const firstCommand = makeSubmission(107, firstSeeded, { receipt });
          const secondCommand = makeSubmission(108, secondSeeded, { receipt });

          const first = yield* repository.submit(firstCommand);
          const repeated = yield* repository.submit(firstCommand);
          const receiptPayloadConflicts = yield* Effect.forEach(
            [
              SubmitContradictionCandidate.make({ ...firstCommand, recordedAt: instant(1_300) }),
              SubmitContradictionCandidate.make({ ...firstCommand, source: "Connector" }),
            ],
            (changedCommand) => Effect.flip(repository.submit(changedCommand)),
            { concurrency: 1 }
          );
          const second = yield* repository.submit(secondCommand);

          expect(first.duplicateCandidate).toBe(false);
          expect(repeated.duplicateCandidate).toBe(true);
          expect(
            A.every(
              receiptPayloadConflicts,
              (conflict) =>
                ContradictionSubmissionConflict.is(conflict) && Eq.equals(conflict.reason, "receipt-key-reused")
            )
          ).toBe(true);
          expect(repeated.receipt.id).toBe(first.receipt.id);
          expect(repeated.receipt.publicId).toBe(first.receipt.publicId);
          expect(repeated.receipt.orgId).toBe(firstOrganizationId);
          expect(second.duplicateCandidate).toBe(false);
          expect(second.receipt.id).not.toBe(first.receipt.id);
          expect(second.receipt.publicId).not.toBe(first.receipt.publicId);
          expect(second.receipt.orgId).toBe(secondOrganizationId);
          expect(second.receipt.candidateId).toBe(second.candidate.id);

          const db = yield* makeDrizzle();
          const receiptRows = A.filter(
            yield* db.select().from(DbSchema.contradictionReceipt),
            (row) => isReceiptKey(row.receiptKey) && receiptKeyEquivalent(row.receiptKey, first.receipt.receiptKey)
          );
          expect(receiptRows).toHaveLength(2);
          expect(A.map(receiptRows, (row) => row.orgId)).toEqual(
            expect.arrayContaining([firstOrganizationId, secondOrganizationId])
          );
        }),
        120_000
      );

      it.effect(
        "isolates the same candidate key across organizations",
        Effect.fnUntraced(function* () {
          const firstOrganizationId = SharedIdentity.OrganizationId.make(1);
          const secondOrganizationId = SharedIdentity.OrganizationId.make(2);
          const seeded = yield* seedScenario(109, firstOrganizationId);
          const command = makeSubmission(109, seeded);
          const normalized = canonicalizeContradiction(command.pair, command.matchBasis);
          const candidateKey = contradictionCandidateKey(normalized.pair, normalized.matchBasis);
          const candidateDigest = Result.getOrThrow(
            contradictionCandidateDigest(
              ContradictionCandidateContent.make({
                assessment: command.assessment,
                matchBasis: normalized.matchBasis,
                pair: normalized.pair,
                validFrom: command.validFrom,
                validTo: command.validTo,
              })
            )
          );
          const foreignCandidate = ContradictionCandidate.make({
            ...baseEntityFixtureInput("EpistemicContradictionCandidate", 10_902),
            assessment: command.assessment,
            candidateDigest,
            candidateKey,
            createdAt: command.recordedAt,
            createdByPrincipal: command.receivedBy,
            entityType: ContradictionIdentity.ContradictionCandidateId.entityType,
            id: ContradictionIdentity.ContradictionCandidateId.make(10_902),
            matchBasis: normalized.matchBasis,
            orgId: secondOrganizationId,
            pair: normalized.pair,
            publicId: contradictionCandidatePublicId.fromUnknown(
              `${ContradictionIdentity.ContradictionCandidateId.tableName}_aforeign${candidateKey}`
            ),
            recordedAt: command.recordedAt,
            rowVersion: PosInt.make(1),
            schemaVersion: command.schemaVersion,
            source: command.source,
            updatedAt: command.recordedAt,
            updatedByPrincipal: command.receivedBy,
            validFrom: command.validFrom,
            validTo: command.validTo,
          });
          const db = yield* makeDrizzle();
          const foreignRows = yield* db
            .insert(DbSchema.contradictionCandidate)
            .values(yield* Effect.fromResult(toContradictionCandidateInsert(foreignCandidate)))
            .returning();
          const foreignRow = yield* requireHead(foreignRows, "foreign contradiction candidate");

          const repository = yield* ContradictionTriageRepository;
          const submitted = yield* repository.submit(command);

          expect(submitted.duplicateCandidate).toBe(false);
          expect(submitted.candidate.candidateKey).toBe(foreignRow.candidateKey);
          expect(submitted.candidate.id).not.toBe(foreignRow.id);
          expect(submitted.candidate.orgId).toBe(firstOrganizationId);
          expect(foreignRow.orgId).toBe(secondOrganizationId);
          expect(submitted.receipt.candidateId).toBe(submitted.candidate.id);
        }),
        120_000
      );

      it.effect(
        "rejects nonexistent and cross-organization evidence before candidate persistence",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(105);
          const repository = yield* ContradictionTriageRepository;
          const db = yield* makeDrizzle();
          const before = yield* db.select().from(DbSchema.contradictionCandidate);

          const missingConflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(105, seeded, {
                leftEvidenceId: EpistemicIdentity.EvidenceId.make(999_999),
                receipt: "receipt-105-missing",
              })
            )
          );
          expect(ContradictionSubmissionConflict.is(missingConflict)).toBe(true);
          expect(ContradictionSubmissionConflict.is(missingConflict) && missingConflict.reason).toBe(
            "candidate-payload-mismatch"
          );

          const crossOrgEvidenceRows = yield* db
            .insert(DbSchema.evidence)
            .values(
              toEvidenceInsert(
                decodeEvidence({
                  ...baseEntityFixtureInput("EpistemicEvidence", 10_503),
                  artifactFixtureKey: "contradiction.source-105-cross-org",
                  orgId: 2,
                  span: {
                    confidence: 0.93,
                    endChar: 8,
                    quote: "amount C",
                    startChar: 0,
                  },
                  spanFixtureKey: "contradiction.span-105-cross-org",
                })
              )
            )
            .returning();
          const crossOrgEvidence = yield* requireHead(crossOrgEvidenceRows, "cross-organization evidence");
          const crossOrgConflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(105, seeded, {
                leftEvidenceId: EpistemicIdentity.EvidenceId.make(crossOrgEvidence.id),
                receipt: "receipt-105-cross-org",
              })
            )
          );
          expect(ContradictionSubmissionConflict.is(crossOrgConflict)).toBe(true);
          expect(ContradictionSubmissionConflict.is(crossOrgConflict) && crossOrgConflict.reason).toBe(
            "candidate-payload-mismatch"
          );

          const after = yield* db.select().from(DbSchema.contradictionCandidate);
          expect(after).toHaveLength(before.length);
        }),
        120_000
      );

      it.effect(
        "rejects candidates recorded before a referenced belief or evidence existed",
        Effect.fnUntraced(function* () {
          const repository = yield* ContradictionTriageRepository;
          const beliefSeeded = yield* seedScenario(1);
          const evidenceSeeded = yield* seedScenario(130);
          const db = yield* makeDrizzle();
          const before = yield* db.select().from(DbSchema.contradictionCandidate);

          const beliefConflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(1, beliefSeeded, {
                recordedAt: 1_050,
                receipt: "receipt-1-before-belief",
              })
            )
          );
          expect(ContradictionSubmissionConflict.is(beliefConflict)).toBe(true);
          expect(ContradictionSubmissionConflict.is(beliefConflict) && beliefConflict.reason).toBe(
            "candidate-predates-input"
          );

          const evidenceConflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(130, evidenceSeeded, {
                receipt: "receipt-130-before-evidence",
              })
            )
          );
          expect(ContradictionSubmissionConflict.is(evidenceConflict)).toBe(true);
          expect(ContradictionSubmissionConflict.is(evidenceConflict) && evidenceConflict.reason).toBe(
            "candidate-predates-input"
          );

          const after = yield* db.select().from(DbSchema.contradictionCandidate);
          expect(after).toHaveLength(before.length);
        }),
        120_000
      );

      it.effect(
        "requires candidate validity to stay inside both referenced belief intervals",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(112);
          const repository = yield* ContradictionTriageRepository;
          const db = yield* makeDrizzle();
          const before = yield* db.select().from(DbSchema.contradictionCandidate);

          const conflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(112, seeded, {
                candidateValidFrom: 999,
                receipt: "receipt-112-outside-belief-intersection",
              })
            )
          );

          expect(ContradictionSubmissionConflict.is(conflict)).toBe(true);
          expect(ContradictionSubmissionConflict.is(conflict) && conflict.reason).toBe("belief-mismatch");
          expect(yield* db.select().from(DbSchema.contradictionCandidate)).toHaveLength(before.length);
        }),
        120_000
      );

      it.effect(
        "rejects proposal intervals that overlap a surviving lineage interval",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(113);
          const repository = yield* ContradictionTriageRepository;
          const db = yield* makeDrizzle();
          yield* recordHistoricalBeliefA(seeded, 1_150);
          const before = yield* db.select().from(DbSchema.contradictionCandidate);

          const conflict = yield* Effect.flip(
            repository.submit(
              makeSubmission(113, seeded, {
                proposalValidFrom: 500,
                receipt: "receipt-113-overlapping-proposal",
              })
            )
          );

          expect(ContradictionSubmissionConflict.is(conflict)).toBe(true);
          expect(ContradictionSubmissionConflict.is(conflict) && conflict.reason).toBe("candidate-payload-mismatch");
          expect(yield* db.select().from(DbSchema.contradictionCandidate)).toHaveLength(before.length);
        }),
        120_000
      );

      it.effect(
        "expands exact beliefs with organization- and source-scoped verification as of query transaction time",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(106);
          const decodedEvidenceA = fromEvidenceRow(seeded.evidenceA);
          const repository = yield* ContradictionTriageRepository;
          const db = yield* makeDrizzle();
          yield* insertVerification(106, 1, seeded.evidenceA, 1_100);
          yield* insertVerification(106, 2, seeded.evidenceA, 1_150);
          const preCandidateVerification = yield* insertVerification(106, 3, seeded.evidenceA, 1_150);
          const unrelatedAnchor = TextAnchorVerificationReceipt.make({
            anchor: TextAnchor.make({
              ...preCandidateVerification.verifiedAnchor.anchor,
              quote: "amount B",
            }),
            source: preCandidateVerification.verifiedAnchor.source,
          });
          const unrelatedVerification = decodeVerification({
            ...baseEntityFixtureInput("EpistemicEvidenceVerification", 10_605),
            createdAt: 1_450,
            evidenceId: decodedEvidenceA.id,
            manifestationKey: Result.getOrThrow(
              EvidenceVerification.manifestationKeyFor(decodedEvidenceA.id, unrelatedAnchor)
            ),
            updatedAt: 1_450,
            verifiedAnchor: unrelatedAnchor,
          });
          // Simulate a legacy/corrupt row that bypassed the guarded converter:
          // detail reads must still refuse to associate this unrelated anchor.
          const encodedUnrelated = yield* Effect.fromResult(
            S.encodeUnknownResult(EvidenceVerification)(unrelatedVerification)
          );
          const { id: _id, ...uncheckedUnrelatedInsert } = encodedUnrelated;
          yield* db.insert(DbSchema.evidenceVerification).values(uncheckedUnrelatedInsert);
          const submitted = yield* repository.submit(makeSubmission(106, seeded));
          const selected = yield* insertVerification(106, 4, seeded.evidenceA, 1_300);
          const selectedB = yield* insertVerification(106, 7, seeded.evidenceB, 1_350);
          yield* insertVerification(106, 6, seeded.evidenceA, 1_400, "workspace:2");

          const expanded = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(1_500),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          expect(O.isSome(expanded)).toBe(true);
          if (O.isNone(expanded)) {
            return yield* Effect.die("expected organization-scoped expanded contradiction detail");
          }

          const evidenceDetails = A.appendAll(expanded.value.left.evidence, expanded.value.right.evidence);
          const evidenceA = pipe(
            evidenceDetails,
            A.findFirst((detail) => detail.evidence.id === seeded.evidenceA.id)
          );
          const evidenceB = pipe(
            evidenceDetails,
            A.findFirst((detail) => detail.evidence.id === seeded.evidenceB.id)
          );
          expect(
            pipe(
              evidenceA,
              O.flatMap((detail) => detail.latestVerification),
              O.map((verification) => verification.manifestationKey)
            )
          ).toStrictEqual(O.some(selected.manifestationKey));
          expect(
            pipe(
              evidenceA,
              O.flatMap((detail) => detail.latestVerification),
              O.map((verification) => verification.verifiedAnchor.source.scopeRef)
            )
          ).toStrictEqual(O.some("workspace:1"));
          expect(
            pipe(
              evidenceB,
              O.flatMap((detail) => detail.latestVerification),
              O.map((verification) => verification.manifestationKey)
            )
          ).toStrictEqual(O.some(selectedB.manifestationKey));
          expect(A.contains([expanded.value.left.belief.id, expanded.value.right.belief.id], seeded.beliefA.id)).toBe(
            true
          );
          expect(A.contains([expanded.value.left.belief.id, expanded.value.right.belief.id], seeded.beliefB.id)).toBe(
            true
          );

          const narrowed = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              evidenceId: O.some(decodedEvidenceA.id),
              knownAt: instant(1_500),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const narrowedEvidence = pipe(
            narrowed,
            O.map((detail) => A.appendAll(detail.left.evidence, detail.right.evidence))
          );
          expect(
            pipe(
              narrowedEvidence,
              O.flatMap(A.findFirst((detail) => Eq.equals(detail.evidence.id, decodedEvidenceA.id))),
              O.flatMap((detail) => detail.latestVerification),
              O.map((verification) => verification.manifestationKey)
            )
          ).toStrictEqual(O.some(selected.manifestationKey));
          expect(
            pipe(
              narrowedEvidence,
              O.flatMap(A.findFirst((detail) => Eq.equals(detail.evidence.id, seeded.evidenceB.id))),
              O.flatMap((detail) => detail.latestVerification)
            )
          ).toStrictEqual(O.none());

          const wrongOrganization = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(1_500),
              orgId: SharedIdentity.OrganizationId.make(2),
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const wrongOrganizationReceiptDetail = yield* repository.get(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(1_500),
              orgId: SharedIdentity.OrganizationId.make(2),
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          expect(wrongOrganization).toStrictEqual(O.none());
          expect(wrongOrganizationReceiptDetail).toStrictEqual(O.none());
        }),
        120_000
      );

      it.effect(
        "refuses to record a review before the candidate transaction time",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(110);
          const repository = yield* ContradictionTriageRepository;
          const submitted = yield* repository.submit(makeSubmission(110, seeded, { recordedAt: 5_000 }));
          yield* TestClock.setTime(2_000);

          const conflict = yield* Effect.flip(
            repository.review(
              ReviewContradictionCandidate.make({
                candidateId: submitted.candidate.id,
                decision: { decision: "reject", reason: "A review cannot predate the candidate." },
                expectedCandidateVersion: submitted.candidate.rowVersion,
              }),
              systemPrincipal,
              reviewScope(submitted.candidate.orgId)
            )
          );
          expect(ContradictionReviewConflict.is(conflict)).toBe(true);
          expect(ContradictionReviewConflict.is(conflict) && conflict.reason).toBe("stale-candidate");

          const detail = yield* repository.get(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(6_000),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          expect(
            pipe(
              detail,
              O.flatMap((value) => value.disposition)
            )
          ).toStrictEqual(O.none());
        }),
        120_000
      );

      it.effect(
        "queries both axes and records a durable rejection",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(102);
          const repository = yield* ContradictionTriageRepository;
          const submitted = yield* repository.submit(makeSubmission(102, seeded));

          const openPage = yield* repository.list(listQuery("open", 1_500));
          const listedCandidate = pipe(
            openPage.items,
            A.findFirst((item) => item.candidate.id === submitted.candidate.id),
            O.map((item) => item.candidate)
          );
          expect(O.map(listedCandidate, (candidate) => "assessment" in candidate)).toStrictEqual(O.some(false));
          expect(O.map(listedCandidate, (candidate) => candidate.summary)).toStrictEqual(
            O.some(submitted.candidate.assessment.proposals[0].rationale)
          );
          expect(O.map(listedCandidate, (candidate) => candidate.confidence)).toStrictEqual(
            O.some(submitted.candidate.assessment.confidence)
          );
          yield* TestClock.setTime(2_000);
          const wrongOrganization = yield* Effect.flip(
            repository.review(
              ReviewContradictionCandidate.make({
                candidateId: submitted.candidate.id,
                decision: {
                  decision: "reject",
                  reason: "An out-of-scope review must not resolve this candidate.",
                },
                expectedCandidateVersion: submitted.candidate.rowVersion,
              }),
              systemPrincipal,
              reviewScope(SharedIdentity.OrganizationId.make(2))
            )
          );
          expect(ContradictionReviewConflict.is(wrongOrganization)).toBe(true);
          expect(ContradictionReviewConflict.is(wrongOrganization) && wrongOrganization.reason).toBe("not-found");

          const disposition = yield* repository.review(
            ReviewContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              decision: { decision: "reject", reason: "The passages address different accounting periods." },
              expectedCandidateVersion: submitted.candidate.rowVersion,
            }),
            systemPrincipal,
            reviewScope(submitted.candidate.orgId)
          );

          expect(disposition.decision.status).toBe("rejected");
          expect(
            A.some(
              (yield* repository.list(listQuery("open", 1_999))).items,
              (item) => item.candidate.id === submitted.candidate.id
            )
          ).toBe(true);
          expect(
            A.some(
              (yield* repository.list(listQuery("open", 2_000))).items,
              (item) => item.candidate.id === submitted.candidate.id
            )
          ).toBe(false);
          expect(
            A.some(
              (yield* repository.list(listQuery("rejected", 2_000))).items,
              (item) => item.candidate.id === submitted.candidate.id
            )
          ).toBe(true);

          const historicalDetail = yield* repository.get(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(1_999),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const currentDetail = yield* repository.get(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(2_000),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const outsideValidity = yield* repository.get(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(2_000),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(999),
            })
          );
          const historicalExpanded = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(1_999),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const currentExpanded = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(2_000),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const outsideExpandedValidity = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(2_000),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(999),
            })
          );
          expect(
            pipe(
              historicalDetail,
              O.flatMap((detail) => detail.disposition)
            )
          ).toStrictEqual(O.none());
          expect(
            pipe(
              currentDetail,
              O.flatMap((detail) => detail.disposition),
              O.map((detail) => detail.decision.status)
            )
          ).toStrictEqual(O.some("rejected"));
          expect(outsideValidity).toStrictEqual(O.none());
          expect(
            pipe(
              historicalExpanded,
              O.flatMap((expanded) => expanded.disposition)
            )
          ).toStrictEqual(O.none());
          expect(
            pipe(
              currentExpanded,
              O.flatMap((expanded) => expanded.disposition),
              O.map((detail) => detail.decision.status)
            )
          ).toStrictEqual(O.some("rejected"));
          expect(outsideExpandedValidity).toStrictEqual(O.none());
        }),
        120_000
      );

      it.effect(
        "approves only the persisted proposal and atomically supersedes one lineage",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(103);
          const repository = yield* ContradictionTriageRepository;
          const edges = yield* EdgeAuthorityRepository;
          const submitted = yield* repository.submit(makeSubmission(103, seeded));
          const proposal = submitted.candidate.assessment.proposals[0];
          yield* TestClock.setTime(2_000);

          const disposition = yield* repository.review(
            ReviewContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              decision: {
                decision: "supersedeProposal",
                proposalDigest: proposal.proposalDigest,
                proposalId: proposal.proposalId,
                reason: "Approved against the controlling signed source.",
              },
              expectedCandidateVersion: submitted.candidate.rowVersion,
            }),
            systemPrincipal,
            reviewScope(submitted.candidate.orgId)
          );

          expect(disposition.decision.status).toBe("superseded");
          const before = yield* edges.readAsOf(asOf(seeded.identityA, 1_500, 1_500));
          const after = yield* edges.readAsOf(asOf(seeded.identityA, 1_500, 2_500));
          const competing = yield* edges.readAsOf(asOf(seeded.identityB, 1_500, 2_500));
          const historicalExpanded = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(1_500),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const currentExpanded = yield* repository.getExpanded(
            GetExpandedContradictionCandidate.make({
              candidateId: submitted.candidate.id,
              knownAt: instant(2_500),
              orgId: submitted.candidate.orgId,
              sourceScopeRef: "workspace:1",
              validAt: instant(1_500),
            })
          );
          const losingBeliefExpiration = (expanded: typeof historicalExpanded) =>
            pipe(
              expanded,
              O.flatMap((detail) =>
                A.findFirst([detail.left.belief, detail.right.belief], (belief) => belief.id === seeded.beliefA.id)
              ),
              O.flatMap((belief) => belief.expiredAt)
            );
          expect(O.map(before, (edge) => edge.fact.amount)).toStrictEqual(O.some("100"));
          expect(O.map(after, (edge) => edge.fact.amount)).toStrictEqual(O.some("125"));
          expect(O.map(competing, (edge) => edge.fact.amount)).toStrictEqual(O.some("150"));
          expect(losingBeliefExpiration(historicalExpanded)).toStrictEqual(O.none());
          expect(losingBeliefExpiration(currentExpanded)).toStrictEqual(O.some(instant(2_000)));
          expect(
            A.some(
              (yield* repository.list(listQuery("superseded", 2_000))).items,
              (item) => item.candidate.id === submitted.candidate.id
            )
          ).toBe(true);
        }),
        120_000
      );

      it.effect(
        "refuses a proposal when a surviving overlap appears after submission",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(114);
          const repository = yield* ContradictionTriageRepository;
          const edges = yield* EdgeAuthorityRepository;
          const submitted = yield* repository.submit(
            makeSubmission(114, seeded, {
              proposalValidFrom: 500,
              receipt: "receipt-114-before-overlap",
            })
          );
          const proposal = submitted.candidate.assessment.proposals[0];
          yield* recordHistoricalBeliefA(seeded, 1_300);
          yield* TestClock.setTime(2_000);

          const conflict = yield* Effect.flip(
            repository.review(
              ReviewContradictionCandidate.make({
                candidateId: submitted.candidate.id,
                decision: {
                  decision: "supersedeProposal",
                  proposalDigest: proposal.proposalDigest,
                  proposalId: proposal.proposalId,
                  reason: "Attempt after the lineage gained an overlapping interval.",
                },
                expectedCandidateVersion: submitted.candidate.rowVersion,
              }),
              systemPrincipal,
              reviewScope(submitted.candidate.orgId)
            )
          );

          expect(ContradictionReviewConflict.is(conflict)).toBe(true);
          expect(ContradictionReviewConflict.is(conflict) && conflict.reason).toBe("stale-candidate");
          const unchanged = yield* edges.readAsOf(asOf(seeded.identityA, 1_500, 2_500));
          expect(O.map(unchanged, (edge) => edge.fact.amount)).toStrictEqual(O.some("100"));
        }),
        120_000
      );

      it.effect(
        "refuses a stale proposal digest without touching authority",
        Effect.fnUntraced(function* () {
          const seeded = yield* seedScenario(104);
          const repository = yield* ContradictionTriageRepository;
          const edges = yield* EdgeAuthorityRepository;
          const submitted = yield* repository.submit(makeSubmission(104, seeded));
          const proposal = submitted.candidate.assessment.proposals[0];
          yield* TestClock.setTime(2_000);

          const conflict = yield* Effect.flip(
            repository.review(
              ReviewContradictionCandidate.make({
                candidateId: submitted.candidate.id,
                decision: {
                  decision: "supersedeProposal",
                  proposalDigest: ContradictionProposalDigest.make(digest("stale-proposal-digest")),
                  proposalId: proposal.proposalId,
                  reason: "Attempt with a stale digest.",
                },
                expectedCandidateVersion: submitted.candidate.rowVersion,
              }),
              systemPrincipal,
              reviewScope(submitted.candidate.orgId)
            )
          );
          expect(conflict._tag).toBe("ContradictionReviewConflict");
          const unchanged = yield* edges.readAsOf(asOf(seeded.identityA, 1_500, 2_500));
          expect(O.map(unchanged, (edge) => edge.fact.amount)).toStrictEqual(O.some("100"));
        }),
        120_000
      );
    });
  });
}

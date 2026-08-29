/**
 * Drizzle-backed contradiction-triage repository.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ContradictionCandidate,
  ContradictionDisposition,
  ContradictionReceipt,
} from "@beep/epistemic-domain/entities/Contradiction";
import { EdgeVersion, unflattenEdgeSource, unflattenEdgeTarget } from "@beep/epistemic-domain/entities/EdgeVersion";
import {
  BeliefVersionRef,
  ContradictionAssessment,
  ContradictionDispositionDecision,
  ContradictionProposalId,
  canonicalizeContradiction,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { EvidenceSpan } from "@beep/epistemic-domain/values/EvidenceSpan";
import { LogicalEdgeIdentity } from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import { DbSchema } from "@beep/epistemic-tables";
import {
  fromContradictionCandidateRow,
  fromContradictionDispositionRow,
  fromContradictionReceiptRow,
  toContradictionCandidateInsert,
  toContradictionDispositionInsert,
  toContradictionReceiptInsert,
} from "@beep/epistemic-tables/entities/Contradiction";
import { fromEdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion";
import { fromEvidenceRow } from "@beep/epistemic-tables/entities/Evidence";
import { fromEvidenceVerificationRow } from "@beep/epistemic-tables/entities/EvidenceVerification";
import {
  ContradictionBeliefDetail,
  ContradictionCandidateDetail,
  ContradictionCandidateExpandedDetail,
  ContradictionCandidatePage,
  ContradictionCandidateSummary,
  ContradictionCandidateView,
  ContradictionEvidenceDetail,
  ContradictionRepositoryUnavailable,
  ContradictionReviewConflict,
  ContradictionSubmission,
  ContradictionSubmissionConflict,
  ContradictionTriageRepository,
  EdgeAuthorityError,
  SupersedeEdgeFact,
} from "@beep/epistemic-use-cases/server";
import { PostgresDrizzle } from "@beep/postgres";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { A, O } from "@beep/utils";
import { and, count, desc, eq, getColumns, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { DateTime, Effect, Match, Order, pipe, Semaphore } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { supersedeEdgeFactInTransaction, supersessionHeadOf } from "../EdgeAuthority/EdgeAuthority.repo.ts";
import type { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import type {
  ContradictionCandidateKey,
  ContradictionResolutionProposal,
} from "@beep/epistemic-domain/values/Contradiction";
import type {
  ContradictionDispositionFilter,
  ListContradictionCandidates,
  SubmitContradictionCandidate,
} from "@beep/epistemic-use-cases/server";

const candidateTable = DbSchema.contradictionCandidate;
const dispositionTable = DbSchema.contradictionDisposition;
const edgeTable = DbSchema.edgeVersion;
const evidenceTable = DbSchema.evidence;
const evidenceVerificationTable = DbSchema.evidenceVerification;
const receiptTable = DbSchema.contradictionReceipt;

const candidatePublicId = PublicEntityId.factory(Epistemic.ContradictionCandidateId);
const dispositionPublicId = PublicEntityId.factory(Epistemic.ContradictionDispositionId);
const receiptPublicId = PublicEntityId.factory(Epistemic.ContradictionReceiptId);
const pendingCandidateId = Epistemic.ContradictionCandidateId.make(1);
const pendingDispositionId = Epistemic.ContradictionDispositionId.make(1);
const pendingReceiptId = Epistemic.ContradictionReceiptId.make(1);
const beliefRefEquivalent = S.toEquivalence(BeliefVersionRef);
const edgeVersionIdEquivalent = S.toEquivalence(BeliefVersionRef.fields.edgeVersionId);
const proposalIdEquivalent = S.toEquivalence(ContradictionProposalId);
const proposalById = Order.mapInput(Order.String, (proposal: ContradictionResolutionProposal) => proposal.proposalId);
const notLaterThan = Order.isLessThanOrEqualTo(DateTime.Order);
const earlierThan = Order.isLessThan(DateTime.Order);
const decodeCandidateSummary = S.decodeUnknownResult(ContradictionCandidateSummary);

type ValidInterval = {
  readonly validFrom: DateTime.Utc;
  readonly validTo: O.Option<DateTime.Utc>;
};

const startsBeforeEnd = (start: DateTime.Utc, end: O.Option<DateTime.Utc>): boolean =>
  O.match(end, {
    onNone: () => true,
    onSome: (upperBound) => earlierThan(start, upperBound),
  });

const validIntervalsOverlap = (left: ValidInterval, right: ValidInterval): boolean =>
  startsBeforeEnd(left.validFrom, right.validTo) && startsBeforeEnd(right.validFrom, left.validTo);

const validIntervalContains = (outer: ValidInterval, inner: ValidInterval): boolean =>
  notLaterThan(outer.validFrom, inner.validFrom) &&
  O.match(outer.validTo, {
    onNone: () => true,
    onSome: (outerEnd) => O.exists(inner.validTo, (innerEnd) => notLaterThan(innerEnd, outerEnd)),
  });

const proposalTargetsSupersessionHead = (
  proposal: ContradictionResolutionProposal,
  survivingVersions: ReadonlyArray<EdgeVersion>
): boolean =>
  pipe(
    survivingVersions,
    A.filter((version) => Eq.equals(version.logicalKey, proposal.losingBelief.logicalKey)),
    supersessionHeadOf,
    O.exists(
      (head) =>
        edgeVersionIdEquivalent(head.id, proposal.losingBelief.edgeVersionId) &&
        Eq.equals(head.version, proposal.losingBelief.version)
    )
  );

const proposalsAreApplicable = (
  proposals: ReadonlyArray<ContradictionResolutionProposal>,
  survivingVersions: ReadonlyArray<EdgeVersion>
): boolean =>
  A.every(
    proposals,
    (proposal) =>
      proposalTargetsSupersessionHead(proposal, survivingVersions) &&
      A.every(
        survivingVersions,
        (version) =>
          !Eq.equals(version.logicalKey, proposal.losingBelief.logicalKey) ||
          edgeVersionIdEquivalent(version.id, proposal.losingBelief.edgeVersionId) ||
          !validIntervalsOverlap(proposal, version)
      )
  );

const projectEdgeVersionAtKnownAt = (edge: EdgeVersion, knownAt: DateTime.Utc): EdgeVersion =>
  EdgeVersion.make({
    ...edge,
    expiredAt: O.filter(edge.expiredAt, (expiredAt) => notLaterThan(expiredAt, knownAt)),
  });

const edgeMatchesCandidateBelief = (
  edge: EdgeVersion,
  belief: BeliefVersionRef,
  candidate: ContradictionCandidate
): boolean =>
  Eq.equals(edge.logicalKey, belief.logicalKey) &&
  Eq.equals(edge.version, belief.version) &&
  Eq.equals(edge.orgId, candidate.orgId) &&
  A.some([candidate.pair.left, candidate.pair.right], (candidateBelief) =>
    beliefRefEquivalent(belief, candidateBelief)
  );

const candidatePublicIdFor = (orgId: ContradictionCandidate["orgId"], candidateKey: string) =>
  candidatePublicId.fromUnknown(`${Epistemic.ContradictionCandidateId.tableName}_a${orgId}${candidateKey}`);

const receiptPublicIdFor = (orgId: ContradictionReceipt["orgId"], receiptKey: string) =>
  receiptPublicId.fromUnknown(`${Epistemic.ContradictionReceiptId.tableName}_a${orgId}${receiptKey}`);

const dispositionPublicIdFor = (orgId: ContradictionDisposition["orgId"], candidateKey: string) =>
  dispositionPublicId.fromUnknown(`${Epistemic.ContradictionDispositionId.tableName}_a${orgId}${candidateKey}`);

const repositoryUnavailable =
  (operation: "get" | "list" | "review" | "submit") =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ContradictionRepositoryUnavailable, R> =>
    Effect.mapError(effect, (cause) =>
      ContradictionRepositoryUnavailable.during(
        operation,
        `${operation} failed against contradiction-triage storage`,
        cause
      )
    );

const toReviewFailure = Match.type<unknown>().pipe(
  Match.when(ContradictionRepositoryUnavailable.is, (error) => error),
  Match.when(ContradictionReviewConflict.is, (error) => error),
  Match.when(EdgeAuthorityError.is, (error) => error),
  Match.orElse((cause) =>
    ContradictionRepositoryUnavailable.during("review", "review failed against contradiction-triage storage", cause)
  )
);

const reviewFailure = <A2, E, R>(
  effect: Effect.Effect<A2, E, R>
): Effect.Effect<A2, ContradictionRepositoryUnavailable | ContradictionReviewConflict | EdgeAuthorityError, R> =>
  Effect.mapError(effect, toReviewFailure);

const submitFailure = <A2, E, R>(
  effect: Effect.Effect<A2, E, R>
): Effect.Effect<A2, ContradictionRepositoryUnavailable | ContradictionSubmissionConflict, R> =>
  Effect.mapError(effect, (cause) =>
    ContradictionRepositoryUnavailable.is(cause) || ContradictionSubmissionConflict.is(cause)
      ? cause
      : ContradictionRepositoryUnavailable.during("submit", "submit failed against contradiction-triage storage", cause)
  );

const validateBeliefPair = (
  command: SubmitContradictionCandidate,
  versions: ReadonlyArray<EdgeVersion>,
  candidateKey: ContradictionCandidateKey
): Effect.Effect<void, ContradictionSubmissionConflict> => {
  const expected = [command.pair.left, command.pair.right];
  const valid =
    !edgeVersionIdEquivalent(command.pair.left.edgeVersionId, command.pair.right.edgeVersionId) &&
    A.every(expected, (ref) =>
      A.some(
        versions,
        (version) =>
          Eq.equals(version.id, ref.edgeVersionId) &&
          Eq.equals(version.logicalKey, ref.logicalKey) &&
          Eq.equals(version.version, ref.version) &&
          Eq.equals(version.orgId, command.orgId) &&
          validIntervalContains(version, command)
      )
    );
  if (!valid) {
    return Effect.fail(
      ContradictionSubmissionConflict.make({
        candidateKey,
        reason: "belief-mismatch",
      })
    );
  }
  return A.every(versions, (version) => notLaterThan(version.recordedAt, command.recordedAt))
    ? Effect.void
    : Effect.fail(
        ContradictionSubmissionConflict.make({
          candidateKey,
          reason: "candidate-predates-input",
        })
      );
};

const validateProposals = (
  proposals: ReadonlyArray<ContradictionResolutionProposal>,
  survivingVersions: ReadonlyArray<EdgeVersion>,
  candidateKey: ContradictionCandidateKey
): Effect.Effect<void, ContradictionSubmissionConflict> =>
  proposalsAreApplicable(proposals, survivingVersions)
    ? Effect.void
    : Effect.fail(
        ContradictionSubmissionConflict.make({
          candidateKey,
          reason: "candidate-payload-mismatch",
        })
      );

const validateEvidenceSet = (
  command: SubmitContradictionCandidate,
  rows: ReadonlyArray<Evidence>,
  candidateKey: ContradictionCandidateKey,
  evidenceIds: ReadonlyArray<unknown>
): Effect.Effect<void, ContradictionSubmissionConflict> => {
  if (A.length(rows) !== A.length(evidenceIds) || !A.every(rows, (row) => Eq.equals(row.orgId, command.orgId))) {
    return Effect.fail(
      ContradictionSubmissionConflict.make({
        candidateKey,
        reason: "candidate-payload-mismatch",
      })
    );
  }
  return A.every(rows, (row) => notLaterThan(row.createdAt, command.recordedAt))
    ? Effect.void
    : Effect.fail(
        ContradictionSubmissionConflict.make({
          candidateKey,
          reason: "candidate-predates-input",
        })
      );
};

const receiptMatchesSubmission = (
  receipt: ContradictionReceipt,
  candidate: ContradictionCandidate,
  command: SubmitContradictionCandidate
): boolean =>
  A.every(
    [
      [receipt.candidateId, candidate.id],
      [receipt.createdAt, command.recordedAt],
      [receipt.createdByPrincipal, command.receivedBy],
      [receipt.orgId, command.orgId],
      [receipt.publicId, receiptPublicIdFor(command.orgId, command.receiptKey)],
      [receipt.receiptKey, command.receiptKey],
      [receipt.receivedAt, command.recordedAt],
      [receipt.receivedBy, command.receivedBy],
      [receipt.rowVersion, PosInt.make(1)],
      [receipt.schemaVersion, command.schemaVersion],
      [receipt.source, command.source],
      [receipt.updatedAt, command.recordedAt],
      [receipt.updatedByPrincipal, command.receivedBy],
    ],
    ([persisted, submitted]) => Eq.equals(persisted, submitted)
  );

const normalizeSubmission = Effect.fnUntraced(function* (command: SubmitContradictionCandidate) {
  const submittedEvidenceDigest = contradictionEvidenceDigest(
    command.matchBasis.leftEvidenceIds,
    command.matchBasis.rightEvidenceIds
  );
  const normalized = canonicalizeContradiction(command.pair, command.matchBasis);
  const matchBasis = normalized.matchBasis;
  const candidateKey = contradictionCandidateKey(normalized.pair, matchBasis);
  if (!Eq.equals(command.matchBasis.evidenceDigest, submittedEvidenceDigest)) {
    return yield* ContradictionSubmissionConflict.make({
      candidateKey,
      reason: "candidate-payload-mismatch",
    });
  }

  const proposals = pipe(command.assessment.proposals, A.sort(proposalById));
  const proposalValidity = yield* Effect.forEach(
    proposals,
    (proposal) =>
      Effect.fromResult(
        contradictionProposalDigest({
          fact: proposal.fact,
          losingBelief: proposal.losingBelief,
          proposalId: proposal.proposalId,
          rationale: proposal.rationale,
          validFrom: proposal.validFrom,
          validTo: proposal.validTo,
        })
      ).pipe(
        Effect.map(
          (proposalDigest) =>
            Eq.equals(proposal.proposalDigest, proposalDigest) &&
            (beliefRefEquivalent(proposal.losingBelief, normalized.pair.left) ||
              beliefRefEquivalent(proposal.losingBelief, normalized.pair.right))
        )
      ),
    { concurrency: 1 }
  );
  if (!A.every(proposalValidity, (valid) => valid)) {
    return yield* ContradictionSubmissionConflict.make({
      candidateKey,
      reason: "candidate-payload-mismatch",
    });
  }

  const assessment = ContradictionAssessment.make({
    confidence: command.assessment.confidence,
    proposals,
  });
  const candidateDigest = yield* Effect.fromResult(
    contradictionCandidateDigest({
      assessment,
      matchBasis,
      pair: normalized.pair,
      validFrom: command.validFrom,
      validTo: command.validTo,
    })
  );
  return {
    assessment,
    candidateDigest,
    candidateKey,
    matchBasis,
    pair: normalized.pair,
  };
});

const identityOf = Effect.fnUntraced(function* (candidateId: Epistemic.ContradictionCandidateId, edge: EdgeVersion) {
  const source = unflattenEdgeSource(edge);
  const target = unflattenEdgeTarget(edge);
  if (O.isNone(source) || O.isNone(target)) {
    return yield* ContradictionReviewConflict.make({
      candidateId,
      reason: "belief-mismatch",
    });
  }
  return LogicalEdgeIdentity.make({
    evidenceScope: edge.evidenceScope,
    matterScope: edge.matterScope,
    orgScope: `${edge.orgId}`,
    qualifiers: edge.qualifiers,
    relation: edge.relation,
    source: source.value,
    target: target.value,
  });
});

const dispositionWhere = (filter: ContradictionDispositionFilter) =>
  Match.value(filter).pipe(
    Match.when("all", () => undefined),
    Match.when("open", () => isNull(dispositionTable.id)),
    Match.when("rejected", () => sql<boolean>`${dispositionTable.decision} ->> 'status' = 'rejected'`),
    Match.when("superseded", () => sql<boolean>`${dispositionTable.decision} ->> 'status' = 'superseded'`),
    Match.exhaustive
  );

const listWhere = (query: ListContradictionCandidates) => {
  const disposition = dispositionWhere(query.disposition);
  return and(
    eq(candidateTable.orgId, query.orgId),
    lte(candidateTable.validFrom, DateTime.toEpochMillis(query.validAt)),
    or(isNull(candidateTable.validTo), gt(candidateTable.validTo, DateTime.toEpochMillis(query.validAt))),
    lte(candidateTable.recordedAt, DateTime.toEpochMillis(query.knownAt)),
    disposition
  );
};

/**
 * Build the Drizzle contradiction-triage repository.
 *
 * **Example** (Factory returns Effect)
 *
 * ```ts
 * import { makeDrizzleContradictionTriageRepository } from "@beep/epistemic-server"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(makeDrizzleContradictionTriageRepository())) // true
 * ```
 *
 * @effects Reads the configured Postgres Drizzle service and allocates the
 * process-local semaphore that serializes repository writes.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleContradictionTriageRepository = Effect.fnUntraced(function* () {
  const db = yield* PostgresDrizzle;
  const writeSemaphore = Semaphore.makeUnsafe(1);

  return ContradictionTriageRepository.of({
    get: Effect.fn("db.query")(function* (query) {
      yield* Effect.annotateCurrentSpan({
        "db.operation": "select",
        "db.system": "postgresql",
      });
      const knownAt = DateTime.toEpochMillis(query.knownAt);
      const validAt = DateTime.toEpochMillis(query.validAt);
      const candidates = yield* db
        .select()
        .from(candidateTable)
        .where(
          and(
            eq(candidateTable.id, query.candidateId),
            eq(candidateTable.orgId, query.orgId),
            lte(candidateTable.validFrom, validAt),
            or(isNull(candidateTable.validTo), gt(candidateTable.validTo, validAt)),
            lte(candidateTable.recordedAt, knownAt)
          )
        )
        .pipe(repositoryUnavailable("get"));
      const candidateRow = A.head(candidates);
      if (O.isNone(candidateRow)) {
        return O.none();
      }
      const dispositions = yield* db
        .select()
        .from(dispositionTable)
        .where(
          and(
            eq(dispositionTable.candidateId, query.candidateId),
            eq(dispositionTable.orgId, query.orgId),
            lte(dispositionTable.resolvedAt, knownAt)
          )
        )
        .pipe(repositoryUnavailable("get"));
      const receipts = yield* db
        .select()
        .from(receiptTable)
        .where(
          and(
            eq(receiptTable.candidateId, query.candidateId),
            eq(receiptTable.orgId, query.orgId),
            lte(receiptTable.receivedAt, knownAt)
          )
        )
        .orderBy(receiptTable.receivedAt, receiptTable.id)
        .pipe(repositoryUnavailable("get"));
      const candidate = yield* Effect.fromResult(fromContradictionCandidateRow(candidateRow.value)).pipe(
        repositoryUnavailable("get")
      );
      const disposition = yield* pipe(
        A.head(dispositions),
        O.map((row) => Effect.fromResult(fromContradictionDispositionRow(row))),
        Effect.transposeOption,
        repositoryUnavailable("get")
      );
      const decodedReceipts = yield* Effect.forEach(
        receipts,
        (row) => Effect.fromResult(fromContradictionReceiptRow(row)),
        { concurrency: 1 }
      ).pipe(repositoryUnavailable("get"));
      return O.some(
        ContradictionCandidateDetail.make({
          candidate,
          disposition,
          receipts: decodedReceipts,
        })
      );
    }),

    getExpanded: Effect.fn("db.query")(function* (query) {
      yield* Effect.annotateCurrentSpan({
        "db.operation": "select",
        "db.system": "postgresql",
      });
      const knownAt = DateTime.toEpochMillis(query.knownAt);
      const validAt = DateTime.toEpochMillis(query.validAt);
      const candidates = yield* db
        .select()
        .from(candidateTable)
        .where(
          and(
            eq(candidateTable.id, query.candidateId),
            eq(candidateTable.orgId, query.orgId),
            lte(candidateTable.validFrom, validAt),
            or(isNull(candidateTable.validTo), gt(candidateTable.validTo, validAt)),
            lte(candidateTable.recordedAt, knownAt)
          )
        )
        .pipe(repositoryUnavailable("get"));
      const candidateRow = A.head(candidates);
      if (O.isNone(candidateRow)) {
        return O.none();
      }
      const candidate = yield* Effect.fromResult(fromContradictionCandidateRow(candidateRow.value)).pipe(
        repositoryUnavailable("get")
      );
      const edgeRows = yield* db
        .select()
        .from(edgeTable)
        .where(
          and(
            eq(edgeTable.orgId, query.orgId),
            inArray(edgeTable.id, [candidate.pair.left.edgeVersionId, candidate.pair.right.edgeVersionId])
          )
        )
        .pipe(repositoryUnavailable("get"));
      const edges = yield* Effect.forEach(edgeRows, (row) => Effect.try(() => fromEdgeVersionRow(row)), {
        concurrency: 1,
      }).pipe(repositoryUnavailable("get"));
      const left = A.findFirst(
        edges,
        (edge) =>
          Eq.equals(edge.id, candidate.pair.left.edgeVersionId) &&
          Eq.equals(edge.logicalKey, candidate.pair.left.logicalKey) &&
          Eq.equals(edge.version, candidate.pair.left.version)
      );
      const right = A.findFirst(
        edges,
        (edge) =>
          Eq.equals(edge.id, candidate.pair.right.edgeVersionId) &&
          Eq.equals(edge.logicalKey, candidate.pair.right.logicalKey) &&
          Eq.equals(edge.version, candidate.pair.right.version)
      );
      if (O.isNone(left) || O.isNone(right)) {
        return O.none();
      }

      const evidenceIds = [...candidate.matchBasis.leftEvidenceIds, ...candidate.matchBasis.rightEvidenceIds];
      const evidenceRows = yield* db
        .select()
        .from(evidenceTable)
        .where(and(eq(evidenceTable.orgId, query.orgId), inArray(evidenceTable.id, evidenceIds)))
        .pipe(repositoryUnavailable("get"));
      const evidence = yield* Effect.forEach(evidenceRows, (row) => Effect.try(() => fromEvidenceRow(row)), {
        concurrency: 1,
      }).pipe(repositoryUnavailable("get"));
      const verificationEvidenceIds = O.match(query.evidenceId, {
        onNone: () => evidenceIds,
        onSome: (requestedEvidenceId) =>
          A.filter(evidenceIds, (evidenceId) => Eq.equals(evidenceId, requestedEvidenceId)),
      });
      const verificationRows = yield* db
        .selectDistinctOn([evidenceVerificationTable.evidenceId], getColumns(evidenceVerificationTable))
        .from(evidenceVerificationTable)
        .innerJoin(
          evidenceTable,
          and(
            eq(evidenceTable.id, evidenceVerificationTable.evidenceId),
            eq(evidenceTable.orgId, evidenceVerificationTable.orgId)
          )
        )
        .where(
          and(
            eq(evidenceVerificationTable.orgId, query.orgId),
            inArray(evidenceVerificationTable.evidenceId, verificationEvidenceIds),
            lte(evidenceVerificationTable.createdAt, knownAt),
            sql<boolean>`${evidenceVerificationTable.verifiedAnchor} -> 'source' ->> 'scopeRef' = ${query.sourceScopeRef}`,
            sql<boolean>`${evidenceVerificationTable.verifiedAnchor} -> 'anchor' ->> 'startChar' = ${evidenceTable.span} ->> 'startChar'`,
            sql<boolean>`${evidenceVerificationTable.verifiedAnchor} -> 'anchor' ->> 'quote' = ${evidenceTable.span} ->> 'quote'`
          )
        )
        .orderBy(
          evidenceVerificationTable.evidenceId,
          desc(evidenceVerificationTable.createdAt),
          desc(evidenceVerificationTable.id)
        )
        .pipe(repositoryUnavailable("get"));
      const verifications = yield* Effect.forEach(
        verificationRows,
        (row) => Effect.fromResult(fromEvidenceVerificationRow(row)),
        { concurrency: 1 }
      ).pipe(repositoryUnavailable("get"));
      const evidenceDetail = (evidenceId: (typeof evidenceIds)[number]) =>
        pipe(
          evidence,
          A.findFirst((row) => Eq.equals(row.id, evidenceId)),
          O.map((row) =>
            ContradictionEvidenceDetail.make({
              evidence: row,
              latestVerification: A.findFirst(
                verifications,
                (verification) =>
                  Eq.equals(verification.evidenceId, evidenceId) &&
                  EvidenceSpan.matchesAnchor(row.span, verification.verifiedAnchor.anchor)
              ),
            })
          )
        );
      const leftEvidence = A.getSomes(A.map(candidate.matchBasis.leftEvidenceIds, evidenceDetail));
      const rightEvidence = A.getSomes(A.map(candidate.matchBasis.rightEvidenceIds, evidenceDetail));
      if (
        A.length(leftEvidence) !== A.length(candidate.matchBasis.leftEvidenceIds) ||
        A.length(rightEvidence) !== A.length(candidate.matchBasis.rightEvidenceIds)
      ) {
        return O.none();
      }

      const dispositions = yield* db
        .select()
        .from(dispositionTable)
        .where(
          and(
            eq(dispositionTable.candidateId, query.candidateId),
            eq(dispositionTable.orgId, query.orgId),
            lte(dispositionTable.resolvedAt, knownAt)
          )
        )
        .pipe(repositoryUnavailable("get"));
      const disposition = yield* pipe(
        A.head(dispositions),
        O.map((row) => Effect.fromResult(fromContradictionDispositionRow(row))),
        Effect.transposeOption,
        repositoryUnavailable("get")
      );
      return O.some(
        ContradictionCandidateExpandedDetail.make({
          candidate,
          disposition,
          left: ContradictionBeliefDetail.make({
            belief: projectEdgeVersionAtKnownAt(left.value, query.knownAt),
            evidence: leftEvidence,
          }),
          right: ContradictionBeliefDetail.make({
            belief: projectEdgeVersionAtKnownAt(right.value, query.knownAt),
            evidence: rightEvidence,
          }),
        })
      );
    }),

    list: Effect.fn("db.query")(function* (query) {
      yield* Effect.annotateCurrentSpan({
        "db.operation": "select",
        "db.system": "postgresql",
      });
      const where = listWhere(query);
      const rows = yield* db
        .select({
          candidate: {
            id: candidateTable.id,
            candidateKey: candidateTable.candidateKey,
            confidence: sql<number>`(${candidateTable.assessment} ->> 'confidence')::double precision`,
            detector: sql<string>`${candidateTable.matchBasis} ->> 'detector'`,
            detectorVersion: sql<string>`${candidateTable.matchBasis} ->> 'detectorVersion'`,
            kind: sql<string>`${candidateTable.matchBasis} ->> 'kind'`,
            rowVersion: candidateTable.rowVersion,
            summary: sql<string>`${candidateTable.assessment} -> 'proposals' -> 0 ->> 'rationale'`,
          },
          disposition: dispositionTable,
        })
        .from(candidateTable)
        .leftJoin(
          dispositionTable,
          and(
            eq(dispositionTable.candidateId, candidateTable.id),
            lte(dispositionTable.resolvedAt, DateTime.toEpochMillis(query.knownAt))
          )
        )
        .where(where)
        .orderBy(desc(candidateTable.recordedAt), desc(candidateTable.id))
        .offset(query.offset)
        .limit(query.limit)
        .pipe(repositoryUnavailable("list"));
      const totals = yield* db
        .select({ total: count() })
        .from(candidateTable)
        .leftJoin(
          dispositionTable,
          and(
            eq(dispositionTable.candidateId, candidateTable.id),
            lte(dispositionTable.resolvedAt, DateTime.toEpochMillis(query.knownAt))
          )
        )
        .where(where)
        .pipe(repositoryUnavailable("list"));
      const items = yield* Effect.forEach(
        rows,
        Effect.fnUntraced(function* ({ candidate, disposition }) {
          const decodedCandidate = yield* Effect.fromResult(decodeCandidateSummary(candidate));
          const decodedDisposition = yield* pipe(
            O.fromNullishOr(disposition),
            O.map((row) => Effect.fromResult(fromContradictionDispositionRow(row))),
            Effect.transposeOption
          );
          return ContradictionCandidateView.make({
            candidate: decodedCandidate,
            disposition: decodedDisposition,
          });
        }),
        { concurrency: 1 }
      ).pipe(repositoryUnavailable("list"));
      return ContradictionCandidatePage.make({
        items,
        total: pipe(
          totals,
          A.head,
          O.map((row) => NonNegativeInt.make(row.total)),
          O.getOrElse(() => NonNegativeInt.make(0))
        ),
      });
    }),

    review: Effect.fn("db.query")(function* (command, reviewer, scope) {
      yield* Effect.annotateCurrentSpan({
        "db.operation": "transaction",
        "db.system": "postgresql",
      });
      return yield* writeSemaphore.withPermit(
        db
          .transaction(
            Effect.fnUntraced(function* (tx) {
              const candidateRows = yield* tx
                .select()
                .from(candidateTable)
                .where(and(eq(candidateTable.id, command.candidateId), eq(candidateTable.orgId, scope.orgId)))
                .for("update");
              const candidateRow = A.head(candidateRows);
              if (O.isNone(candidateRow)) {
                return yield* ContradictionReviewConflict.make({
                  candidateId: command.candidateId,
                  reason: "not-found",
                });
              }
              const candidate = yield* Effect.fromResult(fromContradictionCandidateRow(candidateRow.value));
              const resolvedAt = yield* DateTime.now;
              if (
                DateTime.isLessThan(resolvedAt, candidate.recordedAt) ||
                !Eq.equals(candidate.rowVersion, command.expectedCandidateVersion)
              ) {
                return yield* ContradictionReviewConflict.make({
                  candidateId: command.candidateId,
                  reason: "stale-candidate",
                });
              }
              const existing = yield* tx
                .select()
                .from(dispositionTable)
                .where(eq(dispositionTable.candidateId, candidate.id));
              if (A.length(existing) > 0) {
                return yield* ContradictionReviewConflict.make({
                  candidateId: command.candidateId,
                  reason: "already-resolved",
                });
              }

              const reviewOutcome = yield* Match.value(command.decision).pipe(
                Match.when({ decision: "reject" }, ({ reason }) =>
                  Effect.succeed({
                    decision: ContradictionDispositionDecision.cases.rejected.make({ reason }),
                    edgeVersions: A.empty<EdgeVersion>(),
                  })
                ),
                Match.when(
                  { decision: "supersedeProposal" },
                  Effect.fnUntraced(function* (selection) {
                    const proposal = A.findFirst(candidate.assessment.proposals, (stored) =>
                      proposalIdEquivalent(stored.proposalId, selection.proposalId)
                    );
                    if (O.isNone(proposal)) {
                      return yield* ContradictionReviewConflict.make({
                        candidateId: command.candidateId,
                        reason: "proposal-not-found",
                      });
                    }
                    const expectedProposalDigest = yield* Effect.fromResult(
                      contradictionProposalDigest({
                        fact: proposal.value.fact,
                        losingBelief: proposal.value.losingBelief,
                        proposalId: proposal.value.proposalId,
                        rationale: proposal.value.rationale,
                        validFrom: proposal.value.validFrom,
                        validTo: proposal.value.validTo,
                      })
                    );
                    if (
                      !Eq.equals(proposal.value.proposalDigest, selection.proposalDigest) ||
                      !Eq.equals(proposal.value.proposalDigest, expectedProposalDigest)
                    ) {
                      return yield* ContradictionReviewConflict.make({
                        candidateId: command.candidateId,
                        reason: "proposal-digest-mismatch",
                      });
                    }

                    const edgeRows = yield* tx
                      .select()
                      .from(edgeTable)
                      .where(eq(edgeTable.id, proposal.value.losingBelief.edgeVersionId));
                    const edgeRow = A.head(edgeRows);
                    if (O.isNone(edgeRow)) {
                      return yield* ContradictionReviewConflict.make({
                        candidateId: command.candidateId,
                        reason: "belief-mismatch",
                      });
                    }
                    const edge = yield* Effect.try(() => fromEdgeVersionRow(edgeRow.value)).pipe(
                      repositoryUnavailable("review")
                    );
                    if (!edgeMatchesCandidateBelief(edge, proposal.value.losingBelief, candidate)) {
                      return yield* ContradictionReviewConflict.make({
                        candidateId: command.candidateId,
                        reason: "belief-mismatch",
                      });
                    }
                    const survivingRows = yield* tx
                      .select()
                      .from(edgeTable)
                      .where(
                        and(
                          eq(edgeTable.orgId, candidate.orgId),
                          eq(edgeTable.logicalKey, edge.logicalKey),
                          isNull(edgeTable.expiredAt)
                        )
                      )
                      .for("update");
                    const survivingVersions = yield* Effect.forEach(
                      survivingRows,
                      (row) => Effect.try(() => fromEdgeVersionRow(row)),
                      { concurrency: 1 }
                    ).pipe(repositoryUnavailable("review"));
                    if (!proposalsAreApplicable([proposal.value], survivingVersions)) {
                      return yield* ContradictionReviewConflict.make({
                        candidateId: command.candidateId,
                        reason: "stale-candidate",
                      });
                    }
                    const identity = yield* identityOf(candidate.id, edge);
                    const supersession = yield* supersedeEdgeFactInTransaction(
                      tx,
                      SupersedeEdgeFact.make({
                        expectedVersion: proposal.value.losingBelief.version,
                        fact: proposal.value.fact,
                        identity,
                        orgId: candidate.orgId,
                        recordedAt: resolvedAt,
                        recordedBy: reviewer,
                        schemaVersion: candidate.schemaVersion,
                        source: "User",
                        validFrom: proposal.value.validFrom,
                        validTo: proposal.value.validTo,
                      })
                    );
                    return {
                      decision: ContradictionDispositionDecision.cases.superseded.make({
                        formerEdgeVersionId: edge.id,
                        proposalDigest: proposal.value.proposalDigest,
                        proposalId: proposal.value.proposalId,
                        reason: selection.reason,
                        replacementEdgeVersionId: supersession.replacement.id,
                      }),
                      edgeVersions: [supersession.former, supersession.replacement],
                    };
                  })
                ),
                Match.exhaustive
              );

              const seed = ContradictionDisposition.make({
                candidateId: candidate.id,
                createdAt: resolvedAt,
                createdByPrincipal: reviewer,
                decision: reviewOutcome.decision,
                entityType: Epistemic.ContradictionDispositionId.entityType,
                id: pendingDispositionId,
                orgId: candidate.orgId,
                publicId: dispositionPublicIdFor(candidate.orgId, candidate.candidateKey),
                resolvedAt,
                resolvedBy: reviewer,
                rowVersion: PosInt.make(1),
                schemaVersion: candidate.schemaVersion,
                source: "User",
                updatedAt: resolvedAt,
                updatedByPrincipal: reviewer,
              });
              const insert = yield* Effect.fromResult(
                toContradictionDispositionInsert(seed, {
                  candidate,
                  edgeVersions: reviewOutcome.edgeVersions,
                })
              );
              const inserted = yield* tx.insert(dispositionTable).values(insert).returning();
              const insertedRow = yield* Effect.fromOption(A.head(inserted), () =>
                ContradictionRepositoryUnavailable.during(
                  "review",
                  "contradiction disposition write returned no persisted row"
                )
              );
              return yield* Effect.fromResult(fromContradictionDispositionRow(insertedRow));
            })
          )
          .pipe(reviewFailure)
      );
    }),

    submit: Effect.fn("db.query")(function* (command) {
      yield* Effect.annotateCurrentSpan({
        "db.operation": "transaction",
        "db.system": "postgresql",
      });
      const normalized = yield* normalizeSubmission(command).pipe(submitFailure);
      return yield* writeSemaphore.withPermit(
        db
          .transaction(
            Effect.fnUntraced(function* (tx) {
              const versionRows = yield* tx
                .select()
                .from(edgeTable)
                .where(
                  inArray(edgeTable.id, [normalized.pair.left.edgeVersionId, normalized.pair.right.edgeVersionId])
                );
              const versions = yield* Effect.forEach(versionRows, (row) => Effect.try(() => fromEdgeVersionRow(row)), {
                concurrency: 1,
              }).pipe(repositoryUnavailable("submit"));
              yield* validateBeliefPair(command, versions, normalized.candidateKey);
              const proposalLogicalKeys = pipe(
                normalized.assessment.proposals,
                A.map((proposal) => proposal.losingBelief.logicalKey),
                A.dedupe
              );
              const survivingVersionRows = yield* tx
                .select()
                .from(edgeTable)
                .where(
                  and(
                    eq(edgeTable.orgId, command.orgId),
                    inArray(edgeTable.logicalKey, proposalLogicalKeys),
                    isNull(edgeTable.expiredAt)
                  )
                );
              const survivingVersions = yield* Effect.forEach(
                survivingVersionRows,
                (row) => Effect.try(() => fromEdgeVersionRow(row)),
                { concurrency: 1 }
              ).pipe(repositoryUnavailable("submit"));
              yield* validateProposals(normalized.assessment.proposals, survivingVersions, normalized.candidateKey);
              const evidenceIds = pipe(
                normalized.matchBasis.leftEvidenceIds,
                A.appendAll(normalized.matchBasis.rightEvidenceIds),
                A.dedupe
              );
              const evidenceRows = yield* tx.select().from(evidenceTable).where(inArray(evidenceTable.id, evidenceIds));
              const evidence = yield* Effect.forEach(evidenceRows, (row) => Effect.try(() => fromEvidenceRow(row)), {
                concurrency: 1,
              }).pipe(repositoryUnavailable("submit"));
              yield* validateEvidenceSet(command, evidence, normalized.candidateKey, evidenceIds);

              const seed = ContradictionCandidate.make({
                assessment: normalized.assessment,
                candidateDigest: normalized.candidateDigest,
                candidateKey: normalized.candidateKey,
                createdAt: command.recordedAt,
                createdByPrincipal: command.receivedBy,
                entityType: Epistemic.ContradictionCandidateId.entityType,
                id: pendingCandidateId,
                matchBasis: normalized.matchBasis,
                orgId: command.orgId,
                pair: normalized.pair,
                publicId: candidatePublicIdFor(command.orgId, normalized.candidateKey),
                recordedAt: command.recordedAt,
                rowVersion: PosInt.make(1),
                schemaVersion: command.schemaVersion,
                source: command.source,
                updatedAt: command.recordedAt,
                updatedByPrincipal: command.receivedBy,
                validFrom: command.validFrom,
                validTo: command.validTo,
              });
              const candidateInsert = yield* Effect.fromResult(toContradictionCandidateInsert(seed));
              const inserted = yield* tx
                .insert(candidateTable)
                .values(candidateInsert)
                .onConflictDoNothing({ target: [candidateTable.orgId, candidateTable.candidateKey] })
                .returning();
              const candidateRows = yield* tx
                .select()
                .from(candidateTable)
                .where(
                  and(eq(candidateTable.orgId, command.orgId), eq(candidateTable.candidateKey, normalized.candidateKey))
                )
                .for("update");
              const candidateRow = yield* Effect.fromOption(A.head(candidateRows), () =>
                ContradictionRepositoryUnavailable.during(
                  "submit",
                  "contradiction candidate write could not be reselected"
                )
              );
              const candidate = yield* Effect.fromResult(fromContradictionCandidateRow(candidateRow));
              if (!Eq.equals(candidate.candidateDigest, normalized.candidateDigest)) {
                return yield* ContradictionSubmissionConflict.make({
                  candidateKey: normalized.candidateKey,
                  reason: "candidate-payload-mismatch",
                });
              }
              if (!notLaterThan(candidate.recordedAt, command.recordedAt)) {
                return yield* ContradictionSubmissionConflict.make({
                  candidateKey: normalized.candidateKey,
                  reason: "receipt-predates-candidate",
                });
              }

              const receiptSeed = ContradictionReceipt.make({
                candidateId: candidate.id,
                createdAt: command.recordedAt,
                createdByPrincipal: command.receivedBy,
                entityType: Epistemic.ContradictionReceiptId.entityType,
                id: pendingReceiptId,
                orgId: command.orgId,
                publicId: receiptPublicIdFor(command.orgId, command.receiptKey),
                receiptKey: command.receiptKey,
                receivedAt: command.recordedAt,
                receivedBy: command.receivedBy,
                rowVersion: PosInt.make(1),
                schemaVersion: command.schemaVersion,
                source: command.source,
                updatedAt: command.recordedAt,
                updatedByPrincipal: command.receivedBy,
              });
              const receiptInsert = yield* Effect.fromResult(toContradictionReceiptInsert(receiptSeed, candidate));
              yield* tx
                .insert(receiptTable)
                .values(receiptInsert)
                .onConflictDoNothing({ target: [receiptTable.orgId, receiptTable.receiptKey] });
              const receiptRows = yield* tx
                .select()
                .from(receiptTable)
                .where(and(eq(receiptTable.orgId, command.orgId), eq(receiptTable.receiptKey, command.receiptKey)));
              const receiptRow = yield* Effect.fromOption(A.head(receiptRows), () =>
                ContradictionRepositoryUnavailable.during(
                  "submit",
                  "contradiction receipt write could not be reselected"
                )
              );
              const receipt = yield* Effect.fromResult(fromContradictionReceiptRow(receiptRow));
              if (!receiptMatchesSubmission(receipt, candidate, command)) {
                return yield* ContradictionSubmissionConflict.make({
                  candidateKey: normalized.candidateKey,
                  reason: "receipt-key-reused",
                });
              }
              return ContradictionSubmission.make({
                candidate,
                duplicateCandidate: A.length(inserted) === 0,
                receipt,
              });
            })
          )
          .pipe(submitFailure)
      );
    }),
  });
});

/**
 * Contradiction-triage command and read-model contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Epistemic from "@beep/epistemic-domain/identity/Epistemic";
import {
  ContradictionAssessment,
  ContradictionBeliefPair,
  ContradictionMatchBasis,
  ContradictionProposalDigest,
  ContradictionProposalId,
  ContradictionReceiptKey,
  ContradictionReviewReason,
} from "@beep/epistemic-domain/values/Contradiction";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { SourceKind } from "@beep/shared-domain/entity/SourceKind";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ContradictionTriage/ContradictionTriage.commands");

/**
 * Submit one evidence-backed contradiction proposal.
 *
 * Repeated candidate identity is duplicate-suppressed, while `receiptKey`
 * preserves a durable receipt for every distinct submission.
 *
 * @example
 * ```ts
 * import { SubmitContradictionCandidate } from "@beep/epistemic-use-cases/server"
 * import * as S from "effect/Schema"
 *
 * console.log(typeof S.decodeUnknownEffect(SubmitContradictionCandidate))
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class SubmitContradictionCandidate extends S.Class<SubmitContradictionCandidate>(
  $I`SubmitContradictionCandidate`
)(
  {
    assessment: ContradictionAssessment.annotateKey({
      description: "Confidence and proposed explicit replacements presented for review.",
    }),
    matchBasis: ContradictionMatchBasis.annotateKey({
      description: "Evidence references and detector revision forming the match basis.",
    }),
    orgId: Shared.OrganizationId.annotateKey({
      description: "Organization that owns both referenced belief versions.",
    }),
    pair: ContradictionBeliefPair.annotateKey({
      description: "Exact belief-version pair observed by the detector.",
    }),
    receiptKey: ContradictionReceiptKey.annotateKey({
      description: "Caller-owned idempotency key for this individual submission.",
    }),
    recordedAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Transaction-time instant when the candidate became known.",
    }),
    receivedBy: Principal.annotateKey({
      description: "Principal responsible for this candidate submission.",
    }),
    source: SourceKind.annotateKey({
      description: "Origin kind stamped on the candidate and receipt.",
    }),
    schemaVersion: SemanticVersion.annotateKey({
      description: "Schema version stamped on the candidate and receipt.",
    }),
    validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound of the detected contradiction.",
    }),
    validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound; absent while temporally open.",
    }),
  },
  $I.annote("SubmitContradictionCandidate", {
    description: "Command submitting one evidence-backed contradiction proposal and durable receipt.",
  })
) {}

const ContradictionDispositionFilterBase = LiteralKit(["all", "open", "rejected", "superseded"]);

/**
 * Disposition filter supported by contradiction list reads.
 *
 * @example
 * ```ts
 * import { ContradictionDispositionFilter } from "@beep/epistemic-use-cases/public"
 *
 * const filter = ContradictionDispositionFilter.Enum.open
 * console.log(ContradictionDispositionFilter.is.open(filter)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionDispositionFilter = ContradictionDispositionFilterBase.pipe(
  $I.annoteSchema("ContradictionDispositionFilter", {
    description: "Filter selecting every, unresolved, rejected, or superseded contradiction candidate.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionDispositionFilterBase)
);

/**
 * Runtime type for {@link ContradictionDispositionFilter}.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionDispositionFilter,
 *   type ContradictionDispositionFilter as DispositionFilterValue,
 * } from "@beep/epistemic-use-cases/public"
 *
 * const filter: DispositionFilterValue = ContradictionDispositionFilter.Enum.open
 * console.log(ContradictionDispositionFilter.is.open(filter)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionDispositionFilter = typeof ContradictionDispositionFilter.Type;

/**
 * Positive contradiction-candidate page size capped at 100 rows.
 *
 * @example
 * ```ts
 * import { ContradictionCandidatePageLimit } from "@beep/epistemic-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ContradictionCandidatePageLimit)(100)) // true
 * console.log(S.is(ContradictionCandidatePageLimit)(101)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionCandidatePageLimit = PosInt.check(
  S.isLessThanOrEqualTo(100, {
    identifier: $I`ContradictionCandidatePageLimitMaximumCheck`,
    title: "Contradiction Candidate Page Limit Maximum",
    description: "Contradiction candidate pages contain at most 100 rows.",
    message: "Expected contradiction candidate page limit to be at most 100",
  })
).pipe(
  $I.annoteSchema("ContradictionCandidatePageLimit", {
    description: "Positive contradiction-candidate page size capped at 100 rows.",
  })
);

/**
 * Runtime type for {@link ContradictionCandidatePageLimit}.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionCandidatePageLimit,
 *   type ContradictionCandidatePageLimit as PageLimitValue,
 * } from "@beep/epistemic-use-cases/public"
 *
 * const limit: PageLimitValue = ContradictionCandidatePageLimit.make(25)
 * console.log(limit) // 25
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionCandidatePageLimit = typeof ContradictionCandidatePageLimit.Type;

/**
 * Paginated two-axis contradiction-candidate list query.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionCandidatePageLimit,
 *   ListContradictionCandidates,
 * } from "@beep/epistemic-use-cases/server"
 * import { NonNegativeInt } from "@beep/schema/Int"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import { DateTime } from "effect"
 *
 * const at = DateTime.makeUnsafe(0)
 * const query = ListContradictionCandidates.make({
 *   disposition: "open",
 *   knownAt: at,
 *   limit: ContradictionCandidatePageLimit.make(20),
 *   offset: NonNegativeInt.make(0),
 *   orgId: Shared.OrganizationId.make(1),
 *   validAt: at,
 * })
 *
 * console.log(query.disposition) // "open"
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class ListContradictionCandidates extends S.Class<ListContradictionCandidates>($I`ListContradictionCandidates`)(
  {
    disposition: ContradictionDispositionFilter.annotateKey({
      description: "Disposition state to include.",
    }),
    knownAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Transaction-time instant at which candidate state is asked.",
    }),
    limit: ContradictionCandidatePageLimit.annotateKey({
      description: "Maximum number of candidate rows to return.",
    }),
    offset: NonNegativeInt.annotateKey({
      description: "Number of ordered candidate rows to skip.",
    }),
    orgId: Shared.OrganizationId.annotateKey({
      description: "Organization whose candidates may be returned.",
    }),
    validAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Valid-time instant at which contradiction applicability is asked.",
    }),
  },
  $I.annote("ListContradictionCandidates", {
    description: "Paginated two-axis list query for contradiction candidates in one organization.",
  })
) {}

/**
 * Query one persisted contradiction candidate by identity.
 *
 * @example
 * ```ts
 * import { GetContradictionCandidate } from "@beep/epistemic-use-cases/public"
 * import * as Epistemic from "@beep/epistemic-domain/identity/Epistemic"
 *
 * const query = GetContradictionCandidate.make({
 *   candidateId: Epistemic.ContradictionCandidateId.make(7),
 * })
 *
 * console.log(query.candidateId) // 7
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class GetContradictionCandidate extends S.Class<GetContradictionCandidate>($I`GetContradictionCandidate`)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Candidate whose expanded persisted state is requested.",
    }),
  },
  $I.annote("GetContradictionCandidate", {
    description: "Identity-only query for one expanded contradiction candidate.",
  })
) {}

/**
 * Server-only query for exact belief, evidence, and verification expansion.
 *
 * The organization is derived from authenticated server scope. A public
 * renderer never supplies it directly.
 *
 * @example
 * ```ts
 * import { GetExpandedContradictionCandidate } from "@beep/epistemic-use-cases/server"
 * import * as Epistemic from "@beep/epistemic-domain/identity/Epistemic"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 *
 * const query = GetExpandedContradictionCandidate.make({
 *   candidateId: Epistemic.ContradictionCandidateId.make(7),
 *   orgId: Shared.OrganizationId.make(1),
 * })
 *
 * console.log(query.orgId) // 1
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class GetExpandedContradictionCandidate extends S.Class<GetExpandedContradictionCandidate>(
  $I`GetExpandedContradictionCandidate`
)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Candidate whose persisted detail is requested.",
    }),
    orgId: Shared.OrganizationId.annotateKey({
      description: "Authenticated organization allowed to observe the detail.",
    }),
  },
  $I.annote("GetExpandedContradictionCandidate", {
    description: "Server-only organization-scoped query for exact contradiction detail inputs.",
  })
) {}

const ContradictionReviewDecisionBase = LiteralKit(["reject", "supersedeProposal"]).toTaggedUnion("decision")({
  reject: {
    reason: ContradictionReviewReason.annotateKey({
      description: "Normalized bounded reason the contradiction candidate is rejected.",
    }),
  },
  supersedeProposal: {
    proposalDigest: ContradictionProposalDigest.annotateKey({
      description: "Digest the server must verify against the persisted proposal.",
    }),
    proposalId: ContradictionProposalId.annotateKey({
      description: "Persisted proposal selected for supersession.",
    }),
    reason: ContradictionReviewReason.annotateKey({
      description: "Normalized bounded rationale for approving the persisted proposal.",
    }),
  },
});

/**
 * Narrow human review decision: reject the candidate, or approve one explicit
 * replacement against one persisted candidate side.
 *
 * @example
 * ```ts
 * import { ContradictionReviewDecision } from "@beep/epistemic-use-cases/public"
 *
 * const decision = ContradictionReviewDecision.cases.reject.make({ reason: "Different issues." })
 * console.log(decision.decision)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const ContradictionReviewDecision = ContradictionReviewDecisionBase.pipe(
  $I.annoteSchema("ContradictionReviewDecision", {
    description: "Narrow human decision rejecting a contradiction or approving an explicit replacement.",
  })
);

/**
 * Runtime type for {@link ContradictionReviewDecision}.
 *
 * @example
 * ```ts
 * import type { ContradictionReviewDecision } from "@beep/epistemic-use-cases/public"
 *
 * const decision: ContradictionReviewDecision = { decision: "reject", reason: "Different issues." }
 * console.log(decision.decision)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReviewDecision = typeof ContradictionReviewDecision.Type;

/**
 * Review one persisted contradiction candidate.
 *
 * The caller supplies no reviewer identity, source facet, replacement fact,
 * losing side, or validity. Server orchestration derives actor/time/source and
 * reloads the selected immutable proposal after verifying its digest.
 *
 * @example
 * ```ts
 * import { ReviewContradictionCandidate } from "@beep/epistemic-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * console.log(typeof S.decodeUnknownEffect(ReviewContradictionCandidate))
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ReviewContradictionCandidate extends S.Class<ReviewContradictionCandidate>(
  $I`ReviewContradictionCandidate`
)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Persisted candidate being reviewed.",
    }),
    decision: ContradictionReviewDecision.annotateKey({
      description: "Explicit rejection or approved supersession data.",
    }),
    expectedCandidateVersion: PosInt.annotateKey({
      description: "Candidate row version observed by the reviewer.",
    }),
  },
  $I.annote("ReviewContradictionCandidate", {
    description: "Narrow command reviewing one contradiction candidate without accepting caller-owned edge identity.",
  })
) {}

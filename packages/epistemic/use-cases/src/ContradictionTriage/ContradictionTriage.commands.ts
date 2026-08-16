/**
 * Contradiction-triage command and read-model contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

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
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { SourceKind } from "@beep/shared-domain/entity/SourceKind";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as SharedEpistemic from "@beep/shared-domain/identity/Epistemic";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { DateTime, Effect, identity, Order } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ContradictionTriage/ContradictionTriage.commands");

class SubmitContradictionCandidateStruct extends S.Class<SubmitContradictionCandidateStruct>(
  $I`SubmitContradictionCandidateStruct`
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
    recordedAt: S.DateTimeUtcFromMillis.annotateKey({
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
    validFrom: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound of the detected contradiction.",
    }),
    validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound; absent while temporally open.",
    }),
  },
  $I.annote("SubmitContradictionCandidateStruct", {
    description: "Structural contradiction submission before its half-open valid interval is checked.",
  })
) {}

const validIntervalIsOrdered = Order.isLessThan(DateTime.Order);
const submitContradictionCandidateStructArbitrary = S.toArbitrary(SubmitContradictionCandidateStruct);

const SubmitContradictionCandidateSchema = SubmitContradictionCandidateStruct.mapFields(identity)
  .check(
    S.makeFilter(
      ({ validFrom, validTo }) =>
        O.match(validTo, {
          onNone: () => true,
          onSome: (upperBound) => validIntervalIsOrdered(validFrom, upperBound),
        }),
      {
        identifier: $I`SubmitContradictionCandidateValidIntervalCheck`,
        title: "Contradiction Candidate Valid Interval",
        description: "Checks that a closed candidate validity interval is a non-empty forward half-open range.",
        message: "Expected validFrom to be earlier than validTo when validTo is present.",
      }
    )
  )
  .annotate({
    toArbitrary: () => (fc) =>
      submitContradictionCandidateStructArbitrary(fc).map((submission) =>
        SubmitContradictionCandidateStruct.make({
          ...submission,
          validTo: O.filter(submission.validTo, (upperBound) =>
            validIntervalIsOrdered(submission.validFrom, upperBound)
          ),
        })
      ),
  });

/**
 * Submit one evidence-backed contradiction proposal.
 *
 * **Details**
 *
 * Repeated candidate identity is duplicate-suppressed, while `receiptKey`
 * preserves a durable receipt for every distinct submission.
 *
 * **Example** (Decode submit candidate schema)
 *
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
  SubmitContradictionCandidateSchema,
  $I.annote("SubmitContradictionCandidate", {
    description: "Command submitting one evidence-backed contradiction proposal and durable receipt.",
  })
) {}

const ContradictionDispositionFilterBase = LiteralKit(["all", "open", "rejected", "superseded"]);

/**
 * Disposition filter supported by contradiction list reads.
 *
 * **Example** (Check open disposition filter)
 *
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
 * **Example** (Type open disposition filter)
 *
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
 * **Example** (Validate page limit bounds)
 *
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
 * **Example** (Make typed page limit)
 *
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
 * **Example** (Build list candidates query)
 *
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
    knownAt: S.DateTimeUtcFromMillis.annotateKey({
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
    validAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Valid-time instant at which contradiction applicability is asked.",
    }),
  },
  $I.annote("ListContradictionCandidates", {
    description: "Paginated two-axis list query for contradiction candidates in one organization.",
  })
) {}

/**
 * Query one persisted contradiction candidate in a two-axis temporal view.
 *
 * **Example** (Build get candidate query)
 *
 * ```ts
 * import { GetContradictionCandidate } from "@beep/epistemic-use-cases/public"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import { DateTime } from "effect"
 *
 * const at = DateTime.makeUnsafe(0)
 * const query = GetContradictionCandidate.make({
 *   candidateId: Epistemic.ContradictionCandidateId.make(7),
 *   knownAt: at,
 *   validAt: at,
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
    knownAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant at which candidate state is requested.",
    }),
    validAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Valid-time instant at which contradiction applicability is requested.",
    }),
  },
  $I.annote("GetContradictionCandidate", {
    description: "Two-axis temporal query for one expanded contradiction candidate.",
  })
) {}

/**
 * Server-only query for exact belief, evidence, and verification expansion.
 *
 * **Details**
 *
 * The organization is derived from authenticated server scope. A public
 * renderer never supplies it directly.
 *
 * **Example** (Build expanded candidate query)
 *
 * ```ts
 * import { GetExpandedContradictionCandidate } from "@beep/epistemic-use-cases/server"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import { DateTime } from "effect"
 *
 * const at = DateTime.makeUnsafe(0)
 * const query = GetExpandedContradictionCandidate.make({
 *   candidateId: Epistemic.ContradictionCandidateId.make(7),
 *   knownAt: at,
 *   orgId: Shared.OrganizationId.make(1),
 *   sourceScopeRef: "workspace:1",
 *   validAt: at,
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
    evidenceId: SharedEpistemic.EvidenceId.pipe(
      S.OptionFromNullOr,
      S.withConstructorDefault(Effect.succeed(O.none<SharedEpistemic.EvidenceId>()))
    ).annotateKey({
      description: "Optional candidate-bound evidence id used to narrow verification expansion.",
    }),
    knownAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant at which candidate state is requested.",
    }),
    orgId: Shared.OrganizationId.annotateKey({
      description: "Authenticated organization allowed to observe the detail.",
    }),
    sourceScopeRef: SourceTextIdentity.fields.scopeRef.annotateKey({
      description: "Authenticated source scope allowed to contribute verification metadata.",
    }),
    validAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Valid-time instant at which contradiction applicability is requested.",
    }),
  },
  $I.annote("GetExpandedContradictionCandidate", {
    description: "Server-only organization- and source-scoped two-axis query for exact contradiction detail inputs.",
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
 * **Example** (Make reject review decision)
 *
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
 * **Example** (Type reject review decision)
 *
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
 * **Details**
 *
 * The caller supplies no reviewer identity, source facet, replacement fact,
 * losing side, or validity. Server orchestration derives actor/time/source and
 * reloads the selected immutable proposal after verifying its digest.
 *
 * **Example** (Decode review candidate schema)
 *
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

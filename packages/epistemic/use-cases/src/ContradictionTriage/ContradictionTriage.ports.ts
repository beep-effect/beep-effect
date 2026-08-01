/**
 * Contradiction-triage repository port.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ContradictionCandidate,
  ContradictionDisposition,
  ContradictionReceipt,
} from "@beep/epistemic-domain/entities/Contradiction";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import type { Principal } from "@beep/shared-domain/entity/Principal";
import type * as Shared from "@beep/shared-domain/identity/Shared";
import type { Effect } from "effect";
import type * as O from "effect/Option";
import type { EdgeAuthorityError } from "../EdgeAuthority/index.ts";
import type {
  GetExpandedContradictionCandidate,
  ListContradictionCandidates,
  ReviewContradictionCandidate,
  SubmitContradictionCandidate,
} from "./ContradictionTriage.commands.ts";
import type {
  ContradictionRepositoryUnavailable,
  ContradictionReviewConflict,
  ContradictionSubmissionConflict,
} from "./ContradictionTriage.errors.ts";

const $I = $EpistemicUseCasesId.create("ContradictionTriage/ContradictionTriage.ports");

/**
 * Authenticated reviewer principal supplied by server orchestration, never by
 * the public review payload.
 *
 * @example
 * ```ts
 * import { ContradictionReviewer } from "@beep/epistemic-use-cases/server"
 * import { Effect } from "effect"
 *
 * const reviewerKind = ContradictionReviewer.pipe(
 *   Effect.map((reviewer) => reviewer.kind)
 * )
 *
 * console.log(Effect.isEffect(reviewerKind)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ContradictionReviewer extends Context.Service<ContradictionReviewer, Principal>()(
  $I`ContradictionReviewer`
) {}

/**
 * Organization and source scope supplied by trusted server orchestration for
 * contradiction triage.
 *
 * @example
 * ```ts
 * import { ContradictionReviewScope } from "@beep/epistemic-use-cases/server"
 * import { Effect } from "effect"
 *
 * const organization = ContradictionReviewScope.pipe(
 *   Effect.map((scope) => scope.orgId)
 * )
 *
 * console.log(Effect.isEffect(organization)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ContradictionReviewScope extends Context.Service<
  ContradictionReviewScope,
  {
    readonly orgId: Shared.OrganizationId;
    readonly sourceScopeRef: SourceTextIdentity["scopeRef"];
  }
>()($I`ContradictionReviewScope`) {}

/**
 * Result of submitting a contradiction proposal.
 *
 * @example
 * ```ts
 * import { ContradictionSubmission } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionSubmission.fields.duplicateCandidate)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionSubmission extends S.Class<ContradictionSubmission>($I`ContradictionSubmission`)(
  {
    candidate: ContradictionCandidate.annotateKey({
      description: "Canonical candidate created or recovered by duplicate suppression.",
    }),
    duplicateCandidate: S.Boolean.annotateKey({
      description: "Whether an existing candidate already represented the submitted basis.",
    }),
    receipt: ContradictionReceipt.annotateKey({
      description: "Durable receipt proving this individual submission was observed.",
    }),
  },
  $I.annote("ContradictionSubmission", {
    description: "Canonical candidate and durable receipt resulting from one submission.",
  })
) {}

/**
 * Candidate plus its disposition as known at the requested transaction time.
 *
 * @example
 * ```ts
 * import { ContradictionCandidateView } from "@beep/epistemic-use-cases/public"
 *
 * console.log(ContradictionCandidateView.fields.candidate !== undefined) // true
 * console.log(ContradictionCandidateView.fields.disposition !== undefined) // true
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionCandidateView extends S.Class<ContradictionCandidateView>($I`ContradictionCandidateView`)(
  {
    candidate: ContradictionCandidate.annotateKey({
      description: "Immutable contradiction candidate.",
    }),
    disposition: ContradictionDisposition.pipe(S.OptionFromNullOr).annotateKey({
      description: "Disposition visible at the query's knownAt instant, when resolved.",
    }),
  },
  $I.annote("ContradictionCandidateView", {
    description: "One immutable candidate paired with its bitemporally visible disposition.",
  })
) {}

/**
 * Paginated contradiction-candidate read result.
 *
 * @example
 * ```ts
 * import { ContradictionCandidatePage } from "@beep/epistemic-use-cases/public"
 * import { NonNegativeInt } from "@beep/schema/Int"
 *
 * const page = ContradictionCandidatePage.make({
 *   items: [],
 *   total: NonNegativeInt.make(0),
 * })
 *
 * console.log(page.items.length) // 0
 * console.log(page.total) // 0
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionCandidatePage extends S.Class<ContradictionCandidatePage>($I`ContradictionCandidatePage`)(
  {
    items: S.Array(ContradictionCandidateView).annotateKey({
      description: "Ordered candidate rows in the requested page.",
    }),
    total: NonNegativeInt.annotateKey({
      description: "Total number of candidates matching the query before pagination.",
    }),
  },
  $I.annote("ContradictionCandidatePage", {
    description: "Paginated two-axis contradiction candidate result.",
  })
) {}

/**
 * Expanded persisted candidate used by detail reads and review orchestration.
 *
 * @example
 * ```ts
 * import { ContradictionCandidateDetail } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionCandidateDetail.fields.candidate !== undefined) // true
 * console.log(ContradictionCandidateDetail.fields.receipts !== undefined) // true
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionCandidateDetail extends S.Class<ContradictionCandidateDetail>(
  $I`ContradictionCandidateDetail`
)(
  {
    candidate: ContradictionCandidate.annotateKey({
      description: "Immutable candidate applicable at validAt and recorded no later than knownAt.",
    }),
    disposition: ContradictionDisposition.pipe(S.OptionFromNullOr).annotateKey({
      description: "Recorded disposition only when its resolvedAt instant is no later than knownAt.",
    }),
    receipts: S.Array(ContradictionReceipt).annotateKey({
      description: "Durable submission receipts received no later than knownAt, in arrival order.",
    }),
  },
  $I.annote("ContradictionCandidateDetail", {
    description: "Two-axis-visible candidate, disposition, and receipt history.",
  })
) {}

/**
 * One evidence row plus its candidate-time verified-source manifestation.
 *
 * @example
 * ```ts
 * import { ContradictionEvidenceDetail } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionEvidenceDetail.fields.evidence !== undefined) // true
 * console.log(ContradictionEvidenceDetail.fields.latestVerification !== undefined) // true
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionEvidenceDetail extends S.Class<ContradictionEvidenceDetail>($I`ContradictionEvidenceDetail`)(
  {
    evidence: Evidence.annotateKey({
      description: "Exact evidence row referenced by the candidate match basis.",
    }),
    latestVerification: EvidenceVerification.pipe(S.OptionFromNullOr).annotateKey({
      description: "Newest immutable verification manifestation recorded no later than the candidate, when present.",
    }),
  },
  $I.annote("ContradictionEvidenceDetail", {
    description: "Evidence plus its verified source-text manifestation as known when the candidate was recorded.",
  })
) {}

/**
 * One exact belief-version side and the evidence grounding that side.
 *
 * @example
 * ```ts
 * import { ContradictionBeliefDetail } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionBeliefDetail.fields.belief !== undefined) // true
 * console.log(ContradictionBeliefDetail.fields.evidence !== undefined) // true
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionBeliefDetail extends S.Class<ContradictionBeliefDetail>($I`ContradictionBeliefDetail`)(
  {
    belief: EdgeVersion.annotateKey({
      description: "Exact immutable edge version referenced by the candidate.",
    }),
    evidence: S.Array(ContradictionEvidenceDetail).annotateKey({
      description: "Persisted evidence rows grounding this side of the match.",
    }),
  },
  $I.annote("ContradictionBeliefDetail", {
    description: "Exact belief version and its persisted evidence detail.",
  })
) {}

/**
 * Organization-scoped expanded candidate detail for server orchestration.
 *
 * @example
 * ```ts
 * import { ContradictionCandidateExpandedDetail } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionCandidateExpandedDetail.fields.candidate !== undefined) // true
 * console.log(ContradictionCandidateExpandedDetail.fields.left !== undefined) // true
 * console.log(ContradictionCandidateExpandedDetail.fields.right !== undefined) // true
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ContradictionCandidateExpandedDetail extends S.Class<ContradictionCandidateExpandedDetail>(
  $I`ContradictionCandidateExpandedDetail`
)(
  {
    candidate: ContradictionCandidate.annotateKey({
      description: "Immutable candidate applicable at validAt and recorded no later than knownAt.",
    }),
    disposition: ContradictionDisposition.pipe(S.OptionFromNullOr).annotateKey({
      description: "Recorded disposition only when its resolvedAt instant is no later than knownAt.",
    }),
    left: ContradictionBeliefDetail.annotateKey({
      description: "Exact left belief and side-bound evidence.",
    }),
    right: ContradictionBeliefDetail.annotateKey({
      description: "Exact right belief and side-bound evidence.",
    }),
  },
  $I.annote("ContradictionCandidateExpandedDetail", {
    description: "Exact persisted inputs needed by server-side contradiction detail orchestration.",
  })
) {}

/**
 * Contradiction-triage repository service shape.
 *
 * @example
 * ```ts
 * import type { ContradictionTriageRepositoryShape } from "@beep/epistemic-use-cases/server"
 *
 * const method: keyof ContradictionTriageRepositoryShape = "review"
 * console.log(method)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export interface ContradictionTriageRepositoryShape {
  readonly get: (
    query: GetExpandedContradictionCandidate
  ) => Effect.Effect<O.Option<ContradictionCandidateDetail>, ContradictionRepositoryUnavailable>;
  readonly getExpanded: (
    query: GetExpandedContradictionCandidate
  ) => Effect.Effect<O.Option<ContradictionCandidateExpandedDetail>, ContradictionRepositoryUnavailable>;
  readonly list: (
    query: ListContradictionCandidates
  ) => Effect.Effect<ContradictionCandidatePage, ContradictionRepositoryUnavailable>;
  readonly review: (
    command: ReviewContradictionCandidate,
    reviewer: Principal,
    scope: ContradictionReviewScope["Service"]
  ) => Effect.Effect<
    ContradictionDisposition,
    ContradictionRepositoryUnavailable | ContradictionReviewConflict | EdgeAuthorityError
  >;
  readonly submit: (
    command: SubmitContradictionCandidate
  ) => Effect.Effect<ContradictionSubmission, ContradictionRepositoryUnavailable | ContradictionSubmissionConflict>;
}

/**
 * Contradiction-triage repository service.
 *
 * @example
 * ```ts
 * import { ContradictionTriageRepository } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionTriageRepository)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export class ContradictionTriageRepository extends Context.Service<
  ContradictionTriageRepository,
  ContradictionTriageRepositoryShape
>()($I`ContradictionTriageRepository`) {}

/**
 * Contradiction-candidate value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  CONTRADICTION_DETECTOR_MAX_LENGTH as DETECTOR_MAX_LENGTH,
  CONTRADICTION_EVIDENCE_SET_MAX_COUNT as EVIDENCE_SET_MAX_COUNT,
  makeBeliefVersionRef,
  makeContradictionArbitraries,
  makeContradictionAssessment,
  makeContradictionBehavior,
  makeContradictionBeliefPairs,
  makeContradictionCandidate,
  makeContradictionDispositionDecision,
  makeContradictionMatchBasis,
  makeContradictionProposals,
  makeContradictionVocabulary,
  makeValidIntervalCheck as makeIntervalCheck,
  CONTRADICTION_PROPOSAL_FACT_MAX_BYTES as PROPOSAL_FACT_MAX_BYTES,
  CONTRADICTION_PROPOSAL_MAX_COUNT as PROPOSAL_MAX_COUNT,
  CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH as PROPOSAL_RATIONALE_MAX_LENGTH,
  CONTRADICTION_REVIEW_REASON_MAX_LENGTH as REVIEW_REASON_MAX_LENGTH,
} from "@beep/epistemics/Contradiction";
import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { LogicalEdgeKey } from "../LogicalEdgeIdentity/index.ts";
import type * as Arbitrary from "effect/Arbitrary";
import type * as Result from "effect/Result";

const $I = $EpistemicDomainId.create("values/Contradiction/Contradiction.model");
const vocabulary = makeContradictionVocabulary({ $I });
const beliefRef = makeBeliefVersionRef({
  $I,
  ids: { edgeVersion: EpistemicIdentity.EdgeVersionId },
  positiveInt: PosInt,
  LogicalEdgeKey,
});
const matchBasis = makeContradictionMatchBasis({ $I, vocabulary, ids: { evidence: EpistemicIdentity.EvidenceId } });
/**
 * Digest identifying one contradiction candidate independent of submission
 * order.
 *
 * **Example** (Validate candidate key string)
 *
 * ```ts
 * import { ContradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ContradictionCandidateKey)("a".repeat(64)))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionCandidateKey = vocabulary.ContradictionCandidateKey;

/**
 * Runtime type for {@link ContradictionCandidateKey}.
 *
 * **Example** (Annotate candidate key array)
 *
 * ```ts
 * import type { ContradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const keys: ReadonlyArray<ContradictionCandidateKey> = []
 * console.log(keys.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionCandidateKey = typeof ContradictionCandidateKey.Type;

/**
 * Caller-owned idempotency key for one contradiction submission receipt.
 *
 * **Example** (Validate receipt key string)
 *
 * ```ts
 * import { ContradictionReceiptKey } from "@beep/epistemic-domain/values/Contradiction"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ContradictionReceiptKey)("b".repeat(64)))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionReceiptKey = vocabulary.ContradictionReceiptKey;

/**
 * Runtime type for {@link ContradictionReceiptKey}.
 *
 * **Example** (Annotate receipt key array)
 *
 * ```ts
 * import type { ContradictionReceiptKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const keys: ReadonlyArray<ContradictionReceiptKey> = []
 * console.log(keys.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReceiptKey = typeof ContradictionReceiptKey.Type;

/**
 * Digest of the immutable payload stored under a candidate identity.
 *
 * **Example** (Make and check digest)
 *
 * ```ts
 * import { ContradictionCandidateDigest } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const digest = ContradictionCandidateDigest.make(Str.repeat(64)("a"))
 * console.log(S.is(ContradictionCandidateDigest)(digest)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionCandidateDigest = vocabulary.ContradictionCandidateDigest;

/**
 * Runtime type for {@link ContradictionCandidateDigest}.
 *
 * **Example** (Type alias digest value)
 *
 * ```ts
 * import {
 *   ContradictionCandidateDigest,
 *   type ContradictionCandidateDigest as CandidateDigestValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const digest: CandidateDigestValue = ContradictionCandidateDigest.make(Str.repeat(64)("a"))
 * console.log(S.is(ContradictionCandidateDigest)(digest)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionCandidateDigest = typeof ContradictionCandidateDigest.Type;

/**
 * Digest of the exact evidence sets used as a contradiction match basis.
 *
 * **Example** (Make and check digest)
 *
 * ```ts
 * import { ContradictionEvidenceDigest } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const digest = ContradictionEvidenceDigest.make(Str.repeat(64)("b"))
 * console.log(S.is(ContradictionEvidenceDigest)(digest)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionEvidenceDigest = vocabulary.ContradictionEvidenceDigest;

/**
 * Runtime type for {@link ContradictionEvidenceDigest}.
 *
 * **Example** (Type alias digest value)
 *
 * ```ts
 * import {
 *   ContradictionEvidenceDigest,
 *   type ContradictionEvidenceDigest as EvidenceDigestValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const digest: EvidenceDigestValue = ContradictionEvidenceDigest.make(Str.repeat(64)("b"))
 * console.log(S.is(ContradictionEvidenceDigest)(digest)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionEvidenceDigest = typeof ContradictionEvidenceDigest.Type;

/**
 * Stable proposal identifier persisted before human review.
 *
 * **Example** (Make and check proposal id)
 *
 * ```ts
 * import { ContradictionProposalId } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const proposalId = ContradictionProposalId.make(Str.repeat(64)("c"))
 * console.log(S.is(ContradictionProposalId)(proposalId)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionProposalId = vocabulary.ContradictionProposalId;

/**
 * Runtime type for {@link ContradictionProposalId}.
 *
 * **Example** (Type alias proposal id)
 *
 * ```ts
 * import {
 *   ContradictionProposalId,
 *   type ContradictionProposalId as ProposalIdValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const proposalId: ProposalIdValue = ContradictionProposalId.make(Str.repeat(64)("c"))
 * console.log(S.is(ContradictionProposalId)(proposalId)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionProposalId = typeof ContradictionProposalId.Type;

/**
 * Digest guarding the complete authority-changing content of a proposal.
 *
 * **Example** (Make and check digest)
 *
 * ```ts
 * import { ContradictionProposalDigest } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const digest = ContradictionProposalDigest.make(Str.repeat(64)("d"))
 * console.log(S.is(ContradictionProposalDigest)(digest)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionProposalDigest = vocabulary.ContradictionProposalDigest;

/**
 * Runtime type for {@link ContradictionProposalDigest}.
 *
 * **Example** (Type alias digest value)
 *
 * ```ts
 * import {
 *   ContradictionProposalDigest,
 *   type ContradictionProposalDigest as ProposalDigestValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 * import * as S from "effect/Schema"
 *
 * const digest: ProposalDigestValue = ContradictionProposalDigest.make(Str.repeat(64)("d"))
 * console.log(S.is(ContradictionProposalDigest)(digest)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionProposalDigest = typeof ContradictionProposalDigest.Type;

/**
 * Exact immutable edge version observed as one side of a contradiction.
 *
 * **Example** (Inspect version field)
 *
 * ```ts
 * import { BeliefVersionRef } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(BeliefVersionRef.fields.version !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class BeliefVersionRef extends S.Opaque<BeliefVersionRef, { readonly brand: unique symbol }>()(
  beliefRef.BeliefVersionRefSchema
) {}

const beliefPairs = makeContradictionBeliefPairs({ $I, BeliefVersionRef });
const proposals = makeContradictionProposals({ $I, vocabulary, BeliefVersionRef });

/**
 * Submission-order pair of exact conflicting belief versions.
 *
 * **Details**
 *
 * Public submissions may present either side first. Persisted candidates use
 * {@link CanonicalContradictionBeliefPair} after
 * {@link canonicalizeContradiction} has kept each evidence set attached to its
 * corresponding belief.
 *
 * **Example** (Inspect left field)
 *
 * ```ts
 * import { ContradictionBeliefPair } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionBeliefPair.fields.left !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionBeliefPair extends S.Opaque<ContradictionBeliefPair, { readonly brand: unique symbol }>()(
  beliefPairs.ContradictionBeliefPairSchema
) {}

/**
 * Canonically ordered pair persisted inside a contradiction candidate.
 *
 * **Example** (Inspect left field)
 *
 * ```ts
 * import { CanonicalContradictionBeliefPair } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CanonicalContradictionBeliefPair.fields.left !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class CanonicalContradictionBeliefPair extends S.Opaque<
  CanonicalContradictionBeliefPair,
  { readonly brand: unique symbol }
>()(beliefPairs.CanonicalContradictionBeliefPairSchema) {}

/**
 * Bounded semantic basis on which a detector may assert a contradiction.
 *
 * **Example** (Read independent-evidence enum)
 *
 * ```ts
 * import { ContradictionMatchBasisKind } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const kind = ContradictionMatchBasisKind.Enum["independent-evidence"]
 * console.log(ContradictionMatchBasisKind.is["independent-evidence"](kind)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionMatchBasisKind = vocabulary.ContradictionMatchBasisKind;

/**
 * Runtime type for {@link ContradictionMatchBasisKind}.
 *
 * **Example** (Type match basis kind)
 *
 * ```ts
 * import {
 *   ContradictionMatchBasisKind,
 *   type ContradictionMatchBasisKind as MatchBasisKindValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const kind: MatchBasisKindValue = ContradictionMatchBasisKind.Enum["independent-evidence"]
 * console.log(ContradictionMatchBasisKind.is["independent-evidence"](kind)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionMatchBasisKind = typeof ContradictionMatchBasisKind.Type;

/**
 * Maximum evidence identifiers retained on either side of one contradiction.
 *
 * **Example** (Print max evidence count)
 *
 * ```ts
 * import { CONTRADICTION_EVIDENCE_SET_MAX_COUNT } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_EVIDENCE_SET_MAX_COUNT) // 32
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_EVIDENCE_SET_MAX_COUNT = EVIDENCE_SET_MAX_COUNT;

/**
 * Maximum UTF-16 length accepted for a contradiction detector identity.
 *
 * **Example** (Print detector max length)
 *
 * ```ts
 * import { CONTRADICTION_DETECTOR_MAX_LENGTH } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_DETECTOR_MAX_LENGTH) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_DETECTOR_MAX_LENGTH = DETECTOR_MAX_LENGTH;

/**
 * Evidence and detector revision that form the repeatable match basis.
 *
 * **Example** (Inspect kind field)
 *
 * ```ts
 * import { ContradictionMatchBasis } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionMatchBasis.fields.kind !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionMatchBasis extends S.Opaque<ContradictionMatchBasis, { readonly brand: unique symbol }>()(
  matchBasis.ContradictionMatchBasisSchema
) {}

/**
 * Maximum length accepted for a detector-supplied proposal rationale.
 *
 * **Example** (Print rationale max length)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH) // 2000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH = PROPOSAL_RATIONALE_MAX_LENGTH;

/**
 * Maximum canonical UTF-8 bytes accepted for one replacement fact.
 *
 * **Example** (Print fact max bytes)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_FACT_MAX_BYTES } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_FACT_MAX_BYTES) // 65536
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_FACT_MAX_BYTES = PROPOSAL_FACT_MAX_BYTES;

/**
 * Build the shared half-open valid-interval filter for contradiction payloads.
 *
 * **Details**
 *
 * Every contradiction-shaped payload (resolution proposal, candidate content,
 * triage submission command) carries the same `validFrom`/`validTo` interval
 * invariant; this factory is the single source for that check.
 *
 * **Example** (Build an interval check)
 *
 * ```ts
 * import { makeValidIntervalCheck } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const check = makeValidIntervalCheck({
 *   identifier: "ExampleValidIntervalCheck",
 *   title: "Example Valid Interval",
 *   description: "Checks the example interval ordering.",
 * })
 * console.log(typeof check) // "object"
 * ```
 *
 * @param annotations - Identifier, title, and description for the filter.
 * @returns The half-open valid-interval filter.
 * @category utilities
 * @since 0.0.0
 */
export const makeValidIntervalCheck: typeof makeIntervalCheck = makeIntervalCheck;

/**
 * Human-reviewable replacement proposed for one conflicting lineage.
 *
 * **Example** (Inspect proposal digest field)
 *
 * ```ts
 * import { ContradictionResolutionProposal } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionResolutionProposal.fields.proposalDigest !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionResolutionProposal extends S.Opaque<
  ContradictionResolutionProposal,
  { readonly brand: unique symbol }
>()(proposals.ContradictionResolutionProposalSchema) {}

const assessment = makeContradictionAssessment({ $I, vocabulary, ContradictionResolutionProposal });

/**
 * Maximum proposals retained for one contradiction candidate.
 *
 * **Example** (Print proposal max count)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_MAX_COUNT } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_MAX_COUNT) // 32
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_MAX_COUNT = PROPOSAL_MAX_COUNT;

/**
 * Detector confidence and explicit human-reviewable resolution proposals.
 *
 * **Example** (Inspect proposals field)
 *
 * ```ts
 * import { ContradictionAssessment } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionAssessment.fields.proposals !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionAssessment extends S.Opaque<ContradictionAssessment, { readonly brand: unique symbol }>()(
  assessment.ContradictionAssessmentSchema
) {}

const candidate = makeContradictionCandidate({
  $I,
  ContradictionAssessment,
  ContradictionMatchBasis,
  CanonicalContradictionBeliefPair,
});
const disposition = makeContradictionDispositionDecision({
  $I,
  vocabulary,
  ids: { edgeVersion: EpistemicIdentity.EdgeVersionId },
});

/**
 * Slice-local disposition vocabulary for contradiction review.
 *
 * **Details**
 *
 * Absence of a disposition means unresolved; a recorded disposition either
 * rejects the candidate or records the atomic supersession it caused.
 *
 * **Example** (Read superseded enum value)
 *
 * ```ts
 * import { ContradictionDispositionStatus } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionDispositionStatus.Enum.superseded)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionDispositionStatus = vocabulary.ContradictionDispositionStatus;

/**
 * Runtime type for {@link ContradictionDispositionStatus}.
 *
 * **Example** (Annotate rejected status)
 *
 * ```ts
 * import type { ContradictionDispositionStatus } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const status: ContradictionDispositionStatus = "rejected"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionDispositionStatus = typeof ContradictionDispositionStatus.Type;

/**
 * Maximum normalized length accepted for a contradiction review reason.
 *
 * **Example** (Print reason max length)
 *
 * ```ts
 * import { CONTRADICTION_REVIEW_REASON_MAX_LENGTH } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_REVIEW_REASON_MAX_LENGTH) // 2000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_REVIEW_REASON_MAX_LENGTH = REVIEW_REASON_MAX_LENGTH;

/**
 * Normalized human rationale attached to a contradiction review decision.
 *
 * **Details**
 *
 * Review text is trimmed before validation, must remain non-empty, and is
 * capped at 2,000 characters so immutable authority records stay bounded while
 * still allowing a multi-paragraph explanation.
 *
 * **Example** (Decode trimmed review reason)
 *
 * ```ts
 * import { ContradictionReviewReason } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const reason = Result.getOrThrow(
 *   S.decodeUnknownResult(ContradictionReviewReason)("  The passages address different issues.  ")
 * )
 * console.log(reason) // "The passages address different issues."
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ContradictionReviewReason = vocabulary.ContradictionReviewReason;

/**
 * Runtime type for {@link ContradictionReviewReason}.
 *
 * **Example** (Annotate review reason string)
 *
 * ```ts
 * import type { ContradictionReviewReason } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const reason: ContradictionReviewReason = "The evidence concerns a different period."
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReviewReason = typeof ContradictionReviewReason.Type;

/**
 * Typed durable outcome of a contradiction review.
 *
 * **Example** (Make rejected decision)
 *
 * ```ts
 * import { ContradictionDispositionDecision } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const decision = ContradictionDispositionDecision.cases.rejected.make({
 *   reason: "The detector compared different legal issues."
 * })
 * console.log(decision.status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ContradictionDispositionDecision = disposition.ContradictionDispositionDecision;

/**
 * Runtime type for {@link ContradictionDispositionDecision}.
 *
 * **Example** (Annotate decision object)
 *
 * ```ts
 * import type { ContradictionDispositionDecision } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const decision: ContradictionDispositionDecision = {
 *   reason: "Not a contradiction.",
 *   status: "rejected"
 * }
 * console.log(decision.status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionDispositionDecision = typeof ContradictionDispositionDecision.Type;

class CanonicalizedContradiction extends S.Opaque<CanonicalizedContradiction, { readonly brand: unique symbol }>()(
  candidate.CanonicalizedContradictionSchema
) {}

const behavior = makeContradictionBehavior({
  vocabulary,
  evidenceIdOrder: Order.mapInput(Order.String, (evidenceId: EpistemicIdentity.EvidenceId) => `${evidenceId}`),
  BeliefVersionRef,
  ContradictionMatchBasisStruct: matchBasis.ContradictionMatchBasisStructSchema,
  ContradictionMatchBasis,
  CanonicalContradictionBeliefPair,
  CanonicalizedContradiction,
  encodeProposalContent: proposals.encodeProposalContent,
  encodeCandidateContent: candidate.encodeCandidateContent,
});

type CanonicalizeContradiction = {
  (
    matchBasis: S.Struct.Type<typeof ContradictionMatchBasis.fields>
  ): (pair: S.Struct.Type<typeof ContradictionBeliefPair.fields>) => CanonicalizedContradiction;
  (
    pair: S.Struct.Type<typeof ContradictionBeliefPair.fields>,
    matchBasis: S.Struct.Type<typeof ContradictionMatchBasis.fields>
  ): CanonicalizedContradiction;
};

type ContradictionEvidenceDigestFn = {
  (
    rightEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>
  ): (leftEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>) => ContradictionEvidenceDigest;
  (
    leftEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>,
    rightEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>
  ): ContradictionEvidenceDigest;
};

type ContradictionCandidateKeyFn = {
  (
    matchBasis: S.Struct.Type<typeof ContradictionMatchBasis.fields>
  ): (pair: S.Struct.Type<typeof ContradictionBeliefPair.fields>) => ContradictionCandidateKey;
  (
    pair: S.Struct.Type<typeof ContradictionBeliefPair.fields>,
    matchBasis: S.Struct.Type<typeof ContradictionMatchBasis.fields>
  ): ContradictionCandidateKey;
};

/**
 * Put a belief pair and its side-bound evidence into canonical order.
 *
 * **Details**
 *
 * Reversing both input beliefs yields byte-identical output and swaps the
 * evidence arrays with them, so symmetric candidate identity never detaches
 * evidence from the belief it grounds.
 *
 * **Example** (Inspect function typeof)
 *
 * ```ts
 * import { canonicalizeContradiction } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(typeof canonicalizeContradiction)
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const canonicalizeContradiction: CanonicalizeContradiction = behavior.canonicalizeContradiction;

/**
 * Digest the exact side-specific evidence-id sets of one match basis.
 *
 * **Details**
 *
 * Each partition remains bound to its named side. Canonicalize the belief pair
 * and match basis together when presentation-order-independent identity is
 * required.
 *
 * **Example** (Digest side evidence sets)
 *
 * ```ts
 * import {
 *   ContradictionEvidenceDigest,
 *   contradictionEvidenceDigest,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const digest = contradictionEvidenceDigest(
 *   [Epistemic.EvidenceId.make(1)],
 *   [Epistemic.EvidenceId.make(2)]
 * )
 * console.log(S.is(ContradictionEvidenceDigest)(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionEvidenceDigest: ContradictionEvidenceDigestFn = behavior.contradictionEvidenceDigest;

/**
 * Compute the duplicate-suppression key for a canonical contradiction basis.
 *
 * **Example** (Inspect function typeof)
 *
 * ```ts
 * import { contradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(typeof contradictionCandidateKey)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionCandidateKey: ContradictionCandidateKeyFn = behavior.contradictionCandidateKey;

/**
 * Digest-bearing proposal content before its digest is attached.
 *
 * **Example** (Inspect content fields)
 *
 * ```ts
 * import { ContradictionProposalContent } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionProposalContent.fields.losingBelief !== undefined) // true
 * console.log(ContradictionProposalContent.fields.rationale !== undefined) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionProposalContent extends S.Opaque<
  ContradictionProposalContent,
  { readonly brand: unique symbol }
>()(proposals.ContradictionProposalContentSchema) {}

/**
 * Compute the digest a public proposal selection must echo.
 *
 * **Example** (Compute proposal digest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import {
 *   BeliefVersionRef,
 *   ContradictionProposalContent,
 *   ContradictionProposalId,
 *   contradictionProposalDigest,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import * as Str from "effect/String"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const digest = contradictionProposalDigest(
 *   ContradictionProposalContent.make({
 *     fact: { amount: "125" },
 *     losingBelief: BeliefVersionRef.make({
 *       edgeVersionId: Epistemic.EdgeVersionId.make(1),
 *       logicalKey: LogicalEdgeKey.make(Str.repeat(64)("a")),
 *       version: PosInt.make(1),
 *     }),
 *     proposalId: ContradictionProposalId.make(Str.repeat(64)("b")),
 *     rationale: "The signed amendment controls.",
 *     validFrom: DateTime.makeUnsafe(0),
 *     validTo: O.none(),
 *   })
 * )
 *
 * console.log(Result.isSuccess(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionProposalDigest: (
  content: ContradictionProposalContent
) => Result.Result<ContradictionProposalDigest, S.SchemaError> = behavior.contradictionProposalDigest;

/**
 * Immutable candidate payload with a validated half-open validity interval.
 *
 * **Example** (Inspect validFrom field)
 *
 * ```ts
 * import { ContradictionCandidateContent } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionCandidateContent.fields.validFrom !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionCandidateContent extends S.Opaque<
  ContradictionCandidateContent,
  { readonly brand: unique symbol }
>()(candidate.ContradictionCandidateContentSchema) {}

/**
 * Compute the immutable candidate payload digest used to reject key collisions.
 *
 * **Example** (Compute candidate payload digest)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import {
 *   BeliefVersionRef,
 *   ContradictionAssessment,
 *   CanonicalContradictionBeliefPair,
 *   ContradictionCandidateContent,
 *   ContradictionMatchBasis,
 *   ContradictionProposalDigest,
 *   ContradictionProposalId,
 *   ContradictionResolutionProposal,
 *   contradictionCandidateDigest,
 *   contradictionEvidenceDigest,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import { Confidence } from "@beep/epistemics/EvidenceSpan"
 * import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import * as Str from "effect/String"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const leftEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(1)]
 * const rightEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(2)]
 * const validFrom = DateTime.makeUnsafe(0)
 * const left = BeliefVersionRef.make({
 *   edgeVersionId: Epistemic.EdgeVersionId.make(1),
 *   logicalKey: LogicalEdgeKey.make(Str.repeat(64)("a")),
 *   version: PosInt.make(1),
 * })
 * const right = BeliefVersionRef.make({
 *   edgeVersionId: Epistemic.EdgeVersionId.make(2),
 *   logicalKey: LogicalEdgeKey.make(Str.repeat(64)("b")),
 *   version: PosInt.make(1),
 * })
 * const proposal = ContradictionResolutionProposal.make({
 *   fact: { amount: "125" },
 *   losingBelief: left,
 *   proposalDigest: ContradictionProposalDigest.make(Str.repeat(64)("c")),
 *   proposalId: ContradictionProposalId.make(Str.repeat(64)("d")),
 *   rationale: "The signed amendment controls.",
 *   validFrom,
 *   validTo: O.none(),
 * })
 * const digest = contradictionCandidateDigest(
 *   ContradictionCandidateContent.make({
 *     assessment: ContradictionAssessment.make({
 *       confidence: Confidence.make(0.95),
 *       proposals: [proposal],
 *     }),
 *     matchBasis: ContradictionMatchBasis.make({
 *       detector: "example-detector",
 *       detectorVersion: "0.0.0",
 *       evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
 *       kind: "independent-evidence",
 *       leftEvidenceIds,
 *       rightEvidenceIds,
 *     }),
 *     pair: CanonicalContradictionBeliefPair.make({ left, right }),
 *     validFrom,
 *     validTo: O.none(),
 *   })
 * )
 *
 * console.log(Result.isSuccess(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionCandidateDigest: (
  content: S.Struct.Type<typeof ContradictionCandidateContent.fields>
) => Result.Result<ContradictionCandidateDigest, S.SchemaError> = behavior.contradictionCandidateDigest;

const arbitraries = makeContradictionArbitraries({
  makeEvidenceId: (value: number) => EpistemicIdentity.EvidenceId.make(value),
  BeliefVersionRef,
  ContradictionBeliefPairStruct: beliefPairs.ContradictionBeliefPairStructSchema,
  beliefsAreDistinct: beliefPairs.beliefsAreDistinct,
  ContradictionBeliefPair,
  CanonicalContradictionBeliefPair,
  ContradictionMatchBasisStruct: matchBasis.ContradictionMatchBasisStructSchema,
  ContradictionMatchBasis,
  ContradictionResolutionProposalStructArbitrary: proposals.ContradictionResolutionProposalStructArbitrary,
  ContradictionResolutionProposal,
  proposalsShareId: assessment.proposalsShareId,
  ContradictionAssessment,
  ContradictionCandidateInterval: candidate.ContradictionCandidateIntervalSchema,
  ContradictionCandidateContent,
});

/**
 * Native generator preserving the cross-field invariants of ContradictionBeliefPair.
 *
 * **Example** (Sample a valid value)
 *
 * ```ts
 * import { ContradictionBeliefPairArbitrary } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Arbitrary from "effect/Arbitrary"
 *
 * const sample = Arbitrary.sampleEffect(ContradictionBeliefPairArbitrary, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const ContradictionBeliefPairArbitrary: Arbitrary.Arbitrary<ContradictionBeliefPair> =
  arbitraries.ContradictionBeliefPairArbitrary;

/**
 * Native generator preserving the cross-field invariants of CanonicalContradictionBeliefPair.
 *
 * **Example** (Sample a valid value)
 *
 * ```ts
 * import { CanonicalContradictionBeliefPairArbitrary } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Arbitrary from "effect/Arbitrary"
 *
 * const sample = Arbitrary.sampleEffect(CanonicalContradictionBeliefPairArbitrary, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const CanonicalContradictionBeliefPairArbitrary: Arbitrary.Arbitrary<CanonicalContradictionBeliefPair> =
  arbitraries.CanonicalContradictionBeliefPairArbitrary;

/**
 * Native generator preserving the cross-field invariants of ContradictionMatchBasis.
 *
 * **Example** (Sample a valid value)
 *
 * ```ts
 * import { ContradictionMatchBasisArbitrary } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Arbitrary from "effect/Arbitrary"
 *
 * const sample = Arbitrary.sampleEffect(ContradictionMatchBasisArbitrary, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const ContradictionMatchBasisArbitrary: Arbitrary.Arbitrary<ContradictionMatchBasis> =
  arbitraries.ContradictionMatchBasisArbitrary;

/**
 * Native generator preserving the cross-field invariants of ContradictionResolutionProposal.
 *
 * **Example** (Sample a valid value)
 *
 * ```ts
 * import { ContradictionResolutionProposalArbitrary } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Arbitrary from "effect/Arbitrary"
 *
 * const sample = Arbitrary.sampleEffect(ContradictionResolutionProposalArbitrary, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const ContradictionResolutionProposalArbitrary: Arbitrary.Arbitrary<ContradictionResolutionProposal> =
  arbitraries.ContradictionResolutionProposalArbitrary;

/**
 * Native generator preserving the cross-field invariants of ContradictionAssessment.
 *
 * **Example** (Sample a valid value)
 *
 * ```ts
 * import { ContradictionAssessmentArbitrary } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Arbitrary from "effect/Arbitrary"
 *
 * const sample = Arbitrary.sampleEffect(ContradictionAssessmentArbitrary, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const ContradictionAssessmentArbitrary: Arbitrary.Arbitrary<ContradictionAssessment> =
  arbitraries.ContradictionAssessmentArbitrary;

/**
 * Native generator preserving the cross-field invariants of ContradictionCandidateContent.
 *
 * **Example** (Sample a valid value)
 *
 * ```ts
 * import { ContradictionCandidateContentArbitrary } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Arbitrary from "effect/Arbitrary"
 *
 * const sample = Arbitrary.sampleEffect(ContradictionCandidateContentArbitrary, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const ContradictionCandidateContentArbitrary: Arbitrary.Arbitrary<ContradictionCandidateContent> =
  arbitraries.ContradictionCandidateContentArbitrary;

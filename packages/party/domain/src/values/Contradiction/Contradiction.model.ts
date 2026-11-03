/**
 * Contradiction-candidate value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- Nominal party bindings instantiate shared epistemics factories with party ids and brands; importing another product slice would violate the boundary. No copied algorithms. Review by 2026-12-03 or on factory/API changes.
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
import { $PartyDomainId } from "@beep/identity/packages";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as PartyIds from "../../Ids.ts";
import { LogicalEdgeKey } from "../LogicalEdgeIdentity/index.ts";
import type * as Arbitrary from "effect/Arbitrary";
import type * as Result from "effect/Result";

const $I = $PartyDomainId.create("values/Contradiction/Contradiction.model");
const vocabulary = makeContradictionVocabulary({ $I });
const beliefRef = makeBeliefVersionRef({
  $I,
  ids: { edgeVersion: PartyIds.ClaimVersionId },
  positiveInt: S.Int.check(
    S.isGreaterThan(0, $I.annote("PositiveVersion", { message: "Expected a positive version." }))
  ),
  LogicalEdgeKey,
});
const matchBasis = makeContradictionMatchBasis({ $I, vocabulary, ids: { evidence: PartyIds.AssertionId } });
/**
 * Digest identifying one contradiction candidate independent of submission
 * order.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionCandidateKey } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionCandidateKey)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionCandidateKey = vocabulary.ContradictionCandidateKey;

/**
 * Runtime type for {@link ContradictionCandidateKey}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionCandidateKey = typeof ContradictionCandidateKey.Type;

/**
 * Caller-owned idempotency key for one contradiction submission receipt.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionReceiptKey } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionReceiptKey)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionReceiptKey = vocabulary.ContradictionReceiptKey;

/**
 * Runtime type for {@link ContradictionReceiptKey}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReceiptKey = typeof ContradictionReceiptKey.Type;

/**
 * Digest of the immutable payload stored under a candidate identity.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionCandidateDigest } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionCandidateDigest)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionCandidateDigest = vocabulary.ContradictionCandidateDigest;

/**
 * Runtime type for {@link ContradictionCandidateDigest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionCandidateDigest = typeof ContradictionCandidateDigest.Type;

/**
 * Digest of the exact evidence sets used as a contradiction match basis.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionEvidenceDigest } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionEvidenceDigest)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionEvidenceDigest = vocabulary.ContradictionEvidenceDigest;

/**
 * Runtime type for {@link ContradictionEvidenceDigest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionEvidenceDigest = typeof ContradictionEvidenceDigest.Type;

/**
 * Stable proposal identifier persisted before human review.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionProposalId } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionProposalId)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionProposalId = vocabulary.ContradictionProposalId;

/**
 * Runtime type for {@link ContradictionProposalId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionProposalId = typeof ContradictionProposalId.Type;

/**
 * Digest guarding the complete authority-changing content of a proposal.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionProposalDigest } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionProposalDigest)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionProposalDigest = vocabulary.ContradictionProposalDigest;

/**
 * Runtime type for {@link ContradictionProposalDigest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionProposalDigest = typeof ContradictionProposalDigest.Type;

/**
 * Exact immutable edge version observed as one side of a contradiction.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { BeliefVersionRef } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(BeliefVersionRef)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionBeliefPair } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionBeliefPair)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CanonicalContradictionBeliefPair } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(CanonicalContradictionBeliefPair)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionMatchBasisKind } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionMatchBasisKind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionMatchBasisKind = vocabulary.ContradictionMatchBasisKind;

/**
 * Runtime type for {@link ContradictionMatchBasisKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionMatchBasisKind = typeof ContradictionMatchBasisKind.Type;

/**
 * Maximum evidence identifiers retained on either side of one contradiction.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CONTRADICTION_EVIDENCE_SET_MAX_COUNT } from "@beep/party-domain/Contradiction"
 * const binding = CONTRADICTION_EVIDENCE_SET_MAX_COUNT
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_EVIDENCE_SET_MAX_COUNT = EVIDENCE_SET_MAX_COUNT;

/**
 * Maximum UTF-16 length accepted for a contradiction detector identity.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CONTRADICTION_DETECTOR_MAX_LENGTH } from "@beep/party-domain/Contradiction"
 * const binding = CONTRADICTION_DETECTOR_MAX_LENGTH
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_DETECTOR_MAX_LENGTH = DETECTOR_MAX_LENGTH;

/**
 * Evidence and detector revision that form the repeatable match basis.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionMatchBasis } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionMatchBasis)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH } from "@beep/party-domain/Contradiction"
 * const binding = CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH = PROPOSAL_RATIONALE_MAX_LENGTH;

/**
 * Maximum canonical UTF-8 bytes accepted for one replacement fact.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_FACT_MAX_BYTES } from "@beep/party-domain/Contradiction"
 * const binding = CONTRADICTION_PROPOSAL_FACT_MAX_BYTES
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { makeValidIntervalCheck } from "@beep/party-domain/Contradiction"
 * const binding = makeValidIntervalCheck
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionResolutionProposal } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionResolutionProposal)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_MAX_COUNT } from "@beep/party-domain/Contradiction"
 * const binding = CONTRADICTION_PROPOSAL_MAX_COUNT
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_MAX_COUNT = PROPOSAL_MAX_COUNT;

/**
 * Detector confidence and explicit human-reviewable resolution proposals.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionAssessment } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionAssessment)
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
  ids: { edgeVersion: PartyIds.ClaimVersionId },
});

/**
 * Slice-local disposition vocabulary for contradiction review.
 *
 * **Details**
 *
 * Absence of a disposition means unresolved; a recorded disposition either
 * rejects the candidate or records the atomic supersession it caused.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionDispositionStatus } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionDispositionStatus)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionDispositionStatus = vocabulary.ContradictionDispositionStatus;

/**
 * Runtime type for {@link ContradictionDispositionStatus}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionDispositionStatus = typeof ContradictionDispositionStatus.Type;

/**
 * Maximum normalized length accepted for a contradiction review reason.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CONTRADICTION_REVIEW_REASON_MAX_LENGTH } from "@beep/party-domain/Contradiction"
 * const binding = CONTRADICTION_REVIEW_REASON_MAX_LENGTH
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionReviewReason } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionReviewReason)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ContradictionReviewReason = vocabulary.ContradictionReviewReason;

/**
 * Runtime type for {@link ContradictionReviewReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReviewReason = typeof ContradictionReviewReason.Type;

/**
 * Typed durable outcome of a contradiction review.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionDispositionDecision } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionDispositionDecision)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ContradictionDispositionDecision = disposition.ContradictionDispositionDecision;

/**
 * Runtime type for {@link ContradictionDispositionDecision}.
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
  evidenceIdOrder: Order.mapInput(Order.String, (evidenceId: PartyIds.AssertionId) => `${evidenceId}`),
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
    rightEvidenceIds: ReadonlyArray<PartyIds.AssertionId>
  ): (leftEvidenceIds: ReadonlyArray<PartyIds.AssertionId>) => ContradictionEvidenceDigest;
  (
    leftEvidenceIds: ReadonlyArray<PartyIds.AssertionId>,
    rightEvidenceIds: ReadonlyArray<PartyIds.AssertionId>
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { canonicalizeContradiction } from "@beep/party-domain/Contradiction"
 * const binding = canonicalizeContradiction
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { contradictionEvidenceDigest } from "@beep/party-domain/Contradiction"
 * const binding = contradictionEvidenceDigest
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionEvidenceDigest: ContradictionEvidenceDigestFn = behavior.contradictionEvidenceDigest;

/**
 * Compute the duplicate-suppression key for a canonical contradiction basis.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { contradictionCandidateKey } from "@beep/party-domain/Contradiction"
 * const binding = contradictionCandidateKey
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionCandidateKey: ContradictionCandidateKeyFn = behavior.contradictionCandidateKey;

/**
 * Digest-bearing proposal content before its digest is attached.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionProposalContent } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionProposalContent)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { contradictionProposalDigest } from "@beep/party-domain/Contradiction"
 * const binding = contradictionProposalDigest
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionCandidateContent } from "@beep/party-domain/Contradiction"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionCandidateContent)
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { contradictionCandidateDigest } from "@beep/party-domain/Contradiction"
 * const binding = contradictionCandidateDigest
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionCandidateDigest: (
  content: S.Struct.Type<typeof ContradictionCandidateContent.fields>
) => Result.Result<ContradictionCandidateDigest, S.SchemaError> = behavior.contradictionCandidateDigest;

const arbitraries = makeContradictionArbitraries({
  makeEvidenceId: (value: number) => PartyIds.AssertionId.make(`party-asrt:${value}`),
  BeliefVersionRef,
  ContradictionBeliefPairStruct: beliefPairs.ContradictionBeliefPairStructSchema,
  beliefsAreDistinct: beliefPairs.beliefsAreDistinct,
  ContradictionBeliefPair,
  CanonicalContradictionBeliefPair,
  ContradictionMatchBasisStruct: matchBasis.ContradictionMatchBasisStructSchema,
  ContradictionMatchBasis,
  ContradictionResolutionProposalStruct: proposals.ContradictionResolutionProposalStructSchema,
  ContradictionResolutionProposal,
  proposalsShareId: assessment.proposalsShareId,
  ContradictionAssessment,
  ContradictionCandidateInterval: candidate.ContradictionCandidateIntervalSchema,
  ContradictionCandidateContent,
});

/**
 * Native generator preserving the cross-field invariants of ContradictionBeliefPair.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionBeliefPairArbitrary } from "@beep/party-domain/Contradiction"
 * const binding = ContradictionBeliefPairArbitrary
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { CanonicalContradictionBeliefPairArbitrary } from "@beep/party-domain/Contradiction"
 * const binding = CanonicalContradictionBeliefPairArbitrary
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionMatchBasisArbitrary } from "@beep/party-domain/Contradiction"
 * const binding = ContradictionMatchBasisArbitrary
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionResolutionProposalArbitrary } from "@beep/party-domain/Contradiction"
 * const binding = ContradictionResolutionProposalArbitrary
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionAssessmentArbitrary } from "@beep/party-domain/Contradiction"
 * const binding = ContradictionAssessmentArbitrary
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
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionCandidateContentArbitrary } from "@beep/party-domain/Contradiction"
 * const binding = ContradictionCandidateContentArbitrary
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const ContradictionCandidateContentArbitrary: Arbitrary.Arbitrary<ContradictionCandidateContent> =
  arbitraries.ContradictionCandidateContentArbitrary;

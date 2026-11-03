/**
 * Caller-populated contradiction-detection inputs and sealed output content.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  ExactNegationConfidence as ExactNegation,
  makeContradictionDetectionSnapshot,
  makeContradictionDetectionVocabulary,
  makeDetectedContradiction,
  makeDetectionBelief,
  ValueConflictConfidence as ValueConflict,
} from "@beep/epistemics/ContradictionDetection";
import { $PartyDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import {
  BeliefVersionRef,
  ContradictionCandidateContent,
  ContradictionCandidateDigest,
  ContradictionCandidateKey,
  ContradictionMatchBasis,
  ContradictionProposalContent,
} from "../Contradiction/index.ts";

const $I = $PartyDomainId.create("values/ContradictionDetection/ContradictionDetection.model");
const vocabulary = makeContradictionDetectionVocabulary({ $I });
const belief = makeDetectionBelief({
  $I,
  vocabulary,
  BeliefVersionRef,
  ContradictionMatchBasis,
  ContradictionProposalContent,
});
/**
 * Direct logical conflict classes supported by detector version 1.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ConflictClass } from "@beep/party-domain/ContradictionDetection"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ConflictClass)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictClass = vocabulary.ConflictClass;

/** Runtime type of {@link ConflictClass}.
 * @category type-level
 * @since 0.0.0
 */
export type ConflictClass = typeof ConflictClass.Type;

/**
 * Explicit assertion polarity supplied by the snapshot caller.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { DetectionPolarity } from "@beep/party-domain/ContradictionDetection"
 * import * as S from "effect/Schema"
 * const accepts = S.is(DetectionPolarity)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DetectionPolarity = vocabulary.DetectionPolarity;

/** Runtime type of {@link DetectionPolarity}.
 * @category type-level
 * @since 0.0.0
 */
export type DetectionPolarity = typeof DetectionPolarity.Type;

/**
 * One caller-populated assertion whose whole fact fits a shipped resolution proposal.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { DetectionBelief } from "@beep/party-domain/ContradictionDetection"
 * import * as S from "effect/Schema"
 * const accepts = S.is(DetectionBelief)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DetectionBelief extends S.Opaque<DetectionBelief, { readonly brand: unique symbol }>()(
  belief.DetectionBeliefSchema
) {}

const snapshot = makeContradictionDetectionSnapshot({ $I, vocabulary, DetectionBelief });

/**
 * One explicit view snapshot with caller-declared single-valued predicate keys.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ContradictionDetectionSnapshot } from "@beep/party-domain/ContradictionDetection"
 * import * as S from "effect/Schema"
 * const accepts = S.is(ContradictionDetectionSnapshot)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionDetectionSnapshot extends S.Opaque<
  ContradictionDetectionSnapshot,
  { readonly brand: unique symbol }
>()(snapshot.ContradictionDetectionSnapshotSchema) {}

/**
 * Fixed confidence for an assertion paired with its explicit equal negation.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ExactNegationConfidence } from "@beep/party-domain/ContradictionDetection"
 * import * as S from "effect/Schema"
 * const confidence = ExactNegationConfidence
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ExactNegationConfidence = ExactNegation;

/**
 * Fixed review hint for unequal assertions under caller-declared single cardinality.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { ValueConflictConfidence } from "@beep/party-domain/ContradictionDetection"
 * import * as S from "effect/Schema"
 * const confidence = ValueConflictConfidence
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ValueConflictConfidence = ValueConflict;

const detected = makeDetectedContradiction({
  $I,
  contradiction: { ContradictionCandidateDigest, ContradictionCandidateKey },
  ContradictionCandidateContent,
});

/**
 * Candidate content plus shipped seals, without clock or database stamps.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { DetectedContradiction } from "@beep/party-domain/ContradictionDetection"
 * import * as S from "effect/Schema"
 * const accepts = S.is(DetectedContradiction)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DetectedContradiction extends S.Opaque<DetectedContradiction, { readonly brand: unique symbol }>()(
  detected.DetectedContradictionSchema
) {}

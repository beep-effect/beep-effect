/**
 * Caller-populated contradiction-detection inputs and sealed output content.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import {
  BeliefVersionRef,
  ContradictionCandidateContent,
  ContradictionCandidateDigest,
  ContradictionCandidateKey,
  ContradictionMatchBasis,
  ContradictionProposalContent,
  makeValidIntervalCheck,
} from "../Contradiction/index.ts";
import { Confidence } from "../EvidenceSpan/index.ts";

const $I = $EpistemicDomainId.create("values/ContradictionDetection/ContradictionDetection.model");
const ConflictClassBase = LiteralKit(["exact-negation", "value-conflict"]);
const DetectionPolarityBase = LiteralKit(["asserted", "negated"]);
/**
 * Direct logical conflict classes supported by detector version 1.
 *
 * **Example** (ConflictClass)
 *
 * ```ts import.meta.vitest name="ConflictClass"
 * import { ConflictClass } from "@beep/epistemic-domain/values/ContradictionDetection"
 * console.log(ConflictClass.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConflictClass = ConflictClassBase.pipe(
  $I.annoteSchema("ConflictClass", { description: "Direct logical conflict classes supported by detector version 1." }),
  SchemaUtils.withLiteralKitStatics(ConflictClassBase)
);
/** Runtime type of {@link ConflictClass}.
 * @category type-level
 * @since 0.0.0
 */
export type ConflictClass = typeof ConflictClass.Type;
/**
 * Explicit assertion polarity supplied by the snapshot caller.
 *
 * **Example** (DetectionPolarity)
 *
 * ```ts import.meta.vitest name="DetectionPolarity"
 * import { DetectionPolarity } from "@beep/epistemic-domain/values/ContradictionDetection"
 * console.log(DetectionPolarity.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DetectionPolarity = DetectionPolarityBase.pipe(
  $I.annoteSchema("DetectionPolarity", { description: "Explicit assertion polarity supplied by the snapshot caller." }),
  SchemaUtils.withLiteralKitStatics(DetectionPolarityBase)
);
/** Runtime type of {@link DetectionPolarity}.
 * @category type-level
 * @since 0.0.0
 */
export type DetectionPolarity = typeof DetectionPolarity.Type;
const DetectionKey = S.Trim.check(S.isNonEmpty(), S.isMaxLength(256)).pipe(
  $I.annoteSchema("DetectionKey", {
    description: "Caller-owned exact subject, predicate or modality token, at most 256 characters.",
  })
);
const EvidenceIds = ContradictionMatchBasis.fields.leftEvidenceIds;
const assertionFitsProposal = S.makeFilter(
  (belief: {
    readonly subject: string;
    readonly predicate: string;
    readonly value: S.Json;
    readonly polarity: DetectionPolarity;
  }) =>
    S.is(ContradictionProposalContent.fields.fact)({
      subject: belief.subject,
      predicate: belief.predicate,
      value: belief.value,
      polarity: belief.polarity,
    }),
  {
    identifier: $I`AssertionFitsProposal`,
    title: "Assertion fits proposal fact",
    description: "Bounds the complete replacement assertion by the shipped proposal fact limits.",
    message: "Expected an assertion fitting the shipped proposal fact bounds.",
  }
);
class DetectionBeliefStruct extends S.Class<DetectionBeliefStruct>($I`DetectionBeliefStruct`)(
  {
    ref: BeliefVersionRef,
    subject: DetectionKey,
    predicate: DetectionKey,
    value: S.Json,
    polarity: DetectionPolarity,
    evidenceIds: EvidenceIds,
    validFrom: S.DateTimeUtcFromMillis,
    validTo: S.OptionFromNullOr(S.DateTimeUtcFromMillis),
    modality: S.OptionFromOptionalKey(DetectionKey),
  },
  $I.annote("DetectionBeliefStruct", { description: "One immutable belief assertion supplied by a view caller." })
) {}
const DetectionBeliefChecked = DetectionBeliefStruct.mapFields((fields) => fields).check(
  assertionFitsProposal,
  makeValidIntervalCheck({
    identifier: $I`DetectionBeliefInterval`,
    title: "Detection belief interval",
    description: "Requires a non-empty forward half-open belief interval.",
  })
);
/**
 * One caller-populated assertion whose whole fact fits a shipped resolution proposal.
 *
 * **Example** (DetectionBelief)
 *
 * ```ts import.meta.vitest name="DetectionBelief"
 * import { DetectionBelief } from "@beep/epistemic-domain/values/ContradictionDetection"
 * console.log(DetectionBelief.fields.polarity.literals)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DetectionBelief extends S.Class<DetectionBelief>($I`DetectionBelief`)(
  DetectionBeliefChecked,
  $I.annote("DetectionBelief", { description: "Validated immutable assertion; absent modality remains optional." })
) {}
const UniqueBeliefs = S.Array(DetectionBelief).check(
  S.makeFilter(
    (beliefs) =>
      HashSet.size(HashSet.fromIterable(A.map(beliefs, (belief) => belief.ref.edgeVersionId))) === A.length(beliefs),
    {
      identifier: $I`UniqueSnapshotBeliefs`,
      title: "Unique snapshot beliefs",
      description: "Each immutable edge version occurs once in one view snapshot.",
      message: "Expected distinct edgeVersionIds in the snapshot.",
    }
  )
);
/**
 * One explicit view snapshot with caller-declared single-valued predicate keys.
 *
 * **Example** (ContradictionDetectionSnapshot)
 *
 * ```ts import.meta.vitest name="ContradictionDetectionSnapshot"
 * import { ContradictionDetectionSnapshot } from "@beep/epistemic-domain/values/ContradictionDetection"
 * console.log(ContradictionDetectionSnapshot.fields.singleValuedPredicates)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionDetectionSnapshot extends S.Class<ContradictionDetectionSnapshot>(
  $I`ContradictionDetectionSnapshot`
)(
  { beliefs: UniqueBeliefs, singleValuedPredicates: S.Array(DetectionKey) },
  $I.annote("ContradictionDetectionSnapshot", {
    description: "Complete detector input; undeclared predicates are treated as multi-valued.",
  })
) {}
/**
 * Fixed confidence for an assertion paired with its explicit equal negation.
 *
 * **Example** (ExactNegationConfidence)
 *
 * ```ts import.meta.vitest name="ExactNegationConfidence"
 * import { ExactNegationConfidence } from "@beep/epistemic-domain/values/ContradictionDetection"
 * console.log(ExactNegationConfidence)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ExactNegationConfidence = Confidence.make(1);
/**
 * Fixed review hint for unequal assertions under caller-declared single cardinality.
 *
 * **Example** (ValueConflictConfidence)
 *
 * ```ts import.meta.vitest name="ValueConflictConfidence"
 * import { ValueConflictConfidence } from "@beep/epistemic-domain/values/ContradictionDetection"
 * console.log(ValueConflictConfidence)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ValueConflictConfidence = Confidence.make(0.9);
class DetectedContradictionStruct extends S.Class<DetectedContradictionStruct>($I`DetectedContradictionStruct`)(
  {
    ...ContradictionCandidateContent.fields,
    candidateKey: ContradictionCandidateKey,
    candidateDigest: ContradictionCandidateDigest,
  },
  $I.annote("DetectedContradictionStruct", {
    description: "Pure emitted content and seals, ready for caller-owned stamping.",
  })
) {}

/**
 * Candidate content plus shipped seals, without clock or database stamps.
 *
 * **Example** (DetectedContradiction)
 *
 * ```ts import.meta.vitest name="DetectedContradiction"
 * import { DetectedContradiction } from "@beep/epistemic-domain/values/ContradictionDetection"
 * console.log(DetectedContradiction.fields.candidateKey)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DetectedContradiction extends S.Class<DetectedContradiction>($I`DetectedContradiction`)(
  DetectedContradictionStruct.mapFields((fields) => fields).check(
    makeValidIntervalCheck({
      identifier: $I`DetectedContradictionInterval`,
      title: "Detected contradiction interval",
      description: "Preserves the shipped content's non-empty half-open validity invariant.",
    })
  ),
  $I.annote("DetectedContradiction", {
    description: "Pure emitted content and seals with a valid half-open interval, ready for caller-owned stamping.",
  })
) {}

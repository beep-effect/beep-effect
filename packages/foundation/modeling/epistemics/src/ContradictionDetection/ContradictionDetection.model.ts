/**
 * Caller-populated contradiction-detection input and sealed output schema
 * factories.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { Confidence } from "../Confidence.ts";
import { makeValidIntervalCheck } from "../Contradiction/index.ts";
import type { ContradictionVocabulary } from "../Contradiction/index.ts";
import type { FieldSchema, IdentityConfig, SchemaIdentity } from "../Factory/index.ts";

/**
 * Fixed confidence for an assertion paired with its explicit equal negation.
 *
 * **Example** (Print the exact-negation confidence)
 *
 * ```ts
 * import { ExactNegationConfidence } from "@beep/epistemics/ContradictionDetection"
 *
 * console.log(ExactNegationConfidence) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ExactNegationConfidence = Confidence.make(1);

/**
 * Fixed review hint for unequal assertions under caller-declared single cardinality.
 *
 * **Example** (Print the value-conflict confidence)
 *
 * ```ts
 * import { ValueConflictConfidence } from "@beep/epistemics/ContradictionDetection"
 *
 * console.log(ValueConflictConfidence) // 0.9
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ValueConflictConfidence = Confidence.make(0.9);

/**
 * Build the id-free detection vocabulary: conflict classes, assertion polarity
 * and the bounded detection key.
 *
 * **Example** (Bind the detection vocabulary)
 *
 * ```ts
 * import { makeContradictionDetectionVocabulary } from "@beep/epistemics/ContradictionDetection"
 * import { $ScratchpadId } from "@beep/identity/packages"
 *
 * const { DetectionPolarity } = makeContradictionDetectionVocabulary({
 *   $I: $ScratchpadId.create("party/ContradictionDetection")
 * })
 * console.log(DetectionPolarity.Enum.negated) // "negated"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionDetectionVocabulary = (config: IdentityConfig) => {
  const { $I } = config;
  const ConflictClassBase = LiteralKit(["exact-negation", "value-conflict"]);
  const DetectionPolarityBase = LiteralKit(["asserted", "negated"]);

  const ConflictClass = ConflictClassBase.pipe(
    $I.annoteSchema("ConflictClass", {
      description: "Direct logical conflict classes supported by detector version 1.",
    }),
    SchemaUtils.withLiteralKitStatics(ConflictClassBase)
  );

  const DetectionPolarity = DetectionPolarityBase.pipe(
    $I.annoteSchema("DetectionPolarity", {
      description: "Explicit assertion polarity supplied by the snapshot caller.",
    }),
    SchemaUtils.withLiteralKitStatics(DetectionPolarityBase)
  );

  const DetectionKey = S.Trim.check(S.isNonEmpty(), S.isMaxLength(256)).pipe(
    $I.annoteSchema("DetectionKey", {
      description: "Caller-owned exact subject, predicate or modality token, at most 256 characters.",
    })
  );

  return { ConflictClass, DetectionPolarity, DetectionKey };
};

/**
 * The id-free schemas returned by {@link makeContradictionDetectionVocabulary}.
 *
 * **Example** (Type a detection vocabulary parameter)
 *
 * ```ts
 * import type { ContradictionDetectionVocabulary } from "@beep/epistemics/ContradictionDetection"
 *
 * const polaritiesOf = (vocabulary: ContradictionDetectionVocabulary) => vocabulary.DetectionPolarity.literals
 * console.log(typeof polaritiesOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContradictionDetectionVocabulary = ReturnType<typeof makeContradictionDetectionVocabulary>;

/**
 * Build the detection belief over caller-bound belief reference, match-basis
 * and proposal-content classes.
 *
 * **Details**
 *
 * Returns `DetectionBeliefSchema`, the checked struct a binding wraps in its own
 * `S.Opaque` class: one immutable assertion whose complete replacement fact fits
 * the proposal fact bounds and whose validity interval is forward half-open.
 * Evidence sets reuse the match basis's side schema.
 *
 * **Example** (Inspect the detection belief fields)
 *
 * ```ts
 * import { makeContradictionDetectionVocabulary, makeDetectionBelief } from "@beep/epistemics/ContradictionDetection"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/ContradictionDetection")
 * const { DetectionBeliefSchema } = makeDetectionBelief({
 *   $I,
 *   vocabulary: makeContradictionDetectionVocabulary({ $I }),
 *   BeliefVersionRef: S.Struct({ edgeVersionId: S.String }),
 *   ContradictionMatchBasis: { fields: { leftEvidenceIds: S.NonEmptyArray(S.String) } },
 *   ContradictionProposalContent: { fields: { fact: S.JsonObject } }
 * })
 * console.log(Object.keys(DetectionBeliefSchema.fields).length) // 9
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDetectionBelief = <
  Ref,
  RefEncoded,
  RefMake,
  EvidenceIds,
  EvidenceIdsEncoded,
  EvidenceIdsMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly vocabulary: ContradictionDetectionVocabulary;
  readonly BeliefVersionRef: FieldSchema<Ref, RefEncoded, RefMake>;
  readonly ContradictionMatchBasis: {
    readonly fields: { readonly leftEvidenceIds: FieldSchema<EvidenceIds, EvidenceIdsEncoded, EvidenceIdsMake> };
  };
  readonly ContradictionProposalContent: { readonly fields: { readonly fact: S.Top } };
}) => {
  const { $I, vocabulary, BeliefVersionRef, ContradictionMatchBasis, ContradictionProposalContent } = config;
  const { DetectionKey, DetectionPolarity } = vocabulary;
  const EvidenceIds = ContradictionMatchBasis.fields.leftEvidenceIds;

  const assertionFitsProposal = S.makeFilter(
    (belief: {
      readonly subject: string;
      readonly predicate: string;
      readonly value: S.Json;
      readonly polarity: typeof DetectionPolarity.Type;
    }) =>
      S.is(ContradictionProposalContent.fields.fact)({
        subject: belief.subject,
        predicate: belief.predicate,
        value: belief.value,
        polarity: belief.polarity,
      }),
    $I.annote("AssertionFitsProposal", {
      title: "Assertion fits proposal fact",
      description: "Bounds the complete replacement assertion by the shipped proposal fact limits.",
      message: "Expected an assertion fitting the shipped proposal fact bounds.",
    })
  );

  const DetectionBeliefStructSchema = S.Struct({
    ref: BeliefVersionRef,
    subject: DetectionKey,
    predicate: DetectionKey,
    value: S.Json,
    polarity: DetectionPolarity,
    evidenceIds: EvidenceIds,
    validFrom: S.DateTimeUtcFromMillis,
    validTo: S.OptionFromNullOr(S.DateTimeUtcFromMillis),
    modality: S.OptionFromOptionalKey(DetectionKey),
  }).pipe(
    $I.annoteSchema("DetectionBeliefStruct", {
      description: "One immutable belief assertion supplied by a view caller.",
    })
  );

  const DetectionBeliefSchema = DetectionBeliefStructSchema.mapFields((fields) => fields)
    .check(
      assertionFitsProposal,
      makeValidIntervalCheck(
        $I.annote("DetectionBeliefInterval", {
          title: "Detection belief interval",
          description: "Requires a non-empty forward half-open belief interval.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("DetectionBelief", {
        description: "Validated immutable assertion; absent modality remains optional.",
      })
    );

  return { DetectionBeliefSchema };
};

/**
 * Build the detector snapshot over a caller-bound detection belief class.
 *
 * **Details**
 *
 * Returns `ContradictionDetectionSnapshotSchema`: every belief of one view, each
 * immutable edge version at most once, and the predicates the caller declares
 * single-valued (all others are treated as multi-valued).
 *
 * **Example** (Inspect the snapshot fields)
 *
 * ```ts
 * import {
 *   makeContradictionDetectionSnapshot,
 *   makeContradictionDetectionVocabulary
 * } from "@beep/epistemics/ContradictionDetection"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/ContradictionDetection")
 * const { ContradictionDetectionSnapshotSchema } = makeContradictionDetectionSnapshot({
 *   $I,
 *   vocabulary: makeContradictionDetectionVocabulary({ $I }),
 *   DetectionBelief: S.Struct({ ref: S.Struct({ edgeVersionId: S.String }) })
 * })
 * console.log(Object.keys(ContradictionDetectionSnapshotSchema.fields)) // ["beliefs", "singleValuedPredicates"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionDetectionSnapshot = <
  Belief extends { readonly ref: { readonly edgeVersionId: unknown } },
  BeliefEncoded,
  BeliefMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly vocabulary: ContradictionDetectionVocabulary;
  readonly DetectionBelief: FieldSchema<Belief, BeliefEncoded, BeliefMake>;
}) => {
  const { $I, vocabulary, DetectionBelief } = config;

  const UniqueBeliefs = S.Array(DetectionBelief).check(
    S.makeFilter(
      (beliefs) =>
        HashSet.size(HashSet.fromIterable(A.map(beliefs, (belief) => belief.ref.edgeVersionId))) === A.length(beliefs),
      $I.annote("UniqueSnapshotBeliefs", {
        title: "Unique snapshot beliefs",
        description: "Each immutable edge version occurs once in one view snapshot.",
        message: "Expected distinct edgeVersionIds in the snapshot.",
      })
    )
  );

  const ContradictionDetectionSnapshotSchema = S.Struct({
    beliefs: UniqueBeliefs,
    singleValuedPredicates: S.Array(vocabulary.DetectionKey),
  }).pipe(
    $I.annoteSchema("ContradictionDetectionSnapshot", {
      description: "Complete detector input; undeclared predicates are treated as multi-valued.",
    })
  );

  return { ContradictionDetectionSnapshotSchema };
};

/**
 * Build the sealed detector output over the caller-bound candidate content
 * class.
 *
 * **Details**
 *
 * Returns `DetectedContradictionSchema`: the complete candidate content plus its
 * candidate key and digest, ready for caller-owned stamping, with the content's
 * forward half-open validity interval preserved.
 *
 * **Example** (Inspect the detected contradiction fields)
 *
 * ```ts
 * import { makeContradictionVocabulary } from "@beep/epistemics/Contradiction"
 * import { makeDetectedContradiction } from "@beep/epistemics/ContradictionDetection"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/ContradictionDetection")
 * const { DetectedContradictionSchema } = makeDetectedContradiction({
 *   $I,
 *   contradiction: makeContradictionVocabulary({ $I }),
 *   ContradictionCandidateContent: {
 *     fields: {
 *       assessment: S.String,
 *       matchBasis: S.String,
 *       pair: S.String,
 *       validFrom: S.DateTimeUtcFromMillis,
 *       validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr)
 *     }
 *   }
 * })
 * console.log(Object.keys(DetectedContradictionSchema.fields).length) // 7
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDetectedContradiction = <
  Assessment,
  AssessmentEncoded,
  AssessmentMake,
  MatchBasis,
  MatchBasisEncoded,
  MatchBasisMake,
  Pair,
  PairEncoded,
  PairMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly contradiction: Pick<ContradictionVocabulary, "ContradictionCandidateDigest" | "ContradictionCandidateKey">;
  readonly ContradictionCandidateContent: {
    readonly fields: {
      readonly assessment: FieldSchema<Assessment, AssessmentEncoded, AssessmentMake>;
      readonly matchBasis: FieldSchema<MatchBasis, MatchBasisEncoded, MatchBasisMake>;
      readonly pair: FieldSchema<Pair, PairEncoded, PairMake>;
      readonly validFrom: typeof S.DateTimeUtcFromMillis;
      readonly validTo: S.OptionFromNullOr<typeof S.DateTimeUtcFromMillis>;
    };
  };
}) => {
  const { $I, contradiction, ContradictionCandidateContent } = config;

  const DetectedContradictionStructSchema = S.Struct({
    ...ContradictionCandidateContent.fields,
    candidateKey: contradiction.ContradictionCandidateKey,
    candidateDigest: contradiction.ContradictionCandidateDigest,
  }).pipe(
    $I.annoteSchema("DetectedContradictionStruct", {
      description: "Pure emitted content and seals, ready for caller-owned stamping.",
    })
  );

  const DetectedContradictionSchema = DetectedContradictionStructSchema.mapFields((fields) => fields)
    .check(
      makeValidIntervalCheck(
        $I.annote("DetectedContradictionInterval", {
          title: "Detected contradiction interval",
          description: "Preserves the shipped content's non-empty half-open validity invariant.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("DetectedContradiction", {
        description: "Pure emitted content and seals with a valid half-open interval, ready for caller-owned stamping.",
      })
    );

  return { DetectedContradictionSchema };
};

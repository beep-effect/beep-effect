/**
 * Concept-local value objects for correction deltas.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

/**
 * The two-severity split below is a clean-room re-expression of a concept
 * observed in the MPL-2.0 portion of flint-ontology
 * (https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology).
 * MPL-2.0's scope is file-level, so the obligation applies regardless of how
 * unremarkable the concept is: no shape text, no constraint bodies, and no file
 * structure from that portion were consulted or copied while authoring this
 * module. The derivation is recorded in
 * goals/legal-position-relator-runtime/research/SOURCES.md.
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { ActFrameElementRef } from "../../values/ActFrameElementRef/index.ts";
import { NormSourceReference } from "../../values/NormSourceReference/index.ts";

const $I = $LawPracticeDomainId.create("entities/CorrectionDelta/CorrectionDelta.values");

const CandidateRoutingBase = LiteralKit(["contradiction-candidate-input", "resolved-no-candidate"]);
const CorrectionSeverityBase = LiteralKit(["hard", "advisory"]);
const CorrectionStageBase = LiteralKit(["interpretation", "qualification", "assessment"]);
const ReviewerActionBase = LiteralKit(["accepted", "rejected", "amended", "undetermined"]);

/**
 * How seriously a recorded validator finding was reported.
 *
 * **When to use**
 *
 * Use as the severity on every finding inside a recorded validator report. Two
 * members, always.
 *
 * **Details**
 *
 * `hard` records a finding reported as blocking; `advisory` records one
 * reported as worth a look. A boolean would carry the same information and lose
 * the name for it, leaving every reader to guess which way `true` ran.
 *
 * The vocabulary is fixed at two and does not grow to match whatever a
 * validator implementation happens to emit. A three-member severity model
 * exists elsewhere in this repository for shape validation; narrowing that
 * machinery down to these two when producing a finding is an implementation
 * detail, and widening this contract to meet it is not.
 *
 * **Gotchas**
 *
 * Severity is a recorded field, not an executable one. Nothing in this package
 * runs a validator, and no shape, constraint, or query ships from here — a
 * finding is what some validator said, transcribed.
 *
 * **Example** (Narrow a recorded severity)
 *
 * ```ts
 * import { CorrectionSeverity } from "@beep/law-practice-domain"
 *
 * console.log(CorrectionSeverity.is.advisory("advisory")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionSeverity = CorrectionSeverityBase.pipe(
  $I.annoteSchema("CorrectionSeverity", {
    description: "How seriously a recorded validator finding was reported: hard or advisory.",
  }),
  SchemaUtils.withLiteralKitStatics(CorrectionSeverityBase)
);

/**
 * Runtime type for {@link CorrectionSeverity}.
 *
 * @see {@link CorrectionSeverity} for the runtime schema and why it stays at two members.
 * @category models
 * @since 0.0.0
 */
export type CorrectionSeverity = typeof CorrectionSeverity.Type;

/**
 * Which stage of reading a correction is about.
 *
 * **Details**
 *
 * Interpretation is reading a source as a frame; qualification is treating some
 * brute fact as counting institutionally; assessment is determining what
 * follows. A correction at one stage says nothing about the others, and the tag
 * is what keeps a disagreement about what a clause says from being filed as a
 * disagreement about what happened.
 *
 * **Example** (Narrow a correction stage)
 *
 * ```ts
 * import { CorrectionStage } from "@beep/law-practice-domain"
 *
 * console.log(CorrectionStage.is.qualification("qualification")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionStage = CorrectionStageBase.pipe(
  $I.annoteSchema("CorrectionStage", {
    description: "Which of interpretation, qualification, or assessment a correction is about.",
  }),
  SchemaUtils.withLiteralKitStatics(CorrectionStageBase)
);

/**
 * Runtime type for {@link CorrectionStage}.
 *
 * @see {@link CorrectionStage} for the runtime schema and the three stages.
 * @category models
 * @since 0.0.0
 */
export type CorrectionStage = typeof CorrectionStage.Type;

/**
 * What a reviewer did about a proposed correction.
 *
 * **When to use**
 *
 * Use as the reviewer action on every correction delta. The field records an
 * action somebody took, so a delta nobody has reviewed carries `undetermined`
 * rather than nothing.
 *
 * **Details**
 *
 * `accepted` and `rejected` record a decision either way; `amended` records
 * that the reviewer changed the correction rather than taking it or leaving it;
 * `undetermined` records that no action has been taken. All four are things a
 * person did, and none is an outcome computed from the findings.
 *
 * **Gotchas**
 *
 * A hard finding does not imply rejection, and an empty finding list does not
 * imply acceptance. Nothing derives this field, and reading it as the
 * validator's verdict rather than the reviewer's act inverts what the record
 * says.
 *
 * **Example** (Narrow an unreviewed correction)
 *
 * ```ts
 * import { ReviewerAction } from "@beep/law-practice-domain"
 *
 * console.log(ReviewerAction.is.undetermined("undetermined")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewerAction = ReviewerActionBase.pipe(
  $I.annoteSchema("ReviewerAction", {
    description: "What a reviewer did about a proposed correction, including taking no action yet.",
  }),
  SchemaUtils.withLiteralKitStatics(ReviewerActionBase)
);

/**
 * Runtime type for {@link ReviewerAction}.
 *
 * @see {@link ReviewerAction} for the runtime schema and the never-derived rule.
 * @category models
 * @since 0.0.0
 */
export type ReviewerAction = typeof ReviewerAction.Type;

/**
 * Whether a correction's difference is still open enough to feed candidacy.
 *
 * **When to use**
 *
 * Use as the candidacy state on a correction delta, where it carries a
 * constructor default rather than being supplied at every call site.
 *
 * **Details**
 *
 * `contradiction-candidate-input` records that the difference this correction
 * concerns is unresolved and belongs among the inputs a candidate is built
 * from; `resolved-no-candidate` records that somebody closed it. The default is
 * the first, so a difference nobody has resolved routes to candidacy by
 * omission — silence keeps a disagreement visible rather than quietly dropping
 * it.
 *
 * **Gotchas**
 *
 * This is a law-side routing flag and nothing more. It marks a record as an
 * input; it does not create a candidate, submit anything anywhere, or assert
 * that a contradiction exists. Emission is the caller's, always.
 *
 * **Example** (Narrow the routing of an unresolved difference)
 *
 * ```ts
 * import { CandidateRouting } from "@beep/law-practice-domain"
 *
 * console.log(CandidateRouting.is["contradiction-candidate-input"]("contradiction-candidate-input")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateRouting = CandidateRoutingBase.pipe(
  $I.annoteSchema("CandidateRouting", {
    description: "Whether a correction's difference is unresolved and routes into contradiction-candidate inputs.",
  }),
  SchemaUtils.withLiteralKitStatics(CandidateRoutingBase)
);

/**
 * Runtime type for {@link CandidateRouting}.
 *
 * @see {@link CandidateRouting} for the runtime schema and the unresolved-by-default rule.
 * @category models
 * @since 0.0.0
 */
export type CandidateRouting = typeof CandidateRouting.Type;

/**
 * One thing a validator reported about a recorded interpretation.
 *
 * **Details**
 *
 * The element pointer is optional because a validator may report about the
 * interpretation as a whole rather than about one of its parts. When it does
 * name a part, the finding is addressable next to the correction that answers
 * it.
 *
 * **Example** (Record a hard finding about one slot)
 *
 * ```ts
 * import { ActFrameElementRef, ValidatorFinding } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const finding = ValidatorFinding.make({
 *   element: O.some(ActFrameElementRef.make({ label: "lessee", part: "slot" })),
 *   message: "slot has no source reference into the cited clause",
 *   severity: "hard",
 * })
 * console.log(finding.severity) // "hard"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ValidatorFinding extends S.Class<ValidatorFinding>($I`ValidatorFinding`)(
  {
    element: S.OptionFromNullOr(ActFrameElementRef).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Frame element the finding is about, absent when it concerns the interpretation as a whole.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "What the validator reported, transcribed.",
    }),
    severity: CorrectionSeverity.annotateKey({
      description: "How seriously the finding was reported: hard or advisory.",
    }),
  },
  $I.annote("ValidatorFinding", {
    description: "One transcribed validator finding about a recorded interpretation.",
  })
) {}

/**
 * What some validator reported, as transcribed onto a correction.
 *
 * **When to use**
 *
 * Use as the `validatorReport` of a correction delta.
 *
 * **Details**
 *
 * The report names its validator, because a finding without one is a claim
 * with no author, and the same interpretation is routinely run past more than
 * one. An empty finding list is a real report: it records that a validator ran
 * and said nothing.
 *
 * **Gotchas**
 *
 * This is a transcript, not an execution. No shape, constraint, or query is
 * carried here, nothing re-runs the validator, and a stored report is evidence
 * that one once reported — never that its findings still hold.
 *
 * **Example** (Transcribe a clean report)
 *
 * ```ts
 * import { ValidatorReport } from "@beep/law-practice-domain"
 *
 * const report = ValidatorReport.make({ findings: [], validator: "frame-slot-coverage" })
 * console.log(report.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ValidatorReport extends S.Class<ValidatorReport>($I`ValidatorReport`)(
  {
    findings: S.Array(ValidatorFinding).annotateKey({
      description: "Findings the validator reported; empty means it ran and reported nothing.",
    }),
    validator: S.NonEmptyString.annotateKey({
      description: "Designation of the validator whose report this transcribes.",
    }),
  },
  $I.annote("ValidatorReport", {
    description: "A transcribed validator report about one recorded interpretation.",
  })
) {}

/**
 * One element a correction touched, with the norm text behind the change.
 *
 * **Details**
 *
 * A pointer per corrected element rather than one per record is the whole
 * point. A correction that named only its document would say that something in
 * the interpretation changed; naming each element says which parts changed and
 * on what authority, which is what lets a later reader re-read one clause
 * instead of the whole reading.
 *
 * **Example** (Record which precondition a correction touched)
 *
 * ```ts
 * import { ActFrameElementRef, CorrectedElement, NormSourceReference, SourceNormRef } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const corrected = CorrectedElement.make({
 *   element: ActFrameElementRef.make({ label: "no-objection", part: "precondition" }),
 *   source: NormSourceReference.make({
 *     fragment: O.some("unless the lessor objects within ten days"),
 *     norm: SourceNormRef.make({ designation: "cl. 4.2" }),
 *   }),
 * })
 * console.log(corrected.element.part) // "precondition"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorrectedElement extends S.Class<CorrectedElement>($I`CorrectedElement`)(
  {
    element: ActFrameElementRef.annotateKey({
      description: "Pointer at the frame element this correction touched.",
    }),
    source: NormSourceReference.annotateKey({
      description: "Norm text the correction to this element rests on.",
    }),
  },
  $I.annote("CorrectedElement", {
    description: "One element a correction touched, with the norm text the change rests on.",
  })
) {}

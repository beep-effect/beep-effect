/**
 * Concept-local value objects for recorded information-disclosure-statement
 * facts, every one of them presence-only: each records what an observer saw in a
 * submission or in the Office's treatment of one. Nothing in this module
 * concludes that a submission was timely, complete, compliant, or effective —
 * those are legal judgments the system never computes.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/IdsSubmissionFact/IdsSubmissionFact.values");
const IdsSubmissionKindBase = LiteralKit(["initial", "supplemental", "correction"]);
const IdsCandidateWindowBase = LiteralKit(["b-early", "c-middle", "d-late", "after-issue-fee", "indeterminate"]);
const IdsStatementTypeBase = LiteralKit(["e1-foreign-citation", "e2-no-prior-knowledge"]);
const IdsOfficeTreatmentStateBase = LiteralKit(["considered", "not-considered", "partially-considered"]);

const optionalDate = (description: string) =>
  S.OptionFromNullOr(EntitySchema.DateTimeFromMillis).pipe(SchemaUtils.withNoneDefault).annotateKey({ description });

const optionalText = (description: string) =>
  S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({ description });

/**
 * What kind of submission act a record describes.
 *
 * **Details**
 *
 * Each submission is a distinct act with its own operative date. A
 * `correction` records the correction or resubmission of a submission the
 * Office placed in the file without considering it; 37 CFR 1.97(i) and MPEP
 * 609.05(a) make that later date the operative one for subsequent timing, which
 * is why it is recorded as its own act rather than as an edit to the original.
 *
 * **Example** (Narrow a submission kind)
 *
 * ```ts
 * import { IdsSubmissionKind } from "@beep/law-practice-domain"
 *
 * console.log(IdsSubmissionKind.is.supplemental("supplemental")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdsSubmissionKind = IdsSubmissionKindBase.pipe(
  $I.annoteSchema("IdsSubmissionKind", {
    description: "Kind of information-disclosure submission act being recorded.",
  }),
  SchemaUtils.withLiteralKitStatics(IdsSubmissionKindBase)
);

/**
 * Runtime type for {@link IdsSubmissionKind}.
 *
 * @see {@link IdsSubmissionKind} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type IdsSubmissionKind = typeof IdsSubmissionKind.Type;

/**
 * Which 37 CFR 1.97 window a submission is a *candidate* for.
 *
 * **When to use**
 *
 * Use to record an observer's reading of which timing lane the controlling
 * dates point at, alongside those dates so a human can check the reading.
 *
 * **Gotchas**
 *
 * This is a candidate label, never a compliance finding. `indeterminate` is a
 * first-class answer and is the correct value whenever the controlling dates
 * do not settle the question — including every edge case recorded beside it.
 * Nothing downstream may read a member of this domain as "the submission was
 * timely".
 *
 * **Example** (Narrow a candidate window)
 *
 * ```ts
 * import { IdsCandidateWindow } from "@beep/law-practice-domain"
 *
 * console.log(IdsCandidateWindow.is.indeterminate("indeterminate")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdsCandidateWindow = IdsCandidateWindowBase.pipe(
  $I.annoteSchema("IdsCandidateWindow", {
    description: "Candidate 37 CFR 1.97 timing window a submission falls in, never a compliance finding.",
  }),
  SchemaUtils.withLiteralKitStatics(IdsCandidateWindowBase)
);

/**
 * Runtime type for {@link IdsCandidateWindow}.
 *
 * @see {@link IdsCandidateWindow} for the runtime schema and the candidate-only rule.
 * @category models
 * @since 0.0.0
 */
export type IdsCandidateWindow = typeof IdsCandidateWindow.Type;

/**
 * Which 37 CFR 1.97(e) statement accompanied a submission.
 *
 * **Details**
 *
 * `e1-foreign-citation` is the 1.97(e)(1) statement about an item first cited
 * in a counterpart foreign application's office communication;
 * `e2-no-prior-knowledge` is the 1.97(e)(2) statement made after reasonable
 * inquiry. Recording which one was present never converts its representations
 * into machine findings about knowledge or inquiry adequacy.
 *
 * **Example** (Narrow a statement type)
 *
 * ```ts
 * import { IdsStatementType } from "@beep/law-practice-domain"
 *
 * console.log(IdsStatementType.is["e1-foreign-citation"]("e1-foreign-citation")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdsStatementType = IdsStatementTypeBase.pipe(
  $I.annoteSchema("IdsStatementType", {
    description: "Which 37 CFR 1.97(e) statement accompanied a submission, as observed.",
  }),
  SchemaUtils.withLiteralKitStatics(IdsStatementTypeBase)
);

/**
 * Runtime type for {@link IdsStatementType}.
 *
 * @see {@link IdsStatementType} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type IdsStatementType = typeof IdsStatementType.Type;

/**
 * How the Office marked a submission, as observed.
 *
 * **Gotchas**
 *
 * These members record markings, never conclusions. `not-considered` says the
 * Office marked it so; it is not evidence that an item was immaterial, and
 * `considered` is not evidence that an examiner relied on anything.
 *
 * **Example** (Narrow a treatment state)
 *
 * ```ts
 * import { IdsOfficeTreatmentState } from "@beep/law-practice-domain"
 *
 * console.log(IdsOfficeTreatmentState.is["not-considered"]("not-considered")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdsOfficeTreatmentState = IdsOfficeTreatmentStateBase.pipe(
  $I.annoteSchema("IdsOfficeTreatmentState", {
    description: "Treatment state the Office recorded for a submission, as observed.",
  }),
  SchemaUtils.withLiteralKitStatics(IdsOfficeTreatmentStateBase)
);

/**
 * Runtime type for {@link IdsOfficeTreatmentState}.
 *
 * @see {@link IdsOfficeTreatmentState} for the runtime schema and the no-inference rule.
 * @category models
 * @since 0.0.0
 */
export type IdsOfficeTreatmentState = typeof IdsOfficeTreatmentState.Type;

/**
 * The controlling dates and edge cases behind a candidate window.
 *
 * **Details**
 *
 * The dates are the prosecution events 37 CFR 1.97(b)-(d) select a lane from
 * (MPEP 609.04(b)(I)-(IV)). Each is optional because a submission is recorded
 * from whatever the observer actually saw, not from a completed docket.
 *
 * The four flags are the edge cases that change which date controls without
 * changing the dates themselves. They are recorded so a human can see why a
 * window is `indeterminate` instead of having to rediscover it.
 *
 * **Gotchas**
 *
 * No arithmetic here concludes anything. A recorded window plus recorded dates
 * is evidence for a human's timing decision, not the decision.
 *
 * **Example** (Record the dates behind an indeterminate window)
 *
 * ```ts
 * import { IdsCandidateWindowFacts } from "@beep/law-practice-domain"
 *
 * const facts = IdsCandidateWindowFacts.make({
 *   candidateWindow: "indeterminate",
 *   certificateOfMailingClaimed: false,
 *   closingActionWithdrawn: true,
 *   filedSameDayAsClosingAction: false,
 *   priorityMailExpressClaimed: false,
 *   weekendOrDcHolidayShiftApplies: false,
 * })
 * console.log(facts.candidateWindow) // "indeterminate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdsCandidateWindowFacts extends S.Class<IdsCandidateWindowFacts>($I`IdsCandidateWindowFacts`)(
  {
    applicationFilingDate: optionalDate("Actual national filing date of the application, as observed."),
    candidateWindow: IdsCandidateWindow.annotateKey({
      description: "Candidate 37 CFR 1.97 window the controlling dates point at.",
    }),
    certificateOfMailingClaimed: S.Boolean.annotateKey({
      description: "Whether a certificate of mailing was claimed for the submission, as observed.",
    }),
    closingActionMailingDate: optionalDate(
      "Mailing date of the first final action, notice of allowance, or other prosecution-closing action."
    ),
    closingActionWithdrawn: S.Boolean.annotateKey({
      description: "Whether the closing action was later withdrawn, as observed.",
    }),
    filedSameDayAsClosingAction: S.Boolean.annotateKey({
      description: "Whether the submission shares the closing action's date rather than preceding it.",
    }),
    firstActionOnMeritsMailingDate: optionalDate("Mailing date of the first Office action on the merits."),
    haguePublicationDate: optionalDate("Hague international-registration publication date, if any."),
    issueFeePaymentDate: optionalDate("Issue-fee payment date, if any."),
    nationalStageEntryDate: optionalDate("National-stage entry date, if any."),
    priorityMailExpressClaimed: S.Boolean.annotateKey({
      description: "Whether Priority Mail Express treatment was claimed for the submission, as observed.",
    }),
    weekendOrDcHolidayShiftApplies: S.Boolean.annotateKey({
      description: "Whether a controlling date falls on a weekend or DC holiday and shifts, as observed.",
    }),
  },
  $I.annote("IdsCandidateWindowFacts", {
    description:
      "Controlling prosecution dates and timing edge cases behind a candidate 37 CFR 1.97 window; never a compliance finding.",
  })
) {}

/**
 * Which fees accompanied a submission, as observed.
 *
 * **Details**
 *
 * The two fees are independent: the 37 CFR 1.17(p) timing fee belongs to the
 * 1.97(c) and 1.97(d) lanes, while the 1.17(v) size fee is separate and can
 * apply regardless of lane. Recording them separately keeps that independence
 * visible.
 *
 * **Example** (Record fee presence)
 *
 * ```ts
 * import { IdsFeeFacts } from "@beep/law-practice-domain"
 *
 * const fees = IdsFeeFacts.make({ sizeFeePresent: false, timingFeePresent: true })
 * console.log(fees.timingFeePresent) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdsFeeFacts extends S.Class<IdsFeeFacts>($I`IdsFeeFacts`)(
  {
    sizeFeePresent: S.Boolean.annotateKey({
      description: "Whether the 37 CFR 1.17(v) information-disclosure size fee accompanied the submission.",
    }),
    timingFeePresent: S.Boolean.annotateKey({
      description: "Whether the 37 CFR 1.17(p) timing fee accompanied the submission.",
    }),
  },
  $I.annote("IdsFeeFacts", {
    description: "Presence of the 37 CFR 1.17(p) timing fee and the 1.17(v) size fee, as observed.",
  })
) {}

/**
 * Which statements and written assertions accompanied a submission.
 *
 * **Details**
 *
 * `statementType` distinguishes the 37 CFR 1.97(e)(1) foreign-citation
 * statement from the 1.97(e)(2) no-prior-knowledge statement. The separate
 * `sizeFeeAssertionPresent` records the 1.98(a)(4) clear written assertion
 * about the 1.17(v) fee, which is a different act from paying it — the fee
 * itself is recorded in {@link IdsFeeFacts}.
 *
 * **Gotchas**
 *
 * A recorded 1.97(e)(2) statement is never turned into a machine finding about
 * what anyone knew or whether an inquiry was adequate. Presence and type are
 * the whole of what is recorded.
 *
 * **Example** (Record a statement's presence and type)
 *
 * ```ts
 * import { IdsStatementFacts } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const statement = IdsStatementFacts.make({
 *   sizeFeeAssertionPresent: true,
 *   statementPresent: true,
 *   statementType: O.some("e2-no-prior-knowledge"),
 * })
 * console.log(statement.statementPresent) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdsStatementFacts extends S.Class<IdsStatementFacts>($I`IdsStatementFacts`)(
  {
    sizeFeeAssertionPresent: S.Boolean.annotateKey({
      description: "Whether the 37 CFR 1.98(a)(4) written assertion about the size fee was present.",
    }),
    statementPresent: S.Boolean.annotateKey({
      description: "Whether a 37 CFR 1.97(e) statement accompanied the submission.",
    }),
    statementType: S.OptionFromNullOr(IdsStatementType).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Which 37 CFR 1.97(e) statement was present, when one was.",
    }),
  },
  $I.annote("IdsStatementFacts", {
    description: "Presence and type of the 37 CFR 1.97(e) statement and the 1.98(a)(4) written assertion.",
  })
) {}

/**
 * Which 37 CFR 1.98 content items were present, as observed.
 *
 * **Details**
 *
 * These mirror the content requirements of 1.98(a)(1)-(3): the list itself with
 * its separate U.S.-document section, legible copies for the document classes
 * that need them, and — for non-English information — the concise explanation
 * of relevance and any English translation.
 *
 * **Gotchas**
 *
 * Every field records presence of an item, never satisfaction of a
 * requirement. A submission with all fields true has not been found compliant;
 * it has been observed to contain those items.
 *
 * **Example** (Record observed content presence)
 *
 * ```ts
 * import { IdsContentPresenceFacts } from "@beep/law-practice-domain"
 *
 * const content = IdsContentPresenceFacts.make({
 *   conciseExplanationPresent: false,
 *   legibleCopiesPresent: true,
 *   listPresent: true,
 *   separateUsDocumentSectionPresent: true,
 *   translationPresent: false,
 * })
 * console.log(content.listPresent) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdsContentPresenceFacts extends S.Class<IdsContentPresenceFacts>($I`IdsContentPresenceFacts`)(
  {
    conciseExplanationPresent: S.Boolean.annotateKey({
      description: "Whether a 37 CFR 1.98(a)(3) concise explanation of relevance was present for non-English items.",
    }),
    legibleCopiesPresent: S.Boolean.annotateKey({
      description: "Whether 37 CFR 1.98(a)(2) legible copies were present for the classes that require them.",
    }),
    listPresent: S.Boolean.annotateKey({
      description: "Whether the 37 CFR 1.98(a)(1) list of information was present.",
    }),
    separateUsDocumentSectionPresent: S.Boolean.annotateKey({
      description: "Whether the list carried a separate section for U.S. patents and patent-application publications.",
    }),
    translationPresent: S.Boolean.annotateKey({
      description: "Whether a written English translation was present for non-English information.",
    }),
  },
  $I.annote("IdsContentPresenceFacts", {
    description: "Presence of 37 CFR 1.98 content items in a submission, as observed.",
  })
) {}

/**
 * How the Office treated a submission, exactly as observed.
 *
 * **Gotchas**
 *
 * Nothing here may be read as reliance, approval, or materiality. A
 * `considered` marking records that the Office marked it considered — it is not
 * evidence that an examiner relied on any item, and `not-considered` is not
 * evidence that an item was immaterial. Initials, stamps, dates, and stated
 * reasons are recorded verbatim precisely so that no one has to infer them.
 *
 * **Example** (Record an observed treatment)
 *
 * ```ts
 * import { IdsOfficeTreatmentFacts } from "@beep/law-practice-domain"
 *
 * const treatment = IdsOfficeTreatmentFacts.make({ state: "partially-considered" })
 * console.log(treatment.state) // "partially-considered"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdsOfficeTreatmentFacts extends S.Class<IdsOfficeTreatmentFacts>($I`IdsOfficeTreatmentFacts`)(
  {
    markingsRaw: optionalText("Examiner initials, stamps, and other markings preserved verbatim as observed."),
    state: IdsOfficeTreatmentState.annotateKey({
      description: "Treatment state the Office recorded, as observed and never inferred.",
    }),
    statedReason: optionalText("Reason the Office stated for the treatment, preserved verbatim."),
    treatmentDate: optionalDate("Date the Office recorded the treatment, as observed."),
  },
  $I.annote("IdsOfficeTreatmentFacts", {
    description: "Office treatment of a submission recorded exactly as observed, with no inference of reliance.",
  })
) {}

/**
 * Which published source version a fact state was modeled from.
 *
 * **When to use**
 *
 * Use with every recorded submission so a reader can tell which text the fact
 * vocabulary was built against. The CFR captures and the MPEP revision move
 * independently and the captures postdate the visible revision.
 *
 * **Gotchas**
 *
 * These are citations, not a resolver. Nothing reads them to select behaviour,
 * and no version-resolution machinery exists or should be built.
 *
 * **Example** (Cite the modeled source versions)
 *
 * ```ts
 * import { LegalSourceVersion } from "@beep/law-practice-domain"
 *
 * const modeledFrom = LegalSourceVersion.make({
 *   cfrCapture: "law.cornell.edu 37 CFR 1.56/1.97/1.98, captured 2026-08-04",
 *   mpepRevision: "R-01.2024",
 * })
 * console.log(modeledFrom.mpepRevision) // "R-01.2024"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalSourceVersion extends S.Class<LegalSourceVersion>($I`LegalSourceVersion`)(
  {
    cfrCapture: S.NonEmptyString.annotateKey({
      description: "Identifier of the CFR capture the fact state was modeled from.",
    }),
    mpepRevision: S.NonEmptyString.annotateKey({
      description: "MPEP revision the fact state was modeled from.",
    }),
  },
  $I.annote("LegalSourceVersion", {
    description: "Citation of the CFR capture and MPEP revision a recorded fact state was modeled from.",
  })
) {}

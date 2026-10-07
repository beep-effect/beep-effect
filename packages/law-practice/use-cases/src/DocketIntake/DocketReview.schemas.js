/**
 * Schema models of the docket intake review loop that do not depend on the
 * agents' own models: findings, deterministic checks, field agreement, the
 * extractor's per-field responses, the verdict and the loop settings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketReview.schemas");
const opt = (schema, description) =>
  schema.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));
/**
 * Severity of a critic finding. `P0` and `P1` are material.
 *
 * **Example** (Guard a severity)
 *
 * ```ts
 * import { ReviewFindingSeverity } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ReviewFindingSeverity.is.P0("P0")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewFindingSeverity = LiteralKit(["P0", "P1", "P2", "P3"]).pipe(
  $I.annoteSchema("ReviewFindingSeverity", {
    description: "Severity of a critic finding; P0 and P1 would put a wrong date or matter on the calendar.",
  })
);
/**
 * The fields of a docket entry a review can dispute.
 *
 * **Example** (Guard a field)
 *
 * ```ts
 * import { ReviewField } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ReviewField.is["mail-date"]("mail-date")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewField = LiteralKit([
  "classification",
  "title",
  "mail-date",
  "response-period",
  "stated-due-date",
  "due-date",
  "matter-references",
  "source-document",
]).pipe($I.annoteSchema("ReviewField", { description: "A field of a docket entry that a review can dispute." }));
/**
 * One problem the critic found with the extractor's entry.
 *
 * **Example** (Make a finding)
 *
 * ```ts
 * import { ReviewFinding } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const finding = ReviewFinding.make({ field: "title", reason: "The title names no date type.", severity: "P3" });
 * console.log(finding.severity);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewFinding extends S.Class($I`ReviewFinding`)(
  {
    field: ReviewField.annotateKey({ description: "The field the finding is about." }),
    reason: S.NonEmptyString.annotateKey({
      description: "One sentence on what is wrong, without the value the critic read.",
    }),
    severity: ReviewFindingSeverity.annotateKey({ description: "How serious the finding is." }),
  },
  $I.annote("ReviewFinding", { description: "One problem the critic found with the extractor's entry." })
) {}
/**
 * Names of the deterministic checks every review round runs.
 *
 * **Example** (Guard a check name)
 *
 * ```ts
 * import { DeterministicCheckName } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheckName.is["cited-span-exists"]("cited-span-exists")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeterministicCheckName = LiteralKit([
  "due-equals-mail-plus-period",
  "due-not-before-mail",
  "values-appear-in-cited-text",
  "cited-span-exists",
]).pipe(
  $I.annoteSchema("DeterministicCheckName", { description: "Name of a deterministic check on an extractor entry." })
);
/**
 * Whose reading a deterministic check was run on.
 *
 * **Example** (Guard a side)
 *
 * ```ts
 * import { ReviewSide } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ReviewSide.is.critic("critic")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewSide = LiteralKit(["extractor", "critic"]).pipe(
  $I.annoteSchema("ReviewSide", { description: "Whose reading a deterministic check was run on." })
);
const deterministicCheckSideDefault = "extractor";
/**
 * Result of one deterministic check.
 *
 * **Details**
 *
 * `side` says whose reading was checked. The citation checks run on the
 * extractor's entry and, when the critic cites text, on the critic's reading
 * too; the others run on the extractor's entry only. `field` is set on the
 * rows that check the text the extractor quoted for one disputed field, so a
 * failure is disputed on that field.
 *
 * **Example** (Make a check result)
 *
 * ```ts
 * import { DeterministicCheck } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheck.make({ check: "cited-span-exists", passed: true }).passed);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeterministicCheck extends S.Class($I`DeterministicCheck`)(
  {
    check: DeterministicCheckName.annotateKey({ description: "Which check ran." }),
    field: opt(ReviewField, "The disputed field whose quoted text was checked, on per-field rows."),
    passed: S.Boolean.annotateKey({ description: "Whether the reading passed it." }),
    side: ReviewSide.pipe(
      S.withConstructorDefault(Effect.succeed(deterministicCheckSideDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(deterministicCheckSideDefault))
    ).annotateKey({ description: "Whose reading was checked; the extractor's unless stated." }),
  },
  $I.annote("DeterministicCheck", { description: "Result of one deterministic check on a reading." })
) {}
/**
 * Whether the two independent readings agree on one field.
 *
 * **Example** (Make a field agreement)
 *
 * ```ts
 * import { FieldAgreement } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(FieldAgreement.make({ agreed: false, field: "mail-date" }).agreed);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FieldAgreement extends S.Class($I`FieldAgreement`)(
  {
    agreed: S.Boolean.annotateKey({ description: "Whether the extractor and the critic read the same value." }),
    field: ReviewField.annotateKey({ description: "The compared field." }),
  },
  $I.annote("FieldAgreement", { description: "Whether the two independent readings agree on one field." })
) {}
/**
 * What the extractor did with a disputed field.
 *
 * **Example** (Guard an action)
 *
 * ```ts
 * import { ExtractorFieldAction } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ExtractorFieldAction.is.defended("defended")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExtractorFieldAction = LiteralKit(["revised", "defended"]).pipe(
  $I.annoteSchema("ExtractorFieldAction", { description: "Whether the extractor changed a disputed field or kept it." })
);
/**
 * The extractor's answer for one disputed field: whether it revised or
 * defended it, and the source text it relies on.
 *
 * **Example** (Make a field response)
 *
 * ```ts
 * import { ExtractorFieldResponse } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ExtractorFieldResponse.make({ action: "defended", field: "mail-date" }).action);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExtractorFieldResponse extends S.Class($I`ExtractorFieldResponse`)(
  {
    action: ExtractorFieldAction.annotateKey({ description: "Whether the field was revised or defended." }),
    citedText: opt(S.String, "Exact source text the extractor relies on for this field (never logged)."),
    field: ReviewField.annotateKey({ description: "The disputed field." }),
  },
  $I.annote("ExtractorFieldResponse", { description: "The extractor's answer for one disputed field." })
) {}
/**
 * One field the extractor must revise or defend, with the reasons it is
 * disputed.
 *
 * **Details**
 *
 * A dispute carries reasons only. It never carries the value the critic read,
 * so the extractor cannot copy it.
 *
 * **Example** (Make a dispute)
 *
 * ```ts
 * import { ReviewDispute } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const dispute = ReviewDispute.make({ field: "mail-date", reasons: ["The two readings differ."] });
 * console.log(dispute.reasons.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewDispute extends S.Class($I`ReviewDispute`)(
  {
    field: ReviewField.annotateKey({ description: "The disputed field." }),
    reasons: S.Array(S.String).annotateKey({ description: "Why the field is disputed; never the critic's value." }),
  },
  $I.annote("ReviewDispute", { description: "One field the extractor must revise or defend." })
) {}
/**
 * The text a citation is checked against.
 *
 * **Details**
 *
 * `documentText` is the text of the attached documents when the adapter can
 * supply it. Without it a citation can only be checked against the message,
 * and one that is not in the message fails only when no document was attached.
 *
 * **Example** (Make a source text)
 *
 * ```ts
 * import { ReviewSourceText } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ReviewSourceText.make({ messageText: "Fixture body." }).hasDocuments); // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewSourceText extends S.Class($I`ReviewSourceText`)(
  {
    documentText: opt(S.String, "Text of the attached documents, when the adapter supplies it (never logged)."),
    hasDocuments: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ).annotateKey({ description: "Whether a source document was attached to the message." }),
    messageText: S.String.annotateKey({ description: "Subject and body of the message (never logged)." }),
  },
  $I.annote("ReviewSourceText", { description: "The text a citation is checked against." })
) {}
/**
 * What one review round measured: the check results, the critic's findings
 * and the field agreement.
 *
 * **Example** (Make empty evidence)
 *
 * ```ts
 * import { ReviewEvidence } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ReviewEvidence.make({ agreement: [], checks: [], findings: [] }).findings.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewEvidence extends S.Class($I`ReviewEvidence`)(
  {
    agreement: S.Array(FieldAgreement).annotateKey({ description: "Agreement per compared field." }),
    checks: S.Array(DeterministicCheck).annotateKey({ description: "Results of the deterministic checks." }),
    findings: S.Array(ReviewFinding).annotateKey({ description: "The critic's findings." }),
  },
  $I.annote("ReviewEvidence", { description: "What one review round measured." })
) {}
/**
 * How a review ended.
 *
 * **Details**
 *
 * - `accepted`: the checks passed and the score reached the threshold.
 * - `flagged-low-confidence`: the round limit was reached with the score
 *   under the threshold.
 * - `flagged-max-rounds`: the round limit was reached with a material finding
 *   or a disagreement that never changed.
 * - `deterministic-failure`: a deterministic check still failed on the last
 *   round.
 *
 * **Example** (Guard a status)
 *
 * ```ts
 * import { ReviewTerminalStatus } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ReviewTerminalStatus.is.accepted("accepted")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewTerminalStatus = LiteralKit([
  "accepted",
  "flagged-low-confidence",
  "flagged-max-rounds",
  "deterministic-failure",
]).pipe($I.annoteSchema("ReviewTerminalStatus", { description: "How a docket review ended." }));
/**
 * Number of rounds a review may run: a whole number from 1 to 10.
 *
 * **Example** (Guard a round limit)
 *
 * ```ts
 * import { ReviewMaxRounds } from "@beep/law-practice-use-cases/DocketIntake";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ReviewMaxRounds)(11)); // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReviewMaxRounds = S.Int.check(S.isBetween({ maximum: 10, minimum: 1 })).pipe(
  $I.annoteSchema("ReviewMaxRounds", { description: "Number of rounds a docket review may run, from 1 to 10." })
);
/**
 * A critic finding without its reason: the field and the severity only.
 *
 * **Example** (Make a finding trace)
 *
 * ```ts
 * import { ReviewFindingTrace } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(ReviewFindingTrace.make({ field: "due-date", severity: "P1" }).severity);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewFindingTrace extends S.Class($I`ReviewFindingTrace`)(
  {
    field: ReviewField.annotateKey({ description: "The field the finding is about." }),
    severity: ReviewFindingSeverity.annotateKey({ description: "How serious the finding is." }),
  },
  $I.annote("ReviewFindingTrace", { description: "A critic finding without its reason text." })
) {}
const emptyFields = [];
const fieldList = (description) =>
  S.Array(ReviewField)
    .pipe(
      S.withConstructorDefault(Effect.succeed(emptyFields)),
      S.withDecodingDefaultTypeKey(Effect.succeed(emptyFields))
    )
    .annotateKey({ description });
/**
 * What each side decided in one review round, in ids and enums only.
 *
 * **Details**
 *
 * The trace is kept on a settled outcome so a review that ended differently on
 * two runs of the same message (a dry run and a live run, say) can be
 * explained afterwards. It holds no message text: no dates, quotes, titles or
 * finding reasons, only which fields each side disputed, revised, defended or
 * agreed on, the findings' severities, the failed checks, the gate result and
 * the score.
 *
 * **Example** (Make a round trace)
 *
 * ```ts
 * import { ReviewRoundTrace } from "@beep/law-practice-use-cases/DocketIntake";
 * import { UnitInterval } from "@beep/schema/UnitInterval";
 *
 * const trace = ReviewRoundTrace.make({
 *   criticDocketItem: true,
 *   extractorDocketItem: true,
 *   failedChecks: [],
 *   findings: [],
 *   gatePassed: true,
 *   index: 1,
 *   score: UnitInterval.make(1)
 * });
 * console.log(trace.disagreedFields.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewRoundTrace extends S.Class($I`ReviewRoundTrace`)(
  {
    agreedFields: fieldList("Compared fields the two readings agree on."),
    criticDocketItem: S.Boolean.annotateKey({ description: "Whether the critic read a docket item." }),
    defendedFields: fieldList("Disputed fields the extractor kept this round."),
    disagreedFields: fieldList("Compared fields the two readings differ on."),
    extractorDocketItem: S.Boolean.annotateKey({ description: "Whether the extractor entered a docket item." }),
    failedChecks: S.Array(DeterministicCheck).annotateKey({ description: "The deterministic checks that failed." }),
    findings: S.Array(ReviewFindingTrace).annotateKey({ description: "The critic's findings, without reasons." }),
    gatePassed: S.Boolean.annotateKey({ description: "Whether every deterministic check passed." }),
    index: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "1-based number of the round." }),
    revisedFields: fieldList("Disputed fields the extractor changed this round."),
    score: UnitInterval.annotateKey({ description: "Confidence score of the round." }),
  },
  $I.annote("ReviewRoundTrace", { description: "What each side decided in one review round, without text." })
) {}
const emptyTrace = [];
/**
 * The result of a finished review, as the attorney is told it.
 *
 * **Example** (Make a verdict)
 *
 * ```ts
 * import { ReviewVerdict } from "@beep/law-practice-use-cases/DocketIntake";
 * import { UnitInterval } from "@beep/schema/UnitInterval";
 *
 * const verdict = ReviewVerdict.make({
 *   finalScore: UnitInterval.make(0.9),
 *   maxRounds: 3,
 *   rounds: 1,
 *   status: "accepted",
 *   threshold: UnitInterval.make(0.85)
 * });
 * console.log(verdict.status);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewVerdict extends S.Class($I`ReviewVerdict`)(
  {
    finalScore: UnitInterval.annotateKey({ description: "Score of the last round." }),
    maxRounds: ReviewMaxRounds.annotateKey({ description: "Round limit the review ran under." }),
    rounds: S.Natural.annotateKey({ description: "How many rounds were used." }),
    status: ReviewTerminalStatus.annotateKey({ description: "How the review ended." }),
    threshold: UnitInterval.annotateKey({ description: "Score the review had to reach to be accepted." }),
    trace: S.Array(ReviewRoundTrace)
      .pipe(
        S.withConstructorDefault(Effect.succeed(emptyTrace)),
        S.withDecodingDefaultTypeKey(Effect.succeed(emptyTrace))
      )
      .annotateKey({ description: "Every round, oldest first, in ids and enums only; empty in older records." }),
  },
  $I.annote("ReviewVerdict", { description: "The result of a finished docket review." })
) {}
const docketReviewConfigMaxRoundsDefault = 3;
const docketReviewConfigAcceptThresholdDefault = UnitInterval.make(0.85);
/**
 * Settings of the review loop.
 *
 * **Example** (Read the defaults)
 *
 * ```ts
 * import { DocketReviewConfig } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const config = DocketReviewConfig.make({});
 * console.log(config.maxRounds, config.acceptThreshold); // 3 0.85
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketReviewConfig extends S.Class($I`DocketReviewConfig`)(
  {
    acceptThreshold: UnitInterval.pipe(
      S.withConstructorDefault(Effect.succeed(docketReviewConfigAcceptThresholdDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketReviewConfigAcceptThresholdDefault))
    ).annotateKey({ description: "Score a round must reach for the item to be accepted; 0.85 by default." }),
    maxRounds: ReviewMaxRounds.pipe(
      S.withConstructorDefault(Effect.succeed(docketReviewConfigMaxRoundsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketReviewConfigMaxRoundsDefault))
    ).annotateKey({ description: "Rounds after which an item that was not accepted is flagged; 3 by default." }),
  },
  $I.annote("DocketReviewConfig", { description: "Settings of the docket review loop." })
) {}

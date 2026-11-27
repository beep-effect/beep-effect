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
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketReview.schemas");

const opt = <Sch extends S.Top>(schema: Sch, description: string) =>
  schema.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));

/**
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
 * **Example** (Type a severity)
 *
 * ```ts
 * import type { ReviewFindingSeverity } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const severity: ReviewFindingSeverity = "P2";
 * console.log(severity);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReviewFindingSeverity = typeof ReviewFindingSeverity.Type;

/**
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
 * **Example** (Type a field)
 *
 * ```ts
 * import type { ReviewField } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const field: ReviewField = "due-date";
 * console.log(field);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReviewField = typeof ReviewField.Type;

/**
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
export class ReviewFinding extends S.Opaque<ReviewFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    field: ReviewField.annotateKey({ description: "The field the finding is about." }),
    reason: S.NonEmptyString.annotateKey({
      description: "One sentence on what is wrong, without the value the critic read.",
    }),
    severity: ReviewFindingSeverity.annotateKey({ description: "How serious the finding is." }),
  }).pipe($I.annoteSchema("ReviewFinding", { description: "One problem the critic found with the extractor's entry." }))
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
 * **Example** (Type a check name)
 *
 * ```ts
 * import type { DeterministicCheckName } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const check: DeterministicCheckName = "due-not-before-mail";
 * console.log(check);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DeterministicCheckName = typeof DeterministicCheckName.Type;

/**
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

/**
 * **Example** (Type a side)
 *
 * ```ts
 * import type { ReviewSide } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const side: ReviewSide = "extractor";
 * console.log(side);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReviewSide = typeof ReviewSide.Type;

/**
 * **Example** (Read the unknown reasons)
 *
 * ```ts
 * import { DeterministicCheckUnknownReason } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheckUnknownReason.literals); // ["document-text-unavailable"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeterministicCheckUnknownReason = LiteralKit(["document-text-unavailable"]).pipe(
  $I.annoteSchema("DeterministicCheckUnknownReason", {
    description:
      "Why a deterministic check could not be decided: the cited passage is not in the message and an attached document's text is unavailable.",
  })
);

/**
 * **Example** (Type an unknown reason)
 *
 * ```ts
 * import type { DeterministicCheckUnknownReason } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const reason: DeterministicCheckUnknownReason = "document-text-unavailable";
 * console.log(reason);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DeterministicCheckUnknownReason = typeof DeterministicCheckUnknownReason.Type;

/**
 * The `Passed` case of {@link DeterministicCheckResult}.
 *
 * **Example** (Make a passed result)
 *
 * ```ts
 * import { DeterministicCheckPassed } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheckPassed.make({})._tag); // "Passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeterministicCheckPassed extends S.Opaque<DeterministicCheckPassed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Passed", {}).pipe(
    $I.annoteSchema("DeterministicCheckPassed", { description: "The reading passed the check." })
  )
) {}

/**
 * The `Failed` case of {@link DeterministicCheckResult}.
 *
 * **Example** (Make a failed result)
 *
 * ```ts
 * import { DeterministicCheckFailed } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheckFailed.make({})._tag); // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeterministicCheckFailed extends S.Opaque<DeterministicCheckFailed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Failed", {}).pipe(
    $I.annoteSchema("DeterministicCheckFailed", {
      description: "The reading failed the check against text that was all available.",
    })
  )
) {}

/**
 * The `Unknown` case of {@link DeterministicCheckResult}.
 *
 * **Example** (Make an unknown result)
 *
 * ```ts
 * import { DeterministicCheckUnknown } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheckUnknown.make({ reason: "document-text-unavailable" }).reason);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeterministicCheckUnknown extends S.Opaque<DeterministicCheckUnknown, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Unknown", {
    reason: DeterministicCheckUnknownReason.annotateKey({ description: "Why the check could not be decided." }),
  }).pipe(
    $I.annoteSchema("DeterministicCheckUnknown", {
      description: "The check could not be decided from the text that was available.",
    })
  )
) {}

/**
 * Three-valued result of one deterministic check: `Passed`, `Failed`, or
 * `Unknown` with the reason it could not be decided.
 *
 * **Details**
 *
 * Only `Passed` lets a gate pass. `Unknown` is never a failure of the
 * reading: an explanation of it never says that the cited text is wrong.
 *
 * **Example** (Match a result)
 *
 * ```ts
 * import { DeterministicCheckResult, DeterministicCheckUnknown } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const result = DeterministicCheckUnknown.make({ reason: "document-text-unavailable" });
 * console.log(DeterministicCheckResult.guards.Unknown(result)); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeterministicCheckResult = S.Union([
  DeterministicCheckPassed,
  DeterministicCheckFailed,
  DeterministicCheckUnknown,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DeterministicCheckResult", { description: "Three-valued result of one deterministic check." })
);

/**
 * **Example** (Type a result)
 *
 * ```ts
 * import type { DeterministicCheckResult } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const passed = (result: DeterministicCheckResult) => result._tag === "Passed";
 * console.log(passed);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DeterministicCheckResult = typeof DeterministicCheckResult.Type;

/**
 * Where a deterministic check result came from: a check this code ran, or a
 * Boolean result read back from a `docket-check/v1` record.
 *
 * **Example** (Guard a provenance)
 *
 * ```ts
 * import { DeterministicCheckProvenance } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheckProvenance.is.current("current")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeterministicCheckProvenance = LiteralKit(["current", "docket-check/v1"]).pipe(
  $I.annoteSchema("DeterministicCheckProvenance", {
    description: "Whether a check result was run now or read back from a historical docket-check/v1 Boolean.",
  })
);

/**
 * **Example** (Type a provenance)
 *
 * ```ts
 * import type { DeterministicCheckProvenance } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const provenance: DeterministicCheckProvenance = "docket-check/v1";
 * console.log(provenance);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DeterministicCheckProvenance = typeof DeterministicCheckProvenance.Type;

const deterministicCheckSideDefault: ReviewSide = "extractor";
const deterministicCheckProvenanceDefault: DeterministicCheckProvenance = "current";

/**
 * **Details**
 *
 * `side` says whose reading was checked. The citation checks run on the
 * extractor's entry and, when the critic cites text, on the critic's reading
 * too; the others run on the extractor's entry only. `field` is set on the
 * rows that check the text the extractor quoted for one disputed field, so a
 * failure is disputed on that field. `provenance` is `docket-check/v1` on a
 * historical Boolean read back from storage; such a row never passes a gate.
 *
 * **Example** (Make a check result)
 *
 * ```ts
 * import { DeterministicCheck, DeterministicCheckPassed } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DeterministicCheck.make({ check: "cited-span-exists", result: DeterministicCheckPassed.make({}) }).result._tag);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeterministicCheck extends S.Opaque<DeterministicCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    check: DeterministicCheckName.annotateKey({ description: "Which check ran." }),
    field: opt(ReviewField, "The disputed field whose quoted text was checked, on per-field rows."),
    provenance: DeterministicCheckProvenance.pipe(
      S.withConstructorDefault(Effect.succeed(deterministicCheckProvenanceDefault)),
      S.annotateKey({ description: "Whether the result was run now or read back from a docket-check/v1 Boolean." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(deterministicCheckProvenanceDefault))
    ),
    result: DeterministicCheckResult.annotateKey({ description: "Passed, failed, or unknown with its reason." }),
    side: ReviewSide.pipe(
      S.withConstructorDefault(Effect.succeed(deterministicCheckSideDefault)),
      S.annotateKey({ description: "Whose reading was checked; the extractor's unless stated." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(deterministicCheckSideDefault))
    ),
  }).pipe($I.annoteSchema("DeterministicCheck", { description: "Result of one deterministic check on a reading." }))
) {}

const DeterministicCheckV1 = S.Struct({
  check: DeterministicCheckName,
  field: S.optionalKey(ReviewField),
  passed: S.Boolean,
  side: S.optionalKey(ReviewSide),
}).pipe(
  $I.annoteSchema("DeterministicCheckV1", {
    description: "A deterministic check as docket-check/v1 stored it, with a Boolean passed.",
  })
);

const DeterministicCheckFromV1 = DeterministicCheckV1.pipe(
  S.decodeTo(S.toType(DeterministicCheck), {
    decode: SchemaGetter.transform((v1: typeof DeterministicCheckV1.Type) =>
      DeterministicCheck.make({
        check: v1.check,
        field: O.fromUndefinedOr(v1.field),
        provenance: "docket-check/v1",
        result: v1.passed ? DeterministicCheckPassed.make({}) : DeterministicCheckFailed.make({}),
        side: v1.side ?? deterministicCheckSideDefault,
      })
    ),
    encode: SchemaGetter.forbidden(() => "docket-check/v1 is read only"),
  }),
  $I.annoteSchema("DeterministicCheckFromV1", {
    description:
      "Read-only projection of a docket-check/v1 Boolean row to a historical check that never passes a gate.",
  })
);

/**
 * Reads a stored deterministic check: a current row as stored, or a
 * `docket-check/v1` Boolean row as a historical check. Encoding always
 * writes the current form.
 *
 * **Details**
 *
 * A v1 row keeps its Boolean as `Passed` or `Failed` with provenance
 * `docket-check/v1`. That is history, not a fresh verification: the gate
 * never passes on it, and a resumed review runs its checks again.
 *
 * **Example** (Read a v1 row as history)
 *
 * ```ts
 * import { StoredDeterministicCheck } from "@beep/law-practice-use-cases/DocketIntake";
 * import * as S from "effect/Schema";
 *
 * const check = S.decodeUnknownSync(StoredDeterministicCheck)({ check: "cited-span-exists", passed: true });
 * console.log(check.provenance, check.result._tag); // "docket-check/v1" "Passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StoredDeterministicCheck = S.Union([DeterministicCheck, DeterministicCheckFromV1]).pipe(
  $I.annoteSchema("StoredDeterministicCheck", {
    description: "A stored deterministic check: current, or a docket-check/v1 Boolean read as history.",
  })
);

/**
 * **Example** (Type a stored check)
 *
 * ```ts
 * import type { StoredDeterministicCheck } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const read = (check: StoredDeterministicCheck) => check.result._tag;
 * console.log(typeof read);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StoredDeterministicCheck = typeof StoredDeterministicCheck.Type;

/**
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
export class FieldAgreement extends S.Opaque<FieldAgreement, { readonly brand: unique symbol }>()(
  S.Struct({
    agreed: S.Boolean.annotateKey({ description: "Whether the extractor and the critic read the same value." }),
    field: ReviewField.annotateKey({ description: "The compared field." }),
  }).pipe(
    $I.annoteSchema("FieldAgreement", { description: "Whether the two independent readings agree on one field." })
  )
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
 * **Example** (Type an action)
 *
 * ```ts
 * import type { ExtractorFieldAction } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const action: ExtractorFieldAction = "revised";
 * console.log(action);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExtractorFieldAction = typeof ExtractorFieldAction.Type;

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
export class ExtractorFieldResponse extends S.Opaque<ExtractorFieldResponse, { readonly brand: unique symbol }>()(
  S.Struct({
    action: ExtractorFieldAction.annotateKey({ description: "Whether the field was revised or defended." }),
    citedText: opt(S.String, "Exact source text the extractor relies on for this field (never logged)."),
    field: ReviewField.annotateKey({ description: "The disputed field." }),
  }).pipe($I.annoteSchema("ExtractorFieldResponse", { description: "The extractor's answer for one disputed field." }))
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
export class ReviewDispute extends S.Opaque<ReviewDispute, { readonly brand: unique symbol }>()(
  S.Struct({
    field: ReviewField.annotateKey({ description: "The disputed field." }),
    reasons: S.Array(S.String).annotateKey({ description: "Why the field is disputed; never the critic's value." }),
  }).pipe($I.annoteSchema("ReviewDispute", { description: "One field the extractor must revise or defend." }))
) {}

/**
 * **Details**
 *
 * `documentText` is the text of the attached documents when the adapter can
 * supply it. Without it a citation can only be checked against the message:
 * one found there passes, and one that is not is unknown when a document was
 * attached and failed only when none was.
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
export class ReviewSourceText extends S.Opaque<ReviewSourceText, { readonly brand: unique symbol }>()(
  S.Struct({
    documentText: opt(S.String, "Text of the attached documents, when the adapter supplies it (never logged)."),
    hasDocuments: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({ description: "Whether a source document was attached to the message." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    messageText: S.String.annotateKey({ description: "Subject and body of the message (never logged)." }),
  }).pipe($I.annoteSchema("ReviewSourceText", { description: "The text a citation is checked against." }))
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
export class ReviewEvidence extends S.Opaque<ReviewEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    agreement: S.Array(FieldAgreement).annotateKey({ description: "Agreement per compared field." }),
    checks: S.Array(DeterministicCheck).annotateKey({ description: "Results of the deterministic checks." }),
    findings: S.Array(ReviewFinding).annotateKey({ description: "The critic's findings." }),
  }).pipe($I.annoteSchema("ReviewEvidence", { description: "What one review round measured." }))
) {}

/**
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
 * **Example** (Type a status)
 *
 * ```ts
 * import type { ReviewTerminalStatus } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const status: ReviewTerminalStatus = "flagged-max-rounds";
 * console.log(status);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReviewTerminalStatus = typeof ReviewTerminalStatus.Type;

/**
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
 * **Example** (Type a round limit)
 *
 * ```ts
 * import type { ReviewMaxRounds } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const rounds: ReviewMaxRounds = 3;
 * console.log(rounds);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReviewMaxRounds = typeof ReviewMaxRounds.Type;

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
export class ReviewFindingTrace extends S.Opaque<ReviewFindingTrace, { readonly brand: unique symbol }>()(
  S.Struct({
    field: ReviewField.annotateKey({ description: "The field the finding is about." }),
    severity: ReviewFindingSeverity.annotateKey({ description: "How serious the finding is." }),
  }).pipe($I.annoteSchema("ReviewFindingTrace", { description: "A critic finding without its reason text." }))
) {}

const emptyFields: ReadonlyArray<ReviewField> = [];

const fieldList = (description: string) =>
  S.Array(ReviewField).pipe(
    S.withConstructorDefault(Effect.succeed(emptyFields)),
    S.annotateKey({ description }),
    S.withDecodingDefaultTypeKey(Effect.succeed(emptyFields))
  );

/**
 * What each side decided in one review round, in ids and enums only.
 *
 * **Details**
 *
 * The trace is kept on a settled outcome so a review that ended differently on
 * two runs of the same message (a dry run and a live run, say) can be
 * explained afterwards. It holds no message text: no dates, quotes, titles or
 * finding reasons, only which fields each side disputed, revised, defended or
 * agreed on, the findings' severities, the checks that did not pass, the gate
 * result and the score.
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
export class ReviewRoundTrace extends S.Opaque<ReviewRoundTrace, { readonly brand: unique symbol }>()(
  S.Struct({
    agreedFields: fieldList("Compared fields the two readings agree on."),
    criticDocketItem: S.Boolean.annotateKey({ description: "Whether the critic read a docket item." }),
    defendedFields: fieldList("Disputed fields the extractor kept this round."),
    disagreedFields: fieldList("Compared fields the two readings differ on."),
    extractorDocketItem: S.Boolean.annotateKey({ description: "Whether the extractor entered a docket item." }),
    failedChecks: S.Array(StoredDeterministicCheck).annotateKey({
      description: "The deterministic checks that did not pass: failed, or unknown with a reason.",
    }),
    findings: S.Array(ReviewFindingTrace).annotateKey({ description: "The critic's findings, without reasons." }),
    gatePassed: S.Boolean.annotateKey({
      description: "Whether every deterministic check passed, none failed or unknown.",
    }),
    index: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "1-based number of the round." }),
    revisedFields: fieldList("Disputed fields the extractor changed this round."),
    score: UnitInterval.annotateKey({ description: "Confidence score of the round." }),
  }).pipe(
    $I.annoteSchema("ReviewRoundTrace", { description: "What each side decided in one review round, without text." })
  )
) {}

const emptyTrace: ReadonlyArray<ReviewRoundTrace> = [];

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
export class ReviewVerdict extends S.Opaque<ReviewVerdict, { readonly brand: unique symbol }>()(
  S.Struct({
    finalScore: UnitInterval.annotateKey({ description: "Score of the last round." }),
    maxRounds: ReviewMaxRounds.annotateKey({ description: "Round limit the review ran under." }),
    rounds: S.Natural.annotateKey({ description: "How many rounds were used." }),
    status: ReviewTerminalStatus.annotateKey({ description: "How the review ended." }),
    threshold: UnitInterval.annotateKey({ description: "Score the review had to reach to be accepted." }),
    trace: S.Array(ReviewRoundTrace).pipe(
      S.withConstructorDefault(Effect.succeed(emptyTrace)),
      S.annotateKey({ description: "Every round, oldest first, in ids and enums only; empty in older records." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(emptyTrace))
    ),
  }).pipe($I.annoteSchema("ReviewVerdict", { description: "The result of a finished docket review." }))
) {}

const docketReviewConfigMaxRoundsDefault = 3;
const docketReviewConfigAcceptThresholdDefault = UnitInterval.make(0.85);

/**
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
export class DocketReviewConfig extends S.Opaque<DocketReviewConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    acceptThreshold: UnitInterval.pipe(
      S.withConstructorDefault(Effect.succeed(docketReviewConfigAcceptThresholdDefault)),
      S.annotateKey({ description: "Score a round must reach for the item to be accepted; 0.85 by default." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketReviewConfigAcceptThresholdDefault))
    ),
    maxRounds: ReviewMaxRounds.pipe(
      S.withConstructorDefault(Effect.succeed(docketReviewConfigMaxRoundsDefault)),
      S.annotateKey({ description: "Rounds after which an item that was not accepted is flagged; 3 by default." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketReviewConfigMaxRoundsDefault))
    ),
  }).pipe($I.annoteSchema("DocketReviewConfig", { description: "Settings of the docket review loop." }))
) {}

/**
 * Pure policy of the docket intake review loop: the deterministic checks, the
 * field comparison, the confidence score and the decision when a review ends.
 *
 * **Details**
 *
 * Nothing here calls a model. The score is built from things code can
 * measure: whether the critic left a material finding, and on how many
 * independently read fields the two readings agree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  addDocketResponsePeriod,
  DocketResponsePeriod,
  DocketResponsePeriodUnit,
} from "@beep/law-practice-domain/values/DocketDeadline";
import { daysInMonth, isBefore, equals as sameDate } from "@beep/schema/LocalDate";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Effect, HashSet, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ParalegalEntry, ReviewRound, SecretaryReview } from "./DocketIntake.schemas.ts";
import {
  DeterministicCheck,
  DeterministicCheckName,
  DocketReviewConfig,
  ExtractorFieldResponse,
  FieldAgreement,
  ReviewDispute,
  ReviewEvidence,
  ReviewField,
  ReviewFinding,
  ReviewSourceText,
} from "./DocketReview.schemas.ts";
import type { LocalDate } from "@beep/schema/LocalDate";
import type * as Equivalence from "effect/Equivalence";
import type { ReviewFindingSeverity, ReviewTerminalStatus } from "./DocketReview.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketReview.policy");

const opt = <Sch extends S.Top>(schema: Sch, description: string) =>
  schema.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }));

// What an extractor entry claims about dates, period, references and source text. An entry that
// is not a docket item claims nothing.
type Claims = {
  readonly citedText: O.Option<string>;
  readonly mailDate: O.Option<LocalDate>;
  readonly matterReferences: ReadonlyArray<string>;
  readonly responsePeriod: O.Option<DocketResponsePeriod>;
  readonly statedDueDate: O.Option<LocalDate>;
};

const NO_CLAIMS: Claims = {
  citedText: O.none(),
  mailDate: O.none(),
  matterReferences: [],
  responsePeriod: O.none(),
  statedDueDate: O.none(),
};

const claimsOf: (entry: ParalegalEntry) => Claims = ParalegalEntry.match({
  ParalegalDocketEntry: (entry): Claims => entry,
  ParalegalNotDocketItem: (): Claims => NO_CLAIMS,
});

const mailPlusPeriod = (source: {
  readonly mailDate: O.Option<LocalDate>;
  readonly responsePeriod: O.Option<DocketResponsePeriod>;
}): O.Option<LocalDate> =>
  O.map(O.all({ mailDate: source.mailDate, period: source.responsePeriod }), (both) =>
    addDocketResponsePeriod(both.mailDate, both.period)
  );

const claimedDueDate = (claims: Claims): O.Option<LocalDate> =>
  O.orElse(claims.statedDueDate, () => mailPlusPeriod(claims));

/**
 * The due date an extractor entry stands for: the date the message states
 * outright, or failing that its own mail date plus period.
 *
 * **Example** (An entry that is not a docket item has no date)
 *
 * ```ts
 * import { extractorDueDate, ParalegalNotDocketItem } from "@beep/law-practice-use-cases/DocketIntake";
 * import * as O from "effect/Option";
 *
 * console.log(O.isNone(extractorDueDate(ParalegalNotDocketItem.make({ rationale: "Newsletter." })))); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const extractorDueDate: (entry: ParalegalEntry) => O.Option<LocalDate> = flow(claimsOf, claimedDueDate);

/**
 * The due date the critic's reading stands for: the mail date it read plus
 * the response period it read. The critic never reports a finished date.
 *
 * **Example** (A reading without a period has no date)
 *
 * ```ts
 * import { criticDueDate, SecretaryReview } from "@beep/law-practice-use-cases/DocketIntake";
 * import * as O from "effect/Option";
 *
 * console.log(O.isNone(criticDueDate(SecretaryReview.make({ isDocketItem: true, notes: "No period." })))); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const criticDueDate = (reading: SecretaryReview): O.Option<LocalDate> => mailPlusPeriod(reading);

// True unless a value is present and breaks the rule: a check on something the entry does not
// state has nothing to fail on.
const holds = <Value>(value: O.Option<Value>, rule: (value: Value) => boolean): boolean =>
  !O.exists(value, (present) => !rule(present));

const WHITESPACE = /\s+/gu;

const collapse: (text: string) => string = flow(Str.replaceAll(WHITESPACE, " "), Str.trim, Str.toLowerCase);

// A needle counts only when it is not part of a longer number or word: "8 January 2030" is not
// in "18 January 2030". Needles are built here from digits, letters, spaces, commas, slashes and
// hyphens, so none needs escaping.
const mentions = (text: string, needle: string): boolean =>
  O.isSome(Str.match(new RegExp(`(?<![0-9a-z])${needle}(?![0-9a-z])`, "u"))(text));

const MONTH_NAMES: ReadonlyArray<string> = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const NUMBER_WORDS: ReadonlyArray<string> = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

const twoDigits = (value: number): string => Str.padStart(2, "0")(`${value}`);

// The written forms a date is looked for in: ISO, M/D/YYYY (plain and zero-padded),
// "Month D, YYYY" and "D Month YYYY".
const dateForms = (date: LocalDate): ReadonlyArray<string> => [
  date.toISOString(),
  `${date.month}/${date.day}/${date.year}`,
  `${twoDigits(date.month)}/${twoDigits(date.day)}/${date.year}`,
  ...A.flatMap(A.fromOption(A.get(MONTH_NAMES, date.month - 1)), (month) => [
    `${month} ${date.day}, ${date.year}`,
    `${date.day} ${month} ${date.year}`,
  ]),
];

const amountForms = (amount: number): ReadonlyArray<string> => [
  `${amount}`,
  ...A.fromOption(A.get(NUMBER_WORDS, amount - 1)),
];

const unitStem: (unit: DocketResponsePeriodUnit) => string = DocketResponsePeriodUnit.$match({
  days: () => "day",
  months: () => "month",
});

const dateAppears = (text: string, date: LocalDate): boolean => A.some(dateForms(date), (form) => mentions(text, form));

// A period appears as its number, in digits or as the English word for 1 to 12, plus its unit.
const periodAppears = (text: string, period: DocketResponsePeriod): boolean =>
  A.some(amountForms(period.amount), (form) => mentions(text, form)) && pipe(text, Str.includes(unitStem(period.unit)));

const reportedDates = (claims: Claims): ReadonlyArray<LocalDate> => A.getSomes([claims.mailDate, claims.statedDueDate]);

const isRealDay = (date: LocalDate): boolean => date.day <= daysInMonth(date.year, date.month);

const datesAreRealDays = (claims: Claims): boolean => A.every(reportedDates(claims), isRealDay);

const dueEqualsMailPlusPeriod = (claims: Claims): boolean =>
  holds(O.all({ due: claims.statedDueDate, mail: claims.mailDate, period: claims.responsePeriod }), (stated) =>
    sameDate(stated.due, addDocketResponsePeriod(stated.mail, stated.period))
  );

const dueNotBeforeMail = (claims: Claims): boolean =>
  holds(O.all({ due: claimedDueDate(claims), mail: claims.mailDate }), (stated) => !isBefore(stated.due, stated.mail));

const citedOf = (claims: Claims): string => collapse(O.getOrElse(claims.citedText, () => ""));

const valuesAppearInCitedText = (claims: Claims): boolean =>
  A.every(reportedDates(claims), (date) => dateAppears(citedOf(claims), date)) &&
  holds(claims.responsePeriod, (period) => periodAppears(citedOf(claims), period));

// A citation may quote several places; each line of it is looked for on its own.
const passagesOf = (cited: string): ReadonlyArray<string> =>
  A.filter(A.map(Str.split("\n")(cited), collapse), Str.isNonEmpty);

const searchableText = (source: ReviewSourceText): string =>
  collapse(`${source.messageText}\n${O.getOrElse(source.documentText, () => "")}`);

// Without the text of an attached document, a citation that is not in the message cannot be
// told from one that quotes the document, so it is not failed.
const isUnverifiable = (source: ReviewSourceText): boolean => source.hasDocuments && O.isNone(source.documentText);

const citedSpanExists = (claims: Claims, source: ReviewSourceText): boolean =>
  isUnverifiable(source) ||
  holds(claims.citedText, (cited) =>
    A.every(passagesOf(cited), (passage) => pipe(searchableText(source), Str.includes(passage)))
  );

/**
 * Run the deterministic checks on an extractor entry.
 *
 * **Details**
 *
 * Every check passes on a value the entry does not state. A reported date
 * must be findable in the cited text as ISO, `M/D/YYYY`, `Month D, YYYY` or
 * `D Month YYYY`; a reported period as its number (digits, or the English
 * word for 1 to 12) plus its unit. The cited text is compared line by line,
 * ignoring case and runs of whitespace. When a document is attached and its
 * text is not available, a citation that is not in the message is not failed.
 *
 * **Example** (Check an entry that cites nothing)
 *
 * ```ts
 * import {
 *   ParalegalNotDocketItem,
 *   ReviewSourceText,
 *   runDeterministicChecks
 * } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const checks = runDeterministicChecks(
 *   ParalegalNotDocketItem.make({ rationale: "Newsletter." }),
 *   ReviewSourceText.make({ messageText: "Fixture body." })
 * );
 * console.log(checks.every((check) => check.passed)); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runDeterministicChecks: {
  (source: ReviewSourceText): (entry: ParalegalEntry) => ReadonlyArray<DeterministicCheck>;
  (entry: ParalegalEntry, source: ReviewSourceText): ReadonlyArray<DeterministicCheck>;
} = dual(2, (entry: ParalegalEntry, source: ReviewSourceText): ReadonlyArray<DeterministicCheck> => {
  const claims = claimsOf(entry);
  return [
    DeterministicCheck.make({ check: "dates-are-real-days", passed: datesAreRealDays(claims) }),
    DeterministicCheck.make({ check: "due-equals-mail-plus-period", passed: dueEqualsMailPlusPeriod(claims) }),
    DeterministicCheck.make({ check: "due-not-before-mail", passed: dueNotBeforeMail(claims) }),
    DeterministicCheck.make({ check: "values-appear-in-cited-text", passed: valuesAppearInCitedText(claims) }),
    DeterministicCheck.make({ check: "cited-span-exists", passed: citedSpanExists(claims, source) }),
  ];
});

/**
 * Whether every deterministic check of a round passed.
 *
 * **Example** (An empty list passes)
 *
 * ```ts
 * import { reviewGatePassed } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(reviewGatePassed([])); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const reviewGatePassed = (checks: ReadonlyArray<DeterministicCheck>): boolean =>
  A.every(checks, (check) => check.passed);

const isDocketEntry = S.is(ParalegalEntry.cases.ParalegalDocketEntry);

// A field is compared when at least one side read it. One side reading a value the other did not
// find is a disagreement.
const compared = <Value>(
  field: ReviewField,
  extractor: O.Option<Value>,
  critic: O.Option<Value>,
  equivalence: Equivalence.Equivalence<Value>
): O.Option<FieldAgreement> =>
  O.isNone(extractor) && O.isNone(critic)
    ? O.none()
    : O.some(FieldAgreement.make({ agreed: O.makeEquivalence(equivalence)(extractor, critic), field }));

const periodEquivalence = S.toEquivalence(DocketResponsePeriod);

const referenceSetEquivalence = Eq.asEquivalence<HashSet.HashSet<string>>();

// References are compared as sets, ignoring case and surrounding space. No reference at all is
// "not read".
const referencesRead: (references: ReadonlyArray<string>) => O.Option<HashSet.HashSet<string>> = flow(
  A.map(flow(Str.trim, Str.toLowerCase)),
  A.filter(Str.isNonEmpty),
  HashSet.fromIterable,
  O.liftPredicate((set) => HashSet.size(set) > 0)
);

/**
 * Compare the extractor's entry with the critic's own reading, field by field.
 *
 * **Details**
 *
 * The classification is always compared. The mail date, the response period,
 * the due date and the matter references are compared only when at least one
 * side read them. Matter references are compared as sets, ignoring case and
 * surrounding space.
 *
 * **Example** (Compare the classification)
 *
 * ```ts
 * import { compareReadings, ParalegalNotDocketItem, SecretaryReview } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const agreement = compareReadings(
 *   ParalegalNotDocketItem.make({ rationale: "Newsletter." }),
 *   SecretaryReview.make({ isDocketItem: true, notes: "States a deadline." })
 * );
 * console.log(agreement.map((field) => field.agreed)); // [false]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const compareReadings: {
  (reading: SecretaryReview): (entry: ParalegalEntry) => ReadonlyArray<FieldAgreement>;
  (entry: ParalegalEntry, reading: SecretaryReview): ReadonlyArray<FieldAgreement>;
} = dual(2, (entry: ParalegalEntry, reading: SecretaryReview): ReadonlyArray<FieldAgreement> => {
  const claims = claimsOf(entry);
  return A.getSomes([
    O.some(FieldAgreement.make({ agreed: isDocketEntry(entry) === reading.isDocketItem, field: "classification" })),
    compared("mail-date", claims.mailDate, reading.mailDate, sameDate),
    compared("response-period", claims.responsePeriod, reading.responsePeriod, periodEquivalence),
    compared("due-date", claimedDueDate(claims), criticDueDate(reading), sameDate),
    compared(
      "matter-references",
      referencesRead(claims.matterReferences),
      referencesRead(reading.matterReferences),
      referenceSetEquivalence
    ),
  ]);
});

const MATERIAL_SEVERITIES: ReadonlyArray<ReviewFindingSeverity> = ["P0", "P1"];

const isMaterial = (finding: ReviewFinding): boolean => A.contains(MATERIAL_SEVERITIES, finding.severity);

const MATERIAL_WEIGHT = 0.5;
const AGREEMENT_WEIGHT = 0.5;

const agreementShare: (agreement: ReadonlyArray<FieldAgreement>) => number = A.match({
  onEmpty: () => 1,
  onNonEmpty: (fields) => A.length(A.filter(fields, (field) => field.agreed)) / A.length(fields),
});

/**
 * Confidence score of one round: `0.5 * M + 0.5 * A`.
 *
 * **Details**
 *
 * `M` is 1 when the critic raised no `P0` or `P1` finding, otherwise 0. `A`
 * is the share of compared fields the two readings agree on, and 1 when
 * nothing was compared. The deterministic checks are a gate beside the score,
 * not a term of it.
 *
 * **Example** (Score a round with nothing to object to)
 *
 * ```ts
 * import { ReviewEvidence, scoreRound } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(scoreRound(ReviewEvidence.make({ agreement: [], checks: [], findings: [] }))); // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const scoreRound = (evidence: ReviewEvidence): UnitInterval =>
  UnitInterval.make(
    MATERIAL_WEIGHT * (A.some(evidence.findings, isMaterial) ? 0 : 1) +
      AGREEMENT_WEIGHT * agreementShare(evidence.agreement)
  );

/**
 * What a review round is assessed from: the two readings, the critic's
 * findings and the text citations are checked against.
 *
 * **Example** (Draft a first round)
 *
 * ```ts
 * import {
 *   ParalegalNotDocketItem,
 *   ReviewRoundDraft,
 *   ReviewSourceText,
 *   SecretaryReview
 * } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const draft = ReviewRoundDraft.make({
 *   entry: ParalegalNotDocketItem.make({ rationale: "Newsletter." }),
 *   findings: [],
 *   index: 1,
 *   reading: SecretaryReview.make({ isDocketItem: false, notes: "Agreed." }),
 *   source: ReviewSourceText.make({ messageText: "Fixture body." })
 * });
 * console.log(draft.index);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewRoundDraft extends S.Class<ReviewRoundDraft>($I`ReviewRoundDraft`)(
  {
    entry: ParalegalEntry.annotateKey({ description: "The extractor's entry for the round." }),
    extractorConfidence: opt(UnitInterval, "The extractor's own confidence; recorded, never scored."),
    extractorResponse: S.Array(ExtractorFieldResponse)
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))
      .annotateKey({ description: "What the extractor did with each disputed field." }),
    findings: S.Array(ReviewFinding).annotateKey({ description: "The critic's findings on the entry." }),
    index: S.Int.check(S.isGreaterThan(0)).annotateKey({ description: "1-based number of the round." }),
    reading: SecretaryReview.annotateKey({ description: "The critic's own reading for the round." }),
    source: ReviewSourceText.annotateKey({ description: "The text citations are checked against." }),
  },
  $I.annote("ReviewRoundDraft", { description: "What a docket review round is assessed from." })
) {}

/**
 * Assess one round: run the checks, compare the fields and score it.
 *
 * **Example** (Assess a round both sides dismiss)
 *
 * ```ts
 * import {
 *   assessReviewRound,
 *   ParalegalNotDocketItem,
 *   ReviewRoundDraft,
 *   ReviewSourceText,
 *   SecretaryReview
 * } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const round = assessReviewRound(
 *   ReviewRoundDraft.make({
 *     entry: ParalegalNotDocketItem.make({ rationale: "Newsletter." }),
 *     findings: [],
 *     index: 1,
 *     reading: SecretaryReview.make({ isDocketItem: false, notes: "Agreed." }),
 *     source: ReviewSourceText.make({ messageText: "Fixture body." })
 *   })
 * );
 * console.log(round.score); // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const assessReviewRound = (draft: ReviewRoundDraft): ReviewRound => {
  const evidence = ReviewEvidence.make({
    agreement: compareReadings(draft.entry, draft.reading),
    checks: runDeterministicChecks(draft.entry, draft.source),
    findings: draft.findings,
  });
  return ReviewRound.make({
    agreement: evidence.agreement,
    checks: evidence.checks,
    entry: draft.entry,
    extractorConfidence: draft.extractorConfidence,
    extractorResponse: draft.extractorResponse,
    findings: evidence.findings,
    index: draft.index,
    reading: draft.reading,
    score: scoreRound(evidence),
  });
};

/**
 * What the decision at the end of a round is taken from.
 *
 * **Details**
 *
 * `earlier` holds the rounds before `round`, oldest first. They are needed
 * only to tell a disagreement that never changed from one that moved.
 *
 * **Example** (Read the decision fields)
 *
 * ```ts
 * import { ReviewDecisionInput } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(Object.keys(ReviewDecisionInput.fields));
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewDecisionInput extends S.Class<ReviewDecisionInput>($I`ReviewDecisionInput`)(
  {
    config: DocketReviewConfig.annotateKey({ description: "Settings of the review loop." }),
    earlier: S.Array(ReviewRound)
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))
      .annotateKey({ description: "The rounds before this one, oldest first." }),
    gatePassed: S.Boolean.annotateKey({ description: "Whether every deterministic check of the round passed." }),
    isLastRound: S.Boolean.annotateKey({ description: "Whether the round limit is reached." }),
    round: ReviewRound.annotateKey({ description: "The round being decided." }),
  },
  $I.annote("ReviewDecisionInput", { description: "What the decision at the end of a docket review round uses." })
) {}

const disagreedFields = (round: ReviewRound): ReadonlyArray<ReviewField> =>
  A.map(
    A.filter(round.agreement, (field) => !field.agreed),
    (field) => field.field
  );

// A disagreement never changed when the same field failed its comparison in every round.
const hasStandingDisagreement = (input: ReviewDecisionInput): boolean =>
  A.some(disagreedFields(input.round), (field) =>
    A.every(input.earlier, (earlier) => A.contains(disagreedFields(earlier), field))
  );

const flaggedStatus = (input: ReviewDecisionInput): ReviewTerminalStatus =>
  A.some(input.round.findings, isMaterial) || hasStandingDisagreement(input)
    ? "flagged-max-rounds"
    : "flagged-low-confidence";

/**
 * Decide whether a review ends after this round, and how.
 *
 * **Details**
 *
 * The item is `accepted` exactly when the deterministic gate passed and the
 * round's score reached the threshold. Otherwise the review goes on (`None`)
 * until the last round, where it ends as `deterministic-failure` when the gate
 * failed, `flagged-max-rounds` when a material finding or a disagreement that
 * never changed remains, and `flagged-low-confidence` otherwise.
 *
 * **Example** (Read the decision of a round)
 *
 * ```ts
 * import { terminalStatus } from "@beep/law-practice-use-cases/DocketIntake";
 * import * as O from "effect/Option";
 * import type { ReviewDecisionInput } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const goesOn = (input: ReviewDecisionInput) => O.isNone(terminalStatus(input));
 * console.log(goesOn);
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const terminalStatus = (input: ReviewDecisionInput): O.Option<ReviewTerminalStatus> => {
  if (input.gatePassed && input.round.score >= input.config.acceptThreshold) {
    return O.some("accepted");
  }
  if (!input.isLastRound) {
    return O.none();
  }
  return O.some(input.gatePassed ? flaggedStatus(input) : "deterministic-failure");
};

type DisputeReason = { readonly field: ReviewField; readonly text: string };

const DISAGREEMENT_REASON = "Your reading of this field differs from the reviewer's independent reading.";

// A failed check is put to the extractor as a dispute of the field it can correct.
const checkReason: (check: DeterministicCheckName) => DisputeReason = DeterministicCheckName.$match({
  "cited-span-exists": (): DisputeReason => ({
    field: "source-document",
    text: "The text you cited was not found in the message.",
  }),
  "dates-are-real-days": (): DisputeReason => ({
    field: "mail-date",
    text: "A date you reported is not a real calendar day.",
  }),
  "due-equals-mail-plus-period": (): DisputeReason => ({
    field: "stated-due-date",
    text: "The due date you reported is not your mail date plus your response period.",
  }),
  "due-not-before-mail": (): DisputeReason => ({
    field: "stated-due-date",
    text: "The due date you reported is before your mail date.",
  }),
  "values-appear-in-cited-text": (): DisputeReason => ({
    field: "source-document",
    text: "A date or period you reported does not appear in the text you cited.",
  }),
});

const disputeReasons = (round: ReviewRound): ReadonlyArray<DisputeReason> => [
  ...A.map(disagreedFields(round), (field): DisputeReason => ({ field, text: DISAGREEMENT_REASON })),
  ...A.map(
    A.filter(round.findings, isMaterial),
    (finding): DisputeReason => ({
      field: finding.field,
      text: finding.reason,
    })
  ),
  ...A.map(
    A.filter(round.checks, (check) => !check.passed),
    (check) => checkReason(check.check)
  ),
];

/**
 * The fields the extractor must revise or defend after a round, with the
 * reasons each is disputed.
 *
 * **Details**
 *
 * A field is disputed when the two readings disagree on it, when the critic
 * raised a material finding on it, or when a deterministic check that the
 * field can correct failed. Only reasons are passed on: the value the critic
 * read is never part of a dispute.
 *
 * **Example** (Read the disputed fields of a round)
 *
 * ```ts
 * import { reviewDisputes } from "@beep/law-practice-use-cases/DocketIntake";
 * import type { ReviewRound } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const fields = (round: ReviewRound) => reviewDisputes(round).map((dispute) => dispute.field);
 * console.log(fields);
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const reviewDisputes = (round: ReviewRound): ReadonlyArray<ReviewDispute> => {
  const reasons = disputeReasons(round);
  return A.map(A.dedupe(A.map(reasons, (reason) => reason.field)), (field) =>
    ReviewDispute.make({
      field,
      reasons: A.dedupe(
        A.map(
          A.filter(reasons, (reason) => reason.field === field),
          (reason) => reason.text
        )
      ),
    })
  );
};

const REREAD_FIELDS: ReadonlyArray<ReviewField> = [
  "classification",
  "mail-date",
  "response-period",
  "due-date",
  "matter-references",
];

/**
 * The disputed fields the critic can read again for itself: the
 * classification, the mail date, the response period, the due date and the
 * matter references.
 *
 * **Example** (A disputed title is not re-read)
 *
 * ```ts
 * import { rereadFields, ReviewDispute } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(rereadFields([ReviewDispute.make({ field: "title", reasons: ["Names no date type."] })])); // []
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rereadFields = (disputes: ReadonlyArray<ReviewDispute>): ReadonlyArray<ReviewField> =>
  A.filter(
    A.map(disputes, (dispute) => dispute.field),
    (field) => A.contains(REREAD_FIELDS, field)
  );

/**
 * A critic re-reading of some fields, to be merged into its earlier reading.
 *
 * **Example** (Make a merge input)
 *
 * ```ts
 * import { RereadMerge, SecretaryReview } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const reading = SecretaryReview.make({ isDocketItem: true, notes: "Fixture." });
 * console.log(RereadMerge.make({ fields: ["mail-date"], previous: reading, reread: reading }).fields);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RereadMerge extends S.Class<RereadMerge>($I`RereadMerge`)(
  {
    fields: S.Array(ReviewField).annotateKey({ description: "The fields that were read again." }),
    previous: SecretaryReview.annotateKey({ description: "The critic's reading before the re-reading." }),
    reread: SecretaryReview.annotateKey({ description: "What the critic read this time." }),
  },
  $I.annote("RereadMerge", { description: "A critic re-reading to merge into its earlier reading." })
) {}

const DATE_FIELDS: ReadonlyArray<ReviewField> = ["mail-date", "due-date"];
const PERIOD_FIELDS: ReadonlyArray<ReviewField> = ["response-period", "due-date"];
const SOURCE_FIELDS: ReadonlyArray<ReviewField> = ["mail-date", "response-period", "due-date"];

/**
 * Merge a re-reading into the critic's earlier reading: only the fields that
 * were read again change.
 *
 * **Details**
 *
 * A disputed due date means the mail date and the response period are both
 * read again, because the critic never reports a finished date. The notes are
 * always those of the re-reading.
 *
 * **Example** (Keep a field that was not read again)
 *
 * ```ts
 * import { mergeRereading, RereadMerge, SecretaryReview } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const merged = mergeRereading(
 *   RereadMerge.make({
 *     fields: ["matter-references"],
 *     previous: SecretaryReview.make({ isDocketItem: true, notes: "First reading." }),
 *     reread: SecretaryReview.make({ isDocketItem: false, matterReferences: ["FIX-0001"], notes: "Second reading." })
 *   })
 * );
 * console.log(merged.isDocketItem, merged.matterReferences); // true ["FIX-0001"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const mergeRereading = (merge: RereadMerge): SecretaryReview => {
  const { fields, previous, reread } = merge;
  const pick = <Value>(readAgain: ReadonlyArray<ReviewField>, next: Value, kept: Value): Value =>
    A.some(readAgain, (field) => A.contains(fields, field)) ? next : kept;
  return SecretaryReview.make({
    isDocketItem: pick(["classification"], reread.isDocketItem, previous.isDocketItem),
    mailDate: pick(DATE_FIELDS, reread.mailDate, previous.mailDate),
    matterReferences: pick(["matter-references"], reread.matterReferences, previous.matterReferences),
    notes: reread.notes,
    readFromSourceDocument: pick(SOURCE_FIELDS, reread.readFromSourceDocument, previous.readFromSourceDocument),
    responsePeriod: pick(PERIOD_FIELDS, reread.responsePeriod, previous.responsePeriod),
  });
};

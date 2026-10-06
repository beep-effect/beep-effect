/**
 * Proofs of the pure review-loop policy: the deterministic checks, the field
 * comparison, the confidence score and the end-of-round decision.
 *
 * Every fixture is synthetic: invented reference numbers and placeholder
 * text. No real mail, sender, matter or client appears here.
 */
import { DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  assessReviewRound,
  compareReadings,
  criticDueDate,
  DeterministicCheck,
  DeterministicCheckName,
  DocketReviewConfig,
  extractorDueDate,
  FieldAgreement,
  mergeRereading,
  ParalegalDocketEntry,
  ParalegalNotDocketItem,
  RereadMerge,
  ReviewDecisionInput,
  ReviewDispute,
  ReviewEvidence,
  ReviewFinding,
  ReviewRound,
  ReviewRoundDraft,
  ReviewSourceText,
  rereadFields,
  reviewDisputes,
  reviewGatePassed,
  runDeterministicChecks,
  SecretaryReview,
  scoreRound,
  terminalStatus,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ParalegalEntry, ReviewField } from "@beep/law-practice-use-cases/DocketIntake";

const BODY = A.join(
  [
    "Synthetic fixture notice for FIX-0001.",
    "Mailed   January 8, 2030.",
    "A response is due within THREE (3) months of the mailing date.",
    "A shorter period of 45 days applies to the fixture fee.",
  ],
  "\n"
);

const source = ReviewSourceText.make({ messageText: BODY });

const mailDate = LocalDate.make({ year: 2030, month: 1, day: 8 });
const threeMonths = DocketResponsePeriod.make({ amount: 3, unit: "months" });
const fortyFiveDays = DocketResponsePeriod.make({ amount: 45, unit: "days" });

const entryOf = (overrides: Partial<ConstructorParameters<typeof ParalegalDocketEntry>[0]> = {}) =>
  ParalegalDocketEntry.make({
    citedText: O.some("Mailed January 8, 2030.\nA response is due within three (3) months"),
    mailDate: O.some(mailDate),
    matterReferences: ["FIX-0001"],
    rationale: "States a response period.",
    responsePeriod: O.some(threeMonths),
    title: "Due Date: fixture response",
    ...overrides,
  });

const readingOf = (overrides: Partial<ConstructorParameters<typeof SecretaryReview>[0]> = {}) =>
  SecretaryReview.make({
    isDocketItem: true,
    mailDate: O.some(mailDate),
    matterReferences: [" fix-0001 "],
    notes: "Read the fixture notice.",
    responsePeriod: O.some(threeMonths),
    ...overrides,
  });

const dismissed = ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." });

const passedOf = (entry: ParalegalEntry, text: ReviewSourceText, check: DeterministicCheckName): O.Option<boolean> =>
  O.map(
    A.findFirst(runDeterministicChecks(entry, text), (result) => result.check === check),
    (result) => result.passed
  );

const agreedOn = (entry: ParalegalEntry, reading: SecretaryReview, field: ReviewField): O.Option<boolean> =>
  O.map(
    A.findFirst(compareReadings(entry, reading), (result) => result.field === field),
    (result) => result.agreed
  );

const material = ReviewFinding.make({ field: "matter-references", reason: "Names the wrong matter.", severity: "P1" });
const minor = ReviewFinding.make({ field: "title", reason: "Names no date type.", severity: "P3" });

const COMPARED_FIELDS: ReadonlyArray<ReviewField> = [
  "classification",
  "mail-date",
  "response-period",
  "due-date",
  "matter-references",
];

const roundOf = (overrides: Partial<ConstructorParameters<typeof ReviewRound>[0]> = {}) =>
  ReviewRound.make({
    agreement: [],
    checks: [],
    entry: entryOf(),
    findings: [],
    index: 1,
    reading: readingOf(),
    score: UnitInterval.make(1),
    ...overrides,
  });

const disagreeing = (field: ReviewField) => FieldAgreement.make({ agreed: false, field });

const decide = (overrides: Partial<ConstructorParameters<typeof ReviewDecisionInput>[0]> = {}) =>
  terminalStatus(
    ReviewDecisionInput.make({
      config: DocketReviewConfig.make({}),
      gatePassed: true,
      isLastRound: true,
      round: roundOf(),
      ...overrides,
    })
  );

const FiveFlags = S.Tuple([S.Boolean, S.Boolean, S.Boolean, S.Boolean, S.Boolean]);
const Flags = S.Array(S.Boolean);
const Findings = S.Array(ReviewFinding);
const MaterialSeverity = S.Literals(["P0", "P1"]);

const flaggedAgreement = (flags: ReadonlyArray<boolean>): ReadonlyArray<FieldAgreement> =>
  A.zipWith(COMPARED_FIELDS, flags, (field, agreed) => FieldAgreement.make({ agreed, field }));

describe("@beep/law-practice-use-cases DocketReview policy", () => {
  it("passes every check on an entry whose dates and period are in the text it cites", () => {
    assertTrue(reviewGatePassed(runDeterministicChecks(entryOf(), source)));
    assertTrue(reviewGatePassed(pipe(dismissed, runDeterministicChecks(source))));
    expect(A.map(runDeterministicChecks(entryOf(), source), (check) => check.check)).toStrictEqual(
      DeterministicCheckName.literals
    );
  });

  it("finds a date in any common written form and never inside a longer number", () => {
    const cites = (citedText: string) =>
      passedOf(entryOf({ citedText: O.some(citedText) }), source, "values-appear-in-cited-text");

    for (const form of ["2030-01-08", "1/8/2030", "01/08/2030", "January 8, 2030", "8 january 2030"]) {
      assertSome(cites(`Mailed ${form}; three months to respond.`), true);
    }
    assertSome(cites("Mailed 18 January 2030; three months to respond."), false);
    assertSome(cites("Mailed 11/8/2030; three months to respond."), false);
    assertSome(cites("Three months to respond."), false);
    assertSome(passedOf(entryOf({ citedText: O.none() }), source, "values-appear-in-cited-text"), false);
  });

  it("finds a period as digits or as a number word, with its unit", () => {
    const cites = (citedText: string, responsePeriod: DocketResponsePeriod) =>
      passedOf(
        entryOf({ citedText: O.some(`Mailed January 8, 2030. ${citedText}`), responsePeriod: O.some(responsePeriod) }),
        source,
        "values-appear-in-cited-text"
      );

    assertSome(cites("Respond within 3 months.", threeMonths), true);
    assertSome(cites("Respond within three months.", threeMonths), true);
    assertSome(cites("Respond within 45 days.", fortyFiveDays), true);
    assertSome(cites("Respond within 3 days.", threeMonths), false);
    assertSome(cites("Respond within 13 months.", threeMonths), false);
    assertSome(cites("Respond within forty-five days.", fortyFiveDays), false);
  });

  it("fails a date that is not a real day, a due date that is not mail plus period, and one before the mail date", () => {
    const impossible = LocalDate.make({ year: 2030, month: 2, day: 31 });
    const wrongDue = LocalDate.make({ year: 2030, month: 4, day: 9 });
    const earlyDue = LocalDate.make({ year: 2030, month: 1, day: 2 });

    assertSome(passedOf(entryOf({ mailDate: O.some(impossible) }), source, "dates-are-real-days"), false);
    assertSome(passedOf(entryOf({ statedDueDate: O.some(wrongDue) }), source, "due-equals-mail-plus-period"), false);
    assertSome(
      passedOf(
        entryOf({ statedDueDate: O.some(LocalDate.make({ year: 2030, month: 4, day: 8 })) }),
        source,
        "due-equals-mail-plus-period"
      ),
      true
    );
    assertSome(
      passedOf(entryOf({ responsePeriod: O.none(), statedDueDate: O.some(earlyDue) }), source, "due-not-before-mail"),
      false
    );
    assertSome(passedOf(entryOf({ mailDate: O.none() }), source, "due-not-before-mail"), true);
  });

  it("looks a citation up in the message, then in the document text, and cannot fail one it has no text for", () => {
    const quoted = entryOf({
      citedText: O.some("Mailed January 8, 2030.\n\nThree months, per the attached fixture action."),
    });
    const withText = ReviewSourceText.make({
      documentText: O.some("three   months, per the attached fixture action."),
      hasDocuments: true,
      messageText: BODY,
    });
    const withoutText = ReviewSourceText.make({ hasDocuments: true, messageText: BODY });

    assertSome(passedOf(quoted, source, "cited-span-exists"), false);
    assertSome(passedOf(quoted, withText, "cited-span-exists"), true);
    assertSome(passedOf(quoted, withoutText, "cited-span-exists"), true);
    assertSome(passedOf(entryOf({ citedText: O.none() }), source, "cited-span-exists"), true);
  });

  it("compares only the fields at least one side read, and references as sets", () => {
    expect(compareReadings(entryOf(), readingOf())).toStrictEqual(flaggedAgreement([true, true, true, true, true]));
    expect(
      pipe(
        dismissed,
        compareReadings(
          readingOf({ isDocketItem: false, mailDate: O.none(), matterReferences: [], responsePeriod: O.none() })
        )
      )
    ).toStrictEqual([FieldAgreement.make({ agreed: true, field: "classification" })]);
    assertSome(agreedOn(dismissed, readingOf(), "classification"), false);
    assertSome(agreedOn(dismissed, readingOf(), "mail-date"), false);
    assertSome(agreedOn(entryOf(), readingOf({ responsePeriod: O.some(fortyFiveDays) }), "response-period"), false);
    assertSome(agreedOn(entryOf(), readingOf({ responsePeriod: O.some(fortyFiveDays) }), "due-date"), false);
    assertSome(agreedOn(entryOf(), readingOf({ matterReferences: ["FIX-0002"] }), "matter-references"), false);
    assertSome(agreedOn(entryOf({ matterReferences: [" "] }), readingOf(), "matter-references"), false);
    assertNone(agreedOn(entryOf({ matterReferences: [] }), readingOf({ matterReferences: [] }), "matter-references"));
  });

  it("reads the due date each side stands for", () => {
    const stated = LocalDate.make({ year: 2030, month: 5, day: 1 });

    assertSome(
      O.map(extractorDueDate(entryOf()), (date) => date.toISOString()),
      "2030-04-08"
    );
    assertSome(
      O.map(extractorDueDate(entryOf({ statedDueDate: O.some(stated) })), (date) => date.toISOString()),
      "2030-05-01"
    );
    assertNone(extractorDueDate(dismissed));
    assertSome(
      O.map(criticDueDate(readingOf()), (date) => date.toISOString()),
      "2030-04-08"
    );
    assertNone(criticDueDate(readingOf({ responsePeriod: O.none() })));
  });

  it("scores a round as half material findings, half agreement", () => {
    const evidence = (findings: ReadonlyArray<ReviewFinding>, flags: ReadonlyArray<boolean>) =>
      scoreRound(ReviewEvidence.make({ agreement: flaggedAgreement(flags), checks: [], findings }));

    expect(evidence([], [])).toBe(1);
    expect(evidence([minor], [true, true, true, true, false])).toBe(0.9);
    expect(evidence([material], [true, true, true, true, true])).toBe(0.5);
    expect(evidence([material], [false])).toBe(0);
  });

  it.prop(
    "keeps the score inside the unit interval",
    { evidence: Arbitrary.schema(ReviewEvidence) },
    ({ evidence }) => {
      const score = scoreRound(evidence);

      assertTrue(score >= 0 && score <= 1);
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "never lowers the score when more fields agree",
    { evidence: Arbitrary.schema(ReviewEvidence), raise: Arbitrary.schema(Flags) },
    ({ evidence, raise }) => {
      const raised = ReviewEvidence.make({
        agreement: A.map(evidence.agreement, (field, index) =>
          FieldAgreement.make({
            agreed: field.agreed || O.getOrElse(A.get(raise, index), () => false),
            field: field.field,
          })
        ),
        checks: evidence.checks,
        findings: evidence.findings,
      });

      assertTrue(scoreRound(raised) >= scoreRound(evidence));
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "caps the score at one half when a material finding is open",
    { evidence: Arbitrary.schema(ReviewEvidence), severity: Arbitrary.schema(MaterialSeverity) },
    ({ evidence, severity }) => {
      const withMaterial = ReviewEvidence.make({
        agreement: evidence.agreement,
        checks: evidence.checks,
        findings: A.append(evidence.findings, ReviewFinding.make({ field: "title", reason: "Fixture.", severity })),
      });

      assertTrue(scoreRound(withMaterial) <= 0.5);
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "accepts under the defaults only without a material finding and with at most one disagreement in five",
    { findings: Arbitrary.schema(Findings), flags: Arbitrary.schema(FiveFlags) },
    ({ findings, flags }) => {
      const agreement = flaggedAgreement(flags);
      const round = roundOf({
        agreement,
        findings,
        score: scoreRound(ReviewEvidence.make({ agreement, checks: [], findings })),
      });
      const hasMaterial = A.some(findings, (finding) => finding.severity === "P0" || finding.severity === "P1");
      const disagreements = A.length(A.filter(flags, (agreed) => !agreed));

      const acceptable = !hasMaterial && disagreements <= 1;

      strictEqual(O.contains(decide({ round }), "accepted"), acceptable);
    },
    { arbitrary: fcRuns(200) }
  );

  it.prop(
    "accepts exactly when the gate passed and the score reached the threshold",
    {
      config: Arbitrary.schema(DocketReviewConfig),
      gatePassed: Arbitrary.schema(S.Boolean),
      isLastRound: Arbitrary.schema(S.Boolean),
      score: Arbitrary.schema(UnitInterval),
    },
    ({ config, gatePassed, isLastRound, score }) => {
      const status = decide({ config, gatePassed, isLastRound, round: roundOf({ score }) });

      const acceptable = gatePassed && score >= config.acceptThreshold;
      const goesOn = !isLastRound && !acceptable;

      strictEqual(O.contains(status, "accepted"), acceptable);
      strictEqual(O.isNone(status), goesOn);
    },
    { arbitrary: fcRuns(200) }
  );

  it("ends the last round as a failed check, a reached limit or low confidence", () => {
    const low = UnitInterval.make(0.4);
    const moved = roundOf({ agreement: [disagreeing("mail-date")], score: low });

    assertSome(decide({ gatePassed: false }), "deterministic-failure");
    assertNone(decide({ gatePassed: false, isLastRound: false }));
    assertSome(decide({ round: roundOf({ findings: [material], score: low }) }), "flagged-max-rounds");
    assertSome(decide({ round: moved }), "flagged-max-rounds");
    assertSome(
      decide({ earlier: [roundOf({ agreement: [disagreeing("mail-date")] })], round: moved }),
      "flagged-max-rounds"
    );
    assertSome(
      decide({ earlier: [roundOf({ agreement: [disagreeing("response-period")] })], round: moved }),
      "flagged-low-confidence"
    );
    assertSome(decide({ round: roundOf({ findings: [minor], score: low }) }), "flagged-low-confidence");
  });

  it("disputes disagreeing fields, material findings and failed checks with reasons only", () => {
    const round = roundOf({
      agreement: [disagreeing("mail-date"), FieldAgreement.make({ agreed: true, field: "classification" })],
      checks: A.map(DeterministicCheckName.literals, (check) => DeterministicCheck.make({ check, passed: false })),
      findings: [
        material,
        minor,
        ReviewFinding.make({ field: "mail-date", reason: "The date is misread.", severity: "P0" }),
      ],
    });
    const disputes = reviewDisputes(round);

    expect(A.map(disputes, (dispute) => dispute.field)).toStrictEqual([
      "mail-date",
      "matter-references",
      "stated-due-date",
      "source-document",
    ]);
    expect(A.map(disputes, (dispute) => A.length(dispute.reasons))).toStrictEqual([3, 1, 2, 2]);
    expect(
      reviewDisputes(roundOf({ checks: [DeterministicCheck.make({ check: "cited-span-exists", passed: true })] }))
    ).toStrictEqual([]);
    expect(rereadFields(disputes)).toStrictEqual(["mail-date", "matter-references"]);
    expect(rereadFields([ReviewDispute.make({ field: "title", reasons: ["Fixture."] })])).toStrictEqual([]);
  });

  it("merges a re-reading into the earlier reading field by field", () => {
    const previous = readingOf({ readFromSourceDocument: true });
    const reread = SecretaryReview.make({
      isDocketItem: false,
      mailDate: O.some(LocalDate.make({ year: 2030, month: 1, day: 9 })),
      matterReferences: ["FIX-0002"],
      notes: "Second fixture reading.",
      responsePeriod: O.some(fortyFiveDays),
    });
    const merged = (fields: ReadonlyArray<ReviewField>) =>
      mergeRereading(RereadMerge.make({ fields, previous, reread }));

    expect(merged(["classification", "matter-references"])).toStrictEqual(
      readingOf({
        isDocketItem: false,
        matterReferences: ["FIX-0002"],
        notes: "Second fixture reading.",
        readFromSourceDocument: true,
      })
    );
    expect(merged(["due-date"])).toStrictEqual(
      SecretaryReview.make({
        isDocketItem: true,
        mailDate: reread.mailDate,
        matterReferences: previous.matterReferences,
        notes: "Second fixture reading.",
        responsePeriod: reread.responsePeriod,
      })
    );
  });

  it("assesses a round from its two readings", () => {
    const round = assessReviewRound(
      ReviewRoundDraft.make({
        entry: entryOf(),
        findings: [material],
        index: 2,
        reading: readingOf({ matterReferences: ["FIX-0002"] }),
        source,
      })
    );

    expect([round.index, round.score, A.length(round.checks), A.length(round.agreement)]).toStrictEqual([2, 0.4, 5, 5]);
    assertTrue(reviewGatePassed(round.checks));
  });
});

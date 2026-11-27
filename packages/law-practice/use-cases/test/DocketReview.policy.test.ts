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
  criticComputedDueDate,
  criticDueDate,
  DeterministicCheck,
  DeterministicCheckFailed,
  DeterministicCheckName,
  DeterministicCheckPassed,
  DocketReviewConfig,
  ExtractorFieldResponse,
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
  runCriticChecks,
  runDeterministicChecks,
  SecretaryReview,
  StoredDeterministicCheck,
  scoreRound,
  terminalStatus,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DeterministicCheckResult, ParalegalEntry, ReviewField } from "@beep/law-practice-use-cases/DocketIntake";

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

const entryOf = (overrides: Partial<Parameters<typeof ParalegalDocketEntry.make>[0]> = {}) =>
  ParalegalDocketEntry.make({
    citedText: O.some("Mailed January 8, 2030.\nA response is due within three (3) months"),
    mailDate: O.some(mailDate),
    matterReferences: ["FIX-0001"],
    rationale: "States a response period.",
    responsePeriod: O.some(threeMonths),
    title: "Due Date: fixture response",
    ...overrides,
  });

const readingOf = (overrides: Partial<Parameters<typeof SecretaryReview.make>[0]> = {}) =>
  SecretaryReview.make({
    isDocketItem: true,
    mailDate: O.some(mailDate),
    matterReferences: [" fix-0001 "],
    notes: "Read the fixture notice.",
    responsePeriod: O.some(threeMonths),
    ...overrides,
  });

const dismissed = ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." });

const iso = (date: LocalDate): string => date.toISOString();

const STATED_BODY = "Synthetic fixture notice for FIX-0001. Your response is due April 15, 2030.";
const statedSource = ReviewSourceText.make({ messageText: STATED_BODY });
const statedDue = LocalDate.make({ year: 2030, month: 4, day: 15 });
const otherDue = LocalDate.make({ year: 2030, month: 4, day: 16 });
const statedOnly = ParalegalDocketEntry.make({
  citedText: O.some("Your response is due April 15, 2030."),
  matterReferences: ["FIX-0001"],
  rationale: "States a due date.",
  statedDueDate: O.some(statedDue),
  title: "Due Date: fixture response",
});
const statedReading = (date: LocalDate) =>
  SecretaryReview.make({
    citedText: O.some("Your response is due April 15, 2030."),
    isDocketItem: true,
    matterReferences: ["FIX-0001"],
    notes: "Read the fixture notice.",
    statedDueDate: O.some(date),
  });

const isPassed = (check: DeterministicCheck): boolean => check.result._tag === "Passed";

const resultOf = (
  entry: ParalegalEntry,
  text: ReviewSourceText,
  check: DeterministicCheckName
): O.Option<DeterministicCheckResult["_tag"]> =>
  O.map(
    A.findFirst(runDeterministicChecks(entry, text), (result) => result.check === check),
    (result) => result.result._tag
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

const roundOf = (overrides: Partial<Parameters<typeof ReviewRound.make>[0]> = {}) =>
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

const decide = (overrides: Partial<Parameters<typeof ReviewDecisionInput.make>[0]> = {}) =>
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
const ComparedCount = S.Int.check(S.isBetween({ maximum: 6, minimum: 1 }));
const SixFlags = S.Tuple([S.Boolean, S.Boolean, S.Boolean, S.Boolean, S.Boolean, S.Boolean]);
const ALL_COMPARED: ReadonlyArray<ReviewField> = [
  "classification",
  "mail-date",
  "response-period",
  "stated-due-date",
  "due-date",
  "matter-references",
];
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
      resultOf(entryOf({ citedText: O.some(citedText) }), source, "values-appear-in-cited-text");

    for (const form of ["2030-01-08", "1/8/2030", "01/08/2030", "January 8, 2030", "8 january 2030"]) {
      assertSome(cites(`Mailed ${form}; three months to respond.`), "Passed");
    }
    assertSome(cites("Mailed 18 January 2030; three months to respond."), "Failed");
    assertSome(cites("Mailed 11/8/2030; three months to respond."), "Failed");
    assertSome(cites("Three months to respond."), "Failed");
    assertSome(resultOf(entryOf({ citedText: O.none() }), source, "values-appear-in-cited-text"), "Failed");
  });

  it("finds a period as digits or as a number word, with its unit", () => {
    const cites = (citedText: string, responsePeriod: DocketResponsePeriod) =>
      resultOf(
        entryOf({ citedText: O.some(`Mailed January 8, 2030. ${citedText}`), responsePeriod: O.some(responsePeriod) }),
        source,
        "values-appear-in-cited-text"
      );

    assertSome(cites("Respond within 3 months.", threeMonths), "Passed");
    assertSome(cites("Respond within three months.", threeMonths), "Passed");
    assertSome(cites("Respond within 45 days.", fortyFiveDays), "Passed");
    assertSome(cites("Respond within 3 days.", threeMonths), "Failed");
    assertSome(cites("Respond within 13 months.", threeMonths), "Failed");
    assertSome(cites("Respond within forty-five days.", fortyFiveDays), "Passed");
  });

  it("finds a period only as one phrase of its number and its unit word", () => {
    const periodOf = (amount: number, unit: "days" | "months") => DocketResponsePeriod.make({ amount, unit });
    const cites = (citedText: string, responsePeriod: DocketResponsePeriod) =>
      resultOf(
        entryOf({ citedText: O.some(citedText), mailDate: O.none(), responsePeriod: O.some(responsePeriod) }),
        source,
        "values-appear-in-cited-text"
      );
    const notice = "Mailed January 8, 2030. A response is due within 30 days.";

    assertSome(cites(notice, periodOf(8, "days")), "Failed");
    assertSome(cites(notice, periodOf(30, "days")), "Passed");
    assertSome(cites("Respond within thirty days.", periodOf(30, "days")), "Passed");
    assertSome(cites("A three-month period applies.", threeMonths), "Passed");
    assertSome(cites("RESPOND WITHIN THREE MONTHS.", threeMonths), "Passed");
    assertSome(cites("Respond within a month.", periodOf(1, "months")), "Failed");
    assertSome(cites("Respond within one month.", periodOf(1, "months")), "Passed");
    assertSome(cites("Due 8 January; extensions are counted in days.", periodOf(8, "days")), "Failed");
    assertSome(cites("Filed 3 monday.", periodOf(3, "days")), "Failed");
    assertSome(cites("Filed 3 yesterday.", periodOf(3, "days")), "Failed");
    assertSome(cites("Respond within 3 daysx.", periodOf(3, "days")), "Failed");
    assertSome(cites("Respond within twenty one days.", periodOf(21, "days")), "Passed");
  });

  it("fails a due date that is not mail plus period, and one before the mail date", () => {
    const wrongDue = LocalDate.make({ year: 2030, month: 4, day: 9 });
    const earlyDue = LocalDate.make({ year: 2030, month: 1, day: 2 });

    assertSome(resultOf(entryOf({ statedDueDate: O.some(wrongDue) }), source, "due-equals-mail-plus-period"), "Failed");
    assertSome(
      resultOf(
        entryOf({ statedDueDate: LocalDate.makeOption({ year: 2030, month: 4, day: 8 }) }),
        source,
        "due-equals-mail-plus-period"
      ),
      "Passed"
    );
    assertSome(
      resultOf(entryOf({ responsePeriod: O.none(), statedDueDate: O.some(earlyDue) }), source, "due-not-before-mail"),
      "Failed"
    );
    assertSome(resultOf(entryOf({ mailDate: O.none() }), source, "due-not-before-mail"), "Passed");
  });

  it("looks a citation up in the message, then in the document text, and leaves one it has no text for unknown", () => {
    const quoted = entryOf({
      citedText: O.some("Mailed January 8, 2030.\n\nThree months, per the attached fixture action."),
    });
    const withText = ReviewSourceText.make({
      documentText: O.some("three   months, per the attached fixture action."),
      hasDocuments: true,
      messageText: BODY,
    });
    const withoutText = ReviewSourceText.make({ hasDocuments: true, messageText: BODY });

    assertSome(resultOf(quoted, source, "cited-span-exists"), "Failed");
    assertSome(resultOf(quoted, withText, "cited-span-exists"), "Passed");
    assertSome(resultOf(quoted, withoutText, "cited-span-exists"), "Unknown");
    assertSome(resultOf(entryOf(), withoutText, "cited-span-exists"), "Passed");
    assertSome(resultOf(entryOf({ citedText: O.none() }), source, "cited-span-exists"), "Passed");
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
    assertNone(agreedOn(entryOf(), readingOf(), "stated-due-date"));
    assertSome(agreedOn(statedOnly, statedReading(statedDue), "stated-due-date"), true);
    assertSome(agreedOn(statedOnly, statedReading(statedDue), "due-date"), true);
    assertSome(agreedOn(statedOnly, statedReading(otherDue), "stated-due-date"), false);
    assertSome(agreedOn(statedOnly, statedReading(otherDue), "due-date"), false);
    assertSome(agreedOn(statedOnly, readingOf(), "stated-due-date"), false);
    expect(A.map(compareReadings(statedOnly, statedReading(statedDue)), (field) => field.field)).toStrictEqual([
      "classification",
      "stated-due-date",
      "due-date",
      "matter-references",
    ]);
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
    const statedDateOverArithmetic = O.map(criticDueDate(readingOf({ statedDueDate: O.some(stated) })), iso);
    assertSome(statedDateOverArithmetic, "2030-05-01");
    assertSome(O.map(criticComputedDueDate(readingOf({ statedDueDate: O.some(stated) })), iso), "2030-04-08");
    assertSome(O.map(criticDueDate(statedReading(statedDue)), iso), "2030-04-15");
    assertNone(criticComputedDueDate(statedReading(statedDue)));
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
    "accepts under the defaults with no disagreement, or with exactly one when at least four fields were compared",
    {
      compared: Arbitrary.schema(ComparedCount),
      findings: Arbitrary.schema(Findings),
      flags: Arbitrary.schema(SixFlags),
    },
    ({ compared, findings, flags }) => {
      const agreement = A.take(
        A.zipWith(ALL_COMPARED, flags, (field, agreed) => FieldAgreement.make({ agreed, field })),
        compared
      );
      const round = roundOf({
        agreement,
        findings,
        score: scoreRound(ReviewEvidence.make({ agreement, checks: [], findings })),
      });
      const hasMaterial = A.some(findings, (finding) => finding.severity === "P0" || finding.severity === "P1");
      const disagreements = A.length(A.filter(agreement, (field) => !field.agreed));
      const tolerated = disagreements === 0 || (disagreements === 1 && compared >= 4);
      const acceptable = !hasMaterial && tolerated;

      strictEqual(O.contains(decide({ round }), "accepted"), acceptable);
    },
    { arbitrary: fcRuns(300) }
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
      checks: A.map(DeterministicCheckName.literals, (check) =>
        DeterministicCheck.make({ check, result: DeterministicCheckFailed.make({}) })
      ),
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
    expect(A.map(disputes, (dispute) => A.length(dispute.reasons))).toStrictEqual([2, 1, 2, 2]);
    expect(
      A.map(
        reviewDisputes(
          roundOf({
            checks: [
              DeterministicCheck.make({
                check: "cited-span-exists",
                result: DeterministicCheckFailed.make({}),
                side: "critic",
              }),
            ],
          })
        ),
        (dispute) => dispute.field
      ),
      "a failed check on the critic's own citation disputes the due date, so its dates are read again"
    ).toStrictEqual(["due-date"]);
    expect(
      reviewDisputes(
        roundOf({
          checks: [DeterministicCheck.make({ check: "cited-span-exists", result: DeterministicCheckPassed.make({}) })],
        })
      )
    ).toStrictEqual([]);
    expect(rereadFields(disputes)).toStrictEqual(["mail-date", "matter-references", "stated-due-date"]);
    expect(rereadFields([ReviewDispute.make({ field: "title", reasons: ["Fixture."] })])).toStrictEqual([]);
  });

  it("merges a re-reading into the earlier reading field by field", () => {
    const previous = readingOf({ readFromSourceDocument: true });
    const reread = SecretaryReview.make({
      isDocketItem: false,
      mailDate: LocalDate.makeOption({ year: 2030, month: 1, day: 9 }),
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
    expect(
      mergeRereading(RereadMerge.make({ fields: ["stated-due-date"], previous, reread: statedReading(statedDue) })),
      "a disputed stated date takes the re-read date and the text cited for it, and nothing else"
    ).toStrictEqual(
      readingOf({
        citedText: O.some("Your response is due April 15, 2030."),
        notes: "Read the fixture notice.",
        readFromSourceDocument: false,
        statedDueDate: O.some(statedDue),
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

    expect([round.index, round.score, A.length(round.checks), A.length(round.agreement)]).toStrictEqual([2, 0.4, 6, 5]);
    assertTrue(reviewGatePassed(round.checks));
  });

  it("holds a critic that cites text to it, and lets one that cites nothing pass", () => {
    const passed = (reading: SecretaryReview, text: ReviewSourceText) =>
      A.map(runCriticChecks(reading, text), (check) => [check.side, check.check, isPassed(check)]);

    expect(passed(statedReading(statedDue), statedSource)).toStrictEqual([
      ["critic", "values-appear-in-cited-text", true],
      ["critic", "cited-span-exists", true],
    ]);
    expect(
      A.map(pipe(statedReading(otherDue), runCriticChecks(statedSource)), (check) => isPassed(check)),
      "the date it reports is not in the text it cites"
    ).toStrictEqual([false, true]);
    expect(
      A.map(runCriticChecks(statedReading(statedDue), source), (check) => isPassed(check)),
      "the text it cites is not in the source"
    ).toStrictEqual([true, false]);
    expect(A.map(runCriticChecks(readingOf(), source), (check) => isPassed(check))).toStrictEqual([true, true]);
  });

  it("accepts a stated-date-only item both sides read alike, and not one they read differently", () => {
    const assess = (reading: SecretaryReview) =>
      assessReviewRound(
        ReviewRoundDraft.make({ entry: statedOnly, findings: [], index: 1, reading, source: statedSource })
      );
    const same = assess(statedReading(statedDue));
    const different = assess(
      SecretaryReview.make({
        isDocketItem: true,
        matterReferences: ["FIX-0001"],
        notes: "Read the fixture notice.",
        statedDueDate: O.some(otherDue),
      })
    );

    expect([same.score, reviewGatePassed(same.checks)]).toStrictEqual([1, true]);
    assertSome(decide({ round: same }), "accepted");
    expect(
      [different.score, reviewGatePassed(different.checks)],
      "two of four fields disagree: the stated date and the due date it stands for"
    ).toStrictEqual([0.75, true]);
    assertSome(decide({ round: different }), "flagged-max-rounds");
  });

  it("raises a material finding when the source's stated date and its own mail date plus period differ", () => {
    const assess = (reading: SecretaryReview, findings: ReadonlyArray<ReviewFinding>) =>
      assessReviewRound(ReviewRoundDraft.make({ entry: entryOf(), findings, index: 2, reading, source })).findings;
    const inconsistent = readingOf({ statedDueDate: O.some(statedDue) });
    const consistent = readingOf({ statedDueDate: LocalDate.makeOption({ year: 2030, month: 4, day: 8 }) });
    const raised = assess(inconsistent, [minor]);

    expect(A.map(raised, (finding) => [finding.severity, finding.field])).toStrictEqual([
      ["P3", "title"],
      ["P1", "due-date"],
    ]);
    expect(assess(inconsistent, raised), "carried into the next round it is written once").toStrictEqual(raised);
    expect(assess(consistent, raised), "the finding goes when its cause does").toStrictEqual([minor]);
    expect(assess(readingOf(), [])).toStrictEqual([]);
  });
  it("adds a partial re-reading's citation to the earlier one, and replaces it after a full re-reading", () => {
    const PERIOD = "A response is due within THREE (3) months";
    const STATED = "Response due by April 8, 2030.";
    const MAILED = "Mailed   January 8, 2030.";
    const withStated = ReviewSourceText.make({ messageText: `${BODY}\n${STATED}` });
    const stated = LocalDate.makeOption({ year: 2030, month: 4, day: 8 });
    const previous = readingOf({ citedText: O.some(`${PERIOD}\n${STATED}`), statedDueDate: stated });
    const reread = SecretaryReview.make({
      citedText: O.some(`${MAILED}\n${STATED}`),
      isDocketItem: true,
      mailDate: O.some(mailDate),
      notes: "Re-read the mail date.",
      statedDueDate: stated,
    });
    const merged = (fields: ReadonlyArray<ReviewField>) =>
      mergeRereading(RereadMerge.make({ fields, previous, reread }));
    const partial = merged(["mail-date", "stated-due-date"]);

    assertSome(partial.citedText, `${PERIOD}\n${STATED}\n${MAILED}`);
    expect(
      A.map(runCriticChecks(partial, withStated), (check) => isPassed(check)),
      "the extractor's mail date was wrong and the rest agreed; the critic re-read and cited only mail and stated dates"
    ).toStrictEqual([true, true]);
    expect(
      A.map(runCriticChecks(readingOf({ citedText: reread.citedText, statedDueDate: stated }), withStated), (check) =>
        isPassed(check)
      ),
      "the period was kept from the earlier reading, so the re-read citation alone would not hold it"
    ).toStrictEqual([false, true]);
    assertSome(merged(["mail-date", "response-period", "stated-due-date"]).citedText, `${MAILED}\n${STATED}`);
    assertSome(merged(["due-date"]).citedText, `${MAILED}\n${STATED}`);
    assertNone(
      mergeRereading(
        RereadMerge.make({
          fields: ["mail-date"],
          previous: readingOf(),
          reread: SecretaryReview.make({ isDocketItem: true, notes: "No citation." }),
        })
      ).citedText
    );
  });

  it("checks the text the extractor quoted for each field and disputes that field when it fails", () => {
    const assess = (responses: ReadonlyArray<ExtractorFieldResponse>) =>
      assessReviewRound(
        ReviewRoundDraft.make({
          entry: entryOf(),
          extractorResponse: responses,
          findings: [],
          index: 2,
          reading: readingOf({ matterReferences: ["FIX-0001"] }),
          source,
        })
      );
    const quoted = (field: ReviewField, citedText: string) =>
      ExtractorFieldResponse.make({ action: "defended", citedText: O.some(citedText), field });
    const good = assess([
      quoted("mail-date", "Mailed January 8, 2030."),
      quoted("response-period", "A response is due within THREE (3) months"),
      quoted("due-date", "Mailed January 8, 2030.\nwithin three (3) months"),
      quoted("title", "Synthetic fixture notice"),
      quoted("classification", "A response is due"),
      quoted("matter-references", "FIX-0001"),
      quoted("source-document", "Synthetic fixture notice"),
      quoted("stated-due-date", "Mailed January 8, 2030."),
      ExtractorFieldResponse.make({ action: "revised", field: "stated-due-date" }),
    ]);
    const invented = assess([quoted("mail-date", "Mailed January 8, 2030, as invented.")]);
    const wrongValue = assess([quoted("response-period", "A shorter period of 45 days applies")]);
    const rows = (round: ReviewRound) =>
      A.flatMap(round.checks, (check) =>
        O.isSome(check.field) ? [[O.getOrElse(check.field, () => "none"), check.check, isPassed(check)]] : []
      );

    assertTrue(reviewGatePassed(good.checks));
    expect(A.length(rows(good))).toBe(16);
    expect(rows(invented)).toStrictEqual([
      ["mail-date", "values-appear-in-cited-text", true],
      ["mail-date", "cited-span-exists", false],
    ]);
    expect(rows(wrongValue)).toStrictEqual([
      ["response-period", "values-appear-in-cited-text", false],
      ["response-period", "cited-span-exists", true],
    ]);
    assertTrue(!reviewGatePassed(invented.checks));
    expect(A.map(reviewDisputes(invented), (dispute) => [dispute.field, dispute.reasons])).toStrictEqual([
      ["mail-date", ["The text you quoted for this field was not found in the message."]],
    ]);
    expect(A.map(reviewDisputes(wrongValue), (dispute) => [dispute.field, dispute.reasons])).toStrictEqual([
      ["response-period", ["The value of this field does not appear in the text you quoted for it."]],
    ]);
  });

  it.effect("refuses to write a check back in the docket-check/v1 form", () =>
    Effect.gen(function* () {
      const [, fromV1] = StoredDeterministicCheck.members;
      const historical = yield* S.decodeEffect(fromV1)({ check: "cited-span-exists", passed: true });
      strictEqual(historical.provenance, "docket-check/v1");
      const refusal = yield* Effect.flip(S.encodeEffect(fromV1)(historical));
      expect(Str.includes("docket-check/v1 is read only")(refusal.message)).toBe(true);
    })
  );
});

const docketChecksV1Json = S.fromJsonString(S.Array(StoredDeterministicCheck), { space: 2 });

it.layer(Layer.merge(NodeFileSystem.layer, Digest.layerWebCrypto), {
  timeout: "10 seconds",
  excludeTestServices: true,
})("P4 frozen formats", (it) => {
  it.effect("P4 format freeze: docket-checks-v1.json keeps its raw digest and reads only as history", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* fs.realPath(".");
      const fixturePath = yield* fs.realPath("test/fixtures/docket-checks-v1.json");
      expect(fixturePath).toBe(`${fixtureRoot}/test/fixtures/docket-checks-v1.json`);
      const text = yield* fs.readFileString(fixturePath);
      const digest = yield* Digest.Digest;
      const rawDigest = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(text));
      expect(rawDigest).toBe("55f1f403e941d40e483327be62b5eb33180e32d369ab12ba18e5f4373a3bd01e");
      const rows = yield* S.decodeEffect(docketChecksV1Json)(text);
      expect(A.map(rows, (row) => [row.check, row.provenance, row.result._tag, row.side])).toStrictEqual([
        ["cited-span-exists", "docket-check/v1", "Passed", "extractor"],
        ["cited-span-exists", "docket-check/v1", "Failed", "extractor"],
      ]);
      assertTrue(!reviewGatePassed(A.take(rows, 1)));
      const reencoded = yield* S.encodeEffect(docketChecksV1Json)(rows);
      expect(Str.includes('"passed"')(reencoded)).toBe(false);
      expect(Str.includes('"provenance": "docket-check/v1"')(reencoded)).toBe(true);
    })
  );
});

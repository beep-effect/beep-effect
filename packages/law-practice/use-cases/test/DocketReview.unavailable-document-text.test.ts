/**
 * Acceptance proofs of the three-valued docket check when an attached
 * document's text is unavailable: extractor, critic and quoted-field
 * citations, a disproved citation, a message-only match, urgent tentative
 * routing and a mixed round. Every fixture is synthetic.
 */

import { DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  assessReviewRound,
  DeterministicCheck,
  DeterministicCheckFailed,
  DeterministicCheckPassed,
  DeterministicCheckUnknown,
  DocketReviewConfig,
  ExtractorFieldResponse,
  ParalegalDocketEntry,
  ReviewDecisionInput,
  ReviewRound,
  ReviewRoundDraft,
  ReviewRoundTrace,
  ReviewSourceText,
  reviewDisputes,
  reviewGatePassed,
  runCriticChecks,
  runDeterministicChecks,
  SecretaryReview,
  StoredDeterministicCheck,
  terminalStatus,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { DeterministicCheckName } from "@beep/law-practice-use-cases/DocketIntake";

const BODY = "Synthetic fixture notice for FIX-0001.\nMailed January 8, 2030.";
const ATTACHED_ONLY = "A response is due within three (3) months";

const unavailable = ReviewSourceText.make({ hasDocuments: true, messageText: BODY });
const available = ReviewSourceText.make({
  documentText: O.some("The attached synthetic action has no period."),
  hasDocuments: true,
  messageText: BODY,
});
const mailDate = LocalDate.make({ year: 2030, month: 1, day: 8 });
const threeMonths = DocketResponsePeriod.make({ amount: 3, unit: "months" });

const entryCiting = (citedText: string) =>
  ParalegalDocketEntry.make({
    citedText: O.some(citedText),
    mailDate: O.some(mailDate),
    matterReferences: ["FIX-0001"],
    rationale: "States a response period.",
    responsePeriod: O.some(threeMonths),
    title: "Due Date: fixture response",
  });

const readingCiting = (citedText: string) =>
  SecretaryReview.make({
    citedText: O.some(citedText),
    isDocketItem: true,
    mailDate: O.some(mailDate),
    matterReferences: ["FIX-0001"],
    notes: "Read the fixture notice.",
    responsePeriod: O.some(threeMonths),
  });

const citedSpanOf = (checks: ReadonlyArray<DeterministicCheck>) =>
  O.map(
    A.findFirst(checks, ({ check }) => check === "cited-span-exists"),
    ({ result }) => result
  );

const reasonsOf = (round: ReviewRound) =>
  A.map(reviewDisputes(round), (dispute) => [dispute.field, dispute.reasons] as const);

const roundWith = (checks: ReadonlyArray<DeterministicCheck>) =>
  ReviewRound.make({
    agreement: [],
    checks,
    entry: entryCiting(`Mailed January 8, 2030.\n${ATTACHED_ONLY}`),
    findings: [],
    index: 1,
    reading: readingCiting("Mailed January 8, 2030."),
    score: UnitInterval.make(1),
  });

const check = (name: DeterministicCheckName, result: DeterministicCheck["result"], side: "critic" | "extractor") =>
  DeterministicCheck.make({ check: name, result, side });

const UNKNOWN = DeterministicCheckUnknown.make({ reason: "document-text-unavailable" });

describe("@beep/law-practice-use-cases docket checks with unavailable document text", () => {
  it("leaves an extractor citation missing from the message unknown, never failed", () => {
    const checks = runDeterministicChecks(entryCiting(`Mailed January 8, 2030.\n${ATTACHED_ONLY}`), unavailable);
    assertSome(citedSpanOf(checks), UNKNOWN);
    assertTrue(!reviewGatePassed(checks));
    expect(reasonsOf(roundWith(checks))).toStrictEqual([
      [
        "source-document",
        [
          "The text you cited was not found in the message, and the attached document's text could not be read to confirm it.",
        ],
      ],
    ]);
  });

  it("leaves a critic citation missing from the message unknown and asks for the dates again", () => {
    const checks = runCriticChecks(readingCiting(`Mailed January 8, 2030.\n${ATTACHED_ONLY}`), unavailable);
    assertSome(citedSpanOf(checks), UNKNOWN);
    expect(reasonsOf(roundWith(checks))).toStrictEqual([
      [
        "due-date",
        [
          "The reviewer's own citation was not found in the message and the attached document's text could not be read to confirm it, so the dates are read again.",
        ],
      ],
    ]);
  });

  it("leaves the text quoted for a disputed field unknown on that field", () => {
    const round = assessReviewRound(
      ReviewRoundDraft.make({
        entry: entryCiting("Mailed January 8, 2030.\nA response is due within three (3) months"),
        extractorResponse: [
          ExtractorFieldResponse.make({
            action: "defended",
            citedText: O.some(ATTACHED_ONLY),
            field: "response-period",
          }),
        ],
        findings: [],
        index: 2,
        reading: readingCiting("Mailed January 8, 2030."),
        source: unavailable,
      })
    );
    const quoted = A.filter(round.checks, ({ field }) => O.isSome(field));
    expect(A.map(quoted, ({ check: name, result }) => [name, result._tag])).toStrictEqual([
      ["values-appear-in-cited-text", "Passed"],
      ["cited-span-exists", "Unknown"],
    ]);
    expect(A.filter(reasonsOf(round), ([field]) => field === "response-period")).toStrictEqual([
      [
        "response-period",
        [
          "The text you quoted for this field was not found in the message, and the attached document's text could not be read to confirm it.",
        ],
      ],
    ]);
  });

  it("fails a citation that is in none of the text when all of it is available", () => {
    const checks = runDeterministicChecks(entryCiting(`Mailed January 8, 2030.\n${ATTACHED_ONLY}`), available);
    assertSome(citedSpanOf(checks), DeterministicCheckFailed.make({}));
    expect(reasonsOf(roundWith(checks))).toStrictEqual([
      ["source-document", ["The text you cited was not found in the message."]],
    ]);
  });

  it("passes a citation the message proves even though the attachment is unreadable", () => {
    const entry = ParalegalDocketEntry.make({
      citedText: O.some("Mailed January 8, 2030."),
      mailDate: O.some(mailDate),
      matterReferences: ["FIX-0001"],
      rationale: "States the mail date.",
      title: "Due Date: fixture response",
    });
    const checks = runDeterministicChecks(entry, unavailable);
    assertSome(citedSpanOf(checks), DeterministicCheckPassed.make({}));
    assertTrue(reviewGatePassed(checks));
  });

  it.effect("routes an unknown gate on the last round to the tentative needs-review entry and keeps the reason", () =>
    Effect.gen(function* () {
      const checks = runDeterministicChecks(entryCiting(`Mailed January 8, 2030.\n${ATTACHED_ONLY}`), unavailable);
      const decided = terminalStatus(
        ReviewDecisionInput.make({
          config: DocketReviewConfig.make({ maxRounds: 1 }),
          gatePassed: reviewGatePassed(checks),
          isLastRound: true,
          round: roundWith(checks),
        })
      );
      assertSome(decided, "deterministic-failure");
      const trace = ReviewRoundTrace.make({
        criticDocketItem: true,
        extractorDocketItem: true,
        failedChecks: A.filter(checks, ({ result }) => result._tag !== "Passed"),
        findings: [],
        gatePassed: reviewGatePassed(checks),
        index: 1,
        score: UnitInterval.make(1),
      });
      const stored = yield* S.encodeEffect(ReviewRoundTrace)(trace);
      const reread = yield* S.decodeEffect(ReviewRoundTrace)(stored);
      expect(A.map(reread.failedChecks, ({ check: name, result }) => [name, result])).toStrictEqual([
        ["cited-span-exists", UNKNOWN],
      ]);
      expect(reread.gatePassed).toBe(false);
    })
  );

  it("keeps passed, failed and unknown results apart in a mixed round", () => {
    const round = roundWith([
      check("due-equals-mail-plus-period", DeterministicCheckPassed.make({}), "extractor"),
      check("values-appear-in-cited-text", DeterministicCheckFailed.make({}), "extractor"),
      check("cited-span-exists", UNKNOWN, "extractor"),
      check("cited-span-exists", DeterministicCheckFailed.make({}), "critic"),
    ]);
    assertTrue(!reviewGatePassed(round.checks));
    expect(reasonsOf(round)).toStrictEqual([
      [
        "source-document",
        [
          "A date or period you reported does not appear in the text you cited.",
          "The text you cited was not found in the message, and the attached document's text could not be read to confirm it.",
        ],
      ],
      [
        "due-date",
        ["The reviewer's own reading could not be checked against the text it cited, so the dates are read again."],
      ],
    ]);
  });

  it.effect("never lets a stored historical Boolean pass the gate", () =>
    Effect.gen(function* () {
      const historical = yield* S.decodeEffect(StoredDeterministicCheck)({
        check: "cited-span-exists",
        field: "mail-date",
        passed: true,
        side: "critic",
      });
      strictEqual(historical.provenance, "docket-check/v1");
      strictEqual(historical.result._tag, "Passed");
      strictEqual(historical.side, "critic");
      assertSome(historical.field, "mail-date");
      assertTrue(!reviewGatePassed([historical]));
      const current = yield* S.encodeEffect(StoredDeterministicCheck)(historical);
      expect(current).toStrictEqual({
        check: "cited-span-exists",
        field: "mail-date",
        provenance: "docket-check/v1",
        result: { _tag: "Passed" },
        side: "critic",
      });
      const [, fromV1] = StoredDeterministicCheck.members;
      const rewritten = yield* S.encodeEffect(fromV1)(historical).pipe(Effect.exit);
      rewritten.pipe(Exit.isFailure, assertTrue);
    })
  );
});

describe("three-valued docket check properties", () => {
  const json = S.fromJsonString(StoredDeterministicCheck);
  const equivalent = S.toEquivalence(StoredDeterministicCheck);
  it.effect.prop(
    "every generated stored check survives its JSON codec unchanged",
    [Arbitrary.schema(StoredDeterministicCheck)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(json)(value);
        const decoded = yield* S.decodeEffect(json)(encoded);
        assertTrue(equivalent(decoded, value));
      }),
    { arbitrary: fcRuns(50) }
  );
});

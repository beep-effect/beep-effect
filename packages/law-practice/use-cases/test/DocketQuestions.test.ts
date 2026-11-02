/**
 * Docket intake as the first question producer: one question per
 * needs-review reason, none for settled outcomes. Every message id, date and
 * docket here is synthetic.
 */

import { TestCrypto } from "@beep/law-practice-domain/test";
import { DocketDueDate } from "@beep/law-practice-domain/values/DocketDeadline";
import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import {
  DocketCandidateDate,
  DocketEntered,
  DocketNeedsReview,
  DocketNeedsReviewReason,
  DocketQuestionEmail,
  DocketQuestionInput,
  DocketQuestionItemId,
  DocketQuestions,
  DocketQuestionsLive,
  DocketWrittenEntry,
  docketQuestionDigest,
  docketQuestionNamesEmail,
  IntakeFailed,
  NotDocketItem,
  withDocketQuestionEmail,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DocketCandidateDateSource } from "@beep/law-practice-use-cases/DocketIntake";

const NEEDS_REVIEW_EVENT = "evt-needs-review-1";
const day = (month: number, dayOfMonth: number) => LocalDate.make({ year: 2026, month, day: dayOfMonth });
const candidate = (date: LocalDate, source: DocketCandidateDateSource) => DocketCandidateDate.make({ date, source });

const needsReview = (reason: DocketNeedsReviewReason, messageId = "AAMkAGsynthetic-message-1=") =>
  DocketNeedsReview.make({
    entry: DocketWrittenEntry.make({ eventId: NEEDS_REVIEW_EVENT }),
    flags: ["matter-suggested", "dates-differ"],
    messageId,
    reason,
  });

// The email a synthetic needs-review message is about.
const SUBJECT = "Office action response";
const SENDER = "examiner@example.com";
const MESSAGE_LINK = "https://outlook.example.com/mail/AAMkAGsynthetic-message-1";
const ENTRY_LINK = "https://outlook.example.com/calendar/evt-needs-review-1";

const identified = (outcome: DocketNeedsReview) =>
  DocketQuestionInput.make({
    outcome,
    entryLink: O.some(ENTRY_LINK),
    matter: O.some("family 0000.00001 · dockets 90001US01"),
    messageLink: O.some(MESSAGE_LINK),
    receivedDate: O.some(day(10, 20)),
    sender: O.some(SENDER),
    subject: O.some(SUBJECT),
  });

const factTexts = (question: { readonly facts: ReadonlyArray<{ readonly text: string }> }) =>
  A.map(question.facts, ({ text }) => text);

const optionIds = (question: { readonly options: ReadonlyArray<{ readonly optionId: string }> }) =>
  A.map(question.options, ({ optionId }) => optionId);

const decodeItemId = S.decodeUnknownOption(DocketQuestionItemId);

const encodeQuestion = S.encodeEffect(ReviewItem);
const decodeQuestion = S.decodeEffect(ReviewItem);

const raise = Effect.fnUntraced(function* (input: DocketQuestionInput) {
  return yield* (yield* DocketQuestions).raise(input);
});

describe("@beep/law-practice-use-cases docket questions", () => {
  it.layer(DocketQuestionsLive.pipe(Layer.provideMerge(TestCrypto)), { timeout: "10 seconds" })("producer", (it) => {
    it.effect(
      "raises one valid question per needs-review reason, with a stable id",
      Effect.fnUntraced(function* () {
        const questions = yield* Effect.forEach(DocketNeedsReviewReason.literals, (reason) =>
          Effect.flatMap(raise(DocketQuestionInput.make({ outcome: needsReview(reason) })), (question) =>
            Effect.fromOption(question)
          )
        );
        const again = yield* raise(DocketQuestionInput.make({ outcome: needsReview("agents-disagree") }));

        expect(A.map(questions, ({ itemId }) => Str.replace(/:[0-9a-f]{32}$/u, "")(itemId))).toStrictEqual(
          A.map(DocketNeedsReviewReason.literals, (reason) => `docket-intake:${reason}`)
        );
        const agentsDisagree = yield* Effect.fromOption(A.get(questions, 2));
        assertSome(
          O.map(again, ({ itemId }) => itemId),
          agentsDisagree.itemId
        );
        expect(A.dedupe(A.map(questions, ({ text }) => text))).toHaveLength(DocketNeedsReviewReason.literals.length);
        for (const question of questions) {
          expect(question.options.length).toBeGreaterThanOrEqual(2);
          expect(question.options.length).toBeLessThanOrEqual(5);
          assertTrue(A.some(question.options, ({ write }) => O.isNone(write)));
          expect(yield* decodeQuestion(yield* encodeQuestion(question))).toStrictEqual(question);
        }
      })
    );

    it.effect(
      "names the email in every reason's question and states each matter flag",
      Effect.fnUntraced(function* () {
        const questions = yield* Effect.forEach(DocketNeedsReviewReason.literals, (reason) =>
          Effect.flatMap(
            raise(
              identified(
                DocketNeedsReview.make({
                  entry: DocketWrittenEntry.make({ eventId: NEEDS_REVIEW_EVENT }),
                  flags: ["matter-not-found", "matter-lookup-failed"],
                  messageId: "AAMkAGsynthetic-message-1=",
                  reason,
                })
              )
            ),
            Effect.fromOption
          )
        );

        for (const question of questions) {
          assertTrue(Str.includes(`the email "${SUBJECT}"`)(question.text));
          expect(factTexts(question)).toEqual(
            expect.arrayContaining(["No matter matches the message.", "The matter lookup failed."])
          );
        }
      })
    );

    it.effect(
      "offers one calendar option per distinct candidate date, earliest first",
      Effect.fnUntraced(function* () {
        const question = yield* Effect.fromOption(
          yield* raise(
            DocketQuestionInput.make({
              outcome: needsReview("agents-disagree"),
              candidateDates: [
                candidate(day(11, 4), "reviewer"),
                candidate(day(11, 2), "extractor"),
                candidate(day(11, 2), "stated"),
              ],
              conversationId: O.some("AAQkADsynthetic-thread"),
              docket: O.some("90001US01"),
              title: O.some("Response to office action"),
            })
          )
        );

        expect(A.map(question.options, ({ optionId }) => optionId)).toStrictEqual([
          "use-2026-11-02",
          "use-2026-11-04",
          "handle-myself",
          "not-a-deadline",
        ]);
        assertSome(
          O.flatMap(A.head(question.options), ({ write }) => O.flatMap(write, ({ eventId }) => eventId)),
          NEEDS_REVIEW_EVENT
        );
        // A chosen date gives the entry the item's title, not a generic one.
        expect(A.map(A.getSomes(A.map(question.options, ({ write }) => write)), ({ title }) => title)).toStrictEqual([
          "Response to office action",
          "Response to office action",
        ]);
        assertSome(question.docket, "90001US01");
        assertSome(question.conversationId, "AAQkADsynthetic-thread");
        expect(A.map(question.facts, ({ text }) => text)).toStrictEqual([
          "The message is on the calendar as a needs-review entry.",
          "The matter was suggested, not matched exactly.",
          "The date the message states and the date computed from it differ.",
          "The first reader found November 2, 2026.",
          "The message states November 2, 2026.",
          "The second reader found November 4, 2026.",
        ]);
      })
    );

    it.effect(
      "keeps at most five options, dropping the latest dates",
      Effect.fnUntraced(function* () {
        const question = yield* Effect.fromOption(
          yield* raise(
            DocketQuestionInput.make({
              outcome: needsReview("flagged-low-confidence"),
              candidateDates: A.map([20, 4, 12, 2, 9], (dayOfMonth) => candidate(day(11, dayOfMonth), "tracked")),
            })
          )
        );

        expect(A.map(question.options, ({ optionId }) => optionId)).toStrictEqual([
          "use-2026-11-02",
          "use-2026-11-04",
          "use-2026-11-09",
          "handle-myself",
          "not-a-deadline",
        ]);
        expect(question.facts).toHaveLength(8);
      })
    );

    it.effect(
      "names the email it is about and links it, without changing the item id or the options",
      Effect.fnUntraced(function* () {
        const outcome = needsReview("agents-disagree");
        const plain = yield* Effect.fromOption(yield* raise(DocketQuestionInput.make({ outcome })));
        const named = yield* Effect.fromOption(yield* raise(identified(outcome)));

        expect(named.itemId).toBe(plain.itemId);
        expect(optionIds(named)).toStrictEqual(optionIds(plain));
        expect(named.text).toBe(
          `The two readers of the email "${SUBJECT}" found different deadlines. Which date is right?`
        );
        expect(factTexts(named)).toStrictEqual([
          `The email is "${SUBJECT}" from ${SENDER}, received October 20, 2026.`,
          `Open the email in Outlook: ${MESSAGE_LINK}`,
          `Its needs-review calendar entry: ${ENTRY_LINK}`,
          "Matter: family 0000.00001 · dockets 90001US01",
          "The matter was suggested, not matched exactly.",
          "The date the message states and the date computed from it differ.",
        ]);
        expect(named.sourceRefs).toStrictEqual([]);
        assertTrue(docketQuestionNamesEmail(named));
        assertTrue(!docketQuestionNamesEmail(plain));
        expect(yield* decodeQuestion(yield* encodeQuestion(named))).toStrictEqual(named);
      })
    );

    it.effect(
      "leaves out the parts of the email it does not know",
      Effect.fnUntraced(function* () {
        const outcome = needsReview("no-usable-date");
        const dated = yield* Effect.fromOption(
          yield* raise(DocketQuestionInput.make({ outcome, receivedDate: O.some(day(10, 20)) }))
        );
        const fromOnly = yield* Effect.fromOption(
          yield* raise(DocketQuestionInput.make({ outcome, sender: O.some(SENDER) }))
        );
        const subjectOnly = yield* Effect.fromOption(
          yield* raise(DocketQuestionInput.make({ outcome, subject: O.some(`  ${SUBJECT}\n  (second notice) `) }))
        );

        expect(A.take(factTexts(dated), 2)).toStrictEqual([
          "The email was received October 20, 2026.",
          "The message is on the calendar as a needs-review entry.",
        ]);
        expect(dated.text).toBe("Docket intake found no date it could use in a message. What is the deadline?");
        expect(A.take(factTexts(fromOnly), 1)).toStrictEqual([`The email is from ${SENDER}.`]);
        expect(A.take(factTexts(subjectOnly), 1)).toStrictEqual([`The email is "${SUBJECT} (second notice)".`]);
        expect(subjectOnly.text).toBe(
          `Docket intake found no date it could use in the email "${SUBJECT} (second notice)". What is the deadline?`
        );
      })
    );

    it.effect(
      "treats a subject or sender of only whitespace as unknown",
      Effect.fnUntraced(function* () {
        const outcome = needsReview("no-usable-date");
        const plain = yield* Effect.fromOption(yield* raise(DocketQuestionInput.make({ outcome })));
        const blank = yield* Effect.fromOption(
          yield* raise(
            DocketQuestionInput.make({
              outcome,
              receivedDate: O.some(day(10, 20)),
              sender: O.some(" \n "),
              subject: O.some("   "),
            })
          )
        );
        const backfilled = withDocketQuestionEmail(
          plain,
          DocketQuestionEmail.make({ messageLink: O.some("  "), sender: O.some("\t"), subject: O.some("  ") })
        );

        expect(A.take(factTexts(blank), 1)).toStrictEqual(["The email was received October 20, 2026."]);
        expect(blank.text).toBe(plain.text);
        expect(backfilled).toStrictEqual(plain);
        assertTrue(!docketQuestionNamesEmail(backfilled));
      })
    );

    it.effect(
      "names the email of a stored question once, keeping its id, options and other facts",
      Effect.fnUntraced(function* () {
        const stored = yield* Effect.fromOption(
          yield* raise(
            DocketQuestionInput.make({
              outcome: needsReview("flagged-low-confidence"),
              candidateDates: [candidate(day(11, 2), "extractor")],
            })
          )
        );
        const email = DocketQuestionEmail.make({
          messageLink: O.some(MESSAGE_LINK),
          receivedDate: O.some(day(10, 20)),
          sender: O.some(SENDER),
          subject: O.some(SUBJECT),
        });
        const named = withDocketQuestionEmail(stored, email);

        expect(named.itemId).toBe(stored.itemId);
        expect(named.options).toStrictEqual(stored.options);
        expect(factTexts(named)).toStrictEqual([
          `The email is "${SUBJECT}" from ${SENDER}, received October 20, 2026.`,
          `Open the email in Outlook: ${MESSAGE_LINK}`,
          ...factTexts(stored),
        ]);
        expect(named.text).toBe(
          `Docket intake is not confident about the deadline in the email "${SUBJECT}". Which date is right?`
        );
        expect(withDocketQuestionEmail(email)(named)).toStrictEqual(named);
      })
    );

    it.effect(
      "pins a question's id to the first 32 hex digits of its message id's SHA-256",
      Effect.fnUntraced(function* () {
        // `printf '%s' 'AAMkAGsynthetic-message-1=' | sha256sum`, cut to 32 digits. Changing the hash, its
        // encoding or its length would re-key every stored docket question.
        const golden = "eb740d95d0e01389172d8c72ac30e815";
        const question = yield* Effect.fromOption(
          yield* raise(DocketQuestionInput.make({ outcome: needsReview("no-usable-date") }))
        );

        expect(question.itemId).toBe(`docket-intake:no-usable-date:${golden}`);
        expect(yield* docketQuestionDigest("AAMkAGsynthetic-message-1=")).toBe(golden);
      })
    );

    it.effect(
      "parses the reason and the message digest out of a question id",
      Effect.fnUntraced(function* () {
        const messageId = "AAMkAGsynthetic-message-9=";
        const question = yield* Effect.fromOption(
          yield* raise(DocketQuestionInput.make({ outcome: needsReview("due-date-past", messageId) }))
        );
        const digest = yield* docketQuestionDigest(messageId);

        assertSome(decodeItemId(question.itemId), ["docket-intake:", "due-date-past", ":", digest]);
        assertNone(decodeItemId("docket-intake:due-date-past:not-a-digest"));
        assertNone(decodeItemId(`kg-answer:due-date-past:${digest}`));
      })
    );

    it.effect(
      "raises nothing for settled, non-docket and failed outcomes, and separates messages and reasons",
      Effect.fnUntraced(function* () {
        const date = day(11, 2);
        const settled = DocketEntered.make({
          dueDate: DocketDueDate.make({ basis: "stated", computed: O.none(), date, stated: O.some(date) }),
          entry: DocketWrittenEntry.make({ eventId: "evt-due-1" }),
          flags: [],
          messageId: "AAMkAGsynthetic-message-1=",
          reminders: [],
        });
        for (const outcome of [
          settled,
          NotDocketItem.make({ messageId: "AAMkAGsynthetic-message-2=" }),
          IntakeFailed.make({ messageId: "AAMkAGsynthetic-message-3=", stage: "review" }),
        ]) {
          assertNone(yield* raise(DocketQuestionInput.make({ outcome })));
        }

        const ids = yield* Effect.forEach(
          [
            needsReview("no-usable-date", "AAMkAGsynthetic-message-1="),
            needsReview("no-usable-date", "AAMkAGsynthetic-message-2="),
            needsReview("due-date-past", "AAMkAGsynthetic-message-1="),
          ],
          (outcome) =>
            Effect.map(
              raise(DocketQuestionInput.make({ outcome })),
              O.map(({ itemId }) => itemId)
            )
        );
        expect(A.dedupe(A.getSomes(ids))).toHaveLength(3);
      })
    );
  });
});

describe("@beep/law-practice-use-cases docket question email properties", () => {
  it.effect.prop(
    "round-trips schema-derived question emails",
    { email: Arbitrary.schema(DocketQuestionEmail) },
    ({ email }) =>
      Effect.gen(function* () {
        const decoded = yield* S.decodeEffect(DocketQuestionEmail)(yield* S.encodeEffect(DocketQuestionEmail)(email));
        expect(S.toEquivalence(DocketQuestionEmail)(decoded, email)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );
});

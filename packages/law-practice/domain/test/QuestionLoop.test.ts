import { AnswerRow, AnswerState } from "@beep/law-practice-domain/values/AnswerRow";
import {
  OptionWrite,
  QuestionFact,
  QuestionOption,
  QuestionOptionId,
  QuestionOptions,
} from "@beep/law-practice-domain/values/Question";
import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

// Synthetic question and answers; no matter, client or person is named.
const sourceRef = { boxFileId: "1234567890", page: 1, quote: { exact: "mailed on August 2, 2026" } };

const keepDate = { optionId: "keep-date", label: "Keep the current response date" };
const moveDate = {
  optionId: "move-to-2026-11-02",
  label: "Move the response date to November 2",
  write: { kind: "calendar-date", title: "Response due", dueOn: "2026-11-02", eventId: "evt-0001" },
};
const askClient = { optionId: "ask-client", label: "Ask the client first" };

const encodedQuestion = {
  kind: "question",
  itemId: "question:docket-intake:1",
  text: "Is the response date November 2 or October 2?",
  sourceRefs: [sourceRef],
  facts: [{ text: "The office action was mailed on 2026-08-02.", sourceRefs: [sourceRef] }],
  options: [keepDate, moveDate, askClient],
  docket: "90001US01",
  conversationId: "AAQkADAwATM0MDAAMS1iNWU",
};

const optionOf = (index: number) => ({ optionId: `option-${index}`, label: `Option ${index}` });
const questionWith = (options: ReadonlyArray<unknown>) => ({ ...encodedQuestion, options });

const itemId = "question:docket-intake:1";
const decidedAnswer = { state: "decided", itemId, revision: 1, recordedAt: 1_760_400_000_000, optionId: "keep-date" };
const pendingAnswer = {
  state: "pending-on-client",
  itemId,
  revision: 2,
  recordedAt: 1_760_400_060_000,
  resurfaceOn: "2026-11-02",
  note: "Waiting on the client's instructions.",
};
const keepRemindingAnswer = { state: "keep-reminding", itemId, revision: 3, recordedAt: 1_760_400_120_000 };
const withdrawnAnswer = { state: "withdrawn", itemId, revision: 4, recordedAt: 1_760_400_180_000 };
const encodedAnswers = [decidedAnswer, pendingAnswer, keepRemindingAnswer, withdrawnAnswer];

const rejects =
  <A, I>(schema: S.Codec<A, I>) =>
  (input: unknown) =>
    Effect.map(Effect.flip(S.decodeUnknownEffect(schema)(input)), ({ _tag }) => _tag);

const roundTrips = Effect.fn("roundTrips")(function* <A, I>(schema: S.Codec<A, I>, input: unknown) {
  const decoded = yield* S.decodeUnknownEffect(schema)(input);
  const value1 = yield* S.encodeEffect(schema)(decoded);
  expect(value1).toStrictEqual(input);
  return decoded;
});

describe("@beep/law-practice-domain question ReviewItem", () => {
  it.effect(
    "decodes and round-trips a question with facts, three options, a docket and a conversation",
    Effect.fnUntraced(function* () {
      const item = yield* roundTrips(ReviewItem, encodedQuestion);

      assertTrue(ReviewItem.guards.question(item));
      if (ReviewItem.guards.question(item)) {
        expect(A.map(item.options, ({ optionId }) => optionId)).toStrictEqual([
          "keep-date",
          "move-to-2026-11-02",
          "ask-client",
        ]);
        expect(item.facts[0]?.sourceRefs).toHaveLength(1);
        assertSome(item.docket, "90001US01");
        assertSome(item.conversationId, "AAQkADAwATM0MDAAMS1iNWU");
      }
    })
  );

  it.effect(
    "defaults the docket and conversation to none",
    Effect.fnUntraced(function* () {
      const { docket: _docket, conversationId: _conversationId, ...bare } = encodedQuestion;
      yield* roundTrips(ReviewItem, bare);
    })
  );

  it.effect(
    "rejects bad option lists and option writes",
    Effect.fnUntraced(function* () {
      const item = rejects(ReviewItem);
      const results = yield* Effect.all([
        item(questionWith([keepDate])),
        item(questionWith(A.map(A.range(1, 6), optionOf))),
        item(questionWith([keepDate, { ...askClient, optionId: "keep-date" }])),
        item(questionWith([keepDate, { ...askClient, optionId: "Ask Client" }])),
        item(questionWith([keepDate, { ...moveDate, write: { ...moveDate.write, kind: "docket-entry" } }])),
        item(questionWith([keepDate, { ...moveDate, write: { ...moveDate.write, dueOn: "2026-02-30" } }])),
        item({ ...encodedQuestion, options: undefined }),
      ]);

      expect(results).toStrictEqual(A.replicate("SchemaError", results.length));
    })
  );

  it.effect(
    "accepts the boundary counts of two and five options",
    Effect.fnUntraced(function* () {
      yield* roundTrips(QuestionOptions, A.map(A.range(1, 2), optionOf));
      yield* roundTrips(QuestionOptions, A.map(A.range(1, 5), optionOf));
    })
  );
});

describe("@beep/law-practice-domain AnswerRow", () => {
  it.effect(
    "decodes and round-trips every answer state",
    Effect.fnUntraced(function* () {
      const rows = yield* Effect.forEach(encodedAnswers, (row) => roundTrips(AnswerRow, row));

      expect(A.map(rows, ({ state }) => state)).toStrictEqual(AnswerState.literals);
      const [decided, pending] = rows;
      assertTrue(decided !== undefined && AnswerRow.guards.decided(decided) && decided.optionId === "keep-date");
      assertTrue(
        pending !== undefined &&
          AnswerRow.guards["pending-on-client"](pending) &&
          pending.resurfaceOn.toISOString() === "2026-11-02"
      );
    })
  );

  it.effect(
    "requires each state's own field and rejects unknown states",
    Effect.fnUntraced(function* () {
      const answer = rejects(AnswerRow);
      const { optionId: _optionId, ...decidedWithoutOption } = decidedAnswer;
      const { resurfaceOn: _resurfaceOn, ...pendingWithoutDate } = pendingAnswer;
      const results = yield* Effect.all([
        answer(decidedWithoutOption),
        answer(pendingWithoutDate),
        answer({ ...pendingAnswer, resurfaceOn: "2026-02-30" }),
        answer({ ...decidedAnswer, optionId: "Keep Date" }),
        answer({ ...keepRemindingAnswer, state: "snoozed" }),
        answer({ ...keepRemindingAnswer, revision: 0 }),
        answer({ ...keepRemindingAnswer, note: "" }),
      ]);

      expect(results).toStrictEqual(A.replicate("SchemaError", results.length));
    })
  );
});

describe("@beep/law-practice-domain question schema round-trips", () => {
  it.effect(
    "round-trips each question value on fixed examples",
    Effect.fnUntraced(function* () {
      yield* roundTrips(QuestionOptionId, "move-to-2026-11-02");
      yield* roundTrips(OptionWrite, moveDate.write);
      yield* roundTrips(QuestionOption, moveDate);
      yield* roundTrips(QuestionOption, keepDate);
      yield* roundTrips(QuestionOptions, encodedQuestion.options);
      yield* roundTrips(QuestionFact, encodedQuestion.facts[0]);
      yield* roundTrips(AnswerState, "pending-on-client");
    })
  );

  it.effect.prop(
    "round-trips schema-derived answer rows",
    { row: Arbitrary.schema(AnswerRow) },
    ({ row }) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(AnswerRow);
        const value2 = yield* S.encodeEffect(AnswerRow)(row);
        const decoded = yield* argument(value2);
        expect(S.toEquivalence(AnswerRow)(decoded, row)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips schema-derived question options",
    { options: Arbitrary.schema(QuestionOptions) },
    ({ options }) =>
      Effect.gen(function* () {
        const argument1 = S.decodeEffect(QuestionOptions);
        const value3 = yield* S.encodeEffect(QuestionOptions)(options);
        const decoded = yield* argument1(value3);
        expect(S.toEquivalence(QuestionOptions)(decoded, options)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );
});

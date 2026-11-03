import { AnswerState } from "@beep/law-practice-domain/values/AnswerRow";
import {
  AnswerLogError,
  DigestSelection,
  QuestionNotFoundError,
  RecordAnswerInput,
  UnknownQuestionOptionError,
} from "@beep/law-practice-use-cases/QuestionQueue";
import {
  AppliedWrite,
  AppliedWriteBatch,
  CalendarPrior,
  OperatorApproval,
  ProposedWriteBatch,
  QuestionWriteError,
} from "@beep/law-practice-use-cases/QuestionWrites";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

// Synthetic question-loop values; no matter, client or person is named.
const itemId = "question:docket-intake:1";

const encodedAnswers = [
  { state: "decided", itemId, optionId: "keep-date" },
  { state: "pending-on-client", itemId, resurfaceOn: "2026-11-02", note: "Waiting on the client." },
  { state: "keep-reminding", itemId },
  { state: "withdrawn", itemId },
];

const proposal = {
  itemId,
  optionId: "move-to-2026-11-02",
  write: { kind: "calendar-date", title: "Response due", dueOn: "2026-11-02", eventId: "evt-0001" },
  answeredAt: 1_760_400_000_000,
};
const prior = { date: "2026-10-02", title: "Response due", category: "Docket - unverified" };
const approval = { approvedBy: { kind: "System", component: "Runtime" }, approvedAt: 1_760_400_060_000 };

const question = {
  kind: "question",
  itemId,
  text: "Is the response date November 2 or October 2?",
  sourceRefs: [],
  facts: [],
  options: [
    { optionId: "keep-date", label: "Keep the current date" },
    { optionId: "move-to-2026-11-02", label: "Move the date", write: proposal.write },
  ],
};

const roundTrips = Effect.fn("roundTrips")(function* <A, I>(schema: S.Codec<A, I>, input: unknown) {
  const decoded = yield* S.decodeUnknownEffect(schema)(input);
  const value = yield* S.encodeEffect(schema)(decoded);
  expect(value).toStrictEqual(input);
  return decoded;
});

describe("@beep/law-practice-use-cases QuestionQueue schemas", () => {
  it.effect(
    "decodes and round-trips a submitted answer in every state",
    Effect.fnUntraced(function* () {
      const answers = yield* Effect.forEach(encodedAnswers, (answer) => roundTrips(RecordAnswerInput, answer));

      expect(A.map(answers, ({ state }) => state)).toStrictEqual(AnswerState.literals);
      assertTrue(A.every(answers, ({ itemId: answered }) => answered === itemId));
    })
  );

  it.effect(
    "requires each state's own field and leaves revision and timestamp to the queue",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(RecordAnswerInput);
      const failures = yield* Effect.all([
        Effect.flip(decode({ state: "decided", itemId })),
        Effect.flip(decode({ state: "pending-on-client", itemId })),
        Effect.flip(decode({ state: "snoozed", itemId })),
      ]);
      expect(A.map(failures, ({ _tag }) => _tag)).toStrictEqual(A.replicate("SchemaError", 3));

      const decided = yield* decode({ state: "decided", itemId, optionId: "keep-date", revision: 1, recordedAt: 0 });
      const value1 = yield* S.encodeEffect(RecordAnswerInput)(decided);
      expect(value1).toStrictEqual({
        state: "decided",
        itemId,
        optionId: "keep-date",
      });
      assertNone(decided.note);
    })
  );

  it.effect(
    "round-trips a digest selection",
    Effect.fnUntraced(function* () {
      const selection = yield* roundTrips(DigestSelection, { today: "2026-11-02", items: [question] });

      expect(selection.items).toHaveLength(1);
    })
  );
});

describe("@beep/law-practice-use-cases QuestionWrites schemas", () => {
  it.effect(
    "rejects a proposed batch with no proposals",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        S.decodeUnknownEffect(ProposedWriteBatch)({ batchId: "writes-1", proposals: [] })
      );

      expect(error._tag).toBe("SchemaError");
      yield* roundTrips(ProposedWriteBatch, { batchId: "writes-1", proposals: [proposal] });
    })
  );

  it.effect(
    "round-trips an applied write with and without its prior state",
    Effect.fnUntraced(function* () {
      const created = yield* roundTrips(AppliedWrite, { proposal, eventId: "evt-0001" });
      const updated = yield* roundTrips(AppliedWrite, { proposal, eventId: "evt-0001", prior });

      assertNone(created.prior);
      expect(updated.prior._tag).toBe("Some");
      yield* roundTrips(CalendarPrior, prior);
      yield* roundTrips(OperatorApproval, approval);
      yield* roundTrips(AppliedWriteBatch, {
        batchId: "writes-1",
        approval,
        applied: [{ proposal, eventId: "evt-0001", prior }],
      });
    })
  );
});

describe("@beep/law-practice-use-cases question-loop errors", () => {
  it.effect(
    "constructs each error with its fields",
    Effect.fnUntraced(function* () {
      const unknownOption = UnknownQuestionOptionError.make({ itemId, optionId: "move-date" });
      const notFound = QuestionNotFoundError.make({ itemId });
      const logError = AnswerLogError.make({ operation: "append" });
      const writeError = QuestionWriteError.make({ reason: "restore-failed", itemId: O.some(itemId) });
      const bareWriteError = QuestionWriteError.make({ reason: "calendar-unavailable" });

      expect([unknownOption.itemId, unknownOption.optionId]).toStrictEqual([itemId, "move-date"]);
      expect(notFound.itemId).toBe(itemId);
      expect(logError.operation).toBe("append");
      assertNone(logError.cause);
      expect(writeError.reason).toBe("restore-failed");
      assertSome(writeError.itemId, itemId);
      assertNone(bareWriteError.itemId);
      expect(A.map([unknownOption, notFound, logError, writeError], ({ _tag }) => _tag)).toStrictEqual([
        "UnknownQuestionOptionError",
        "QuestionNotFoundError",
        "AnswerLogError",
        "QuestionWriteError",
      ]);
    })
  );
});

// CalendarPrior and DigestSelection carry `LocalDateFromString` dates, whose
// arbitrary can name a day the month lacks; they are covered by the fixed
// examples above. These schemas' dates are calendar-checked.
describe("@beep/law-practice-use-cases question-loop schema properties", () => {
  it.effect.prop(
    "round-trips schema-derived answer submissions",
    { answer: Arbitrary.schema(RecordAnswerInput) },
    ({ answer }) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(RecordAnswerInput);
        const value2 = yield* S.encodeEffect(RecordAnswerInput)(answer);
        const decoded = yield* argument(value2);
        expect(S.toEquivalence(RecordAnswerInput)(decoded, answer)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips schema-derived proposed batches",
    { batch: Arbitrary.schema(ProposedWriteBatch) },
    ({ batch }) =>
      Effect.gen(function* () {
        const argument1 = S.decodeEffect(ProposedWriteBatch);
        const value3 = yield* S.encodeEffect(ProposedWriteBatch)(batch);
        const decoded = yield* argument1(value3);
        expect(S.toEquivalence(ProposedWriteBatch)(decoded, batch)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips schema-derived operator approvals",
    { approval: Arbitrary.schema(OperatorApproval) },
    ({ approval: generated }) =>
      Effect.gen(function* () {
        const argument2 = S.decodeEffect(OperatorApproval);
        const value4 = yield* S.encodeEffect(OperatorApproval)(generated);
        const decoded = yield* argument2(value4);
        expect(S.toEquivalence(OperatorApproval)(decoded, generated)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );
});

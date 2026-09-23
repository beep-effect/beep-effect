import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  CaptureLinkSpec,
  ChatFirstBlockSpec,
  ChatFirstJournalBlockSpec,
  ChatFirstLegacyBlockSpec,
  ChatFirstReceiptRequest,
  ChatFirstReceiptResult,
  ConversationLinkSpec,
  GoalLinkSpec,
  MaterializableProactiveIntent,
  MemoryLinkSpec,
  MemoryReviewCardSpec,
  ProactiveIntent,
  QuestionCardSpec,
  QuestionOption,
  QuestionSubject,
  TaskCardSpec,
  consumesTurnBudget,
  decodeProactiveIntent,
  materializablePayload,
  outcomeRequestIssue,
  questionCardIssue,
  receiptRequestIssue,
  receiptResultIssue,
  stableBlockId,
  ProactiveIntentOutcomeRequest,
} from "../../beep/ChatFirst.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.ConstraintDecoder<unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const goal = GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" });

describe("ChatFirst", () => {
  it("decodes every block generation", () => {
    expect(decode(ChatFirstBlockSpec, { type: "goalLink", goalId: "goal_1", title: "Ship" }).type).toBe("goalLink");
    expect(decode(ChatFirstBlockSpec, { type: "taskCard", taskId: "task_1", title: "Write" }).type).toBe("taskCard");
    expect(decode(ChatFirstBlockSpec, { type: "captureLink", captureId: "cap_1", title: "Clip" }).type).toBe(
      "captureLink",
    );
    expect(decode(ChatFirstBlockSpec, { type: "conversationLink", conversationId: "c1", title: "Talk" }).type).toBe(
      "conversationLink",
    );
    expect(decode(ChatFirstBlockSpec, { type: "memoryLink", memoryId: "m1", title: "Fact" }).type).toBe("memoryLink");
    const question = decode(ChatFirstJournalBlockSpec, {
      type: "questionCard",
      question: "When?",
      options: [{ optionId: "a", label: "Now", defer: false }],
      subject: { kind: "goal", id: "goal_1" },
    });
    expect(question.type).toBe("questionCard");
    expect(
      decode(ChatFirstJournalBlockSpec, {
        type: "memoryReviewCard",
        memoryId: "m1",
        content: "Seattle",
        category: "",
      }).type,
    ).toBe("memoryReviewCard");
    expect(decode(ChatFirstLegacyBlockSpec, { type: "memoryLink", memoryId: "m1", title: "Fact" }).type).toBe(
      "memoryLink",
    );
    expect(decodeFails(ChatFirstLegacyBlockSpec, { type: "conversationLink", conversationId: "c1", title: "Talk" })).toBe(
      true,
    );
  });

  it("covers question, receipt, and intent branches", () => {
    const card = QuestionCardSpec.make({
      type: "questionCard",
      question: "When?",
      options: [
        QuestionOption.make({ optionId: "a", label: "Now", defer: true }),
        QuestionOption.make({ optionId: "a", label: "Later" }),
      ],
      subject: QuestionSubject.make({ kind: "goal", id: "goal_1" }),
    });
    expect(O.isSome(questionCardIssue(card))).toBe(true);
    const deferred = QuestionCardSpec.make({
      type: "questionCard",
      question: "When?",
      options: [
        QuestionOption.make({ optionId: "a", label: "Now", defer: true }),
        QuestionOption.make({ optionId: "b", label: "Later", defer: true }),
      ],
      subject: QuestionSubject.make({ kind: "goal", id: "goal_1" }),
    });
    expect(questionCardIssue(deferred)).toEqual(O.some("at most one question option may defer"));
    const unpaired = QuestionCardSpec.make({
      type: "questionCard",
      question: "When?",
      options: [QuestionOption.make({ optionId: "a", label: "Now" })],
      subject: QuestionSubject.make({ kind: "cold_start", id: "seq_1" }),
    });
    expect(O.isSome(questionCardIssue(unpaired))).toBe(true);
    const ok = QuestionCardSpec.make({
      type: "questionCard",
      question: "When?",
      options: [QuestionOption.make({ optionId: "a", label: "Now" })],
      subject: QuestionSubject.make({ kind: "goal", id: "goal_1" }),
    });
    expect(O.isNone(questionCardIssue(ok))).toBe(true);
    const engaged = ChatFirstReceiptRequest.make({
      blockId: "b1",
      action: "engaged",
      occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
    });
    expect(O.isSome(receiptRequestIssue(engaged))).toBe(true);
    const shown = ChatFirstReceiptRequest.make({
      blockId: "b1",
      action: "shown",
      optionId: O.some("a"),
      occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
    });
    expect(O.isSome(receiptRequestIssue(shown))).toBe(true);
    expect(O.isSome(receiptResultIssue(ChatFirstReceiptResult.make({ blockId: "b1", accepted: false })))).toBe(true);
    expect(O.isSome(receiptResultIssue(ChatFirstReceiptResult.make({ blockId: "b1", accepted: true, reason: O.some("no") })))).toBe(true);
    const intent = Effect.runSync(
      decodeProactiveIntent({ intentId: "intent_1", deliveryState: "future", block: goal }),
    );
    expect(intent.deliveryState).toBe("dead_letter");
    expect(consumesTurnBudget(ProactiveIntent.make({ intentId: "intent_1", deliveryState: "ready", block: goal }))).toBe(true);
    expect(consumesTurnBudget(ProactiveIntent.make({ intentId: "intent_1", deliveryState: "delivered", block: goal }))).toBe(false);
    expect("requeueCount" in materializablePayload(MaterializableProactiveIntent.make({
      intentId: "intent_1",
      deliveryState: "ready",
      block: goal,
    }))).toBe(false);
    expect(
      O.isSome(
        outcomeRequestIssue(
          ProactiveIntentOutcomeRequest.make({ outcome: "suppressed", occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z") }),
        ),
      ),
    ).toBe(true);
    expect(stableBlockId({ uid: "u1", generation: 1, block: goal }).startsWith("cfb_")).toBe(true);
    expect(TaskCardSpec.make({ type: "taskCard", taskId: "task_1", title: "Write" }).title).toBe("Write");
    expect(CaptureLinkSpec.make({ type: "captureLink", captureId: "cap_1", title: "Clip" }).type).toBe("captureLink");
    expect(ConversationLinkSpec.make({ type: "conversationLink", conversationId: "c1", title: "Talk" }).type).toBe(
      "conversationLink",
    );
    expect(MemoryLinkSpec.make({ type: "memoryLink", memoryId: "m1", title: "Fact" }).type).toBe("memoryLink");
    expect(MemoryReviewCardSpec.make({ type: "memoryReviewCard", memoryId: "m1", content: "Seattle" }).category).toBe("");
    for (const schema of [QuestionCardSpec, TaskCardSpec, GoalLinkSpec, ProactiveIntent, ChatFirstBlockSpec]) {
      expect(Arbitrary.schema(schema)).toBeTruthy();
    }
  });
});

/**
 * Chat-first blocks, receipts, and proactive intents.
 *
 * **Details**
 *
 * Chat-first is the product shell that leads with chat. These models are the
 * block and intent contracts. They are not memories and not conversations.
 * Unknown keys are forbidden by the Python models.
 *
 * **Gotchas**
 *
 * Effect strips unknown keys unless decode uses `{ onExcessProperty: "error" }`.
 *
 * @since 0.0.0
 */
import { createHash } from "node:crypto";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  optionalStableId,
  optionalText,
  optionalTimestamp,
  stableId,
  stableIdCheck,
  textBoundsCheck,
  timestamp,
} from "./Kit.ts";
import * as R from "effect/Record";
import { atLeastCheck, boolDefault, intAtLeast, intBetween, isRecord, jsonList, Model, optionalNull, pg, textDefault } from "./Port.ts";

const $I = $ScratchpadId.create("beep/ChatFirst");

const tag = (value: string) => S.tag(value).pipe(pg.text(), pg.columnName("type"));
const bounded = (column: string, minLength: number, maxLength: number) =>
  S.String.check(S.isMinLength(minLength), S.isMaxLength(maxLength)).pipe(pg.text(), pg.columnName(column));

/**
 * Kind of a current chat-first block.
 *
 * **Example** (Decode a question card)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstBlockKind } from "./ChatFirst.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(ChatFirstBlockKind)("questionCard"))) // "questionCard"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstBlockKind = LiteralKit([
  "questionCard",
  "taskCard",
  "goalLink",
  "captureLink",
  "conversationLink",
  "memoryLink",
]).pipe($I.annoteSchema("ChatFirstBlockKind", { description: "Current chat-first block kind." }));

/**
 * Decoded type of {@link ChatFirstBlockKind}.
 *
 * @see {@link ChatFirstBlockKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ChatFirstBlockKind = typeof ChatFirstBlockKind.Type;

/**
 * Block kind accepted in a chat-first journal, which adds memory review cards to the current kinds.
 *
 * **Example** (Decode a memory review kind)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstJournalBlockKind } from "./ChatFirst.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(ChatFirstJournalBlockKind)("memoryReviewCard"))) // "memoryReviewCard"
 * ```
 *
 * @see {@link ChatFirstBlockKind} for the current, narrower kind set.
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstJournalBlockKind = LiteralKit([
  "questionCard",
  "taskCard",
  "goalLink",
  "captureLink",
  "conversationLink",
  "memoryLink",
  "memoryReviewCard",
]).pipe($I.annoteSchema("ChatFirstJournalBlockKind", { description: "Journal block kind, including memory review." }));

/**
 * Decoded type of {@link ChatFirstJournalBlockKind}.
 *
 * @see {@link ChatFirstJournalBlockKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ChatFirstJournalBlockKind = typeof ChatFirstJournalBlockKind.Type;

/**
 * Block kind understood by legacy chat-first clients, which predate conversation links and review cards.
 *
 * **Example** (Reject a conversation link)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChatFirstLegacyBlockKind } from "./ChatFirst.ts"
 *
 * const isLegacyKind = S.is(ChatFirstLegacyBlockKind)
 *
 * console.log(isLegacyKind("goalLink")) // true
 * console.log(isLegacyKind("conversationLink")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstLegacyBlockKind = LiteralKit([
  "questionCard",
  "taskCard",
  "goalLink",
  "captureLink",
  "memoryLink",
]).pipe($I.annoteSchema("ChatFirstLegacyBlockKind", { description: "Legacy block kind, without conversation or review cards." }));

/**
 * Decoded type of {@link ChatFirstLegacyBlockKind}.
 *
 * @see {@link ChatFirstLegacyBlockKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ChatFirstLegacyBlockKind = typeof ChatFirstLegacyBlockKind.Type;

/**
 * User action recorded by a chat-first receipt: the block was shown, engaged with, or dismissed.
 *
 * **Example** (Decode an engaged action)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstReceiptAction } from "./ChatFirst.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(ChatFirstReceiptAction)("engaged"))) // "engaged"
 * ```
 *
 * @see {@link receiptRequestIssue} for the option-id rule tied to `engaged`.
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstReceiptAction = LiteralKit(["shown", "engaged", "dismissed"]).pipe(
  $I.annoteSchema("ChatFirstReceiptAction", { description: "What the user did with a chat-first block." }),
);

/**
 * Decoded type of {@link ChatFirstReceiptAction}.
 *
 * @see {@link ChatFirstReceiptAction} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ChatFirstReceiptAction = typeof ChatFirstReceiptAction.Type;

/**
 * Lifecycle state of a proactive intent, from ready through delivery to a terminal or dead-letter state.
 *
 * **Details**
 *
 * The schema itself rejects unknown strings. {@link decodeProactiveIntent} rewrites an unknown
 * state to `dead_letter` before decoding a whole intent.
 *
 * **Example** (Recognize known states)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProactiveIntentDeliveryState } from "./ChatFirst.ts"
 *
 * const isDeliveryState = S.is(ProactiveIntentDeliveryState)
 *
 * console.log(isDeliveryState("deferred")) // true
 * console.log(isDeliveryState("future")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProactiveIntentDeliveryState = LiteralKit([
  "ready",
  "deferred",
  "delivered",
  "suppressed",
  "expired",
  "dead_letter",
]).pipe(
  $I.annoteSchema("ProactiveIntentDeliveryState", {
    description: "Delivery state of a proactive intent. Unknown strings are coerced to dead_letter before decode.",
  }),
);

/**
 * Decoded type of {@link ProactiveIntentDeliveryState}.
 *
 * @see {@link ProactiveIntentDeliveryState} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ProactiveIntentDeliveryState = typeof ProactiveIntentDeliveryState.Type;

const isProactiveIntentDeliveryState = S.is(ProactiveIntentDeliveryState);

/**
 * Terminal outcome a client reports for a proactive intent.
 *
 * **Example** (Decode an accepted outcome)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ProactiveIntentOutcome } from "./ChatFirst.ts"
 *
 * console.log(Effect.runSync(S.decodeUnknownEffect(ProactiveIntentOutcome)("accepted"))) // "accepted"
 * ```
 *
 * @see {@link outcomeRequestIssue} for the reason rule tied to `suppressed`.
 * @category schemas
 * @since 0.0.0
 */
export const ProactiveIntentOutcome = LiteralKit(["accepted", "dismissed", "expired", "suppressed"]).pipe(
  $I.annoteSchema("ProactiveIntentOutcome", { description: "Terminal outcome reported for a proactive intent." }),
);

/**
 * Decoded type of {@link ProactiveIntentOutcome}.
 *
 * @see {@link ProactiveIntentOutcome} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ProactiveIntentOutcome = typeof ProactiveIntentOutcome.Type;

/**
 * One selectable answer on a question card, optionally marked as the defer choice.
 *
 * **Example** (Construct an option with the default defer flag)
 *
 * ```ts
 * import { QuestionOption } from "./ChatFirst.ts"
 *
 * const option = QuestionOption.make({ optionId: "now", label: "Right now" })
 *
 * console.log(option.defer) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuestionOption extends Model<QuestionOption>("QuestionOption")(
  {
    optionId: stableId("option_id"),
    label: bounded("label", 1, 80),
    defer: boolDefault("defer", false),
  },
  $I.annote("QuestionOption", { description: "One answer on a question card." }),
  (columns) => [
    stableIdCheck("option_id")(columns.optionId),
    textBoundsCheck("label", { minLength: 1, maxLength: 80 })(columns.label),
  ],
) {}

/**
 * Encoded shape of {@link QuestionOption}.
 *
 * @see {@link QuestionOption} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QuestionOption {
  export type Encoded = S.Codec.Encoded<typeof QuestionOption>;
}

/**
 * Entity a question card asks about, identified by its kind and stable id.
 *
 * **Example** (Point a question at a goal)
 *
 * ```ts
 * import { QuestionSubject } from "./ChatFirst.ts"
 *
 * const subject = QuestionSubject.make({ kind: "goal", id: "goal_1" })
 *
 * console.log(subject.kind) // "goal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuestionSubject extends Model<QuestionSubject>("QuestionSubject")(
  {
    kind: LiteralKit(["cold_start", "goal", "capture", "conversation", "memory"]).pipe(pg.text(), pg.columnName("kind")),
    id: stableId("id"),
  },
  $I.annote("QuestionSubject", { description: "Entity a question card is about." }),
  (columns) => [stableIdCheck("id")(columns.id)],
) {}

/**
 * Encoded shape of {@link QuestionSubject}.
 *
 * @see {@link QuestionSubject} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QuestionSubject {
  export type Encoded = S.Codec.Encoded<typeof QuestionSubject>;
}

/**
 * Position of a question card inside a cold-start onboarding sequence.
 *
 * **Example** (Start a sequence at step one)
 *
 * ```ts
 * import { QuestionColdStartSequence } from "./ChatFirst.ts"
 *
 * const sequence = QuestionColdStartSequence.make({ sequenceId: "onboarding", step: 1 })
 *
 * console.log(sequence.step) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuestionColdStartSequence extends Model<QuestionColdStartSequence>("QuestionColdStartSequence")(
  {
    sequenceId: stableId("sequence_id"),
    step: intBetween("step", 1, 100),
  },
  $I.annote("QuestionColdStartSequence", { description: "Cold-start question sequence position." }),
  (columns) => [stableIdCheck("sequence_id")(columns.sequenceId)],
) {}

/**
 * Encoded shape of {@link QuestionColdStartSequence}.
 *
 * @see {@link QuestionColdStartSequence} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QuestionColdStartSequence {
  export type Encoded = S.Codec.Encoded<typeof QuestionColdStartSequence>;
}

/**
 * Chat-first card that asks the user one question with one to four answer options.
 *
 * **Details**
 *
 * The class checks field shapes only. Cross-field rules (unique option ids, at most one
 * defer option, cold-start pairing) live in {@link questionCardIssue} and are enforced on
 * decode by {@link QuestionCardSpecChecked}.
 *
 * **Example** (Construct a goal question)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { QuestionCardSpec, QuestionOption, QuestionSubject } from "./ChatFirst.ts"
 *
 * const card = QuestionCardSpec.make({
 *   type: "questionCard",
 *   question: "Work on this goal today?",
 *   options: [
 *     QuestionOption.make({ optionId: "yes", label: "Yes" }),
 *     QuestionOption.make({ optionId: "later", label: "Later", defer: true }),
 *   ],
 *   subject: QuestionSubject.make({ kind: "goal", id: "goal_1" }),
 * })
 *
 * console.log(card.options.length) // 2
 * console.log(O.isNone(card.coldStartSequence)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuestionCardSpec extends Model<QuestionCardSpec>("QuestionCardSpec")(
  {
    type: tag("questionCard"),
    question: bounded("question", 1, 280),
    options: S.Array(QuestionOption)
      .check(S.isMinLength(1), S.isMaxLength(4))
      .pipe(pg.jsonb(), pg.columnName("options")),
    subject: QuestionSubject.pipe(pg.jsonb(), pg.columnName("subject")),
    coldStartSequence: optionalNull(QuestionColdStartSequence).pipe(pg.jsonb(), pg.columnName("cold_start_sequence")),
  },
  $I.annote("QuestionCardSpec", { description: "Question card. Option ids are unique. Cold start is paired with its sequence." }),
  (columns) => [textBoundsCheck("question", { minLength: 1, maxLength: 280 })(columns.question)],
) {}

/**
 * Encoded shape of {@link QuestionCardSpec}.
 *
 * @see {@link QuestionCardSpec} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace QuestionCardSpec {
  export type Encoded = S.Codec.Encoded<typeof QuestionCardSpec>;
}

/**
 * Unique options, one defer, and a cold-start sequence that matches the subject.
 *
 * **Example** (Reject two defer options)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { QuestionCardSpec, QuestionOption, QuestionSubject, questionCardIssue } from "./ChatFirst.ts"
 *
 * const issue = questionCardIssue(
 *   QuestionCardSpec.make({
 *     type: "questionCard",
 *     question: "When?",
 *     options: [
 *       QuestionOption.make({ optionId: "a", label: "Now", defer: true }),
 *       QuestionOption.make({ optionId: "b", label: "Later", defer: true }),
 *     ],
 *     subject: QuestionSubject.make({ kind: "goal", id: "goal_1" }),
 *   }),
 * )
 * console.log(O.isSome(issue)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const questionCardIssue = (spec: QuestionCardSpec): O.Option<string> => {
  const ids = spec.options.map((option) => option.optionId);
  if (HashSet.size(HashSet.fromIterable(ids)) !== ids.length) return O.some("question option ids must be unique");
  const deferCount = spec.options.filter((option) => option.defer).length;
  if (deferCount > 1) return O.some("at most one question option may defer");
  const cold = spec.subject.kind === "cold_start";
  if (cold !== O.isSome(spec.coldStartSequence)) {
    return O.some("cold_start questions require a sequence, and other subjects must omit it");
  }
  if (O.isSome(spec.coldStartSequence)) {
    const sequence = spec.coldStartSequence.value;
    if (spec.subject.id !== sequence.sequenceId) return O.some("cold-start subject id must equal sequence id");
    if (sequence.step !== 1) return O.some("a new cold-start card starts at step 1");
  }
  return O.none();
};

/**
 * Question card schema that also rejects cards failing the cross-field rules of {@link questionCardIssue}.
 *
 * **Example** (Reject two defer options on decode)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { QuestionCardSpecChecked } from "./ChatFirst.ts"
 *
 * const exit = S.decodeUnknownExit(QuestionCardSpecChecked)({
 *   type: "questionCard",
 *   question: "When?",
 *   options: [
 *     { optionId: "a", label: "Now", defer: true },
 *     { optionId: "b", label: "Later", defer: true },
 *   ],
 *   subject: { kind: "goal", id: "goal_1" },
 * })
 *
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QuestionCardSpecChecked = QuestionCardSpec.check(
  S.makeFilter((spec: QuestionCardSpec) => {
    const issue = questionCardIssue(spec);
    return O.isSome(issue) ? issue.value : undefined;
  }),
);

/**
 * Chat-first card that surfaces one task, with an optional due time and source goal.
 *
 * **Example** (Construct an undated task card)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { TaskCardSpec } from "./ChatFirst.ts"
 *
 * const card = TaskCardSpec.make({ type: "taskCard", taskId: "task_1", title: "Draft the brief" })
 *
 * console.log(O.isNone(card.dueAt)) // true
 * ```
 *
 * @see {@link taskCardIssue} for the due-time rule.
 * @category models
 * @since 0.0.0
 */
export class TaskCardSpec extends Model<TaskCardSpec>("TaskCardSpec")(
  {
    type: tag("taskCard"),
    taskId: stableId("task_id"),
    title: bounded("title", 1, 120),
    dueAt: optionalTimestamp("due_at"),
    sourceGoalId: optionalStableId("source_goal_id"),
  },
  $I.annote("TaskCardSpec", { description: "Task card linked from chat-first." }),
  (columns) => [
    stableIdCheck("task_id")(columns.taskId),
    textBoundsCheck("title", { minLength: 1, maxLength: 120 })(columns.title),
    stableIdCheck("source_goal_id")(columns.sourceGoalId),
  ],
) {}

/**
 * Encoded shape of {@link TaskCardSpec}.
 *
 * @see {@link TaskCardSpec} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskCardSpec {
  export type Encoded = S.Codec.Encoded<typeof TaskCardSpec>;
}

/**
 * Returns the first rule a task card breaks, or `None` when the card is valid.
 *
 * **Example** (Reject a due time before the epoch)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { TaskCardSpec, taskCardIssue } from "./ChatFirst.ts"
 *
 * const card = TaskCardSpec.make({
 *   type: "taskCard",
 *   taskId: "task_1",
 *   title: "Draft the brief",
 *   dueAt: O.some(DateTime.makeUnsafe("1969-12-31T00:00:00.000Z")),
 * })
 *
 * console.log(O.getOrUndefined(taskCardIssue(card))) // "due_at must not be before the unix epoch"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const taskCardIssue = (spec: TaskCardSpec): O.Option<string> =>
  O.isSome(spec.dueAt) && DateTime.toEpochMillis(spec.dueAt.value) < 0
    ? O.some("due_at must not be before the unix epoch")
    : O.none();

/**
 * Chat-first block that links to a goal by id and title.
 *
 * **Example** (Construct a goal link)
 *
 * ```ts
 * import { GoalLinkSpec } from "./ChatFirst.ts"
 *
 * const link = GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" })
 *
 * console.log(link.goalId) // "goal_1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalLinkSpec extends Model<GoalLinkSpec>("GoalLinkSpec")(
  {
    type: tag("goalLink"),
    goalId: stableId("goal_id"),
    title: bounded("title", 1, 120),
  },
  $I.annote("GoalLinkSpec", { description: "Link to a goal." }),
  (columns) => [stableIdCheck("goal_id")(columns.goalId), textBoundsCheck("title", { minLength: 1, maxLength: 120 })(columns.title)],
) {}

/**
 * Encoded shape of {@link GoalLinkSpec}.
 *
 * @see {@link GoalLinkSpec} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoalLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof GoalLinkSpec>;
}

/**
 * Chat-first block that links to a capture by id and title.
 *
 * **Example** (Construct a capture link)
 *
 * ```ts
 * import { CaptureLinkSpec } from "./ChatFirst.ts"
 *
 * const link = CaptureLinkSpec.make({ type: "captureLink", captureId: "capture_1", title: "Whiteboard photo" })
 *
 * console.log(link.captureId) // "capture_1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaptureLinkSpec extends Model<CaptureLinkSpec>("CaptureLinkSpec")(
  {
    type: tag("captureLink"),
    captureId: stableId("capture_id"),
    title: bounded("title", 1, 120),
  },
  $I.annote("CaptureLinkSpec", { description: "Link to a capture." }),
  (columns) => [
    stableIdCheck("capture_id")(columns.captureId),
    textBoundsCheck("title", { minLength: 1, maxLength: 120 })(columns.title),
  ],
) {}

/**
 * Encoded shape of {@link CaptureLinkSpec}.
 *
 * @see {@link CaptureLinkSpec} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CaptureLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof CaptureLinkSpec>;
}

/**
 * Chat-first block that links to a conversation by id and title.
 *
 * **Example** (Construct a conversation link)
 *
 * ```ts
 * import { ConversationLinkSpec } from "./ChatFirst.ts"
 *
 * const link = ConversationLinkSpec.make({ type: "conversationLink", conversationId: "conv_1", title: "Standup" })
 *
 * console.log(link.title) // "Standup"
 * ```
 *
 * @see {@link ChatFirstLegacyBlockSpec} for the legacy union that rejects this block.
 * @category models
 * @since 0.0.0
 */
export class ConversationLinkSpec extends Model<ConversationLinkSpec>("ConversationLinkSpec")(
  {
    type: tag("conversationLink"),
    conversationId: stableId("conversation_id"),
    title: bounded("title", 1, 120),
  },
  $I.annote("ConversationLinkSpec", { description: "Link to a conversation." }),
  (columns) => [
    stableIdCheck("conversation_id")(columns.conversationId),
    textBoundsCheck("title", { minLength: 1, maxLength: 120 })(columns.title),
  ],
) {}

/**
 * Encoded shape of {@link ConversationLinkSpec}.
 *
 * @see {@link ConversationLinkSpec} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof ConversationLinkSpec>;
}

/**
 * Chat-first block that links to a memory by id and title.
 *
 * **Example** (Construct a memory link)
 *
 * ```ts
 * import { MemoryLinkSpec } from "./ChatFirst.ts"
 *
 * const link = MemoryLinkSpec.make({ type: "memoryLink", memoryId: "mem_1", title: "Coffee order" })
 *
 * console.log(link.memoryId) // "mem_1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryLinkSpec extends Model<MemoryLinkSpec>("MemoryLinkSpec")(
  {
    type: tag("memoryLink"),
    memoryId: stableId("memory_id"),
    title: bounded("title", 1, 120),
  },
  $I.annote("MemoryLinkSpec", { description: "Link to a memory." }),
  (columns) => [
    stableIdCheck("memory_id")(columns.memoryId),
    textBoundsCheck("title", { minLength: 1, maxLength: 120 })(columns.title),
  ],
) {}

/**
 * Encoded shape of {@link MemoryLinkSpec}.
 *
 * @see {@link MemoryLinkSpec} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof MemoryLinkSpec>;
}

/**
 * Journal card that asks the user to review a memory captured during the day.
 *
 * **Gotchas**
 *
 * The empty `category` default applies to `make` only. Decoding wire input requires the key.
 *
 * **Example** (Construct a review card with the default category)
 *
 * ```ts
 * import { MemoryReviewCardSpec } from "./ChatFirst.ts"
 *
 * const card = MemoryReviewCardSpec.make({ type: "memoryReviewCard", memoryId: "mem_1", content: "Prefers morning meetings" })
 *
 * console.log(card.category) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryReviewCardSpec extends Model<MemoryReviewCardSpec>("MemoryReviewCardSpec")(
  {
    type: tag("memoryReviewCard"),
    memoryId: stableId("memory_id"),
    content: bounded("content", 1, 2000),
    category: textDefault("category", ""),
    capturedAt: optionalTimestamp("captured_at"),
  },
  $I.annote("MemoryReviewCardSpec", { description: "Review card for a memory produced during the day." }),
  (columns) => [
    stableIdCheck("memory_id")(columns.memoryId),
    textBoundsCheck("content", { minLength: 1, maxLength: 2000 })(columns.content),
  ],
) {}

/**
 * Encoded shape of {@link MemoryReviewCardSpec}.
 *
 * @see {@link MemoryReviewCardSpec} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryReviewCardSpec {
  export type Encoded = S.Codec.Encoded<typeof MemoryReviewCardSpec>;
}

/**
 * Current chat-first block. The `type` field selects the card.
 *
 * **Example** (Decode a goal link)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstBlockSpec } from "./ChatFirst.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ChatFirstBlockSpec)({ type: "goalLink", goalId: "goal_1", title: "Ship" }))
 * console.log(decoded.type) // "goalLink"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstBlockSpec = ChatFirstBlockKind.mapMembers(
  Tuple.evolve([
    () => QuestionCardSpec,
    () => TaskCardSpec,
    () => GoalLinkSpec,
    () => CaptureLinkSpec,
    () => ConversationLinkSpec,
    () => MemoryLinkSpec,
  ]),
).pipe(S.toTaggedUnion("type"), $I.annoteSchema("ChatFirstBlockSpec", { description: "Current chat-first block." }));

/**
 * Journal block union, the current blocks plus memory review cards, selected by the `type` field.
 *
 * **Example** (Decode a memory review card)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstJournalBlockSpec } from "./ChatFirst.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ChatFirstJournalBlockSpec)({
 *     type: "memoryReviewCard",
 *     memoryId: "mem_1",
 *     content: "Prefers morning meetings",
 *     category: "preferences",
 *   }),
 * )
 *
 * console.log(decoded.type) // "memoryReviewCard"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstJournalBlockSpec = ChatFirstJournalBlockKind.mapMembers(
  Tuple.evolve([
    () => QuestionCardSpec,
    () => TaskCardSpec,
    () => GoalLinkSpec,
    () => CaptureLinkSpec,
    () => ConversationLinkSpec,
    () => MemoryLinkSpec,
    () => MemoryReviewCardSpec,
  ]),
).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ChatFirstJournalBlockSpec", { description: "Journal block, including memory review cards." }),
);

/**
 * Block union for legacy clients, which has no conversation links or review cards.
 *
 * **Example** (Reject a conversation link)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { ChatFirstLegacyBlockSpec } from "./ChatFirst.ts"
 *
 * const exit = S.decodeUnknownExit(ChatFirstLegacyBlockSpec)({ type: "conversationLink", conversationId: "conv_1", title: "Standup" })
 *
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstLegacyBlockSpec = ChatFirstLegacyBlockKind.mapMembers(
  Tuple.evolve([
    () => QuestionCardSpec,
    () => TaskCardSpec,
    () => GoalLinkSpec,
    () => CaptureLinkSpec,
    () => MemoryLinkSpec,
  ]),
).pipe(S.toTaggedUnion("type"), $I.annoteSchema("ChatFirstLegacyBlockSpec", { description: "Legacy chat-first block." }));

const stripNulls = (value: unknown): unknown => {
  if (Arr.isArray(value)) return value.map(stripNulls);
  if (!isRecord(value)) return value;
  const out: { [key: string]: unknown } = {};
  for (const key of R.keys(value)) {
    const child = value[key];
    if (child !== null && child !== undefined) out[key] = stripNulls(child);
  }
  return out;
};

/**
 * Opaque retry-stable id for one journal block.
 *
 * **Details**
 *
 * The digest is sha256 of `uid:generation:` plus JSON with nulls removed,
 * truncated to 24 hex characters and prefixed with `cfb_`. This is stable for
 * this port. It is not a byte match of pydantic's `model_dump_json`.
 *
 * **Example** (Same block, same id)
 *
 * ```ts
 * import { GoalLinkSpec, stableBlockId } from "./ChatFirst.ts"
 *
 * const block = GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" })
 * console.log(stableBlockId({ uid: "u1", generation: 1, block }) === stableBlockId({ uid: "u1", generation: 1, block })) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const stableBlockId = (input: {
  readonly uid: string;
  readonly generation: number;
  readonly block: typeof ChatFirstJournalBlockSpec.Type;
}): string => {
  const encoded = stripNulls(input.block);
  const digest = createHash("sha256")
    .update(`${input.uid}:${input.generation}:${JSON.stringify(encoded)}`)
    .digest("hex")
    .slice(0, 24);
  return `cfb_${digest}`;
};

/**
 * Receipt a client sends when a chat-first block is shown, engaged with, or dismissed.
 *
 * **Example** (Record a shown block)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { ChatFirstReceiptRequest } from "./ChatFirst.ts"
 *
 * const receipt = ChatFirstReceiptRequest.make({
 *   blockId: "cfb_1",
 *   action: "shown",
 *   occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 *
 * console.log(receipt.action) // "shown"
 * ```
 *
 * @see {@link receiptRequestIssue} for the option-id rule.
 * @category models
 * @since 0.0.0
 */
export class ChatFirstReceiptRequest extends Model<ChatFirstReceiptRequest>("ChatFirstReceiptRequest")(
  {
    blockId: stableId("block_id"),
    action: ChatFirstReceiptAction.pipe(pg.text(), pg.columnName("action")),
    optionId: optionalStableId("option_id"),
    occurredAt: timestamp("occurred_at"),
  },
  $I.annote("ChatFirstReceiptRequest", { description: "Receipt for one shown, engaged, or dismissed block." }),
  (columns) => [stableIdCheck("block_id")(columns.blockId), stableIdCheck("option_id")(columns.optionId)],
) {}

/**
 * Encoded shape of {@link ChatFirstReceiptRequest}.
 *
 * @see {@link ChatFirstReceiptRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatFirstReceiptRequest {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptRequest>;
}

/**
 * Returns the option-id rule a receipt breaks, or `None` when it is valid.
 *
 * **Details**
 *
 * Engaged receipts must name the chosen option. Shown and dismissed receipts must not.
 *
 * **Example** (Require an option on an engaged receipt)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { ChatFirstReceiptRequest, receiptRequestIssue } from "./ChatFirst.ts"
 *
 * const receipt = ChatFirstReceiptRequest.make({
 *   blockId: "cfb_1",
 *   action: "engaged",
 *   occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 *
 * console.log(O.getOrUndefined(receiptRequestIssue(receipt))) // "engaged receipts require option_id"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const receiptRequestIssue = (receipt: ChatFirstReceiptRequest): O.Option<string> => {
  if (receipt.action === "engaged" && O.isNone(receipt.optionId)) return O.some("engaged receipts require option_id");
  if (receipt.action !== "engaged" && O.isSome(receipt.optionId)) {
    return O.some("only engaged receipts may carry option_id");
  }
  return O.none();
};

/**
 * Server verdict on one receipt: accepted, or rejected with a reason.
 *
 * **Example** (Reject a receipt with a reason)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ChatFirstReceiptResult } from "./ChatFirst.ts"
 *
 * const result = ChatFirstReceiptResult.make({ blockId: "cfb_1", accepted: false, reason: O.some("block expired") })
 *
 * console.log(O.getOrUndefined(result.reason)) // "block expired"
 * ```
 *
 * @see {@link receiptResultIssue} for the reason rule.
 * @category models
 * @since 0.0.0
 */
export class ChatFirstReceiptResult extends Model<ChatFirstReceiptResult>("ChatFirstReceiptResult")(
  {
    blockId: stableId("block_id"),
    accepted: S.Boolean.pipe(pg.boolean(), pg.columnName("accepted")),
    reason: optionalText("reason"),
  },
  $I.annote("ChatFirstReceiptResult", { description: "Whether one receipt was accepted." }),
  (columns) => [stableIdCheck("block_id")(columns.blockId)],
) {}

/**
 * Encoded shape of {@link ChatFirstReceiptResult}.
 *
 * @see {@link ChatFirstReceiptResult} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatFirstReceiptResult {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptResult>;
}

/**
 * Returns the reason rule a receipt result breaks, or `None` when it is valid.
 *
 * **Details**
 *
 * Accepted results carry no reason. Rejected results must carry one.
 *
 * **Example** (Require a reason on a rejection)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ChatFirstReceiptResult, receiptResultIssue } from "./ChatFirst.ts"
 *
 * const result = ChatFirstReceiptResult.make({ blockId: "cfb_1", accepted: false })
 *
 * console.log(O.getOrUndefined(receiptResultIssue(result))) // "rejected receipts require a reason"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const receiptResultIssue = (result: ChatFirstReceiptResult): O.Option<string> => {
  if (result.accepted && O.isSome(result.reason)) return O.some("accepted receipts must not include a reason");
  if (!result.accepted && O.isNone(result.reason)) return O.some("rejected receipts require a reason");
  return O.none();
};

/**
 * Batch of one to fifty receipts sent in a single request.
 *
 * **Example** (Batch two receipts)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { ChatFirstReceiptRequest, ChatFirstReceiptsRequest } from "./ChatFirst.ts"
 *
 * const occurredAt = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const request = ChatFirstReceiptsRequest.make({
 *   receipts: [
 *     ChatFirstReceiptRequest.make({ blockId: "cfb_1", action: "shown", occurredAt }),
 *     ChatFirstReceiptRequest.make({ blockId: "cfb_2", action: "dismissed", occurredAt }),
 *   ],
 * })
 *
 * console.log(request.receipts.length) // 2
 * ```
 *
 * @see {@link receiptsRequestIssue} for the batch rules.
 * @category models
 * @since 0.0.0
 */
export class ChatFirstReceiptsRequest extends Model<ChatFirstReceiptsRequest>("ChatFirstReceiptsRequest")(
  {
    receipts: S.Array(ChatFirstReceiptRequest).check(S.isMinLength(1), S.isMaxLength(50)).pipe(pg.jsonb(), pg.columnName("receipts")),
  },
  $I.annote("ChatFirstReceiptsRequest", { description: "Batch of chat-first receipts." }),
) {}

/**
 * Encoded shape of {@link ChatFirstReceiptsRequest}.
 *
 * @see {@link ChatFirstReceiptsRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatFirstReceiptsRequest {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptsRequest>;
}

/**
 * Returns the first rule a receipt batch breaks, or `None` when the batch is valid.
 *
 * **Details**
 *
 * Block ids must be unique across the batch. After that, the first receipt that fails
 * {@link receiptRequestIssue} supplies the issue.
 *
 * **Example** (Reject duplicate block ids)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { ChatFirstReceiptRequest, ChatFirstReceiptsRequest, receiptsRequestIssue } from "./ChatFirst.ts"
 *
 * const occurredAt = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const request = ChatFirstReceiptsRequest.make({
 *   receipts: [
 *     ChatFirstReceiptRequest.make({ blockId: "cfb_1", action: "shown", occurredAt }),
 *     ChatFirstReceiptRequest.make({ blockId: "cfb_1", action: "dismissed", occurredAt }),
 *   ],
 * })
 *
 * console.log(O.getOrUndefined(receiptsRequestIssue(request))) // "receipt block ids must be unique"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const receiptsRequestIssue = (request: ChatFirstReceiptsRequest): O.Option<string> => {
  const ids = request.receipts.map((receipt) => receipt.blockId);
  if (HashSet.size(HashSet.fromIterable(ids)) !== ids.length) return O.some("receipt block ids must be unique");
  return Arr.findFirst(request.receipts, (receipt) => O.isSome(receiptRequestIssue(receipt))).pipe(
    O.flatMap(receiptRequestIssue),
  );
};

/**
 * Per-receipt results returned for a receipt batch.
 *
 * **Example** (Answer a batch of one)
 *
 * ```ts
 * import { ChatFirstReceiptResult, ChatFirstReceiptsResponse } from "./ChatFirst.ts"
 *
 * const response = ChatFirstReceiptsResponse.make({
 *   results: [ChatFirstReceiptResult.make({ blockId: "cfb_1", accepted: true })],
 * })
 *
 * console.log(response.results.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatFirstReceiptsResponse extends Model<ChatFirstReceiptsResponse>("ChatFirstReceiptsResponse")(
  { results: jsonList(ChatFirstReceiptResult, "results") },
  $I.annote("ChatFirstReceiptsResponse", { description: "Per-receipt results." }),
) {}

/**
 * Encoded shape of {@link ChatFirstReceiptsResponse}.
 *
 * @see {@link ChatFirstReceiptsResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatFirstReceiptsResponse {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptsResponse>;
}

const deliveryDefault = ProactiveIntentDeliveryState.pipe(
  S.withConstructorDefault(Effect.succeed<ProactiveIntentDeliveryState>("ready")),
  pg.text(),
  pg.columnName("delivery_state"),
);

/**
 * Server-scheduled chat-first block with its delivery state and timing window.
 *
 * **Details**
 *
 * Decode wire input through {@link decodeProactiveIntent} so unknown delivery states become
 * `dead_letter` instead of failing. Cross-field rules live in {@link proactiveIntentIssue}.
 *
 * **Example** (Construct an intent in the default ready state)
 *
 * ```ts
 * import { GoalLinkSpec, ProactiveIntent } from "./ChatFirst.ts"
 *
 * const intent = ProactiveIntent.make({
 *   intentId: "intent_1",
 *   block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 * })
 *
 * console.log(intent.deliveryState) // "ready"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProactiveIntent extends Model<ProactiveIntent>("ProactiveIntent")(
  {
    intentId: stableId("intent_id"),
    block: ChatFirstJournalBlockSpec.pipe(pg.jsonb(), pg.columnName("block")),
    deliveryState: deliveryDefault,
    notBefore: optionalTimestamp("not_before"),
    expiresAt: optionalTimestamp("expires_at"),
    firstDeferredAt: optionalTimestamp("first_deferred_at"),
    lastDeferralAt: optionalTimestamp("last_deferral_at"),
    deadLetterReason: optionalText("dead_letter_reason"),
  },
  $I.annote("ProactiveIntent", {
    description: "Proactive intent. Unknown delivery states decode as dead_letter through decodeProactiveIntent.",
  }),
  (columns) => [stableIdCheck("intent_id")(columns.intentId)],
) {}

/**
 * Encoded shape of {@link ProactiveIntent}.
 *
 * @see {@link ProactiveIntent} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveIntent {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntent>;
}

const decodeUnknownEffectProactiveIntent = S.decodeUnknownEffect(ProactiveIntent);

/**
 * Coerces an unknown delivery state to `dead_letter`, then decodes.
 *
 * **Example** (Collapse a future state)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { GoalLinkSpec, decodeProactiveIntent } from "./ChatFirst.ts"
 *
 * const decoded = Effect.runSync(
 *   decodeProactiveIntent({
 *     intentId: "intent_1",
 *     deliveryState: "future",
 *     block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 *   }),
 * )
 * console.log(decoded.deliveryState) // "dead_letter"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeProactiveIntent = (input: unknown) => {
  if (!isRecord(input)) return decodeUnknownEffectProactiveIntent(input);
  const repaired: { [key: string]: unknown } = { ...input };
  const state = repaired.deliveryState ?? repaired.delivery_state;
  if (state !== undefined && !isProactiveIntentDeliveryState(state)) {
    repaired.deliveryState = "dead_letter";
    repaired.delivery_state = "dead_letter";
  }
  return decodeUnknownEffectProactiveIntent(repaired);
};

/**
 * True when the intent still spends a turn budget.
 *
 * **Example** (A delivered intent does not)
 *
 * ```ts
 * import { GoalLinkSpec, ProactiveIntent, consumesTurnBudget } from "./ChatFirst.ts"
 *
 * const intent = ProactiveIntent.make({
 *   intentId: "intent_1",
 *   deliveryState: "delivered",
 *   block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 * })
 * console.log(consumesTurnBudget(intent)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const consumesTurnBudget = (intent: ProactiveIntent): boolean =>
  intent.deliveryState === "ready" || intent.deliveryState === "deferred";

/**
 * Returns the first rule a proactive intent breaks, or `None` when it is valid.
 *
 * **Details**
 *
 * Only `dead_letter` intents carry a dead-letter reason, and they must carry one. When both
 * bounds are set, `expiresAt` must not precede `notBefore`.
 *
 * **Example** (Require a dead-letter reason)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { GoalLinkSpec, ProactiveIntent, proactiveIntentIssue } from "./ChatFirst.ts"
 *
 * const intent = ProactiveIntent.make({
 *   intentId: "intent_1",
 *   deliveryState: "dead_letter",
 *   block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 * })
 *
 * console.log(O.getOrUndefined(proactiveIntentIssue(intent))) // "dead_letter intents require dead_letter_reason"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const proactiveIntentIssue = (intent: ProactiveIntent): O.Option<string> => {
  if (intent.deliveryState === "dead_letter" && O.isNone(intent.deadLetterReason)) {
    return O.some("dead_letter intents require dead_letter_reason");
  }
  if (intent.deliveryState !== "dead_letter" && O.isSome(intent.deadLetterReason)) {
    return O.some("only dead_letter intents may carry dead_letter_reason");
  }
  if (O.isSome(intent.expiresAt) && O.isSome(intent.notBefore)) {
    if (DateTime.toEpochMillis(intent.expiresAt.value) < DateTime.toEpochMillis(intent.notBefore.value)) {
      return O.some("expires_at must not be before not_before");
    }
  }
  return O.none();
};

/**
 * Proactive intent pinned to the `dead_letter` state, with a reason that defaults to `unknown`.
 *
 * **Example** (Construct with the default reason)
 *
 * ```ts
 * import { DeadLetteredProactiveIntent, GoalLinkSpec } from "./ChatFirst.ts"
 *
 * const intent = DeadLetteredProactiveIntent.make({
 *   intentId: "intent_1",
 *   deliveryState: "dead_letter",
 *   block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 * })
 *
 * console.log(intent.deadLetterReason) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeadLetteredProactiveIntent extends Model<DeadLetteredProactiveIntent>("DeadLetteredProactiveIntent")(
  {
    ...ProactiveIntent.fields,
    deliveryState: S.tag("dead_letter").pipe(pg.text(), pg.columnName("delivery_state")),
    deadLetterReason: textDefault("dead_letter_reason", "unknown"),
  },
  $I.annote("DeadLetteredProactiveIntent", { description: "Proactive intent fixed in the dead_letter state." }),
) {}

/**
 * Encoded shape of {@link DeadLetteredProactiveIntent}.
 *
 * @see {@link DeadLetteredProactiveIntent} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DeadLetteredProactiveIntent {
  export type Encoded = S.Codec.Encoded<typeof DeadLetteredProactiveIntent>;
}

/**
 * Proactive intent that can still be materialized, so it is never in the `dead_letter` state.
 *
 * **Example** (Construct with the default requeue count)
 *
 * ```ts
 * import { GoalLinkSpec, MaterializableProactiveIntent } from "./ChatFirst.ts"
 *
 * const intent = MaterializableProactiveIntent.make({
 *   intentId: "intent_1",
 *   deliveryState: "ready",
 *   block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 * })
 *
 * console.log(intent.requeueCount) // 0
 * ```
 *
 * @see {@link materializablePayload} to drop `requeueCount` before serializing.
 * @category models
 * @since 0.0.0
 */
export class MaterializableProactiveIntent extends Model<MaterializableProactiveIntent>("MaterializableProactiveIntent")(
  {
    intentId: stableId("intent_id"),
    block: ChatFirstJournalBlockSpec.pipe(pg.jsonb(), pg.columnName("block")),
    deliveryState: LiteralKit(["ready", "deferred", "delivered", "suppressed", "expired"]).pipe(
      pg.text(),
      pg.columnName("delivery_state"),
    ),
    notBefore: optionalTimestamp("not_before"),
    expiresAt: optionalTimestamp("expires_at"),
    requeueCount: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("requeue_count"),
    ),
  },
  $I.annote("MaterializableProactiveIntent", {
    description: "Intent that can be materialized. requeue_count is excluded from the Python dump.",
  }),
  (columns) => [stableIdCheck("intent_id")(columns.intentId), atLeastCheck("requeue_count", 0)(columns.requeueCount)],
) {}

/**
 * Encoded shape of {@link MaterializableProactiveIntent}.
 *
 * @see {@link MaterializableProactiveIntent} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MaterializableProactiveIntent {
  export type Encoded = S.Codec.Encoded<typeof MaterializableProactiveIntent>;
}

/**
 * Drops the excluded requeue count from a materializable intent payload.
 *
 * **Example** (Omit requeue_count)
 *
 * ```ts
 * import { GoalLinkSpec, MaterializableProactiveIntent, materializablePayload } from "./ChatFirst.ts"
 *
 * const payload = materializablePayload(
 *   MaterializableProactiveIntent.make({
 *     intentId: "intent_1",
 *     deliveryState: "ready",
 *     block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 *   }),
 * )
 * console.log("requeueCount" in payload) // false
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const materializablePayload = (intent: MaterializableProactiveIntent) => {
  const { requeueCount: _requeueCount, ...rest } = intent;
  void _requeueCount;
  return rest;
};

/**
 * Request to materialize proactive prompts for one non-negative generation.
 *
 * **Example** (Request generation three)
 *
 * ```ts
 * import { MaterializePromptsRequest } from "./ChatFirst.ts"
 *
 * const request = MaterializePromptsRequest.make({ generation: 3 })
 *
 * console.log(request.generation) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MaterializePromptsRequest extends Model<MaterializePromptsRequest>("MaterializePromptsRequest")(
  { generation: intAtLeast("generation", 0) },
  $I.annote("MaterializePromptsRequest", { description: "Asks the server to materialize prompts for one generation." }),
  (columns) => [atLeastCheck("generation", 0)(columns.generation)],
) {}

/**
 * Encoded shape of {@link MaterializePromptsRequest}.
 *
 * @see {@link MaterializePromptsRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MaterializePromptsRequest {
  export type Encoded = S.Codec.Encoded<typeof MaterializePromptsRequest>;
}

/**
 * Proactive intents produced by one materialization run.
 *
 * **Example** (Return one materialized intent)
 *
 * ```ts
 * import { GoalLinkSpec, MaterializePromptsResponse, ProactiveIntent } from "./ChatFirst.ts"
 *
 * const response = MaterializePromptsResponse.make({
 *   intents: [ProactiveIntent.make({ intentId: "intent_1", block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }) })],
 * })
 *
 * console.log(response.intents.length) // 1
 * ```
 *
 * @see {@link narrowInternalIntentsForWire} to strip deferral timestamps before sending.
 * @category models
 * @since 0.0.0
 */
export class MaterializePromptsResponse extends Model<MaterializePromptsResponse>("MaterializePromptsResponse")(
  { intents: jsonList(ProactiveIntent, "intents") },
  $I.annote("MaterializePromptsResponse", { description: "Intents produced by materialization." }),
) {}

/**
 * Encoded shape of {@link MaterializePromptsResponse}.
 *
 * @see {@link MaterializePromptsResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MaterializePromptsResponse {
  export type Encoded = S.Codec.Encoded<typeof MaterializePromptsResponse>;
}

/**
 * Drops deferral timestamps when the wire item is a full proactive intent.
 *
 * **Example** (Keep a ready intent)
 *
 * ```ts
 * import { GoalLinkSpec, MaterializePromptsResponse, ProactiveIntent, narrowInternalIntentsForWire } from "./ChatFirst.ts"
 *
 * const response = narrowInternalIntentsForWire(
 *   MaterializePromptsResponse.make({
 *     intents: [ProactiveIntent.make({
 *       intentId: "intent_1",
 *       deliveryState: "ready",
 *       block: GoalLinkSpec.make({ type: "goalLink", goalId: "goal_1", title: "Ship" }),
 *     })],
 *   }),
 * )
 * console.log(response.intents.length) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const narrowInternalIntentsForWire = (response: MaterializePromptsResponse): MaterializePromptsResponse =>
  MaterializePromptsResponse.make({
    intents: response.intents.map((intent) =>
      ProactiveIntent.make({ ...intent, firstDeferredAt: O.none(), lastDeferralAt: O.none() }),
    ),
  });

/**
 * Current proactive intents returned to a user.
 *
 * **Example** (Decode a wire response)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ProactiveIntentsResponse } from "./ChatFirst.ts"
 *
 * const response = Effect.runSync(
 *   S.decodeUnknownEffect(ProactiveIntentsResponse)({
 *     intents: [
 *       {
 *         intentId: "intent_1",
 *         deliveryState: "deferred",
 *         block: { type: "goalLink", goalId: "goal_1", title: "Ship" },
 *       },
 *     ],
 *   }),
 * )
 *
 * console.log(response.intents.map((intent) => intent.deliveryState)) // ["deferred"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProactiveIntentsResponse extends Model<ProactiveIntentsResponse>("ProactiveIntentsResponse")(
  { intents: jsonList(ProactiveIntent, "intents") },
  $I.annote("ProactiveIntentsResponse", { description: "Current proactive intents for the user." }),
) {}

/**
 * Encoded shape of {@link ProactiveIntentsResponse}.
 *
 * @see {@link ProactiveIntentsResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveIntentsResponse {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntentsResponse>;
}

/**
 * Client report of the terminal outcome for one proactive intent.
 *
 * **Example** (Report an accepted intent)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { ProactiveIntentOutcomeRequest } from "./ChatFirst.ts"
 *
 * const request = ProactiveIntentOutcomeRequest.make({
 *   outcome: "accepted",
 *   occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 *
 * console.log(request.outcome) // "accepted"
 * ```
 *
 * @see {@link outcomeRequestIssue} for the reason rule.
 * @category models
 * @since 0.0.0
 */
export class ProactiveIntentOutcomeRequest extends Model<ProactiveIntentOutcomeRequest>("ProactiveIntentOutcomeRequest")(
  {
    outcome: ProactiveIntentOutcome.pipe(pg.text(), pg.columnName("outcome")),
    occurredAt: timestamp("occurred_at"),
    reason: optionalText("reason"),
  },
  $I.annote("ProactiveIntentOutcomeRequest", { description: "Terminal outcome for one proactive intent." }),
) {}

/**
 * Encoded shape of {@link ProactiveIntentOutcomeRequest}.
 *
 * @see {@link ProactiveIntentOutcomeRequest} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveIntentOutcomeRequest {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntentOutcomeRequest>;
}

/**
 * Returns the reason rule an outcome report breaks, or `None` when it is valid.
 *
 * **Details**
 *
 * Suppressed outcomes need a reason that is not blank after trimming. Other outcomes must
 * omit the reason.
 *
 * **Example** (Reject a blank suppression reason)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { ProactiveIntentOutcomeRequest, outcomeRequestIssue } from "./ChatFirst.ts"
 *
 * const request = ProactiveIntentOutcomeRequest.make({
 *   outcome: "suppressed",
 *   occurredAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   reason: O.some("   "),
 * })
 *
 * console.log(O.getOrUndefined(outcomeRequestIssue(request))) // "suppressed outcomes require a reason"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const outcomeRequestIssue = (request: ProactiveIntentOutcomeRequest): O.Option<string> => {
  if (request.outcome === "suppressed" && (O.isNone(request.reason) || Str.trim(request.reason.value).length === 0)) {
    return O.some("suppressed outcomes require a reason");
  }
  if (request.outcome !== "suppressed" && O.isSome(request.reason)) {
    return O.some("only suppressed outcomes may carry a reason");
  }
  return O.none();
};

/**
 * Server acknowledgement that an intent's outcome was recorded.
 *
 * **Example** (Acknowledge a dismissal)
 *
 * ```ts
 * import { ProactiveIntentOutcomeResponse } from "./ChatFirst.ts"
 *
 * const ack = ProactiveIntentOutcomeResponse.make({ intentId: "intent_1", outcome: "dismissed" })
 *
 * console.log(ack.outcome) // "dismissed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProactiveIntentOutcomeResponse extends Model<ProactiveIntentOutcomeResponse>("ProactiveIntentOutcomeResponse")(
  { intentId: stableId("intent_id"), outcome: ProactiveIntentOutcome.pipe(pg.text(), pg.columnName("outcome")) },
  $I.annote("ProactiveIntentOutcomeResponse", { description: "Ack for a recorded proactive outcome." }),
  (columns) => [stableIdCheck("intent_id")(columns.intentId)],
) {}

/**
 * Encoded shape of {@link ProactiveIntentOutcomeResponse}.
 *
 * @see {@link ProactiveIntentOutcomeResponse} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveIntentOutcomeResponse {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntentOutcomeResponse>;
}

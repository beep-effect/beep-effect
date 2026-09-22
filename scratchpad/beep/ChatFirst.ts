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

export type ChatFirstBlockKind = typeof ChatFirstBlockKind.Type;

export const ChatFirstJournalBlockKind = LiteralKit([
  "questionCard",
  "taskCard",
  "goalLink",
  "captureLink",
  "conversationLink",
  "memoryLink",
  "memoryReviewCard",
]).pipe($I.annoteSchema("ChatFirstJournalBlockKind", { description: "Journal block kind, including memory review." }));

export const ChatFirstLegacyBlockKind = LiteralKit([
  "questionCard",
  "taskCard",
  "goalLink",
  "captureLink",
  "memoryLink",
]).pipe($I.annoteSchema("ChatFirstLegacyBlockKind", { description: "Legacy block kind, without conversation or review cards." }));

export const ChatFirstReceiptAction = LiteralKit(["shown", "engaged", "dismissed"]).pipe(
  $I.annoteSchema("ChatFirstReceiptAction", { description: "What the user did with a chat-first block." }),
);

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

export const ProactiveIntentOutcome = LiteralKit(["accepted", "dismissed", "expired", "suppressed"]).pipe(
  $I.annoteSchema("ProactiveIntentOutcome", { description: "Terminal outcome reported for a proactive intent." }),
);

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

export declare namespace QuestionOption {
  export type Encoded = S.Codec.Encoded<typeof QuestionOption>;
}

export class QuestionSubject extends Model<QuestionSubject>("QuestionSubject")(
  {
    kind: LiteralKit(["cold_start", "goal", "capture", "conversation", "memory"]).pipe(pg.text(), pg.columnName("kind")),
    id: stableId("id"),
  },
  $I.annote("QuestionSubject", { description: "Entity a question card is about." }),
  (columns) => [stableIdCheck("id")(columns.id)],
) {}

export declare namespace QuestionSubject {
  export type Encoded = S.Codec.Encoded<typeof QuestionSubject>;
}

export class QuestionColdStartSequence extends Model<QuestionColdStartSequence>("QuestionColdStartSequence")(
  {
    sequenceId: stableId("sequence_id"),
    step: intBetween("step", 1, 100),
  },
  $I.annote("QuestionColdStartSequence", { description: "Cold-start question sequence position." }),
  (columns) => [stableIdCheck("sequence_id")(columns.sequenceId)],
) {}

export declare namespace QuestionColdStartSequence {
  export type Encoded = S.Codec.Encoded<typeof QuestionColdStartSequence>;
}

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

export const QuestionCardSpecChecked = QuestionCardSpec.check(
  S.makeFilter((spec: QuestionCardSpec) => {
    const issue = questionCardIssue(spec);
    return O.isSome(issue) ? issue.value : undefined;
  }),
);

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

export declare namespace TaskCardSpec {
  export type Encoded = S.Codec.Encoded<typeof TaskCardSpec>;
}

export const taskCardIssue = (spec: TaskCardSpec): O.Option<string> =>
  O.isSome(spec.dueAt) && DateTime.toEpochMillis(spec.dueAt.value) < 0
    ? O.some("due_at must not be before the unix epoch")
    : O.none();

export class GoalLinkSpec extends Model<GoalLinkSpec>("GoalLinkSpec")(
  {
    type: tag("goalLink"),
    goalId: stableId("goal_id"),
    title: bounded("title", 1, 120),
  },
  $I.annote("GoalLinkSpec", { description: "Link to a goal." }),
  (columns) => [stableIdCheck("goal_id")(columns.goalId), textBoundsCheck("title", { minLength: 1, maxLength: 120 })(columns.title)],
) {}

export declare namespace GoalLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof GoalLinkSpec>;
}

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

export declare namespace CaptureLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof CaptureLinkSpec>;
}

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

export declare namespace ConversationLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof ConversationLinkSpec>;
}

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

export declare namespace MemoryLinkSpec {
  export type Encoded = S.Codec.Encoded<typeof MemoryLinkSpec>;
}

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
  if (Array.isArray(value)) return value.map(stripNulls);
  if (!isRecord(value)) return value;
  const out: { [key: string]: unknown } = {};
  for (const key of Object.keys(value)) {
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

export declare namespace ChatFirstReceiptRequest {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptRequest>;
}

export const receiptRequestIssue = (receipt: ChatFirstReceiptRequest): O.Option<string> => {
  if (receipt.action === "engaged" && O.isNone(receipt.optionId)) return O.some("engaged receipts require option_id");
  if (receipt.action !== "engaged" && O.isSome(receipt.optionId)) {
    return O.some("only engaged receipts may carry option_id");
  }
  return O.none();
};

export class ChatFirstReceiptResult extends Model<ChatFirstReceiptResult>("ChatFirstReceiptResult")(
  {
    blockId: stableId("block_id"),
    accepted: S.Boolean.pipe(pg.boolean(), pg.columnName("accepted")),
    reason: optionalText("reason"),
  },
  $I.annote("ChatFirstReceiptResult", { description: "Whether one receipt was accepted." }),
  (columns) => [stableIdCheck("block_id")(columns.blockId)],
) {}

export declare namespace ChatFirstReceiptResult {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptResult>;
}

export const receiptResultIssue = (result: ChatFirstReceiptResult): O.Option<string> => {
  if (result.accepted && O.isSome(result.reason)) return O.some("accepted receipts must not include a reason");
  if (!result.accepted && O.isNone(result.reason)) return O.some("rejected receipts require a reason");
  return O.none();
};

export class ChatFirstReceiptsRequest extends Model<ChatFirstReceiptsRequest>("ChatFirstReceiptsRequest")(
  {
    receipts: S.Array(ChatFirstReceiptRequest).check(S.isMinLength(1), S.isMaxLength(50)).pipe(pg.jsonb(), pg.columnName("receipts")),
  },
  $I.annote("ChatFirstReceiptsRequest", { description: "Batch of chat-first receipts." }),
) {}

export declare namespace ChatFirstReceiptsRequest {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptsRequest>;
}

export const receiptsRequestIssue = (request: ChatFirstReceiptsRequest): O.Option<string> => {
  const ids = request.receipts.map((receipt) => receipt.blockId);
  if (HashSet.size(HashSet.fromIterable(ids)) !== ids.length) return O.some("receipt block ids must be unique");
  return Arr.findFirst(request.receipts, (receipt) => O.isSome(receiptRequestIssue(receipt))).pipe(
    O.flatMap(receiptRequestIssue),
  );
};

export class ChatFirstReceiptsResponse extends Model<ChatFirstReceiptsResponse>("ChatFirstReceiptsResponse")(
  { results: jsonList(ChatFirstReceiptResult, "results") },
  $I.annote("ChatFirstReceiptsResponse", { description: "Per-receipt results." }),
) {}

export declare namespace ChatFirstReceiptsResponse {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstReceiptsResponse>;
}

const deliveryDefault = ProactiveIntentDeliveryState.pipe(
  S.withConstructorDefault(Effect.succeed<typeof ProactiveIntentDeliveryState.Type>("ready")),
  pg.text(),
  pg.columnName("delivery_state"),
);

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

export declare namespace ProactiveIntent {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntent>;
}

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
  if (!isRecord(input)) return S.decodeUnknownEffect(ProactiveIntent)(input);
  const repaired: { [key: string]: unknown } = { ...input };
  const state = repaired.deliveryState ?? repaired.delivery_state;
  if (state !== undefined && !S.is(ProactiveIntentDeliveryState)(state)) {
    repaired.deliveryState = "dead_letter";
    repaired.delivery_state = "dead_letter";
  }
  return S.decodeUnknownEffect(ProactiveIntent)(repaired);
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

export class DeadLetteredProactiveIntent extends Model<DeadLetteredProactiveIntent>("DeadLetteredProactiveIntent")(
  {
    ...ProactiveIntent.fields,
    deliveryState: S.tag("dead_letter").pipe(pg.text(), pg.columnName("delivery_state")),
    deadLetterReason: textDefault("dead_letter_reason", "unknown"),
  },
  $I.annote("DeadLetteredProactiveIntent", { description: "Proactive intent fixed in the dead_letter state." }),
) {}

export declare namespace DeadLetteredProactiveIntent {
  export type Encoded = S.Codec.Encoded<typeof DeadLetteredProactiveIntent>;
}

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

export class MaterializePromptsRequest extends Model<MaterializePromptsRequest>("MaterializePromptsRequest")(
  { generation: intAtLeast("generation", 0) },
  $I.annote("MaterializePromptsRequest", { description: "Asks the server to materialize prompts for one generation." }),
  (columns) => [atLeastCheck("generation", 0)(columns.generation)],
) {}

export declare namespace MaterializePromptsRequest {
  export type Encoded = S.Codec.Encoded<typeof MaterializePromptsRequest>;
}

export class MaterializePromptsResponse extends Model<MaterializePromptsResponse>("MaterializePromptsResponse")(
  { intents: jsonList(ProactiveIntent, "intents") },
  $I.annote("MaterializePromptsResponse", { description: "Intents produced by materialization." }),
) {}

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

export class ProactiveIntentsResponse extends Model<ProactiveIntentsResponse>("ProactiveIntentsResponse")(
  { intents: jsonList(ProactiveIntent, "intents") },
  $I.annote("ProactiveIntentsResponse", { description: "Current proactive intents for the user." }),
) {}

export declare namespace ProactiveIntentsResponse {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntentsResponse>;
}

export class ProactiveIntentOutcomeRequest extends Model<ProactiveIntentOutcomeRequest>("ProactiveIntentOutcomeRequest")(
  {
    outcome: ProactiveIntentOutcome.pipe(pg.text(), pg.columnName("outcome")),
    occurredAt: timestamp("occurred_at"),
    reason: optionalText("reason"),
  },
  $I.annote("ProactiveIntentOutcomeRequest", { description: "Terminal outcome for one proactive intent." }),
) {}

export declare namespace ProactiveIntentOutcomeRequest {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntentOutcomeRequest>;
}

export const outcomeRequestIssue = (request: ProactiveIntentOutcomeRequest): O.Option<string> => {
  if (request.outcome === "suppressed" && (O.isNone(request.reason) || Str.trim(request.reason.value).length === 0)) {
    return O.some("suppressed outcomes require a reason");
  }
  if (request.outcome !== "suppressed" && O.isSome(request.reason)) {
    return O.some("only suppressed outcomes may carry a reason");
  }
  return O.none();
};

export class ProactiveIntentOutcomeResponse extends Model<ProactiveIntentOutcomeResponse>("ProactiveIntentOutcomeResponse")(
  { intentId: stableId("intent_id"), outcome: ProactiveIntentOutcome.pipe(pg.text(), pg.columnName("outcome")) },
  $I.annote("ProactiveIntentOutcomeResponse", { description: "Ack for a recorded proactive outcome." }),
  (columns) => [stableIdCheck("intent_id")(columns.intentId)],
) {}

export declare namespace ProactiveIntentOutcomeResponse {
  export type Encoded = S.Codec.Encoded<typeof ProactiveIntentOutcomeResponse>;
}



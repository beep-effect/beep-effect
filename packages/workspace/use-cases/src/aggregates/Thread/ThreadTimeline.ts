/**
 * Thread timeline read model.
 *
 * @packageDocumentation
 * @category read-models
 * @since 0.0.0
 */

import { $WorkspaceUseCasesId } from "@beep/identity/packages";
import { Document } from "@beep/md/Md.model";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { MessageRole } from "@beep/workspace-domain/entities/Message";
import { Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $WorkspaceUseCasesId.create("aggregates/Thread/ThreadTimeline");

const CostMicros = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("CostMicros", {
    description: "Non-negative integer cost rollup expressed in micros.",
  })
);

/**
 * Timeline item projecting a turn's message reference to resolved content.
 *
 * **Example** (Decode message timeline item)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { TimelineMessageItem } from "@beep/workspace-use-cases/aggregates/Thread"
 *
 * const item = Effect.runSync(
 *   S.decodeUnknownEffect(TimelineMessageItem)({
 *     kind: "message",
 *     role: "user",
 *     content: { _tag: "document", children: [] },
 *   })
 * )
 * console.log(item.kind) // "message"
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class TimelineMessageItem extends S.Class<TimelineMessageItem>($I`TimelineMessageItem`)(
  {
    kind: S.tag("message").annotateKey({
      description: "Timeline item discriminator for resolved message content.",
    }),
    role: MessageRole.annotateKey({
      description: "Role of the resolved message.",
    }),
    content: Document.annotateKey({
      description: "Resolved message content in md document form.",
    }),
  },
  $I.annote("TimelineMessageItem", {
    description: "Timeline item resolving a turn message reference to its role and md-aligned content.",
  })
) {}

const turnIndexOrder = Order.mapInput(Order.Number, (turn: TimelineTurn) => turn.turnIndex);

/**
 * Timeline item placeholder for a tool-call turn item.
 *
 * **Example** (Decode tool-call timeline item)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { TimelineToolCallItem } from "@beep/workspace-use-cases/aggregates/Thread"
 *
 * const item = Effect.runSync(
 *   S.decodeUnknownEffect(TimelineToolCallItem)({
 *     kind: "tool_call",
 *     name: "search",
 *   })
 * )
 * console.log(item.name) // "search"
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class TimelineToolCallItem extends S.Class<TimelineToolCallItem>($I`TimelineToolCallItem`)(
  {
    kind: S.tag("tool_call").annotateKey({
      description: "Timeline item discriminator for a tool-call placeholder.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Non-empty tool-call name projected into the timeline.",
    }),
  },
  $I.annote("TimelineToolCallItem", {
    description: "Timeline item placeholder summarizing a turn tool-call request by name.",
  })
) {}

/**
 * Resolved timeline item for a turn.
 *
 * **Example** (Decode union timeline item)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { TimelineItem } from "@beep/workspace-use-cases/aggregates/Thread"
 *
 * const item = Effect.runSync(
 *   S.decodeUnknownEffect(TimelineItem)({
 *     kind: "tool_call",
 *     name: "search",
 *   })
 * )
 * console.log(item.kind) // "tool_call"
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export const TimelineItem = pipe(
  S.Union([TimelineMessageItem, TimelineToolCallItem]),
  $I.annoteSchema("TimelineItem", {
    description: "Resolved timeline item for a turn.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("kind"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 * Runtime type for {@link TimelineItem}.
 *
 * **Example** (Satisfy TimelineItem type)
 *
 * ```ts
 * import type { TimelineItem } from "@beep/workspace-use-cases/aggregates/Thread"
 *
 * const item = { kind: "tool_call", name: "search" } satisfies TimelineItem
 * console.log(item.kind) // "tool_call"
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export type TimelineItem = typeof TimelineItem.Type;

/**
 * Projected turn within a thread timeline.
 *
 * **Example** (Decode projected timeline turn)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { TimelineTurn } from "@beep/workspace-use-cases/aggregates/Thread"
 *
 * const turn = Effect.runSync(
 *   S.decodeUnknownEffect(TimelineTurn)({
 *     turnId: 20,
 *     turnIndex: 0,
 *     parentTurnId: null,
 *     items: [{ kind: "tool_call", name: "search" }],
 *     costMicros: 0,
 *   })
 * )
 * console.log(turn.items[0]?.kind) // "tool_call"
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class TimelineTurn extends S.Class<TimelineTurn>($I`TimelineTurn`)(
  {
    turnId: WorkspaceIdentity.TurnId.annotateKey({
      description: "Turn id projected into the timeline.",
    }),
    turnIndex: NonNegativeInt.annotateKey({
      description: "Zero-based non-negative turn order within the thread.",
    }),
    parentTurnId: S.OptionFromNullOr(WorkspaceIdentity.TurnId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional parent turn id, decoded from null when the turn is a root.",
    }),
    items: S.Array(TimelineItem).annotateKey({
      description: "Resolved visible timeline items for the turn.",
    }),
    costMicros: CostMicros.annotateKey({
      description: "Non-negative integer cost rollup expressed in micros.",
    }),
  },
  $I.annote("TimelineTurn", {
    description: "Projected turn within a thread timeline, ordered by turn index, with placeholder cost rollup.",
  })
) {}

/**
 * Read model projecting a thread's ordered turns and resolved items.
 *
 * **Example** (Decode thread timeline model)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { ThreadTimeline } from "@beep/workspace-use-cases/aggregates/Thread"
 *
 * const timeline = Effect.runSync(
 *   S.decodeUnknownEffect(ThreadTimeline)({
 *     threadId: 10,
 *     turns: [
 *       {
 *         turnId: 20,
 *         turnIndex: 0,
 *         parentTurnId: null,
 *         items: [{ kind: "tool_call", name: "search" }],
 *         costMicros: 0,
 *       },
 *     ],
 *   })
 * )
 * console.log(timeline.turns.length) // 1
 * ```
 *
 * @category read-models
 * @since 0.0.0
 */
export class ThreadTimeline extends S.Class<ThreadTimeline>($I`ThreadTimeline`)(
  {
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread id whose ordered turns are projected.",
    }),
    turns: S.Array(TimelineTurn).annotateKey({
      description: "Ordered projected turns for the thread.",
    }),
  },
  $I.annote("ThreadTimeline", {
    description: "Read model projecting a thread's ordered turns and resolved timeline items.",
  })
) {
  static readonly decodeEffect = S.decodeEffect(ThreadTimeline);
  static readonly encodeEffect = S.encodeEffect(ThreadTimeline);
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(ThreadTimeline);
  static readonly decodeUnknownSync = S.decodeUnknownSync(ThreadTimeline);
  static readonly decodeSync = S.decodeSync(ThreadTimeline);
  static readonly encodeUnknownEffect = S.encodeUnknownEffect(ThreadTimeline);
}

/**
 * The turns still part of the conversation, with every superseded branch removed.
 *
 * **Details**
 *
 * Editing a turn appends a replacement whose `parentTurnId` points at the turn it
 * replaces. The replacement therefore supersedes that turn *and* everything
 * recorded after it — the answers, and any follow-up exchange, that the old
 * wording produced.
 *
 * Nothing consumed this before: the transcript rendered every turn in index
 * order, so an "Edit" that promised to rewrite the thread from that point left
 * the old tail on screen (and in the persisted thread) once streaming finished,
 * and the model was handed that obsolete tail as history alongside the new
 * prompt. Both the renderer and the history projection read the conversation
 * through here so they agree on what the thread now says.
 *
 * **Example** (Filter superseded branch turns)
 *
 * ```ts
 * import { activeBranchTurns, ThreadTimeline } from "@beep/workspace-use-cases/aggregates/Thread"
 * import * as S from "effect/Schema"
 *
 * const timeline = S.decodeUnknownSync(ThreadTimeline)({
 *   threadId: 10,
 *   turns: [
 *     { turnId: 1, turnIndex: 0, parentTurnId: null, items: [], costMicros: 0 },
 *     { turnId: 2, turnIndex: 1, parentTurnId: null, items: [], costMicros: 0 },
 *     { turnId: 3, turnIndex: 2, parentTurnId: null, items: [], costMicros: 0 },
 *     { turnId: 4, turnIndex: 3, parentTurnId: 2, items: [], costMicros: 0 },
 *   ],
 * })
 * console.log(activeBranchTurns(timeline.turns).map((turn) => turn.turnId)) // [1, 4]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const activeBranchTurns = (turns: ReadonlyArray<TimelineTurn>): ReadonlyArray<TimelineTurn> =>
  A.reduce(A.sort(turns, turnIndexOrder), A.empty<TimelineTurn>(), (branch, turn) =>
    pipe(
      turn.parentTurnId,
      // A turn only replaces one that is already behind it. A link pointing at
      // itself, or forward at a turn that has not happened yet, cannot describe a
      // replacement — it can only be corruption. Such a link is ignored (the turn
      // simply continues the conversation) rather than trusted: an unresolvable
      // parent must never be able to truncate the transcript, which is what a
      // reader would lose if this projection took a corrupt link at its word.
      O.filter(P.not(Eq.equals(turn.turnId))),
      O.flatMap((replacedTurnId) =>
        A.findFirstIndex(
          branch,
          P.Struct({
            turnId: Eq.equals(replacedTurnId),
          })
        )
      ),
      O.map((index) => A.append(A.take(branch, index), turn)),
      O.getOrElse(() => A.append(branch, turn))
    )
  );

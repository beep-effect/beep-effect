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
 * @example
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

/**
 * Timeline item placeholder for a tool-call turn item.
 *
 * @example
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
 * @example
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
export const TimelineItem = S.Union([TimelineMessageItem, TimelineToolCallItem]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TimelineItem", {
    description: "Resolved timeline item for a turn.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link TimelineItem}.
 *
 * @example
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
 * @example
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
 * @example
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
) {}

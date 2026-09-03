/**
 * Workspace turn subsidiary value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, UnknownRecord } from "@beep/schema";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Tuple } from "effect";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/Turn/Turn.values");

/**
 * Message item in a turn aggregate.
 *
 * **Example** (Decode message item)
 *
 * ```ts
 * import { MessageItem } from "@beep/workspace-domain/entities/Turn"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(MessageItem)({
 *   itemType: "message",
 *   messageId: 1,
 * })
 * console.log(item.itemType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MessageItem extends S.Class<MessageItem>($I`MessageItem`)(
  {
    itemType: S.tag("message"),
    messageId: WorkspaceIdentity.MessageId,
  },
  $I.annote("MessageItem", {
    description: "Ordered turn item referencing persisted md-aligned message content.",
  })
) {}

/**
 * Tool call item in a turn aggregate.
 *
 * **Example** (Decode tool call item)
 *
 * ```ts
 * import { ToolCallItem } from "@beep/workspace-domain/entities/Turn"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(ToolCallItem)({
 *   itemType: "tool_call",
 *   name: "search",
 *   payload: { query: "open approval gates" },
 *   toolCallId: "tool-call-1",
 * })
 * console.log(item.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolCallItem extends S.Class<ToolCallItem>($I`ToolCallItem`)(
  {
    itemType: S.tag("tool_call"),
    name: S.NonEmptyString,
    payload: UnknownRecord,
    toolCallId: S.NonEmptyString,
  },
  $I.annote("ToolCallItem", {
    description: "Ordered turn item recording a tool invocation request.",
  })
) {}

/**
 * Tool result item in a turn aggregate.
 *
 * **Example** (Decode tool result item)
 *
 * ```ts
 * import { ToolResultItem } from "@beep/workspace-domain/entities/Turn"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(ToolResultItem)({
 *   itemType: "tool_result",
 *   payload: { count: 2 },
 *   toolCallId: "tool-call-1",
 * })
 * console.log(item.toolCallId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolResultItem extends S.Class<ToolResultItem>($I`ToolResultItem`)(
  {
    itemType: S.tag("tool_result"),
    payload: UnknownRecord,
    toolCallId: S.NonEmptyString,
  },
  $I.annote("ToolResultItem", {
    description: "Ordered turn item recording the result of a tool invocation.",
  })
) {}

/**
 * Artifact reference item in a turn aggregate.
 *
 * **Example** (Decode artifact ref item)
 *
 * ```ts
 * import { ArtifactRefItem } from "@beep/workspace-domain/entities/Turn"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(ArtifactRefItem)({
 *   artifactId: 1,
 *   itemType: "artifact_ref",
 * })
 * console.log(item.itemType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArtifactRefItem extends S.Class<ArtifactRefItem>($I`ArtifactRefItem`)(
  {
    artifactId: WorkspaceIdentity.EmailArtifactId,
    itemType: S.tag("artifact_ref"),
  },
  $I.annote("ArtifactRefItem", {
    description: "Ordered turn item referencing a workspace artifact.",
  })
) {}

/**
 * Activity reference item in a turn aggregate.
 *
 * **Example** (Decode activity item)
 *
 * ```ts
 * import { ActivityItem } from "@beep/workspace-domain/entities/Turn"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(ActivityItem)({
 *   activityId: 1,
 *   itemType: "activity",
 * })
 * console.log(item.activityId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActivityItem extends S.Class<ActivityItem>($I`ActivityItem`)(
  {
    activityId: EpistemicIdentity.ActivityId,
    itemType: S.tag("activity"),
  },
  $I.annote("ActivityItem", {
    description: "Ordered turn item linking runtime provenance activity.",
  })
) {}

const TurnItemTag = LiteralKit(["message", "tool_call", "tool_result", "artifact_ref", "activity"]);

/**
 * Ordered typed item held by a turn aggregate.
 *
 * **Example** (Decode turn item union)
 *
 * ```ts
 * import { TurnItem } from "@beep/workspace-domain/entities/Turn"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(TurnItem)({
 *   itemType: "tool_call",
 *   name: "search",
 *   payload: {},
 *   toolCallId: "tool-call-1",
 * })
 * console.log(item.itemType)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurnItem = TurnItemTag.mapMembers(
  Tuple.evolve([() => MessageItem, () => ToolCallItem, () => ToolResultItem, () => ArtifactRefItem, () => ActivityItem])
)
  .pipe(S.toTaggedUnion("itemType"))
  .annotate(
    $I.annote("TurnItem", {
      description: "Ordered typed item held by a turn aggregate.",
    })
  );

/**
 * Runtime type for {@link TurnItem}.
 *
 * **Example** (Annotate turn item type)
 *
 * ```ts
 * import type { TurnItem } from "@beep/workspace-domain/entities/Turn"
 *
 * const item: TurnItem = {
 *   itemType: "tool_result",
 *   payload: { ok: true },
 *   toolCallId: "tool-call-1",
 * }
 * console.log(item.itemType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnItem = typeof TurnItem.Type;

/**
 * Ordered turn item list.
 *
 * **Example** (Decode turn items list)
 *
 * ```ts
 * import { TurnItems } from "@beep/workspace-domain/entities/Turn"
 * import * as S from "effect/Schema"
 *
 * const items = S.decodeUnknownSync(TurnItems)([
 *   { itemType: "message", messageId: 1 },
 *   {
 *     itemType: "tool_call",
 *     name: "search",
 *     payload: { query: "thread context" },
 *     toolCallId: "tool-call-1",
 *   },
 * ])
 * console.log(items.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurnItems = S.NonEmptyArray(TurnItem).pipe(
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "encodeSync"]),
  $I.annoteSchema("TurnItems", {
    description: "Non-empty ordered list of typed items held by a turn aggregate.",
  })
);

/**
 * Runtime type for {@link TurnItems}.
 *
 * **Example** (Annotate turn items type)
 *
 * ```ts
 * import type { TurnItems } from "@beep/workspace-domain/entities/Turn"
 *
 * const items: TurnItems = [
 *   {
 *     itemType: "tool_call",
 *     name: "search",
 *     payload: { query: "thread context" },
 *     toolCallId: "tool-call-1",
 *   },
 * ]
 * console.log(items[0]?.itemType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnItems = typeof TurnItems.Type;

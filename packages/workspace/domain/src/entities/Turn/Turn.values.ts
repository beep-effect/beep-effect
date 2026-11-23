/**
 * Workspace turn subsidiary value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const UnknownRecord = S.Record(S.String, S.Unknown);

const $I = $WorkspaceDomainId.create("entities/Turn/Turn.values");

/**
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
export class MessageItem extends S.Opaque<MessageItem, { readonly brand: unique symbol }>()(
  S.Struct({
    itemType: S.tag("message"),
    messageId: WorkspaceIdentity.MessageId,
  }).pipe(
    $I.annoteSchema("MessageItem", {
      description: "Ordered turn item referencing persisted md-aligned message content.",
    })
  )
) {}

/**
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
export class ToolCallItem extends S.Opaque<ToolCallItem, { readonly brand: unique symbol }>()(
  S.Struct({
    itemType: S.tag("tool_call"),
    name: S.NonEmptyString,
    payload: UnknownRecord,
    toolCallId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ToolCallItem", {
      description: "Ordered turn item recording a tool invocation request.",
    })
  )
) {}

/**
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
export class ToolResultItem extends S.Opaque<ToolResultItem, { readonly brand: unique symbol }>()(
  S.Struct({
    itemType: S.tag("tool_result"),
    payload: UnknownRecord,
    toolCallId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ToolResultItem", {
      description: "Ordered turn item recording the result of a tool invocation.",
    })
  )
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
export class ArtifactRefItem extends S.Opaque<ArtifactRefItem, { readonly brand: unique symbol }>()(
  S.Struct({
    artifactId: WorkspaceIdentity.EmailArtifactId,
    itemType: S.tag("artifact_ref"),
  }).pipe(
    $I.annoteSchema("ArtifactRefItem", {
      description: "Ordered turn item referencing a workspace artifact.",
    })
  )
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
export class ActivityItem extends S.Opaque<ActivityItem, { readonly brand: unique symbol }>()(
  S.Struct({
    activityId: EpistemicIdentity.ActivityId,
    itemType: S.tag("activity"),
  }).pipe(
    $I.annoteSchema("ActivityItem", {
      description: "Ordered turn item linking runtime provenance activity.",
    })
  )
) {}

const TurnItemTag = LiteralKit(["message", "tool_call", "tool_result", "artifact_ref", "activity"]);

/**
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
).pipe(
  S.toTaggedUnion("itemType"),
  $I.annoteSchema("TurnItem", {
    description: "Ordered typed item held by a turn aggregate.",
  })
);

/**
 * **Example** (Annotate turn item type)
 *
 * ```ts
 * import { ToolResultItem, type TurnItem } from "@beep/workspace-domain/entities/Turn"
 *
 * const item: TurnItem = ToolResultItem.make({
 *   payload: { ok: true },
 *   toolCallId: "tool-call-1",
 * })
 * console.log(item.itemType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnItem = typeof TurnItem.Type;

/**
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
  $I.annoteSchema("TurnItems", {
    description: "Non-empty ordered list of typed items held by a turn aggregate.",
  })
);

/**
 * **Example** (Annotate turn items type)
 *
 * ```ts
 * import { ToolCallItem, type TurnItems } from "@beep/workspace-domain/entities/Turn"
 *
 * const items: TurnItems = [
 *   ToolCallItem.make({
 *     name: "search",
 *     payload: { query: "thread context" },
 *     toolCallId: "tool-call-1",
 *   }),
 * ]
 * console.log(items[0]?.itemType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnItems = typeof TurnItems.Type;

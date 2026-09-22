/**
 * AI-generated tasks awaiting promotion to action items.
 *
 * Response wire shapes for `/v1/staged-tasks*`. Collection:
 * `users/{uid}/staged_tasks`.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Model, bool, optionalNull, optionalText, optionalTimestamp, pg, text, timestamp } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/StagedTask");

const zero = (column: string) =>
  S.Int.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.integer(), pg.columnName(column));

const ackStatus = () =>
  S.String.annotateKey({ description: 'Ack status, e.g. "ok".' }).pipe(
    S.withConstructorDefault(Effect.succeed("ok")),
    pg.text(),
    pg.columnName("status"),
  );

const hasMore = (description: string) =>
  S.Boolean.annotateKey({ description }).pipe(
    S.withConstructorDefault(Effect.succeed(false)),
    pg.boolean(),
    pg.columnName("has_more"),
  );

/**
 * One staged task waiting for promotion to an action item.
 *
 * **Details**
 *
 * A single staged task awaiting promotion to an action item. `id` is the
 * staged-task identifier. `description` is the task text. `completed` says
 * whether it has been closed or promoted. `createdAt` and `updatedAt` are UTC
 * timestamps. `dueAt` is the optional due date. `source` is the origin, such
 * as a screenshot extraction. `priority` is an open string; high, medium, and
 * low are examples only. `metadata` is an opaque string, not a dictionary.
 * `category` is the task category. `relevanceScore` is documented as 0..1000
 * for promotion ordering.
 *
 * **Gotchas**
 *
 * Do not close `priority`. Do not reject a relevance score outside 0..1000.
 * That range is a comment, not a `Field` constraint.
 *
 * **Example** (Decode a staged task)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { StagedTask } from "@beep/scratchpad/beep/StagedTask"
 *
 * const task = Effect.runSync(
 *   S.decodeUnknownEffect(StagedTask)({
 *     id: "staged-1",
 *     description: "Send the notes",
 *     completed: false,
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     updatedAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(task.id) // "staged-1"
 * console.log(O.isNone(task.priority)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StagedTask extends Model<StagedTask>("StagedTask")(
  {
    id: text("id"),
    description: text("description"),
    completed: bool("completed"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    dueAt: optionalTimestamp("due_at"),
    source: optionalText("source"),
    priority: optionalText("priority"),
    metadata: optionalText("metadata"),
    category: optionalText("category"),
    relevanceScore: optionalNull(S.Int).pipe(pg.integer(), pg.columnName("relevance_score")),
  },
  $I.annote("StagedTask", {
    description: "AI-generated task awaiting promotion to an action item.",
  }),
) {}

/**
 * Encoded staged task before decoding.
 *
 * @see {@link StagedTask} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StagedTask {
  export type Encoded = S.Codec.Encoded<typeof StagedTask>;
}

/**
 * One page of staged tasks.
 *
 * **Details**
 *
 * Paginated list of staged tasks. `items` is the current page. `hasMore` says
 * whether another page exists.
 *
 * **Example** (Decode an empty page)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StagedTaskListResponse } from "@beep/scratchpad/beep/StagedTask"
 *
 * const page = Effect.runSync(
 *   S.decodeUnknownEffect(StagedTaskListResponse)({ items: [], hasMore: false }),
 * )
 * console.log(page.items.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StagedTaskListResponse extends Model<StagedTaskListResponse>("StagedTaskListResponse")(
  {
    items: S.Array(StagedTask).pipe(pg.jsonb(), pg.columnName("items")),
    hasMore: bool("has_more"),
  },
  $I.annote("StagedTaskListResponse", {
    description: "One page of staged tasks and whether another page exists.",
  }),
) {}

/**
 * Encoded staged-task page before decoding.
 *
 * @see {@link StagedTaskListResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StagedTaskListResponse {
  export type Encoded = S.Codec.Encoded<typeof StagedTaskListResponse>;
}

/**
 * Outcome of promoting the highest-relevance staged task.
 *
 * **Details**
 *
 * Outcome of promoting the top-relevance staged task to an action item.
 * `promoted` says whether a task was promoted. `reason` says why promotion
 * was skipped, for example "No staged tasks available". `promotedTask` is the
 * promoted action-item document when promotion happened.
 *
 * **Gotchas**
 *
 * `promotedTask` stays an opaque JSON object. It is not `ActionItemResponse`.
 * The action-item document owns fields this domain must not restate, and the
 * stored document can include staged-enrichment fields that the canonical
 * action-item response omits.
 *
 * **Example** (Decode a skipped promotion)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PromoteStagedTaskResponse } from "@beep/scratchpad/beep/StagedTask"
 *
 * const skipped = Effect.runSync(
 *   S.decodeUnknownEffect(PromoteStagedTaskResponse)({
 *     promoted: false,
 *     reason: "No staged tasks available",
 *   }),
 * )
 * console.log(skipped.promoted) // false
 * console.log(O.isNone(skipped.promotedTask)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PromoteStagedTaskResponse extends Model<PromoteStagedTaskResponse>("PromoteStagedTaskResponse")(
  {
    promoted: bool("promoted"),
    reason: optionalText("reason"),
    promotedTask: optionalNull(S.JsonObject).pipe(pg.jsonb(), pg.columnName("promoted_task")),
  },
  $I.annote("PromoteStagedTaskResponse", {
    description: "Whether the top-relevance staged task was promoted, and the opaque action-item document.",
  }),
) {}

/**
 * Encoded promotion outcome before decoding.
 *
 * @see {@link PromoteStagedTaskResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PromoteStagedTaskResponse {
  export type Encoded = S.Codec.Encoded<typeof PromoteStagedTaskResponse>;
}

/**
 * Compatibility body for the retired conversation-item migration route.
 *
 * **Details**
 *
 * Compatibility response for the retired conversation migration route. The
 * released `migrated` and `deleted` fields stay response-compatible for older
 * desktop clients. The route now reports restoration of explicitly marked
 * legacy rows instead of moving live action items. `restored` counts restored
 * legacy action items. `skippedExisting` counts marked rows left staged
 * because a current action item with that identity already exists.
 *
 * **Gotchas**
 *
 * `migrated` and `deleted` are described as always zero, and `hasMore` as
 * always false, and `nextCursor` as always absent. Those sentences are
 * comments, not validators. A present `hasMore: true` still decodes.
 *
 * **Example** (Construct the compatibility defaults)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MigrateConversationItemsResponse } from "@beep/scratchpad/beep/StagedTask"
 *
 * const body = MigrateConversationItemsResponse.make({})
 * console.log(body.status) // "ok"
 * console.log(body.migrated) // 0
 * console.log(body.deleted) // 0
 * console.log(O.isNone(body.nextCursor)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MigrateConversationItemsResponse extends Model<MigrateConversationItemsResponse>(
  "MigrateConversationItemsResponse",
)(
  {
    status: ackStatus(),
    migrated: zero("migrated"),
    deleted: zero("deleted"),
    restored: zero("restored"),
    skippedExisting: zero("skipped_existing"),
    hasMore: hasMore("Always false: the released single-call route completes recovery before acknowledging success."),
    nextCursor: optionalText("next_cursor"),
  },
  $I.annote("MigrateConversationItemsResponse", {
    description: "Retired conversation-migration acknowledgement kept for older desktop clients.",
  }),
) {}

/**
 * Encoded retired migration acknowledgement before decoding.
 *
 * @see {@link MigrateConversationItemsResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MigrateConversationItemsResponse {
  export type Encoded = S.Codec.Encoded<typeof MigrateConversationItemsResponse>;
}

/**
 * Outcome of the safe action-item recovery endpoint.
 *
 * **Details**
 *
 * Outcome of the safe action-items recovery endpoint. `restored` counts
 * action items safely restored. `skippedExisting` counts rows left staged
 * because an action item with that identity already exists. `hasMore` says
 * whether more marked legacy rows remain after this page. `nextCursor` is the
 * exclusive recovery cursor for the next page.
 *
 * **Gotchas**
 *
 * The cursor is described as present only when `hasMore` is true. That pairing
 * is not enforced.
 *
 * **Example** (Construct a finished recovery page)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { RestoreLegacyConversationItemsResponse } from "@beep/scratchpad/beep/StagedTask"
 *
 * const page = RestoreLegacyConversationItemsResponse.make({})
 * console.log(page.restored) // 0
 * console.log(page.hasMore) // false
 * console.log(O.isNone(page.nextCursor)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RestoreLegacyConversationItemsResponse extends Model<RestoreLegacyConversationItemsResponse>(
  "RestoreLegacyConversationItemsResponse",
)(
  {
    status: ackStatus(),
    restored: zero("restored"),
    skippedExisting: zero("skipped_existing"),
    hasMore: hasMore("Whether more marked legacy rows remain after this recovery page."),
    nextCursor: optionalText("next_cursor"),
  },
  $I.annote("RestoreLegacyConversationItemsResponse", {
    description: "One page of safe action-item recovery from marked legacy rows.",
  }),
) {}

/**
 * Encoded legacy recovery page before decoding.
 *
 * @see {@link RestoreLegacyConversationItemsResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RestoreLegacyConversationItemsResponse {
  export type Encoded = S.Codec.Encoded<typeof RestoreLegacyConversationItemsResponse>;
}

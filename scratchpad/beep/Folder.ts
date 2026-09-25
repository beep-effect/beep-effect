/**
 * Conversation folders.
 *
 * **Details**
 *
 * A folder groups conversations. `category_mapping` is an open string whose
 * note points at a category value such as `romantic`, not an enum name.
 * Create requests do not copy the stored color and icon defaults.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { boundedText, optionalBoundedText, optionalText, text, textBoundsCheck, timestamp } from "./Kit.ts";
import { boolDefault, intDefault, Model, optionalNull, pg, Table } from "./Port.ts";

const $I = $ScratchpadId.create("beep/Folder");

const nameBounds = { minLength: 1, maxLength: 100 };
const descriptionBounds = { maxLength: 500 };

/**
 * Folder write was rejected.
 *
 * **Example** (Build a duplicate-id error)
 *
 * ```ts
 * import { FolderContractError } from "@beep/scratchpad/beep/Folder"
 *
 * const error = new FolderContractError({ message: "folder_ids must not contain duplicates" })
 * console.log(error.message) // "folder_ids must not contain duplicates"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FolderContractError extends S.TaggedError<FolderContractError>()(
  "FolderContractError",
  { message: S.String },
  $I.annoteError<FolderContractError>("FolderContractError", {
    description: "A folder request failed its duplicate-id rule.",
  }),
) {}

/**
 * Encoded form of {@link FolderContractError}.
 *
 * @see {@link FolderContractError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FolderContractError {
  export type Encoded = S.Codec.Encoded<typeof FolderContractError>;
}

/**
 * Rejects a folder order that lists the same id twice.
 *
 * **Details**
 *
 * The Python validator compares the list length with the length of its set.
 * Order is preserved for unique lists.
 *
 * **Example** (Reject a repeated id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { rejectDuplicateFolderIds } from "@beep/scratchpad/beep/Folder"
 *
 * const failed = Effect.runSyncExit(rejectDuplicateFolderIds(["a", "a"]))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @category validators
 * @since 0.0.0
 */
export const rejectDuplicateFolderIds = Effect.fn("ReorderFoldersRequest.rejectDuplicateFolderIds")(function* (
  folderIds: ReadonlyArray<string>,
) {
  if (A.dedupe(folderIds).length !== folderIds.length) {
    return yield* FolderContractError.make({ message: "folder_ids must not contain duplicates" });
  }
  return folderIds;
});

/**
 * A folder that organizes conversations.
 *
 * **Details**
 *
 * `name` is 1 to 100 characters. `description` is a natural-language
 * instruction for AI assignment, at most 500 characters, and null when unset.
 * `color` constructs as `#6B7280` and `icon` as `folder`. `is_system` is true
 * for category-based default folders. `order` and `conversation_count`
 * construct as 0.
 *
 * **Gotchas**
 *
 * Color and icon defaults apply at construction, not when a decoded row omits
 * them. Create requests leave those fields nullable.
 *
 * **Example** (Construct the stored defaults)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Folder } from "@beep/scratchpad/beep/Folder"
 *
 * const createdAt = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const folder = Folder.make({ id: "f1", name: "Work", createdAt, updatedAt: createdAt })
 * console.log(folder.color) // "#6B7280"
 * console.log(folder.icon) // "folder"
 * console.log(folder.order) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Folder extends Model<Folder>("Folder")(
  {
    id: text("id"),
    name: boundedText("name", nameBounds),
    description: optionalBoundedText("description", descriptionBounds),
    color: S.String.pipe(S.withConstructorDefault(Effect.succeed("#6B7280")), pg.text(), pg.columnName("color")),
    icon: S.String.pipe(S.withConstructorDefault(Effect.succeed("folder")), pg.text(), pg.columnName("icon")),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    order: intDefault("order", 0),
    isDefault: boolDefault("is_default", false),
    isSystem: boolDefault("is_system", false),
    categoryMapping: optionalText("category_mapping"),
    conversationCount: intDefault("conversation_count", 0),
  },
  $I.annote("Folder", {
    description: "Folder that organizes conversations, including system folders mapped from categories.",
  }),
  (columns: { readonly name: ExtraConfigColumn; readonly description: ExtraConfigColumn }) => [
    textBoundsCheck("name", nameBounds)(columns.name),
    textBoundsCheck("description", descriptionBounds)(columns.description),
  ],
) {}

/**
 * Encoded form of {@link Folder}.
 *
 * @see {@link FolderWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Folder {
  export type Encoded = S.Codec.Encoded<typeof Folder>;
}

/**
 * Snake_case codec for {@link Folder}.
 *
 * **Example** (Decode a null description)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { FolderWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(FolderWire)({
 *     id: "f1",
 *     name: "Work",
 *     description: null,
 *     color: "#6B7280",
 *     icon: "folder",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *     updated_at: "2020-01-02T03:04:05.000Z",
 *     order: 0,
 *     is_default: false,
 *     is_system: false,
 *     category_mapping: null,
 *     conversation_count: 0,
 *   }),
 * )
 * console.log(O.isNone(decoded.description)) // true
 * ```
 *
 * @see {@link Folder} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const FolderWire = Folder.pipe(
  S.encodeKeys({
    createdAt: "created_at",
    updatedAt: "updated_at",
    isDefault: "is_default",
    isSystem: "is_system",
    categoryMapping: "category_mapping",
    conversationCount: "conversation_count",
  }),
);

/**
 * Request to create a folder.
 *
 * **Details**
 *
 * `color` and `icon` are nullable. They do not default to the stored folder
 * color or icon. `description` is the AI assignment instruction.
 *
 * **Example** (Decode null color and icon)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CreateFolderRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(CreateFolderRequestWire)({ name: "Work", description: null, color: null, icon: null }),
 * )
 * console.log(O.isNone(decoded.color)) // true
 * console.log(O.isNone(decoded.icon)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateFolderRequest extends Model<CreateFolderRequest>("CreateFolderRequest")(
  {
    name: boundedText("name", nameBounds),
    description: optionalBoundedText("description", descriptionBounds),
    color: optionalText("color"),
    icon: optionalText("icon"),
  },
  $I.annote("CreateFolderRequest", {
    description: "Create-folder request. Color and icon stay nullable instead of using stored defaults.",
  }),
  (columns: { readonly name: ExtraConfigColumn; readonly description: ExtraConfigColumn }) => [
    textBoundsCheck("name", nameBounds)(columns.name),
    textBoundsCheck("description", descriptionBounds)(columns.description),
  ],
) {}

/**
 * Encoded form of {@link CreateFolderRequest}.
 *
 * @see {@link CreateFolderRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CreateFolderRequest {
  export type Encoded = S.Codec.Encoded<typeof CreateFolderRequest>;
}

/**
 * Snake_case codec for {@link CreateFolderRequest}.
 *
 * **Example** (Reject an empty name)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CreateFolderRequest } from "@beep/scratchpad/beep/Folder"
 *
 * const failed = Effect.runSyncExit(S.decodeUnknownEffect(CreateFolderRequest)({ name: "" }))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link CreateFolderRequest} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const CreateFolderRequestWire = CreateFolderRequest;

/**
 * Patch for folder metadata.
 *
 * **Details**
 *
 * Every field is nullable. Omission and null both become `None`. `name`, when
 * present, is 1 to 100 characters. `description` is at most 500.
 *
 * **Gotchas**
 *
 * The Python model has no `model_fields_set` guard, so a patch cannot tell a
 * cleared field from one the client left alone.
 *
 * **Example** (Decode a null name)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { UpdateFolderRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(UpdateFolderRequestWire)({ name: null }))
 * console.log(O.isNone(decoded.name)) // true
 * console.log(O.isNone(decoded.order)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UpdateFolderRequest extends Model<UpdateFolderRequest>("UpdateFolderRequest")(
  {
    name: optionalBoundedText("name", nameBounds),
    description: optionalBoundedText("description", descriptionBounds),
    color: optionalText("color"),
    icon: optionalText("icon"),
    order: S.Int.pipe(optionalNull, pg.integer(), pg.columnName("order")),
  },
  $I.annote("UpdateFolderRequest", {
    description: "Folder metadata patch. Null and omission are both None.",
  }),
  (columns: { readonly name: ExtraConfigColumn; readonly description: ExtraConfigColumn }) => [
    textBoundsCheck("name", nameBounds)(columns.name),
    textBoundsCheck("description", descriptionBounds)(columns.description),
  ],
) {}

/**
 * Encoded form of {@link UpdateFolderRequest}.
 *
 * @see {@link UpdateFolderRequestWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UpdateFolderRequest {
  export type Encoded = S.Codec.Encoded<typeof UpdateFolderRequest>;
}

/**
 * Snake_case codec for {@link UpdateFolderRequest}.
 *
 * **Example** (Decode a missing patch)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { UpdateFolderRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(UpdateFolderRequestWire)({}))
 * console.log(O.isNone(decoded.icon)) // true
 * ```
 *
 * @see {@link UpdateFolderRequest} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const UpdateFolderRequestWire = UpdateFolderRequest;

/**
 * Moves one conversation into a folder.
 *
 * **Details**
 *
 * `folder_id` null is accepted. The schema does not define what a null
 * destination means; that stays a service decision.
 *
 * **Example** (Decode a null destination)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MoveConversationRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MoveConversationRequestWire)({ folder_id: null }))
 * console.log(O.isNone(decoded.folderId)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MoveConversationRequest extends Model<MoveConversationRequest>("MoveConversationRequest")(
  {
    folderId: optionalText("folder_id"),
  },
  $I.annote("MoveConversationRequest", {
    description: "Moves one conversation. A null folder id is preserved as None.",
  }),
) {}

/**
 * Encoded form of {@link MoveConversationRequest}.
 *
 * @see {@link MoveConversationRequestWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MoveConversationRequest {
  export type Encoded = S.Codec.Encoded<typeof MoveConversationRequest>;
}

/**
 * Snake_case codec for {@link MoveConversationRequest}.
 *
 * **Example** (Decode a folder id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MoveConversationRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MoveConversationRequestWire)({ folder_id: "f1" }))
 * console.log(O.getOrElse(decoded.folderId, () => "")) // "f1"
 * ```
 *
 * @see {@link MoveConversationRequest} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const MoveConversationRequestWire = MoveConversationRequest.pipe(S.encodeKeys({ folderId: "folder_id" }));

/**
 * Moves many conversations.
 *
 * **Details**
 *
 * The destination folder is not in this body. The list has no minimum length;
 * a merge request elsewhere requires two ids, and this model does not.
 *
 * **Example** (Decode two conversation ids)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BulkMoveConversationsRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(BulkMoveConversationsRequestWire)({ conversation_ids: ["c1", "c2"] }),
 * )
 * console.log(decoded.conversationIds.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BulkMoveConversationsRequest extends Model<BulkMoveConversationsRequest>(
  "BulkMoveConversationsRequest",
)(
  {
    conversationIds: S.Array(S.String).pipe(pg.array(S.String.pipe(pg.text())), pg.columnName("conversation_ids")),
  },
  $I.annote("BulkMoveConversationsRequest", {
    description: "Moves many conversations. The destination folder is not part of the body.",
  }),
) {}

/**
 * Encoded form of {@link BulkMoveConversationsRequest}.
 *
 * @see {@link BulkMoveConversationsRequestWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BulkMoveConversationsRequest {
  export type Encoded = S.Codec.Encoded<typeof BulkMoveConversationsRequest>;
}

/**
 * Snake_case codec for {@link BulkMoveConversationsRequest}.
 *
 * **Example** (Encode the id list key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BulkMoveConversationsRequest, BulkMoveConversationsRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const encoded = Effect.runSync(
 *   S.encodeEffect(BulkMoveConversationsRequestWire)(BulkMoveConversationsRequest.make({ conversationIds: ["c1"] })),
 * )
 * console.log(encoded.conversation_ids.length) // 1
 * ```
 *
 * @see {@link BulkMoveConversationsRequest} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const BulkMoveConversationsRequestWire = BulkMoveConversationsRequest.pipe(
  S.encodeKeys({ conversationIds: "conversation_ids" }),
);

/**
 * New display order for folders.
 *
 * **Details**
 *
 * `folder_ids` has 1 to 100 entries and must not repeat an id.
 * {@link rejectDuplicateFolderIds} is the Python validator.
 *
 * **Example** (Reject duplicates)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { rejectDuplicateFolderIds } from "@beep/scratchpad/beep/Folder"
 *
 * const ids = Effect.runSync(rejectDuplicateFolderIds(["a", "b"]))
 * console.log(ids.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReorderFoldersRequest extends Model<ReorderFoldersRequest>("ReorderFoldersRequest")(
  {
    folderIds: S.Array(S.String)
      .check(S.makeFilterGroup(
        [
          S.isBetweenLength(1, 100), S.isUnique()
        ]
      ))
      .pipe(pg.array(S.String.pipe(pg.text())), pg.columnName("folder_ids")),
  },
  $I.annote("ReorderFoldersRequest", {
    description: "Ordered folder ids, one to one hundred, without duplicates.",
  }),
  (columns: { readonly folderIds: ExtraConfigColumn }) => [
    Table.check("folder_ids_len")(
      sql<boolean>`cardinality(${columns.folderIds}) >= ${sql.raw("1")} and cardinality(${columns.folderIds}) <= ${sql.raw("100")}`,
    ),
  ],
) {}

/**
 * Encoded form of {@link ReorderFoldersRequest}.
 *
 * @see {@link ReorderFoldersRequestWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ReorderFoldersRequest {
  export type Encoded = S.Codec.Encoded<typeof ReorderFoldersRequest>;
}

/**
 * Snake_case codec for {@link ReorderFoldersRequest}.
 *
 * **Example** (Decode a unique order)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ReorderFoldersRequestWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ReorderFoldersRequestWire)({ folder_ids: ["b", "a"] }))
 * console.log(decoded.folderIds[0]) // "b"
 * ```
 *
 * @see {@link rejectDuplicateFolderIds} for the duplicate check.
 * @category codecs
 * @since 0.0.0
 */
export const ReorderFoldersRequestWire = ReorderFoldersRequest.pipe(S.encodeKeys({ folderIds: "folder_ids" }));

/**
 * Status line for a folder mutation.
 *
 * **Details**
 *
 * `status` is an open string. Callers choose the words.
 *
 * **Example** (Decode ok)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { FolderMutationResponse } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(FolderMutationResponse)({ status: "ok" }))
 * console.log(decoded.status) // "ok"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FolderMutationResponse extends Model<FolderMutationResponse>("FolderMutationResponse")(
  {
    status: text("status"),
  },
  $I.annote("FolderMutationResponse", {
    description: "Status string returned by folder mutation endpoints.",
  }),
) {}

/**
 * Encoded form of {@link FolderMutationResponse}.
 *
 * @see {@link FolderMutationResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FolderMutationResponse {
  export type Encoded = S.Codec.Encoded<typeof FolderMutationResponse>;
}

/**
 * Result of moving many conversations.
 *
 * **Details**
 *
 * Extends the status response with `moved_count`, which constructs as 0.
 *
 * **Example** (Construct a zero move count)
 *
 * ```ts
 * import { BulkMoveConversationsResponse } from "@beep/scratchpad/beep/Folder"
 *
 * console.log(BulkMoveConversationsResponse.make({ status: "ok" }).movedCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BulkMoveConversationsResponse extends Model<BulkMoveConversationsResponse>(
  "BulkMoveConversationsResponse",
)(
  {
    status: text("status"),
    movedCount: intDefault("moved_count", 0),
  },
  $I.annote("BulkMoveConversationsResponse", {
    description: "Bulk move result: a status string and how many conversations moved.",
  }),
) {}

/**
 * Encoded form of {@link BulkMoveConversationsResponse}.
 *
 * @see {@link BulkMoveConversationsResponseWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BulkMoveConversationsResponse {
  export type Encoded = S.Codec.Encoded<typeof BulkMoveConversationsResponse>;
}

/**
 * Snake_case codec for {@link BulkMoveConversationsResponse}.
 *
 * **Example** (Decode a move count)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BulkMoveConversationsResponseWire } from "@beep/scratchpad/beep/Folder"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(BulkMoveConversationsResponseWire)({ status: "ok", moved_count: 2 }),
 * )
 * console.log(decoded.movedCount) // 2
 * ```
 *
 * @see {@link BulkMoveConversationsResponse} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const BulkMoveConversationsResponseWire = BulkMoveConversationsResponse.pipe(
  S.encodeKeys({ movedCount: "moved_count" }),
);

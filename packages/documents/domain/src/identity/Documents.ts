/**
 * Documents slice-local entity identifiers.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import * as EntityId from "@beep/shared-domain/entity/EntityId";

const $I = $DocumentsDomainId.create("identity/Documents");
const make = EntityId.factory("documents", $I);

/**
 * Documents SyncItem entity identifier.
 *
 * @example
 * ```ts
 * import { SyncItemId, type SyncItemId as SyncItemIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncItemIdValue = S.decodeUnknownSync(SyncItemId)(1)
 *
 * if (id !== 1 || SyncItemId.tableName !== "documents_sync_item") {
 *   throw new Error("expected documents SyncItem identity")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const SyncItemId = make("sync_item", {
  description: "Identifier for a documents SyncItem sync-tracking row.",
});

/**
 * Runtime type for {@link SyncItemId}.
 *
 * @example
 * ```ts
 * import { SyncItemId, type SyncItemId as SyncItemIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncItemIdValue = S.decodeUnknownSync(SyncItemId)(1)
 * const ids: ReadonlyArray<SyncItemIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected SyncItem id type evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type SyncItemId = typeof SyncItemId.Type;

/**
 * Documents SyncOperation entity identifier.
 *
 * @example
 * ```ts
 * import { SyncOperationId, type SyncOperationId as SyncOperationIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncOperationIdValue = S.decodeUnknownSync(SyncOperationId)(1)
 *
 * if (id !== 1 || SyncOperationId.tableName !== "documents_sync_operation") {
 *   throw new Error("expected documents SyncOperation identity")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const SyncOperationId = make("sync_operation", {
  description: "Identifier for a documents SyncOperation outbox row.",
});

/**
 * Runtime type for {@link SyncOperationId}.
 *
 * @example
 * ```ts
 * import { SyncOperationId, type SyncOperationId as SyncOperationIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncOperationIdValue = S.decodeUnknownSync(SyncOperationId)(1)
 * const ids: ReadonlyArray<SyncOperationIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected SyncOperation id type evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type SyncOperationId = typeof SyncOperationId.Type;

/**
 * Documents SyncCursor entity identifier.
 *
 * @example
 * ```ts
 * import { SyncCursorId, type SyncCursorId as SyncCursorIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncCursorIdValue = S.decodeUnknownSync(SyncCursorId)(1)
 *
 * if (id !== 1 || SyncCursorId.tableName !== "documents_sync_cursor") {
 *   throw new Error("expected documents SyncCursor identity")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const SyncCursorId = make("sync_cursor", {
  description: "Identifier for a documents SyncCursor remote-stream cursor row.",
});

/**
 * Runtime type for {@link SyncCursorId}.
 *
 * @example
 * ```ts
 * import { SyncCursorId, type SyncCursorId as SyncCursorIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncCursorIdValue = S.decodeUnknownSync(SyncCursorId)(1)
 * const ids: ReadonlyArray<SyncCursorIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected SyncCursor id type evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type SyncCursorId = typeof SyncCursorId.Type;

/**
 * Documents SyncConflict entity identifier.
 *
 * @example
 * ```ts
 * import { SyncConflictId, type SyncConflictId as SyncConflictIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncConflictIdValue = S.decodeUnknownSync(SyncConflictId)(1)
 *
 * if (id !== 1 || SyncConflictId.tableName !== "documents_sync_conflict") {
 *   throw new Error("expected documents SyncConflict identity")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const SyncConflictId = make("sync_conflict", {
  description: "Identifier for a documents SyncConflict remote-drift row.",
});

/**
 * Runtime type for {@link SyncConflictId}.
 *
 * @example
 * ```ts
 * import { SyncConflictId, type SyncConflictId as SyncConflictIdValue } from "@beep/documents-domain/identity/Documents"
 * import * as S from "effect/Schema"
 *
 * const id: SyncConflictIdValue = S.decodeUnknownSync(SyncConflictId)(1)
 * const ids: ReadonlyArray<SyncConflictIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected SyncConflict id type evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type SyncConflictId = typeof SyncConflictId.Type;

/**
 * SyncCursorId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $DocumentsDomainId.create("identity/Documents");
const make = EntityId.factory("documents", $I);

/**
 * Documents SyncCursor entity identifier.
 *
 * **Example** (Decode SyncCursorId value)
 *
 * ```ts
 * import { SyncCursorId, type SyncCursorId as SyncCursorIdValue } from "@beep/shared-domain/identity/Documents"
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
 * **Example** (Type SyncCursorId array)
 *
 * ```ts
 * import { SyncCursorId, type SyncCursorId as SyncCursorIdValue } from "@beep/shared-domain/identity/Documents"
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

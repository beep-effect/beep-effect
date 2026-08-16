/**
 * SyncItemId schema and runtime type.
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
 * Documents SyncItem entity identifier.
 *
 * **Example** (Decode SyncItemId value)
 *
 * ```ts
 * import { SyncItemId, type SyncItemId as SyncItemIdValue } from "@beep/shared-domain/identity/Documents"
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
 * **Example** (Type SyncItemId array)
 *
 * ```ts
 * import { SyncItemId, type SyncItemId as SyncItemIdValue } from "@beep/shared-domain/identity/Documents"
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

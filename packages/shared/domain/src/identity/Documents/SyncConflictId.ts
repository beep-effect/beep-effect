/**
 * SyncConflictId schema and runtime type.
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
 * Documents SyncConflict entity identifier.
 *
 * **Example** (Decode SyncConflictId value)
 *
 * ```ts
 * import { SyncConflictId, type SyncConflictId as SyncConflictIdValue } from "@beep/shared-domain/identity/Documents"
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
 * **Example** (Type SyncConflictId array)
 *
 * ```ts
 * import { SyncConflictId, type SyncConflictId as SyncConflictIdValue } from "@beep/shared-domain/identity/Documents"
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

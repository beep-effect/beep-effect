/**
 * SyncOperationId schema and runtime type.
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
 * Documents SyncOperation entity identifier.
 *
 * **Example** (Decode SyncOperationId value)
 *
 * ```ts
 * import { SyncOperationId, type SyncOperationId as SyncOperationIdValue } from "@beep/shared-domain/identity/Documents"
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
 * **Example** (Type SyncOperationId array)
 *
 * ```ts
 * import { SyncOperationId, type SyncOperationId as SyncOperationIdValue } from "@beep/shared-domain/identity/Documents"
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

/**
 * SyncOperation concept-local value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $DocumentsDomainId.create("entities/SyncOperation/SyncOperation.values");

/**
 * Kind of one-way push performed against the DMS mirror.
 *
 * **Example** (Check upload operation)
 *
 * ```ts
 * import { SyncOperationType } from "@beep/documents-domain/entities/SyncOperation"
 *
 * console.log(SyncOperationType.is.uploadFile(SyncOperationType.Enum.uploadFile))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncOperationType = LiteralKit([
  "createFolder",
  "uploadFile",
  "uploadFileVersion",
  "moveItem",
  "renameItem",
]).pipe(
  $I.annoteSchema("SyncOperationType", {
    description: "Kind of one-way push performed against the DMS mirror.",
  })
);

/**
 * Runtime type for {@link SyncOperationType}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncOperationType = typeof SyncOperationType.Type;

/**
 * Outbox lifecycle status for a queued push operation.
 *
 * **Example** (Check queued status)
 *
 * ```ts
 * import { SyncOperationStatus } from "@beep/documents-domain/entities/SyncOperation"
 *
 * console.log(SyncOperationStatus.is.queued(SyncOperationStatus.Enum.queued))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncOperationStatus = LiteralKit(["queued", "leased", "succeeded", "failed"]).pipe(
  $I.annoteSchema("SyncOperationStatus", {
    description: "Outbox lifecycle status for a queued push operation.",
  })
);

/**
 * Runtime type for {@link SyncOperationStatus}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncOperationStatus = typeof SyncOperationStatus.Type;

/**
 * SyncOperation entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import { SyncItemId } from "@beep/shared-domain/identity/Documents/SyncItemId";
import { SyncOperationId } from "@beep/shared-domain/identity/Documents/SyncOperationId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { DocumentContentDigest } from "../../aggregates/Document/index.ts";
import { DmsProvider, VaultRelPath } from "../../values/Sync/index.ts";

const $I = $DocumentsDomainId.create("entities/SyncOperation/SyncOperation.model");

/**
 * Kind of one-way push performed against the DMS mirror.
 *
 * **Example** (Assert uploadFile operation type)
 *
 * ```ts
 * import { SyncOperationType } from "@beep/documents-domain/entities/SyncOperation"
 *
 * const operationType: SyncOperationType = SyncOperationType.Enum.uploadFile
 *
 * if (!SyncOperationType.is.uploadFile(operationType)) {
 *   throw new Error("expected uploadFile operation type")
 * }
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
 * **Example** (Assign createFolder type value)
 *
 * ```ts
 * import type { SyncOperationType } from "@beep/documents-domain/entities/SyncOperation"
 *
 * const operationType: SyncOperationType = "createFolder"
 * console.log(operationType)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncOperationType = typeof SyncOperationType.Type;

/**
 * Outbox lifecycle status for a queued push operation.
 *
 * **Example** (Assert queued operation status)
 *
 * ```ts
 * import { SyncOperationStatus } from "@beep/documents-domain/entities/SyncOperation"
 *
 * const status: SyncOperationStatus = SyncOperationStatus.Enum.queued
 *
 * if (!SyncOperationStatus.is.queued(status)) {
 *   throw new Error("expected queued operation status")
 * }
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
 * **Example** (Assign succeeded status value)
 *
 * ```ts
 * import type { SyncOperationStatus } from "@beep/documents-domain/entities/SyncOperation"
 *
 * const status: SyncOperationStatus = "succeeded"
 * console.log(status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncOperationStatus = typeof SyncOperationStatus.Type;

/**
 * Durable one-way push outbox operation from the local vault to the DMS mirror.
 *
 * **Example** (Decode SyncOperation entity)
 *
 * ```ts
 * import { SyncOperation, SyncOperationId } from "@beep/documents-domain/entities/SyncOperation"
 * import * as S from "effect/Schema"
 *
 * const operation = S.decodeUnknownSync(SyncOperation)({
 *   attemptCount: 0,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: SyncOperationId.entityType,
 *   id: 1,
 *   idempotencyKey: "sync-item-1:uploadFile:1",
 *   inputContentDigest: "abc123",
 *   inputGeneration: 1,
 *   lastError: null,
 *   operationType: "uploadFile",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_operation_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "queued",
 *   syncItemId: 1,
 *   targetName: "complaint.pdf",
 *   targetParentRelPath: "matters/client-default",
 *   targetRelPath: "matters/client-default/complaint.pdf",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(operation.status)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class SyncOperation extends BaseEntity.Class<SyncOperation>($I`SyncOperation`)(
  SyncOperationId,
  {
    fields: {
      attemptCount: NonNegativeInt.annotateKey({
        description: "Number of push attempts already made for this operation.",
      }),
      idempotencyKey: S.NonEmptyString.annotateKey({
        description: "Unique key deduplicating replays of the same push operation.",
      }),
      inputContentDigest: DocumentContentDigest.pipe(S.OptionFromNullOr).annotateKey({
        description: "Digest of the local content captured when the operation was queued; none for folders.",
      }),
      inputGeneration: NonNegativeInt.annotateKey({
        description: "Local generation counter captured when the operation was queued.",
      }),
      lastError: S.NonEmptyString.pipe(S.OptionFromNullOr).annotateKey({
        description: "Most recent attempt failure message; none while the operation is healthy.",
      }),
      operationType: SyncOperationType.annotateKey({
        description: "Kind of push performed against the DMS mirror.",
      }),
      provider: DmsProvider.annotateKey({
        description: "DMS provider targeted by the push operation.",
      }),
      status: SyncOperationStatus.annotateKey({
        description: "Outbox lifecycle status of the operation.",
      }),
      syncItemId: SyncItemId.annotateKey({
        description: "Sync-tracking row this operation pushes for.",
      }),
      targetName: S.NonEmptyString.annotateKey({
        description: "Remote item name to apply with this operation.",
      }),
      targetParentRelPath: VaultRelPath.pipe(S.OptionFromNullOr).annotateKey({
        description: "Vault-relative path of the intended remote parent folder; none targets the mirror root.",
      }),
      targetRelPath: VaultRelPath.annotateKey({
        description: "Intended vault-relative path of the item after this operation.",
      }),
      workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
        description: "Workspace whose vault produced the push operation.",
      }),
    },
    persisted: {
      attemptCount: EntitySchema.persist.int({
        columnName: "attempt_count",
      }),
      idempotencyKey: EntitySchema.persist.text({
        columnName: "idempotency_key",
        indexHints: [EntitySchema.IndexHint.unique],
      }),
      inputContentDigest: EntitySchema.persist.text({
        columnName: "input_content_digest",
      }),
      inputGeneration: EntitySchema.persist.int({
        columnName: "input_generation",
      }),
      lastError: EntitySchema.persist.text({
        columnName: "last_error",
      }),
      operationType: EntitySchema.persist.literal({
        columnName: "operation_type",
      }),
      provider: EntitySchema.persist.literal({
        columnName: "provider",
      }),
      status: EntitySchema.persist.literal({
        columnName: "status",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      syncItemId: EntitySchema.persist.entityId({
        columnName: "sync_item_id",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      targetName: EntitySchema.persist.text({
        columnName: "target_name",
      }),
      targetParentRelPath: EntitySchema.persist.text({
        columnName: "target_parent_rel_path",
      }),
      targetRelPath: EntitySchema.persist.text({
        columnName: "target_rel_path",
      }),
      workspaceId: EntitySchema.persist.entityId({
        columnName: "workspace_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("SyncOperation", {
    description: "Durable one-way push outbox operation from the local vault to the DMS mirror.",
  })
) {}

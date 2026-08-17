/**
 * SyncOperation entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import { SyncItemId } from "@beep/shared-domain/identity/Documents/SyncItemId";
import { SyncOperationId } from "@beep/shared-domain/identity/Documents/SyncOperationId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { DocumentContentDigest } from "../../aggregates/Document/index.ts";
import { DmsProvider, VaultRelPath } from "../../values/Sync/index.ts";
import { SyncOperationStatus, SyncOperationType } from "./SyncOperation.values.ts";

const $I = $DocumentsDomainId.create("entities/SyncOperation/SyncOperation.model");
const SyncOperationEntity = ProductEntity.make(SyncOperationId);

/**
 * Durable one-way push outbox operation from the local vault to the DMS mirror.
 *
 * **Example** (Decode SyncOperation entity)
 *
 * ```ts
 * import { SyncOperation } from "@beep/documents-domain/entities/SyncOperation"
 * import { SyncOperationId } from "@beep/shared-domain/identity/Documents/SyncOperationId"
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
export class SyncOperation extends SyncOperationEntity.Entity<SyncOperation>(SyncOperationEntity.tableName)(
  {
    attemptCount: NonNegativeInt.annotateKey({
      description: "Number of push attempts already made for this operation.",
    }).pipe(SyncOperationEntity.pg.integer(), SyncOperationEntity.pg.columnName("attempt_count")),
    idempotencyKey: S.NonEmptyString.annotateKey({
      description: "Unique key deduplicating replays of the same push operation.",
    }).pipe(SyncOperationEntity.pg.text(), SyncOperationEntity.pg.columnName("idempotency_key")),
    inputContentDigest: DocumentContentDigest.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Digest of the local content captured when the operation was queued; none for folders.",
      })
      .pipe(SyncOperationEntity.pg.text(), SyncOperationEntity.pg.columnName("input_content_digest")),
    inputGeneration: NonNegativeInt.annotateKey({
      description: "Local generation counter captured when the operation was queued.",
    }).pipe(SyncOperationEntity.pg.integer(), SyncOperationEntity.pg.columnName("input_generation")),
    lastError: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Most recent attempt failure message; none while the operation is healthy." })
      .pipe(SyncOperationEntity.pg.text(), SyncOperationEntity.pg.columnName("last_error")),
    operationType: SyncOperationType.annotateKey({
      description: "Kind of push performed against the DMS mirror.",
    }).pipe(SyncOperationEntity.pg.text(), SyncOperationEntity.pg.columnName("operation_type")),
    provider: DmsProvider.annotateKey({
      description: "DMS provider targeted by the push operation.",
    }).pipe(SyncOperationEntity.pg.text()),
    status: SyncOperationStatus.annotateKey({
      description: "Outbox lifecycle status of the operation.",
    }).pipe(SyncOperationEntity.pg.text()),
    syncItemId: SyncItemId.annotateKey({
      description: "Sync-tracking row this operation pushes for.",
    }).pipe(SyncOperationEntity.pg.integer(), SyncOperationEntity.pg.columnName("sync_item_id")),
    targetName: S.NonEmptyString.annotateKey({
      description: "Remote item name to apply with this operation.",
    }).pipe(SyncOperationEntity.pg.text(), SyncOperationEntity.pg.columnName("target_name")),
    targetParentRelPath: VaultRelPath.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Vault-relative path of the intended remote parent folder; none targets the mirror root.",
      })
      .pipe(SyncOperationEntity.pg.text(), SyncOperationEntity.pg.columnName("target_parent_rel_path")),
    targetRelPath: VaultRelPath.annotateKey({
      description: "Intended vault-relative path of the item after this operation.",
    }).pipe(SyncOperationEntity.pg.text(), SyncOperationEntity.pg.columnName("target_rel_path")),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault produced the push operation.",
    }).pipe(SyncOperationEntity.pg.integer(), SyncOperationEntity.pg.columnName("workspace_id")),
    ...SyncOperationEntity.identityFields,
  },
  $I.annote("SyncOperation", {
    description: "Durable one-way push outbox operation from the local vault to the DMS mirror.",
  }),
  (columns) => [
    SyncOperationEntity.Table.uniqueIndex("documents_sync_operation_idempotency_key_unique_idx", [
      columns.idempotencyKey,
    ]),
    SyncOperationEntity.Table.index("documents_sync_operation_status_lookup_idx", [columns.status]),
    SyncOperationEntity.Table.index("documents_sync_operation_sync_item_id_lookup_idx", [columns.syncItemId]),
    SyncOperationEntity.Table.index("documents_sync_operation_workspace_id_btree_idx", [columns.workspaceId]),
    ...SyncOperationEntity.entityExtras(columns),
  ]
) {}

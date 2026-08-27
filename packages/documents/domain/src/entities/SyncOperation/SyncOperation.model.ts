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
const pg = ProductEntity.pg;

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
export class SyncOperation extends ProductEntity.Entity<SyncOperation>()(SyncOperationId)(
  {
    attemptCount: NonNegativeInt.annotateKey({
      description: "Number of push attempts already made for this operation.",
    }).pipe(pg.integer(), pg.columnName("attempt_count")),
    idempotencyKey: S.NonEmptyString.annotateKey({
      description: "Unique key deduplicating replays of the same push operation.",
    }).pipe(pg.text(), pg.columnName("idempotency_key"), pg.uniqueIndex()),
    inputContentDigest: DocumentContentDigest.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Digest of the local content captured when the operation was queued; none for folders.",
      })
      .pipe(pg.text(), pg.columnName("input_content_digest")),
    inputGeneration: NonNegativeInt.annotateKey({
      description: "Local generation counter captured when the operation was queued.",
    }).pipe(pg.integer(), pg.columnName("input_generation")),
    lastError: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Most recent attempt failure message; none while the operation is healthy." })
      .pipe(pg.text(), pg.columnName("last_error")),
    operationType: SyncOperationType.annotateKey({
      description: "Kind of push performed against the DMS mirror.",
    }).pipe(pg.text(), pg.columnName("operation_type")),
    provider: DmsProvider.annotateKey({
      description: "DMS provider targeted by the push operation.",
    }).pipe(pg.text()),
    status: SyncOperationStatus.annotateKey({
      description: "Outbox lifecycle status of the operation.",
    }).pipe(pg.text(), pg.index({ name: "documents_sync_operation_status_lookup_idx" })),
    syncItemId: SyncItemId.annotateKey({
      description: "Sync-tracking row this operation pushes for.",
    }).pipe(
      pg.integer(),
      pg.columnName("sync_item_id"),
      pg.index({ name: "documents_sync_operation_sync_item_id_lookup_idx" })
    ),
    targetName: S.NonEmptyString.annotateKey({
      description: "Remote item name to apply with this operation.",
    }).pipe(pg.text(), pg.columnName("target_name")),
    targetParentRelPath: VaultRelPath.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Vault-relative path of the intended remote parent folder; none targets the mirror root.",
      })
      .pipe(pg.text(), pg.columnName("target_parent_rel_path")),
    targetRelPath: VaultRelPath.annotateKey({
      description: "Intended vault-relative path of the item after this operation.",
    }).pipe(pg.text(), pg.columnName("target_rel_path")),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault produced the push operation.",
    }).pipe(pg.integer(), pg.columnName("workspace_id"), pg.index()),
  },
  $I.annote("SyncOperation", {
    description: "Durable one-way push outbox operation from the local vault to the DMS mirror.",
  })
) {}

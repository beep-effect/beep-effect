/**
 * SyncItem entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import { SyncItemId } from "@beep/shared-domain/identity/Documents/SyncItemId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { DocumentContentDigest } from "../../aggregates/Document/index.ts";
import { DmsProvider, RemoteItemId, SyncItemKind, VaultRelPath } from "../../values/Sync/index.ts";
import { SyncItemState } from "./SyncItem.values.ts";

const $I = $DocumentsDomainId.create("entities/SyncItem/SyncItem.model");
const pg = ProductEntity.pg;

/**
 * Durable sync-tracking row for one workspace-vault item mirrored one-way to a DMS provider.
 *
 * **Example** (Decode full SyncItem row)
 *
 * ```ts
 * import { SyncItem } from "@beep/documents-domain/entities/SyncItem"
 * import { SyncItemId } from "@beep/shared-domain/identity/Documents/SyncItemId"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(SyncItem)({
 *   contentDigest: "abc123",
 *   contentSizeBytes: 2048,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: SyncItemId.entityType,
 *   id: 1,
 *   itemKind: "file",
 *   lastError: null,
 *   lastPushedDigest: null,
 *   lastPushedGeneration: null,
 *   localGeneration: 1,
 *   localRelPath: "matters/client-default/complaint.pdf",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_item_a1",
 *   remoteId: null,
 *   remoteName: null,
 *   remoteParentId: null,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   syncState: "pending",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(item.syncState)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class SyncItem extends ProductEntity.Entity<SyncItem>()(SyncItemId)(
  {
    contentDigest: DocumentContentDigest.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Digest of the local bytes last observed for this item; none for folders." })
      .pipe(pg.text(), pg.columnName("content_digest")),
    contentSizeBytes: NonNegativeInt.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Size in bytes of the local content last observed; none for folders." })
      .pipe(pg.integer(), pg.columnName("content_size_bytes")),
    itemKind: SyncItemKind.annotateKey({
      description: "Whether the mirrored vault item is a file or a folder.",
    }).pipe(pg.text(), pg.columnName("item_kind")),
    lastError: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Most recent push failure message; none when the item is healthy." })
      .pipe(pg.text(), pg.columnName("last_error")),
    lastPushedDigest: DocumentContentDigest.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Digest of the content most recently pushed to the provider; none before first push.",
      })
      .pipe(pg.text(), pg.columnName("last_pushed_digest")),
    lastPushedGeneration: NonNegativeInt.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Local generation counter captured by the most recent successful push." })
      .pipe(pg.integer(), pg.columnName("last_pushed_generation")),
    localGeneration: NonNegativeInt.annotateKey({
      description: "Monotonic counter incremented per observed local change.",
    }).pipe(pg.integer(), pg.columnName("local_generation")),
    localRelPath: VaultRelPath.annotateKey({
      description: "Vault-root-relative path of the mirrored local item.",
    }).pipe(
      pg.text(),
      pg.columnName("local_rel_path"),
      pg.index({ name: "documents_sync_item_local_rel_path_lookup_idx" })
    ),
    provider: DmsProvider.annotateKey({
      description: "DMS provider receiving the one-way mirror for this item.",
    }).pipe(pg.text()),
    remoteId: RemoteItemId.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Provider item identifier assigned by the DMS; none before first push." })
      .pipe(pg.text(), pg.columnName("remote_id"), pg.index({ name: "documents_sync_item_remote_id_lookup_idx" })),
    remoteName: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Item name last observed on the provider side; none before first push." })
      .pipe(pg.text(), pg.columnName("remote_name")),
    remoteParentId: RemoteItemId.pipe(S.OptionFromNullOr)
      .annotateKey({ description: "Provider identifier of the remote parent folder; none before first push." })
      .pipe(pg.text(), pg.columnName("remote_parent_id")),
    syncState: SyncItemState.annotateKey({
      description: "Reconciliation state of the mirrored item.",
    }).pipe(pg.text(), pg.columnName("sync_state"), pg.index({ name: "documents_sync_item_sync_state_lookup_idx" })),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault owns the mirrored item.",
    }).pipe(pg.integer(), pg.columnName("workspace_id"), pg.index()),
  },
  $I.annote("SyncItem", {
    description: "Durable sync-tracking row for one workspace-vault item mirrored one-way to a DMS provider.",
  })
) {}

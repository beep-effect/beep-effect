/**
 * SyncItem entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { DocumentContentDigest } from "../../aggregates/Document/index.ts";
import * as Documents from "../../identity/Documents.ts";
import { DmsProvider, RemoteItemId, SyncItemKind, VaultRelPath } from "../../values/Sync/index.ts";

const $I = $DocumentsDomainId.create("entities/SyncItem/SyncItem.model");

/**
 * Entity identifier for a persisted documents SyncItem.
 *
 * @example
 * ```ts
 * import { SyncItemId, type SyncItemId as SyncItemIdValue } from "@beep/documents-domain/entities/SyncItem"
 * import * as S from "effect/Schema"
 *
 * const id: SyncItemIdValue = S.decodeUnknownSync(SyncItemId)(1)
 *
 * if (id !== 1 || SyncItemId.tableName !== "documents_sync_item") {
 *   throw new Error("expected decoded SyncItem id")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const SyncItemId = Documents.SyncItemId;

/**
 * Runtime type for {@link SyncItemId}.
 *
 * @example
 * ```ts
 * import { SyncItemId, type SyncItemId as SyncItemIdValue } from "@beep/documents-domain/entities/SyncItem"
 * import * as S from "effect/Schema"
 *
 * const id: SyncItemIdValue = S.decodeUnknownSync(SyncItemId)(1)
 * const ids: ReadonlyArray<SyncItemIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected SyncItem id evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type SyncItemId = typeof SyncItemId.Type;

/**
 * Reconciliation state for one mirrored vault item.
 *
 * @example
 * ```ts
 * import { SyncItemState } from "@beep/documents-domain/entities/SyncItem"
 *
 * const state: SyncItemState = SyncItemState.Enum.pending
 *
 * if (!SyncItemState.is.pending(state)) {
 *   throw new Error("expected pending sync state")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncItemState = LiteralKit(["pending", "current", "error", "conflict"]).pipe(
  $I.annoteSchema("SyncItemState", {
    description: "Reconciliation state for one mirrored vault item.",
  })
);

/**
 * Runtime type for {@link SyncItemState}.
 *
 * @example
 * ```ts
 * import type { SyncItemState } from "@beep/documents-domain/entities/SyncItem"
 *
 * const state: SyncItemState = "current"
 * console.log(state)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncItemState = typeof SyncItemState.Type;

/**
 * Durable sync-tracking row for one workspace-vault item mirrored one-way to a DMS provider.
 *
 * @example
 * ```ts
 * import { SyncItem, SyncItemId } from "@beep/documents-domain/entities/SyncItem"
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
export class SyncItem extends BaseEntity.Class<SyncItem>($I`SyncItem`)(
  SyncItemId,
  {
    fields: {
      contentDigest: DocumentContentDigest.pipe(S.OptionFromNullOr).annotateKey({
        description: "Digest of the local bytes last observed for this item; none for folders.",
      }),
      contentSizeBytes: NonNegativeInt.pipe(S.OptionFromNullOr).annotateKey({
        description: "Size in bytes of the local content last observed; none for folders.",
      }),
      itemKind: SyncItemKind.annotateKey({
        description: "Whether the mirrored vault item is a file or a folder.",
      }),
      lastError: S.NonEmptyString.pipe(S.OptionFromNullOr).annotateKey({
        description: "Most recent push failure message; none when the item is healthy.",
      }),
      lastPushedDigest: DocumentContentDigest.pipe(S.OptionFromNullOr).annotateKey({
        description: "Digest of the content most recently pushed to the provider; none before first push.",
      }),
      lastPushedGeneration: NonNegativeInt.pipe(S.OptionFromNullOr).annotateKey({
        description: "Local generation counter captured by the most recent successful push.",
      }),
      localGeneration: NonNegativeInt.annotateKey({
        description: "Monotonic counter incremented per observed local change.",
      }),
      localRelPath: VaultRelPath.annotateKey({
        description: "Vault-root-relative path of the mirrored local item.",
      }),
      provider: DmsProvider.annotateKey({
        description: "DMS provider receiving the one-way mirror for this item.",
      }),
      remoteId: RemoteItemId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Provider item identifier assigned by the DMS; none before first push.",
      }),
      remoteName: S.NonEmptyString.pipe(S.OptionFromNullOr).annotateKey({
        description: "Item name last observed on the provider side; none before first push.",
      }),
      remoteParentId: RemoteItemId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Provider identifier of the remote parent folder; none before first push.",
      }),
      syncState: SyncItemState.annotateKey({
        description: "Reconciliation state of the mirrored item.",
      }),
      workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
        description: "Workspace whose vault owns the mirrored item.",
      }),
    },
    persisted: {
      contentDigest: EntitySchema.persist.text({
        columnName: "content_digest",
      }),
      contentSizeBytes: EntitySchema.persist.int({
        columnName: "content_size_bytes",
      }),
      itemKind: EntitySchema.persist.literal({
        columnName: "item_kind",
      }),
      lastError: EntitySchema.persist.text({
        columnName: "last_error",
      }),
      lastPushedDigest: EntitySchema.persist.text({
        columnName: "last_pushed_digest",
      }),
      lastPushedGeneration: EntitySchema.persist.int({
        columnName: "last_pushed_generation",
      }),
      localGeneration: EntitySchema.persist.int({
        columnName: "local_generation",
      }),
      localRelPath: EntitySchema.persist.text({
        columnName: "local_rel_path",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      provider: EntitySchema.persist.literal({
        columnName: "provider",
      }),
      remoteId: EntitySchema.persist.text({
        columnName: "remote_id",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      remoteName: EntitySchema.persist.text({
        columnName: "remote_name",
      }),
      remoteParentId: EntitySchema.persist.text({
        columnName: "remote_parent_id",
      }),
      syncState: EntitySchema.persist.literal({
        columnName: "sync_state",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      workspaceId: EntitySchema.persist.entityId({
        columnName: "workspace_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("SyncItem", {
    description: "Durable sync-tracking row for one workspace-vault item mirrored one-way to a DMS provider.",
  })
) {}

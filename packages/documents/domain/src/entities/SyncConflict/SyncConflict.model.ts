/**
 * SyncConflict entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import { SyncItemId } from "@beep/shared-domain/identity/Documents/SyncItemId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { DmsProvider, RemoteItemId, VaultRelPath } from "../../values/Sync/index.ts";
import { SyncConflictKind, SyncConflictResolution } from "./SyncConflict.values.ts";

const $I = $DocumentsDomainId.create("entities/SyncConflict/SyncConflict.model");
const SyncConflictEntity = ProductEntity.make(SyncConflictId);

/**
 * Remote-drift record surfaced for review; v1 never auto-merges or mutates local vault content (SPEC D4).
 *
 * **Example** (Decode SyncConflict entity)
 *
 * ```ts
 * import { SyncConflict } from "@beep/documents-domain/entities/SyncConflict"
 * import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId"
 * import * as S from "effect/Schema"
 *
 * const conflict = S.decodeUnknownSync(SyncConflict)({
 *   conflictKind: "remoteEdit",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: SyncConflictId.entityType,
 *   id: 1,
 *   localRelPath: "matters/client-default/complaint.pdf",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_conflict_a1",
 *   remoteEventId: "evt-1",
 *   remoteId: "1234567890",
 *   remotePayload: { eventType: "ITEM_MODIFY" },
 *   resolutionStatus: "open",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   syncItemId: 1,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(conflict.conflictKind)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class SyncConflict extends SyncConflictEntity.Entity<SyncConflict>(SyncConflictEntity.tableName)(
  {
    conflictKind: SyncConflictKind.annotateKey({
      description: "Kind of remote drift detected for the mirrored item.",
    }).pipe(SyncConflictEntity.pg.text(), SyncConflictEntity.pg.columnName("conflict_kind")),
    localRelPath: VaultRelPath.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Vault-relative path of the affected local item; none when unmapped locally.",
      })
      .pipe(SyncConflictEntity.pg.text(), SyncConflictEntity.pg.columnName("local_rel_path")),
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose event stream reported the drift.",
    }).pipe(SyncConflictEntity.pg.text()),
    remoteEventId: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Provider event identifier that surfaced the drift; none for synthetic detections.",
      })
      .pipe(SyncConflictEntity.pg.text(), SyncConflictEntity.pg.columnName("remote_event_id")),
    remoteId: RemoteItemId.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Provider identifier of the drifted remote item; none when the event omits it.",
      })
      .pipe(SyncConflictEntity.pg.text(), SyncConflictEntity.pg.columnName("remote_id")),
    remotePayload: UnknownRecord.annotateKey({
      description: "Remote event snapshot preserved verbatim for review.",
    }).pipe(SyncConflictEntity.pg.jsonb(), SyncConflictEntity.pg.columnName("remote_payload")),
    resolutionStatus: SyncConflictResolution.annotateKey({
      description: "Review status of the drift record.",
    }).pipe(SyncConflictEntity.pg.text(), SyncConflictEntity.pg.columnName("resolution_status")),
    syncItemId: SyncItemId.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Sync-tracking row the drift maps to; none when the remote item is unknown locally.",
      })
      .pipe(SyncConflictEntity.pg.integer(), SyncConflictEntity.pg.columnName("sync_item_id")),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose mirror observed the remote drift.",
    }).pipe(SyncConflictEntity.pg.integer(), SyncConflictEntity.pg.columnName("workspace_id")),
    ...SyncConflictEntity.identityFields,
  },
  $I.annote("SyncConflict", {
    description:
      "Remote-drift record surfaced for review; v1 never auto-merges or mutates local vault content (SPEC D4).",
  }),
  (columns) => [
    SyncConflictEntity.Table.index("documents_sync_conflict_conflict_kind_lookup_idx", [columns.conflictKind]),
    SyncConflictEntity.Table.index("documents_sync_conflict_remote_event_id_lookup_idx", [columns.remoteEventId]),
    SyncConflictEntity.Table.index("documents_sync_conflict_resolution_status_lookup_idx", [columns.resolutionStatus]),
    SyncConflictEntity.Table.index("documents_sync_conflict_workspace_id_btree_idx", [columns.workspaceId]),
    ...SyncConflictEntity.entityExtras(columns),
  ]
) {}

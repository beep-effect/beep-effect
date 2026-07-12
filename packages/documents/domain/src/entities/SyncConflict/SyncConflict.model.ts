/**
 * SyncConflict entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit, UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import * as Documents from "../../identity/Documents.js";
import { DmsProvider, RemoteItemId, VaultRelPath } from "../../values/Sync/index.js";

const $I = $DocumentsDomainId.create("entities/SyncConflict/SyncConflict.model");

/**
 * Entity identifier for a persisted documents SyncConflict.
 *
 * @example
 * ```ts
 * import { SyncConflictId, type SyncConflictId as SyncConflictIdValue } from "@beep/documents-domain/entities/SyncConflict"
 * import * as S from "effect/Schema"
 *
 * const id: SyncConflictIdValue = S.decodeUnknownSync(SyncConflictId)(1)
 *
 * if (id !== 1 || SyncConflictId.tableName !== "documents_sync_conflict") {
 *   throw new Error("expected decoded SyncConflict id")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const SyncConflictId = Documents.SyncConflictId;

/**
 * Runtime type for {@link SyncConflictId}.
 *
 * @example
 * ```ts
 * import { SyncConflictId, type SyncConflictId as SyncConflictIdValue } from "@beep/documents-domain/entities/SyncConflict"
 * import * as S from "effect/Schema"
 *
 * const id: SyncConflictIdValue = S.decodeUnknownSync(SyncConflictId)(1)
 * const ids: ReadonlyArray<SyncConflictIdValue> = [id]
 *
 * if (ids.length !== 1) {
 *   throw new Error("expected SyncConflict id evidence")
 * }
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type SyncConflictId = typeof SyncConflictId.Type;

/**
 * Kind of remote drift detected against the one-way mirror.
 *
 * @example
 * ```ts
 * import { SyncConflictKind } from "@beep/documents-domain/entities/SyncConflict"
 *
 * const kind: SyncConflictKind = SyncConflictKind.Enum.remoteEdit
 *
 * if (!SyncConflictKind.is.remoteEdit(kind)) {
 *   throw new Error("expected remoteEdit conflict kind")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncConflictKind = LiteralKit([
  "remoteCreate",
  "remoteEdit",
  "remoteMove",
  "remoteRename",
  "remoteDelete",
  "remoteUnknown",
]).pipe(
  $I.annoteSchema("SyncConflictKind", {
    description: "Kind of remote drift detected against the one-way mirror.",
  })
);

/**
 * Runtime type for {@link SyncConflictKind}.
 *
 * @example
 * ```ts
 * import type { SyncConflictKind } from "@beep/documents-domain/entities/SyncConflict"
 *
 * const kind: SyncConflictKind = "remoteDelete"
 * console.log(kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncConflictKind = typeof SyncConflictKind.Type;

/**
 * Review status for a surfaced remote-drift record.
 *
 * @example
 * ```ts
 * import { SyncConflictResolution } from "@beep/documents-domain/entities/SyncConflict"
 *
 * const resolution: SyncConflictResolution = SyncConflictResolution.Enum.open
 *
 * if (!SyncConflictResolution.is.open(resolution)) {
 *   throw new Error("expected open conflict resolution")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncConflictResolution = LiteralKit(["open", "reviewed"]).pipe(
  $I.annoteSchema("SyncConflictResolution", {
    description: "Review status for a surfaced remote-drift record.",
  })
);

/**
 * Runtime type for {@link SyncConflictResolution}.
 *
 * @example
 * ```ts
 * import type { SyncConflictResolution } from "@beep/documents-domain/entities/SyncConflict"
 *
 * const resolution: SyncConflictResolution = "reviewed"
 * console.log(resolution)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncConflictResolution = typeof SyncConflictResolution.Type;

/**
 * Remote-drift record surfaced for review; v1 never auto-merges or mutates local vault content (SPEC D4).
 *
 * @example
 * ```ts
 * import { SyncConflict, SyncConflictId } from "@beep/documents-domain/entities/SyncConflict"
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
export class SyncConflict extends BaseEntity.Class<SyncConflict>($I`SyncConflict`)(
  SyncConflictId,
  {
    fields: {
      conflictKind: SyncConflictKind.annotateKey({
        description: "Kind of remote drift detected for the mirrored item.",
      }),
      localRelPath: VaultRelPath.pipe(S.OptionFromNullOr).annotateKey({
        description: "Vault-relative path of the affected local item; none when unmapped locally.",
      }),
      provider: DmsProvider.annotateKey({
        description: "DMS provider whose event stream reported the drift.",
      }),
      remoteEventId: S.NonEmptyString.pipe(S.OptionFromNullOr).annotateKey({
        description: "Provider event identifier that surfaced the drift; none for synthetic detections.",
      }),
      remoteId: RemoteItemId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Provider identifier of the drifted remote item; none when the event omits it.",
      }),
      remotePayload: UnknownRecord.annotateKey({
        description: "Remote event snapshot preserved verbatim for review.",
      }),
      resolutionStatus: SyncConflictResolution.annotateKey({
        description: "Review status of the drift record.",
      }),
      syncItemId: Documents.SyncItemId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Sync-tracking row the drift maps to; none when the remote item is unknown locally.",
      }),
      workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
        description: "Workspace whose mirror observed the remote drift.",
      }),
    },
    persisted: {
      conflictKind: EntitySchema.persist.literal({
        columnName: "conflict_kind",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      localRelPath: EntitySchema.persist.text({
        columnName: "local_rel_path",
      }),
      provider: EntitySchema.persist.literal({
        columnName: "provider",
      }),
      remoteEventId: EntitySchema.persist.text({
        columnName: "remote_event_id",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      remoteId: EntitySchema.persist.text({
        columnName: "remote_id",
      }),
      remotePayload: EntitySchema.persist.jsonb({
        columnName: "remote_payload",
      }),
      resolutionStatus: EntitySchema.persist.literal({
        columnName: "resolution_status",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      syncItemId: EntitySchema.persist.entityId({
        columnName: "sync_item_id",
      }),
      workspaceId: EntitySchema.persist.entityId({
        columnName: "workspace_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("SyncConflict", {
    description:
      "Remote-drift record surfaced for review; v1 never auto-merges or mutates local vault content (SPEC D4).",
  })
) {}

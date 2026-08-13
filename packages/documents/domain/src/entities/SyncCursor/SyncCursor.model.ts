/**
 * SyncCursor entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import { SyncCursorId } from "@beep/shared-domain/identity/Documents/SyncCursorId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { DmsProvider } from "../../values/Sync/index.ts";

const $I = $DocumentsDomainId.create("entities/SyncCursor/SyncCursor.model");

/**
 * Health status for a remote-event stream cursor.
 *
 * **Example** (Assert active SyncCursorStatus)
 *
 * ```ts
 * import { SyncCursorStatus } from "@beep/documents-domain/entities/SyncCursor"
 *
 * const status: SyncCursorStatus = SyncCursorStatus.Enum.active
 *
 * if (!SyncCursorStatus.is.active(status)) {
 *   throw new Error("expected active cursor status")
 * }
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncCursorStatus = LiteralKit(["active", "error"]).pipe(
  $I.annoteSchema("SyncCursorStatus", {
    description: "Health status for a remote-event stream cursor.",
  })
);

/**
 * Runtime type for {@link SyncCursorStatus}.
 *
 * **Example** (Assign error status string)
 *
 * ```ts
 * import type { SyncCursorStatus } from "@beep/documents-domain/entities/SyncCursor"
 *
 * const status: SyncCursorStatus = "error"
 * console.log(status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncCursorStatus = typeof SyncCursorStatus.Type;

/**
 * Durable remote-event stream cursor enabling drift detection to survive app restarts.
 *
 * **Example** (Decode full SyncCursor entity)
 *
 * ```ts
 * import { SyncCursor, SyncCursorId } from "@beep/documents-domain/entities/SyncCursor"
 * import * as S from "effect/Schema"
 *
 * const cursor = S.decodeUnknownSync(SyncCursor)({
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: SyncCursorId.entityType,
 *   id: 1,
 *   lastError: null,
 *   lastEventId: null,
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_cursor_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "active",
 *   streamPosition: "now",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(cursor.status)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class SyncCursor extends BaseEntity.Class<SyncCursor>($I`SyncCursor`)(
  SyncCursorId,
  {
    fields: {
      lastError: S.NonEmptyString.pipe(S.OptionFromNullOr).annotateKey({
        description: "Most recent stream-read failure message; none while the cursor is healthy.",
      }),
      lastEventId: S.NonEmptyString.pipe(S.OptionFromNullOr).annotateKey({
        description: "Identifier of the last remote event processed; none before the first event.",
      }),
      provider: DmsProvider.annotateKey({
        description: "DMS provider whose event stream this cursor tracks.",
      }),
      status: SyncCursorStatus.annotateKey({
        description: "Health status of the cursor.",
      }),
      streamPosition: S.NonEmptyString.annotateKey({
        description: "Opaque provider stream position to resume reading from.",
      }),
      workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
        description: "Workspace whose mirror this cursor watches for remote drift.",
      }),
    },
    persisted: {
      lastError: EntitySchema.persist.text({
        columnName: "last_error",
      }),
      lastEventId: EntitySchema.persist.text({
        columnName: "last_event_id",
      }),
      provider: EntitySchema.persist.literal({
        columnName: "provider",
      }),
      status: EntitySchema.persist.literal({
        columnName: "status",
      }),
      streamPosition: EntitySchema.persist.text({
        columnName: "stream_position",
      }),
      workspaceId: EntitySchema.persist.entityId({
        columnName: "workspace_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("SyncCursor", {
    description: "Durable remote-event stream cursor enabling drift detection to survive app restarts.",
  })
) {}

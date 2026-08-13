/**
 * SyncCursor entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import { SyncCursorId } from "@beep/shared-domain/identity/Documents/SyncCursorId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { DmsProvider } from "../../values/Sync/index.ts";
import { SyncCursorStatus } from "./SyncCursor.values.ts";

const $I = $DocumentsDomainId.create("entities/SyncCursor/SyncCursor.model");
const SyncCursorEntity = ProductEntity.make(SyncCursorId);

/**
 * Durable remote-event stream cursor enabling drift detection to survive app restarts.
 *
 * **Example** (Decode full SyncCursor entity)
 *
 * ```ts
 * import { SyncCursor } from "@beep/documents-domain/entities/SyncCursor"
 * import { SyncCursorId } from "@beep/shared-domain/identity/Documents/SyncCursorId"
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
export class SyncCursor extends SyncCursorEntity.Entity<SyncCursor>(SyncCursorEntity.tableName)(
  {
    lastError: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Most recent stream-read failure message; none while the cursor is healthy.",
      })
      .pipe(SyncCursorEntity.pg.text(), SyncCursorEntity.pg.columnName("last_error")),
    lastEventId: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Identifier of the last remote event processed; none before the first event.",
      })
      .pipe(SyncCursorEntity.pg.text(), SyncCursorEntity.pg.columnName("last_event_id")),
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose event stream this cursor tracks.",
    }).pipe(SyncCursorEntity.pg.text()),
    status: SyncCursorStatus.annotateKey({
      description: "Health status of the cursor.",
    }).pipe(SyncCursorEntity.pg.text()),
    streamPosition: S.NonEmptyString.annotateKey({
      description: "Opaque provider stream position to resume reading from.",
    }).pipe(SyncCursorEntity.pg.text(), SyncCursorEntity.pg.columnName("stream_position")),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose mirror this cursor watches for remote drift.",
    }).pipe(SyncCursorEntity.pg.integer(), SyncCursorEntity.pg.columnName("workspace_id")),
    ...SyncCursorEntity.identityFields,
  },
  $I.annote("SyncCursor", {
    description: "Durable remote-event stream cursor enabling drift detection to survive app restarts.",
  }),
  (columns) => [
    SyncCursorEntity.Table.index("documents_sync_cursor_workspace_id_btree_idx", [columns.workspaceId]),
    ...SyncCursorEntity.entityExtras(columns),
  ]
) {}

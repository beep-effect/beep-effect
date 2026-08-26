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
const pg = ProductEntity.pg;

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
export class SyncCursor extends ProductEntity.Entity<SyncCursor>()(SyncCursorId)(
  {
    lastError: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Most recent stream-read failure message; none while the cursor is healthy.",
      })
      .pipe(pg.text(), pg.columnName("last_error")),
    lastEventId: S.NonEmptyString.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Identifier of the last remote event processed; none before the first event.",
      })
      .pipe(pg.text(), pg.columnName("last_event_id")),
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose event stream this cursor tracks.",
    }).pipe(pg.text()),
    status: SyncCursorStatus.annotateKey({
      description: "Health status of the cursor.",
    }).pipe(pg.text()),
    streamPosition: S.NonEmptyString.annotateKey({
      description: "Opaque provider stream position to resume reading from.",
    }).pipe(pg.text(), pg.columnName("stream_position")),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose mirror this cursor watches for remote drift.",
    }).pipe(pg.integer(), pg.columnName("workspace_id"), pg.index()),
  },
  $I.annote("SyncCursor", {
    description: "Durable remote-event stream cursor enabling drift detection to survive app restarts.",
  })
) {}

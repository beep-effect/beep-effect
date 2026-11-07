/**
 * Idempotent SQL hosting for the four legacy read tables.
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  LegacySyncConflict,
  LegacySyncCursor,
  LegacySyncItem,
  LegacySyncOperation,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as Documents from "@beep/shared-domain/identity/Documents";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { markSyncModelWriter } from "./SyncWriterEpoch.service.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/LegacySync.projection");
const IdRows = S.NonEmptyArray(S.Struct({ id: S.Int }));
// The legacy readers decode `entity_type` as the identity's entity type, not the table name.
const entityTypes = {
  item: Documents.SyncItemId.entityType,
  operation: Documents.SyncOperationId.entityType,
  conflict: Documents.SyncConflictId.entityType,
  cursor: Documents.SyncCursorId.entityType,
};
/**
 * Resolves historical envelope provenance and workspace ownership for SQL compatibility.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { LegacySyncAudit } from "@beep/documents-server/aggregates/Sync";
 * void LegacySyncAudit;
 * ```
 * @category projections
 * @since 0.0.0
 */
export class LegacySyncAudit extends Context.Service<
  LegacySyncAudit,
  {
    readonly resolve: (
      stream: string,
      seq: number
    ) => Effect.Effect<{
      readonly orgId: number;
      readonly workspaceId: number;
      readonly principal: string;
      readonly source: string;
    }>;
  }
>()($I`LegacySyncAudit`) {}

const store = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const audit = yield* LegacySyncAudit;
  const path = yield* Path.Path;
  yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_legacy_identity (
   entity text NOT NULL, public_id text NOT NULL, id serial NOT NULL,
   PRIMARY KEY(entity, public_id), UNIQUE(entity, id)
 )`.pipe(Effect.orDie);
  yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_projection_checkpoint (
   projection text NOT NULL, stream text NOT NULL, seq integer NOT NULL,
   PRIMARY KEY(projection, stream)
 )`.pipe(Effect.orDie);
  yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_cursor_selection (
    destination_id text PRIMARY KEY, public_id text, paused boolean NOT NULL
  )`.pipe(Effect.orDie);
  const identity = Effect.fnUntraced(function* (entity: string, publicId: string) {
    const rows = yield* sql`INSERT INTO documents_sync_legacy_identity (entity, public_id)
     VALUES (${entity}, ${publicId}) ON CONFLICT(entity, public_id)
     DO UPDATE SET public_id = EXCLUDED.public_id RETURNING id`.pipe(
      Effect.flatMap(S.decodeUnknownEffect(IdRows)),
      Effect.orDie
    );
    return A.headNonEmpty(rows).id;
  });
  const write = Effect.fnUntraced(function* (
    entity: keyof typeof entityTypes,
    publicId: string,
    stream: string,
    seq: number,
    at: number,
    columns: Readonly<Record<string, unknown>>
  ) {
    yield* sql
      .withTransaction(
        Effect.gen(function* () {
          // The writer epoch fence admits only transactions that carry this marker.
          yield* markSyncModelWriter.pipe(Effect.provideService(SqlClient.SqlClient, sql));
          const accepted = yield* sql`INSERT INTO documents_sync_projection_checkpoint (projection, stream, seq)
       VALUES (${entity}, ${stream}, ${seq})
       ON CONFLICT(projection, stream) DO UPDATE SET seq=EXCLUDED.seq
       WHERE documents_sync_projection_checkpoint.seq < EXCLUDED.seq RETURNING seq`;
          if (A.isReadonlyArrayEmpty(accepted)) return;
          const id = yield* identity(entity, publicId);
          const meta = yield* audit.resolve(stream, seq);
          const table = `documents_sync_${entity}`;
          const existing = yield* sql`SELECT row_version FROM ${sql(table)} WHERE id=${id}`.pipe(
            Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ row_version: S.Int }))))
          );
          // The source checkpoint makes a single increment safe on redelivery; imported
          // row versions are compatibility state and must never reset to source seq.
          const rowVersion = A.isReadonlyArrayNonEmpty(existing) ? existing[0].row_version + 1 : 1;
          const row = {
            id,
            public_id: publicId,
            entity_type: entityTypes[entity],
            org_id: meta.orgId,
            workspace_id: meta.workspaceId,
            provider: "box",
            row_version: rowVersion,
            schema_version: "0.1.0",
            source: meta.source,
            created_at: at,
            updated_at: at,
            created_by_principal: meta.principal,
            updated_by_principal: meta.principal,
            ...columns,
          };
          yield* sql`INSERT INTO ${sql(table)} ${sql.insert(row)}
       ON CONFLICT(id) DO UPDATE SET ${sql.update({
         row_version: rowVersion,
         updated_at: at,
         updated_by_principal: meta.principal,
         ...columns,
       })}`;
        })
      )
      .pipe(Effect.orDie);
  });
  const genesis = Effect.fnUntraced(function* (
    entity: string,
    row: V.LegacyItemRow | V.LegacyOperationRow | V.LegacyConflictRow | V.LegacyCursorRow,
    stream: string,
    seq: number
  ) {
    yield* sql
      .withTransaction(
        Effect.gen(function* () {
          // The writer epoch fence admits only transactions that carry this marker.
          yield* markSyncModelWriter.pipe(Effect.provideService(SqlClient.SqlClient, sql));
          const accepted = yield* sql`INSERT INTO documents_sync_projection_checkpoint (projection, stream, seq)
        VALUES (${entity}, ${stream}, ${seq}) ON CONFLICT(projection, stream) DO UPDATE SET seq=EXCLUDED.seq
        WHERE documents_sync_projection_checkpoint.seq < EXCLUDED.seq RETURNING seq`;
          if (A.isReadonlyArrayEmpty(accepted)) return;
          yield* sql`INSERT INTO documents_sync_legacy_identity (entity, public_id, id)
        VALUES (${entity}, ${row.public_id}, ${row.id}) ON CONFLICT(entity, public_id)
        DO UPDATE SET id = EXCLUDED.id`;
          // JSON values must be serialized for SqlClient's generic insert helper.
          const stored = {
            ...row,
            created_by_principal: yield* S.encodeEffect(S.fromJsonString(S.Unknown))(row.created_by_principal),
            updated_by_principal: yield* S.encodeEffect(S.fromJsonString(S.Unknown))(row.updated_by_principal),
            ...("remote_payload" in row
              ? { remote_payload: yield* S.encodeEffect(S.fromJsonString(S.Unknown))(row.remote_payload) }
              : {}),
          };
          yield* sql`SELECT setval(pg_get_serial_sequence('documents_sync_legacy_identity','id'),
        GREATEST((SELECT COALESCE(MAX(id),1) FROM documents_sync_legacy_identity),
          (SELECT last_value FROM documents_sync_legacy_identity_id_seq)),true)`;
          yield* sql`INSERT INTO ${sql(`documents_sync_${entity}`)} ${sql.insert(stored)}
        ON CONFLICT(id) DO UPDATE SET ${sql.update(stored)}`;
        })
      )
      .pipe(Effect.orDie);
  });
  return { sql, path, identity, write, genesis };
});
const remoteCleared = {
  remote_name: null,
  remote_parent_id: null,
  last_pushed_digest: null,
  last_pushed_generation: null,
  last_error: null,
};
const itemSyncStates: Readonly<Record<string, string>> = { synced: "current", drifted: "conflict" };
const operationStatuses: Readonly<Record<string, string>> = { retrying: "queued", superseded: "failed" };
const encodeEvidence = S.encodeEffect(S.fromJsonString(S.Struct({ evidence: S.String })));
const cursorPublicId = (destinationId: string) =>
  `documents_sync_cursor_a${bytesToHex(sha256(new TextEncoder().encode(destinationId)))}`;
const pushedColumns = (event: V.ItemPushed, digest: string | null, basename: string) => ({
  remote_name: event.remoteName ?? basename,
  remote_parent_id: event.remoteParentId ?? null,
  last_pushed_digest: digest,
  last_pushed_generation: event.generation,
  last_error: null,
});
const itemEventColumns = (event: { readonly _tag: string }, digest: string | null, basename: string) => {
  if (S.is(V.ItemPushed)(event)) return pushedColumns(event, digest, basename);
  return event._tag === "ItemKindReplaced" ? remoteCleared : {};
};
const itemColumns = (state: V.ItemRecord, event: { readonly _tag: string }, basename: string) => {
  const o = state.observation;
  return {
    workspace_id: o.workspaceId,
    content_digest: o.digest,
    content_size_bytes: o.contentSizeBytes ?? null,
    item_kind: o.kind,
    local_generation: o.generation,
    local_rel_path: o.path,
    remote_id: state.remoteId,
    sync_state: itemSyncStates[state.status] ?? state.status,
    ...itemEventColumns(event, o.digest, basename),
  };
};
const operationErrorColumns = (event: { readonly _tag: string }) =>
  S.is(V.OperationFailed)(event) || S.is(V.OperationSuperseded)(event) ? { last_error: event.reason } : {};
const operationColumns = (
  state: V.OperationRecord,
  event: { readonly _tag: string },
  item: number,
  path: Path.Path
) => {
  const input = state.input;
  const parent = path.dirname(input.path);
  return {
    sync_item_id: item,
    operation_type: input.type === "ensureFolder" ? "createFolder" : input.type,
    status: operationStatuses[state.status] ?? state.status,
    attempt_count: state.attempts,
    idempotency_key: input.idempotencyKey,
    input_content_digest: input.digest,
    input_generation: input.generation,
    target_rel_path: input.path,
    target_parent_rel_path: parent === "." ? null : parent,
    target_name: path.basename(input.path),
    ...operationErrorColumns(event),
  };
};
const conflictColumns = (record: V.ConflictRecord, item: number | null, payload: string) => ({
  workspace_id: record.workspaceId,
  sync_item_id: item,
  remote_event_id: record.remoteEventId,
  remote_payload: payload,
  remote_id: record.remoteId ?? null,
  local_rel_path: record.path ?? null,
  conflict_kind: record.kind ?? "remoteUnknown",
  resolution_status: record.reviewed ? "reviewed" : "open",
});
const cursorColumns = (
  state: { readonly workspaceId: number; readonly cursor: string; readonly cursorError: string | null },
  event: { readonly _tag: string }
) => ({
  workspace_id: state.workspaceId,
  stream_position: state.cursor,
  ...(S.is(V.CursorAdvanced)(event) && event.lastEventId !== undefined ? { last_event_id: event.lastEventId } : {}),
  last_error: state.cursorError,
  status: state.cursorError === null ? "active" : "error",
});
const SelectionRows = S.Array(S.Struct({ public_id: S.NullOr(S.String), paused: S.Boolean }));
const OwnerRows = S.Array(S.Struct({ workspace_id: S.Int }));
/**
 * Writes derived rows with D14 numeric references and transactional delivery checkpoints.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { LegacySyncProjections } from "@beep/documents-server/aggregates/Sync";
 * void LegacySyncProjections;
 * ```
 * @category projections
 * @since 0.0.0
 */
export const LegacySyncProjections = Layer.mergeAll(
  LegacySyncItem.toLayer(
    Effect.gen(function* () {
      const { genesis, write, path } = yield* store;
      return Effect.fnUntraced(function* (batch) {
        for (const { source, state, event, envelope } of batch) {
          if (event._tag === "ItemGenesisImported") {
            yield* genesis("item", event.row, envelope.stream, envelope.seq);
            continue;
          }
          if (state === null) continue;
          const columns = itemColumns(state, event, path.basename(state.observation.path));
          yield* write("item", source.id, envelope.stream, envelope.seq, DateTime.toEpochMillis(envelope.at), columns);
        }
      });
    })
  ),
  LegacySyncOperation.toLayer(
    Effect.gen(function* () {
      const { genesis, write, path, identity, sql } = yield* store;
      // The operation belongs to its item's workspace; the item row is projected first.
      const itemWorkspace = Effect.fnUntraced(function* (item: number) {
        const owner = yield* sql`SELECT workspace_id FROM documents_sync_item WHERE id = ${item}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(OwnerRows)),
          Effect.orDie
        );
        return A.isReadonlyArrayNonEmpty(owner) ? { workspace_id: owner[0].workspace_id } : {};
      });
      return Effect.fnUntraced(function* (batch) {
        for (const { source, state, envelope, event } of batch) {
          if (event._tag === "OperationGenesisImported") {
            yield* genesis("operation", event.row, envelope.stream, envelope.seq);
            continue;
          }
          if (state === null) continue;
          const item = yield* identity("item", state.input.itemId);
          const owner = yield* itemWorkspace(item);
          const columns = { ...owner, ...operationColumns(state, event, item, path) };
          yield* write(
            "operation",
            source.id,
            envelope.stream,
            envelope.seq,
            DateTime.toEpochMillis(envelope.at),
            columns
          );
        }
      });
    })
  ),
  LegacySyncConflict.toLayer(
    Effect.gen(function* () {
      const { genesis, write, identity } = yield* store;
      return Effect.fnUntraced(function* (batch) {
        for (const { source, event, envelope } of batch) {
          if (event._tag === "ConflictGenesisImported") {
            yield* genesis("conflict", event.row, envelope.stream, envelope.seq);
            continue;
          }
          const record = event.record;
          const item = record.itemId === null ? null : yield* identity("item", record.itemId);
          const payload = yield* encodeEvidence({ evidence: record.evidence }).pipe(Effect.orDie);
          const columns = conflictColumns(record, item, payload);
          yield* write(
            "conflict",
            source.id,
            envelope.stream,
            envelope.seq,
            DateTime.toEpochMillis(envelope.at),
            columns
          );
        }
      });
    })
  ),
  LegacySyncCursor.toLayer(
    Effect.gen(function* () {
      const { genesis, write, sql } = yield* store;
      const importCursor = Effect.fnUntraced(function* (
        destinationId: string,
        event: V.CursorGenesisImported,
        envelope: { readonly stream: string; readonly seq: number }
      ) {
        yield* genesis("cursor", event.row, envelope.stream, envelope.seq);
        yield* sql`INSERT INTO documents_sync_cursor_selection (destination_id,public_id,paused)
          VALUES (${destinationId},${event.selected ? event.row.public_id : null},${event.paused})
          ON CONFLICT(destination_id) DO UPDATE SET public_id=EXCLUDED.public_id,paused=EXCLUDED.paused`.pipe(
          Effect.orDie
        );
      });
      // A paused or unselected imported cursor keeps its row; otherwise the selected or derived id is written.
      const selectedCursor = Effect.fnUntraced(function* (destinationId: string) {
        const rows = yield* sql`SELECT public_id,paused FROM documents_sync_cursor_selection
          WHERE destination_id=${destinationId}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(SelectionRows)),
          Effect.orDie
        );
        if (!A.isReadonlyArrayNonEmpty(rows)) return O.some(cursorPublicId(destinationId));
        return rows[0].paused ? O.none() : O.fromNullOr(rows[0].public_id);
      });
      return Effect.fnUntraced(function* (batch) {
        for (const { source, state, envelope, event } of batch) {
          if (event._tag === "CursorGenesisImported") {
            yield* importCursor(source.id, event, envelope);
            continue;
          }
          if (event._tag !== "CursorAdvanced" && event._tag !== "CursorFailed") continue;
          if (state?._tag !== "Registered" || state.cursor === null) continue;
          const publicId = yield* selectedCursor(source.id);
          if (O.isNone(publicId)) continue;
          const at = DateTime.toEpochMillis(envelope.at);
          const columns = cursorColumns({ ...state, cursor: state.cursor }, event);
          yield* write("cursor", publicId.value, envelope.stream, envelope.seq, at, columns);
        }
      });
    })
  )
);

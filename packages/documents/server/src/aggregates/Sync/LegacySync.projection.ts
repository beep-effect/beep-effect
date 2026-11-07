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
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const $I = $DocumentsServerId.create("aggregates/Sync/LegacySync.projection");
const IdRows = S.NonEmptyArray(S.Struct({ id: S.Int }));
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
    entity: string,
    publicId: string,
    stream: string,
    seq: number,
    at: number,
    columns: Readonly<Record<string, unknown>>
  ) {
    yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const accepted = yield* sql`INSERT INTO documents_sync_projection_checkpoint (projection, stream, seq)
       VALUES (${entity}, ${stream}, ${seq})
       ON CONFLICT(projection, stream) DO UPDATE SET seq=EXCLUDED.seq
       WHERE documents_sync_projection_checkpoint.seq < EXCLUDED.seq RETURNING seq`;
          if (A.isReadonlyArrayEmpty(accepted)) return;
          const id = yield* identity(entity, publicId);
          const meta = yield* audit.resolve(stream, seq);
          const table = `documents_sync_${entity}`;
          // The envelope sequence is a replay-stable row version, never an increment on delivery.
          const row = {
            id,
            public_id: publicId,
            entity_type: table,
            org_id: meta.orgId,
            workspace_id: meta.workspaceId,
            provider: "box",
            row_version: seq,
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
         row_version: seq,
         updated_at: at,
         updated_by_principal: meta.principal,
         ...columns,
       })}`;
        })
      )
      .pipe(Effect.orDie);
  });
  return { sql, path, identity, write };
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
  sync_item_id: item,
  remote_event_id: record.remoteEventId,
  remote_payload: payload,
  remote_id: record.remoteId ?? null,
  local_rel_path: record.path ?? null,
  conflict_kind: record.kind ?? "remoteUnknown",
  resolution_status: record.reviewed ? "reviewed" : "open",
});
const cursorColumns = (cursor: string, cursorError: string | null, event: { readonly _tag: string }) => ({
  stream_position: cursor,
  ...(S.is(V.CursorAdvanced)(event) && event.lastEventId !== undefined ? { last_event_id: event.lastEventId } : {}),
  last_error: cursorError,
  status: cursorError === null ? "active" : "error",
});
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
      const { write, path } = yield* store;
      return Effect.fnUntraced(function* (batch) {
        for (const { source, state, event, envelope } of batch) {
          if (state === null) continue;
          const columns = itemColumns(state, event, path.basename(state.observation.path));
          yield* write("item", source.id, envelope.stream, envelope.seq, DateTime.toEpochMillis(envelope.at), columns);
        }
      });
    })
  ),
  LegacySyncOperation.toLayer(
    Effect.gen(function* () {
      const { write, path, identity } = yield* store;
      return Effect.fnUntraced(function* (batch) {
        for (const { source, state, envelope, event } of batch) {
          if (state === null) continue;
          const item = yield* identity("item", state.input.itemId);
          const columns = operationColumns(state, event, item, path);
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
      const { write, identity } = yield* store;
      return Effect.fnUntraced(function* (batch) {
        for (const { source, event, envelope } of batch) {
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
      const { write } = yield* store;
      return Effect.fnUntraced(function* (batch) {
        for (const { source, state, envelope, event } of batch) {
          if (state?._tag !== "Registered" || state.cursor === null) continue;
          const at = DateTime.toEpochMillis(envelope.at);
          const columns = cursorColumns(state.cursor, state.cursorError, event);
          yield* write("cursor", cursorPublicId(source.id), envelope.stream, envelope.seq, at, columns);
        }
      });
    })
  )
);

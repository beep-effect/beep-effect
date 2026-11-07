/**
 * Idempotent SQL hosting for the four legacy read tables.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  LegacySyncConflict,
  LegacySyncCursor,
  LegacySyncItem,
  LegacySyncOperation,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
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
          const o = state.observation;
          const pushed = event._tag === "ItemPushed";
          yield* write("item", source.id, envelope.stream, envelope.seq, DateTime.toEpochMillis(envelope.at), {
            content_digest: o.digest,
            item_kind: o.kind,
            local_generation: o.generation,
            local_rel_path: o.path,
            remote_id: state.remoteId,
            remote_name: state.remoteId === null ? null : path.basename(o.path),
            sync_state: state.status === "synced" ? "current" : state.status === "drifted" ? "conflict" : state.status,
            ...(pushed ? { last_pushed_digest: o.digest, last_pushed_generation: event.generation } : {}),
          });
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
          const input = state.input;
          const item = yield* identity("item", input.itemId);
          yield* write("operation", source.id, envelope.stream, envelope.seq, DateTime.toEpochMillis(envelope.at), {
            sync_item_id: item,
            operation_type: input.type === "ensureFolder" ? "createFolder" : input.type,
            status: state.status === "retrying" ? "queued" : state.status === "superseded" ? "failed" : state.status,
            attempt_count: state.attempts,
            idempotency_key: input.idempotencyKey,
            input_content_digest: input.digest,
            input_generation: input.generation,
            target_rel_path: input.path,
            target_parent_rel_path: path.dirname(input.path) === "." ? null : path.dirname(input.path),
            target_name: path.basename(input.path),
            ...(event._tag === "OperationFailed" || event._tag === "OperationSuperseded"
              ? { last_error: event.reason }
              : {}),
          });
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
          yield* write("conflict", source.id, envelope.stream, envelope.seq, DateTime.toEpochMillis(envelope.at), {
            sync_item_id: item,
            remote_event_id: record.remoteEventId,
            remote_payload: record.evidence,
            conflict_kind: "remoteUnknown",
            resolution_status: record.reviewed ? "reviewed" : "open",
          });
        }
      });
    })
  ),
  LegacySyncCursor.toLayer(
    Effect.gen(function* () {
      const { write } = yield* store;
      return Effect.fnUntraced(function* (batch) {
        for (const { source, state, envelope } of batch) {
          if (state === null || state._tag !== "Registered" || state.cursor === null) continue;
          yield* write("cursor", source.id, envelope.stream, envelope.seq, DateTime.toEpochMillis(envelope.at), {
            stream_position: state.cursor,
            last_error: state.cursorError,
            status: state.cursorError === null ? "active" : "error",
          });
        }
      });
    })
  )
);

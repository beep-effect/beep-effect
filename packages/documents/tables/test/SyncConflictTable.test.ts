import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import {
  fromSyncConflictRow,
  SYNC_CONFLICT_TABLE_NAME,
  syncConflictTable,
  toSyncConflictInsert,
} from "@beep/documents-tables/entities/SyncConflict";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SyncConflictRow } from "@beep/documents-tables/entities/SyncConflict";

const decodeUnknownSyncConflict = S.decodeUnknownEffect(DomainSyncConflict.SyncConflict);

const SyncConflictEquivalence = S.toEquivalence(DomainSyncConflict.SyncConflict);

// The row codec is a class schema, so an unencodable entity has to stay an
// instance of its model: clone onto the same prototype and corrupt a single
// column rather than handing the encoder a bare struct it would reject wholesale.
const withUnencodablePublicId = <A extends object>(entity: A): A =>
  Object.assign(Object.create(Object.getPrototypeOf(entity)), entity, { publicId: 42 });

const converterFailure = <A, E>(result: Result.Result<A, E>): Effect.Effect<E, A> =>
  result.pipe(Result.flip, Effect.fromResult);

const expectConverterFailure = (error: { readonly _tag: string; readonly message: string }, tag: string): void => {
  expect(error._tag).toBe(tag);
  expect(Str.isNonEmpty(error.message)).toBe(true);
};

const indexConfigNamed = (name: string) =>
  pipe(
    getTableConfig(syncConflictTable).indexes,
    A.findFirst((indexConfig) => indexConfig.config.name === name)
  );

const mappedDriftRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncConflictId.entityType, 40),
  conflictKind: "remoteEdit",
  localRelPath: "matters/client-default/complaint.pdf",
  provider: "box",
  remoteEventId: "evt-1",
  remoteId: "9001",
  remotePayload: { eventType: "ITEM_MODIFY", itemId: "9001" },
  resolutionStatus: "open",
  syncItemId: 1,
  workspaceId: 2,
};

describe("SyncConflict table", () => {
  it("materializes SyncConflict metadata without executing a live database", () => {
    const columns = getColumns(syncConflictTable);

    expect(getTableConfig(syncConflictTable).name).toBe("documents_sync_conflict");
    expect(SYNC_CONFLICT_TABLE_NAME).toBe("documents_sync_conflict");
    expect(DomainSyncConflict.SyncConflict.sql.tableName).toBe("documents_sync_conflict");
    expect(columns.id.primary).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.conflictKind.name).toBe("conflict_kind");
    expect(columns.conflictKind.columnType).toBe("PgText");
    expect(columns.conflictKind.notNull).toBe(true);
    expect(columns.localRelPath.name).toBe("local_rel_path");
    expect(columns.localRelPath.notNull).toBe(false);
    expect(columns.remoteEventId.name).toBe("remote_event_id");
    expect(columns.remoteEventId.notNull).toBe(false);
    expect(columns.remotePayload.name).toBe("remote_payload");
    expect(columns.remotePayload.columnType).toBe("PgJsonb");
    expect(columns.remotePayload.notNull).toBe(true);
    expect(columns.resolutionStatus.name).toBe("resolution_status");
    expect(columns.syncItemId.name).toBe("sync_item_id");
    expect(columns.syncItemId.notNull).toBe(false);
    expect(columns.workspaceId.name).toBe("workspace_id");
    expect(columns.workspaceId.notNull).toBe(true);
  });

  it("builds the SyncConflict indexes from schema-first hints", () => {
    const publicIdUnique = indexConfigNamed("documents_sync_conflict_public_id_unique_idx");
    const conflictKindLookup = indexConfigNamed("documents_sync_conflict_conflict_kind_lookup_idx");
    const remoteEventIdLookup = indexConfigNamed("documents_sync_conflict_remote_event_id_lookup_idx");
    const resolutionStatusLookup = indexConfigNamed("documents_sync_conflict_resolution_status_lookup_idx");
    const workspaceIdBtree = indexConfigNamed("documents_sync_conflict_workspace_id_btree_idx");

    expect(O.getOrThrow(publicIdUnique).config.unique).toBe(true);
    expect(O.getOrThrow(conflictKindLookup).config.columns[0]).toMatchObject({ name: "conflict_kind" });
    expect(O.getOrThrow(remoteEventIdLookup).config.columns[0]).toMatchObject({ name: "remote_event_id" });
    expect(O.getOrThrow(resolutionStatusLookup).config.columns[0]).toMatchObject({ name: "resolution_status" });
    expect(O.getOrThrow(workspaceIdBtree).config.columns[0]).toMatchObject({ name: "workspace_id" });
  });

  it.effect(
    "round-trips SyncConflict rows through the converters",
    Effect.fnUntraced(function* () {
      const syncConflict = yield* decodeUnknownSyncConflict(mappedDriftRow);
      const insert = yield* Effect.fromResult(toSyncConflictInsert(syncConflict));

      expect("id" in insert).toBe(false);
      expect(insert.conflictKind).toBe("remoteEdit");
      expect(insert.remotePayload).toEqual({ eventType: "ITEM_MODIFY", itemId: "9001" });
      expect(insert.entityType).toBe("DocumentsSyncConflict");

      const roundTripped = yield* Effect.fromResult(
        fromSyncConflictRow({
          ...insert,
          id: 40,
          // $inferInsert types nullable columns as `value | null | undefined`; the
          // select-row converter expects `value | null`, so resolve absent
          // optionals to their concrete nulls before round-tripping.
          localRelPath: insert.localRelPath ?? null,
          remoteEventId: insert.remoteEventId ?? null,
          remoteId: insert.remoteId ?? null,
          syncItemId: insert.syncItemId ?? null,
        })
      );

      expect(roundTripped.syncItemId).toEqual(O.some(1));
      expect(roundTripped.remoteId).toEqual(O.some("9001"));
      expect(SyncConflictEquivalence(roundTripped, syncConflict)).toBe(true);
    })
  );

  it.prop(
    "round-trips schema-derived SyncConflicts through the row converters",
    [S.toType(DomainSyncConflict.SyncConflict)],
    ([syncConflict]) => {
      const insert = toSyncConflictInsert(syncConflict);
      expect(Result.isSuccess(insert)).toBe(true);
      if (!Result.isSuccess(insert)) {
        return;
      }
      const decoded = fromSyncConflictRow({
        ...insert.success,
        id: syncConflict.id,
        localRelPath: insert.success.localRelPath ?? null,
        remoteEventId: insert.success.remoteEventId ?? null,
        remoteId: insert.success.remoteId ?? null,
        syncItemId: insert.success.syncItemId ?? null,
      });
      expect(Result.isSuccess(decoded)).toBe(true);
      if (!Result.isSuccess(decoded)) {
        return;
      }

      expect(SyncConflictEquivalence(decoded.success, syncConflict)).toBe(true);
    },
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "reports a typed converter failure on both sides of the SyncConflict boundary",
    Effect.fnUntraced(function* () {
      const syncConflict = yield* decodeUnknownSyncConflict(mappedDriftRow);
      const insert = yield* Effect.fromResult(toSyncConflictInsert(syncConflict));

      expectConverterFailure(
        yield* converterFailure(toSyncConflictInsert(withUnencodablePublicId(syncConflict))),
        "SyncConflictConverterError"
      );
      expectConverterFailure(
        yield* converterFailure(
          fromSyncConflictRow({
            ...insert,
            id: 40,
            localRelPath: insert.localRelPath ?? null,
            publicId: 42,
            remoteEventId: insert.remoteEventId ?? null,
            remoteId: insert.remoteId ?? null,
            syncItemId: insert.syncItemId ?? null,
          } as unknown as SyncConflictRow)
        ),
        "SyncConflictConverterError"
      );
    })
  );
});

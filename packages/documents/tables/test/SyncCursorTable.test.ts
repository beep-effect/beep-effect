import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import {
  fromSyncCursorRow,
  SYNC_CURSOR_TABLE_NAME,
  syncCursorTable,
  toSyncCursorInsert,
} from "@beep/documents-tables/entities/SyncCursor";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SyncCursorRow } from "@beep/documents-tables/entities/SyncCursor";

const decodeUnknownSyncCursor = S.decodeUnknownEffect(DomainSyncCursor.SyncCursor);

const SyncCursorEquivalence = S.toEquivalence(DomainSyncCursor.SyncCursor);

// The row codec is a class schema, so an unencodable entity has to stay an
// instance of its model: clone onto the same prototype and corrupt a single
// column rather than handing the encoder a bare struct it would reject wholesale.
const withUnencodablePublicId = <A extends object>(entity: A): A =>
  Object.assign(Object.create(Object.getPrototypeOf(entity)), entity, { publicId: 42 });

const converterFailure = <A, E>(result: Result.Result<A, E>): Effect.Effect<E, A> =>
  result.pipe(Result.flip, Effect.fromResult);

const expectConverterFailure = (error: { readonly _tag: string; readonly message: string }, tag: string): void => {
  expect(error._tag).toBe(tag);
  pipe(Str.isNonEmpty(error.message), assertTrue);
};

const indexConfigNamed = (name: string) =>
  pipe(
    getTableConfig(syncCursorTable).indexes,
    A.findFirst((indexConfig) => indexConfig.config.name === name)
  );

const activeCursorRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncCursorId.entityType, 30),
  lastError: null,
  lastEventId: "evt-1",
  provider: "box",
  status: "active",
  streamPosition: "now",
  workspaceId: 2,
};

describe("SyncCursor table", () => {
  it("materializes SyncCursor metadata without executing a live database", () => {
    const columns = getColumns(syncCursorTable);

    expect(getTableConfig(syncCursorTable).name).toBe("documents_sync_cursor");
    expect(SYNC_CURSOR_TABLE_NAME).toBe("documents_sync_cursor");
    expect(DomainSyncCursor.SyncCursor.sql.tableName).toBe("documents_sync_cursor");
    pipe(columns.id.primary, assertTrue);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.lastError.name).toBe("last_error");
    pipe(columns.lastError.notNull, assertFalse);
    expect(columns.lastEventId.name).toBe("last_event_id");
    pipe(columns.lastEventId.notNull, assertFalse);
    expect(columns.provider.columnType).toBe("PgText");
    expect(columns.streamPosition.name).toBe("stream_position");
    pipe(columns.streamPosition.notNull, assertTrue);
    expect(columns.workspaceId.name).toBe("workspace_id");
    expect(columns.workspaceId.columnType).toBe("PgInteger");
    pipe(columns.workspaceId.notNull, assertTrue);
  });

  it("builds the SyncCursor indexes from schema-first hints", () => {
    const publicIdUnique = indexConfigNamed("documents_sync_cursor_public_id_unique_idx");
    const workspaceIdBtree = indexConfigNamed("documents_sync_cursor_workspace_id_btree_idx");

    pipe(O.getOrThrow(publicIdUnique).config.unique, assertTrue);
    expect(O.getOrThrow(workspaceIdBtree).config.columns[0]).toMatchObject({ name: "workspace_id" });
  });

  it.effect(
    "round-trips SyncCursor rows through the converters",
    Effect.fnUntraced(function* () {
      const syncCursor = yield* decodeUnknownSyncCursor(activeCursorRow);
      const insert = yield* Effect.fromResult(toSyncCursorInsert(syncCursor));

      pipe("id" in insert, assertFalse);
      expect(insert.status).toBe("active");
      expect(insert.streamPosition).toBe("now");
      expect(insert.entityType).toBe("DocumentsSyncCursor");

      const roundTripped = yield* Effect.fromResult(
        fromSyncCursorRow({
          ...insert,
          id: 30,
          // $inferInsert types nullable columns as `value | null | undefined`; the
          // select-row converter expects `value | null`, so resolve absent
          // optionals to their concrete nulls before round-tripping.
          lastError: insert.lastError ?? null,
          lastEventId: insert.lastEventId ?? null,
        })
      );

      assertNone(roundTripped.lastError);
      assertSome<string>(roundTripped.lastEventId, "evt-1");
      pipe(SyncCursorEquivalence(roundTripped, syncCursor), assertTrue);
    })
  );

  it.prop(
    "round-trips schema-derived SyncCursors through the row converters",
    [S.toType(DomainSyncCursor.SyncCursor)],
    ([syncCursor]) => {
      const insert = toSyncCursorInsert(syncCursor);
      pipe(insert, Result.isSuccess, assertTrue);
      if (!Result.isSuccess(insert)) {
        return;
      }
      const decoded = fromSyncCursorRow({
        ...insert.success,
        id: syncCursor.id,
        lastError: insert.success.lastError ?? null,
        lastEventId: insert.success.lastEventId ?? null,
      });
      pipe(decoded, Result.isSuccess, assertTrue);
      if (!Result.isSuccess(decoded)) {
        return;
      }

      pipe(SyncCursorEquivalence(decoded.success, syncCursor), assertTrue);
    },
    { arbitrary: fcRuns(50) }
  );

  it.effect(
    "reports a typed converter failure on both sides of the SyncCursor boundary",
    Effect.fnUntraced(function* () {
      const syncCursor = yield* decodeUnknownSyncCursor(activeCursorRow);
      const insert = yield* Effect.fromResult(toSyncCursorInsert(syncCursor));

      expectConverterFailure(
        yield* converterFailure(toSyncCursorInsert(withUnencodablePublicId(syncCursor))),
        "SyncCursorConverterError"
      );
      expectConverterFailure(
        yield* converterFailure(
          fromSyncCursorRow({
            ...insert,
            id: 30,
            lastError: insert.lastError ?? null,
            lastEventId: insert.lastEventId ?? null,
            publicId: 42,
          } as unknown as SyncCursorRow)
        ),
        "SyncCursorConverterError"
      );
    })
  );
});

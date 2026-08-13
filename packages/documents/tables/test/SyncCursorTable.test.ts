import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import {
  fromSyncCursorRow,
  SYNC_CURSOR_TABLE_NAME,
  syncCursorTable,
  toSyncCursorInsert,
} from "@beep/documents-tables/entities/SyncCursor";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const SyncCursorArbitrary = S.toArbitrary(DomainSyncCursor.SyncCursor)(fc);
const SyncCursorEquivalence = S.toEquivalence(DomainSyncCursor.SyncCursor);

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
    expect(columns.id.primary).toBe(true);
    expect(columns.id.columnType).toBe("PgSerial");
    expect(columns.lastError.name).toBe("last_error");
    expect(columns.lastError.notNull).toBe(false);
    expect(columns.lastEventId.name).toBe("last_event_id");
    expect(columns.lastEventId.notNull).toBe(false);
    expect(columns.provider.columnType).toBe("PgText");
    expect(columns.streamPosition.name).toBe("stream_position");
    expect(columns.streamPosition.notNull).toBe(true);
    expect(columns.workspaceId.name).toBe("workspace_id");
    expect(columns.workspaceId.columnType).toBe("PgInteger");
    expect(columns.workspaceId.notNull).toBe(true);
  });

  it("builds the SyncCursor indexes from schema-first hints", () => {
    const publicIdUnique = indexConfigNamed("documents_sync_cursor_public_id_unique_idx");
    const workspaceIdBtree = indexConfigNamed("documents_sync_cursor_workspace_id_btree_idx");

    expect(O.getOrThrow(publicIdUnique).config.unique).toBe(true);
    expect(O.getOrThrow(workspaceIdBtree).config.columns[0]).toMatchObject({ name: "workspace_id" });
  });

  it("round-trips SyncCursor rows through the converters", () => {
    const syncCursor = S.decodeUnknownSync(DomainSyncCursor.SyncCursor)(activeCursorRow);
    const insert = toSyncCursorInsert(syncCursor);

    expect("id" in insert).toBe(false);
    expect(insert.status).toBe("active");
    expect(insert.streamPosition).toBe("now");
    expect(insert.entityType).toBe("DocumentsSyncCursor");

    const roundTripped = fromSyncCursorRow({
      ...insert,
      id: 30,
      // $inferInsert types nullable columns as `value | null | undefined`; the
      // select-row converter expects `value | null`, so resolve absent
      // optionals to their concrete nulls before round-tripping.
      lastError: insert.lastError ?? null,
      lastEventId: insert.lastEventId ?? null,
    });

    expect(roundTripped.lastError).toEqual(O.none());
    expect(roundTripped.lastEventId).toEqual(O.some("evt-1"));
    expect(SyncCursorEquivalence(roundTripped, syncCursor)).toBe(true);
  });

  it("round-trips schema-derived SyncCursors through the row converters", () =>
    fc.assert(
      fc.property(SyncCursorArbitrary, (syncCursor) => {
        const insert = toSyncCursorInsert(syncCursor);
        const decoded = fromSyncCursorRow({
          ...insert,
          id: syncCursor.id,
          lastError: insert.lastError ?? null,
          lastEventId: insert.lastEventId ?? null,
        });

        expect(SyncCursorEquivalence(decoded, syncCursor)).toBe(true);
      }),
      fcRuns(50)
    ));
});

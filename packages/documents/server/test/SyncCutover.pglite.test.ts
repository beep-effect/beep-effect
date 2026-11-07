import * as NodeURL from "node:url";
import { backupSyncTables, restoreSyncTables } from "@beep/documents-server/aggregates/Sync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const infrastructure = Layer.mergeAll(PgliteTestLayer, BunServices.layer);
describe("offline vault-sync reversal", () => {
  layer(infrastructure, { timeout: "30 seconds" })("synthetic store", (it) => {
    it.effect("retains complete rows and called/uncalled sequence state across repeated backup and restore", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const fs = yield* FileSystem.FileSystem;
        const ddl = yield* fs.readFileString(
          NodeURL.fileURLToPath(
            new URL("../../../_internal/db-admin/drizzle/20260813130540_baseline/migration.sql", import.meta.url)
          )
        );
        for (const statement of Str.split(ddl, "--> statement-breakpoint")) {
          if (Str.startsWith('CREATE TABLE "documents_sync_')(Str.trim(statement))) yield* sql.unsafe(statement);
        }
        const row = {
          id: 73,
          public_id: "documents_sync_item_asynthetic",
          entity_type: "documents_sync_item",
          org_id: 1,
          workspace_id: 17,
          row_version: 19,
          schema_version: "historical-v1",
          source: "Import",
          created_at: 1700000000123,
          updated_at: 1700000000999,
          created_by_principal: '{"_tag":"System","name":"creator"}',
          updated_by_principal: '{"_tag":"System","name":"editor"}',
          provider: "box",
          local_rel_path: "synthetic.txt",
          item_kind: "file",
          content_digest: "new-digest",
          content_size_bytes: 42,
          local_generation: 8,
          remote_id: "remote",
          remote_name: "old-name",
          remote_parent_id: "parent",
          last_pushed_digest: "old-digest",
          last_pushed_generation: 6,
          sync_state: "conflict",
          last_error: "historical error",
        };
        yield* sql`INSERT INTO documents_sync_item ${sql.insert(row)}`;
        yield* sql`SELECT setval('documents_sync_item_id_seq', 999, true)`;
        const before = yield* sql`SELECT * FROM documents_sync_item`;
        yield* backupSyncTables("synthetic-v1");
        yield* backupSyncTables("synthetic-v1");
        yield* sql`UPDATE documents_sync_item SET last_error='changed', row_version=999`;
        yield* sql`SELECT nextval('documents_sync_cursor_id_seq')`;
        yield* sql`SELECT nextval('documents_sync_item_id_seq')`;
        expect(yield* backupSyncTables("another-import").pipe(Effect.result)).toMatchObject({ _tag: "Failure" });
        yield* restoreSyncTables("synthetic-v1");
        expect(yield* sql`SELECT * FROM documents_sync_item`).toEqual(before);
        expect(yield* sql`SELECT nextval('documents_sync_item_id_seq') AS id`).toEqual([{ id: 1000 }]);
        expect(yield* sql`SELECT nextval('documents_sync_cursor_id_seq') AS id`).toEqual([{ id: 1 }]);
        yield* restoreSyncTables("synthetic-v1");
        expect(yield* sql`SELECT nextval('documents_sync_item_id_seq') AS id`).toEqual([{ id: 1001 }]);
      })
    );
  });
});

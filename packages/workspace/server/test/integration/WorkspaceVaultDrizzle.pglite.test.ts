import * as NodeURL from "node:url";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { makeDrizzleWorkspaceVaultStore } from "@beep/workspace-server/aggregates/Workspace";
import { DbSchema } from "@beep/workspace-tables";
import { Workspace } from "@beep/workspace-use-cases/server";
import { describe, expect } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
const decodeSetWorkspaceVaultInput = S.decodeUnknownEffect(Workspace.SetWorkspaceVaultInput);

// The db-admin drizzle folder contains `CREATE EXTENSION btree_gist`, so the
// suite is pinned to the in-process driver with the bundled extension.
const WorkspaceVaultDrizzleLayer = makeDrizzleLayer().pipe(
  Layer.provideMerge(
    Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }))
  ),
  Layer.provideMerge(MemoryFileSystem.layer)
);

const migrateWorkspace = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  yield* migrate(db, {
    migrationsFolder,
    migrationsSchema: pipe(
      info.schema,
      O.getOrElse(() => "drizzle")
    ),
  });
});

if (!shouldRunPgliteIntegration) {
  describe.skip("Workspace vault store Drizzle PgLite integration", () => {});
} else {
  describe("Workspace vault store Drizzle PgLite integration", { concurrent: false }, () => {
    it.layer(WorkspaceVaultDrizzleLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "advances the workspace row version when the vault root moves",
        Effect.fnUntraced(function* () {
          yield* migrateWorkspace();
          const fs = yield* FileSystem.FileSystem;
          const store = yield* makeDrizzleWorkspaceVaultStore();
          const db = yield* makeDrizzle();
          const first = yield* fs.makeTempDirectoryScoped({ prefix: "beep-workspace-vault-a-" });
          const second = yield* fs.makeTempDirectoryScoped({ prefix: "beep-workspace-vault-b-" });

          // The first call inserts the row at version 1; the move updates one
          // column and must still advance the optimistic token.
          const decodedSetWorkspaceVaultInput = yield* decodeSetWorkspaceVaultInput({
            vaultRootPath: first,
            workspaceId: 9,
          });
          yield* store.setVaultRoot(decodedSetWorkspaceVaultInput);
          const decodedSetWorkspaceVaultInput1 = yield* decodeSetWorkspaceVaultInput({
            vaultRootPath: second,
            workspaceId: 9,
          });
          yield* store.setVaultRoot(decodedSetWorkspaceVaultInput1);

          const rows = yield* db
            .select({ rowVersion: DbSchema.workspace.rowVersion, vaultRootPath: DbSchema.workspace.vaultRootPath })
            .from(DbSchema.workspace);
          expect(A.map(rows, (row) => [row.vaultRootPath, row.rowVersion] as const)).toEqual([[second, 2]]);
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}

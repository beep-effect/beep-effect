/** Real SQL optimistic-concurrency contracts in the canonical coverage census. */
import * as NodeURL from "node:url";
import { makeDrizzleSyncConflictRepository } from "@beep/documents-server/entities/SyncConflict";
import { makeDrizzleSyncCursorRepository } from "@beep/documents-server/entities/SyncCursor";
import { makeDrizzleSyncItemRepository } from "@beep/documents-server/entities/SyncItem";
import { makeDrizzleSyncOperationRepository } from "@beep/documents-server/entities/SyncOperation";
import { makeDrizzle, makeDrizzleLayer, migrate, PostgresDrizzle } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { drizzleWithCompetingWrite } from "./CompetingWrite.ts";
import * as Versioning from "./SyncRepositoryVersioning.contract.ts";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));
const migratedDatabase = makeDrizzleLayer().pipe(
  Layer.provideMerge(
    Layer.fresh(makePgliteSqlTestLayer({ mode: "in-process", inProcess: { extensions: { btree_gist } } }))
  )
);
const migrateSync = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const madeDrizzle = yield* makeDrizzle();
  yield* migrate(madeDrizzle, {
    migrationsFolder,
    migrationsSchema: O.getOrElse(info.schema, () => "drizzle"),
  });
});

it.layer(migratedDatabase, { timeout: "2 minutes", concurrent: false })("Drizzle sync concurrency", (it) => {
  it.effect("preserves the winning item and rejects the stale SQL update", () =>
    Effect.gen(function* () {
      yield* migrateSync();
      const madeDrizzleSyncItemRepository = yield* makeDrizzleSyncItemRepository();
      yield* Versioning.staleSyncItemUpdate(madeDrizzleSyncItemRepository);
    })
  );
  it.effect("requeues a leased operation and refuses the worker's stale completion", () =>
    Effect.gen(function* () {
      yield* migrateSync();
      const madeDrizzleSyncOperationRepository = yield* makeDrizzleSyncOperationRepository();
      yield* Versioning.staleSyncOperationAfterRequeue(madeDrizzleSyncOperationRepository);
    })
  );
  it.effect("advances reviewed conflict versions and preserves a competing writer", () =>
    Effect.gen(function* () {
      yield* migrateSync();
      const repository = yield* makeDrizzleSyncConflictRepository();
      yield* Versioning.reviewAdvancesSyncConflictVersion(repository);
      yield* Versioning.racedSyncConflictReview(repository, (id) =>
        drizzleWithCompetingWrite("documents_sync_conflict", id).pipe(
          Effect.flatMap((db) => makeDrizzleSyncConflictRepository().pipe(Effect.provideService(PostgresDrizzle, db))),
          Effect.orDie
        )
      );
    })
  );
  it.effect("advances replaced cursor versions and preserves the winning stream position", () =>
    Effect.gen(function* () {
      yield* migrateSync();
      const repository = yield* makeDrizzleSyncCursorRepository();
      yield* Versioning.upsertAdvancesSyncCursorVersion(repository);
      yield* Versioning.racedSyncCursorUpsert(repository, (id) =>
        drizzleWithCompetingWrite("documents_sync_cursor", id).pipe(
          Effect.flatMap((db) => makeDrizzleSyncCursorRepository().pipe(Effect.provideService(PostgresDrizzle, db))),
          Effect.orDie
        )
      );
    })
  );
});

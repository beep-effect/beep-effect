/** Hosting failure paths: unreadable read model, missing roots, refused admission, default config. */
import * as NodeURL from "node:url";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  BoxMirrorEvidence,
  BoxMirrorNoEvidenceLive,
  installSyncWriterFence,
  LegacySyncReadModel,
  LegacySyncReadModelLive,
  SyncWriterEpochState,
  VaultSyncMirrorRoot,
  VaultSyncOwnership,
  VaultSyncRoot,
  VaultSyncRootFromWorkspaceLive,
  VaultSyncWorkspaceRoots,
  writeSyncWriterEpoch,
} from "@beep/documents-server/aggregates/Sync";
import { DocumentsVaultSyncFixtureLive, VaultSyncMirrorRootLayer } from "@beep/documents-server/layer";
import { makeLayer as makePgliteLayer } from "@beep/pglite/PgliteClient.service";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));
const database = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteLayer({ extensions: { btree_gist } }))),
  Layer.provideMerge(BunServices.layer)
);
const hosting = Layer.mergeAll(
  Layer.succeed(VaultSyncOwnership, { orgOf: Effect.fn("test.ownership")(() => Effect.succeed(1)) }),
  Layer.succeed(VaultSyncMirrorRoot, { name: "beep-vault" }),
  Layer.succeed(VaultSyncWorkspaceRoots, {
    rootOf: Effect.fn("test.roots")((id: number) => Effect.succeed(id === 2 ? O.some("/synthetic") : O.none())),
  })
);

describe("vault sync hosting failure paths", () => {
  layer(database, { timeout: "2 minutes", excludeTestServices: true })("store", (it) => {
    it.effect("reports an unreadable read model as a typed read failure", () =>
      Effect.gen(function* () {
        const context = yield* Layer.build(LegacySyncReadModelLive);
        const reads = Context.get(context, LegacySyncReadModel);
        const failure = yield* Effect.flip(reads.items(WorkspaceIdentity.WorkspaceId.make(1)));
        expect(failure._tag).toBe("VaultSyncReadUnavailable");
      })
    );

    it.effect("resolves roots only for registered destinations with a configured vault", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TABLE IF NOT EXISTS alchemy_aggregate_instance (
          model text NOT NULL, aggregate text NOT NULL, id text NOT NULL, state jsonb)`;
        yield* sql`INSERT INTO alchemy_aggregate_instance VALUES
          ('VaultSync', 'SyncDestination', 'documents_sync_destination_aconfigured', '{"workspaceId": 2}'),
          ('VaultSync', 'SyncDestination', 'documents_sync_destination_aunconfigured', '{"workspaceId": 6}')`;
        const context = yield* Layer.build(VaultSyncRootFromWorkspaceLive.pipe(Layer.provide(hosting)));
        const roots = Context.get(context, VaultSyncRoot);
        const configured = yield* roots.resolve(V.DestinationId.make("documents_sync_destination_aconfigured"));
        expect(configured).toBe("/synthetic");
        const unconfigured = yield* Effect.flip(
          roots.resolve(V.DestinationId.make("documents_sync_destination_aunconfigured"))
        );
        expect(unconfigured).toMatchObject({ _tag: "BoxMirrorUnavailable", operation: "local-root" });
        const unknown = yield* Effect.flip(roots.resolve(V.DestinationId.make("documents_sync_destination_aunknown")));
        expect(unknown).toMatchObject({ _tag: "BoxMirrorUnavailable", operation: "local-root" });
        yield* sql`DROP TABLE alchemy_aggregate_instance`;
      })
    );

    it.effect("fails the Model layer with the typed refusal on a reversed store", () =>
      Effect.gen(function* () {
        const db = yield* makeDrizzle();
        yield* migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });
        const sql = yield* SqlClient.SqlClient;
        yield* sql.withTransaction(
          installSyncWriterFence.pipe(
            Effect.andThen(
              writeSyncWriterEpoch(SyncWriterEpochState.make({ epoch: "legacy", generation: 1, importId: "v1" }), 0)
            )
          )
        );
        const refused = yield* Layer.build(DocumentsVaultSyncFixtureLive.pipe(Layer.provide(hosting))).pipe(
          Effect.flip
        );
        expect(refused).toMatchObject({
          _tag: "SyncWriterEpochRejected",
          reason: "reversed-store-requires-fresh-import",
        });
      })
    );
  });

  layer(Layer.mergeAll(VaultSyncMirrorRootLayer, BoxMirrorNoEvidenceLive), { timeout: "30 seconds" })(
    "defaults",
    (it) => {
      it.effect("names the default mirror root and answers no evidence", () =>
        Effect.gen(function* () {
          const root = yield* VaultSyncMirrorRoot;
          expect(root.name).toBe("beep-vault");
          const evidence = yield* BoxMirrorEvidence;
          const found = yield* evidence.lookup({
            operationId: V.OperationId.make("documents_sync_operation_a1"),
            fingerprint: "f",
          });
          assertNone(found);
        })
      );
    }
  );
});

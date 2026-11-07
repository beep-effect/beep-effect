import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgres } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  BoxMirrorEvidence,
  BoxMirrorLive,
  DmsMirrorFixtureHandle,
  DmsMirrorFixtureLayer,
  VaultSyncCheckpoint,
  VaultSyncPassLive,
  VaultSyncRoot,
} from "@beep/documents-server/aggregates/Sync";
import * as U from "@beep/documents-use-cases/aggregates/VaultSync";
import { VaultSyncPass, VaultSyncPassModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";

class PassScenario extends Domain.Model("VaultSync", {
  aggregates: VaultSyncPassModel.aggregates,
  views: VaultSyncPassModel.views,
  policies: [
    U.ConflictRegistration,
    U.ConflictReviews,
    U.DestinationNames,
    U.DestinationRecovery,
    U.ItemHealing,
    U.ItemOperations,
    U.OperationDeadlines,
    U.OperationFailures,
  ],
  sagas: [VaultSyncPass],
}) {}
const infrastructure = Layer.mergeAll(PgliteTestLayer, BunServices.layer, DmsMirrorFixtureLayer);
describe("VaultSyncPass SQL durability", () => {
  layer(infrastructure, { timeout: "60 seconds", excludeTestServices: true, concurrent: false })("restart", (it) => {
    for (const phase of ["before-poll", "item-acknowledged"]) {
      it.effect(`resumes a fresh runtime after ${phase} without duplicate Box calls`, () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sql = yield* SqlClient.SqlClient;
          const beforeCounts = yield* (yield* DmsMirrorFixtureHandle).counts;
          const root = yield* fs.makeTempDirectoryScoped();
          yield* fs.makeDirectory(path.join(root, "folder"));
          yield* fs.writeFileString(path.join(root, "folder", "file.txt"), "synthetic fixture");
          const destinationId = V.DestinationId.make(`vault-${phase}`);
          const reached = yield* Ref.make(false);
          const rootLayer = Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture")(() => Effect.succeed(root)) });
          const adapters = BoxMirrorLive.pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture")(() => Effect.succeed(root)) }),
                Layer.succeed(BoxMirrorEvidence, { lookup: Effect.fn("fixture")(() => Effect.succeedNone) })
              )
            )
          );
          const runtime = Layer.fresh(
            PassScenario.layer(Layer.mergeAll(VaultSyncPolicies, VaultSyncPassLive)).pipe(
              Layer.provide(adapters),
              Layer.provide(rootLayer),
              Layer.provide(AlchemyPostgres.layer())
            )
          );
          const oldScope = yield* Scope.make();
          const old = yield* Layer.buildWithScope(
            runtime.pipe(
              Layer.provide(
                Layer.succeed(VaultSyncCheckpoint, (at) =>
                  at === phase ? Ref.set(reached, true).pipe(Effect.andThen(Effect.never)) : Effect.void
                )
              )
            ),
            oldScope
          );
          yield* Context.get(old, V.SyncDestination).send(
            destinationId,
            V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "synthetic" })
          );
          yield* Context.get(old, VaultSyncPass).start(phase, { destinationId });
          yield* Ref.get(reached).pipe(
            Effect.repeat({ until: (value) => value, schedule: Schedule.spaced("10 millis") }),
            Effect.timeout("20 seconds")
          );
          yield* Scope.close(oldScope, Exit.void);
          const fresh = yield* Layer.build(runtime);
          const result = yield* Context.get(fresh, VaultSyncPass).get(phase).result.pipe(Effect.timeout("20 seconds"));
          expect(result).toEqual({ operationsSucceeded: 2, conflicts: 0 });
          const counts = yield* (yield* DmsMirrorFixtureHandle).counts;
          // Each test has its own layer state.
          expect(counts.ensureFolder - beforeCounts.ensureFolder).toBe(1);
          expect(counts.uploadFile - beforeCounts.uploadFile).toBe(1);
          const state = yield* Context.get(fresh, V.SyncDestination).state(destinationId);
          expect(state._tag).toBe("Registered");
          if (state._tag !== "Registered") return;
          const fileId = yield* Effect.fromOption(H.get(state.paths, V.VaultRelPath.make("folder/file.txt")));
          const ackRows = yield* sql`SELECT seq FROM alchemy_aggregate_event
            WHERE model='VaultSync' AND aggregate='SyncItem' AND id=${fileId} AND tag='ItemPushed'`;
          expect(ackRows).toHaveLength(1);
          const again = yield* Context.get(fresh, VaultSyncPass).start(phase, { destinationId });
          const repeated = yield* again.result;
          expect(repeated).toEqual(result);
        })
      );
    }
  });
});

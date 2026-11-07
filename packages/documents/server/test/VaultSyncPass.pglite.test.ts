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
import { DmsRemoteEvent } from "@beep/documents-use-cases/aggregates/Sync/server";
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
import * as O from "effect/Option";
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
const infrastructure = Layer.mergeAll(PgliteTestLayer, BunServices.layer);
describe("VaultSyncPass SQL durability", () => {
  layer(infrastructure, { timeout: "60 seconds", excludeTestServices: true, concurrent: false })("restart", (it) => {
    for (const phase of ["before-poll", "item-acknowledged"]) {
      it.effect(`resumes a fresh runtime after ${phase} without duplicate Box calls`, () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sql = yield* SqlClient.SqlClient;
          const fixtures = yield* DmsMirrorFixtureLayer.pipe(Layer.fresh, Layer.build);
          const fixture = Context.get(fixtures, DmsMirrorFixtureHandle);
          const beforeCounts = yield* fixture.counts;
          const root = yield* fs.makeTempDirectoryScoped();
          yield* fs.makeDirectory(path.join(root, "folder"));
          yield* fs.writeFileString(path.join(root, "a.txt"), "synthetic root file");
          yield* fs.writeFileString(path.join(root, "folder", "file.txt"), "synthetic fixture");
          const destinationId = V.DestinationId.make(`vault-${phase}`);
          const reached = yield* Ref.make(false);
          const rootLayer = Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture")(() => Effect.succeed(root)) });
          const adapters = BoxMirrorLive.pipe(
            Layer.provide(Layer.succeedContext(fixtures)),
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
          // A pre-existing cursor exercises echoes and drift; an unbootstrapped Box poll starts at now.
          yield* Context.get(old, V.SyncDestination).send(
            destinationId,
            V.RecordDestinationPoll.make({ position: "0", error: null })
          );
          yield* Context.get(old, VaultSyncPass).start(phase, { destinationId });
          yield* Ref.get(reached).pipe(
            Effect.repeat({ until: (value) => value, schedule: Schedule.spaced("10 millis") }),
            Effect.timeout("20 seconds")
          );
          if (phase === "before-poll") {
            const destination = yield* Context.get(old, V.SyncDestination).state(destinationId);
            if (destination._tag !== "Registered") return;
            const file = yield* Effect.fromOption(H.get(destination.paths, V.VaultRelPath.make("folder/file.txt")));
            const folder = yield* Effect.fromOption(H.get(destination.paths, V.VaultRelPath.make("folder")));
            const item = yield* Context.get(old, V.SyncItem).state(file);
            const parent = yield* Context.get(old, V.SyncItem).state(folder);
            const remoteId = yield* Effect.fromOption(O.fromNullishOr(item?.remoteId));
            const parentRemoteId = yield* Effect.fromOption(O.fromNullishOr(parent?.remoteId));
            yield* fixture.injectRemoteEvent(
              DmsRemoteEvent.make({
                eventId: "duplicate-created",
                eventType: "created",
                remoteId: O.some(remoteId),
                name: O.some("file.txt"),
                parentRemoteId: O.some(parentRemoteId),
                payload: { synthetic: true },
              })
            );
            yield* fixture.injectRemoteEvent(
              DmsRemoteEvent.make({
                eventId: "unexplained-edit",
                eventType: "edited",
                remoteId: O.some(remoteId),
                name: O.some("file.txt"),
                parentRemoteId: O.some(parentRemoteId),
                payload: { synthetic: true },
              })
            );
            yield* fixture.injectRemoteEvent(
              DmsRemoteEvent.make({
                eventId: "unknown-outside",
                eventType: "created",
                remoteId: O.some(V.RemoteItemId.make("outside")),
                parentRemoteId: O.some(V.RemoteItemId.make("foreign-root")),
                payload: { synthetic: true },
              })
            );
            yield* fixture.injectRemoteEvent(
              DmsRemoteEvent.make({
                eventId: "unknown-inside",
                eventType: "created",
                remoteId: O.some(V.RemoteItemId.make("inside")),
                parentRemoteId: O.some(V.RemoteItemId.make("fx-root")),
                payload: { synthetic: true },
              })
            );
          }
          yield* Scope.close(oldScope, Exit.void);
          const fresh = yield* Layer.build(runtime);
          const result = yield* Context.get(fresh, VaultSyncPass).get(phase).result.pipe(Effect.timeout("20 seconds"));
          expect(result).toEqual({ operationsSucceeded: 3, conflicts: phase === "before-poll" ? 2 : 0 });
          const counts = yield* fixture.counts;
          // Measure this run against the suite fixture counts captured before starting.
          expect(counts.ensureFolder - beforeCounts.ensureFolder).toBe(1);
          expect(counts.uploadFile - beforeCounts.uploadFile).toBe(2);
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

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
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
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
import * as Str from "effect/String";
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
// The driver's default 30-second lease on purpose: the old runtime frees the deliveries it claimed as it closes, so
// the fresh one resumes them at once. Holding them to the lease would push a restart past the per-test budget.
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
          const destinationId = V.DestinationId.make(`documents_sync_destination_a${Str.replaceAll("-", "")(phase)}`);
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
              Layer.provide(SecureRandom.layerWebCrypto),
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
            const destination = yield* Context.get(old, V.SyncDestination).get(destinationId);
            if (destination._tag !== "Registered") return;
            const file = yield* Effect.fromOption(H.get(destination.paths, V.VaultRelPath.make("folder/file.txt")));
            const folder = yield* Effect.fromOption(H.get(destination.paths, V.VaultRelPath.make("folder")));
            const item = yield* Context.get(old, V.SyncItem).get(file);
            const parent = yield* Context.get(old, V.SyncItem).get(folder);
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
          const state = yield* Context.get(fresh, V.SyncDestination).get(destinationId);
          expect(state._tag).toBe("Registered");
          if (state._tag !== "Registered") return;
          const fileId = yield* Effect.fromOption(H.get(state.paths, V.VaultRelPath.make("folder/file.txt")));
          const ackRows = yield* sql`SELECT seq FROM alchemy_aggregate_event
            WHERE model='VaultSync' AND aggregate='SyncItem' AND id=${fileId} AND tag='ItemPushed'`;
          expect(ackRows).toHaveLength(1);
          // D17 F1: command ids carry opaque ids only, never a vault path.
          const commandIds = yield* sql<{ readonly command_id: string }>`SELECT command_id
            FROM alchemy_aggregate_event WHERE model='VaultSync' AND command_id LIKE ${`${phase}/%`}`;
          expect(commandIds.length).toBeGreaterThan(0);
          const leaked = A.filter(commandIds, (row) =>
            A.some(["file.txt", "a.txt", "folder"], (part) => Str.includes(part)(row.command_id))
          );
          expect(leaked).toEqual([]);
          const again = yield* Context.get(fresh, VaultSyncPass).start(phase, { destinationId });
          const repeated = yield* again.result;
          expect(repeated).toEqual(result);
        })
      );
    }
    it.effect("records push and poll failures, and skips a paused destination without Box calls", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixtures = yield* DmsMirrorFixtureLayer.pipe(Layer.fresh, Layer.build);
        const fixture = Context.get(fixtures, DmsMirrorFixtureHandle);
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.writeFileString(path.join(root, "a.txt"), "synthetic failing file");
        const rootLayer = Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture")(() => Effect.succeed(root)) });
        const adapters = BoxMirrorLive.pipe(
          Layer.provide(Layer.succeedContext(fixtures)),
          Layer.provide(
            Layer.mergeAll(
              rootLayer,
              Layer.succeed(BoxMirrorEvidence, { lookup: Effect.fn("fixture")(() => Effect.succeedNone) })
            )
          )
        );
        const runtime = yield* PassScenario.layer(Layer.mergeAll(VaultSyncPolicies, VaultSyncPassLive)).pipe(
          Layer.provide(adapters),
          Layer.provide(rootLayer),
          Layer.provide(SecureRandom.layerWebCrypto),
          Layer.provide(AlchemyPostgres.layer()),
          Layer.fresh,
          Layer.build
        );
        const destinations = Context.get(runtime, V.SyncDestination);
        const failing = V.DestinationId.make("documents_sync_destination_afailing");
        yield* destinations.send(failing, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "failing" }));
        yield* fixture.failNext("uploadFile", false);
        yield* fixture.failNext("pollEvents", true);
        const failed = yield* Context.get(runtime, VaultSyncPass).start("failing-pass", { destinationId: failing });
        const failedResult = yield* failed.result.pipe(Effect.timeout("20 seconds"));
        expect(failedResult).toEqual({ operationsSucceeded: 0, conflicts: 0 });
        const state = yield* destinations.get(failing);
        expect(state._tag === "Registered" ? state.cursorError : null).not.toBeNull();
        const paused = V.DestinationId.make("documents_sync_destination_apaused");
        yield* destinations.send(paused, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "paused" }));
        yield* destinations.send(paused, V.PauseDestination.make({}));
        const before = yield* fixture.counts;
        const skipped = yield* Context.get(runtime, VaultSyncPass).start("paused-pass", { destinationId: paused });
        const skippedResult = yield* skipped.result.pipe(Effect.timeout("20 seconds"));
        expect(skippedResult).toEqual({ operationsSucceeded: 0, conflicts: 0 });
        const after = yield* fixture.counts;
        expect(after).toEqual(before);
        // A probe-only pass refreshes availability and runs no mirror verb.
        const probing = yield* Context.get(runtime, VaultSyncPass).start("probe-pass", {
          destinationId: failing,
          probeOnly: true,
        });
        const probed = yield* probing.result.pipe(Effect.timeout("20 seconds"));
        expect(probed).toEqual({ operationsSucceeded: 0, conflicts: 0 });
        const afterProbe = yield* fixture.counts;
        expect(afterProbe).toEqual(after);
      })
    );
  });
});

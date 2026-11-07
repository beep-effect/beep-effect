import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgres } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  BoxMirrorEvidence,
  BoxMirrorLive,
  DmsMirrorFixtureLayer,
  VaultSyncCheckpoint,
  VaultSyncPassLive,
  VaultSyncRoot,
} from "@beep/documents-server/aggregates/Sync";
import { DmsMirror, DmsMirrorAvailability, DmsRemoteItem } from "@beep/documents-use-cases/aggregates/Sync/server";
import * as U from "@beep/documents-use-cases/aggregates/VaultSync";
import { makeLayer } from "@beep/pglite";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

class CrashModel extends Domain.Model("VaultSyncCrash", {
  aggregates: U.VaultSyncModel.aggregates,
  views: U.VaultSyncModel.views,
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
  sagas: [U.VaultSyncPass],
}) {}
const decodeArgs = S.decodeUnknownEffect(S.Tuple([S.String, S.String, S.String, S.Literals(["crash", "resume"])]));
const main = Effect.gen(function* () {
  const [_dataDir, root, ledger, mode] = yield* decodeArgs(process.argv.slice(2));
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const fixture = yield* Layer.build(DmsMirrorFixtureLayer);
  const mirror = Context.get(fixture, DmsMirror);
  const count = Effect.fn("test.remoteCall")(function* (name: string) {
    const previous = yield* fs.readFileString(ledger);
    yield* fs.writeFileString(ledger, `${previous}${name}\n`);
  });
  const persistent = Layer.succeed(DmsMirror, {
    ...mirror,
    uploadFile: Effect.fn("test.uploadFile")(function* (input) {
      yield* count(input.name).pipe(Effect.orDie);
      return DmsRemoteItem.make({
        itemKind: "file",
        name: input.name,
        parentRemoteId: input.parentRemoteId,
        remoteId: V.RemoteItemId.make(`synthetic-${input.name}`),
      });
    }),
  });
  const roots = Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("test.root")(() => Effect.succeed(root)) });
  const evidence = Layer.succeed(BoxMirrorEvidence, { lookup: Effect.fn("test.evidence")(() => Effect.succeedNone) });
  const adapter = BoxMirrorLive.pipe(
    Layer.provide([
      persistent,
      Layer.succeed(DmsMirrorAvailability, Context.get(fixture, DmsMirrorAvailability)),
      roots,
      evidence,
    ])
  );
  const runtime = CrashModel.layer(Layer.mergeAll(U.VaultSyncPolicies, VaultSyncPassLive)).pipe(
    Layer.provide(adapter),
    Layer.provide(roots),
    Layer.provide(AlchemyPostgres.layer()),
    Layer.provide(
      Layer.succeed(
        VaultSyncCheckpoint,
        Effect.fn("test.checkpoint")(function* (phase) {
          if (mode !== "crash" || phase !== "item-acknowledged") return;
          yield* sql`CHECKPOINT`.pipe(Effect.orDie);
          yield* Effect.log("READY-TO-KILL");
          return yield* Effect.never;
        })
      )
    )
  );
  const program = Effect.gen(function* () {
    const hosted = yield* Layer.build(runtime);
    const destinationId = V.DestinationId.make("documents_sync_destination_asyntheticcrash");
    yield* Context.get(hosted, V.SyncDestination).send(
      destinationId,
      V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "synthetic" }),
      { commandId: "register" }
    );
    const pass = yield* Context.get(hosted, U.VaultSyncPass).start("synthetic-crash-pass", { destinationId });
    const result = yield* pass.result;
    yield* Effect.log(`COMPLETED:${result.operationsSucceeded}`);
  });
  yield* program;
}).pipe(Effect.scoped);
BunRuntime.runMain(
  Effect.provide(main, [
    BunServices.layer,
    Layer.unwrap(Effect.map(S.decodeUnknownEffect(S.String)(process.argv[2]), (dataDir) => makeLayer({ dataDir }))),
  ])
);

import { $RepoCliId } from "@beep/identity/packages";
import { PacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas";
import { applyPacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation";
import {
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketForkRepairApplier,
  PacketForkRepairApplierLive,
  PacketStreamLocator,
  packetEventDigest,
  packetEventFileName,
  renderPacketEventFile,
} from "@beep/repo-cli/test/Goals";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { BunRuntime } from "@effect/platform-bun";
import { NodeServices } from "@effect/platform-node";
import { Console, Context, Duration, Effect, FileSystem, Layer, Path, Schedule } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("test/fixtures/packet-core/concurrent-writer");
const PausePoint = LiteralKit([
  "none",
  "afterRead",
  "beforePublish",
  "afterPublish",
  "beforeGenesisPublish",
  "afterGenesisPublish",
  "afterForkBackup",
]).annotate(
  $I.annote("PausePoint", {
    description: "Real filesystem boundary at which a packet writer waits for its test parent.",
  })
);
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.String, S.fromJsonString(PacketEvent), PausePoint]));

const main = Effect.gen(function* () {
  const [packetPath, event, pausePoint] = yield* decodeArguments(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const eventsPath = path.join(packetPath, "ops", "events");
  const releasePath = path.join(packetPath, "release-writer");
  const pause = Effect.fn("PacketWriterFixture.pause")(function* () {
    yield* Console.log("PAUSED");
    yield* fs
      .exists(releasePath)
      .pipe(Effect.repeat({ while: Bool.not, schedule: Schedule.spaced(Duration.millis(10)) }));
  });
  const pausedFs = FileSystem.FileSystem.of({
    ...fs,
    readDirectory: Effect.fn("PacketWriterFixture.readDirectory")(function* (directory, options) {
      const entries = yield* fs.readDirectory(directory, options);
      if (PausePoint.is.afterRead(pausePoint) && Eq.equals(directory, eventsPath)) {
        yield* pause();
      }
      return entries;
    }),
    rename: Effect.fn("PacketWriterFixture.rename")(function* (source, target) {
      const publishesEvent = Str.endsWith(".json")(target);
      if (publishesEvent && PausePoint.is.beforePublish(pausePoint)) {
        yield* pause();
      }
      if (Eq.equals(target, eventsPath) && PausePoint.is.beforeGenesisPublish(pausePoint)) yield* pause();
      yield* fs.rename(source, target);
      if (Eq.equals(source, eventsPath) && PausePoint.is.afterForkBackup(pausePoint)) yield* pause();
      if (Eq.equals(target, eventsPath) && PausePoint.is.afterGenesisPublish(pausePoint)) yield* pause();
      if (publishesEvent && PausePoint.is.afterPublish(pausePoint)) {
        yield* pause();
      }
    }),
  });

  if (PausePoint.is.afterForkBackup(pausePoint)) {
    const applier = Context.get(
      yield* Layer.build(PacketForkRepairApplierLive.pipe(Layer.provide(PacketEventStoreLive))).pipe(
        Effect.provideService(FileSystem.FileSystem, pausedFs)
      ),
      PacketForkRepairApplier
    );
    yield* applier.apply(PacketStreamLocator.make({ packet: event.packet, root: event.root, packetPath }));
    yield* Console.log("COMMITTED");
    return;
  }

  if (PausePoint.is.beforeGenesisPublish(pausePoint) || PausePoint.is.afterGenesisPublish(pausePoint)) {
    yield* applyPacketGenesisSeed(
      PacketGenesisSeed.make({
        slug: event.packet,
        eventsDirectory: eventsPath,
        eventFileName: packetEventFileName(event, yield* packetEventDigest(event)),
        eventText: yield* renderPacketEventFile(event),
        tracePath: path.join(packetPath, "ops", "trace.json"),
        traceText: "{}\n",
      })
    ).pipe(Effect.provideService(FileSystem.FileSystem, pausedFs));
    yield* Console.log("COMMITTED");
    return;
  }

  const store = Context.get(
    yield* Layer.build(PacketEventStoreLive).pipe(Effect.provideService(FileSystem.FileSystem, pausedFs)),
    PacketEventStore
  );
  yield* Effect.gen(function* () {
    const locator = PacketStreamLocator.make({ packet: event.packet, root: event.root, packetPath });
    yield* store.append(locator, event);
    yield* Console.log("COMMITTED");
  }).pipe(
    Effect.catchTags({
      PacketCasConflictError: () => Console.log("CONFLICT"),
      PacketStreamError: (error) => Console.log(`REFUSED: ${error.message}`),
    })
  );
});

const program = Effect.scoped(
  Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => main.pipe(Effect.provide(context))))
);
BunRuntime.runMain(program);

import { $RepoCliId } from "@beep/identity/packages";
import { PacketEvent, PacketEventStore, PacketEventStoreLive, PacketStreamLocator } from "@beep/repo-cli/test/Goals";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { BunRuntime } from "@effect/platform-bun";
import { NodeServices } from "@effect/platform-node";
import { Console, Duration, Effect, FileSystem, Path, Schedule } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("test/fixtures/packet-core/concurrent-writer");
const PausePoint = LiteralKit(["none", "afterRead", "beforePublish", "afterPublish"]).annotate(
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
      yield* fs.rename(source, target);
      if (publishesEvent && PausePoint.is.afterPublish(pausePoint)) {
        yield* pause();
      }
    }),
  });

  yield* Effect.gen(function* () {
    const store = yield* PacketEventStore;
    const locator = PacketStreamLocator.make({ packet: event.packet, root: event.root, packetPath });
    yield* store.append(locator, event);
    yield* Console.log("COMMITTED");
  }).pipe(
    Effect.catchTag("PacketCasConflictError", () => Console.log("CONFLICT")),
    Effect.catchTag("PacketStreamError", (error) => Console.log(`REFUSED: ${error.message}`)),
    Effect.provide(PacketEventStoreLive),
    Effect.provideService(FileSystem.FileSystem, pausedFs)
  );
}).pipe(Effect.provide(NodeServices.layer));

BunRuntime.runMain(main);

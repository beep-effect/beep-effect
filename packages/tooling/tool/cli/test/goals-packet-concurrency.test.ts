import {
  foldPacketEvents,
  PacketCasConflictError,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketStreamError,
  PacketStreamLocator,
  withPacketEventLock,
} from "@beep/repo-cli/test/Goals";
import { QualitySchedulerError, withJournalFileLock } from "@beep/repo-cli/test/RepoRun";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const testLayer = PacketEventStoreLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));
const writerUrl = new URL("./fixtures/packet-core/concurrent-writer.ts", import.meta.url);
const encodeEvent = S.encodeEffect(S.fromJsonString(PacketEvent));
const isPacketCasConflictError = S.is(PacketCasConflictError);

const genesis = (actor: string) =>
  PacketEvent.make({
    schemaVersion: "packet-event/v1",
    packet: "concurrent",
    root: "goals",
    seq: 1,
    expectedRevision: 0,
    at: "2026-09-14T00:00:00.000Z",
    actor,
    body: { type: "packet-created", stage: "capture", ordinal: 0, status: "active" },
  });

const makePacket = Effect.fn("PacketConcurrencyTest.makePacket")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packetPath = yield* fs.makeTempDirectoryScoped({ prefix: "packet-concurrency-" });
  yield* fs.makeDirectory(path.join(packetPath, "ops", "events"), { recursive: true });
  return PacketStreamLocator.make({ packet: "concurrent", root: "goals", packetPath });
});

const startWriter = Effect.fn("PacketConcurrencyTest.startWriter")(function* (
  locator: PacketStreamLocator,
  actor: string,
  pausePoint = "none"
) {
  const path = yield* Path.Path;
  const writerPath = yield* path.fromFileUrl(writerUrl);
  return yield* ChildProcess.make(
    "bun",
    [
      writerPath,
      locator.packetPath,
      yield* encodeEvent(PacketEvent.make({ ...genesis(actor), packet: locator.packet })),
      pausePoint,
    ],
    {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "inherit",
      extendEnv: true,
    }
  );
});

const assertStream = Effect.fn("PacketConcurrencyTest.assertStream")(function* (
  locator: PacketStreamLocator,
  revision: number
) {
  const store = yield* PacketEventStore;
  const listing = yield* store.list(locator);
  const state = foldPacketEvents({ packet: locator.packet, root: locator.root, events: listing.events });
  expect(listing.issues).toEqual([]);
  expect(A.length(listing.events)).toBe(revision);
  expect(state.revision).toBe(revision);
  expect(state.forks).toEqual([]);
});

// Real child-process death and lock retry delays must use the same wall clock.
layer(testLayer, { excludeTestServices: true, timeout: "30 seconds" })(
  "packet event publication across processes",
  (it) => {
    it.effect(
      "preserves caller-specific failures and releases the packet lock",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const failure = PacketStreamError.new(locator.packet, "caller refused publication");
        const result = yield* withPacketEventLock(locator, () => Effect.fail(failure)).pipe(Effect.flip);
        expect(result).toBe(failure);
        expect(yield* fs.exists(path.join(locator.packetPath, "ops", ".packet-events.lock"))).toBe(false);
      })
    );

    it.effect(
      "preserves scheduler-shaped callback failures without replaying them",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const failure = QualitySchedulerError.make({ reason: "journal-lock-lost", message: "caller-owned failure" });
        let calls = 0;
        const operation = Effect.sync(() => {
          calls++;
        }).pipe(Effect.andThen(Effect.fail(failure)));
        expect(
          yield* withJournalFileLock(path.join(locator.packetPath, "callback.lock"), () => operation).pipe(Effect.flip)
        ).toBe(failure);
        expect(yield* withPacketEventLock(locator, () => operation).pipe(Effect.flip)).toBe(failure);
        expect(calls).toBe(2);
      })
    );

    it.effect(
      "reacquires after its own fence confirms generation loss",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        let calls = 0;
        const result = yield* withPacketEventLock(locator, (assertOwned) =>
          Effect.gen(function* () {
            calls++;
            if (calls === 1) yield* fs.remove(path.join(locator.packetPath, "ops", ".packet-events.lock"));
            yield* assertOwned;
            return "owned";
          })
        );
        expect(result).toBe("owned");
        expect(calls).toBe(2);
      })
    );

    it.effect(
      "releases a newly acquired journal lock when its operation is interrupted",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const lockPath = path.join(locator.packetPath, "interrupted.lock");
        const entered = yield* Deferred.make<void>();
        const writer = yield* withJournalFileLock(lockPath, () =>
          Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
        ).pipe(Effect.forkChild);
        yield* Deferred.await(entered);
        expect(yield* fs.exists(lockPath)).toBe(true);
        yield* Fiber.interrupt(writer);
        expect(yield* fs.exists(lockPath)).toBe(false);
        expect(yield* withJournalFileLock(lockPath, () => Effect.succeed("reacquired"))).toBe("reacquired");
      })
    );

    it.effect(
      "keeps an empty repair residue separate from a missing opted-in stream",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const store = yield* PacketEventStore;
        const eventsDirectory = path.join(locator.packetPath, "ops", "events");
        const residue = path.join(locator.packetPath, ".tmp-packet-repair-empty");
        yield* fs.remove(eventsDirectory, { recursive: true });
        yield* fs.makeDirectory(residue);
        yield* fs.writeFileString(path.join(residue, "receipt.txt"), "preserved repair receipt");
        expect(yield* withPacketEventLock(locator, () => Effect.succeed("inspected"))).toBe("inspected");
        const failure = yield* store.append(locator, genesis("missing-stream")).pipe(Effect.flip);
        expect(failure.message).toContain("does not exist");
        expect(failure.message).not.toContain("Interrupted fork replacement");
        expect(yield* fs.exists(eventsDirectory)).toBe(false);
        expect(yield* fs.readFileString(path.join(residue, "receipt.txt"))).toBe("preserved repair receipt");
      })
    );

    it.effect(
      "refuses an unreadable recovery inventory before invoking a mutation",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const unreadableFs = FileSystem.FileSystem.of({
          ...fs,
          readDirectory: Effect.fn("PacketConcurrencyTest.refuseRecoveryInventory")((directory, options) =>
            directory === locator.packetPath
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "PermissionDenied",
                    module: "FileSystem",
                    method: "readDirectory",
                    pathOrDescriptor: directory,
                    description: "injected recovery inventory failure",
                  })
                )
              : fs.readDirectory(directory, options)
          ),
        });
        const failure = yield* withPacketEventLock(locator, () => Effect.die("mutation must not run")).pipe(
          Effect.provideService(FileSystem.FileSystem, unreadableFs),
          Effect.flip
        );
        expect(failure.message).toContain("event-stream recovery inspection failed");
        expect(yield* fs.exists(path.join(locator.packetPath, "ops", ".packet-events.lock"))).toBe(false);
        yield* assertStream(locator, 0);
      })
    );

    it.effect(
      "keeps discovery best effort while refusing a mutation after a failed operations probe",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const unreadablePaths = [path.join(locator.packetPath, "ops"), path.join(locator.packetPath, "ops", "events")];
        const unreadableFs = FileSystem.FileSystem.of({
          ...fs,
          exists: Effect.fn("PacketConcurrencyTest.refuseStreamProbe")((target) =>
            A.contains(unreadablePaths, target)
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "PermissionDenied",
                    module: "FileSystem",
                    method: "exists",
                    pathOrDescriptor: target,
                    description: "injected stream probe failure",
                  })
                )
              : fs.exists(target)
          ),
        });
        const isolated = Context.get(
          yield* PacketEventStoreLive.pipe(
            Layer.fresh,
            Layer.build,
            Effect.provideService(FileSystem.FileSystem, unreadableFs)
          ),
          PacketEventStore
        );
        expect(yield* isolated.hasStream(locator.packetPath)).toBe(false);
        const failure = yield* isolated.append(locator, genesis("unreadable-ops")).pipe(Effect.flip);
        expect(failure.message).toContain("injected stream probe failure");
        yield* assertStream(locator, 0);
      })
    );

    it.effect(
      "refuses an unreadable directory instead of appending a second genesis",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const store = yield* PacketEventStore;
        yield* store.append(locator, genesis("original"));
        const eventsDirectory = path.join(locator.packetPath, "ops", "events");
        const unreadableFs = FileSystem.FileSystem.of({
          ...fs,
          readDirectory: Effect.fn("PacketConcurrencyTest.readDirectory")((directory, options) =>
            directory === eventsDirectory
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "PermissionDenied",
                    module: "FileSystem",
                    method: "readDirectory",
                    pathOrDescriptor: directory,
                    description: "injected directory read failure",
                  })
                )
              : fs.readDirectory(directory, options)
          ),
        });
        const isolated = Context.get(
          yield* PacketEventStoreLive.pipe(
            Layer.fresh,
            Layer.build,
            Effect.provideService(FileSystem.FileSystem, unreadableFs)
          ),
          PacketEventStore
        );
        const failure = yield* isolated.append(locator, genesis("refused")).pipe(Effect.flip);
        expect(failure.message).toContain("stream could not be read before append");
        yield* assertStream(locator, 1);
      })
    );

    it.effect(
      "commits one of two concurrent appends and returns a typed refusal to the loser",
      Effect.fnUntraced(function* () {
        const locator = yield* makePacket();
        const store = yield* PacketEventStore;
        const outcomes = yield* Effect.all(
          [
            store.append(locator, genesis("first")).pipe(Effect.result),
            store.append(locator, genesis("second")).pipe(Effect.result),
          ],
          { concurrency: 2 }
        );
        expect(A.length(A.filter(outcomes, Result.isSuccess))).toBe(1);
        const failures = A.getFailures(outcomes);
        expect(A.length(failures)).toBe(1);
        const loser = O.getOrThrow(A.head(failures));
        if (isPacketCasConflictError(loser)) {
          expect(loser).toMatchObject({ expectedRevision: 0, actualRevision: 1 });
        } else {
          expect(loser.message).toContain("another active writer");
        }
        yield* assertStream(locator, 1);
      })
    );

    it.effect(
      "refuses a second process while the first owns the read-and-publish boundary",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const first = yield* startWriter(locator, "first", "afterRead");
        assertSome(yield* first.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead), "PAUSED");
        const second = yield* startWriter(locator, "second");
        const output = yield* second.stdout.pipe(Stream.decodeText(), Stream.mkString);
        expect(yield* second.exitCode).toBe(0);
        expect(output).toContain("REFUSED:");
        expect(output).toContain("another active writer");
        yield* assertStream(locator, 0);
        yield* fs.writeFileString(path.join(locator.packetPath, "release-writer"), "release");
        expect(yield* first.exitCode).toBe(0);
        yield* assertStream(locator, 1);
      }),
      20_000
    );

    it.effect(
      "recovers a killed writer before publication without exposing staged JSON",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const store = yield* PacketEventStore;
        const locator = yield* makePacket();
        const child = yield* startWriter(locator, "killed", "beforePublish");
        assertSome(yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead), "PAUSED");
        yield* assertStream(locator, 0);
        yield* child.kill({ killSignal: "SIGKILL" });
        yield* child.exitCode.pipe(Effect.result);
        expect(yield* fs.exists(path.join(locator.packetPath, "ops", ".packet-events.lock"))).toBe(true);
        yield* store.append(locator, genesis("recovered"));
        yield* assertStream(locator, 1);
        expect(yield* fs.exists(path.join(locator.packetPath, "ops", ".packet-events.lock"))).toBe(false);
      }),
      20_000
    );

    it.effect(
      "preserves an event published before its writer dies and refuses to replay revision zero",
      Effect.fnUntraced(function* () {
        const store = yield* PacketEventStore;
        const locator = yield* makePacket();
        const child = yield* startWriter(locator, "published", "afterPublish");
        assertSome(yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead), "PAUSED");
        yield* assertStream(locator, 1);
        yield* child.kill({ killSignal: "SIGKILL" });
        yield* child.exitCode.pipe(Effect.result);
        const failure = yield* store.append(locator, genesis("published")).pipe(Effect.flip);
        failure.pipe(isPacketCasConflictError, assertTrue);
        expect(failure).toMatchObject({ expectedRevision: 0, actualRevision: 1 });
        yield* assertStream(locator, 1);
      }),
      20_000
    );
  }
);

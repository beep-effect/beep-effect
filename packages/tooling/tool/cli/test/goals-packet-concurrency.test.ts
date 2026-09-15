import { PacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas";
import {
  applyPacketGenesisSeed,
  quarantineOwnedGenesisEvents,
} from "@beep/repo-cli/commands/Goals/Migration/PacketMutation";
import {
  foldPacketEvents,
  PacketCasConflictError,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketForkRepairApplier,
  PacketForkRepairApplierLive,
  PacketStreamError,
  PacketStreamLocator,
  packetEventDigest,
  packetEventFileName,
  renderPacketEventFile,
  withPacketEventLock,
} from "@beep/repo-cli/test/Goals";
import { QualitySchedulerError, withJournalFileLock } from "@beep/repo-cli/test/RepoRun";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Context, Deferred, Effect, Fiber, FileSystem, Layer, Path, PlatformError, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";

const testLayer = PacketForkRepairApplierLive.pipe(
  Layer.provideMerge(PacketEventStoreLive),
  Layer.provideMerge(NodeServices.layer)
);
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
      "refuses fork repair while an append owns the packet lock",
      Effect.fnUntraced(function* () {
        const locator = yield* makePacket();
        const applier = yield* PacketForkRepairApplier;
        const failure = yield* withPacketEventLock(locator, () => applier.apply(locator).pipe(Effect.flip));
        expect(failure.message).toContain("another active writer");
        yield* assertStream(locator, 0);
      })
    );

    it.effect(
      "restores fork-repair bytes when interrupted between directory renames",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const packet = yield* makePacket();
        const locator = PacketStreamLocator.make({ ...packet, packet: "forked" });
        const source = yield* path.fromFileUrl(new URL("./fixtures/packet-core/forked", import.meta.url));
        yield* fs.copy(source, locator.packetPath, { overwrite: true });
        const store = yield* PacketEventStore;
        const original = yield* store.list(locator);
        const eventsDirectory = path.join(locator.packetPath, "ops", "events");
        const moved = yield* Deferred.make<void>();
        const pausingFs = FileSystem.FileSystem.of({
          ...fs,
          rename: Effect.fn("PacketConcurrencyTest.pauseRepairRename")(function* (from, to) {
            yield* fs.rename(from, to);
            if (from === eventsDirectory) {
              yield* Deferred.succeed(moved, undefined);
              return yield* Effect.never;
            }
          }),
        });
        const applier = Context.get(
          yield* Layer.build(Layer.fresh(PacketForkRepairApplierLive)).pipe(
            Effect.provideService(FileSystem.FileSystem, pausingFs)
          ),
          PacketForkRepairApplier
        );
        const repairing = yield* applier.apply(locator).pipe(Effect.forkChild);
        yield* Deferred.await(moved);
        expect(yield* fs.exists(eventsDirectory)).toBe(false);
        const refused = yield* store.append(locator, genesis("contender")).pipe(Effect.flip);
        expect(refused.message).toContain("another active writer");
        yield* Fiber.interrupt(repairing);
        expect(yield* store.list(locator)).toEqual(original);
        expect(yield* fs.exists(path.join(locator.packetPath, "ops", ".packet-events.lock"))).toBe(false);
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
          yield* Layer.build(Layer.fresh(PacketEventStoreLive)).pipe(
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
      "serializes genesis seeding and quarantine with a separate append process",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const writer = yield* startWriter(locator, "holding", "afterRead");
        assertSome(yield* writer.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead), "PAUSED");
        const seed = PacketGenesisSeed.make({
          slug: locator.packet,
          eventsDirectory: path.join(locator.packetPath, "ops", "events"),
          eventFileName: "00001-packet-created-deadbeef.json",
          eventText: "{}\n",
          tracePath: path.join(locator.packetPath, "ops", "trace.json"),
          traceText: "{}\n",
        });
        expect((yield* applyPacketGenesisSeed(seed).pipe(Effect.flip)).message).toContain("another active writer");
        expect((yield* quarantineOwnedGenesisEvents(seed, "seed rollback").pipe(Effect.flip)).message).toContain(
          "another active writer"
        );
        yield* assertStream(locator, 0);
        yield* fs.writeFileString(path.join(locator.packetPath, "release-writer"), "release");
        expect(yield* writer.exitCode).toBe(0);
        yield* assertStream(locator, 1);
      }),
      20_000
    );

    it.effect(
      "preserves the backup and refuses mutation after SIGKILL between fork-repair renames",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const store = yield* PacketEventStore;
        const applier = yield* PacketForkRepairApplier;
        const packet = yield* makePacket();
        const locator = PacketStreamLocator.make({ ...packet, packet: "forked" });
        const source = yield* path.fromFileUrl(new URL("./fixtures/packet-core/forked", import.meta.url));
        yield* fs.copy(source, locator.packetPath, { overwrite: true });
        const original = yield* store.list(locator);
        const child = yield* startWriter(locator, "repair", "afterForkBackup");
        const paused = yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead);
        assertSome(paused, "PAUSED");
        const eventsDirectory = path.join(locator.packetPath, "ops", "events");
        expect(yield* fs.exists(eventsDirectory)).toBe(false);
        yield* child.kill({ killSignal: "SIGKILL" });
        yield* child.exitCode.pipe(Effect.result);
        expect((yield* applier.apply(locator).pipe(Effect.flip)).message).toContain("Interrupted fork replacement");
        expect((yield* store.append(locator, genesis("refused")).pipe(Effect.flip)).message).toContain(
          "Interrupted fork replacement"
        );
        const recoveryDirectories = A.filter(
          yield* fs.readDirectory(locator.packetPath),
          Str.startsWith(".tmp-packet-repair-")
        );
        expect(recoveryDirectories).toHaveLength(1);
        for (const directory of recoveryDirectories) {
          const recovery = PacketStreamLocator.make({
            ...locator,
            packetPath: path.join(locator.packetPath, directory),
          });
          expect(yield* store.list(recovery)).toEqual(original);
        }
        expect(yield* fs.exists(eventsDirectory)).toBe(false);
      }),
      20_000
    );

    it.effect(
      "refuses append and genesis when a killed fork replacement left recovery bytes",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const store = yield* PacketEventStore;
        const locator = yield* makePacket();
        yield* store.append(locator, genesis("original"));
        const original = yield* store.list(locator);
        const recoveryRoot = yield* fs.makeTempDirectory({
          directory: locator.packetPath,
          prefix: ".tmp-packet-repair-",
        });
        const eventsDirectory = path.join(locator.packetPath, "ops", "events");
        const backupDirectory = path.join(recoveryRoot, "ops", "events");
        yield* fs.makeDirectory(path.dirname(backupDirectory), { recursive: true });
        // Reproduce the durable state after events-to-backup rename and hard
        // process death, when no Effect finalizer can restore the directory.
        yield* fs.rename(eventsDirectory, backupDirectory);
        const event = genesis("replacement");
        const seed = PacketGenesisSeed.make({
          slug: locator.packet,
          eventsDirectory,
          eventFileName: packetEventFileName(event, yield* packetEventDigest(event)),
          eventText: yield* renderPacketEventFile(event),
          tracePath: path.join(locator.packetPath, "ops", "trace.json"),
          traceText: "{}\n",
        });
        expect((yield* store.append(locator, event).pipe(Effect.flip)).message).toContain(
          "Interrupted fork replacement"
        );
        expect((yield* applyPacketGenesisSeed(seed).pipe(Effect.flip)).message).toContain(
          "Interrupted fork replacement"
        );
        expect(yield* fs.exists(eventsDirectory)).toBe(false);
        expect(yield* store.list(PacketStreamLocator.make({ ...locator, packetPath: recoveryRoot }))).toEqual(original);
      })
    );

    it.effect(
      "retains a committed genesis when temporary staging cleanup fails",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const eventsDirectory = path.join(locator.packetPath, "ops", "events");
        yield* fs.remove(eventsDirectory, { recursive: true });
        const event = genesis("cleanup-failure");
        const seed = PacketGenesisSeed.make({
          slug: locator.packet,
          eventsDirectory,
          eventFileName: packetEventFileName(event, yield* packetEventDigest(event)),
          eventText: yield* renderPacketEventFile(event),
          tracePath: path.join(locator.packetPath, "ops", "trace.json"),
          traceText: "{}\n",
        });
        const cleanupFs = FileSystem.FileSystem.of({
          ...fs,
          remove: Effect.fn("PacketConcurrencyTest.failStagingCleanup")(function* (target, options) {
            if (Str.includes(".genesis-stage-")(target)) {
              return yield* PlatformError.systemError({
                _tag: "PermissionDenied",
                module: "FileSystem",
                method: "remove",
                pathOrDescriptor: target,
                description: "injected staging cleanup failure",
              });
            }
            return yield* fs.remove(target, options);
          }),
        });
        yield* applyPacketGenesisSeed(seed).pipe(Effect.provideService(FileSystem.FileSystem, cleanupFs));
        yield* assertStream(locator, 1);
        expect(yield* fs.readFileString(seed.tracePath)).toBe(seed.traceText);
      })
    );

    it.effect(
      "rechecks ownership after staging genesis trace bytes before linking them",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locator = yield* makePacket();
        const eventsDirectory = path.join(locator.packetPath, "ops", "events");
        yield* fs.remove(eventsDirectory, { recursive: true });
        const event = genesis("trace-fence");
        const seed = PacketGenesisSeed.make({
          slug: locator.packet,
          eventsDirectory,
          eventFileName: packetEventFileName(event, yield* packetEventDigest(event)),
          eventText: yield* renderPacketEventFile(event),
          tracePath: path.join(locator.packetPath, "ops", "trace.json"),
          traceText: "{}\n",
        });
        const lockPath = path.join(locator.packetPath, "ops", ".packet-events.lock");
        const traceFs = FileSystem.FileSystem.of({
          ...fs,
          writeFileString: Effect.fn("PacketConcurrencyTest.traceFenceWrite")(function* (file, content, options) {
            yield* fs.writeFileString(file, content, options);
            if (Str.includes(".genesis-trace-publish-")(file)) yield* fs.remove(lockPath, { force: true });
          }),
        });
        const result = yield* applyPacketGenesisSeed(seed).pipe(
          Effect.provideService(FileSystem.FileSystem, traceFs),
          Effect.result
        );
        expect(result._tag).toBe("Failure");
        expect(yield* fs.exists(seed.tracePath)).toBe(false);
        yield* assertStream(locator, 1);
        yield* applyPacketGenesisSeed(seed);
        expect(yield* fs.readFileString(seed.tracePath)).toBe(seed.traceText);
      }),
      20_000
    );

    it.effect(
      "recovers process death on both sides of atomic genesis directory publication",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        for (const pausePoint of ["beforeGenesisPublish", "afterGenesisPublish"]) {
          const locator = yield* makePacket();
          const eventsDirectory = path.join(locator.packetPath, "ops", "events");
          yield* fs.remove(eventsDirectory, { recursive: true });
          const child = yield* startWriter(locator, "genesis-crash", pausePoint);
          assertSome(yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.runHead), "PAUSED");
          expect(yield* fs.exists(eventsDirectory)).toBe(pausePoint === "afterGenesisPublish");
          yield* child.kill({ killSignal: "SIGKILL" });
          yield* child.exitCode.pipe(Effect.result);
          const event = genesis("genesis-crash");
          const seed = PacketGenesisSeed.make({
            slug: locator.packet,
            eventsDirectory,
            eventFileName: packetEventFileName(event, yield* packetEventDigest(event)),
            eventText: yield* renderPacketEventFile(event),
            tracePath: path.join(locator.packetPath, "ops", "trace.json"),
            traceText: "{}\n",
          });
          yield* applyPacketGenesisSeed(seed);
          yield* assertStream(locator, 1);
          expect(yield* fs.readFileString(seed.tracePath)).toBe(seed.traceText);
          expect(yield* fs.exists(path.join(locator.packetPath, "ops", ".packet-events.lock"))).toBe(false);
        }
      }),
      30_000
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

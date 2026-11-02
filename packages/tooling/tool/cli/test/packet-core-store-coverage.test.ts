import {
  foldUnambiguousStream,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketStreamLocator,
  withPacketEventLock,
} from "@beep/repo-cli/test/Goals";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Str from "effect/String";

const testLayer = PacketEventStoreLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

const genesis = (actor: string) =>
  PacketEvent.make({
    schemaVersion: "packet-event/v1",
    packet: "coverage",
    root: "goals",
    seq: 1,
    expectedRevision: 0,
    at: "2026-10-31T00:00:00.000Z",
    actor,
    body: { type: "packet-created", stage: "capture", ordinal: 0, status: "active" },
  });

const makePacket = Effect.fn("PacketStoreCoverageTest.makePacket")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packetPath = yield* fs.makeTempDirectoryScoped({ prefix: "packet-store-coverage-" });
  yield* fs.makeDirectory(path.join(packetPath, "ops", "events"), { recursive: true });
  return PacketStreamLocator.make({ packet: "coverage", root: "goals", packetPath });
});

const injectedFailure = (method: string, target: string) =>
  PlatformError.systemError({
    _tag: "PermissionDenied",
    module: "FileSystem",
    method,
    pathOrDescriptor: target,
    description: `injected ${method} failure`,
  });

layer(testLayer, { excludeTestServices: true, timeout: "30 seconds" })("PacketEventStore kept guards", (it) => {
  it.effect(
    "reports a busy packet lock as another active writer",
    Effect.fnUntraced(function* () {
      const locator = yield* makePacket();
      const failure = yield* withPacketEventLock(locator, () =>
        withPacketEventLock(locator, () => Effect.succeed("nested"))
      ).pipe(Effect.flip);
      expect(failure.message).toContain("lock could not be acquired");
      expect(failure.message).toContain("another active writer");
    })
  );

  it.effect(
    "reports repeated lock loss once the retry bound is exhausted",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const locator = yield* makePacket();
      const lockPath = path.join(locator.packetPath, "ops", ".packet-events.lock");
      let calls = 0;
      const failure = yield* withPacketEventLock(locator, (assertOwned) =>
        Effect.gen(function* () {
          calls++;
          yield* fs.remove(lockPath);
          yield* assertOwned;
        })
      ).pipe(Effect.flip);
      expect(failure.message).toContain("repeatedly lost its event-stream lock");
      expect(calls).toBeGreaterThan(1);
    })
  );

  it.effect(
    "maps a failed recovery inspection to a packet stream error",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const locator = yield* makePacket();
      const failingFs = FileSystem.FileSystem.of({
        ...fs,
        readDirectory: Effect.fnUntraced(function* (
          target: string,
          options?: Parameters<FileSystem.FileSystem["readDirectory"]>[1]
        ) {
          if (target === locator.packetPath) {
            return yield* injectedFailure("readDirectory", target);
          }
          return yield* fs.readDirectory(target, options);
        }),
      });
      let ran = false;
      const failure = yield* withPacketEventLock(locator, () =>
        Effect.sync(() => {
          ran = true;
        })
      ).pipe(Effect.provideService(FileSystem.FileSystem, failingFs), Effect.flip);
      expect(failure.message).toContain("event-stream recovery inspection failed");
      expect(ran).toBe(false);
    })
  );

  it.effect(
    "refuses mutation when canonical events are absent and fork-repair recovery bytes remain",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* PacketEventStore;
      const locator = yield* makePacket();
      const eventsDirectory = path.join(locator.packetPath, "ops", "events");
      const recoveryRoot = path.join(locator.packetPath, ".tmp-packet-repair-killed");
      yield* fs.makeDirectory(path.join(recoveryRoot, "staged-packet", "ops"), { recursive: true });
      yield* fs.rename(eventsDirectory, path.join(recoveryRoot, "staged-packet", "ops", "events"));
      const failure = yield* store.append(locator, genesis("refused")).pipe(Effect.flip);
      expect(failure.message).toContain("Interrupted fork replacement");
      expect(failure.message).toContain(recoveryRoot);
      expect(yield* fs.exists(eventsDirectory)).toBe(false);
    })
  );

  it.effect(
    "appends normally when recovery residue coexists with a canonical stream",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* PacketEventStore;
      const locator = yield* makePacket();
      yield* fs.makeDirectory(path.join(locator.packetPath, ".tmp-packet-repair-stale", "ops", "events"), {
        recursive: true,
      });
      const stored = yield* store.append(locator, genesis("coexisting"));
      expect(stored.event.seq).toBe(1);
      const listing = yield* store.list(locator);
      expect(listing.events).toHaveLength(1);
    })
  );

  it.effect(
    "surfaces a failed event publication as a packet stream error",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const locator = yield* makePacket();
      const failingFs = FileSystem.FileSystem.of({
        ...fs,
        rename: Effect.fnUntraced(function* (from: string, to: string) {
          if (Str.endsWith(".json")(to) && Str.includes("-packet-created-")(to)) {
            return yield* injectedFailure("rename", to);
          }
          return yield* fs.rename(from, to);
        }),
      });
      const store = Context.get(
        yield* PacketEventStoreLive.pipe(
          Layer.fresh,
          Layer.build,
          Effect.provideService(FileSystem.FileSystem, failingFs)
        ),
        PacketEventStore
      );
      const failure = yield* store.append(locator, genesis("unpublished")).pipe(Effect.flip);
      expect(failure._tag).toBe("PacketStreamError");
      expect(failure.message).toContain("Failed to publish packet event");
      const listing = yield* store.list(locator);
      expect(listing.events).toHaveLength(0);
    })
  );

  it.effect(
    "folds an unambiguous stream through the data-last form",
    Effect.fnUntraced(function* () {
      const store = yield* PacketEventStore;
      const locator = yield* makePacket();
      yield* store.append(locator, genesis("curried"));
      const listing = yield* store.list(locator);
      const derived = yield* foldUnambiguousStream(listing)(locator);
      expect(derived.revision).toBe(1);
      expect(derived.status).toBe("active");
    })
  );
});

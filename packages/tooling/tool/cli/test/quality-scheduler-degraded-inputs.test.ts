import {
  admissionStatus,
  MemoryStats,
  MemoryStatsLive,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import * as PlatformError from "effect/PlatformError";

const meminfoFixture = [
  "MemTotal:       131072000 kB",
  "MemFree:          8000000 kB",
  "MemAvailable:    65536000 kB",
  "Buffers:           512000 kB",
  "",
].join("\n");

const degradedMeminfoFixture = ["MemTotal:", "MemAvailable:    lots kB", ""].join("\n");

const meminfoReadError = PlatformError.systemError({
  _tag: "PermissionDenied",
  module: "FileSystem",
  method: "readFileString",
  pathOrDescriptor: "/proc/meminfo",
  description: "fixture denied",
});

const memoryStatsFrom = (
  readFileString: (path: string) => Effect.Effect<string, PlatformError.PlatformError>
): Layer.Layer<MemoryStats> => MemoryStatsLive.pipe(Layer.provide(FileSystem.layerNoop({ readFileString })));

const readMemoryStats = Effect.gen(function* () {
  const stats = yield* MemoryStats;
  const availableGib = yield* stats.availableGib;
  const totalGib = yield* stats.totalGib;
  return { availableGib, totalGib };
});

const expectHostFallback = (gib: number) => {
  expect(Number.isFinite(gib)).toBe(true);
  expect(gib).toBeGreaterThan(0);
};

describe("quality scheduler memory stats", () => {
  it.effect("parses MemAvailable and MemTotal from /proc/meminfo in GiB", () =>
    Effect.gen(function* () {
      const stats = yield* readMemoryStats;
      expect(stats).toEqual({ availableGib: 62.5, totalGib: 125 });
    }).pipe(provideScopedLayer(memoryStatsFrom(() => Effect.succeed(meminfoFixture))))
  );

  it.effect("falls back to the host reading when /proc/meminfo cannot be read", () =>
    Effect.gen(function* () {
      const stats = yield* readMemoryStats;
      expectHostFallback(stats.availableGib);
      expectHostFallback(stats.totalGib);
    }).pipe(provideScopedLayer(memoryStatsFrom(() => Effect.fail(meminfoReadError))))
  );

  it.effect("falls back per field when a meminfo line is missing its value or is not numeric", () =>
    Effect.gen(function* () {
      const stats = yield* readMemoryStats;
      expectHostFallback(stats.availableGib);
      expectHostFallback(stats.totalGib);
      expect(stats.availableGib).not.toBe(62.5);
      expect(stats.totalGib).not.toBe(125);
    }).pipe(provideScopedLayer(memoryStatsFrom(() => Effect.succeed(degradedMeminfoFixture))))
  );
});

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);

const FixedMemoryStatsLayer = Layer.succeed(
  MemoryStats,
  MemoryStats.of({ availableGib: Effect.succeed(64), totalGib: Effect.succeed(128) })
);

const RunScopesOffLayer = ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" }));

describe("quality scheduler admission entries", () => {
  it.effect("skips empty lease and ticket files instead of quarantining them", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runtimeDir = yield* fs.makeTempDirectoryScoped({ prefix: "quality-scheduler-empty-entries-" });
      const admitRoot = path.join(runtimeDir, "beep", "admit");
      const emptyLease = path.join(admitRoot, "leases", "partial-write.lease.json");
      const emptyTicket = path.join(admitRoot, "queue", "partial-write.ticket.json");

      const before = yield* admissionStatus().pipe(
        provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir }))
      );
      expect(before.leases).toHaveLength(0);

      yield* fs.writeFileString(emptyLease, "");
      yield* fs.writeFileString(emptyTicket, "");
      const snapshot = yield* admissionStatus().pipe(
        provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir }))
      );

      expect(snapshot.leases).toHaveLength(0);
      expect(snapshot.tickets).toHaveLength(0);
      expect(snapshot.dead).toHaveLength(0);
      expect(snapshot.quarantined).toHaveLength(0);
      expect(yield* fs.exists(emptyLease)).toBe(true);
      expect(yield* fs.exists(emptyTicket)).toBe(true);
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, FixedMemoryStatsLayer, RunScopesOffLayer)), Effect.scoped)
  );
});

import inspector from "node:inspector/promises";
import {
  AdmissionConfig,
  AdmissionRequest,
  admissionStatus,
  admissionTokenWeight,
  MemoryStats,
  MemoryStatsLive,
  noAdmissionOriginGate,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
  withQualityAdmission,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Deferred, Effect, Fiber, FileSystem, Layer, Path, PlatformError, Ref } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

interface PreciseCoverageResponse {
  readonly result: Array<{
    readonly functions: Array<{
      ranges: Array<{ readonly endOffset: number; readonly startOffset: number }>;
    }>;
  }>;
}

// Node 24 can report duplicate and zero-width ranges for generator helpers.
// When this module is loaded by a second isolated test file, the current V8
// coverage merger recurses forever on those structurally empty ranges.
const originalInspectorPost = inspector.Session.prototype.post;
inspector.Session.prototype.post = function (this: inspector.Session, method: string, ...args: Array<unknown>) {
  return Reflect.apply(originalInspectorPost, this, [method, ...args]).then((response: unknown) => {
    if (method === "Profiler.takePreciseCoverage") {
      inspector.Session.prototype.post = originalInspectorPost;
      for (const script of (response as PreciseCoverageResponse).result) {
        for (const fn of script.functions) {
          let seen = A.empty<string>();
          fn.ranges = A.filter(fn.ranges, (range) => {
            const key = `${range.startOffset}:${range.endOffset}`;
            if (range.endOffset <= range.startOffset || A.contains(seen, key)) {
              return false;
            }
            seen = A.append(seen, key);
            return true;
          });
        }
      }
    }
    return response;
  });
} as typeof originalInspectorPost;

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);

const request = AdmissionRequest.make({
  kind: "full-proof",
  weightTokens: admissionTokenWeight("full-proof"),
  priority: "verify",
  originKey: "drifttest111",
  checkoutRoot: "/repo/drift-test",
  branch: "test/scheduler-drift",
  command: "bun run coverage",
});

const readMemoryStats = Effect.fnUntraced(function* () {
  const stats = yield* MemoryStats;
  const availableGib = yield* stats.availableGib;
  const totalGib = yield* stats.totalGib;

  return { availableGib, totalGib };
});

const readMemoryStatsFrom = Effect.fnUntraced(function* (meminfo: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const fixedFileSystem = FileSystem.FileSystem.of({
    ...fileSystem,
    readFileString: Effect.fn("QualitySchedulerDriftTest.readFileString")(() => Effect.succeed(meminfo)),
  });

  return yield* readMemoryStats().pipe(
    provideScopedLayer(MemoryStatsLive),
    provideScopedLayer(Layer.succeed(FileSystem.FileSystem, fixedFileSystem))
  );
});

describe("QualityScheduler deterministic memory readings", () => {
  it.effect("reads available and total GiB from fixed procfs data", () =>
    Effect.gen(function* () {
      const stats = yield* readMemoryStatsFrom("MemTotal: 134217728 kB\nMemAvailable: 52428800 kB\n");

      expect(stats).toEqual({ availableGib: 50, totalGib: 128 });
    }).pipe(provideScopedLayer(NodeFileSystem.layer))
  );

  it.effect("falls back to finite system readings for malformed procfs fields", () =>
    Effect.gen(function* () {
      const stats = yield* readMemoryStatsFrom("MemTotal: invalid kB\nMemAvailable: invalid kB\n");

      expect(Number.isFinite(stats.availableGib)).toBe(true);
      expect(Number.isFinite(stats.totalGib)).toBe(true);
      expect(stats.availableGib).toBeGreaterThanOrEqual(0);
      expect(stats.totalGib).toBeGreaterThan(0);
    }).pipe(provideScopedLayer(NodeFileSystem.layer))
  );

  it.effect("rolls back a staged lease when memory drops before publication", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const runtimeRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "quality-scheduler-drift-" });
      const memoryReads = yield* Ref.make(0);
      const originReleased = yield* Deferred.make<void>();
      const gate = {
        tryAcquire: Effect.succeedSome("origin-lease"),
        tryAcquireFallback: Effect.succeedSome("origin-lease"),
        release: (_lease: string) => Deferred.succeed(originReleased, undefined).pipe(Effect.asVoid),
      };
      const scheduler = withQualityAdmission(
        request,
        gate,
        Effect.succeed("admitted"),
        AdmissionConfig.make({ heartbeatSeconds: 0.02, progressSeconds: 0.4 })
      ).pipe(
        provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot })),
        provideScopedLayer(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              BEEP_RUN_SCOPES: "0",
            })
          )
        ),
        provideScopedLayer(
          Layer.succeed(
            MemoryStats,
            MemoryStats.of({
              availableGib: Ref.getAndUpdate(memoryReads, (reads) => reads + 1).pipe(
                Effect.map((reads) => (reads === 0 ? 50 : 10))
              ),
              totalGib: Effect.succeed(128),
            })
          )
        )
      );
      const fiber = yield* Effect.forkChild(scheduler);

      yield* Deferred.await(originReleased);
      yield* Fiber.interrupt(fiber);

      expect(yield* Ref.get(memoryReads)).toBe(2);
    }).pipe(provideScopedLayer(Layer.merge(PlatformLayer, TestConsole.layer)))
  );

  it.effect("maps an exclusive lease collision to the scheduler error", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const runtimeRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "quality-scheduler-drift-" });
      const alreadyExists = PlatformError.systemError({
        _tag: "AlreadyExists",
        module: "FileSystem",
        method: "link",
        pathOrDescriptor: runtimeRoot,
        description: "injected lease collision",
      });
      const collidingFileSystem = FileSystem.FileSystem.of({
        ...fileSystem,
        link: Effect.fn("FileSystem.FileSystem.link")((source, target) =>
          Str.includes("/leases/")(target) ? Effect.fail(alreadyExists) : fileSystem.link(source, target)
        ),
      });
      const failure = yield* withQualityAdmission(
        request,
        noAdmissionOriginGate,
        Effect.succeed("unreachable"),
        AdmissionConfig.make({})
      ).pipe(
        Effect.flip,
        provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot })),
        provideScopedLayer(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              BEEP_RUN_SCOPES: "0",
            })
          )
        ),
        provideScopedLayer(
          Layer.succeed(
            MemoryStats,
            MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) })
          )
        ),
        provideScopedLayer(Layer.succeed(FileSystem.FileSystem, collidingFileSystem))
      );

      expect(failure.message).toContain("already exists");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("ignores an empty queue entry without quarantining it", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runtimeRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "quality-scheduler-drift-" });
      const schedulerRoot = path.join(runtimeRoot, "beep", "admit");
      const services = Layer.mergeAll(
        ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" })),
        Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) }))
      );
      const run = <Value, Failure, Requirements>(effect: Effect.Effect<Value, Failure, Requirements>) =>
        effect.pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot })),
          provideScopedLayer(services)
        );

      yield* run(withQualityAdmission(request, noAdmissionOriginGate, Effect.void, AdmissionConfig.make({})));
      yield* fileSystem.writeFileString(path.join(schedulerRoot, "queue", "empty.ticket.json"), "");
      const snapshot = yield* run(admissionStatus(AdmissionConfig.make({})));

      expect(snapshot.tickets).toEqual([]);
      expect(snapshot.quarantined).toEqual([]);
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});

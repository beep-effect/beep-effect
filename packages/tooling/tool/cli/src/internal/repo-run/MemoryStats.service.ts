/**
 * Live host and cgroup memory budgets for repository admission.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as NodeOS from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { constrainedCeilingGib, liveComputeMemorySource } from "./ComputeProfile.ts";
import { CgroupBytes } from "./MemoryStats.schemas.ts";
import { processIdentityStatus } from "./ProcessIdentity.ts";
import { QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import { RunScopeCgroupPath } from "./RunScope.schemas.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type { ComputeMemorySource } from "./ComputeProfile.ts";
import type { AdmissionConfig, YeetAdmissionLease } from "./QualityScheduler.schemas.ts";

// Preserve the existing Context key while its implementation gains an owner.
const $legacyServiceId = $RepoCliId.create("internal/repo-run/QualityScheduler");
const GIB = 1024 * 1024 * 1024;
const MEMINFO_PATH = "/proc/meminfo";

/**
 * Shape of the {@link MemoryStats} service.
 *
 * @category services
 * @since 0.0.0
 */
export interface MemoryStatsShape {
  /**
   * Currently available memory in GiB, re-read on every evaluation.
   *
   * Under a cgroup ceiling this is `min(MemAvailable, ceilingGib - process RSS)`:
   * this compatibility reading uses the runtime ceiling and RSS. Reservation
   * budgeting additionally reads ancestor `memory.current` through procfs.
   */
  readonly availableGib: Effect.Effect<number>;

  /**
   * The process memory ceiling in GiB: the cgroup ceiling from
   * `process.constrainedMemory()` when it is tighter than installed memory,
   * otherwise `MemTotal`.
   */
  readonly ceilingGib: Effect.Effect<number>;
  /** Capacity in the host domain, tightened by reservations in each caller ancestor.
   * Legacy providers omit this and retain conservative global accounting.
   */
  readonly reservationCapacity?: (
    leases: ReadonlyArray<YeetAdmissionLease>,
    config: AdmissionConfig,
    destination?: O.Option<string>
  ) => Effect.Effect<number>;
  /** Installed physical memory in GiB (`MemTotal`). */
  readonly totalGib: Effect.Effect<number>;
}

/**
 * Service reporting live machine memory availability for admission decisions.
 *
 * **Example** (Provide a fixed reading in tests)
 *
 * ```ts
 * import { MemoryStats } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * const fixed = Layer.succeed(
 *   MemoryStats,
 *   MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128), ceilingGib: Effect.succeed(128) })
 * )
 * console.log(Layer.isLayer(fixed)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MemoryStats extends Context.Service<MemoryStats, MemoryStatsShape>()($legacyServiceId`MemoryStats`) {}

/**
 * Read a meminfo field in GiB for the scheduler's existing parser test seam.
 *
 * **Example** (Decode available memory)
 *
 * ```ts
 * import { qualitySchedulerForTesting } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 * console.log(O.isSome(qualitySchedulerForTesting.parseMeminfoFieldGib("MemAvailable: 1024 kB", "MemAvailable:"))) // true
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseMeminfoFieldGib: {
  (meminfo: string, field: string): O.Option<number>;
  (field: string): (meminfo: string) => O.Option<number>;
} = dual(
  2,
  (meminfo: string, field: string): O.Option<number> =>
    pipe(
      Str.split(meminfo, "\n"),
      A.findFirst(Str.startsWith(field)),
      O.flatMap((line) => A.get(A.filter(Str.split(line, /\s+/), Str.isNonEmpty), 1)),
      O.map(Number),
      O.filter((kib) => !Number.isNaN(kib)),
      O.map((kib) => (kib * 1024) / GIB)
    )
);

// Membership is read live rather than persisted: enterRunScope can move an
// admitted owner. Invalid or unreadable metadata never proves disjointness.
const cgroupMembership = (text: string): O.Option<string> =>
  pipe(
    Str.split(Str.trim(text), "\n"),
    A.filter(Str.startsWith("0::/")),
    O.liftPredicate((lines: ReadonlyArray<string>) => A.length(lines) === 1),
    O.flatMap(A.head),
    O.map(Str.slice(3)),
    O.filter(S.is(RunScopeCgroupPath))
  );

const cgroupContains = (ancestor: string, member: string): boolean =>
  ancestor === "/" || member === ancestor || Str.startsWith(`${ancestor}/`)(member);

const decodeCgroupBytes = S.decodeUnknownOption(CgroupBytes);

const makeReservationCapacity = (
  fs: FileSystem.FileSystem,
  source: ComputeMemorySource,
  hostAvailableGib: Effect.Effect<number>,
  fallbackAvailableGib: Effect.Effect<number>
) =>
  Effect.fnUntraced(function* (
    leases: ReadonlyArray<YeetAdmissionLease>,
    config: AdmissionConfig,
    destination: O.Option<string> = O.none()
  ) {
    const fallback = fallbackAvailableGib.pipe(
      Effect.map((available) => admissionCapacityTokensFor(available, config))
    );
    const inspect = Effect.gen(function* () {
      const invalid = () =>
        QualitySchedulerError.make({
          message: "Cannot establish cgroup admission budget.",
        });
      const required = <T>(value: O.Option<T>) => Effect.fromOption(value).pipe(Effect.mapError(invalid));
      const readMembership = (pid: number) =>
        fs
          .readFileString(`/proc/${pid}/cgroup`)
          .pipe(Effect.map(cgroupMembership), Effect.orElseSucceed(O.none<string>));
      const ownerMembership = yield* readMembership(process.pid);
      const owner = yield* required(ownerMembership);
      const budgetPath = pipe(
        destination,
        O.getOrElse(() => owner)
      );
      const callerOption = O.liftPredicate(S.is(RunScopeCgroupPath))(budgetPath);
      const caller = yield* required(callerOption);
      const mounts = yield* fs.readFileString("/proc/self/mountinfo");
      const mount = yield* required(
        pipe(
          Str.split(mounts, "\n"),
          A.findFirst((line) => pipe(line, Str.includes(" - cgroup2 "))),
          O.map((line) => Str.split(line, " "))
        )
      );
      const mountRoot = yield* required(A.get(mount, 3));
      const mountPoint = yield* required(A.get(mount, 4));
      // Escaped mount paths and a namespace outside the visible mount are unknown.
      if (
        !S.is(RunScopeCgroupPath)(mountPoint) ||
        !S.is(RunScopeCgroupPath)(mountRoot) ||
        !cgroupContains(mountRoot, caller)
      ) {
        return yield* invalid();
      }
      const memberships = yield* Effect.forEach(
        leases,
        (lease) =>
          Effect.gen(function* () {
            const before = yield* processIdentityStatus(lease);
            const member = yield* readMembership(lease.pid);
            const finalMember = yield* readMembership(lease.pid);
            const after = yield* processIdentityStatus(lease);
            return lease.runScope !== undefined &&
              Equal.equals(member, finalMember) &&
              before === "alive" &&
              after === "alive" &&
              Str.isNonEmpty(lease.procStart)
              ? member
              : O.none<string>();
          }),
        { concurrency: 1 }
      );
      const availableGib = yield* hostAvailableGib;
      let capacity = admissionCapacityTokensFor(availableGib, config);
      const globalTokens = A.reduce(leases, 0, (total, lease) => total + lease.weightTokens);
      const readBytes = (file: string) =>
        fs.readFileString(file).pipe(Effect.flatMap((text) => required(decodeCgroupBytes(Str.trim(text)))));
      let minimumLimitGib = Number.POSITIVE_INFINITY;
      let ancestor = caller;
      while (true) {
        const suffix = mountRoot === "/" ? ancestor : Str.slice(mountRoot.length)(ancestor);
        const directory = `${mountPoint}${suffix === "/" ? "" : suffix}`;
        // A native hierarchy root lacks memory controller files, but a
        // namespace/subtree root may expose finite limits. Only definite
        // absence of BOTH files proves there is no root controller to charge.
        const limitTexts = yield* Effect.forEach(
          ["memory.high", "memory.max"],
          (name) =>
            fs.readFileString(`${directory}/${name}`).pipe(
              Effect.asSome,
              Effect.catchIf(
                (error) => error.reason._tag === "NotFound",
                () => Effect.succeed(O.none<string>())
              )
            ),
          { concurrency: 1 }
        );
        if (ancestor !== mountRoot || A.some(limitTexts, O.isSome)) {
          const limits = yield* Effect.forEach(
            limitTexts,
            (text) =>
              Effect.gen(function* () {
                const raw = yield* required(text);
                const value = Str.trim(raw);
                return value === "max" ? Number.POSITIVE_INFINITY : yield* required(decodeCgroupBytes(value));
              }),
            { concurrency: 1 }
          );
          const limit = A.reduce(limits, Number.POSITIVE_INFINITY, Num.min);
          if (S.is(S.Finite)(limit)) {
            minimumLimitGib = Math.min(minimumLimitGib, limit / GIB);
            const current = yield* readBytes(`${directory}/memory.current`);
            const localTokens = A.reduce(
              A.zip(leases, memberships),
              0,
              (total, [lease, member]) =>
                total +
                (O.match(member, {
                  onNone: () => true,
                  onSome: (value) => cgroupContains(ancestor, value),
                })
                  ? lease.weightTokens
                  : 0)
            );
            const localCapacity = admissionCapacityTokensFor(Math.max(0, (limit - current) / GIB), config);
            capacity = Math.min(capacity, globalTokens - localTokens + localCapacity);
          }
        }
        if (ancestor === mountRoot) break;
        ancestor = pipe(Str.split(ancestor, "/"), A.dropRight(1), A.join("/"));
        if (Str.isEmpty(ancestor)) ancestor = "/";
      }
      // The runtime may see a tighter controller than the visible mount. Do not
      // replace its clamp unless procfs accounts for at least that ceiling.
      const constrained = constrainedCeilingGib(source);
      if (O.isNone(destination) && O.isSome(constrained) && constrained.value < minimumLimitGib) return yield* fallback;
      const finalMembership = yield* readMembership(process.pid);
      const finalCaller = yield* required(finalMembership);
      return owner === finalCaller ? capacity : yield* invalid();
    });
    return yield* inspect.pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.catch(() => fallback)
    );
  });

const makeMemoryStats = Effect.fnUntraced(function* (
  source: ComputeMemorySource
): Effect.fn.Return<MemoryStatsShape, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const meminfoFieldGib = (field: string, fallback: () => number) =>
    fs.readFileString(MEMINFO_PATH).pipe(
      Effect.map((meminfo) => parseMeminfoFieldGib(meminfo, field)),
      Effect.orElseSucceed(O.none<number>),
      Effect.map(O.getOrElse(fallback))
    );
  // Non-Linux fallback: NodeOS.freemem() under-reports (no reclaimable cache), which
  // only makes admission more conservative.
  const memAvailableGib = meminfoFieldGib("MemAvailable:", () => NodeOS.freemem() / GIB);
  const totalGib = meminfoFieldGib("MemTotal:", () => NodeOS.totalmem() / GIB);
  const constrainedGib = Effect.sync(() => constrainedCeilingGib(source));
  const availableGib = Effect.flatMap(
    constrainedGib,
    O.match({
      onNone: () => memAvailableGib,
      onSome: (ceilingGib) =>
        Effect.map(memAvailableGib, (available) =>
          Math.min(available, Math.max(0, ceilingGib - source.residentBytes() / GIB))
        ),
    })
  );
  return {
    availableGib,
    reservationCapacity: makeReservationCapacity(fs, source, memAvailableGib, availableGib),
    totalGib,
    ceilingGib: Effect.flatMap(constrainedGib, O.match({ onNone: () => totalGib, onSome: Effect.succeed })),
  };
});

/**
 * Build a {@link MemoryStats} layer from an explicit memory source.
 *
 * **Details**
 *
 * `/proc/meminfo` supplies `MemAvailable` and `MemTotal`; the source supplies
 * the cgroup ceiling and process RSS. Under a ceiling tighter than installed
 * memory, `availableGib` is clamped to `ceilingGib - RSS` and `ceilingGib`
 * reports the ceiling, otherwise `MemTotal`.
 *
 * **Example** (Build a layer for a 7 GiB slice)
 *
 * ```ts
 * import { memoryStatsLayerFor } from "@beep/repo-cli/test/RepoRun"
 * import * as Layer from "effect/Layer";
 * const GIB = 1024 ** 3
 * const layer = memoryStatsLayerFor({
 *   constrainedMemoryBytes: () => 7 * GIB,
 *   totalMemoryBytes: () => 15 * GIB,
 *   residentBytes: () => 0,
 * })
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @param source - Cgroup ceiling, installed memory, and RSS readings.
 * @returns A layer reading live meminfo through the given source.
 * @category services
 * @since 0.0.0
 */
export const memoryStatsLayerFor = (
  source: ComputeMemorySource
): Layer.Layer<MemoryStats, never, FileSystem.FileSystem> =>
  Layer.effect(MemoryStats, Effect.map(makeMemoryStats(source), MemoryStats.of));

/**
 * Production {@link MemoryStats} layer reading `/proc/meminfo` `MemAvailable`,
 * clamped by the process cgroup ceiling from `process.constrainedMemory()`.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { MemoryStatsLive } from "@beep/repo-cli/test/RepoRun"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(MemoryStatsLive)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const MemoryStatsLive: Layer.Layer<MemoryStats, never, SecureRandom.SecureRandom | FileSystem.FileSystem> =
  memoryStatsLayerFor(liveComputeMemorySource);

/**
 * Compute the admission capacity in tokens for one memory reading.
 *
 * Chartered formula (SPEC D1): `min(capacityMax, floor((available − reserve) / slot))`,
 * with a hard zero below the admission floor.
 *
 * **Example** (Capacity at 50 GiB available)
 *
 * ```ts
 * import { AdmissionConfig, admissionCapacityTokensFor } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(admissionCapacityTokensFor(50, AdmissionConfig.make({}))) // 8
 * ```
 *
 * @param availableGib - Live `MemAvailable` reading in GiB.
 * @param config - Admission policy knobs.
 * @returns Whole token capacity, never negative.
 * @category admission
 * @since 0.0.0
 */
export const admissionCapacityTokensFor: {
  (availableGib: number, config: AdmissionConfig): number;
  (config: AdmissionConfig): (availableGib: number) => number;
} = dual(2, (availableGib: number, config: AdmissionConfig): number => {
  if (availableGib < config.hardFloorGib) {
    return 0;
  }
  const raw = Math.floor((availableGib - config.reserveGib) / config.slotSizeGib);
  return Math.max(0, Math.min(config.capacityMaxTokens, raw));
});

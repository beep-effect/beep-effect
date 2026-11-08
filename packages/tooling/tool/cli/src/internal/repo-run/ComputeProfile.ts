/**
 * Per-process compute profile probe (goal compute-profile-gate-routing, D1).
 *
 * The profile comes from the live memory ceiling: `process.constrainedMemory()`
 * when the process runs in a capped cgroup (Bun reports `memory.high`, Node
 * `memory.max`; both are "the ceiling" and are never compared to each other),
 * otherwise the installed memory. A `BEEP_COMPUTE_PROFILE` config override may
 * only tighten the profile to `worker`.
 *
 * @since 0.0.0
 */

import * as NodeOS from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ComputeProfile, ComputeProfileError, ComputeProfileResolution } from "./ComputeProfile.schemas.ts";
import { AdmissionConfig } from "./QualityScheduler.schemas.ts";
import type { ComputeProfileSource } from "./ComputeProfile.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/ComputeProfile");

const GIB = 1024 * 1024 * 1024;
// Node reports an uncapped cgroup as a huge sentinel (about 2^64); anything at
// or above 2^62 bytes is treated as "no ceiling".
const UNCAPPED_SENTINEL_BYTES = 2 ** 62;

const isFiniteNumber = S.is(S.Finite);

/**
 * Raw memory readings the compute profile probe consumes.
 *
 * **Details**
 *
 * The live source reads `process.constrainedMemory()`, `os.totalmem()` and
 * `process.memoryUsage.rss()`. Tests inject fixed readings instead of
 * patching `process`. A reading that throws or is absent returns `undefined`.
 *
 * @category services
 * @since 0.0.0
 */
export interface ComputeMemorySource {
  /** The process memory ceiling in bytes, or `undefined` when the runtime has none. */
  readonly constrainedMemoryBytes: () => number | undefined;
  /** Resident set size of the current process in bytes. */
  readonly residentBytes: () => number;
  /** Installed physical memory in bytes, or `undefined` when unreadable. */
  readonly totalMemoryBytes: () => number | undefined;
}

const readSafely = (read: () => number | undefined): number | undefined => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

/**
 * Live {@link ComputeMemorySource} backed by the running process.
 *
 * **Example** (Read the live ceiling)
 *
 * ```ts
 * import { liveComputeMemorySource } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof liveComputeMemorySource.totalMemoryBytes()) // "number"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const liveComputeMemorySource: ComputeMemorySource = {
  constrainedMemoryBytes: () => readSafely(() => process.constrainedMemory()),
  totalMemoryBytes: () => readSafely(() => NodeOS.totalmem()),
  residentBytes: () => process.memoryUsage.rss(),
};

const usableBytes = (value: number | undefined): O.Option<number> =>
  pipe(
    O.fromUndefinedOr(value),
    O.filter((bytes) => isFiniteNumber(bytes) && bytes > 0 && bytes < UNCAPPED_SENTINEL_BYTES)
  );

/**
 * The process memory ceiling in GiB, falling back to installed memory.
 *
 * **Details**
 *
 * `undefined`, `0`, non-finite values and the uncapped sentinel (at or above
 * 2^62 bytes) mean the process is uncapped, so installed memory is the
 * ceiling. `None` means neither reading was usable.
 *
 * **Example** (A 7 GiB ceiling)
 *
 * ```ts
 * import { memoryCeilingGib } from "@beep/repo-cli/test/RepoRun"
 *
 * const GIB = 1024 ** 3
 * const ceiling = memoryCeilingGib({
 *   constrainedMemoryBytes: () => 7 * GIB,
 *   totalMemoryBytes: () => 15 * GIB,
 *   residentBytes: () => 0
 * })
 * console.log(ceiling) // { _id: 'Option', _tag: 'Some', value: 7 }
 * ```
 *
 * @param source - Memory readings to interpret.
 * @returns The ceiling in GiB, or `None` when no reading was usable.
 * @category utilities
 * @since 0.0.0
 */
export const memoryCeilingGib = (source: ComputeMemorySource): O.Option<number> =>
  pipe(
    usableBytes(source.constrainedMemoryBytes()),
    O.orElse(() => usableBytes(source.totalMemoryBytes())),
    O.map((bytes) => bytes / GIB)
  );

/**
 * The cgroup ceiling in GiB, only when it is tighter than installed memory.
 *
 * **Details**
 *
 * Bun returns installed memory from `process.constrainedMemory()` when the
 * process is uncapped, so a ceiling counts as a constraint only below
 * `os.totalmem()`.
 *
 * **Example** (An uncapped process has no constraint)
 *
 * ```ts
 * import { constrainedCeilingGib } from "@beep/repo-cli/test/RepoRun"
 *
 * const GIB = 1024 ** 3
 * const ceiling = constrainedCeilingGib({
 *   constrainedMemoryBytes: () => 125 * GIB,
 *   totalMemoryBytes: () => 125 * GIB,
 *   residentBytes: () => 0
 * })
 * console.log(ceiling) // { _id: 'Option', _tag: 'None' }
 * ```
 *
 * @param source - Memory readings to interpret.
 * @returns The constraining ceiling in GiB, or `None` when the process is uncapped.
 * @category utilities
 * @since 0.0.0
 */
export const constrainedCeilingGib = (source: ComputeMemorySource): O.Option<number> => {
  const total = usableBytes(source.totalMemoryBytes());
  return pipe(
    usableBytes(source.constrainedMemoryBytes()),
    O.filter((bytes) =>
      O.match(total, {
        onNone: () => true,
        onSome: (totalBytes) => bytes < totalBytes,
      })
    ),
    O.map((bytes) => bytes / GIB)
  );
};

/**
 * The admission envelope a ceiling is compared against: `hardFloorGib + slotSizeGib`.
 *
 * **Example** (The default envelope)
 *
 * ```ts
 * import { AdmissionConfig, computeEnvelopeGib } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(computeEnvelopeGib(AdmissionConfig.make({}))) // 20
 * ```
 *
 * @param config - Admission policy knobs.
 * @returns The envelope in GiB.
 * @category utilities
 * @since 0.0.0
 */
export const computeEnvelopeGib = (config: AdmissionConfig): number => config.hardFloorGib + config.slotSizeGib;

const computeProfileOverride = Config.option(Config.schema(ComputeProfile, "BEEP_COMPUTE_PROFILE"));

const probedProfile = (
  ceiling: O.Option<number>,
  envelopeGib: number
): { readonly profile: ComputeProfile; readonly source: ComputeProfileSource } =>
  O.match(ceiling, {
    onNone: () => ({ profile: "workstation", source: "unavailable" }),
    onSome: (ceilingGib) => ({ profile: ceilingGib < envelopeGib ? "worker" : "workstation", source: "probe" }),
  });

/**
 * Resolve the compute profile from a memory ceiling and the config override.
 *
 * **Details**
 *
 * The ceiling is compared against the envelope: below it is `worker`, at or
 * above it `workstation`, and `None` is `workstation` with source
 * `unavailable`. The override may only tighten: `worker` forces `worker` with
 * source `override`; `workstation` is ignored with one warning per
 * resolution. An override that is not a {@link ComputeProfile} fails with
 * {@link ComputeProfileError}. The admission scheduler calls this with the
 * `MemoryStats` ceiling so its profile always agrees with its capacity view.
 *
 * **Example** (Resolve a 7 GiB ceiling)
 *
 * ```ts
 * import { resolveComputeProfileForCeiling } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const resolution = Effect.runSync(resolveComputeProfileForCeiling(O.some(7), 20))
 * console.log(resolution.profile) // "worker"
 * ```
 *
 * @param ceilingGib - The memory ceiling in GiB, or `None` when unreadable.
 * @param envelopeGib - Admission envelope in GiB.
 * @returns The resolved profile with its evidence.
 * @category utilities
 * @since 0.0.0
 */
export const resolveComputeProfileForCeiling = Effect.fn("ComputeProfile.resolveForCeiling")(function* (
  ceilingGib: O.Option<number>,
  envelopeGib: number
): Effect.fn.Return<ComputeProfileResolution, ComputeProfileError> {
  const probed = probedProfile(ceilingGib, envelopeGib);
  const overrideRequested = yield* computeProfileOverride.pipe(
    Effect.mapError((cause) =>
      ComputeProfileError.make({
        message: `BEEP_COMPUTE_PROFILE must be one of ${A.join(ComputeProfile.literals, ", ")}.`,
        cause,
      })
    )
  );
  const forcedWorker = O.exists(overrideRequested, ComputeProfile.is.worker);
  if (O.exists(overrideRequested, ComputeProfile.is.workstation)) {
    yield* Console.warn(
      `[beep] BEEP_COMPUTE_PROFILE=workstation ignored: the override may only tighten to worker (probe: ${probed.profile}).`
    );
  }
  return ComputeProfileResolution.make({
    profile: forcedWorker ? "worker" : probed.profile,
    source: forcedWorker ? "override" : probed.source,
    ceilingGib,
    envelopeGib,
    overrideRequested,
  });
});

/**
 * Resolve the compute profile from memory readings and the config override.
 *
 * **Details**
 *
 * Reads the ceiling with {@link memoryCeilingGib}, then applies
 * {@link resolveComputeProfileForCeiling}.
 *
 * **Example** (Resolve against fixed readings)
 *
 * ```ts
 * import { resolveComputeProfileWith } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const GIB = 1024 ** 3
 * const resolution = Effect.runSync(
 *   resolveComputeProfileWith(
 *     { constrainedMemoryBytes: () => 7 * GIB, totalMemoryBytes: () => 15 * GIB, residentBytes: () => 0 },
 *     20
 *   )
 * )
 * console.log(resolution.profile) // "worker"
 * ```
 *
 * @param source - Memory readings to interpret.
 * @param envelopeGib - Admission envelope in GiB.
 * @returns The resolved profile with its evidence.
 * @category utilities
 * @since 0.0.0
 */
export const resolveComputeProfileWith = Effect.fn("ComputeProfile.resolve")(function* (
  source: ComputeMemorySource,
  envelopeGib: number
): Effect.fn.Return<ComputeProfileResolution, ComputeProfileError> {
  return yield* resolveComputeProfileForCeiling(memoryCeilingGib(source), envelopeGib);
});

/**
 * Shape of the {@link ComputeProfileProbe} service.
 *
 * @category services
 * @since 0.0.0
 */
export interface ComputeProfileProbeShape {
  /** Resolve against the default admission envelope (20 GiB). */
  readonly resolve: Effect.Effect<ComputeProfileResolution, ComputeProfileError>;
  /** Resolve against an explicit admission envelope in GiB. */
  readonly resolveFor: (envelopeGib: number) => Effect.Effect<ComputeProfileResolution, ComputeProfileError>;
}

/**
 * Build a {@link ComputeProfileProbeShape} over one memory source.
 *
 * **Example** (A probe pinned to a 7 GiB slice)
 *
 * ```ts
 * import { makeComputeProfileProbe } from "@beep/repo-cli/test/RepoRun"
 *
 * const GIB = 1024 ** 3
 * const probe = makeComputeProfileProbe({
 *   constrainedMemoryBytes: () => 7 * GIB,
 *   totalMemoryBytes: () => 15 * GIB,
 *   residentBytes: () => 0
 * })
 * console.log(typeof probe.resolveFor) // "function"
 * ```
 *
 * @param source - Memory readings the probe interprets.
 * @returns The probe service value.
 * @category services
 * @since 0.0.0
 */
export const makeComputeProfileProbe = (source: ComputeMemorySource): ComputeProfileProbeShape => ({
  resolve: resolveComputeProfileWith(source, computeEnvelopeGib(AdmissionConfig.make({}))),
  resolveFor: (envelopeGib) => resolveComputeProfileWith(source, envelopeGib),
});

/**
 * Service resolving the per-process compute profile.
 *
 * **Details**
 *
 * A `Context.Reference` whose default reads the live process, so commands and
 * the admission scheduler need no extra layer; tests provide a probe built
 * with {@link makeComputeProfileProbe}.
 *
 * **Example** (Pin the worker profile in a test)
 *
 * ```ts
 * import { ComputeProfileProbe, makeComputeProfileProbe } from "@beep/repo-cli/test/RepoRun"
 * import * as Layer from "effect/Layer"
 *
 * const GIB = 1024 ** 3
 * const worker = Layer.succeed(
 *   ComputeProfileProbe,
 *   makeComputeProfileProbe({
 *     constrainedMemoryBytes: () => 7 * GIB,
 *     totalMemoryBytes: () => 15 * GIB,
 *     residentBytes: () => 0
 *   })
 * )
 * console.log(Layer.isLayer(worker)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const ComputeProfileProbe: Context.Reference<ComputeProfileProbeShape> =
  Context.Reference<ComputeProfileProbeShape>($I`ComputeProfileProbe`, {
    defaultValue: () => makeComputeProfileProbe(liveComputeMemorySource),
  });

/**
 * Planning helpers for Quality command profiles and local concurrency.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeOS from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { isCiSync } from "../../internal/cli/EnvConfig.ts";
import { invokerAncestryPids } from "../../internal/repo-run/ProcessAttachment.ts";
import { admissionStatus, MemoryStats } from "../../internal/repo-run/QualityScheduler.ts";
import {
  QualityAdmissionLoad,
  QualityCheckConcurrency,
  QualityConcurrencyPlan,
  QualityHardwareProfile,
  QualityLocalConcurrencyOverride,
  QualityProfileConfig,
  QualityProfileDetection,
  QualityProfileDetectionInput,
} from "./Quality.schemas.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { AdmissionSnapshot } from "../../internal/repo-run/QualityScheduler.schemas.ts";

const $I = $RepoCliId.create("commands/Quality/Quality.plan");

/**
 * The part of an admission snapshot the concurrency plan reads.
 *
 * @category models
 * @since 0.0.0
 */
export type QualityAdmissionSnapshotView = Pick<AdmissionSnapshot, "capacityTokens"> & {
  readonly leases: ReadonlyArray<{ readonly pid: number; readonly weightTokens: number }>;
};

const gibibytes = (bytes: number): number => Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10;

/**
 * Return static quality scheduling settings for a hardware profile.
 *
 * **Details**
 *
 * The `ci` profile carries the hosted values verbatim: the heavy-fleet root
 * Turbo cap, the four-worker policy lint budget, four cheap-gate lanes, serial
 * pre-push lanes and the four-thread oxlint sweep. `current` keeps those same
 * local values an 8-vCPU machine ran before concurrency was profile-derived.
 * `workstation` (32 cores and 64 GiB or more) widens every local knob.
 *
 * **Example** (Workstation scheduling settings)
 *
 * ```ts
 * import { qualityProfileConfigForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(qualityProfileConfigForTesting("workstation").reviewFixSlots)
 * ```
 *
 * @param profile - Quality hardware profile to map to scheduling settings.
 * @returns Static quality scheduling configuration for the profile.
 * @category configuration
 * @since 0.0.0
 */
export const qualityProfileConfigForTesting = (profile: QualityHardwareProfile): QualityProfileConfig =>
  QualityHardwareProfile.match(profile, {
    ci: () =>
      QualityProfileConfig.make({
        profile,
        // Hosted runners died ("runner lost communication") under turbo's default
        // concurrency (~10) stacking multi-GB tsgo processes on the smallest hosted
        // machines; see goals/quality-speedup/research/instantiation-census.md §5.
        // The heavy lanes now run on 32GB beep-ec2-heavy fleet workers, so the cap
        // is the 8vCPU tuning; the 16GB lint/test-unit lanes keep their own cap in
        // Ci/CiLane.ts.
        turboConcurrency: 4,
        policyLintConcurrency: 4,
        cheapGateConcurrency: 4,
        prePushLaneConcurrency: 1,
        oxlintThreads: 4,
        docgenParallel: 3,
        fullProofSlots: 1,
        reviewFixSlots: 1,
        notes: ["CI keeps conservative parallelism and relies on hosted job sharding."],
      }),
    current: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 3,
        policyLintConcurrency: 4,
        cheapGateConcurrency: 4,
        prePushLaneConcurrency: 1,
        oxlintThreads: 4,
        docgenParallel: 3,
        fullProofSlots: 1,
        reviewFixSlots: 1,
        notes: ["Current local profile keeps one heavyweight proof active at a time."],
      }),
    workstation: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 8,
        policyLintConcurrency: 8,
        cheapGateConcurrency: 8,
        prePushLaneConcurrency: 4,
        oxlintThreads: 16,
        docgenParallel: 6,
        fullProofSlots: 1,
        reviewFixSlots: 3,
        notes: ["Workstation profile allows parallel review-fix loops while keeping full proofs serialized."],
      }),
  });

/**
 * Detect the quality hardware profile from host facts.
 *
 * **Example** (Detect from host facts)
 *
 * ```ts
 * import { QualityProfileDetectionInput } from "@beep/repo-cli/commands/Quality"
 * import { detectQualityProfileForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const profile = detectQualityProfileForTesting(
 *   QualityProfileDetectionInput.make({
 *     ci: false,
 *     cpuCount: 64,
 *     totalMemoryBytes: 128 * 1024 * 1024 * 1024
 *   })
 * )
 * console.log(profile.profile)
 * ```
 *
 * @param input - Host and CI facts used for profile detection.
 * @returns Detected quality profile with derived scheduling configuration.
 * @category configuration
 * @since 0.0.0
 */
export const detectQualityProfileForTesting = (input: QualityProfileDetectionInput): QualityProfileDetection => {
  const profile: QualityHardwareProfile = input.ci
    ? "ci"
    : input.cpuCount >= 32 && input.totalMemoryBytes >= 64 * 1024 * 1024 * 1024
      ? "workstation"
      : "current";

  return QualityProfileDetection.make({
    profile,
    cpuCount: input.cpuCount,
    memoryGiB: gibibytes(input.totalMemoryBytes),
    config: qualityProfileConfigForTesting(profile),
  });
};

/**
 * Detect the quality hardware profile from the current process environment.
 *
 * **Example** (Detect from environment)
 *
 * ```ts
 * import { detectQualityProfile } from "@beep/repo-cli/commands/Quality/Quality.plan"
 *
 * console.log(detectQualityProfile().profile)
 * ```
 *
 * @returns Detected quality profile with derived scheduling configuration.
 * @category configuration
 * @since 0.0.0
 */
export const detectQualityProfile = (): QualityProfileDetection =>
  detectQualityProfileForTesting(
    QualityProfileDetectionInput.make({
      ci: isCiSync(),
      cpuCount: NodeOS.cpus().length,
      totalMemoryBytes: NodeOS.totalmem(),
    })
  );

/**
 * Environment name of the Check and policy lint width override.
 *
 * **Example** (Read the override name)
 *
 * ```ts
 * import { QUALITY_CHECK_CONCURRENCY_ENV } from "@beep/repo-cli/test/Quality"
 *
 * console.log(QUALITY_CHECK_CONCURRENCY_ENV) // "BEEP_QUALITY_CHECK_CONCURRENCY"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const QUALITY_CHECK_CONCURRENCY_ENV = "BEEP_QUALITY_CHECK_CONCURRENCY";
/**
 * Environment name of the cheap-gate lane width override.
 *
 * **Example** (Read the override name)
 *
 * ```ts
 * import { QUALITY_CHEAP_GATE_CONCURRENCY_ENV } from "@beep/repo-cli/test/Quality"
 *
 * console.log(QUALITY_CHEAP_GATE_CONCURRENCY_ENV) // "BEEP_QUALITY_CHEAP_GATE_CONCURRENCY"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const QUALITY_CHEAP_GATE_CONCURRENCY_ENV = "BEEP_QUALITY_CHEAP_GATE_CONCURRENCY";

// Policy lint retains the hosted Check lane's accepted overrides and adds its own
// four-worker budget; this is the domain hosted runs keep decoding.
const HostedPolicyLintConcurrency = S.Literals([...QualityCheckConcurrency.literals, "4"]);
// Hosted cheap gates never run, but the `ci` plan keeps the pre-profile domain so a
// hosted-shaped environment resolves exactly as before.
const HostedCheapGateConcurrency = S.Literals(["1", "2", "3", "4"]);
const decodeHostedPolicyLintConcurrency = S.decodeUnknownOption(HostedPolicyLintConcurrency);
const decodeHostedCheapGateConcurrency = S.decodeUnknownOption(HostedCheapGateConcurrency);
const decodeLocalConcurrencyOverride = S.decodeUnknownOption(QualityLocalConcurrencyOverride);

type ConcurrencyOverrideOutcome = {
  readonly width: O.Option<number>;
  readonly note: O.Option<string>;
};

const noOverride: ConcurrencyOverrideOutcome = { width: O.none(), note: O.none() };

const overrideOutcome = (
  name: string,
  value: string | undefined,
  decode: (value: string) => O.Option<string>,
  domain: string,
  onMalformed: O.Option<number>
): ConcurrencyOverrideOutcome =>
  O.match(O.fromUndefinedOr(value), {
    onNone: () => noOverride,
    onSome: (raw) =>
      O.match(decode(raw), {
        onNone: () => ({
          width: onMalformed,
          note: O.some(
            `[quality] Invalid ${name}; expected ${domain}. Using ${O.getOrElse(onMalformed, () => 1)} lane.`
          ),
        }),
        onSome: (literal) => ({ width: O.some(Number(literal)), note: O.none() }),
      }),
  });

/**
 * Scale a profile width by the admission tokens other heavy runs hold.
 *
 * **Details**
 *
 * The width keeps the fraction of the host's token capacity other runs leave
 * free, rounded up and never below one; {@link resolveQualityConcurrencyPlan}
 * then floors the result at the `current` profile's width, so an idle host
 * runs the profile width and a fully leased host runs the pre-profile widths.
 *
 * **Example** (Half the capacity is leased elsewhere)
 *
 * ```ts
 * import { QualityAdmissionLoad } from "@beep/repo-cli/commands/Quality"
 * import { scaleQualityWidthByAdmission } from "@beep/repo-cli/test/Quality"
 *
 * console.log(scaleQualityWidthByAdmission(8, QualityAdmissionLoad.make({ activeTokens: 4, capacityTokens: 8 }))) // 4
 * ```
 *
 * @param width - Profile width before admission scaling.
 * @param load - Tokens other runs hold and the host capacity.
 * @returns The scaled width, at least one.
 * @category configuration
 * @since 0.0.0
 */
export const scaleQualityWidthByAdmission: {
  (width: number, load: QualityAdmissionLoad): number;
  (load: QualityAdmissionLoad): (width: number) => number;
} = dual(2, (width: number, load: QualityAdmissionLoad): number => {
  const capacity = Math.max(load.capacityTokens, load.activeTokens);
  if (capacity <= 0) return 1;
  const free = Math.max(0, capacity - load.activeTokens);
  return Math.max(1, Math.ceil((width * free) / capacity));
});

/**
 * Resolve the concurrency plan for a detected profile, environment and admission load.
 *
 * **Details**
 *
 * A `ci` detection yields the hosted widths verbatim: the policy lint override
 * keeps its hosted domain (2, 3 or 4) and admission load is ignored. A local
 * detection takes the profile widths, honours `BEEP_QUALITY_CHECK_CONCURRENCY`
 * for the policy lint phases and `BEEP_QUALITY_CHEAP_GATE_CONCURRENCY` for the
 * cheap-gate lanes over the one-to-sixteen local domain (a malformed value
 * warns in `notes` and clamps to one lane, as before), then scales every width
 * that no override pinned by the admission tokens other runs hold, never
 * below the `current` profile's width (the value every local run used before).
 *
 * **Example** (Workstation plan on an idle host)
 *
 * ```ts
 * import { QualityProfileDetectionInput } from "@beep/repo-cli/commands/Quality"
 * import { detectQualityProfileForTesting, resolveQualityConcurrencyPlan } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const detection = detectQualityProfileForTesting(
 *   QualityProfileDetectionInput.make({ ci: false, cpuCount: 64, totalMemoryBytes: 128 * 1024 ** 3 })
 * )
 * console.log(resolveQualityConcurrencyPlan(detection, {}, O.none()).rootTurbo) // 8
 * ```
 *
 * @param detection - Detected hardware profile.
 * @param env - Environment record holding the overrides.
 * @param admission - Admission tokens other runs hold, when the host was read.
 * @returns The resolved plan.
 * @category configuration
 * @since 0.0.0
 */
export const resolveQualityConcurrencyPlan: {
  (
    detection: QualityProfileDetection,
    env: Readonly<Record<string, string | undefined>>,
    admission: O.Option<QualityAdmissionLoad>
  ): QualityConcurrencyPlan;
  (
    env: Readonly<Record<string, string | undefined>>,
    admission: O.Option<QualityAdmissionLoad>
  ): (detection: QualityProfileDetection) => QualityConcurrencyPlan;
} = dual(
  3,
  (
    detection: QualityProfileDetection,
    env: Readonly<Record<string, string | undefined>>,
    admission: O.Option<QualityAdmissionLoad>
  ): QualityConcurrencyPlan => resolveQualityConcurrencyPlanInternal(detection, env, admission)
);

const resolveQualityConcurrencyPlanInternal = (
  detection: QualityProfileDetection,
  env: Readonly<Record<string, string | undefined>>,
  admission: O.Option<QualityAdmissionLoad>
): QualityConcurrencyPlan => {
  const config = detection.config;
  const hosted = QualityHardwareProfile.is.ci(config.profile);
  const policyLint = hosted
    ? overrideOutcome(
        QUALITY_CHECK_CONCURRENCY_ENV,
        env[QUALITY_CHECK_CONCURRENCY_ENV],
        decodeHostedPolicyLintConcurrency,
        "2, 3 or 4",
        O.none()
      )
    : overrideOutcome(
        QUALITY_CHECK_CONCURRENCY_ENV,
        env[QUALITY_CHECK_CONCURRENCY_ENV],
        decodeLocalConcurrencyOverride,
        "an integer from 1 to 16",
        O.none()
      );
  const cheapGates = hosted
    ? overrideOutcome(
        QUALITY_CHEAP_GATE_CONCURRENCY_ENV,
        env[QUALITY_CHEAP_GATE_CONCURRENCY_ENV],
        decodeHostedCheapGateConcurrency,
        "1, 2, 3 or 4",
        O.some(1)
      )
    : overrideOutcome(
        QUALITY_CHEAP_GATE_CONCURRENCY_ENV,
        env[QUALITY_CHEAP_GATE_CONCURRENCY_ENV],
        decodeLocalConcurrencyOverride,
        "an integer from 1 to 16",
        O.some(1)
      );
  // Admission tokens measure memory contention between heavy proofs; a saturated
  // host degrades a wide profile to the `current` widths every local run used
  // before concurrency was profile-derived, never below them.
  const floor = qualityProfileConfigForTesting(QualityHardwareProfile.Enum.current);
  const scale = (width: number, floorWidth: number): number =>
    hosted
      ? width
      : O.match(admission, {
          onNone: () => width,
          onSome: (load) => Math.max(Math.min(width, floorWidth), scaleQualityWidthByAdmission(width, load)),
        });
  const admissionNote = pipe(
    admission,
    O.filter(() => !hosted),
    O.filter((load) => load.activeTokens > 0),
    O.map(
      (load) =>
        `[quality] admission: ${load.activeTokens}/${load.capacityTokens} tokens held by other runs; local widths scaled.`
    )
  );
  return QualityConcurrencyPlan.make({
    profile: config.profile,
    rootTurbo: scale(config.turboConcurrency, floor.turboConcurrency),
    policyLint: O.getOrElse(policyLint.width, () => scale(config.policyLintConcurrency, floor.policyLintConcurrency)),
    cheapGates: O.getOrElse(cheapGates.width, () => scale(config.cheapGateConcurrency, floor.cheapGateConcurrency)),
    prePushLanes: scale(config.prePushLaneConcurrency, floor.prePushLaneConcurrency),
    oxlintThreads: scale(config.oxlintThreads, floor.oxlintThreads),
    admission: hosted ? O.none() : admission,
    notes: A.getSomes([policyLint.note, cheapGates.note, admissionNote]),
  });
};

/**
 * Resolve the concurrency plan from the live environment without reading admission state.
 *
 * **Details**
 *
 * Synchronous planners (root Turbo args, policy lint phases, tier widths)
 * default to this plan; the effectful {@link QualityConcurrency} service
 * supplies the admission-scaled plan where a runner can provide it. Malformed
 * override notes are printed once per call, as the previous readers did.
 *
 * **Example** (Read the live local plan)
 *
 * ```ts
 * import { localQualityConcurrencyPlan } from "@beep/repo-cli/test/Quality"
 *
 * console.log(localQualityConcurrencyPlan().rootTurbo > 0) // true
 * ```
 *
 * @returns The plan the live environment resolves to.
 * @category configuration
 * @since 0.0.0
 */
export const localQualityConcurrencyPlan = (): QualityConcurrencyPlan => {
  const plan = resolveQualityConcurrencyPlan(detectQualityProfile(), Bun.env, O.none());
  for (const note of plan.notes) {
    Effect.runSync(Console.warn(note));
  }
  return plan;
};

/**
 * Fold an admission snapshot into the load other runs put on the host.
 *
 * **Details**
 *
 * Leases whose pid is in `ownPids` (this process and its ancestors, so the
 * proof that admitted this lane) do not count against the width.
 *
 * **Example** (Exclude this run's own lease)
 *
 * ```ts
 * import { qualityAdmissionLoadOf } from "@beep/repo-cli/test/Quality"
 * import * as HashSet from "effect/HashSet"
 *
 * const snapshot = {
 *   capacityTokens: 8,
 *   leases: [
 *     { pid: 10, weightTokens: 3 },
 *     { pid: 20, weightTokens: 3 }
 *   ]
 * }
 * console.log(qualityAdmissionLoadOf(snapshot, HashSet.make(10)).activeTokens) // 3
 * ```
 *
 * @param snapshot - Lease pids, lease weights and the host capacity.
 * @param ownPids - Pids of this process and its ancestors.
 * @returns Tokens other runs hold and the host capacity.
 * @category configuration
 * @since 0.0.0
 */
export const qualityAdmissionLoadOf: {
  (snapshot: QualityAdmissionSnapshotView, ownPids: HashSet.HashSet<number>): QualityAdmissionLoad;
  (ownPids: HashSet.HashSet<number>): (snapshot: QualityAdmissionSnapshotView) => QualityAdmissionLoad;
} = dual(
  2,
  (snapshot: QualityAdmissionSnapshotView, ownPids: HashSet.HashSet<number>): QualityAdmissionLoad =>
    QualityAdmissionLoad.make({
      activeTokens: A.reduce(snapshot.leases, 0, (total, lease) =>
        HashSet.has(ownPids, lease.pid) ? total : total + lease.weightTokens
      ),
      capacityTokens: snapshot.capacityTokens,
    })
);

/**
 * Resolve the admission-aware plan from the live host.
 *
 * **Example** (Build the resolver effect)
 *
 * ```ts
 * import { resolveLiveQualityConcurrencyPlan } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveLiveQualityConcurrencyPlan())) // true
 * ```
 *
 * @returns The plan, with every note already printed.
 * @category configuration
 * @since 0.0.0
 */
export const resolveLiveQualityConcurrencyPlan = Effect.fn("QualityPlan.resolveLiveQualityConcurrencyPlan")(
  function* (): Effect.fn.Return<
    QualityConcurrencyPlan,
    never,
    | SecureRandom.SecureRandom
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
    | Digest.Digest
  > {
    const detection = detectQualityProfile();
    // Admission is read only off CI and only where the entry point provided
    // MemoryStats (every `beep` command group that declares `memory-stats`, and
    // the root quality-task route); elsewhere the plan stays unscaled.
    const stats = yield* Effect.serviceOption(MemoryStats);
    const admission = QualityHardwareProfile.is.ci(detection.profile)
      ? O.none<QualityAdmissionLoad>()
      : yield* O.match(stats, {
          onNone: () => Effect.succeedNone,
          onSome: (memoryStats) =>
            Effect.asSome(admissionStatus()).pipe(
              Effect.provideService(MemoryStats, memoryStats),
              Effect.catch((error) =>
                Effect.as(
                  Console.warn(
                    `[quality] admission snapshot unavailable (${Str.trim(String(error.message))}); local widths unscaled.`
                  ),
                  O.none<AdmissionSnapshot>()
                )
              ),
              Effect.flatMap(
                O.match({
                  onNone: () => Effect.succeedNone,
                  onSome: (snapshot) =>
                    Effect.map(invokerAncestryPids(), (ownPids) => O.some(qualityAdmissionLoadOf(snapshot, ownPids))),
                })
              )
            ),
        });
    const plan = resolveQualityConcurrencyPlan(detection, Bun.env, admission);
    yield* Effect.forEach(plan.notes, Console.warn, { discard: true });
    return plan;
  }
);

/**
 * Resolved local concurrency plan for the running quality command.
 *
 * **Details**
 *
 * {@link liveQualityConcurrency} resolves the plan once per command: it
 * detects the hardware profile, reads the environment overrides and, off CI,
 * snapshots the machine-wide admission state so the width leaves room for the
 * heavy runs other sessions hold. Leases owned by this process or one of its
 * ancestors (the proof that admitted this lane) do not count against it. A
 * snapshot that cannot be read falls back to the unscaled local plan with a
 * note.
 *
 * **Example** (Provide a fixed plan)
 *
 * ```ts
 * import { QualityConcurrencyPlan } from "@beep/repo-cli/commands/Quality"
 * import { QualityConcurrency } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const plan = QualityConcurrencyPlan.make({
 *   profile: "current", rootTurbo: 3, policyLint: 4, cheapGates: 4, prePushLanes: 1, oxlintThreads: 4, notes: []
 * })
 * console.log(Effect.isEffect(QualityConcurrency.make(plan))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class QualityConcurrency extends Context.Service<
  QualityConcurrency,
  { readonly plan: QualityConcurrencyPlan }
>()($I`QualityConcurrency`, {
  make: (plan: QualityConcurrencyPlan): Effect.Effect<{ readonly plan: QualityConcurrencyPlan }> =>
    Effect.succeed({ plan }),
}) {}

/**
 * The admission-aware {@link QualityConcurrency} service read once from the live host.
 *
 * **Example** (Build the service effect)
 *
 * ```ts
 * import { liveQualityConcurrency } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(liveQualityConcurrency)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const liveQualityConcurrency: Effect.Effect<
  { readonly plan: QualityConcurrencyPlan },
  never,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> = Effect.flatMap(resolveLiveQualityConcurrencyPlan(), QualityConcurrency.make);

/**
 * Run an effect under the live {@link QualityConcurrency} service.
 *
 * **Example** (Provide the live plan to a program)
 *
 * ```ts
 * import { provideQualityConcurrency, qualityConcurrencyPlan } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(provideQualityConcurrency(qualityConcurrencyPlan))) // true
 * ```
 *
 * @param self - The program that reads {@link qualityConcurrencyPlan}.
 * @returns The program with the service resolved from the live host.
 * @category services
 * @since 0.0.0
 */
export const provideQualityConcurrency = <A, E, R>(
  self: Effect.Effect<A, E, R>
): Effect.Effect<
  A,
  E,
  | Exclude<R, QualityConcurrency>
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> => Effect.provideServiceEffect(self, QualityConcurrency, liveQualityConcurrency);

/**
 * The plan the current fiber runs under: the provided {@link QualityConcurrency}
 * service, or the unscaled local plan when none was provided.
 *
 * **Example** (Read the plan without a service)
 *
 * ```ts
 * import { qualityConcurrencyPlan } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(qualityConcurrencyPlan).rootTurbo > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const qualityConcurrencyPlan: Effect.Effect<QualityConcurrencyPlan> = Effect.map(
  Effect.serviceOption(QualityConcurrency),
  O.match({ onNone: localQualityConcurrencyPlan, onSome: (service) => service.plan })
);

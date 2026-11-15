/**
 * Schemas for the machine-wide weighted admission scheduler (ship-velocity D1).
 *
 * One admission token approximates 5 GiB of schedulable memory. Heavy repo
 * work (full proofs, merged previews, review-fix loops) holds a lease worth
 * its token weight; contenders wait in a durable on-disk queue instead of
 * failing fast. Evidence and policy: `goals/ship-velocity/SPEC.md` D1 and
 * `goals/ship-velocity/research/c5-concurrency-policy.md`.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { ScopedPackageName } from "@beep/package-json/PackageName";
import { PressureStats } from "@beep/palantiri/HostPressure.models";
import { OpaqueDefect } from "@beep/repo-cli-kit/schema/OpaqueDefect";
import { UUID } from "@beep/repo-cli-kit/schema/Uuid";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { ComputeProfile } from "./ComputeProfile.schemas.ts";
import { GateRouteId } from "./GateRoute.schemas.ts";
import { RunScopeRecord } from "./RunScope.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/QualityScheduler.schemas");

/**
 * Kind of heavy repository work admitted through the machine-wide scheduler.
 *
 * **Details**
 *
 * `cache` is the work `beep cache` admits: dependency materialization, the
 * pilot, signed-pilot and protocol experiments, and producer workflow
 * verification. Before SCHE-08 those commands requested `review-fix`; a ticket
 * records `cache` only while the admission protocol's `units` gate is on,
 * because a reader older than SCHE-08 quarantines a kind it does not know.
 *
 * **Example** (Match on an admission kind)
 *
 * ```ts
 * import { AdmissionWorkKind } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionWorkKind.is["full-proof"]("full-proof")) // true
 * console.log(AdmissionWorkKind.is.cache("cache")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionWorkKind = LiteralKit(["full-proof", "merged-preview", "review-fix", "publish", "cache"]).pipe(
  $I.annoteSchema("AdmissionWorkKind", {
    description: "Class of heavyweight repository work admitted through the machine-wide scheduler.",
  })
);

/**
 * Class of heavyweight repository work admitted through the scheduler.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionWorkKind = typeof AdmissionWorkKind.Type;

const isKnownAdmissionWorkKind = S.is(AdmissionWorkKind);

/**
 * A work kind this revision does not know, kept verbatim from a newer writer.
 *
 * **Details**
 *
 * Every checkout on the host shares one set of tickets, leases and journal
 * rows, so a newer checkout may admit a kind this one has never seen. Reading
 * it as an unrecognized kind keeps the record decodable: the lease stays
 * charged by its `weightTokens` and sits outside the review-fix class cap,
 * where a closed literal would quarantine the whole file and drop its tokens
 * from capacity. A known kind never decodes as unrecognized.
 *
 * **Example** (Recognize a kind from a newer writer)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UnrecognizedAdmissionWorkKind } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(S.is(UnrecognizedAdmissionWorkKind)("cache-qualification")) // true
 * console.log(S.is(UnrecognizedAdmissionWorkKind)("full-proof")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnrecognizedAdmissionWorkKind = S.NonEmptyString.check(
  S.makeFilter(
    (kind: string) => !isKnownAdmissionWorkKind(kind),
    $I.annote("UnrecognizedAdmissionWorkKindCheck", {
      title: "Unrecognized admission work kind",
      description: "The kind is not one of this revision's admission work kinds.",
    })
  )
).pipe(
  S.brand("UnrecognizedAdmissionWorkKind"),
  $I.annoteSchema("UnrecognizedAdmissionWorkKind", {
    description: "An admission work kind written by a newer revision and kept verbatim.",
  })
);

/**
 * An admission work kind written by a newer revision and kept verbatim.
 *
 * @category models
 * @since 0.0.0
 */
export type UnrecognizedAdmissionWorkKind = typeof UnrecognizedAdmissionWorkKind.Type;

/**
 * Work kind as recorded on a ticket, lease or journal row: known or unrecognized.
 *
 * **Details**
 *
 * This is the tolerant reader for the persisted `kind` field. Callers still
 * request one of the known {@link AdmissionWorkKind} literals; only records
 * read back from the shared admission root may carry an
 * {@link UnrecognizedAdmissionWorkKind}.
 *
 * **Example** (Decode a known and a newer kind)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { RecordedAdmissionWorkKind } from "@beep/repo-cli/test/RepoRun"
 *
 * const decode = S.decodeUnknownOption(RecordedAdmissionWorkKind)
 * console.log(O.isSome(decode("review-fix"))) // true
 * console.log(O.isSome(decode("cache-qualification"))) // true
 * console.log(O.isSome(decode(""))) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RecordedAdmissionWorkKind = S.Union([AdmissionWorkKind, UnrecognizedAdmissionWorkKind]).pipe(
  $I.annoteSchema("RecordedAdmissionWorkKind", {
    description: "Admission work kind recorded in shared scheduler state: a known kind or one from a newer writer.",
  })
);

/**
 * Admission work kind recorded in shared scheduler state.
 *
 * @category models
 * @since 0.0.0
 */
export type RecordedAdmissionWorkKind = typeof RecordedAdmissionWorkKind.Type;

/**
 * Queue ordering class for one admission request.
 *
 * Publish-priority tickets order ahead of verify tickets because a publish's
 * final proof unlocks push and hosted feedback; a verify ticket ages up to
 * publish priority after the configured aging window so nothing starves.
 *
 * **Example** (Inspect priority options)
 *
 * ```ts
 * import { AdmissionPriority } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionPriority.literals.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionPriority = LiteralKit(["publish", "verify"]).pipe(
  $I.annoteSchema("AdmissionPriority", {
    description: "Queue ordering class for one admission request.",
  })
);

/**
 * Queue ordering class for one admission request.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionPriority = typeof AdmissionPriority.Type;

/**
 * Origin-coordination protocol understood by one scheduler ticket or lease.
 *
 * **Details**
 *
 * Newly constructed tickets and leases default to `scheduler-origin-concurrency/v1`.
 * Decoding a persisted record without the additive field defaults to
 * `legacy-origin-lock/v1`, so prior-version state drains before migration.
 *
 * **Example** (Detect current scheduler coordination)
 *
 * ```ts
 * import { AdmissionCoordinationProtocol } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(
 *   AdmissionCoordinationProtocol.is["scheduler-origin-concurrency/v1"]("scheduler-origin-concurrency/v1")
 * ) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionCoordinationProtocol = LiteralKit([
  "legacy-origin-lock/v1",
  "scheduler-origin-concurrency/v1",
]).pipe(
  $I.annoteSchema("AdmissionCoordinationProtocol", {
    description: "Mixed-version coordination protocol used by one scheduler ticket or lease.",
  })
);

/**
 * Mixed-version coordination protocol used by one scheduler ticket or lease.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionCoordinationProtocol = typeof AdmissionCoordinationProtocol.Type;

/**
 * Yeet local proof tier carried by attempt and admission facts.
 *
 * **Example** (Recognize a review-fix tier)
 *
 * ```ts
 * import { YeetProofTier } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(YeetProofTier.is["review-fix"]("review-fix")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetProofTier = LiteralKit(["full", "cheap-gates", "review-fix"]).pipe(
  $I.annoteSchema("YeetProofTier", {
    description: "Local proof tier selected for a Yeet verification attempt.",
  })
);

/**
 * Local proof tier selected for a Yeet verification attempt.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetProofTier = typeof YeetProofTier.Type;

/**
 * Environment posture carried by attempt and admission facts.
 *
 * **Example** (Recognize PR posture)
 *
 * ```ts
 * import { ProofEnvProfile } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProofEnvProfile.is["pr-posture"]("pr-posture")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofEnvProfile = LiteralKit(["local", "pr-posture", "hosted"]).pipe(
  $I.annoteSchema("ProofEnvProfile", {
    description: "Environment posture a lane executed under: local workstation, PR posture, or hosted CI.",
  })
);

/**
 * Environment posture carried by attempt and admission facts.
 *
 * @category models
 * @since 0.0.0
 */
export type ProofEnvProfile = typeof ProofEnvProfile.Type;

/**
 * Verification stage carried by attempt and admission facts.
 *
 * **Example** (Recognize the pre-push stage)
 *
 * ```ts
 * import { ProofStage } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProofStage.is["pre-push"]("pre-push")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofStage = LiteralKit(["repair-loop", "pre-push", "merged-preview", "hosted"]).pipe(
  $I.annoteSchema("ProofStage", {
    description: "Verification stage that produced an attempt fact.",
  })
);

/**
 * Verification stage that produced an attempt fact.
 *
 * @category models
 * @since 0.0.0
 */
export type ProofStage = typeof ProofStage.Type;

/**
 * Shared schema fields for immutable facts recorded at attempt start.
 *
 * **Details**
 *
 * `computeProfile` sits beside `envProfile`: the posture says how the proof
 * ran, the compute profile says which memory class ran it. Rows written before
 * the field existed decode it as `None`.
 *
 * **Example** (Reuse the fact field group)
 *
 * ```ts
 * import { attemptInputFactFields } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log("resolvedHeadSha" in attemptInputFactFields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const attemptInputFactFields = {
  resolvedHeadSha: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  diffFingerprint: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  proofTier: YeetProofTier.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  envProfile: ProofEnvProfile.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  computeProfile: ComputeProfile.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  stage: ProofStage.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
};

/**
 * Token weight for each admission kind, in 5 GiB token units (SPEC D1).
 *
 * The publish weight covers only the post-proof mutation phase; a publish's
 * embedded full proof is requested as `full-proof` with publish priority, so
 * no caller requests the `publish` kind yet (reserved with `hotPaths` for the
 * chartered follow-ups; see goals/ship-velocity/research/d1-admission-scheduler.md).
 * The `cache` weight is the review-fix weight Cache commands paid while they
 * borrowed that kind.
 *
 * **Example** (Read the full-proof and cache weights)
 *
 * ```ts
 * import { admissionTokenWeight } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(admissionTokenWeight("full-proof")) // 3
 * console.log(admissionTokenWeight("cache")) // 1
 * ```
 *
 * @param kind - Admission work kind to weigh.
 * @returns The token weight charged while a lease of this kind is held.
 * @category models
 * @since 0.0.0
 */
export const admissionTokenWeight = (kind: AdmissionWorkKind): number =>
  AdmissionWorkKind.match(kind, {
    "full-proof": () => 3,
    "merged-preview": () => 5,
    "review-fix": () => 1,
    publish: () => 1,
    cache: () => 1,
  });

const admissionOwnerFields = {
  attemptId: UUID.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  ...attemptInputFactFields,
  pid: S.Finite,
  procStart: S.String,
  kind: RecordedAdmissionWorkKind,
  weightTokens: S.Finite,
  priority: AdmissionPriority,
  originKey: S.String,
  checkoutRoot: S.String,
  branch: S.String,
  coordinationProtocol: AdmissionCoordinationProtocol.pipe(
    S.withConstructorDefault(Effect.succeed(AdmissionCoordinationProtocol.Enum["scheduler-origin-concurrency/v1"])),
    S.withDecodingDefaultKey(Effect.succeed(AdmissionCoordinationProtocol.Enum["legacy-origin-lock/v1"]))
  ),
  forceLocal: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)),
    S.withDecodingDefaultKey(Effect.succeed(false))
  ),
};

/**
 * The work one admission charges for: a whole tier, one lane or one package task.
 *
 * **Details**
 *
 * `tier` is the whole work kind as one unit, the grain every admission has
 * today. `lane` is one gate family ({@link GateRouteId}). `package` is one
 * Turbo task of one (scoped) workspace package; its Turbo task id is
 * `<packageName>#<task>`. A record written before units existed carries no
 * unit and reads as a whole tier.
 *
 * **Example** (Build a package unit)
 *
 * ```ts
 * import { ScopedPackageName } from "@beep/package-json/PackageName"
 * import { AdmissionUnit } from "@beep/repo-cli/test/RepoRun"
 *
 * const unit = AdmissionUnit.cases.package.make({ packageName: ScopedPackageName.make("@beep/repo-cli"), task: "test" })
 * console.log(AdmissionUnit.guards.package(unit)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionUnit = S.TaggedUnion({
  tier: {},
  lane: { lane: GateRouteId },
  package: { packageName: ScopedPackageName, task: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("AdmissionUnit", {
    description: "The work one admission charges for: a whole tier, one gate-family lane, or one package Turbo task.",
  })
);

/**
 * The work one admission charges for.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionUnit = typeof AdmissionUnit.Type;

/**
 * Where an admission's token weight came from.
 *
 * **Details**
 *
 * `static-seed` is the per-kind table ({@link admissionTokenWeight}), which
 * the scheduler may still clamp to the machine ceiling. `measured` is a weight
 * calibrated from `sampleCount` observed memory envelopes.
 * `conservative-fallback` is a conservative bound used when no qualifying
 * measurement exists. A record written before weight sources existed carries
 * none and reads as the static seed.
 *
 * **Example** (Recognize a measured weight)
 *
 * ```ts
 * import { AdmissionWeightSource } from "@beep/repo-cli/test/RepoRun"
 *
 * const source = AdmissionWeightSource.cases.measured.make({ sampleCount: 14 })
 * console.log(AdmissionWeightSource.guards.measured(source)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionWeightSource = S.TaggedUnion({
  "static-seed": {},
  measured: { sampleCount: S.Int.check(S.isGreaterThan(0)) },
  "conservative-fallback": {},
}).pipe(
  $I.annoteSchema("AdmissionWeightSource", {
    description:
      "Where an admission's token weight came from: the static seed, a measurement, or a conservative bound.",
  })
);

/**
 * Where an admission's token weight came from.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionWeightSource = typeof AdmissionWeightSource.Type;

/**
 * The proof that owns an admitted unit.
 *
 * **Details**
 *
 * `proofNonce` names the proof the unit belongs to; for a whole-tier unit it
 * is the record's own nonce. The owner carries the attribution a journal row
 * needs on its own (checkout, branch, origin, command, attempt), so a row can
 * be attributed after the checkout's attempt journal is gone.
 *
 * **Example** (Construct an owner)
 *
 * ```ts
 * import { AdmissionOwner } from "@beep/repo-cli/test/RepoRun"
 *
 * const owner = AdmissionOwner.make({
 *   proofNonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206",
 *   pid: 1234,
 *   procStart: "8241991",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet verify"
 * })
 * console.log(owner.branch) // "feat/x"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionOwner extends S.Opaque<AdmissionOwner, { readonly brand: unique symbol }>()(
  S.Struct({
    proofNonce: S.String,
    ...Struct.pick(admissionOwnerFields, ["attemptId", "pid", "procStart", "originKey", "checkoutRoot", "branch"]),
    command: S.String,
  }).pipe(
    $I.annoteSchema("AdmissionOwner", {
      description: "The proof that owns an admitted unit, with the attribution a journal row needs on its own.",
    })
  )
) {}

/**
 * Encoded form of {@link AdmissionOwner}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AdmissionOwner {
  /**
   * Encoded form of {@link AdmissionOwner}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof AdmissionOwner.Encoded;
}

// A present value this revision cannot read (a newer unit variant, weight
// source or owner shape) is dropped to None instead of failing the record.
const unrecognizedAsNone = () => Effect.succeedSome(O.none());

/**
 * Admission-unit fields carried by tickets, leases and journal rows (SCHE-08).
 *
 * **Details**
 *
 * Each field is an optional key read as an `Option`. A record from before
 * these fields existed reads `None` for all three: a whole-tier unit, the
 * static-seed weight, and the record's own process as owner. A present value
 * this revision cannot decode also reads `None`, so the record stays live and
 * charged. Writers emit the keys only when the admission protocol's `units`
 * gate is on; with it off every record is byte-identical to the pre-unit
 * format.
 *
 * **Example** (Reuse the unit field group)
 *
 * ```ts
 * import { admissionUnitFields } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(Object.keys(admissionUnitFields)) // ["unit", "weightSource", "owner"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const admissionUnitFields = {
  unit: AdmissionUnit.pipe(
    S.OptionFromOptionalKey,
    S.catchDecoding(unrecognizedAsNone),
    S.withConstructorDefault(Effect.succeedNone)
  ),
  weightSource: AdmissionWeightSource.pipe(
    S.OptionFromOptionalKey,
    S.catchDecoding(unrecognizedAsNone),
    S.withConstructorDefault(Effect.succeedNone)
  ),
  owner: AdmissionOwner.pipe(
    S.OptionFromOptionalKey,
    S.catchDecoding(unrecognizedAsNone),
    S.withConstructorDefault(Effect.succeedNone)
  ),
};

// A pressure stall share in percent, as the host-pressure parcel decodes it.
const PressureSome10 = PressureStats.fields.avg10.pipe(
  S.OptionFromOptionalKey,
  S.withConstructorDefault(Effect.succeedNone)
);

/**
 * The scheduler's capacity and the host's pressure at one admission transition (SCHE-09 slice 2).
 *
 * **Details**
 *
 * An admitted row's stamp is taken where the admission was checked against
 * capacity: `capacityTokens` is the capacity it was checked against,
 * `activeTokens` the weight of every live lease at that check (its own
 * included), and `queuedTokens` and `queuedTickets` the other tickets still
 * waiting. A released row's stamp is read just before the release is
 * journaled, while the lease still counts as active. `memAvailableGib` is the
 * `MemoryStats` reading the capacity came from, rounded to 0.001 GiB.
 *
 * The `psi*Some10` fields are the `some avg10` share (percent of the last 10
 * seconds with some task stalled) of `/proc/pressure/{cpu,memory,io}`, absent
 * on a host without pressure stall information. `unadmittedSliceGib` is
 * `agent-runs.slice` `memory.current` minus the `memory.current` of every
 * live lease's cgroup in the slice: memory the slice holds for work no lease
 * accounts for. It is absent when the writer does not run inside the slice
 * (run scopes off or unsupported), when a lease owner's cgroup membership
 * cannot be read, or when a cgroup file cannot be read, so it is never a sum
 * over only some of the leases.
 *
 * Each admission and release reads the protocol's `pressure` gate when it
 * samples, so turning the gate off or on applies to requests already queued
 * or running. The stamp is telemetry: no admission decision reads it.
 *
 * **Example** (Stamp an admission on a host without pressure files)
 *
 * ```ts
 * import { AdmissionPressureStamp } from "@beep/repo-cli/test/RepoRun"
 *
 * const stamp = AdmissionPressureStamp.make({
 *   capacityTokens: 8,
 *   activeTokens: 3,
 *   queuedTokens: 0,
 *   queuedTickets: 0,
 *   memAvailableGib: 50
 * })
 * console.log(stamp.activeTokens) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionPressureStamp extends S.Opaque<AdmissionPressureStamp, { readonly brand: unique symbol }>()(
  S.Struct({
    // The same scalar types as the scheduler's snapshot: a stamp never refuses what the scan read.
    capacityTokens: S.Finite,
    activeTokens: S.Finite,
    queuedTokens: S.Finite,
    queuedTickets: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    memAvailableGib: S.Finite,
    psiCpuSome10: PressureSome10,
    psiMemorySome10: PressureSome10,
    psiIoSome10: PressureSome10,
    unadmittedSliceGib: S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
  }).pipe(
    $I.annoteSchema("AdmissionPressureStamp", {
      description:
        "Scheduler capacity, active and queued tokens, MemAvailable, PSI some avg10 and unadmitted slice memory at one admission transition.",
    })
  )
) {}

/**
 * Encoded form of {@link AdmissionPressureStamp}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AdmissionPressureStamp {
  /**
   * Encoded form of {@link AdmissionPressureStamp}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof AdmissionPressureStamp.Encoded;
}

/**
 * Pressure-stamp field carried by promotion transitions and the admitted and released journal rows.
 *
 * **Details**
 *
 * `pressure` is an optional key read as an `Option`, written only when the
 * admission protocol's `pressure` gate is on at the moment the transition
 * samples (read afresh at each admission and release); with it off every record is
 * byte-identical to the format before the stamp. A row without the key, or
 * with a stamp shape this revision cannot decode, reads `None`, and the row
 * itself still decodes. Readers older than the stamp ignore the key, and a
 * locked journal rewrite keeps every row's bytes, so the key survives them.
 *
 * **Example** (Reuse the stamp field group)
 *
 * ```ts
 * import { admissionPressureFields } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(Object.keys(admissionPressureFields)) // ["pressure"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const admissionPressureFields = {
  pressure: AdmissionPressureStamp.pipe(
    S.OptionFromOptionalKey,
    S.catchDecoding(unrecognizedAsNone),
    S.withConstructorDefault(Effect.succeedNone)
  ),
};

/**
 * One active admission lease: heavy work currently charged against capacity.
 *
 * `pid` plus `procStart` (procfs on Linux, otherwise a prefixed platform
 * process-start representation) identify the owner across pid reuse; leases
 * are reaped only when the pid is dead or the recorded identity no longer
 * matches. The lease retains the originating
 * ticket identity (`nonce`) and queue instant (`enqueuedAtMillis`); legacy
 * lease files decode those fields with `""` and `0` sentinels. The unit,
 * weight source and owner ({@link admissionUnitFields}) are optional keys, and
 * `kind` reads a newer writer's kind as unrecognized instead of failing.
 *
 * **Example** (Construct a lease value)
 *
 * ```ts
 * import { YeetAdmissionLease } from "@beep/repo-cli/test/RepoRun"
 *
 * const lease = YeetAdmissionLease.make({
 *   schemaVersion: "yeet-admission-lease/v1",
 *   pid: 1234,
 *   procStart: "8241991",
 *   kind: "full-proof",
 *   weightTokens: 3,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet verify",
 *   startedAt: "2026-08-27T14:00:00Z",
 *   admittedAtMillis: 0,
 *   heartbeatAtMillis: 0,
 *   enqueuedAtMillis: 0,
 *   nonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206"
 * })
 * console.log(lease.weightTokens) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAdmissionLease extends S.Opaque<YeetAdmissionLease, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("yeet-admission-lease/v1"),
    ...admissionOwnerFields,
    command: S.String,
    startedAt: S.String,
    admittedAtMillis: S.Finite,
    heartbeatAtMillis: S.Finite,
    enqueuedAtMillis: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    nonce: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),
    hotPaths: ArrayKeyDefaultEmpty(S.String),
    runScope: S.optionalKey(RunScopeRecord),
    ...admissionUnitFields,
  }).pipe(
    $I.annoteSchema("YeetAdmissionLease", {
      description: "One machine-wide admission lease charging heavy repository work against memory capacity.",
    })
  )
) {}

/**
 * Encoded form of {@link YeetAdmissionLease}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace YeetAdmissionLease {
  /**
   * Encoded form of {@link YeetAdmissionLease}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof YeetAdmissionLease.Encoded;
}

/**
 * One durable queue ticket: a contender waiting for admission.
 *
 * **Details**
 *
 * The unit, weight source and owner ({@link admissionUnitFields}) are optional
 * keys written only behind the admission protocol's `units` gate; the lease
 * and journal rows copy them from the ticket.
 *
 * **Example** (Construct a ticket value)
 *
 * ```ts
 * import { YeetAdmissionTicket } from "@beep/repo-cli/test/RepoRun"
 *
 * const ticket = YeetAdmissionTicket.make({
 *   schemaVersion: "yeet-admission-ticket/v1",
 *   pid: 1234,
 *   procStart: "8241991",
 *   kind: "review-fix",
 *   weightTokens: 1,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   enqueuedAtMillis: 0,
 *   heartbeatAtMillis: 0,
 *   nonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206"
 * })
 * console.log(ticket.kind) // "review-fix"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAdmissionTicket extends S.Opaque<YeetAdmissionTicket, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("yeet-admission-ticket/v1"),
    ...admissionOwnerFields,
    enqueuedAtMillis: S.Finite,
    heartbeatAtMillis: S.Finite,
    blockedOnOriginAtMillis: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultKey(Effect.succeed(0))
    ),
    nonce: S.String,
    ...admissionUnitFields,
  }).pipe(
    $I.annoteSchema("YeetAdmissionTicket", {
      description: "One durable admission-queue ticket owned by a waiting contender process.",
    })
  )
) {}

/**
 * Encoded form of {@link YeetAdmissionTicket}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace YeetAdmissionTicket {
  /**
   * Encoded form of {@link YeetAdmissionTicket}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof YeetAdmissionTicket.Encoded;
}

/**
 * Durable acknowledgement state for one admission-reap output sink.
 *
 * **Example** (Recognize a protocol-deferred sink)
 *
 * ```ts
 * import { AdmissionClaimSinkState } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionClaimSinkState.is["pending-protocol-off"]("pending-protocol-off")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionClaimSinkState = LiteralKit(["pending", "pending-protocol-off", "complete"]).pipe(
  $I.annoteSchema("AdmissionClaimSinkState", {
    description: "Durable acknowledgement state for one admission-reap output sink.",
  })
);

/**
 * Durable acknowledgement state for one admission-reap output sink.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionClaimSinkState = typeof AdmissionClaimSinkState.Type;

const admissionReapClaimFields = {
  schemaVersion: S.tag("yeet-admission-reap-claim/v1"),
  sourcePath: S.String,
  nonce: S.String,
  claimedAtMillis: S.Finite,
  attemptJournal: AdmissionClaimSinkState,
  admissionJournal: AdmissionClaimSinkState,
};

/**
 * Recoverable outbox for one dead admission lease lifecycle.
 *
 * **Example** (Construct a lease reap claim)
 *
 * ```ts
 * import { AdmissionLeaseReapClaim, YeetAdmissionLease } from "@beep/repo-cli/test/RepoRun"
 *
 * const lease = YeetAdmissionLease.make({
 *   schemaVersion: "yeet-admission-lease/v1",
 *   pid: 1234,
 *   procStart: "8241991",
 *   kind: "full-proof",
 *   weightTokens: 3,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet verify",
 *   startedAt: "2026-09-03T14:00:00Z",
 *   admittedAtMillis: 1,
 *   heartbeatAtMillis: 1,
 *   enqueuedAtMillis: 0,
 *   nonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206"
 * })
 * const claim = AdmissionLeaseReapClaim.make({
 *   schemaVersion: "yeet-admission-reap-claim/v1",
 *   _tag: "lease",
 *   sourcePath: "/runtime/lease.json",
 *   nonce: lease.nonce,
 *   claimedAtMillis: 2,
 *   attemptJournal: "pending",
 *   admissionJournal: "pending",
 *   lease
 * })
 * console.log(claim._tag) // "lease"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export class AdmissionLeaseReapClaim extends S.Opaque<AdmissionLeaseReapClaim, { readonly brand: unique symbol }>()(
  S.TaggedStruct("lease", {
    ...admissionReapClaimFields,

    lease: YeetAdmissionLease,
  }).pipe(
    $I.annoteSchema("AdmissionLeaseReapClaim", {
      description: "Recoverable per-sink outbox for one verified dead admission lease.",
    })
  )
) {}

/**
 * Recoverable outbox for one dead admission queue-ticket lifecycle.
 *
 * **Example** (Reference the ticket claim class)
 *
 * ```ts
 * import { AdmissionTicketReapClaim } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionTicketReapClaim) // "function"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export class AdmissionTicketReapClaim extends S.Opaque<AdmissionTicketReapClaim, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ticket", {
    ...admissionReapClaimFields,

    ticket: YeetAdmissionTicket,
  }).pipe(
    $I.annoteSchema("AdmissionTicketReapClaim", {
      description: "Recoverable per-sink outbox for one verified dead admission queue ticket.",
    })
  )
) {}

/**
 * Recoverable outbox for one claimed dead admission lifecycle.
 *
 * **Example** (Recognize a lease claim)
 *
 * ```ts
 * import { AdmissionReapClaim } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionReapClaim.guards.lease) // "function"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export const AdmissionReapClaim = S.Union([AdmissionLeaseReapClaim, AdmissionTicketReapClaim]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AdmissionReapClaim", {
    description: "Recoverable per-sink outbox for one claimed dead admission lifecycle.",
  })
);

/**
 * Recoverable outbox for one claimed dead admission lifecycle.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionReapClaim = typeof AdmissionReapClaim.Type;

/**
 * Durable phase of a ticket-to-lease promotion transition.
 *
 * **Example** (Recognize a published lease phase)
 *
 * ```ts
 * import { AdmissionPromotionPhase } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionPromotionPhase.is["lease-published"]("lease-published")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionPromotionPhase = LiteralKit([
  "prepared",
  "lease-published",
  "ticket-removed",
  "admission-journaled",
]).pipe(
  $I.annoteSchema("AdmissionPromotionPhase", {
    description: "Durable recovery phase of one ticket-to-lease promotion transition.",
  })
);

/**
 * Durable recovery phase of one ticket-to-lease promotion transition.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionPromotionPhase = typeof AdmissionPromotionPhase.Type;

/**
 * Recoverable transition tying one queue ticket to its active lease.
 *
 * **Details**
 *
 * A transition published with its lease carries the admission's pressure stamp
 * ({@link admissionPressureFields}) when the protocol's `pressure` gate was on
 * as the admission sampled, so the admitted row recovery journals later still
 * records the instant of admission, whatever the gate says by then. A transition recovered from the `prepared` phase has no stamp,
 * and neither has its admitted row.
 *
 * **Example** (Reference the promotion transition class)
 *
 * ```ts
 * import { AdmissionPromotionTransition } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionPromotionTransition) // "function"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export class AdmissionPromotionTransition extends S.Opaque<
  AdmissionPromotionTransition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("yeet-admission-promotion/v1"),
    nonce: S.String,
    ticketPath: S.String,
    leasePath: S.String,
    ticket: YeetAdmissionTicket,
    lease: YeetAdmissionLease,
    phase: AdmissionPromotionPhase,
    createdAtMillis: S.Finite,
    ...admissionPressureFields,
  }).pipe(
    $I.annoteSchema("AdmissionPromotionTransition", {
      description: "Recoverable nonce-keyed transition tying one admission ticket to its promoted lease.",
    })
  )
) {}

/**
 * Admission policy knobs with the chartered production defaults.
 *
 * Defaults come verbatim from ship-velocity SPEC D1 / research c5: 5 GiB
 * tokens, capacity `min(10, floor((MemAvailableGiB - 10) / 5))`, hard floor
 * 15 GiB, heartbeat 5s, progress 15s, publish aging 120s, review-fix class
 * cap 3.
 *
 * **Example** (Construct the default config)
 *
 * ```ts
 * import { AdmissionConfig } from "@beep/repo-cli/test/RepoRun"
 *
 * const config = AdmissionConfig.make({})
 * console.log(config.slotSizeGib) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionConfig extends S.Opaque<AdmissionConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    slotSizeGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(5))),
    reserveGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(10))),
    capacityMaxTokens: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(10))),
    hardFloorGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(15))),
    heartbeatSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(5))),
    suspectAfterSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(30))),
    progressSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(15))),
    publishAgingSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(120))),
    reviewFixClassCap: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(3))),
  }).pipe(
    $I.annoteSchema("AdmissionConfig", {
      description: "Machine-wide admission policy knobs with chartered ship-velocity D1 defaults.",
    })
  )
) {}

/**
 * One admission request derived from a Yeet run mode.
 *
 * **Details**
 *
 * `gateRoute` names the gate family the work proves, when the caller knows it.
 * On a `worker` compute profile a hosted-only route is refused unless
 * `forceLocal` is set; both default so existing callers are unchanged.
 * `unit` defaults to the whole tier and `weightSource` to the static seed;
 * the scheduler records them only behind the protocol's `units` gate.
 *
 * **Example** (Build a full-proof request)
 *
 * ```ts
 * import { AdmissionRequest } from "@beep/repo-cli/test/RepoRun"
 *
 * const request = AdmissionRequest.make({
 *   kind: "full-proof",
 *   weightTokens: 3,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet verify"
 * })
 * console.log(request.priority) // "verify"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionRequest extends S.Opaque<AdmissionRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    attemptId: UUID.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    ...attemptInputFactFields,
    kind: AdmissionWorkKind,
    weightTokens: S.Finite,
    priority: AdmissionPriority,
    originKey: S.String,
    checkoutRoot: S.String,
    branch: S.String,
    command: S.String,
    gateRoute: GateRouteId.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    forceLocal: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    unit: AdmissionUnit.pipe(S.withConstructorDefault(Effect.succeed(AdmissionUnit.cases.tier.make({})))),
    weightSource: AdmissionWeightSource.pipe(
      S.withConstructorDefault(Effect.succeed(AdmissionWeightSource.cases["static-seed"].make({})))
    ),
  }).pipe(
    $I.annoteSchema("AdmissionRequest", {
      description: "One admission request for heavyweight repository work.",
    })
  )
) {}

/**
 * Point-in-time view of the machine-wide admission state.
 *
 * **Example** (Construct an empty snapshot)
 *
 * ```ts
 * import { AdmissionSnapshot } from "@beep/repo-cli/test/RepoRun"
 *
 * const snapshot = AdmissionSnapshot.make({
 *   capacityTokens: 8,
 *   activeTokens: 0,
 *   memAvailableGib: 50,
 *   hardFloorEngaged: false,
 *   leases: [],
 *   tickets: [],
 *   dead: [],
 *   quarantined: []
 * })
 * console.log(snapshot.capacityTokens) // 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionSnapshot extends S.Opaque<AdmissionSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    capacityTokens: S.Finite,
    activeTokens: S.Finite,
    memAvailableGib: S.Finite,
    hardFloorEngaged: S.Boolean,
    leases: S.Array(YeetAdmissionLease),
    tickets: S.Array(YeetAdmissionTicket),
    dead: S.Array(S.String),
    quarantined: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("AdmissionSnapshot", {
      description: "Point-in-time view of machine-wide admission leases, queue, and capacity.",
    })
  )
) {}

/**
 * Encoded form of {@link AdmissionSnapshot}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AdmissionSnapshot {
  /**
   * Encoded form of {@link AdmissionSnapshot}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof AdmissionSnapshot.Encoded;
}

const DeadLeaseRetentionReason = LiteralKit([
  "legacy-nonce-missing",
  "recorded-unit-mismatch",
  "live-unit-conflict",
]).pipe(
  $I.annoteSchema("DeadLeaseRetentionReason", {
    description: "Reason a verified dead admission lease must remain for retry or operator inspection.",
  })
);

/**
 * Conservative action chosen for one verified dead admission lease.
 *
 * **Details**
 *
 * A `stop` plan is allowed only when the lease nonce identifies a scope that
 * no live lease represents. `reap` proves no stop is needed, while `retain`
 * preserves ambiguous evidence for a later operator or retry.
 *
 * **Example** (Retain ambiguous legacy authority)
 *
 * ```ts
 * import { DeadLeaseScopePlan } from "@beep/repo-cli/test/RepoRun"
 *
 * const plan: typeof DeadLeaseScopePlan.Type = {
 *   _tag: "retain",
 *   leasePath: "/runtime/legacy.lease.json",
 *   reason: "legacy-nonce-missing"
 * }
 * console.log(DeadLeaseScopePlan.guards.retain(plan)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeadLeaseScopePlan = S.TaggedUnion({
  retain: { leasePath: S.String, reason: DeadLeaseRetentionReason },
  reap: { leasePath: S.String },
  stop: { leasePath: S.String, unitName: S.String },
}).pipe(
  $I.annoteSchema("DeadLeaseScopePlan", {
    description: "Conservative stop, reap, or retain decision for one verified dead admission lease.",
  })
);

/**
 * Conservative action chosen for one verified dead admission lease.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeadLeaseScopePlan = typeof DeadLeaseScopePlan.Type;

interface QualitySchedulerErrorOptions {
  readonly exitCode?: number;
  readonly reason?: QualitySchedulerErrorReason;
}

const QualitySchedulerErrorReason = LiteralKit([
  "journal-lock-lost",
  "journal-lock-retry-exhausted",
  "compute-profile-refusal",
]);

/**
 * What a `worker` host did with work it routed without the ticket queue.
 *
 * **Details**
 *
 * `bypass` ran the work locally (through the origin gate when the caller has
 * one); `refusal` left it to hosted CI.
 *
 * **Example** (Recognize a refusal)
 *
 * ```ts
 * import { AdmissionRouteOutcome } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionRouteOutcome.is.refusal("refusal")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionRouteOutcome = LiteralKit(["bypass", "refusal"]).pipe(
  $I.annoteSchema("AdmissionRouteOutcome", {
    description: "Whether a worker host ran routed work locally (bypass) or left it to hosted CI (refusal).",
  })
);

/**
 * What a `worker` host did with work it routed without the ticket queue.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionRouteOutcome = typeof AdmissionRouteOutcome.Type;

/**
 * One routing decision a `worker` host made without the ticket queue.
 *
 * **Details**
 *
 * A worker never waits on admission: the scheduler bypasses the queue or
 * refuses a hosted-only gate, and `yeet final-check` decides each gate from
 * the routing table. This is the fact that decision leaves in the admission
 * journal, beside the attempt that made it. `forceLocal` decodes as `false`
 * and `gateRoute` as `None` when absent.
 *
 * **Example** (Record a refused check)
 *
 * ```ts
 * import { AdmissionRoute } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * const route = AdmissionRoute.make({
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet final-check",
 *   computeProfile: "worker",
 *   gateRoute: O.some("check"),
 *   outcome: "refusal"
 * })
 * console.log(route.forceLocal) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionRoute extends S.Opaque<AdmissionRoute, { readonly brand: unique symbol }>()(
  S.Struct({
    checkoutRoot: S.String,
    branch: S.String,
    command: S.String,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    envProfile: ProofEnvProfile.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    computeProfile: ComputeProfile,
    forceLocal: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    gateRoute: GateRouteId.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    outcome: AdmissionRouteOutcome,
  }).pipe(
    $I.annoteSchema("AdmissionRoute", {
      description: "One routing decision a worker host made without the admission ticket queue.",
    })
  )
) {}

/**
 * Refusal to run a hosted-only gate locally on a `worker` compute profile (D4).
 *
 * **Details**
 *
 * The message names the gate, the probe ceiling, the admission envelope and
 * the push-first route (`bun run beep yeet open --body-file <md>`), where
 * hosted CI is the proof. Passing `forceLocal` runs the gate anyway.
 *
 * **Example** (Construct a refusal)
 *
 * ```ts
 * import { ComputeProfileRefusal } from "@beep/repo-cli/test/RepoRun"
 *
 * const refusal = ComputeProfileRefusal.make({
 *   gate: "check",
 *   ceilingGib: 7,
 *   envelopeGib: 20,
 *   message: "check is hosted-only on compute-profile=worker"
 * })
 * console.log(refusal.gate) // "check"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ComputeProfileRefusal extends S.TaggedError<ComputeProfileRefusal, { readonly brand: unique symbol }>(
  $I`ComputeProfileRefusal`
)(
  "ComputeProfileRefusal",
  {
    gate: GateRouteId,
    ceilingGib: S.Finite,
    envelopeGib: S.Finite,
    message: S.String,
  },
  $I.annoteError<ComputeProfileRefusal>("ComputeProfileRefusal", {
    description: "A hosted-only gate was refused locally on a worker compute profile.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

type QualitySchedulerErrorReason = typeof QualitySchedulerErrorReason.Type;

/**
 * Failure raised while coordinating machine-wide admission.
 *
 * **Example** (Construct a scheduler error)
 *
 * ```ts
 * import { QualitySchedulerError } from "@beep/repo-cli/test/RepoRun"
 *
 * const error = QualitySchedulerError.make({ message: "admission directory is not owned by this user" })
 * console.log(error.message.length > 0) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class QualitySchedulerError extends S.TaggedError<QualitySchedulerError, { readonly brand: unique symbol }>(
  $I`QualitySchedulerError`
)(
  "QualitySchedulerError",
  {
    message: S.String,
    exitCode: S.optionalKey(S.Finite),
    reason: S.optionalKey(QualitySchedulerErrorReason),
    refusal: S.optionalKey(ComputeProfileRefusal),
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<QualitySchedulerError>("QualitySchedulerError", {
    description: "Failure raised while coordinating machine-wide quality admission.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Curried constructor pairing a message with an unknown cause.
   *
   * @since 0.0.0
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: QualitySchedulerErrorOptions): QualitySchedulerError;
    (message: string, opts?: QualitySchedulerErrorOptions): (cause: unknown) => QualitySchedulerError;
  } = dual(
    3,
    (cause: unknown, message: string, { exitCode, reason }: QualitySchedulerErrorOptions = {}): QualitySchedulerError =>
      QualitySchedulerError.make({
        cause,
        message,
        ...O.getSomesStruct({
          exitCode: O.fromUndefinedOr(exitCode),
          reason: O.fromUndefinedOr(reason),
        }),
      })
  );
}

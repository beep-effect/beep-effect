/**
 * Parent-only launch capabilities and bounded owned-adapter observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.adapter.schemas");

/**
 * Unserialized storage capabilities for one independently pinned executable.
 *
 * **Details**
 * The approved target supplies the executable digest, storage destination and
 * namespace. The parent supplies credentials through its private process pipe.
 * No artifact-signing or issuer capability belongs in this value.
 *
 * **Example** (Inspect the launch boundary)
 * ```ts
 * import { CacheProducerAdapterLaunch } from "@beep/repo-cli/test/Cache"
 * console.assert("accessKey" in CacheProducerAdapterLaunch.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerAdapterLaunch extends S.Opaque<
  CacheProducerAdapterLaunch,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    executable: S.NonEmptyString,
    accessKey: S.Redacted(S.NonEmptyString),
    secretKey: S.Redacted(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CacheProducerAdapterLaunch", {
      description: "Parent-held executable path and storage credentials; never serialize or publish this capability.",
    })
  )
) {}

const AdapterRole = LiteralKit(["reader", "writer"]).pipe(
  $I.annoteSchema("AdapterRole", {
    description: "The independent storage and method-policy role of the owned backend.",
  })
);
const AdapterPhase = LiteralKit(["ready", "after-load"]).pipe(
  $I.annoteSchema("AdapterPhase", {
    description: "The two live process observations surrounding the owned upload.",
  })
);

/**
 * Measured identity and resource limits of the actual owned backend process.
 *
 * **Example** (Inspect fixed resource limits)
 * ```ts
 * import { CacheAdapterRuntimeObservation } from "@beep/repo-cli/test/Cache"
 * console.assert("ownedLoopbackListener" in CacheAdapterRuntimeObservation.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheAdapterRuntimeObservation extends S.Opaque<
  CacheAdapterRuntimeObservation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    role: AdapterRole,
    phase: AdapterPhase,
    actixThreadsIncludingAcceptor: S.tag(3),
    tokioNamedThreadsIncludingBlocking: S.Int.check(S.isBetween({ minimum: 2, maximum: 8 })),
    totalThreads: S.Int.check(S.isBetween({ minimum: 5, maximum: 12 })),
    memoryMaxBytes: S.tag(256 * 1024 * 1024),
    cpuQuotaMicros: S.tag(200_000),
    cpuPeriodMicros: S.tag(100_000),
    tasksMax: S.tag(16),
    runtimeMaxSeconds: S.tag(600),
    stopTimeoutSeconds: S.tag(10),
    memoryPeakBytes: S.Natural,
    reviewedExecutable: S.tag(true),
    ownedLoopbackListener: S.tag(true),
    sameProcess: S.tag(true),
    explicitEnvironmentOnly: S.tag(true),
    passed: S.tag(true),
  }).pipe(
    $I.annoteSchema("CacheAdapterRuntimeObservation", {
      description: "Actual pinned executable, stable process, owned listener and measured fixed cgroup/worker limits.",
    })
  )
) {}

/**
 * The owned writer's live readiness observation.
 *
 * **Example** (Inspect the fixed writer phase)
 * ```ts
 * import { CacheAdapterWriterReady } from "@beep/repo-cli/test/Cache"
 * console.assert("phase" in CacheAdapterWriterReady.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CacheAdapterWriterReady = S.Struct({
  ...CacheAdapterRuntimeObservation.fields,
  role: S.tag("writer"),
  phase: S.tag("ready"),
}).pipe($I.annoteSchema("CacheAdapterWriterReady", { description: "The owned writer's live readiness observation." }));

/**
 * Decoded writer readiness observation.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheAdapterWriterReady = typeof CacheAdapterWriterReady.Type;

/**
 * The same owned writer observed after the upload callback.
 *
 * **Example** (Inspect the fixed writer phase)
 * ```ts
 * import { CacheAdapterWriterAfterLoad } from "@beep/repo-cli/test/Cache"
 * console.assert("phase" in CacheAdapterWriterAfterLoad.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CacheAdapterWriterAfterLoad = S.Struct({
  ...CacheAdapterRuntimeObservation.fields,
  role: S.tag("writer"),
  phase: S.tag("after-load"),
}).pipe(
  $I.annoteSchema("CacheAdapterWriterAfterLoad", {
    description: "The same owned writer observed after the upload callback.",
  })
);

/**
 * Decoded writer after-load observation.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheAdapterWriterAfterLoad = typeof CacheAdapterWriterAfterLoad.Type;

/**
 * Private startup input for one owned adapter unit.
 *
 * **Details**
 * The owned host serializes this value only into the anonymous pipe of its
 * transient user unit; it never reaches command arguments, unit properties or
 * an environment file. `env` is the complete environment the adapter executes
 * with, so it carries the storage credentials and the loopback bearer.
 *
 * **Example** (Inspect the fixed startup fields)
 * ```ts
 * import { CacheOwnedAdapterStartup } from "@beep/repo-cli/test/Cache"
 * console.assert("env" in CacheOwnedAdapterStartup.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheOwnedAdapterStartup extends S.Opaque<CacheOwnedAdapterStartup, { readonly brand: unique symbol }>()(
  S.Struct({ adapter: S.NonEmptyString, sha256: Sha256Hex, env: S.Record(S.String, S.String) }).pipe(
    $I.annoteSchema("CacheOwnedAdapterStartup", {
      description: "One private startup value consumed only through the owned unit's anonymous pipe.",
    })
  )
) {}

/**
 * Raw kernel and user-manager facts read for one owned adapter observation.
 *
 * **Details**
 * Each field is the unparsed text the Linux host reports for the unit's main
 * process: its systemd properties, `/proc/<pid>` entries and cgroup v2 files.
 * Observation logic judges a snapshot without further I/O, so recorded
 * snapshots replay the same verdicts.
 *
 * **Example** (Inspect the listener inputs)
 * ```ts
 * import { CacheAdapterProcessSnapshot } from "@beep/repo-cli/test/Cache"
 * console.assert("tcpTable" in CacheAdapterProcessSnapshot.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheAdapterProcessSnapshot extends S.Opaque<
  CacheAdapterProcessSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    mainPid: S.Int,
    controlGroup: S.String,
    executableSha256: S.String,
    socketInodes: S.Array(S.String),
    tcpTable: S.String,
    environmentNames: S.Array(S.String),
    cpuMax: S.String,
    memoryMax: S.String,
    pidsMax: S.String,
    memoryPeak: S.String,
    runtimeMaxUSec: S.String,
    timeoutStopUSec: S.String,
    killMode: S.String,
    threadNames: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("CacheAdapterProcessSnapshot", {
      description: "Unparsed systemd, /proc and cgroup facts for one owned adapter process observation.",
    })
  )
) {}

/**
 * Actual backend lifecycle facts included in the issuer-authenticated bundle.
 *
 * **Example** (Inspect the independent target binding)
 * ```ts
 * import { CacheProducerAdapterReceipt } from "@beep/repo-cli/test/Cache"
 * console.assert("targetSha256" in CacheProducerAdapterReceipt.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerAdapterReceipt extends S.Opaque<
  CacheProducerAdapterReceipt,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    backendSha256: Sha256Hex,
    targetSha256: Sha256Hex,
    ready: CacheAdapterWriterReady,
    afterLoad: CacheAdapterWriterAfterLoad,
    cleaned: S.tag(true),
  }).pipe(
    $I.annoteSchema("CacheProducerAdapterReceipt", {
      description: "Approved target/executable identities with actual writer lifecycle and successful owned cleanup.",
    })
  )
) {}

/**
 * Expected identity of one owned adapter observation.
 *
 * **Example** (Describe a readiness expectation)
 * ```ts
 * import { CacheAdapterObservationExpectation } from "@beep/repo-cli/test/Cache"
 * const expected = CacheAdapterObservationExpectation.make({
 *   unit: "beep-cache-owned-0123456789ab-writer.service",
 *   role: "writer",
 *   phase: "ready",
 *   sha256: "0".repeat(64),
 *   environmentNames: ["PATH", "HOME"],
 *   port: 19427,
 *   pid: 4242
 * })
 * console.assert(expected.phase === "ready")
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheAdapterObservationExpectation extends S.Opaque<
  CacheAdapterObservationExpectation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    unit: S.String,
    role: S.String,
    phase: AdapterPhase,
    sha256: S.String,
    environmentNames: S.Array(S.String),
    port: S.Int,
    pid: S.Int,
  }).pipe(
    $I.annoteSchema("CacheAdapterObservationExpectation", {
      description: "Owned unit, role, phase, executable digest, environment names, loopback port and stable PID.",
    })
  )
) {}

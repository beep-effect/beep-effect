/**
 * Parent-only launch capabilities and bounded owned-adapter observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

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

const Ready = S.Struct({
  status: S.tag("ready"),
  observation: S.Struct({ ...CacheAdapterRuntimeObservation.fields, role: S.tag("writer"), phase: S.tag("ready") }),
}).pipe($I.annoteSchema("CacheAdapterHostReady", { description: "The owned writer's live readiness observation." }));
const AfterLoad = S.Struct({
  status: S.tag("after-load"),
  observation: S.Struct({
    ...CacheAdapterRuntimeObservation.fields,
    role: S.tag("writer"),
    phase: S.tag("after-load"),
  }),
}).pipe(
  $I.annoteSchema("CacheAdapterHostAfterLoad", {
    description: "The same owned writer observed after the upload callback.",
  })
);
const Cleaned = S.Struct({ status: S.tag("cleaned") }).pipe(
  $I.annoteSchema("CacheAdapterHostCleaned", {
    description: "The owning host completed exhaustive resource cleanup.",
  })
);

/**
 * Fixed parent-pipe protocol emitted by the owned adapter host.
 *
 * **Example** (Inspect the terminal phase)
 * ```ts
 * import { CacheAdapterHostEvent } from "@beep/repo-cli/test/Cache"
 * console.assert(CacheAdapterHostEvent.cases.cleaned.make({}).status === "cleaned")
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CacheAdapterHostEvent = LiteralKit(["ready", "after-load", "cleaned"])
  .mapMembers(Tuple.evolve([() => Ready, () => AfterLoad, () => Cleaned]))
  .pipe(
    $I.annoteSchema("CacheAdapterHostEvent", {
      description: "One ordered, bounded host-process event; tasks cannot submit observations through this pipe.",
    }),
    S.toTaggedUnion("status")
  );
/**
 * Decoded parent-pipe event.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheAdapterHostEvent = typeof CacheAdapterHostEvent.Type;

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
    ready: S.Struct({ ...CacheAdapterRuntimeObservation.fields, role: S.tag("writer"), phase: S.tag("ready") }),
    afterLoad: S.Struct({
      ...CacheAdapterRuntimeObservation.fields,
      role: S.tag("writer"),
      phase: S.tag("after-load"),
    }),
    cleaned: S.tag(true),
  }).pipe(
    $I.annoteSchema("CacheProducerAdapterReceipt", {
      description: "Approved target/executable identities with actual writer lifecycle and successful owned cleanup.",
    })
  )
) {}

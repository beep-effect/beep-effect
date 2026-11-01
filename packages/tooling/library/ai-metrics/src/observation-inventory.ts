/**
 * Declared observability routes and evidence-scoped coverage denominators.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { readBoundedMetadata } from "./observation-file.ts";

const $I = $RepoAiMetricsId.create("observation-inventory");

/**
 * Requested harnesses, independent of their supported collection routes.
 *
 * **Details**
 *
 * Membership does not establish installation, enrollment or coverage.
 *
 * **Example** (Read the grok observation harness literal)
 *
 * ```ts
 * import { ObservationHarness } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationHarness.Enum.grok)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationHarness = LiteralKit([
  "grok",
  "claude-code",
  "claude-desktop",
  "codex-cli",
  "chatgpt-desktop",
  "muse",
  "cursor-agent",
]).pipe(
  $I.annoteSchema("ObservationHarness", { description: "Harness identity, separate from transport and enrollment." })
);
/**
 * Runtime type of {@link ObservationHarness}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation harness)
 *
 * ```ts
 * import type { ObservationHarness } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationHarness | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationHarness = typeof ObservationHarness.Type;

/**
 * Signal capabilities established by adapter evidence.
 *
 * **Details**
 *
 * Supporting metrics does not imply support for traces or launches.
 *
 * **Example** (Read the traces observation signal literal)
 *
 * ```ts
 * import { ObservationSignal } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationSignal.Enum.traces)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationSignal = LiteralKit(["launches", "traces", "metrics", "outcomes"]).pipe(
  $I.annoteSchema("ObservationSignal", { description: "Independently qualified signal classes." })
);
/**
 * Runtime type of {@link ObservationSignal}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation signal)
 *
 * ```ts
 * import type { ObservationSignal } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationSignal | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationSignal = typeof ObservationSignal.Type;

const PopulationIds = S.Array(Sha256Hex)
  .check(S.isMaxLength(4096), S.isUnique())
  .pipe($I.annoteSchema("PopulationIds", { description: "Bounded distinct IDs in one declared observation window." }));

/**
 * Explicitly enumerated population or a population whose size is unknown.
 *
 * **Details**
 *
 * An empty enumerated set needs evidence; absence is never encoded as zero.
 *
 * **Example** (Construct the unknown observation population case)
 *
 * ```ts
 * import { ObservationPopulation } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationPopulation.cases.Unknown.make({})._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationPopulation = S.TaggedUnion({
  Unknown: {},
  Enumerated: { ids: PopulationIds, evidenceId: Sha256Hex },
}).pipe(
  $I.annoteSchema("ObservationPopulation", { description: "Evidence-bounded launch or expected-event denominator." })
);
/**
 * Runtime type of {@link ObservationPopulation}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation population)
 *
 * ```ts
 * import type { ObservationPopulation } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationPopulation | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationPopulation = typeof ObservationPopulation.Type;

/**
 * Qualified capability, explicit lack of support, or an uninvestigated route.
 *
 * **Details**
 *
 * Capability is independent of whether the route is currently running.
 *
 * **Example** (Construct the unknown observation capability case)
 *
 * ```ts
 * import { ObservationCapability } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationCapability.cases.Unknown.make({})._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationCapability = S.TaggedUnion({
  Unknown: {},
  Unsupported: { evidenceId: Sha256Hex },
  Supported: {
    signals: S.NonEmptyArray(ObservationSignal).check(S.isMaxLength(4), S.isUnique()),
    evidenceId: Sha256Hex,
  },
}).pipe(
  $I.annoteSchema("ObservationCapability", {
    description: "Evidence-backed adapter capability without a collection claim.",
  })
);
/**
 * Runtime type of {@link ObservationCapability}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation capability)
 *
 * ```ts
 * import type { ObservationCapability } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationCapability | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationCapability = typeof ObservationCapability.Type;

/**
 * Deliberate collection policy, separate from missing capability or failure.
 *
 * **Details**
 *
 * An exclusion carries its policy evidence, never a fabricated idle reading.
 *
 * **Example** (Construct the included observation policy case)
 *
 * ```ts
 * import { ObservationPolicy } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationPolicy.cases.Included.make({})._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationPolicy = S.TaggedUnion({ Included: {}, Excluded: { evidenceId: Sha256Hex } }).pipe(
  $I.annoteSchema("ObservationPolicy", { description: "Declared collection inclusion or an evidenced exclusion." })
);
/**
 * Runtime type of {@link ObservationPolicy}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation policy)
 *
 * ```ts
 * import type { ObservationPolicy } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationPolicy | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationPolicy = typeof ObservationPolicy.Type;

const ProducerActivity = LiteralKit(["active", "idle", "failed"]).pipe(
  $I.annoteSchema("ProducerActivity", { description: "Activity explicitly observed by the route health probe." })
);

/**
 * A route health observation with a finite validity window, or no observation.
 *
 * **Details**
 *
 * A stopped producer becomes stale; no trace arrivals alone cannot prove idle.
 *
 * **Example** (Construct the unknown observation heartbeat case)
 *
 * ```ts
 * import { ObservationHeartbeat } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationHeartbeat.cases.Unknown.make({})._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationHeartbeat = S.TaggedUnion({
  Unknown: {},
  Observed: {
    observedAt: S.DateTimeUtcFromString,
    validUntil: S.DateTimeUtcFromString,
    activity: ProducerActivity,
    evidenceId: Sha256Hex,
  },
})
  .check(
    S.makeFilter(
      (value) =>
        P.isTagged("Observed")(value)
          ? DateTime.toEpochMillis(value.validUntil) >= DateTime.toEpochMillis(value.observedAt)
          : true,
      {
        identifier: "HeartbeatValidityWindow",
        title: "Heartbeat validity window",
        description: "A heartbeat cannot expire before it was observed.",
        message: "Expected heartbeat validity to end at or after observation",
      }
    )
  )
  .pipe($I.annoteSchema("ObservationHeartbeat", { description: "Explicit route health evidence and its expiry." }));
/**
 * Runtime type of {@link ObservationHeartbeat}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation heartbeat)
 *
 * ```ts
 * import type { ObservationHeartbeat } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationHeartbeat | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationHeartbeat = typeof ObservationHeartbeat.Type;

const RootId = S.String.check(S.isPattern(/^root-[a-f0-9]{64}$/u)).pipe(
  $I.annoteSchema("RootId", { description: "Existing canonical registry root identifier, with no raw path." })
);

/**
 * Binding supported by source evidence, or an explicitly unattributed route.
 *
 * **Details**
 *
 * Global source directories do not inherit a collector checkout binding.
 *
 * **Example** (Construct the unknown observation root binding case)
 *
 * ```ts
 * import { ObservationRootBinding } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationRootBinding.cases.Unknown.make({})._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationRootBinding = S.TaggedUnion({
  Unknown: {},
  Verified: { rootId: RootId, evidenceId: Sha256Hex },
}).pipe(
  $I.annoteSchema("ObservationRootBinding", { description: "Source-root evidence independent of collection context." })
);
/**
 * Runtime type of {@link ObservationRootBinding}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation root binding)
 *
 * ```ts
 * import type { ObservationRootBinding } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationRootBinding | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationRootBinding = typeof ObservationRootBinding.Type;

/**
 * Privacy-safe host identity in one operator-defined identity namespace.
 *
 * **Details**
 *
 * IDs are digests; no hostname, home path or access-bearing URL is accepted.
 *
 * **Example** (Reject an empty observation host)
 *
 * ```ts
 * import { ObservationHost } from "@beep/repo-ai-metrics/observation-inventory"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationHost)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationHost extends S.Opaque<ObservationHost, { readonly brand: unique symbol }>()(
  S.Struct({ hostId: Sha256Hex, identityNamespaceId: Sha256Hex }).pipe(
    $I.annoteSchema("ObservationHost", { description: "Declared host identity and hash namespace." })
  )
) {}

/**
 * Evidenced identity component or an explicitly unresolved component.
 *
 * **Details**
 *
 * A retired root can remain inventoried even when its owning clone was never proven.
 *
 * **Example** (Construct the unknown observation identity case)
 *
 * ```ts
 * import { ObservationIdentity } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationIdentity.cases.Unknown.make({})._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationIdentity = S.TaggedUnion({
  Unknown: {},
  Verified: { id: Sha256Hex, evidenceId: Sha256Hex },
}).pipe(
  $I.annoteSchema("ObservationIdentity", {
    description: "An evidence-backed repository, clone or worktree identity; absence is explicit.",
  })
);

/**
 * Repository, clone and worktree identities kept as separate fields.
 *
 * **Details**
 *
 * Retired roots remain representable without pretending their files are present.
 *
 * **Example** (Reject an empty observation root)
 *
 * ```ts
 * import { ObservationRoot } from "@beep/repo-ai-metrics/observation-inventory"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationRoot)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationRoot extends S.Opaque<ObservationRoot, { readonly brand: unique symbol }>()(
  S.Struct({
    rootId: RootId,
    hostId: Sha256Hex,
    repositoryId: ObservationIdentity,
    cloneId: ObservationIdentity,
    worktreeId: ObservationIdentity,
    availability: S.Literals(["present", "retired", "unreachable"]),
    evidenceId: Sha256Hex,
  }).pipe(
    $I.annoteSchema("ObservationRoot", { description: "Root identity evidence separated from current availability." })
  )
) {}

/**
 * One declared harness route with independent capability and population evidence.
 *
 * **Details**
 *
 * Declaring a route never discovers unmanaged launches or expected events by inference.
 *
 * **Example** (Reject an empty observation route)
 *
 * ```ts
 * import { ObservationRoute } from "@beep/repo-ai-metrics/observation-inventory"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationRoute)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationRoute extends S.Opaque<ObservationRoute, { readonly brand: unique symbol }>()(
  S.Struct({
    routeId: Sha256Hex,
    hostId: Sha256Hex,
    harness: ObservationHarness,
    surface: S.Literals(["cli", "desktop", "ide", "worker", "unknown"]),
    transport: S.Literals(["native-otlp", "transcript", "managed-launch", "unknown"]),
    root: ObservationRootBinding,
    capability: ObservationCapability,
    policy: ObservationPolicy,
    heartbeat: ObservationHeartbeat,
    knownLaunches: ObservationPopulation,
    expectedEvents: ObservationPopulation,
  }).pipe(
    $I.annoteSchema("ObservationRoute", {
      description: "Declared route, evidence and independently scoped populations.",
    })
  )
) {}

/**
 * Bounded host/root/route manifest with referential integrity checks.
 *
 * **Details**
 *
 * Populations cover [populationWindowStart, populationWindowEnd); observation cannot precede the window end. The manifest describes its declared boundary, not every application on a machine.
 *
 * **Example** (Reject an empty observation inventory)
 *
 * ```ts
 * import { ObservationInventory } from "@beep/repo-ai-metrics/observation-inventory"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationInventory)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationInventory extends S.Opaque<ObservationInventory, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("agent-observation-inventory/v1"),
    observedAt: S.DateTimeUtcFromString,
    populationWindowStart: S.DateTimeUtcFromString,
    populationWindowEnd: S.DateTimeUtcFromString,
    boundaryEvidenceId: Sha256Hex,
    hosts: S.Array(ObservationHost).check(S.isMaxLength(256)),
    roots: S.Array(ObservationRoot).check(S.isMaxLength(4096)),
    routes: S.Array(ObservationRoute).check(S.isMaxLength(4096)),
  })
    .check(
      S.makeFilter(
        (value) => {
          const hostIds = A.map(value.hosts, (host) => host.hostId);
          const rootIds = A.map(value.roots, (root) => `${root.hostId}:${root.rootId}`);
          const routeIds = A.map(value.routes, (route) => route.routeId);
          const populationSize = A.reduce(
            value.routes,
            0,
            (total, route) =>
              total +
              ObservationPopulation.match(route.knownLaunches, {
                Unknown: () => 0,
                Enumerated: (population) => population.ids.length,
              }) +
              ObservationPopulation.match(route.expectedEvents, {
                Unknown: () => 0,
                Enumerated: (population) => population.ids.length,
              })
          );
          return (
            DateTime.toEpochMillis(value.populationWindowStart) < DateTime.toEpochMillis(value.populationWindowEnd) &&
            DateTime.toEpochMillis(value.populationWindowEnd) <= DateTime.toEpochMillis(value.observedAt) &&
            populationSize <= 16384 &&
            A.dedupe(hostIds).length === hostIds.length &&
            A.dedupe(rootIds).length === rootIds.length &&
            A.dedupe(routeIds).length === routeIds.length &&
            A.every(value.roots, (root) => A.contains(hostIds, root.hostId)) &&
            A.every(
              value.routes,
              (route) =>
                A.contains(hostIds, route.hostId) &&
                ObservationRootBinding.match(route.root, {
                  Unknown: () => true,
                  Verified: (binding) =>
                    A.some(value.roots, (root) => root.rootId === binding.rootId && root.hostId === route.hostId),
                })
            )
          );
        },
        {
          identifier: "ObservationInventoryReferences",
          title: "Observation inventory references",
          description:
            "Population windows must be nonempty and end by observation time; IDs must be unique, root hosts must match, and population entries must not exceed 16384.",
          message: "Expected unique identities and valid host/root references",
        }
      )
    )
    .pipe(
      $I.annoteSchema("ObservationInventory", {
        description: "Bounded, internally consistent declared coverage inventory.",
      })
    )
) {}

/**
 * Route state, separate from whether launch/event populations are known.
 *
 * **Details**
 *
 * Unknown is neither zero activity nor intentional exclusion.
 *
 * **Example** (Read the stale observation route status literal)
 *
 * ```ts
 * import { ObservationRouteStatus } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationRouteStatus.Enum.stale)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObservationRouteStatus = LiteralKit([
  "unknown",
  "unsupported",
  "excluded",
  "idle",
  "active",
  "stale",
  "failed",
]).pipe(
  $I.annoteSchema("ObservationRouteStatus", {
    description: "Current interpretation of declared route health evidence.",
  })
);
/**
 * Runtime type of {@link ObservationRouteStatus}.
 *
 * **Details**
 *
 * Inferred from the canonical runtime schema.
 *
 * **Example** (Annotate an optional observation route status)
 *
 * ```ts
 * import type { ObservationRouteStatus } from "@beep/repo-ai-metrics/observation-inventory"
 * const value: ObservationRouteStatus | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObservationRouteStatus = typeof ObservationRouteStatus.Type;

/**
 * Interpret route state at a supplied clock instant.
 *
 * **Details**
 *
 * Future heartbeat observations are unknown; expired heartbeats are stale.
 *
 * **Example** (Inspect the arity of observationRouteStatus)
 *
 * ```ts
 * import { observationRouteStatus } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(observationRouteStatus.length)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const observationRouteStatus: {
  (now: DateTime.Utc, route: ObservationRoute): ObservationRouteStatus;
  (route: ObservationRoute): (now: DateTime.Utc) => ObservationRouteStatus;
} = dual(2, (now: DateTime.Utc, route: ObservationRoute): ObservationRouteStatus => {
  if (ObservationPolicy.isAnyOf(["Excluded"])(route.policy)) return "excluded";
  if (ObservationCapability.isAnyOf(["Unsupported"])(route.capability)) return "unsupported";
  return ObservationHeartbeat.match(route.heartbeat, {
    Unknown: () => "unknown",
    Observed: (heartbeat) => {
      const clock = DateTime.toEpochMillis(now);
      if (clock < DateTime.toEpochMillis(heartbeat.observedAt)) return "unknown";
      if (clock > DateTime.toEpochMillis(heartbeat.validUntil)) return "stale";
      if (heartbeat.activity === "failed") return "failed";
      return ObservationCapability.isAnyOf(["Unknown"])(route.capability) ? "unknown" : heartbeat.activity;
    },
  });
});

/**
 * Counts for declared capabilities, known launches and expected events.
 *
 * **Details**
 *
 * Unknown-route counts accompany known subsets; no universal capture percentage is inferred.
 *
 * **Example** (Reject an empty observation inventory summary)
 *
 * ```ts
 * import { ObservationInventorySummary } from "@beep/repo-ai-metrics/observation-inventory"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationInventorySummary)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationInventorySummary extends S.Opaque<
  ObservationInventorySummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    hosts: S.Natural,
    roots: S.Natural,
    declaredRoutes: S.Natural,
    supportedRoutes: S.Natural,
    unsupportedRoutes: S.Natural,
    unknownCapabilityRoutes: S.Natural,
    excludedRoutes: S.Natural,
    knownLaunches: S.Natural,
    unknownLaunchRoutes: S.Natural,
    expectedEvents: S.Natural,
    unknownEventRoutes: S.Natural,
  }).pipe(
    $I.annoteSchema("ObservationInventorySummary", {
      description: "Separate coverage denominators with explicit unknown populations.",
    })
  )
) {}

const populationIds = ObservationPopulation.match({
  Unknown: () => A.empty<Sha256Hex>(),
  Enumerated: (population) => population.ids,
});

/**
 * Count declared route capabilities and deduplicate known launch/event identities.
 *
 * **Details**
 *
 * The same known launch seen by two routes on one host counts once. Host-local ID collisions remain separate; unknown populations stay explicit.
 *
 * **Example** (Inspect the arity of summarizeObservationInventory)
 *
 * ```ts
 * import { summarizeObservationInventory } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(summarizeObservationInventory.length)
 * ```
 *
 * @param inventory - Declared routes and independently known populations.
 * @returns Separate capability and population totals with unknown routes retained.
 * @category utilities
 * @since 0.0.0
 */
export const summarizeObservationInventory = (inventory: ObservationInventory): ObservationInventorySummary =>
  ObservationInventorySummary.make({
    hosts: inventory.hosts.length,
    roots: inventory.roots.length,
    declaredRoutes: inventory.routes.length,
    supportedRoutes: A.filter(inventory.routes, (route) =>
      ObservationCapability.isAnyOf(["Supported"])(route.capability)
    ).length,
    unsupportedRoutes: A.filter(inventory.routes, (route) =>
      ObservationCapability.isAnyOf(["Unsupported"])(route.capability)
    ).length,
    unknownCapabilityRoutes: A.filter(inventory.routes, (route) =>
      ObservationCapability.isAnyOf(["Unknown"])(route.capability)
    ).length,
    excludedRoutes: A.filter(inventory.routes, (route) => ObservationPolicy.isAnyOf(["Excluded"])(route.policy)).length,
    knownLaunches: A.dedupe(
      A.flatMap(inventory.routes, (route) => A.map(populationIds(route.knownLaunches), (id) => `${route.hostId}:${id}`))
    ).length,
    unknownLaunchRoutes: A.filter(inventory.routes, (route) =>
      ObservationPopulation.isAnyOf(["Unknown"])(route.knownLaunches)
    ).length,
    expectedEvents: A.dedupe(
      A.flatMap(inventory.routes, (route) =>
        A.map(populationIds(route.expectedEvents), (id) => `${route.hostId}:${id}`)
      )
    ).length,
    unknownEventRoutes: A.filter(inventory.routes, (route) =>
      ObservationPopulation.isAnyOf(["Unknown"])(route.expectedEvents)
    ).length,
  });

/**
 * A safe inventory boundary error that never includes the rejected payload.
 *
 * **Details**
 *
 * Schema issues can contain input values, so they are deliberately not attached as causes.
 *
 * **Example** (Construct an invalid-inventory error)
 *
 * ```ts
 * import { ObservationInventoryError } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(ObservationInventoryError.make({ message: "Invalid observation inventory." })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ObservationInventoryError extends S.TaggedError<
  ObservationInventoryError,
  { readonly brand: unique symbol }
>($I`ObservationInventoryError`)(
  "ObservationInventoryError",
  { message: S.String },
  $I.annote("ObservationInventoryError", { description: "Payload-free failure at the inventory JSON boundary." })
) {}
const decodeObservationInventoryJson = S.decodeEffect(S.fromJsonString(ObservationInventory), {
  onExcessProperty: "error",
});

/**
 * Decode a bounded inventory, rejecting unexpected fields and masking input-bearing schema errors.
 *
 * **Details**
 *
 * The character ceiling bounds parsing; network callers must also enforce a request-byte limit before reading.
 *
 * **Example** (Build an inventory decoder with a flipped error channel)
 *
 * ```ts
 * import { decodeObservationInventory } from "@beep/repo-ai-metrics/observation-inventory"
 * import * as Effect from "effect/Effect"
 * const result = decodeObservationInventory("{}").pipe(Effect.flip)
 * console.log(result)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const decodeObservationInventory = Effect.fn("AiMetrics.decodeObservationInventory")(function* (json: string) {
  if (json.length > 4_194_304) {
    return yield* ObservationInventoryError.make({ message: "Observation inventory exceeds its parsing limit." });
  }
  return yield* decodeObservationInventoryJson(json).pipe(
    Effect.mapError(() => ObservationInventoryError.make({ message: "Invalid observation inventory." }))
  );
});

/**
 * Read a declared inventory with a hard byte ceiling before JSON parsing.
 *
 * **Details**
 *
 * Reads at most 4 MiB plus one sentinel byte. File errors omit paths and payloads.
 *
 * **Example** (Build an inventory-file read effect)
 *
 * ```ts
 * import { readObservationInventory } from "@beep/repo-ai-metrics/observation-inventory"
 * const program = readObservationInventory("/tmp/synthetic-inventory.json")
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const readObservationInventory = Effect.fn("AiMetrics.readObservationInventory")(function* (path: string) {
  const json = yield* readBoundedMetadata(path, 4_194_304, {
    readFailed: ObservationInventoryError.make({ message: "Unable to read observation inventory." }),
    oversize: ObservationInventoryError.make({ message: "Observation inventory exceeds its byte limit." }),
    encodingFailed: ObservationInventoryError.make({ message: "Invalid observation inventory encoding." }),
  });
  return yield* decodeObservationInventory(json);
});

/**
 * Snapshot of the declared inventory and health interpretation at a supplied time.
 *
 * **Details**
 *
 * Includes the evidence manifest so consumers can inspect the scope behind each count.
 *
 * **Example** (Reject an empty observation inventory report)
 *
 * ```ts
 * import { ObservationInventoryReport } from "@beep/repo-ai-metrics/observation-inventory"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationInventoryReport)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationInventoryReport extends S.Opaque<
  ObservationInventoryReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    evaluatedAt: S.DateTimeUtcFromString,
    inventory: ObservationInventory,
    summary: ObservationInventorySummary,
    routeStatuses: S.Array(S.Struct({ routeId: Sha256Hex, status: ObservationRouteStatus })).check(S.isMaxLength(4096)),
  }).pipe(
    $I.annoteSchema("ObservationInventoryReport", {
      description: "Declared scope, separate denominators and time-qualified route health.",
    })
  )
) {}

/**
 * Build a report without probing applications or inferring undeclared coverage.
 *
 * **Details**
 *
 * The clock is explicit so stored heartbeat expiry can be reproduced in tests.
 *
 * **Example** (Inspect the arity of reportObservationInventory)
 *
 * ```ts
 * import { reportObservationInventory } from "@beep/repo-ai-metrics/observation-inventory"
 * console.log(reportObservationInventory.length)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const reportObservationInventory: {
  (inventory: ObservationInventory, now: DateTime.Utc): ObservationInventoryReport;
  (now: DateTime.Utc): (inventory: ObservationInventory) => ObservationInventoryReport;
} = dual(
  2,
  (inventory: ObservationInventory, now: DateTime.Utc): ObservationInventoryReport =>
    ObservationInventoryReport.make({
      evaluatedAt: now,
      inventory,
      summary: summarizeObservationInventory(inventory),
      routeStatuses: A.map(inventory.routes, (route) => ({
        routeId: route.routeId,
        status: observationRouteStatus(now, route),
      })),
    })
);

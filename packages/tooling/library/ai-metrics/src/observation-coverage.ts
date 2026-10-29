/**
 * Reconcile independently declared populations with bounded observation snapshots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readBoundedMetadata } from "./internal/bounded-metadata.ts";
import { ObservationInventory, ObservationInventoryError, ObservationPopulation } from "./observation-inventory.ts";

const $I = $RepoAiMetricsId.create("observation-coverage");
const Snapshot = S.TaggedUnion({
  Unknown: {},
  Observed: {
    ids: S.Array(Sha256Hex).check(S.isMaxLength(4096), S.isUnique()),
    evidenceId: Sha256Hex,
    exhaustive: S.Boolean,
  },
}).pipe(
  $I.annoteSchema("Snapshot", {
    description: "Positive observation IDs; exhaustive applies only to the declared query boundary.",
  })
);
const RouteObservation = S.Struct({
  routeId: Sha256Hex,
  launches: Snapshot,
  acceptedEvents: Snapshot,
  visibleEvents: Snapshot,
});
const size = Snapshot.match({ Unknown: () => 0, Observed: (value) => value.ids.length });

/**
 * Independent inventory and observation evidence for exactly one population window.
 *
 * **Example** (Validate coverage evidence)
 * ```ts
 * import { ObservationCoverageInput } from "@beep/repo-ai-metrics/observation-coverage"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationCoverageInput)({})) // false
 * ```
 * **Details** Omitted routes are unassessed. IDs use the inventory host's namespace; observation evidence never creates a denominator. Producers must establish provenance before asserting exhaustive queries.
 * @category models
 * @since 0.0.0
 */
export class ObservationCoverageInput extends S.Opaque<ObservationCoverageInput, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-coverage/v1"),
    inventory: ObservationInventory,
    boundaryEvidenceId: Sha256Hex,
    populationWindowStart: S.DateTimeUtcFromString,
    populationWindowEnd: S.DateTimeUtcFromString,
    observedAt: S.DateTimeUtcFromString,
    routes: S.Array(RouteObservation).check(S.isMaxLength(4096)),
  })
    .check(
      S.makeFilter(
        (value) =>
          value.boundaryEvidenceId === value.inventory.boundaryEvidenceId &&
          DateTime.toEpochMillis(value.populationWindowStart) ===
            DateTime.toEpochMillis(value.inventory.populationWindowStart) &&
          DateTime.toEpochMillis(value.populationWindowEnd) ===
            DateTime.toEpochMillis(value.inventory.populationWindowEnd) &&
          DateTime.toEpochMillis(value.observedAt) >= DateTime.toEpochMillis(value.populationWindowEnd) &&
          A.dedupe(A.map(value.routes, (route) => route.routeId)).length === value.routes.length &&
          A.every(value.routes, (route) =>
            A.some(value.inventory.routes, (declared) => declared.routeId === route.routeId)
          ) &&
          A.reduce(
            value.routes,
            0,
            (total, route) => total + size(route.launches) + size(route.acceptedEvents) + size(route.visibleEvents)
          ) <= 16384,
        {
          identifier: "CoverageBoundary",
          message: "Coverage evidence must match the declared boundary, window and routes within its population limit.",
        }
      )
    )
    .pipe(
      $I.annoteSchema("ObservationCoverageInput", {
        description: "Bounded route observations bound to independent population evidence.",
      })
    )
) {}

const Comparison = S.TaggedUnion({
  Unassessed: {},
  DenominatorUnknown: { observed: S.Natural, exhaustive: S.Boolean },
  ObservationUnknown: { expected: S.Natural },
  Compared: {
    expected: S.Natural,
    observed: S.Natural,
    matched: S.Natural,
    notObserved: S.Natural,
    unexpected: S.Natural,
    exhaustive: S.Boolean,
  },
}).pipe(
  $I.annoteSchema("Comparison", {
    description: "Set reconciliation without converting unknown populations to zero or absence to loss.",
  })
);
const compare = (expected: ObservationPopulation, observed: typeof Snapshot.Type): typeof Comparison.Type =>
  ObservationPopulation.match(expected, {
    Unknown: (): typeof Comparison.Type =>
      Snapshot.match(observed, {
        Unknown: (): typeof Comparison.Type => Comparison.cases.Unassessed.make({}),
        Observed: (snapshot): typeof Comparison.Type =>
          Comparison.cases.DenominatorUnknown.make({ observed: snapshot.ids.length, exhaustive: snapshot.exhaustive }),
      }),
    Enumerated: (population): typeof Comparison.Type =>
      Snapshot.match(observed, {
        Unknown: (): typeof Comparison.Type =>
          Comparison.cases.ObservationUnknown.make({ expected: population.ids.length }),
        Observed: (snapshot): typeof Comparison.Type => {
          const matched = A.intersection(population.ids, snapshot.ids).length;
          return Comparison.cases.Compared.make({
            expected: population.ids.length,
            observed: snapshot.ids.length,
            matched,
            notObserved: population.ids.length - matched,
            unexpected: snapshot.ids.length - matched,
            exhaustive: snapshot.exhaustive,
          });
        },
      }),
  });

/**
 * Auditable report retaining independent declarations and observation provenance.
 *
 * **Example** (Inspect the report codec)
 * ```ts
 * import { ObservationCoverageReport } from "@beep/repo-ai-metrics/observation-coverage"
 * console.log(typeof ObservationCoverageReport.make)
 * ```
 * **Details** Accepted and visible populations are separate snapshots. No subset relation is inferred across local retention or backend query boundaries. Not-observed is not proof of loss; these counts are not task success or universal session coverage.
 * @category models
 * @since 0.0.0
 */
export class ObservationCoverageReport extends S.Opaque<ObservationCoverageReport, { readonly brand: unique symbol }>()(
  S.Struct({
    evidence: ObservationCoverageInput,
    routes: S.Array(
      S.Struct({ routeId: Sha256Hex, launches: Comparison, acceptedEvents: Comparison, visibleEvents: Comparison })
    ).check(S.isMaxLength(4096)),
  }).pipe(
    $I.annoteSchema("ObservationCoverageReport", {
      description: "Route-scoped comparisons with original evidence and explicit unknowns.",
    })
  )
) {}

/**
 * Compare each declared route to its own independently observed populations.
 *
 * **Example** (Locate the reconciler)
 * ```ts
 * import { reconcileObservationCoverage } from "@beep/repo-ai-metrics/observation-coverage"
 * console.log(typeof reconcileObservationCoverage)
 * ```
 * **Details** A duplicate ID on a different route does not satisfy this route's expectation. Missing observations remain unknown, including explicitly empty expectations.
 * @category utilities
 * @since 0.0.0
 */
export const reconcileObservationCoverage = (input: ObservationCoverageInput): ObservationCoverageReport =>
  ObservationCoverageReport.make({
    evidence: input,
    routes: A.map(input.inventory.routes, (route) => {
      const observation = A.findFirst(input.routes, (candidate) => candidate.routeId === route.routeId);
      const snapshot = (field: "launches" | "acceptedEvents" | "visibleEvents") =>
        O.match(observation, {
          onNone: () => Snapshot.cases.Unknown.make({}),
          onSome: (value) => value[field],
        });
      return {
        routeId: route.routeId,
        launches: compare(route.knownLaunches, snapshot("launches")),
        acceptedEvents: compare(route.expectedEvents, snapshot("acceptedEvents")),
        visibleEvents: compare(route.expectedEvents, snapshot("visibleEvents")),
      };
    }),
  });

/**
 * Read a bounded metadata-only coverage evidence file with sanitized failures.
 *
 * **Example** (Read declared evidence)
 * ```ts
 * import { readObservationCoverage } from "@beep/repo-ai-metrics/observation-coverage"
 * console.log(readObservationCoverage("/tmp/synthetic-coverage.json"))
 * ```
 * **Details** The 4 MiB limit is enforced before parsing. Excess fields are rejected; schema diagnostics cannot leak their contents or paths.
 * @category services
 * @since 0.0.0
 */
export const readObservationCoverage = Effect.fn("AiMetrics.readObservationCoverage")(function* (path: string) {
  const error = (message: string) => ObservationInventoryError.make({ message });
  const json = yield* readBoundedMetadata(path, 4_194_304, {
    readFailed: error("Unable to read observation coverage."),
    oversize: error("Observation coverage exceeds its byte limit."),
    encodingFailed: error("Invalid observation coverage encoding."),
  });
  return yield* S.decodeEffect(S.fromJsonString(ObservationCoverageInput), { onExcessProperty: "error" })(json).pipe(
    Effect.mapError(() => error("Invalid observation coverage boundary or evidence."))
  );
});

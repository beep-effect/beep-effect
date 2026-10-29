/**
 * Read-only declared observability inventory report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  ObservationCoverageReport,
  readObservationCoverage,
  reconcileObservationCoverage,
} from "@beep/repo-ai-metrics/observation-coverage";
import {
  ObservationInventoryReport,
  observationRouteStatus,
  readObservationInventory,
  reportObservationInventory,
} from "@beep/repo-ai-metrics/observation-inventory";
import {
  ObservationRootProbeResult,
  probeObservationRoots,
  readObservationRootDeclaration,
} from "@beep/repo-ai-metrics/observation-root-probe";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AiMetricsCommandError } from "../AIMetrics.errors.ts";

const $I = $RepoCliId.create("commands/AIMetrics/internal/Inventory");

/**
 * Inputs for a read-only inventory report.
 *
 * **Example**
 * ```ts
 * import { InventoryReportOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Inventory"
 * const options = InventoryReportOptions.make({ input: "/tmp/synthetic-inventory.json", json: true })
 * console.log(options.json)
 * ```
 * **Details** The file must contain a bounded metadata manifest, never transcript content.
 * @category models
 * @since 0.0.0
 */
export class InventoryReportOptions extends S.Opaque<InventoryReportOptions, { readonly brand: unique symbol }>()(
  S.Struct({ input: S.String, json: S.Boolean }).pipe(
    $I.annoteSchema("InventoryReportOptions", { description: "Declared inventory file and output format." })
  )
) {}

/**
 * Print evidence-scoped denominators and current route health from a declared inventory.
 *
 * **Example**
 * ```ts
 * import { InventoryReportOptions, makeInventoryReportProgram } from "@beep/repo-cli/commands/AIMetrics/internal/Inventory"
 * const program = makeInventoryReportProgram(InventoryReportOptions.make({ input: "/tmp/synthetic-inventory.json", json: true }))
 * console.log(program)
 * ```
 * **Details** Reads metadata only. Does not discover transcripts, mutate enrollment or activate collection.
 * @category programs
 * @since 0.0.0
 */
export const makeInventoryReportProgram = Effect.fn("AIMetrics.makeInventoryReportProgram")(function* (
  options: InventoryReportOptions
) {
  const inventory = yield* readObservationInventory(options.input).pipe(
    Effect.mapError((error) => AiMetricsCommandError.make({ message: error.message, cause: error.message }))
  );
  const now = yield* DateTime.now;
  const report = reportObservationInventory(inventory, now);
  if (options.json) {
    const json = yield* S.encodeEffect(S.fromJsonString(ObservationInventoryReport))(report).pipe(
      Effect.mapError(() =>
        AiMetricsCommandError.make({
          message: "Unable to encode observation inventory report.",
          cause: "Inventory report encoding failed.",
        })
      )
    );
    return yield* Console.log(json);
  }
  const counts = report.summary;
  yield* Console.log(
    `Population window: [${DateTime.formatIso(inventory.populationWindowStart)}, ${DateTime.formatIso(inventory.populationWindowEnd)})`
  );
  yield* Console.log(
    `Declared inventory: ${counts.hosts} hosts, ${counts.roots} roots, ${counts.declaredRoutes} routes`
  );
  yield* Console.log(
    `Capabilities: ${counts.supportedRoutes} supported, ${counts.unsupportedRoutes} unsupported, ${counts.unknownCapabilityRoutes} unknown; ${counts.excludedRoutes} deliberately excluded`
  );
  yield* Console.log(
    `Launch population: ${counts.unknownLaunchRoutes > 0 ? "unknown" : counts.knownLaunches}; ${counts.knownLaunches} distinct launch IDs enumerated; ${counts.unknownLaunchRoutes} routes have unknown launch populations`
  );
  yield* Console.log(
    `Expected event population: ${counts.unknownEventRoutes > 0 ? "unknown" : counts.expectedEvents}; ${counts.expectedEvents} distinct event IDs enumerated; ${counts.unknownEventRoutes} routes have unknown expected-event populations`
  );
  yield* Console.log(
    "These counts describe the declared evidence boundary. They do not establish capture of all activity."
  );
  for (const route of inventory.routes) {
    yield* Console.log(
      `${route.harness} / ${route.surface} / ${route.transport}: ${observationRouteStatus(now, route)} (route ${route.routeId})`
    );
  }
});

/**
 * Inspect declared roots without starting AI metrics collection.
 *
 * **Example**
 * ```ts
 * import { InventoryReportOptions, makeInventoryProbeProgram } from "@beep/repo-cli/commands/AIMetrics/internal/Inventory"
 * console.log(makeInventoryProbeProgram(InventoryReportOptions.make({ input: "/tmp/synthetic-roots.json", json: true })))
 * ```
 * **Details** Reads the existing hash salt through redacted configuration. JSON contains the inventory and safe root receipts; private declarations and salt are never printed.
 * @category programs
 * @since 0.0.0
 */
export const makeInventoryProbeProgram = Effect.fn("AIMetrics.makeInventoryProbeProgram")(function* (
  options: InventoryReportOptions
) {
  const error = (message: string) => AiMetricsCommandError.make({ message, cause: message });
  const declaration = yield* readObservationRootDeclaration(options.input).pipe(
    Effect.mapError((cause) => error(cause.message))
  );
  const salt = yield* Config.Redacted("BEEP_AI_METRICS_HASH_SALT").pipe(
    Effect.mapError(() => error("Root probes require BEEP_AI_METRICS_HASH_SALT in the configured secret environment."))
  );
  const result = yield* probeObservationRoots(declaration, salt).pipe(Effect.mapError((cause) => error(cause.message)));
  if (options.json) {
    return yield* Console.log(
      yield* S.encodeEffect(S.fromJsonString(ObservationRootProbeResult))(result).pipe(
        Effect.mapError(() => error("Unable to encode root probe result."))
      )
    );
  }
  yield* Console.log(
    `Declared root probe: 1 host, ${result.inventory.roots.length} roots, 7 unqualified harness routes`
  );
  for (const root of result.inventory.roots) {
    yield* Console.log(
      `${root.rootId}: ${root.availability}; clone identity ${Str.toLowerCase(root.cloneId._tag)}; evidence ${root.evidenceId}`
    );
  }
  yield* Console.log(
    "Harness capabilities, launch populations and expected events remain unknown. Collection is unchanged."
  );
});

/**
 * Reconcile declared populations with separately evidenced collection snapshots.
 *
 * **Example** (Read synthetic coverage evidence)
 * ```ts
 * import { InventoryReportOptions, makeInventoryCoverageProgram } from "@beep/repo-cli/commands/AIMetrics/internal/Inventory"
 * console.log(makeInventoryCoverageProgram(InventoryReportOptions.make({ input: "/tmp/synthetic-coverage.json", json: true })))
 * ```
 * **Details** This command performs no network requests and changes no enrollment. Evidence timestamps, route identity and query completeness remain visible in JSON.
 * @category programs
 * @since 0.0.0
 */
export const makeInventoryCoverageProgram = Effect.fn("AIMetrics.makeInventoryCoverageProgram")(function* (
  options: InventoryReportOptions
) {
  const input = yield* readObservationCoverage(options.input).pipe(
    Effect.mapError((error) => AiMetricsCommandError.make({ message: error.message, cause: error.message }))
  );
  const report = reconcileObservationCoverage(input);
  if (options.json) {
    return yield* Console.log(
      yield* S.encodeEffect(S.fromJsonString(ObservationCoverageReport))(report).pipe(
        Effect.mapError(() =>
          AiMetricsCommandError.make({
            message: "Unable to encode coverage report.",
            cause: "Coverage report encoding failed.",
          })
        )
      )
    );
  }
  yield* Console.log(`Observation snapshot: ${DateTime.formatIso(input.observedAt)}`);
  yield* Console.log(
    `Population window: [${DateTime.formatIso(input.populationWindowStart)}, ${DateTime.formatIso(input.populationWindowEnd)})`
  );
  for (const [declared, route] of A.zip(input.inventory.routes, report.routes)) {
    yield* Console.log(`${declared.harness} / ${declared.surface} / ${declared.transport} (route ${route.routeId})`);
    for (const label of ["launches", "acceptedEvents", "visibleEvents"] as const) {
      const value = route[label];
      switch (value._tag) {
        case "Unassessed":
          yield* Console.log(`  ${label}: denominator and observations unknown`);
          break;
        case "DenominatorUnknown":
          yield* Console.log(
            `  ${label}: ${value.observed} observed; denominator unknown; snapshot ${value.exhaustive ? "complete" : "partial"}`
          );
          break;
        case "ObservationUnknown":
          yield* Console.log(`  ${label}: ${value.expected} expected; observations unknown`);
          break;
        case "Compared":
          yield* Console.log(
            `  ${label}: ${value.matched}/${value.expected} expected IDs observed, ${value.notObserved} not observed, ${value.unexpected} outside expected set; snapshot ${value.exhaustive ? "complete" : "partial"}`
          );
          break;
      }
    }
  }
  yield* Console.log(
    "Not observed does not prove loss. Local acceptance does not prove backend visibility. This declared boundary does not cover all activity."
  );
});

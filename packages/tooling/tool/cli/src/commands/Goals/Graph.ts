/**
 * Read-only capability-graph commands: `beep goals next|explain|catalog`.
 *
 * **Details**
 *
 * Every command runs the same pipeline: scan and decode the whole goals
 * census (fail-closed), compile the pure projection, answer the graph
 * questions with the in-memory SQLite engine, build the versioned
 * report, and print it. Nothing is written anywhere.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { GoalSlug } from "./Bootstrap.schemas.ts";
import { GoalGraphInputError, GoalGraphOperationalError } from "./Goals.errors.ts";
import { decodeGoalManifest } from "./Goals.schemas.ts";
import {
  buildCatalogReport,
  buildExplainReport,
  buildFrontierReport,
  compileCapabilityProjection,
  renderCatalogHuman,
  renderExplainHuman,
  renderFrontierHuman,
} from "./Graph.projection.ts";
import { CapabilityCatalogReport, GoalExplainReport, GoalFrontierReport } from "./Graph.schemas.ts";
import { runCapabilityGraph } from "./Graph.sqlite.ts";
import { listGoalPacketsStrict, parseGoalManifestText } from "./Inventory.ts";
import { canonicalJsonTextPretty } from "./PacketCore/PacketDigest.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

const decodeGoalSlug = S.decodeEffect(GoalSlug);

const decodePacketManifest = Effect.fn("Goals.decodePacketManifest")(function* (record: GoalPacketRecord) {
  const where = `goals/${record.slug}/ops/manifest.json`;
  if (record.manifestText === undefined) {
    return yield* GoalGraphOperationalError.new(`${where} is missing; the capability graph refuses a partial census.`)(
      undefined
    );
  }
  const parsed = parseGoalManifestText(record.manifestText);
  if (O.isNone(parsed)) {
    return yield* GoalGraphOperationalError.new(`${where} is not valid JSON.`)(undefined);
  }
  const manifest = yield* decodeGoalManifest(parsed.value).pipe(
    Effect.mapError((issue) => GoalGraphOperationalError.new(`${where} does not decode: ${issue.message}`)(issue))
  );
  if (manifest.initiative.id !== record.slug) {
    return yield* GoalGraphOperationalError.new(
      `${where} declares initiative.id "${manifest.initiative.id}" but lives in goals/${record.slug}.`
    )(undefined);
  }
  return manifest;
});

/**
 * Scans, decodes, and compiles the whole goals census into a capability projection.
 *
 * **Details**
 *
 * Fail-closed: a missing, unparsable, or undecodable manifest, or one whose
 * `initiative.id` differs from its directory, refuses the whole projection with
 * a {@link GoalGraphOperationalError} naming the packet. A broken census never
 * renders as a smaller graph.
 *
 * **Example** (Build the census-load effect)
 *
 * ```ts
 * import { loadCapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(loadCapabilityProjection())) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const loadCapabilityProjection = Effect.fn("Goals.loadCapabilityProjection")(function* (repoRoot = ".") {
  const records = yield* listGoalPacketsStrict(repoRoot).pipe(
    Effect.mapError(GoalGraphOperationalError.new("Failed to scan goals/ for the capability graph."))
  );
  const manifests = yield* Effect.forEach(records, decodePacketManifest, { concurrency: 1 });
  return compileCapabilityProjection(manifests);
});

const renderJson = <A, I>(schema: S.ConstraintCodec<A, I>, report: A) =>
  S.encodeUnknownEffect(schema)(report).pipe(
    Effect.map(canonicalJsonTextPretty),
    Effect.mapError(GoalGraphOperationalError.new("Failed to encode the capability-graph report."))
  );

const printReport = Effect.fn("Goals.printGraphReport")(function* <A, I>(
  schema: S.ConstraintCodec<A, I>,
  report: A,
  json: boolean,
  human: (report: A) => string
) {
  if (json) {
    const rendered = yield* renderJson(schema, report);
    yield* Console.log(rendered.trimEnd());
  } else {
    yield* Console.log(human(report));
  }
});

const loadGraph = Effect.fn("Goals.loadCapabilityGraph")(function* () {
  const projection = yield* loadCapabilityProjection();
  const answers = yield* runCapabilityGraph(projection);
  return { projection, answers } as const;
});

const reportFailures =
  (command: string) =>
  <A, R>(effect: Effect.Effect<A, GoalGraphInputError | GoalGraphOperationalError, R>) =>
    effect.pipe(
      Effect.catchTags({
        GoalGraphInputError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:${command}] ${error.message}`);
          return yield* failWithReportedExit(`goals ${command}: ${error.message}`);
        }),
        GoalGraphOperationalError: Effect.fn(function* (error) {
          yield* Console.error(`[goals:${command}] ${error.message}`);
          return yield* failWithReportedExit(`goals ${command}: ${error.message}`);
        }),
      })
    );

const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the report as canonical JSON")
);

/**
 * `bun run beep goals next` — print the actionable goal frontier.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { goalsNextCommand } from "@beep/repo-cli/commands/Goals/Graph"
 *
 * console.log(goalsNextCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsNextCommand = Command.make(
  "next",
  { json: jsonFlag },
  Effect.fn(function* (options) {
    return yield* Effect.gen(function* () {
      const { projection, answers } = yield* loadGraph();
      yield* printReport(
        GoalFrontierReport,
        buildFrontierReport(projection, answers),
        options.json,
        renderFrontierHuman
      );
    }).pipe(reportFailures("next"));
  })
).pipe(
  Command.withDescription("Print the actionable goal frontier, fog capabilities, and requirement cycles (read-only)")
);

/**
 * `bun run beep goals explain <slug>` — explain why one packet is or is not ready.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { goalsExplainCommand } from "@beep/repo-cli/commands/Goals/Graph"
 *
 * console.log(goalsExplainCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsExplainCommand = Command.make(
  "explain",
  {
    slug: Argument.String("slug").pipe(Argument.withDescription("Goal packet slug under goals/")),
    json: jsonFlag,
  },
  Effect.fn(function* (options) {
    return yield* Effect.gen(function* () {
      const slug = yield* decodeGoalSlug(options.slug).pipe(
        Effect.mapError((issue) => GoalGraphInputError.new(`slug "${options.slug}" is invalid: ${issue.message}`))
      );
      const { projection, answers } = yield* loadGraph();
      const report = yield* buildExplainReport(projection, answers, slug).pipe(
        Effect.fromOption,
        Effect.mapError(() =>
          GoalGraphInputError.new(
            `No goal packet "${slug}". Plan one with: bun run beep goals bootstrap --slug ${slug} --title "<title>" --mission "<mission>" --plan`
          )
        )
      );
      yield* printReport(GoalExplainReport, report, options.json, renderExplainHuman);
    }).pipe(reportFailures("explain"));
  })
).pipe(
  Command.withDescription("Explain one packet's readiness: requirements, unlock path, and cycle membership (read-only)")
);

/**
 * `bun run beep goals catalog` — print the generated capability catalog.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { goalsCatalogCommand } from "@beep/repo-cli/commands/Goals/Graph"
 *
 * console.log(goalsCatalogCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsCatalogCommand = Command.make(
  "catalog",
  { json: jsonFlag },
  Effect.fn(function* (options) {
    return yield* Effect.gen(function* () {
      const { projection, answers } = yield* loadGraph();
      yield* printReport(
        CapabilityCatalogReport,
        buildCatalogReport(projection, answers),
        options.json,
        renderCatalogHuman
      );
    }).pipe(reportFailures("catalog"));
  })
).pipe(
  Command.withDescription(
    "Print the generated capability catalog: providers, consumers, collisions, orphans, fog, strands, duplicates (read-only)"
  )
);

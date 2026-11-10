/**
 * `beep palantiri mcp`: the parcels as MCP tools on stdio, read through the
 * same in-process client as `beep palantiri parcel`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { annotateFourHints, FourHintAnnotations, handshakeMcpProtocols, sanitizedToolkit } from "@beep/mcp-kit";
import { PalantiriClient, ParcelEnvelope, parcelSpecs } from "@beep/palantiri";
import * as A from "effect/Array";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { parcelReadOptions, readParcel, renderParcelBound, resolveParcelSession } from "./Palantiri.runtime.ts";
import {
  NoToolInput,
  ParcelCatalog,
  ParcelListing,
  ParcelToolInput,
  SinceLastCheckToolInput,
} from "./Palantiri.schemas.ts";
import type { ParcelId, ParcelReadOptions, ParcelSpec } from "@beep/palantiri";

const readHints = FourHintAnnotations.make({ readOnly: true, destructive: false, idempotent: true, openWorld: false });

// Reading since-last-check moves the session's cursor, so a second call
// returns only what is newer.
const cursorHints = FourHintAnnotations.make({
  readOnly: false,
  destructive: false,
  idempotent: false,
  openWorld: false,
});

/**
 * The MCP tool name of a parcel: `palantiri_` and the id in snake case.
 *
 * **Example** (Name the account-headroom tool)
 *
 * ```ts
 * import { parcelToolName } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(parcelToolName("account-headroom")) // "palantiri_account_headroom"
 * ```
 *
 * @param id - A parcel id such as `lane-reds`.
 * @returns The name MCP clients call, such as `palantiri_lane_reds`.
 * @category utilities
 * @since 0.0.0
 */
export const parcelToolName = (id: ParcelId): string => `palantiri_${Str.replaceAll("-", "_")(id)}`;

const parcelTool = <const Name extends string>(name: Name, description: string) =>
  annotateFourHints(
    Tool.make(name, {
      description: `${description} Returns the same JSON envelope as \`beep palantiri parcel <id> --json\`: summary, freshness (Fresh or Unknown with a reason), budget-capped items and an N-of-M receipt.`,
      parameters: ParcelToolInput,
      success: ParcelEnvelope,
    }),
    readHints
  );

const listTool = annotateFourHints(
  Tool.make("palantiri_parcels", {
    description: "List every parcel with its key, freshness bound, sources and the tool that reads it.",
    parameters: NoToolInput,
    success: ParcelCatalog,
  }),
  readHints
);

const accountHeadroomTool = parcelTool(
  "palantiri_account_headroom",
  "Remaining plan quota per account, by provider and ordinal, with freshness."
);

const laneRedsTool = parcelTool(
  "palantiri_lane_reds",
  "Open P0/P1 inbox rows and failed proof jobs across this checkout and every live lane."
);

const hostPressureTool = parcelTool(
  "palantiri_host_pressure",
  "CPU, memory and IO pressure stall figures, available memory and admission occupancy."
);

const appErrorClassesTool = parcelTool(
  "palantiri_app_error_classes",
  "App error classes; always Unknown{no-source} until a telemetry query adapter exists."
);

const githubHeadroomTool = parcelTool(
  "palantiri_github_headroom",
  "Remaining GitHub requests per identity and resource on this host, the reserve state and the last hour's top spenders."
);

const sinceLastCheckTool = annotateFourHints(
  Tool.make("palantiri_since_last_check", {
    description:
      "Session notes and inbox rows newer than this session's last read, then moves its read cursor. Returns the same JSON envelope as `beep palantiri parcel since-last-check --json`.",
    parameters: SinceLastCheckToolInput,
    success: ParcelEnvelope,
  }),
  cursorHints
);

/**
 * Every Palantiri MCP tool: the list tool and one tool per parcel.
 *
 * **Example** (Name the tools)
 *
 * ```ts
 * import { PalantiriToolkit } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(Object.keys(PalantiriToolkit.tools).length) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PalantiriToolkit = Toolkit.make(
  listTool,
  accountHeadroomTool,
  laneRedsTool,
  hostPressureTool,
  appErrorClassesTool,
  sinceLastCheckTool,
  githubHeadroomTool
);

const listingOf = (spec: ParcelSpec): ParcelListing =>
  ParcelListing.make({
    id: spec.id,
    key: spec.key,
    freshnessBound: renderParcelBound(spec.freshnessBound),
    sources: spec.sources,
    tool: parcelToolName(spec.id),
  });

/**
 * The tool handlers over a Palantiri client: each parcel tool runs the same
 * read as `beep palantiri parcel <id>`, so its encoded JSON is the CLI's.
 *
 * **Details**
 *
 * A read never fails on a source (an unavailable source is an `Unknown`
 * parcel), and every tool names a known parcel, so a failure of the
 * in-process client is a defect, reported as an internal tool error.
 *
 * **Example** (Build the handler layer)
 *
 * ```ts
 * import { layerPalantiriToolHandlers } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerPalantiriToolHandlers)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerPalantiriToolHandlers = PalantiriToolkit.toLayer(
  Effect.gen(function* () {
    const client = yield* PalantiriClient;
    const readWith = (id: ParcelId, options: ParcelReadOptions) =>
      readParcel(id, options).pipe(Effect.provideService(PalantiriClient, client), Effect.orDie);
    const read = (id: ParcelId) => (input: ParcelToolInput) =>
      readWith(id, parcelReadOptions(O.fromUndefinedOr(input.budget), O.none()));
    return PalantiriToolkit.of({
      palantiri_parcels: () => Effect.succeed(ParcelCatalog.make({ parcels: A.map(parcelSpecs, listingOf) })),
      palantiri_account_headroom: read("account-headroom"),
      palantiri_lane_reds: read("lane-reds"),
      palantiri_host_pressure: read("host-pressure"),
      palantiri_app_error_classes: read("app-error-classes"),
      palantiri_github_headroom: read("github-headroom"),
      palantiri_since_last_check: Effect.fn("PalantiriTools.sinceLastCheck")(function* (input) {
        const session = yield* resolveParcelSession(O.fromUndefinedOr(input.session));
        return yield* readWith("since-last-check", parcelReadOptions(O.fromUndefinedOr(input.budget), session));
      }),
    });
  })
);

/**
 * The Palantiri tools served on stdio over the given client runtime.
 *
 * **Example** (Compose the server)
 *
 * ```ts
 * import { layerPalantiriMcp, layerPalantiriRuntime, layerPalantiriSourcesLive } from "@beep/repo-cli/test/Palantiri"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerPalantiriMcp(layerPalantiriRuntime(layerPalantiriSourcesLive, Layer.empty)))) // true
 * ```
 *
 * @param runtime - The in-process client, with its sources and telemetry.
 * @returns A stdio MCP server layer exposing the seven Palantiri tools.
 * @category layers
 * @since 0.0.0
 */
export const layerPalantiriMcp = <E, R>(runtime: Layer.Layer<PalantiriClient, E, R>) =>
  sanitizedToolkit(PalantiriToolkit).pipe(
    Layer.provide(layerPalantiriToolHandlers.pipe(Layer.provide(runtime))),
    Layer.provide(
      McpServer.layerStdio({
        name: "beep-palantiri",
        version: "0.0.0",
        instructions:
          "Schema-typed, freshness-checked observability parcels. Call palantiri_parcels for the list; each parcel tool returns summary-first JSON with an N-of-M receipt.",
        protocols: handshakeMcpProtocols,
      })
    )
  );

/**
 * Run an MCP server layer until interrupted, with every log line on stderr:
 * stdout carries the protocol, so a log line there would corrupt it.
 *
 * **Example** (Serve an empty server)
 *
 * ```ts
 * import { servePalantiriMcp } from "@beep/repo-cli/test/Palantiri"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Effect.isEffect(servePalantiriMcp(Layer.empty))) // true
 * ```
 *
 * @param server - The server layer to launch.
 * @returns An effect that never completes on its own.
 * @category utilities
 * @since 0.0.0
 */
export const servePalantiriMcp = <E, R>(server: Layer.Layer<never, E, R>): Effect.Effect<never, E, R> =>
  Layer.launch(server).pipe(Effect.provideService(Logger.LogToStderr, true));

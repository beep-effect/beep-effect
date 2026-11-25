/**
 * App-owned bundle loading and long-lived MCP host resource composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makePracticeKgServerLayer, PracticeKgMcpServerConfig } from "@beep/law-practice-server";
import { MatterWallLive } from "@beep/law-practice-server/MatterAuthority";
import { makePracticeKgHostResourcesLayer } from "@beep/law-practice-server/PracticeKgHost";
import * as Layer from "effect/Layer";
import { PRACTICE_KG_EXTENSION_VERSION } from "../Version.ts";
import { layerPracticeKgTelemetryProduction } from "./Telemetry.ts";
import type { PracticeKgBundleContext } from "@beep/law-practice-server";

/**
 * Compose the stdio server with app-owned PGlite and DuckDB resources and the
 * host's matter wall, leaving its telemetry to the caller.
 *
 * **Details**
 *
 * The telemetry layer must be provided to this layer, not beside it: the MCP
 * server forks its request fibers while it builds, and they keep the tracer
 * and loggers in place at that moment.
 *
 * **Example** (Compose the server without telemetry)
 *
 * ```ts
 * import { makePracticeKgHostServerLayer } from "../../src/runtime/Host.ts"
 * import type { PracticeKgBundleContext } from "@beep/law-practice-server"
 *
 * const compose = (context: PracticeKgBundleContext) => makePracticeKgHostServerLayer(context)
 * console.log(typeof compose)
 * ```
 *
 * @param context - Validated bundle paths and manifest metadata.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgHostServerLayer = (context: PracticeKgBundleContext) =>
  makePracticeKgServerLayer(
    PracticeKgMcpServerConfig.make({
      name: "beep-practice-kg",
      version: PRACTICE_KG_EXTENSION_VERSION,
    })
  ).pipe(Layer.provide(Layer.merge(makePracticeKgHostResourcesLayer(context), MatterWallLive)));

/**
 * Compose the stdio server with app-owned PGlite and DuckDB resources and the
 * strict-tier telemetry, which exports nothing, seals every held-back export
 * into the encrypted spool under the telemetry directory, and keeps stderr
 * shape-only.
 *
 * **Example** (Compose practice host layer)
 *
 * ```ts
 * import { makePracticeKgHostLayer } from "../../src/runtime/Host.ts"
 * import type { PracticeKgBundleContext } from "@beep/law-practice-server"
 *
 * const compose = (context: PracticeKgBundleContext) => makePracticeKgHostLayer(context)
 * console.log(typeof compose)
 * ```
 *
 * @param context - Validated bundle paths and manifest metadata.
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgHostLayer = (context: PracticeKgBundleContext) =>
  makePracticeKgHostServerLayer(context).pipe(Layer.provide(layerPracticeKgTelemetryProduction));

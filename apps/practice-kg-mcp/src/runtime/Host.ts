/**
 * App-owned stdio MCP host composition over the shared practice KG host resources.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makePracticeKgServerLayer, PracticeKgMcpServerConfig } from "@beep/law-practice-server";
import { makePracticeKgHostResourcesLayer } from "@beep/law-practice-server/PracticeKgHost";
import * as Layer from "effect/Layer";
import { PRACTICE_KG_EXTENSION_VERSION } from "../Version.ts";
import type { PracticeKgBundleContext } from "@beep/law-practice-server";

/**
 * Compose the stdio server with the bundle's PGlite and DuckDB resources.
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
  makePracticeKgServerLayer(
    PracticeKgMcpServerConfig.make({
      name: "beep-practice-kg",
      version: PRACTICE_KG_EXTENSION_VERSION,
    })
  ).pipe(Layer.provide(makePracticeKgHostResourcesLayer(context)));

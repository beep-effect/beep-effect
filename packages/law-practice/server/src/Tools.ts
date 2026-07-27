/**
 * MCP toolkit and stdio server composition for the practice KG host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { PracticeKgToolkit } from "@beep/law-practice-use-cases/server";
import { composeGatedLayers, gatedLayer, SourceAuthRegistration, sanitizedToolkit } from "@beep/mcp-kit";
import { Layer } from "effect";
import * as S from "effect/Schema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { PracticeKgToolkitHandlersLive } from "./PracticeKg.tool-handlers.ts";
import type { DuckDb } from "@beep/duckdb";
import type { Stdio } from "effect/Stdio";
import type { SqlClient } from "effect/unstable/sql/SqlClient";
import type { PracticeKgBundle } from "./PracticeKg.tool-handlers.ts";

const $I = $LawPracticeServerId.create("Tools");

/**
 * Credential-free source registration for the local practice KG bundle.
 *
 * @example
 * ```ts
 * import { PracticeKgSourceAuthRegistration } from "@beep/law-practice-server"
 *
 * console.log(PracticeKgSourceAuthRegistration.gate) // "none"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PracticeKgSourceAuthRegistration = SourceAuthRegistration.make({
  envVar: "PRACTICE_KG_BUNDLE_DIR",
  gate: "none",
  name: "Local practice knowledge graph",
});

/**
 * MCP identity advertised by the practice KG stdio server.
 *
 * @example
 * ```ts
 * import { PracticeKgMcpServerConfig } from "@beep/law-practice-server"
 *
 * const config = PracticeKgMcpServerConfig.make({ name: "beep-practice-kg", version: "0.0.0" })
 * console.log(config.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgMcpServerConfig extends S.Class<PracticeKgMcpServerConfig>($I`PracticeKgMcpServerConfig`)(
  {
    name: S.NonEmptyString,
    version: S.NonEmptyString,
  },
  $I.annote("PracticeKgMcpServerConfig", {
    description: "Protocol-facing name and version for the practice KG MCP server.",
  })
) {}

/**
 * Compose the sanitized, credential-free toolkit registration.
 *
 * @example
 * ```ts
 * import { PracticeKgToolkitLayer } from "@beep/law-practice-server"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(PracticeKgToolkitLayer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PracticeKgToolkitLayer = composeGatedLayers(
  gatedLayer(
    PracticeKgSourceAuthRegistration,
    sanitizedToolkit(PracticeKgToolkit).pipe(Layer.provide(PracticeKgToolkitHandlersLive))
  )
);

/**
 * Compose the stdio MCP server while leaving both databases host-injected.
 *
 * @example
 * ```ts
 * import { makePracticeKgServerLayer, PracticeKgMcpServerConfig } from "@beep/law-practice-server"
 * import { Layer } from "effect"
 *
 * const layer = makePracticeKgServerLayer(
 *   PracticeKgMcpServerConfig.make({ name: "beep-practice-kg", version: "0.0.0" })
 * )
 * console.log(Layer.isLayer(layer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgServerLayer = (
  config: PracticeKgMcpServerConfig
): Layer.Layer<never, never, DuckDb | PracticeKgBundle | SqlClient | Stdio> =>
  PracticeKgToolkitLayer.pipe(
    Layer.provide(McpServer.layerStdio({ name: config.name, version: config.version })),
    Layer.orDie
  );

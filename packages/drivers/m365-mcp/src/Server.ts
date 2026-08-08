/**
 * Microsoft 365 MCP stdio server wiring.
 *
 * @category layers
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { sanitizedToolkit } from "@beep/mcp-kit";
import { Layer } from "effect";
import * as S from "effect/Schema";
import * as McpProtocol from "effect/unstable/ai/McpProtocol";
import * as McpServer from "effect/unstable/ai/McpServer";
import { M365ToolkitHandlersLive } from "./M365Handlers.ts";
import { M365Toolkit } from "./M365Tools.ts";
import type { M365 } from "@beep/m365";
import type { Stdio } from "effect/Stdio";

const $I = $M365McpId.create("Server");

/**
 * Configuration for the Microsoft 365 MCP server.
 *
 * **Example** (Creating server configuration)
 *
 * ```ts
 * import { M365McpServerConfig } from "@beep/m365-mcp"
 *
 * const config = M365McpServerConfig.make({ name: "beep-m365", version: "0.1.0" })
 * console.log(config.name)
 * // "beep-m365"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class M365McpServerConfig extends S.Class<M365McpServerConfig>($I`M365McpServerConfig`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable MCP server name advertised during stdio initialization.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Protocol-facing version advertised to MCP clients.",
    }),
  },
  $I.annote("M365McpServerConfig", {
    description: "Configuration for the MCP server identity advertised to clients.",
  })
) {}

/**
 * Builds the stdio MCP server layer.
 *
 * **Example** (Building stdio server layer)
 *
 * ```ts
 * import { M365McpServerConfig, makeServerLayer } from "@beep/m365-mcp"
 * import { Layer } from "effect"
 *
 * const layer = makeServerLayer(M365McpServerConfig.make({ name: "beep-m365", version: "0.1.0" }))
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category layers
 * @since 0.1.0
 */
export const makeServerLayer = (config: M365McpServerConfig): Layer.Layer<never, never, M365 | Stdio> =>
  sanitizedToolkit(M365Toolkit).pipe(
    Layer.provide(M365ToolkitHandlersLive),
    Layer.provide(
      McpServer.layerStdio({
        name: config.name,
        version: config.version,
        protocols: [McpProtocol.v2025_06_18],
      })
    ),
    Layer.orDie
  );

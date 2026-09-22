/**
 * Microsoft 365 MCP stdio server wiring.
 *
 * @category layers
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { sanitizedToolkit, statelessMcpProtocols } from "@beep/mcp-kit";
import { Layer } from "effect";
import * as S from "effect/Schema";
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
 * Instructions the host advertises through `server/discover`.
 *
 * **Example** (Reading the advertised instructions)
 *
 * ```ts
 * import { M365_MCP_INSTRUCTIONS } from "@beep/m365-mcp/Server"
 *
 * console.log(M365_MCP_INSTRUCTIONS.startsWith("Read-only Microsoft 365"))
 * // true
 * ```
 *
 * @category constants
 * @since 0.1.0
 */
export const M365_MCP_INSTRUCTIONS =
  "Read-only Microsoft 365 tools over Microsoft Graph: list sites, drives, drive items, messages and events, and read single items by id. Call tools directly; the host is stateless and needs no initialize handshake.";

/**
 * Registrations only: the sanitized Microsoft 365 toolkit and its handlers
 * with no transport attached.
 *
 * **Details**
 *
 * {@link makeServerLayer} composes this with `McpServer.layerStdio`; the kit
 * conformance runner (`@beep/mcp-kit/test/Conformance`) mounts it on its own
 * HTTP and stdio harnesses, which is how the host proves `2026-07-28`.
 *
 * **Example** (Mounting the registrations without a transport)
 *
 * ```ts
 * import { M365McpRegistrationsLive } from "@beep/m365-mcp/Server"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(M365McpRegistrationsLive))
 * // true
 * ```
 *
 * @category layers
 * @since 0.1.0
 */
export const M365McpRegistrationsLive: Layer.Layer<never, never, M365> = sanitizedToolkit(M365Toolkit).pipe(
  Layer.provide(M365ToolkitHandlersLive),
  Layer.orDie
);

/**
 * Builds the stdio MCP server layer.
 *
 * **Details**
 *
 * The host serves `[McpProtocol.v2026_07_28]` only, pinned through the kit's
 * `statelessMcpProtocols` (D-posture): clients open with `server/discover`
 * and call tools with request metadata; a legacy `initialize` is answered
 * with `-32022` and the supported list. There is no session.
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
  M365McpRegistrationsLive.pipe(
    Layer.provide(
      McpServer.layerStdio({
        name: config.name,
        version: config.version,
        instructions: M365_MCP_INSTRUCTIONS,
        protocols: statelessMcpProtocols,
      })
    ),
    Layer.orDie
  );

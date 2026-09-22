/**
 * MCP server wiring for the thin `@beep/uspto` MCP proving host.
 *
 * Mounts the {@link UsptoToolkit} into a single stdio-transport MCP server,
 * gating its registration through `@beep/mcp-kit`'s `SourceAuth`/
 * `ToolkitComposition` seam: the toolkit's `soft` gate never vanishes at
 * composition (`composeGatedLayers` always folds it in), so the actual
 * `api_key_required` degradation happens at call time inside
 * {@link UsptoHandlers.UsptoToolkitHandlersLive}. Server bootstrap mirrors
 * `packages/drivers/nlp-mcp/src/Server.ts:101-107`'s `Layer.mergeAll` seam.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $UsptoMcpId } from "@beep/identity/packages";
import { composeGatedLayers, gatedLayer, sanitizedToolkit, statelessMcpProtocols } from "@beep/mcp-kit";
import { Uspto } from "@beep/uspto";
import { Layer } from "effect";
import * as S from "effect/Schema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { UsptoToolkitHandlersLive } from "./UsptoHandlers.ts";
import { UsptoSourceAuthRegistration } from "./UsptoSourceAuth.ts";
import { UsptoToolkit } from "./UsptoTools.ts";
import type * as Config from "effect/Config";
import type { Stdio } from "effect/Stdio";

const $I = $UsptoMcpId.create("Server");

/**
 * Configuration for the MCP server identity advertised to clients.
 *
 * **Example** (Make a server config)
 *
 * ```ts
 * import { UsptoMcpServerConfig } from "@beep/uspto-mcp/Server"
 *
 * const config = UsptoMcpServerConfig.make({ name: "beep-uspto", version: "0.0.0" })
 * console.log(config.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoMcpServerConfig extends S.Class<UsptoMcpServerConfig>($I`UsptoMcpServerConfig`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable MCP server name advertised during stdio initialization.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Semantic package or protocol-facing version advertised to MCP clients.",
    }),
  },
  $I.annote("UsptoMcpServerConfig", {
    description: "Configuration for the MCP server identity advertised to clients.",
  })
) {}

/**
 * Instructions the host advertises through `server/discover`.
 *
 * **Example** (Reading the advertised instructions)
 *
 * ```ts
 * import { USPTO_MCP_INSTRUCTIONS } from "@beep/uspto-mcp/Server"
 *
 * console.log(USPTO_MCP_INSTRUCTIONS.startsWith("USPTO Open Data Portal"))
 * // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const USPTO_MCP_INSTRUCTIONS =
  "USPTO Open Data Portal tools: search patent applications by query expression and read an application's file-wrapper documents, reshaped to a named field tier under a byte budget. Without USPTO_API_KEY the tools answer with an api_key_required envelope instead of failing. Call tools directly; the host is stateless and needs no initialize handshake.";

/**
 * Registrations only: the soft-gated, sanitized USPTO toolkit with no
 * transport and no concrete `Uspto` client attached.
 *
 * **Details**
 *
 * The toolkit folds through `composeGatedLayers`/`gatedLayer` keyed on
 * {@link UsptoSourceAuthRegistration} (`soft` gate — always mounts) and uses
 * `sanitizedToolkit` so raw tool parameters never reach span attributes.
 * {@link makeServerLayer} provides `Uspto.layer` and `McpServer.layerStdio`;
 * the kit conformance runner provides a fixture client and its own transport.
 *
 * **Example** (Mounting the registrations without a transport)
 *
 * ```ts
 * import { UsptoMcpRegistrationsLive } from "@beep/uspto-mcp/Server"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(UsptoMcpRegistrationsLive))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UsptoMcpRegistrationsLive: Layer.Layer<never, Config.ConfigError, Uspto> = composeGatedLayers(
  gatedLayer(UsptoSourceAuthRegistration, sanitizedToolkit(UsptoToolkit).pipe(Layer.provide(UsptoToolkitHandlersLive)))
);

/**
 * Build the stdio-transport MCP server layer exposing the USPTO toolkit.
 *
 * **Details**
 *
 * The host serves `[McpProtocol.v2026_07_28]` only, pinned through the kit's
 * `statelessMcpProtocols` (D-posture): clients open with `server/discover`
 * and call tools with request metadata; a legacy `initialize` is answered
 * with `-32022` and the supported list. There is no session.
 *
 * **Example** (Launch stdio MCP server)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { makeServerLayer, UsptoMcpServerConfig } from "@beep/uspto-mcp/Server"
 * import * as NodeStdio from "@effect/platform-node/NodeStdio"
 *
 * const server = makeServerLayer(UsptoMcpServerConfig.make({ name: "beep-uspto", version: "0.0.0" })).pipe(
 *   Layer.provide(NodeStdio.layer)
 * )
 *
 * void Layer.launch(server)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeServerLayer = (config: UsptoMcpServerConfig): Layer.Layer<never, never, Stdio> =>
  UsptoMcpRegistrationsLive.pipe(
    Layer.provide(Uspto.layer),
    Layer.provide(
      McpServer.layerStdio({
        name: config.name,
        version: config.version,
        instructions: USPTO_MCP_INSTRUCTIONS,
        protocols: statelessMcpProtocols,
      })
    ),
    Layer.orDie
  );

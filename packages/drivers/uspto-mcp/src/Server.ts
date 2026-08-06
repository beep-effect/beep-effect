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
import { composeGatedLayers, gatedLayer, sanitizedToolkit } from "@beep/mcp-kit";
import { Uspto } from "@beep/uspto";
import { Layer } from "effect";
import * as S from "effect/Schema";
import * as McpProtocol from "effect/unstable/ai/McpProtocol";
import * as McpServer from "effect/unstable/ai/McpServer";
import { UsptoToolkitHandlersLive } from "./UsptoHandlers.ts";
import { UsptoSourceAuthRegistration } from "./UsptoSourceAuth.ts";
import { UsptoToolkit } from "./UsptoTools.ts";
import type { Stdio } from "effect/Stdio";

const $I = $UsptoMcpId.create("Server");

/**
 * Configuration for the MCP server identity advertised to clients.
 *
 * @example
 * ```ts
 * import { UsptoMcpServerConfig } from "@beep/uspto-mcp/Server"
 *
 * const config = UsptoMcpServerConfig.make({ name: "beep-uspto", version: "0.0.0" })
 * console.log(config.name)
 * ```
 *
 * @since 0.0.0
 * @category models
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
 * Build the stdio-transport MCP server layer exposing the USPTO toolkit.
 *
 * The toolkit's registration layer folds through `@beep/mcp-kit`'s
 * `composeGatedLayers`/`gatedLayer` seam keyed on
 * {@link UsptoSourceAuthRegistration} (`soft` gate — always mounts) and uses
 * `sanitizedToolkit` so raw tool parameters never reach span attributes
 * (`12-observability.md` §3), matching the `mcp-host-retrofit` hygiene this
 * host ships with from the start.
 *
 * @example
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
 * @since 0.0.0
 * @category layers
 */
export const makeServerLayer = (config: UsptoMcpServerConfig): Layer.Layer<never, never, Stdio> => {
  const usptoToolkitLayer = sanitizedToolkit(UsptoToolkit).pipe(
    Layer.provide(UsptoToolkitHandlersLive),
    Layer.provide(Uspto.layer)
  );

  return composeGatedLayers(gatedLayer(UsptoSourceAuthRegistration, usptoToolkitLayer)).pipe(
    Layer.provide(
      McpServer.layerStdio({ name: config.name, version: config.version, protocols: [McpProtocol.v2025_06_18] })
    ),
    Layer.orDie
  );
};

/**
 * MCP server wiring for the thin GovInfo and eCFR stdio host.
 *
 * Both source toolkits register through `sanitizedToolkit`, retain the shipped
 * source-auth gate enum through `gatedLayer`/`composeGatedLayers`, and share one
 * `McpServer.layerStdio` server.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Ecfr } from "@beep/ecfr";
import { Govinfo } from "@beep/govinfo";
import { $GovLegalMcpId } from "@beep/identity/packages";
import { composeGatedLayers, gatedLayer, sanitizedToolkit } from "@beep/mcp-kit";
import { Layer } from "effect";
import * as S from "effect/Schema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { EcfrToolkitHandlersLive, GovinfoToolkitHandlersLive } from "./Handlers.ts";
import { EcfrSourceAuthRegistration, GovinfoSourceAuthRegistration } from "./SourceAuth.ts";
import { EcfrToolkit, GovinfoToolkit } from "./Tools.ts";
import type { EcfrError } from "@beep/ecfr";
import type { GovinfoError } from "@beep/govinfo";
import type { Stdio } from "effect/Stdio";

const $I = $GovLegalMcpId.create("Server");

/**
 * Identity advertised by the gov-legal MCP stdio server.
 *
 * @example
 * ```ts
 * import { GovLegalMcpServerConfig } from "@beep/gov-legal-mcp/Server"
 *
 * const config = GovLegalMcpServerConfig.make({ name: "beep-gov-legal", version: "0.0.0" })
 * console.log(config.name)
 * // "beep-gov-legal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GovLegalMcpServerConfig extends S.Class<GovLegalMcpServerConfig>($I`GovLegalMcpServerConfig`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable MCP server name advertised during stdio initialization.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Package version advertised to MCP clients.",
    }),
  },
  $I.annote("GovLegalMcpServerConfig", {
    description: "Identity advertised by the gov-legal MCP stdio server.",
  })
) {}

/**
 * Build the stdio MCP layer with the keyless eCFR and hard-gated GovInfo
 * toolkits.
 *
 * @example
 * ```ts
 * import { Layer } from "effect"
 * import * as NodeStdio from "@effect/platform-node/NodeStdio"
 * import { GovLegalMcpServerConfig, makeServerLayer } from "@beep/gov-legal-mcp/Server"
 *
 * const server = makeServerLayer(
 *   GovLegalMcpServerConfig.make({ name: "beep-gov-legal", version: "0.0.0" })
 * ).pipe(Layer.provide(NodeStdio.layer))
 * console.log(Layer.isLayer(server))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeServerLayer = (config: GovLegalMcpServerConfig): Layer.Layer<never, never, Stdio> => {
  const ecfrToolkitLayer = sanitizedToolkit(EcfrToolkit).pipe(
    Layer.provide(EcfrToolkitHandlersLive),
    Layer.provide(Ecfr.layer)
  );
  const govinfoToolkitLayer = sanitizedToolkit(GovinfoToolkit).pipe(
    Layer.provide(GovinfoToolkitHandlersLive),
    Layer.provide(Govinfo.layer)
  );

  return composeGatedLayers<EcfrError | GovinfoError>(
    gatedLayer(EcfrSourceAuthRegistration, ecfrToolkitLayer),
    gatedLayer(GovinfoSourceAuthRegistration, govinfoToolkitLayer)
  ).pipe(Layer.provide(McpServer.layerStdio({ name: config.name, version: config.version })), Layer.orDie);
};

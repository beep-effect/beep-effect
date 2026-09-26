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
import { composeGatedLayers, gatedLayer, sanitizedToolkit, statelessMcpProtocols } from "@beep/mcp-kit";
import { Layer } from "effect";
import * as McpServer from "effect/ai/McpServer";
import * as S from "effect/Schema";
import { EcfrToolkitHandlersLive, GovinfoToolkitHandlersLive } from "./Handlers.ts";
import { EcfrSourceAuthRegistration, GovinfoSourceAuthRegistration } from "./SourceAuth.ts";
import { EcfrToolkit, GovinfoToolkit } from "./Tools.ts";
import type { EcfrError } from "@beep/ecfr";
import type { GovinfoError } from "@beep/govinfo";
import type * as Config from "effect/Config";
import type { Stdio } from "effect/Stdio";

const $I = $GovLegalMcpId.create("Server");

/**
 * Identity advertised by the gov-legal MCP stdio server.
 *
 * **Example** (Making a server config)
 *
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
 * Instructions the host advertises through `server/discover`.
 *
 * **Example** (Reading the advertised instructions)
 *
 * ```ts
 * import { GOV_LEGAL_MCP_INSTRUCTIONS } from "@beep/gov-legal-mcp/Server"
 *
 * console.log(GOV_LEGAL_MCP_INSTRUCTIONS.startsWith("US federal legal sources"))
 * // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GOV_LEGAL_MCP_INSTRUCTIONS =
  "US federal legal sources: the keyless eCFR tools list titles, search regulations and read a title's structure; the GovInfo search tool mounts only when GOVINFO_API_KEY is set. Call tools directly; the host is stateless and needs no initialize handshake.";

/**
 * Registrations only: both source toolkits behind their source-auth gates,
 * sanitized, with no transport and no concrete `Ecfr`/`Govinfo` client.
 *
 * **Details**
 *
 * {@link makeServerLayer} provides the production clients and
 * `McpServer.layerStdio`; the kit conformance runner provides fixture clients
 * and its own transport.
 *
 * **Example** (Mounting the registrations without a transport)
 *
 * ```ts
 * import { GovLegalMcpRegistrationsLive } from "@beep/gov-legal-mcp/Server"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(GovLegalMcpRegistrationsLive))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GovLegalMcpRegistrationsLive: Layer.Layer<
  never,
  Config.ConfigError | EcfrError | GovinfoError,
  Ecfr | Govinfo
> = composeGatedLayers<EcfrError | GovinfoError, Ecfr | Govinfo>(
  gatedLayer(EcfrSourceAuthRegistration, sanitizedToolkit(EcfrToolkit).pipe(Layer.provide(EcfrToolkitHandlersLive))),
  gatedLayer(
    GovinfoSourceAuthRegistration,
    sanitizedToolkit(GovinfoToolkit).pipe(Layer.provide(GovinfoToolkitHandlersLive))
  )
);

/**
 * Build the stdio MCP layer with the keyless eCFR and hard-gated GovInfo
 * toolkits.
 *
 * **Details**
 *
 * The host serves `[McpProtocol.v2026_07_28]` only, pinned through the kit's
 * `statelessMcpProtocols` (D-posture): clients open with `server/discover`
 * and call tools with request metadata; a legacy `initialize` is answered
 * with `-32022` and the supported list. There is no session.
 *
 * **Example** (Building stdio MCP layer)
 *
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
export const makeServerLayer = (config: GovLegalMcpServerConfig): Layer.Layer<never, never, Stdio> =>
  GovLegalMcpRegistrationsLive.pipe(
    Layer.provide(Layer.merge(Ecfr.layer, Govinfo.layer)),
    Layer.provide(
      McpServer.layerStdio({
        name: config.name,
        version: config.version,
        instructions: GOV_LEGAL_MCP_INSTRUCTIONS,
        protocols: statelessMcpProtocols,
      })
    ),
    Layer.orDie
  );

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
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import * as S from "effect/Schema";
import { PracticeKgToolkitHandlersLive } from "./PracticeKg.tool-handlers.ts";
import type { DuckDb } from "@beep/duckdb";
import type { Path } from "effect";
import type * as Arr from "effect/Array";
import type { Stdio } from "effect/Stdio";
import type { SqlClient } from "effect/sql/SqlClient";
import type { PracticeKgBundle } from "./PracticeKg.host.ts";

/**
 * Canonical read-only practice KG toolkit, re-exported so packaging and smoke
 * lanes derive tool names from the served surface instead of hand-copied
 * lists.
 *
 * **Example** (Count toolkit tool keys)
 *
 * ```ts
 * import { PracticeKgToolkit } from "@beep/law-practice-server"
 * import * as R from "effect/Record"
 *
 * console.log(R.keys(PracticeKgToolkit.tools).length) // 9
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export { PracticeKgToolkit } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("Tools");

/**
 * Credential-free source registration for the local practice KG bundle.
 *
 * **Example** (Log source auth gate)
 *
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
 * **Example** (Make MCP server config)
 *
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
 * **Example** (Check toolkit layer type)
 *
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
 * Instructions the host advertises through `server/discover`.
 *
 * **Example** (Reading the advertised instructions)
 *
 * ```ts
 * import { PRACTICE_KG_MCP_INSTRUCTIONS } from "@beep/law-practice-server"
 *
 * console.log(PRACTICE_KG_MCP_INSTRUCTIONS.startsWith("Local practice knowledge graph"))
 * // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
/**
 * MCP protocol versions the practice KG host answers.
 *
 * **Gotchas**
 *
 * This host is installed into Claude Desktop, which opens every server with an
 * `initialize` handshake (it offered `2025-11-25` on 2026-10-06). A host that
 * lists only the stateless `2026-07-28` adapter refuses that handshake and
 * never starts, so the handshake-era adapters stay listed here. The stateless
 * adapter comes first, which keeps it the default for clients that send no
 * handshake. Do not narrow this list without proving the result against a real
 * Claude Desktop install.
 *
 * **Example** (Count the supported versions)
 *
 * ```ts
 * import { practiceKgMcpProtocols } from "@beep/law-practice-server"
 *
 * console.log(practiceKgMcpProtocols.map((protocol) => protocol.protocolVersion))
 * // ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const practiceKgMcpProtocols: Arr.NonEmptyReadonlyArray<McpProtocol.ProtocolAdapter> = [
  McpProtocol.v2026_07_28,
  McpProtocol.v2025_11_25,
  McpProtocol.v2025_06_18,
  McpProtocol.v2025_03_26,
  McpProtocol.v2024_11_05,
];

export const PRACTICE_KG_MCP_INSTRUCTIONS =
  "Local practice knowledge graph over a pre-built bundle: look up clients, docket families and applications, search corpus text and emails, read documents by digest and trace provenance. Every result names its bundle_version. Clients may open with an initialize handshake or call tools directly; both work.";

/**
 * Build the stdio MCP server layer from the toolkit registration.
 *
 * **Details**
 *
 * The host serves `[McpProtocol.v2026_07_28]` only, pinned through the kit's
 * `statelessMcpProtocols` (D-posture): clients open with `server/discover`
 * and call tools with request metadata; a legacy `initialize` is answered
 * with `-32022` and the supported list. There is no session. The kit
 * conformance runner mounts {@link PracticeKgToolkitLayer} on its own
 * transport, which is how the host proves the protocol.
 *
 * **Example** (Build the server layer)
 *
 * ```ts
 * import { makePracticeKgServerLayer, PracticeKgMcpServerConfig } from "@beep/law-practice-server"
 * import * as Layer from "effect/Layer"
 *
 * const layer = makePracticeKgServerLayer(PracticeKgMcpServerConfig.make({ name: "beep-practice-kg", version: "0.0.0" }))
 * console.log(Layer.isLayer(layer))
 * // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makePracticeKgServerLayer = (
  config: PracticeKgMcpServerConfig
): Layer.Layer<never, never, DuckDb | Path.Path | PracticeKgBundle | SqlClient | Stdio> =>
  PracticeKgToolkitLayer.pipe(
    Layer.provide(
      McpServer.layerStdio({
        name: config.name,
        version: config.version,
        instructions: PRACTICE_KG_MCP_INSTRUCTIONS,
        protocols: practiceKgMcpProtocols,
      })
    ),
    Layer.orDie
  );

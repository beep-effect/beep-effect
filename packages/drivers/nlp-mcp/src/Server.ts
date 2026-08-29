/**
 * MCP server wiring for the `@beep/nlp` MCP driver.
 *
 * Mounts two toolkits into a single stdio-transport MCP server:
 *
 * - the canonical {@link NlpToolkit} from `@beep/nlp`, backed by the wink-nlp
 *   handler layer ({@link WinkNlpToolkitLive}) from `@beep/wink`; and
 * - the {@link StreamingToolkit} streaming/file-IO toolkit, backed by its
 *   {@link StreamingToolkitHandlersLive} handler layer.
 *
 * Both toolkit layers consume the same memoized `McpServer` provided by
 * {@link McpServer.layerStdio}, so they register into one server. The streaming
 * handlers' `FileSystem`/`Path` requirement intentionally bubbles up so the
 * layer stays platform-agnostic; a node implementation is provided at the
 * entrypoint (see `./bin.ts`).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpMcpId } from "@beep/identity";
import { sanitizedToolkit } from "@beep/mcp-kit";
import { NlpToolkit } from "@beep/nlp-processing/Tools/NlpToolkit";
import { WinkNlpToolkitLive } from "@beep/wink";
import { Layer } from "effect";
import * as S from "effect/Schema";
import * as McpProtocol from "effect/unstable/ai/McpProtocol";
import * as McpServer from "effect/unstable/ai/McpServer";
import { StreamingToolkitHandlersLive } from "./StreamingHandlers.ts";
import { StreamingToolkit } from "./StreamingTools.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { Stdio } from "effect/Stdio";
import type * as HttpClient from "effect/unstable/http/HttpClient";

const $I = $NlpMcpId.create("Server");

/**
 * Configuration for the MCP server identity advertised to clients.
 *
 * **Example** (Creating server identity config)
 *
 * ```ts
 * import { NlpMcpServerConfig } from "@beep/nlp-mcp/Server"
 *
 * const config = NlpMcpServerConfig.make({ name: "beep-nlp", version: "0.0.0" })
 * console.log(config.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NlpMcpServerConfig extends S.Class<NlpMcpServerConfig>($I`NlpMcpServerConfig`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable MCP server name advertised during stdio initialization.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Semantic package or protocol-facing version advertised to MCP clients.",
    }),
  },
  $I.annote("NlpMcpServerConfig", {
    description: "Configuration for the MCP server identity advertised to clients.",
  })
) {}

/**
 * Build the stdio-transport MCP server layer exposing the NLP and streaming
 * toolkits.
 *
 * **Details**
 *
 * Registers both the canonical {@link NlpToolkit} (with its wink-backed
 * {@link WinkNlpToolkitLive} handlers) and the {@link StreamingToolkit} (with
 * its {@link StreamingToolkitHandlersLive} handlers) into one MCP server served
 * over stdio with NDJSON-RPC framing. Handler-layer initialization failures are
 * promoted to defects via {@link Layer.orDie}, so the resolved layer has no
 * error channel. The layer requires the `Stdio` transport, the
 * `FileSystem`/`Path` services used by the streaming handlers, and an
 * `HttpClient` for URL-backed dataset loads; provide `NodeStdio.layer`,
 * `NodeFileSystem.layer`, `NodePath.layer` (from `@effect/platform-node`) and
 * `FetchHttpClient.layer` (from `effect/unstable/http`) at the entrypoint.
 *
 * **Example** (Providing Node platform layers)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { makeServerLayer } from "@beep/nlp-mcp/Server"
 * import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import * as NodeStdio from "@effect/platform-node/NodeStdio"
 * import { FetchHttpClient } from "effect/unstable/http"
 *
 * const server = makeServerLayer({ name: "beep-nlp", version: "0.0.0" }).pipe(
 *   Layer.provide(NodeStdio.layer),
 *   Layer.provide(NodeFileSystem.layer),
 *   Layer.provide(NodePath.layer),
 *   Layer.provide(FetchHttpClient.layer)
 * )
 *
 * void Layer.launch(server)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeServerLayer = (
  config: NlpMcpServerConfig
): Layer.Layer<never, never, FileSystem.FileSystem | HttpClient.HttpClient | Path.Path | Stdio> =>
  Layer.mergeAll(
    sanitizedToolkit(NlpToolkit).pipe(Layer.provide(WinkNlpToolkitLive)),
    sanitizedToolkit(StreamingToolkit).pipe(Layer.provide(StreamingToolkitHandlersLive))
  ).pipe(
    Layer.provide(
      McpServer.layerStdio({ name: config.name, version: config.version, protocols: [McpProtocol.v2025_06_18] })
    ),
    Layer.orDie
  );

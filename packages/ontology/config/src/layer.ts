/**
 * Live ontology configuration resolution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import { OntologyMcpConfig, OntologyMcpMutationsEnabledConfig, OntologyMcpServerConfig } from "./McpConfig.ts";
import { OntologyConfig, OntologyServerConfig, OntologyWorkspaceRootConfig } from "./ServerConfig.ts";

const readOntologyConfig = Effect.fn("Ontology.Config.read")(function* () {
  const workspaceRoot = yield* OntologyWorkspaceRootConfig;
  return OntologyServerConfig.make({ workspaceRoot });
});

const readOntologyMcpConfig = Effect.fn("Ontology.McpConfig.read")(function* () {
  const mutationsEnabled = yield* OntologyMcpMutationsEnabledConfig;
  return OntologyMcpServerConfig.make({ mutationsEnabled });
});

/**
 * Live ontology configuration backed by the ambient Effect `ConfigProvider`.
 *
 * **Details**
 *
 * Missing or empty workspace-root configuration remains in the typed
 * `ConfigError` channel so application entrypoints decide startup policy.
 *
 * **Example** (Provide workspace root config)
 *
 * ```ts
 * import { OntologyConfigLive } from "@beep/ontology-config/layer"
 * import { OntologyConfig } from "@beep/ontology-config/server"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const program = OntologyConfig.pipe(
 *   Effect.map((config) => config.workspaceRoot),
 *   Effect.provide(OntologyConfigLive),
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: "/srv/ontology" })
 *     )
 *   )
 * )
 *
 * Effect.runPromise(program).then(console.log) // "/srv/ontology"
 * ```
 *
 * @effects Reads and validates `ONTOLOGY_WORKSPACE_ROOT` from the ambient
 * `ConfigProvider`; missing and empty values remain typed configuration errors.
 * @category layers
 * @since 0.0.0
 */
export const OntologyConfigLive = Layer.effect(OntologyConfig, readOntologyConfig());

/**
 * Live ontology MCP surface configuration backed by the ambient Effect
 * `ConfigProvider`.
 *
 * **Example** (Enable MCP mutations config)
 *
 * ```ts
 * import { OntologyMcpConfigLive } from "@beep/ontology-config/layer"
 * import { OntologyMcpConfig } from "@beep/ontology-config/server"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const program = OntologyMcpConfig.pipe(
 *   Effect.map((config) => config.mutationsEnabled),
 *   Effect.provide(OntologyMcpConfigLive),
 *   Effect.provide(
 *     ConfigProvider.layer(
 *       ConfigProvider.fromUnknown({ ONTOLOGY_MCP_MUTATIONS_ENABLED: "true" })
 *     )
 *   )
 * )
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @effects Reads `ONTOLOGY_MCP_MUTATIONS_ENABLED` from the ambient
 * `ConfigProvider`, defaulting to `false`; a malformed value remains a typed
 * configuration error so the entrypoint decides startup policy.
 * @category layers
 * @since 0.0.0
 */
export const OntologyMcpConfigLive = Layer.effect(OntologyMcpConfig, readOntologyMcpConfig());

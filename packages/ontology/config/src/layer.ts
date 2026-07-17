/**
 * Live ontology configuration resolution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import { OntologyConfig, OntologyServerConfig, OntologyWorkspaceRootConfig } from "./ServerConfig.ts";

const readOntologyConfig = Effect.fn("Ontology.Config.read")(function* () {
  const workspaceRoot = yield* OntologyWorkspaceRootConfig;
  return OntologyServerConfig.make({ workspaceRoot });
});

/**
 * Live ontology configuration backed by the ambient Effect `ConfigProvider`.
 *
 * Missing or empty workspace-root configuration remains in the typed
 * `ConfigError` channel so application entrypoints decide startup policy.
 *
 * @example
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

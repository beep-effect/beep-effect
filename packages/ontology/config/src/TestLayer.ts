/**
 * Ontology configuration test-layer constructors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Layer } from "effect";
import { OntologyMcpConfig } from "./McpConfig.ts";
import { OntologyConfig } from "./ServerConfig.ts";
import type { OntologyMcpServerConfig } from "./McpConfig.ts";
import type { OntologyServerConfig } from "./ServerConfig.ts";

/**
 * Build a static ontology configuration layer for tests.
 *
 * @example
 * ```ts
 * import { OntologyServerConfig } from "@beep/ontology-config/server"
 * import { makeOntologyConfigTest } from "@beep/ontology-config/test"
 *
 * const layer = makeOntologyConfigTest(
 *   OntologyServerConfig.make({ workspaceRoot: "/tmp/ontology" })
 * )
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeOntologyConfigTest = (config: OntologyServerConfig) => Layer.succeed(OntologyConfig, config);

/**
 * Build a static ontology MCP surface configuration layer for tests.
 *
 * @example
 * ```ts
 * import { OntologyMcpServerConfig } from "@beep/ontology-config/server"
 * import { makeOntologyMcpConfigTest } from "@beep/ontology-config/test"
 * import { Layer } from "effect"
 *
 * const layer = makeOntologyMcpConfigTest(
 *   OntologyMcpServerConfig.make({ mutationsEnabled: true })
 * )
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeOntologyMcpConfigTest = (config: OntologyMcpServerConfig) => Layer.succeed(OntologyMcpConfig, config);

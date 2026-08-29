/**
 * Ontology server config exports.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

/**
 * Server-only ontology MCP surface configuration contract.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  OntologyMcpConfig,
  type OntologyMcpConfigShape,
  OntologyMcpMutationsEnabledConfig,
  OntologyMcpServerConfig,
} from "./McpConfig.ts";
/**
 * Server-only ontology filesystem authority configuration contract.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  OntologyConfig,
  type OntologyConfigShape,
  OntologyServerConfig,
  OntologyWorkspaceRootConfig,
} from "./ServerConfig.ts";

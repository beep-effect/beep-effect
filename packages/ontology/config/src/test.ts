/**
 * Ontology config test exports.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

/**
 * Typed ontology configuration contracts used by tests.
 *
 * @category testing
 * @since 0.0.0
 */
export { OntologyMcpConfig, type OntologyMcpConfigShape, OntologyMcpServerConfig } from "./McpConfig.ts";
/**
 * Typed ontology configuration contracts used by tests.
 *
 * @category testing
 * @since 0.0.0
 */
export { OntologyConfig, type OntologyConfigShape, OntologyServerConfig } from "./ServerConfig.ts";
/**
 * Static ontology configuration layer constructors for tests.
 *
 * @category testing
 * @since 0.0.0
 */
export { makeOntologyConfigTest, makeOntologyMcpConfigTest } from "./TestLayer.ts";

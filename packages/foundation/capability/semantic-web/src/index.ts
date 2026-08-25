/**
 * RDF capability service contracts: SPARQL query, SHACL validation, and RDF
 * dataset canonicalization. Value models, vocabularies, and interop DTOs live
 * in `@beep/rdf`; live implementations live in the driver packages and their
 * consumers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Identity registry RDF binding and SHACL policy projection exports.
 *
 * @category codecs
 * @since 0.0.0
 */
export * from "./identity/index.ts";
/**
 * RDF dataset canonicalization service contract exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./services/canonicalization.ts";
/**
 * SHACL validation service contract exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./services/shacl-validation.ts";
/**
 * SPARQL query service contract exports.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./services/sparql-query.ts";

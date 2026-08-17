/**
 * Pure schema-backed surface of the effect-ontology v4 experiment.
 *
 * @remarks
 * Namespaced exports preserve domain-family boundaries and prevent accidental
 * collisions between distinct event, job, identity, and RDF vocabularies.
 * This scratchpad barrel is intentionally not re-exported by
 * `scratchpad/index.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Schema-backed error families and their exhaustive unions.
 *
 * @example
 * ```ts
 * import { Error } from "@effect-ontology/index.ts"
 * console.log(Error.ActivityError)
 * ```
 *
 * @category namespaces
 * @since 0.0.0
 */
export * as Error from "./Error/index.ts";
/**
 * Content, storage, ontology, document, run, and batch identifiers.
 *
 * @example
 * ```ts
 * import { Identity } from "@effect-ontology/index.ts"
 * console.log(Identity.ContentHash.is("a".repeat(64))) // true
 * ```
 *
 * @category namespaces
 * @since 0.0.0
 */
export * as Identity from "./Identity.ts";
/**
 * Immutable ontology, extraction, workflow, and agent models.
 *
 * @example
 * ```ts
 * import { Model } from "@effect-ontology/index.ts"
 * console.log(Model.AgentType.is.extractor("extractor")) // true
 * ```
 *
 * @category namespaces
 * @since 0.0.0
 */
export * as Model from "./Model/index.ts";
/**
 * Exact storage-path codecs, constructors, and parsers.
 *
 * @example
 * ```ts
 * import { PathLayout } from "@effect-ontology/index.ts"
 * console.log(PathLayout.StoragePathSegment.is("article-42")) // true
 * ```
 *
 * @category namespaces
 * @since 0.0.0
 */
export * as PathLayout from "./PathLayout.ts";
/**
 * Canonical RDF terms and experiment-owned vocabulary constants.
 *
 * @example
 * ```ts
 * import { Rdf } from "@effect-ontology/index.ts"
 * console.log(Rdf.CLAIMS.Claim.termType) // "NamedNode"
 * ```
 *
 * @category namespaces
 * @since 0.0.0
 */
export * as Rdf from "./Rdf/index.ts";
/**
 * API, ingestion, knowledge, search, timeline, and SHACL contracts.
 *
 * @example
 * ```ts
 * import { Schema } from "@effect-ontology/index.ts"
 * console.log(Schema.DocumentType.is.contract("contract")) // true
 * ```
 *
 * @category namespaces
 * @since 0.0.0
 */
export * as Schema from "./Schema/index.ts";

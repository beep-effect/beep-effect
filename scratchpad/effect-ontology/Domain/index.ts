/**
 * Pure schema-backed surface of the effect-ontology v4 experiment.
 *
 * **Details**
 *
 * * Namespaced exports preserve domain-family boundaries and prevent accidental
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
 * **Example** (Use index)
 * ```ts
 * import { Error } from "@effect-ontology/index.ts"
 * console.log(Error.ActivityError)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as Error from "./Error/index.ts";
/**
 * Content, storage, ontology, document, run, and batch identifiers.
 *
 * **Example** (Use index)
 * ```ts
 * import { Identity } from "@effect-ontology/index.ts"
 * console.log(Identity.ContentHash.is("a".repeat(64))) // true
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as Identity from "./Identity.ts";
/**
 * Immutable ontology, extraction, workflow, and agent models.
 *
 * **Example** (Use index)
 * ```ts
 * import { Model } from "@effect-ontology/index.ts"
 * console.log(Model.AgentType.is.extractor("extractor")) // true
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as Model from "./Model/index.ts";
/**
 * Exact storage-path codecs, constructors, and parsers.
 *
 * **Example** (Use index)
 * ```ts
 * import { PathLayout } from "@effect-ontology/index.ts"
 * console.log(PathLayout.StoragePathSegment.is("article-42")) // true
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as PathLayout from "./PathLayout.ts";
/**
 * Canonical RDF terms and experiment-owned vocabulary constants.
 *
 * **Example** (Use index)
 * ```ts
 * import { Rdf } from "@effect-ontology/index.ts"
 * console.log(Rdf.CLAIMS.Claim.termType) // "NamedNode"
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as Rdf from "./Rdf/index.ts";
/**
 * API, ingestion, knowledge, search, timeline, and SHACL contracts.
 *
 * **Example** (Use index)
 * ```ts
 * import { Schema } from "@effect-ontology/index.ts"
 * console.log(Schema.DocumentType.is.contract("contract")) // true
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as Schema from "./Schema/index.ts";

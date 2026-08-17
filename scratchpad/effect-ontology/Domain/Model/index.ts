/**
 * Public effect-ontology domain models.
 *
 * **Details**
 *
 * * Unlike the incomplete upstream barrel, this experiment exposes every ported
 * model module. Canonical foundation concepts still resolve to their
 * `@beep/*` owners inside those modules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Agent identities, configuration, pipeline state, and lifecycle events.
 *
 * **Example** (Use index)
 * ```ts
 * import { AgentId } from "@effect-ontology/Model/index"
 * console.log(AgentId.is("validator")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Agent.ts";
/**
 * Batch-ingestion states and transition policy.
 *
 * **Example** (Use index)
 * ```ts
 * import { BatchState } from "@effect-ontology/Model/index"
 * console.log(BatchState.isValidTransition("Pending", "Preprocessing")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./BatchWorkflow.ts";
/**
 * Core tracked entities, mentions, participants, and events.
 *
 * **Example** (Use index)
 * ```ts
 * import { CoreClass } from "@effect-ontology/Model/index"
 * console.log(
 *   CoreClass.is["https://effect-ontology.dev/core#TrackedEntity"](
 *     "https://effect-ontology.dev/core#TrackedEntity"
 *   )
 * ) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./CoreOntology.ts";
/**
 * Extracted document content enriched with source metadata.
 *
 * **Example** (Use index)
 * ```ts
 * import { SourceType } from "@effect-ontology/Model/index"
 * console.log(SourceType.is.news("news")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./EnrichedContent.ts";
/**
 * Ontology-typed entities, relations, evidence, and knowledge graphs.
 *
 * **Example** (Use index)
 * ```ts
 * import { RelationObject } from "@effect-ontology/Model/index"
 * console.log(RelationObject.cases.Text.make({ value: "Alice" }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Entity.ts";
/**
 * Mention resolution nodes, edges, and complete default policy.
 *
 * **Example** (Use index)
 * ```ts
 * import { EntityResolutionConfig } from "@effect-ontology/Model/index"
 * console.log(EntityResolutionConfig.default().similarityThreshold)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./EntityResolution.ts";
/**
 * Entity clusters, similarity edges, graph lookup, and resolution statistics.
 *
 * **Example** (Use index)
 * ```ts
 * import { EntityResolutionGraph } from "@effect-ontology/Model/index"
 * console.log(EntityResolutionGraph)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./EntityResolutionGraph.ts";
/**
 * Extraction run status, configuration, audit, output, and statistics.
 *
 * **Example** (Use index)
 * ```ts
 * import { ExtractionRun } from "@effect-ontology/Model/index"
 * console.log(ExtractionRun.chunkId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./ExtractionRun.ts";
/**
 * Validated image candidates, assets, references, and manifests.
 *
 * **Example** (Use index)
 * ```ts
 * import { ImageAsset } from "@effect-ontology/Model/index"
 * console.log(ImageAsset)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Image.ts";
/**
 * Versioned ontology definitions, references, context, and hierarchy behavior.
 *
 * **Example** (Use index)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyContext } from "@effect-ontology/Model/index"
 * const context = S.decodeUnknownOption(OntologyContext)({})
 * console.log(O.map(context, (value) => value.classes.length)) // Some(0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Ontology.ts";
/**
 * Ontology-agent extraction, validation, query, and reasoning contracts.
 *
 * **Example** (Use index)
 * ```ts
 * import { OntologyAgentConfig } from "@effect-ontology/Model/index"
 * console.log(OntologyAgentConfig.default().concurrency) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./OntologyAgent.ts";
/**
 * Ontology element embeddings and dimension-consistent artifacts.
 *
 * **Example** (Use index)
 * ```ts
 * import { OntologyEmbeddings } from "@effect-ontology/Model/index"
 * console.log(OntologyEmbeddings.computeVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./OntologyEmbeddings.ts";
/**
 * Closed output artifact types, filenames, and metadata lookup.
 *
 * **Example** (Use index)
 * ```ts
 * import { OutputType } from "@effect-ontology/Model/index"
 * console.log(OutputType.filename("rdf-jsonld")) // "graph.jsonld"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./OutputType.ts";
/**
 * Shared confidence, attribute, IRI, URL, and entity-identity schemas.
 *
 * **Example** (Use index)
 * ```ts
 * import { Confidence } from "@effect-ontology/Model/index"
 * console.log(Confidence.is(0.8)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./shared.ts";

/**
 * Public schema-backed error surface for the effect-ontology experiment.
 *
 * **Details**
 *
 * * Every family exposes individually discriminated failures plus an exhaustive
 * tagged-union schema with arbitrary generation for future property tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Activity execution, timeout, cancellation, and defect failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { ActivityTimeoutError } from "@effect-ontology/Error/index"
 * console.log(ActivityTimeoutError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Activity.ts";
/**
 * Authentication and authorization failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { AuthenticationReason } from "@effect-ontology/Error/index"
 * console.log(AuthenticationReason.Options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Auth.ts";
/**
 * Shared error fields, constraints, and class construction.
 *
 * **Example** (Use index)
 * ```ts
 * import { ErrorMessage } from "@effect-ontology/Error/index"
 * console.log(ErrorMessage.is("Request failed.")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Base.ts";
/**
 * Circuit-breaker and rate-limit failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { CircuitOpenError } from "@effect-ontology/Error/index"
 * console.log(CircuitOpenError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Circuit.ts";
/**
 * Embedding-provider and vector-shape failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { EmbeddingError } from "@effect-ontology/Error/index"
 * console.log(EmbeddingError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Embedding.ts";
/**
 * Event publication, subscription, serialization, and handler failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { EventBusError } from "@effect-ontology/Error/index"
 * console.log(EventBusError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./EventBus.ts";
/**
 * Extraction pipeline and output failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { ExtractionError } from "@effect-ontology/Error/index"
 * console.log(ExtractionError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Extraction.ts";
/**
 * Image discovery, fetch, validation, and storage failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { ImageFetchError } from "@effect-ontology/Error/index"
 * console.log(ImageFetchError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Image.ts";
/**
 * Jina API, parsing, timeout, and throttling failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { JinaApiError } from "@effect-ontology/Error/index"
 * console.log(JinaApiError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Jina.ts";
/**
 * Language-model provider and response failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { LlmError } from "@effect-ontology/Error/index"
 * console.log(LlmError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Llm.ts";
/**
 * Ontology lookup, load, parse, and validation failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { OntologyError } from "@effect-ontology/Error/index"
 * console.log(OntologyError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Ontology.ts";
/**
 * RDF parsing, serialization, graph, term, and query failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { RdfError } from "@effect-ontology/Error/index"
 * console.log(RdfError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Rdf.ts";
/**
 * SHACL generation and validation failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { ValidationPolicySeverity } from "@effect-ontology/Error/index"
 * console.log(ValidationPolicySeverity.Options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Shacl.ts";
/**
 * Workflow transition, suspension, activity, and terminal failures.
 *
 * **Example** (Use index)
 * ```ts
 * import { WorkflowError } from "@effect-ontology/Error/index"
 * console.log(WorkflowError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Workflow.ts";

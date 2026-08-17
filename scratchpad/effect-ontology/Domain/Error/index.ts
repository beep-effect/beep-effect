/**
 * Public schema-backed error surface for the effect-ontology experiment.
 *
 * @remarks
 * Every family exposes individually discriminated failures plus an exhaustive
 * tagged-union schema with arbitrary generation for future property tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Activity execution, timeout, cancellation, and defect failures.
 *
 * @example
 * ```ts
 * import { ActivityTimeoutError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { AuthenticationReason } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { ErrorMessage } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { CircuitOpenError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { EmbeddingError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { EventBusError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { ExtractionError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { ImageFetchError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { JinaApiError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { LlmError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { OntologyError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { RdfError } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { ValidationPolicySeverity } from "@effect-ontology/Error/index.ts"
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
 * @example
 * ```ts
 * import { WorkflowError } from "@effect-ontology/Error/index.ts"
 * console.log(WorkflowError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Workflow.ts";

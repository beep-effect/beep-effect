/**
 * Provider-neutral NLP processing services, graph execution, and AI tool contracts.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Attributed operation runs recorded as prov activities.
 *
 * @since 0.0.0
 * @category combinators
 */
export * as Activity from "./Activity.ts";
/**
 * Pluggable NLP backend interface, capabilities, and failures.
 *
 * @since 0.0.0
 * @category ports
 */
export * as Backend from "./Backend/index.ts";
/**
 * Capability-oriented NLP helpers.
 *
 * @since 0.0.0
 * @category services
 */
export * as Core from "./Core/index.ts";
/**
 * Service-backed text graph construction and graph-operation execution.
 *
 * @since 0.0.0
 * @category services
 */
export * as Graph from "./Graph/index.ts";
/**
 * High-level NLP service facade over a pluggable backend.
 *
 * @since 0.0.0
 * @category services
 */
export * as NLPService from "./NLPService.ts";
/**
 * The `Operation.run` span, activity attributes and `beep.nlp.*` metrics.
 *
 * @since 0.0.0
 * @category observability
 */
export * as NlpProcessingInstrumentation from "./NlpProcessing.instruments.ts";
/**
 * The named effectful arrow and its Kleisli combinators.
 *
 * @since 0.0.0
 * @category combinators
 */
export * as Operation from "./Operation.ts";
/**
 * NLP AI tool schemas and export adapters.
 *
 * @since 0.0.0
 * @category tools
 */
export * as Tools from "./Tools/index.ts";

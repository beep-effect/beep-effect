/**
 * Text-graph IR: node/edge schemas (and, in later increments, the graph engine).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Generic categorical operations over `effect/Graph` directed graphs
 * (functorial maps, folds, indexed search, traversals, streaming).
 *
 * **Example** (Create empty typed graph)
 *
 * ```typescript
 * import { GraphOps } from "@beep/nlp/Graph"
 *
 * console.log(GraphOps.empty<string, number>())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as GraphOps from "./GraphOps.ts";
/**
 * Graph node & edge schema classes (the handoff-contract basis).
 *
 * **Example** (Access TextNode schema)
 *
 * ```typescript
 * import { Schema } from "@beep/nlp/Graph"
 *
 * console.log(Schema.TextNode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as Schema from "./Schema.ts";

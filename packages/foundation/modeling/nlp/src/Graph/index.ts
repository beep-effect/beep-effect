/**
 * Generic graph operations over `effect/Graph`.
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

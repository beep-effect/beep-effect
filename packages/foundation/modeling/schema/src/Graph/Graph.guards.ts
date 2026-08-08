/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Graph as Graph_ } from "effect";
import type { GraphKindValue } from "./Graph.shared.ts";

/**
 * Guard for Effect `Graph.Edge` values.
 *
 * **Example** (Validate Graph.Edge instance)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { isEdge } from "@beep/schema/Graph"
 *
 * const edge = new Graph.Edge({ source: 0, target: 1, data: "knows" })
 * console.log(isEdge(edge))
 * ```
 *
 * @param value - Unknown input to test.
 * @returns `true` when `value` is a `Graph.Edge`.
 * @category guards
 * @since 0.0.0
 */
export const isEdge = <Data>(value: unknown): value is Graph_.Edge<Data> => value instanceof Graph_.Edge;

/**
 * Guard for Effect graph values, including mutable variants.
 *
 * **Example** (Validate directed graph value)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { isGraph } from "@beep/schema/Graph"
 *
 * const graph = Graph.directed<string, string>()
 * console.log(isGraph(graph))
 * ```
 *
 * @param value - Unknown input to test.
 * @returns `true` when `value` is an Effect graph.
 * @category guards
 * @since 0.0.0
 */
export const isGraph = <Node, Edge>(
  value: unknown
): value is Graph_.Graph<Node, Edge, GraphKindValue> | Graph_.MutableGraph<Node, Edge, GraphKindValue> =>
  Graph_.isGraph(value);

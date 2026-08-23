/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Graph as Graph_ } from "effect";
import * as S from "effect/Schema";
import { EdgeEncoded } from "./Graph.encoded.ts";
import type { GraphKindValue } from "./Graph.shared.ts";

const isUnknownEdge = S.is(EdgeEncoded(S.Unknown));

/**
 * Guard for Effect `Graph.Edge` values.
 *
 * **Example** (Validate a Graph.Edge value)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { isEdge } from "@beep/schema/Graph"
 *
 * const edge: Graph.Edge<string> = { source: 0, target: 1, data: "knows" }
 * console.log(isEdge(edge))
 * ```
 *
 * @param value - Unknown input to test.
 * @returns `true` when `value` is a `Graph.Edge`.
 * @category guards
 * @since 0.0.0
 */
export const isEdge = (value: unknown): value is Graph_.Edge<unknown> => isUnknownEdge(value);

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

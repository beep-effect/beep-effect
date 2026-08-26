/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Match, SchemaIssue, SchemaParser } from "effect";
import * as S from "effect/Schema";
import { GraphEncoded as GraphEncodedSchemaFactory } from "./Graph.encoded.ts";
import { rebuildImmutableGraph, rebuildMutableGraph } from "./Graph.rebuild.ts";
import {
  $I,
  formatGraph,
  isImmutableGraphValue,
  isMutableGraphValue,
  makeGraphEquivalence,
  toRawGraphEncoded,
  trimGraphDescription,
} from "./Graph.shared.ts";
import type { Graph as Graph_ } from "effect";
import type { GraphIso } from "./Graph.encoded.ts";
import type { GraphKindValue } from "./Graph.shared.ts";

/**
 * Schema for validating existing immutable Effect graphs.
 *
 * **Example** (Type-level graph schema check)
 *
 * ```ts
 * import { GraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * type Schema = import("@beep/schema/Graph").GraphFromSelf<typeof S.String, typeof S.Finite>
 * console.log(S.isSchema(GraphFromSelf({ node: S.String, edge: S.Finite }) satisfies Schema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface GraphFromSelf<Node extends S.Top, Edge extends S.Top>
  extends S.declareConstructor<
    Graph_.Graph<Node["Type"], Edge["Type"], GraphKindValue>,
    Graph_.Graph<Node["Encoded"], Edge["Encoded"], GraphKindValue>,
    readonly [Node, Edge],
    GraphIso<Node, Edge>
  > {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for validating existing immutable directed Effect graphs.
 *
 * **Example** (Type-level directed graph check)
 *
 * ```ts
 * import { DirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * type Schema = import("@beep/schema/Graph").DirectedGraphFromSelf<typeof S.String, typeof S.Finite>
 * console.log(S.isSchema(DirectedGraphFromSelf({ node: S.String, edge: S.Finite }) satisfies Schema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface DirectedGraphFromSelf<Node extends S.Top, Edge extends S.Top>
  extends S.declareConstructor<
    Graph_.DirectedGraph<Node["Type"], Edge["Type"]>,
    Graph_.DirectedGraph<Node["Encoded"], Edge["Encoded"]>,
    readonly [Node, Edge],
    GraphIso<Node, Edge, "directed">
  > {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for validating existing immutable undirected Effect graphs.
 *
 * **Example** (Type-level undirected graph check)
 *
 * ```ts
 * import { UndirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * type Schema = import("@beep/schema/Graph").UndirectedGraphFromSelf<typeof S.String, typeof S.Finite>
 * console.log(S.isSchema(UndirectedGraphFromSelf({ node: S.String, edge: S.Finite }) satisfies Schema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface UndirectedGraphFromSelf<Node extends S.Top, Edge extends S.Top>
  extends S.declareConstructor<
    Graph_.UndirectedGraph<Node["Type"], Edge["Type"]>,
    Graph_.UndirectedGraph<Node["Encoded"], Edge["Encoded"]>,
    readonly [Node, Edge],
    GraphIso<Node, Edge, "undirected">
  > {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for validating existing mutable Effect graphs.
 *
 * **Example** (Type-level mutable graph check)
 *
 * ```ts
 * import { MutableGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * type Schema = import("@beep/schema/Graph").MutableGraphFromSelf<typeof S.String, typeof S.Finite>
 * console.log(S.isSchema(MutableGraphFromSelf({ node: S.String, edge: S.Finite }) satisfies Schema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableGraphFromSelf<Node extends S.Top, Edge extends S.Top>
  extends S.declareConstructor<
    Graph_.MutableGraph<Node["Type"], Edge["Type"], GraphKindValue>,
    Graph_.MutableGraph<Node["Encoded"], Edge["Encoded"], GraphKindValue>,
    readonly [Node, Edge],
    GraphIso<Node, Edge>
  > {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for validating existing mutable directed Effect graphs.
 *
 * **Example** (Type-level mutable directed check)
 *
 * ```ts
 * import { MutableDirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * type Schema = import("@beep/schema/Graph").MutableDirectedGraphFromSelf<typeof S.String, typeof S.Finite>
 * console.log(S.isSchema(MutableDirectedGraphFromSelf({ node: S.String, edge: S.Finite }) satisfies Schema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableDirectedGraphFromSelf<Node extends S.Top, Edge extends S.Top>
  extends S.declareConstructor<
    Graph_.MutableDirectedGraph<Node["Type"], Edge["Type"]>,
    Graph_.MutableDirectedGraph<Node["Encoded"], Edge["Encoded"]>,
    readonly [Node, Edge],
    GraphIso<Node, Edge, "directed">
  > {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for validating existing mutable undirected Effect graphs.
 *
 * **Example** (Type-level mutable undirected check)
 *
 * ```ts
 * import { MutableUndirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * type Schema = import("@beep/schema/Graph").MutableUndirectedGraphFromSelf<typeof S.String, typeof S.Finite>
 * console.log(S.isSchema(MutableUndirectedGraphFromSelf({ node: S.String, edge: S.Finite }) satisfies Schema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableUndirectedGraphFromSelf<Node extends S.Top, Edge extends S.Top>
  extends S.declareConstructor<
    Graph_.MutableUndirectedGraph<Node["Type"], Edge["Type"]>,
    Graph_.MutableUndirectedGraph<Node["Encoded"], Edge["Encoded"]>,
    readonly [Node, Edge],
    GraphIso<Node, Edge, "undirected">
  > {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

const makeImmutableGraphFromSelf = <Node extends S.Top, Edge extends S.Top>(
  name: "GraphFromSelf" | "DirectedGraphFromSelf" | "UndirectedGraphFromSelf",
  options: {
    readonly node: Node;
    readonly edge: Edge;
  },
  expectedType?: GraphKindValue
) =>
  S.declareConstructor<
    Graph_.Graph<Node["Type"], Edge["Type"], GraphKindValue>,
    Graph_.Graph<Node["Encoded"], Edge["Encoded"], GraphKindValue>,
    GraphIso<Node, Edge>
  >()(
    [options.node, options.edge],
    ([node, edge]) => {
      const encoded = GraphEncodedSchemaFactory(node, edge);

      return (input, ast, parseOptions) => {
        // fallow-ignore-next-line code-duplication -- mirrors the mutable decoder by design; the guard and rebuild differ, and the narrowing lives in the guard
        if (!isImmutableGraphValue(input) || (expectedType !== undefined && input.type !== expectedType)) {
          return Effect.fail(new SchemaIssue.InvalidType(ast));
        }

        return Effect.flatMap(
          SchemaParser.decodeUnknownEffect(encoded)(toRawGraphEncoded(input), parseOptions),
          Effect.fnUntraced(function* (graph) {
            return yield* rebuildImmutableGraph(graph, { expectedType });
          })
        );
      };
    },
    {
      typeConstructor: {
        _tag: "effect/Graph",
      },
      generation: {
        runtime: `${name}(?, ?)`,
        Type: Match.value(expectedType).pipe(
          Match.when("directed", () => "Graph.DirectedGraph<?, ?>"),
          Match.when("undirected", () => "Graph.UndirectedGraph<?, ?>"),
          Match.orElse(() => "Graph.Graph<?, ?, ? extends directed | undirected>")
        ),
        importDeclaration: 'import * as Graph from "effect/Graph"',
      },
      expected: name,
      description: trimGraphDescription(`Schema for existing ${expectedType ?? ""} Effect graph values.`),
      toEquivalence: ([node, edge]) => makeGraphEquivalence(node, edge),
      toFormatter:
        ([node, edge]) =>
        (graph) =>
          formatGraph(graph, { formatNode: node, formatEdge: edge }),
    }
  );

const makeMutableGraphFromSelf = <Node extends S.Top, Edge extends S.Top>(
  name: "MutableGraphFromSelf" | "MutableDirectedGraphFromSelf" | "MutableUndirectedGraphFromSelf",
  options: {
    readonly node: Node;
    readonly edge: Edge;
  },
  expectedType?: GraphKindValue
) =>
  S.declareConstructor<
    Graph_.MutableGraph<Node["Type"], Edge["Type"], GraphKindValue>,
    Graph_.MutableGraph<Node["Encoded"], Edge["Encoded"], GraphKindValue>,
    GraphIso<Node, Edge>
  >()(
    [options.node, options.edge],
    ([node, edge]) => {
      const encoded = GraphEncodedSchemaFactory(node, edge);

      return (input, ast, parseOptions) => {
        // fallow-ignore-next-line code-duplication -- mirrors the immutable decoder by design; the guard and rebuild differ, and the narrowing lives in the guard
        if (!isMutableGraphValue(input) || (expectedType !== undefined && input.type !== expectedType)) {
          return Effect.fail(new SchemaIssue.InvalidType(ast));
        }

        return Effect.flatMap(
          SchemaParser.decodeUnknownEffect(encoded)(toRawGraphEncoded(input), parseOptions),
          Effect.fnUntraced(function* (graph) {
            return yield* rebuildMutableGraph(graph, { expectedType });
          })
        );
      };
    },
    {
      typeConstructor: {
        _tag: "effect/Graph.MutableGraph",
      },
      generation: {
        runtime: `${name}(?, ?)`,
        Type: Match.value(expectedType).pipe(
          Match.when("directed", () => "Graph.MutableDirectedGraph<?, ?>"),
          Match.when("undirected", () => "Graph.MutableUndirectedGraph<?, ?>"),
          Match.orElse(() => "Graph.MutableGraph<?, ?, ? extends directed | undirected>")
        ),
        importDeclaration: 'import * as Graph from "effect/Graph"',
      },
      expected: name,
      description: trimGraphDescription(`Schema for existing mutable ${expectedType ?? ""} Effect graph values.`),
      toEquivalence: ([node, edge]) => makeGraphEquivalence(node, edge),
      toFormatter:
        ([node, edge]) =>
        (graph) =>
          formatGraph(graph, { formatNode: node, formatEdge: edge }),
    }
  );

/**
 * Schema for validating existing immutable Effect graphs.
 *
 * **Example** (Create immutable graph schema)
 *
 * ```ts import.meta.vitest name="Create immutable graph schema"
 * import { GraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const schema = GraphFromSelf({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(schema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Immutable graph validator schema.
 * @category validation
 * @since 0.0.0
 */
export const GraphFromSelf = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): GraphFromSelf<Node, Edge> =>
  S.make<GraphFromSelf<Node, Edge>>(makeImmutableGraphFromSelf("GraphFromSelf", options).ast, options).pipe(
    $I.annoteSchema("GraphFromSelf", {
      description: "Schema for validating existing immutable Effect graph values.",
    })
  );

/**
 * Schema for validating existing immutable directed Effect graphs.
 *
 * **Example** (Create directed graph schema)
 *
 * ```ts import.meta.vitest name="Create directed graph schema"
 * import { DirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const schema = DirectedGraphFromSelf({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(schema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Immutable directed graph validator schema.
 * @category validation
 * @since 0.0.0
 */
export const DirectedGraphFromSelf = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): DirectedGraphFromSelf<Node, Edge> =>
  S.make<DirectedGraphFromSelf<Node, Edge>>(
    makeImmutableGraphFromSelf("DirectedGraphFromSelf", options, "directed").ast,
    options
  ).pipe(
    $I.annoteSchema("DirectedGraphFromSelf", {
      description: "Schema for validating existing immutable directed Effect graph values.",
    })
  );

/**
 * Schema for validating existing immutable undirected Effect graphs.
 *
 * **Example** (Create undirected graph schema)
 *
 * ```ts import.meta.vitest name="Create undirected graph schema"
 * import { UndirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const schema = UndirectedGraphFromSelf({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(schema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Immutable undirected graph validator schema.
 * @category validation
 * @since 0.0.0
 */
export const UndirectedGraphFromSelf = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): UndirectedGraphFromSelf<Node, Edge> =>
  S.make<UndirectedGraphFromSelf<Node, Edge>>(
    makeImmutableGraphFromSelf("UndirectedGraphFromSelf", options, "undirected").ast,
    options
  ).pipe(
    $I.annoteSchema("UndirectedGraphFromSelf", {
      description: "Schema for validating existing immutable undirected Effect graph values.",
    })
  );

/**
 * Schema for validating existing mutable Effect graphs.
 *
 * **Example** (Create mutable graph schema)
 *
 * ```ts import.meta.vitest name="Create mutable graph schema"
 * import { MutableGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const schema = MutableGraphFromSelf({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(schema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Mutable graph validator schema.
 * @category validation
 * @since 0.0.0
 */
export const MutableGraphFromSelf = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): MutableGraphFromSelf<Node, Edge> =>
  S.make<MutableGraphFromSelf<Node, Edge>>(makeMutableGraphFromSelf("MutableGraphFromSelf", options).ast, options).pipe(
    $I.annoteSchema("MutableGraphFromSelf", {
      description: "Schema for validating existing mutable Effect graph values.",
    })
  );

/**
 * Schema for validating existing mutable directed Effect graphs.
 *
 * **Example** (Create mutable directed schema)
 *
 * ```ts import.meta.vitest name="Create mutable directed schema"
 * import { MutableDirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const schema = MutableDirectedGraphFromSelf({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(schema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Mutable directed graph validator schema.
 * @category validation
 * @since 0.0.0
 */
export const MutableDirectedGraphFromSelf = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): MutableDirectedGraphFromSelf<Node, Edge> =>
  S.make<MutableDirectedGraphFromSelf<Node, Edge>>(
    makeMutableGraphFromSelf("MutableDirectedGraphFromSelf", options, "directed").ast,
    options
  ).pipe(
    $I.annoteSchema("MutableDirectedGraphFromSelf", {
      description: "Schema for validating existing mutable directed Effect graph values.",
    })
  );

/**
 * Schema for validating existing mutable undirected Effect graphs.
 *
 * **Example** (Create mutable undirected schema)
 *
 * ```ts import.meta.vitest name="Create mutable undirected schema"
 * import { MutableUndirectedGraphFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const schema = MutableUndirectedGraphFromSelf({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(schema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Mutable undirected graph validator schema.
 * @category validation
 * @since 0.0.0
 */
export const MutableUndirectedGraphFromSelf = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): MutableUndirectedGraphFromSelf<Node, Edge> =>
  S.make<MutableUndirectedGraphFromSelf<Node, Edge>>(
    makeMutableGraphFromSelf("MutableUndirectedGraphFromSelf", options, "undirected").ast,
    options
  ).pipe(
    $I.annoteSchema("MutableUndirectedGraphFromSelf", {
      description: "Schema for validating existing mutable undirected Effect graph values.",
    })
  );

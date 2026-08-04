/**
 * TypeClass - categorical abstractions for text-processing operations on graphs.
 *
 * Formalizes text operations as morphisms in the Kleisli category of `Effect`:
 * a {@link TextOperation} takes one {@link GraphNode} of data `A` and
 * produces an array of nodes of data `B`, possibly requiring context `R` and
 * failing with `E`. The module provides the Functor/Applicative/Monad/Traversable
 * combinators (`map`/`ap`/`chain`/`traverse`), a {@link Composable} monoid of
 * operations, a {@link Foldable} instance for graphs, and a paired
 * expansion/aggregation model.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - operations that mint nodes are EFFECTFUL: `EffectGraph.makeNode` /
 *   `EffectGraph.generateNodeId` read `Clock`/`Random`.
 * - `Foldable<F>` is parameterized as `Foldable<F, A>` so the graph instance is
 *   implementable without `any`.
 * - `executeOperation` relies on `effect/Graph` covariance in its node type, so
 *   the widening is sound without assertions.
 * - native `Array#map`/`flat`/`push` + index loops become `effect/Array` + folds +
 *   `Effect.all`/`Effect.forEach`; the `purOperation` typo is corrected to
 *   `pureOperation`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A } from "@beep/utils";
import { Effect, identity } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { addNode, generateNodeId, getChildren, makeNode, toArray } from "./EffectGraph.ts";
import type { EffectGraph, GraphNode } from "./EffectGraph.ts";

// =============================================================================
// Text Operation Type Class
// =============================================================================

/**
 * A morphism in the graph category: maps a node of data `A` to new nodes of data
 * `B`, requiring context `R` and possibly failing with `E`. Operations produce
 * NEW nodes, forming the next layer of the DAG.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeOperation, type TextOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation: TextOperation<string, string> = makeOperation(
 *   "emit-none",
 *   () => Effect.succeed([])
 * )
 *
 * console.log(operation.name) // "emit-none"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface TextOperation<A, B, R = never, E = never> {
  readonly apply: (node: GraphNode<A>) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>;
  readonly name: string;
}

/**
 * Build a {@link TextOperation} from an effectful node-producing function.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = makeOperation<string, string>("emit-none", () => Effect.succeed([]))
 * console.log(operation.name) // "emit-none"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const makeOperation: {
  <A, B, R = never, E = never>(
    name: string,
    apply: (node: GraphNode<A>) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>
  ): TextOperation<A, B, R, E>;
  <A, B, R = never, E = never>(
    apply: (node: GraphNode<A>) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>
  ): (name: string) => TextOperation<A, B, R, E>;
} = dual(
  2,
  <A, B, R = never, E = never>(
    name: string,
    apply: (node: GraphNode<A>) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>
  ): TextOperation<A, B, R, E> => ({ name, apply })
);

/**
 * A pure text operation: maps node data to new data values (no context/errors),
 * minting a child node per produced value (effectful only via id/clock).
 *
 * @example
 * ```ts
 * import { pureOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const split = pureOperation("split", (text: string) => text.split(" "))
 * console.log(split.name) // "split"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const pureOperation: {
  <A, B>(name: string, f: (data: A) => ReadonlyArray<B>): TextOperation<A, B>;
  <A, B>(f: (data: A) => ReadonlyArray<B>): (name: string) => TextOperation<A, B>;
} = dual(
  2,
  <A, B>(name: string, f: (data: A) => ReadonlyArray<B>): TextOperation<A, B> =>
    makeOperation(name, (node) => Effect.forEach(f(node.data), (b) => makeNode(b, O.some(node.id), O.some(name))))
);

// =============================================================================
// Composable Type Class (Monoid Structure)
// =============================================================================

/**
 * Operations composable end-to-end, forming a monoid (sequential composition +
 * identity). Laws: associativity and identity.
 *
 * @example
 * ```ts
 * import { composeOperations, identityOperation, type Composable } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const composable: Composable<string> = {
 *   compose: composeOperations,
 *   identity: identityOperation()
 * }
 *
 * console.log(composable.identity.name) // "identity"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface Composable<A, R = never, E = never> {
  readonly compose: <B>(
    first: TextOperation<A, B, R, E>,
    second: TextOperation<B, A, R, E>
  ) => TextOperation<A, A, R, E>;
  readonly identity: TextOperation<A, A>;
}

/**
 * The identity operation: re-emits the node under a fresh id (effectful id).
 *
 * @example
 * ```ts
 * import { identityOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = identityOperation<string>()
 * console.log(operation.name) // "identity"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const identityOperation = <A>(): TextOperation<A, A> =>
  makeOperation("identity", (node) =>
    Effect.map(generateNodeId, (id) =>
      A.of({
        ...node,
        id,
        parentId: O.some(node.id),
      })
    )
  );

/**
 * Compose two operations sequentially: the first's outputs feed the second.
 *
 * @example
 * ```ts
 * import { composeOperations, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const trimThenLength = composeOperations(
 *   mapOperation("trim", (text: string) => text.trim()),
 *   mapOperation("length", (text: string) => text.length)
 * )
 *
 * console.log(trimThenLength.name) // "trim -> length"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const composeOperations: {
  <A, B, C, R, E>(first: TextOperation<A, B, R, E>, second: TextOperation<B, C, R, E>): TextOperation<A, C, R, E>;
  <A, B, C, R, E>(second: TextOperation<B, C, R, E>): (first: TextOperation<A, B, R, E>) => TextOperation<A, C, R, E>;
} = dual(
  2,
  <A, B, C, R, E>(first: TextOperation<A, B, R, E>, second: TextOperation<B, C, R, E>): TextOperation<A, C, R, E> =>
    makeOperation(
      `${first.name} -> ${second.name}`,
      Effect.fn(function* (node) {
        const intermediateNodes = yield* first.apply(node);
        const results = yield* Effect.all(
          A.map(intermediateNodes, (intermediate) => second.apply(intermediate)),
          { concurrency: 1 }
        );
        return A.flatten(results);
      })
    )
);

// =============================================================================
// Foldable Type Class
// =============================================================================

/**
 * Foldable structures of element type `A`. Laws: empty/singleton/concat
 * homomorphism. Parameterized by `A` so instances are implementable without
 * `any`.
 *
 * @example
 * ```ts
 * import type { Foldable } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const foldStrings = <F>(foldable: Foldable<F, string>, fa: F) =>
 *   foldable.fold(fa, (count, value) => count + value.length, 0)
 *
 * console.log(foldStrings)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface Foldable<F, A> {
  readonly fold: <B>(fa: F, algebra: (b: B, a: A) => B, initial: B) => B;
}

/**
 * The {@link Foldable} instance for {@link EffectGraph}, folding over
 * node data in graph order.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { foldableGraph } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const graph = Effect.runSync(singleton("root"))
 * const total = foldableGraph<string>().fold(graph, (sum, value) => sum + value.length, 0)
 *
 * console.log(total) // 4
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const foldableGraph = <A>(): Foldable<EffectGraph<A>, A> => ({
  fold: (graph, algebra, initial) =>
    A.reduce(
      A.map(toArray(graph), (node) => node.data),
      initial,
      algebra
    ),
});

// =============================================================================
// Graph Transformation Operations
// =============================================================================

const getLeafNodes = <A>(graph: EffectGraph<A>): ReadonlyArray<GraphNode<A>> =>
  A.filter(toArray(graph), (node) => A.length(getChildren(graph, node.id)) === 0);

/**
 * Apply an operation to every current leaf node, adding the results as children
 * (one new DAG layer). A natural transformation between graph functors.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { singleton, size } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { executeOperation, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const program = Effect.flatMap(
 *   singleton("root"),
 *   executeOperation(mapOperation("length", (text: string) => text.length))
 * )
 *
 * console.log(size(Effect.runSync(program))) // 2
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const executeOperation: {
  <A, B, R, E>(graph: EffectGraph<A>, operation: TextOperation<A, B, R, E>): Effect.Effect<EffectGraph<A | B>, E, R>;
  <A, B, R, E>(
    operation: TextOperation<A, B, R, E>
  ): (graph: EffectGraph<A>) => Effect.Effect<EffectGraph<A | B>, E, R>;
} = dual(
  2,
  Effect.fn("executeOperation")(function* <A, B, R, E>(
    graph: EffectGraph<A>,
    operation: TextOperation<A, B, R, E>
  ): Effect.fn.Return<EffectGraph<A | B>, E, R> {
    // EffectGraph is covariant in its node type, so the widening needs no cast.
    let resultGraph: EffectGraph<A | B> = graph;
    for (const leafNode of getLeafNodes(graph)) {
      const newNodes = yield* operation.apply(leafNode);
      for (const newNode of newNodes) {
        resultGraph = addNode(resultGraph, newNode);
      }
    }
    return resultGraph;
  })
);

/**
 * Apply a sequence of operations, each adding a DAG layer.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { singleton, size } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { executeOperations, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const graph = Effect.runSync(singleton("root"))
 * const program = executeOperations(graph, [
 *   mapOperation("length", (value: unknown) => String(value).length)
 * ])
 *
 * console.log(size(Effect.runSync(program))) // 2
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const executeOperations: {
  <R, E>(
    graph: EffectGraph<unknown>,
    operations: ReadonlyArray<TextOperation<unknown, unknown, R, E>>
  ): Effect.Effect<EffectGraph<unknown>, E, R>;
  <R, E>(
    operations: ReadonlyArray<TextOperation<unknown, unknown, R, E>>
  ): (graph: EffectGraph<unknown>) => Effect.Effect<EffectGraph<unknown>, E, R>;
} = dual(
  2,
  Effect.fn("executeOperations")(function* <R, E>(
    graph: EffectGraph<unknown>,
    operations: ReadonlyArray<TextOperation<unknown, unknown, R, E>>
  ): Effect.fn.Return<EffectGraph<unknown>, E, R> {
    let currentGraph: EffectGraph<unknown> = graph;
    for (const operation of operations) {
      currentGraph = yield* executeOperation(currentGraph, operation);
    }
    return currentGraph;
  })
);

// =============================================================================
// Adjunction Modeling (Free ⊣ Forgetful)
// =============================================================================

/**
 * The free (expansion) functor: one node to many (e.g. text -\> sentences).
 *
 * @example
 * ```ts
 * import { mapOperation, type FreeOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation: FreeOperation<string, number> = mapOperation("length", (text: string) => text.length)
 * console.log(operation.name) // "length"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type FreeOperation<A, B, R = never, E = never> = TextOperation<A, B, R, E>;

/**
 * The forgetful (aggregation) functor: many nodes to one (e.g. sentences -\> text).
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeNode } from "@beep/nlp-processing/Graph/EffectGraph"
 * import type { ForgetfulOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation: ForgetfulOperation<string, string> = {
 *   name: "join",
 *   apply: (nodes) => makeNode(nodes.map((node) => node.data).join(" "))
 * }
 *
 * console.log(operation.name) // "join"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface ForgetfulOperation<A, B, R = never, E = never> {
  readonly apply: (nodes: ReadonlyArray<GraphNode<A>>) => Effect.Effect<GraphNode<B>, E, R>;
  readonly name: string;
}

/**
 * Pair a free expansion with its aggregation operation.
 *
 * @example
 * ```ts
 * import { makeNode } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { makeAdjunction, mapOperation, type ForgetfulOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const aggregate: ForgetfulOperation<number, string> = {
 *   name: "stringify",
 *   apply: (nodes) => makeNode(nodes.map((node) => String(node.data)).join(","))
 * }
 * const pairing = makeAdjunction(mapOperation("length", (text: string) => text.length), aggregate)
 *
 * console.log(pairing.expand.name) // "length"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const makeAdjunction = <A, B, R, E>(
  free: FreeOperation<A, B, R, E>,
  forgetful: ForgetfulOperation<B, A, R, E>
): {
  readonly expand: FreeOperation<A, B, R, E>;
  readonly aggregate: ForgetfulOperation<B, A, R, E>;
} => ({ expand: free, aggregate: forgetful });

// =============================================================================
// Utility Operations
// =============================================================================

/**
 * Map operation: transform node data without changing structure (a functor map).
 *
 * @example
 * ```ts
 * import { mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = mapOperation("length", (text: string) => text.length)
 * console.log(operation.name) // "length"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const mapOperation: {
  <A, B>(name: string, f: (a: A) => B): TextOperation<A, B>;
  <A, B>(f: (a: A) => B): (name: string) => TextOperation<A, B>;
} = dual(2, <A, B>(name: string, f: (a: A) => B): TextOperation<A, B> => pureOperation(name, (a) => A.of(f(a))));

/**
 * Filter operation: keep nodes whose data satisfies the predicate.
 *
 * @example
 * ```ts
 * import { filterOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = filterOperation("non-empty", (text: string) => text.length > 0)
 * console.log(operation.name) // "non-empty"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const filterOperation: {
  <A>(name: string, predicate: (a: A) => boolean): TextOperation<A, A>;
  <A>(predicate: (a: A) => boolean): (name: string) => TextOperation<A, A>;
} = dual(
  2,
  <A>(name: string, predicate: (a: A) => boolean): TextOperation<A, A> =>
    pureOperation(name, (a) => (predicate(a) ? A.of(a) : A.empty<A>()))
);

/**
 * FlatMap operation: map then flatten in one step.
 *
 * @example
 * ```ts
 * import { flatMapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = flatMapOperation("words", (text: string) => text.split(" "))
 * console.log(operation.name) // "words"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const flatMapOperation: {
  <A, B>(name: string, f: (a: A) => ReadonlyArray<B>): TextOperation<A, B>;
  <A, B>(f: (a: A) => ReadonlyArray<B>): (name: string) => TextOperation<A, B>;
} = dual(2, <A, B>(name: string, f: (a: A) => ReadonlyArray<B>): TextOperation<A, B> => pureOperation(name, f));

/**
 * Collect all node data values from the graph.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { collectData } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * console.log(collectData(Effect.runSync(singleton("root")))) // ["root"]
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const collectData = <A>(graph: EffectGraph<A>): ReadonlyArray<A> => A.map(toArray(graph), (node) => node.data);

/**
 * Graph depth: the maximum node depth (longest root-to-leaf path).
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { depth } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * console.log(depth(Effect.runSync(singleton("root")))) // 0
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const depth = <A>(graph: EffectGraph<A>): number =>
  A.reduce(toArray(graph), 0, (max, node) => Math.max(max, node.metadata.depth));

// =============================================================================
// Functor Instance for TextOperation
// =============================================================================

/**
 * A Functor over `F`: `map` transforms the output while preserving structure.
 * Laws: identity and composition. (Documented abstraction; the standalone
 * {@link map} witnesses it for {@link TextOperation}.)
 *
 * @example
 * ```ts
 * import type { Functor } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const acceptsFunctor = <F>(functor: Functor<F>) => functor
 * console.log(acceptsFunctor)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface Functor<F> {
  readonly map: <A, B>(fa: F, f: (a: A) => B) => F;
}

/**
 * Shared dual signature for the effectful per-node data mappers built on
 * {@link makeEffectfulMapBody} (`flatMap`, `traverse`): both accept either the
 * operation and effectful function together (data-first) or the function alone
 * (data-last). Named once so the two instances stay signature-identical.
 */
interface EffectfulMapOperationSignature {
  <A, B, C, R1, E1, R2, E2>(
    operation: TextOperation<A, B, R1, E1>,
    f: (b: B) => Effect.Effect<C, E2, R2>
  ): TextOperation<A, C, R1 | R2, E1 | E2>;
  <A, B, C, R1, E1, R2, E2>(
    f: (b: B) => Effect.Effect<C, E2, R2>
  ): (operation: TextOperation<A, B, R1, E1>) => TextOperation<A, C, R1 | R2, E1 | E2>;
}

/**
 * Build the uncurried two-argument body for an effectful per-node data mapper:
 * run `operation`, then replace each node's data with the result of the
 * effectful `f`, naming the derived operation with the given `suffix`. Factored
 * out so the `flatMap` and `traverse` instances share one implementation while
 * each export still applies {@link dual} visibly at its own call site (the
 * exported helper supports data-first and data-last calls via `dual(...)`).
 */
const makeEffectfulMapBody =
  (suffix: string) =>
  <A, B, C, R1, E1, R2, E2>(
    operation: TextOperation<A, B, R1, E1>,
    f: (b: B) => Effect.Effect<C, E2, R2>
  ): TextOperation<A, C, R1 | R2, E1 | E2> =>
    makeOperation(`${operation.name} |> ${suffix}`, (node) =>
      Effect.flatMap(operation.apply(node), (nodes) =>
        Effect.all(
          A.map(nodes, (n) =>
            Effect.map(f(n.data), (newData) => ({
              ...n,
              data: newData,
            }))
          )
        )
      )
    );

/**
 * Map over a {@link TextOperation}'s output data, preserving structure/effects.
 *
 * @example
 * ```ts
 * import { map, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = map(mapOperation("trim", (text: string) => text.trim()), (text) => text.length)
 * console.log(operation.name) // "trim |> map"
 * ```
 *
 * @since 0.0.0
 * @category mapping
 */
export const map: {
  <A, B, C, R, E>(operation: TextOperation<A, B, R, E>, f: (b: B) => C): TextOperation<A, C, R, E>;
  <A, B, C, R, E>(f: (b: B) => C): (operation: TextOperation<A, B, R, E>) => TextOperation<A, C, R, E>;
} = dual(
  2,
  <A, B, C, R, E>(operation: TextOperation<A, B, R, E>, f: (b: B) => C): TextOperation<A, C, R, E> =>
    makeOperation(`${operation.name} |> map`, (node) =>
      Effect.map(operation.apply(node), (nodes) =>
        A.map(nodes, (n) => ({
          ...n,
          data: f(n.data),
        }))
      )
    )
);

/**
 * FlatMap over a {@link TextOperation}'s output data with an effectful function.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { flatMap, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = flatMap(
 *   mapOperation("trim", (text: string) => text.trim()),
 *   (text) => Effect.succeed(text.length)
 * )
 *
 * console.log(operation.name) // "trim |> flatMap"
 * ```
 *
 * @since 0.0.0
 * @category mapping
 */
export const flatMap: EffectfulMapOperationSignature = dual(2, makeEffectfulMapBody("flatMap"));

// =============================================================================
// Applicative Instance for TextOperation
// =============================================================================

/**
 * Apply an operation of functions to an operation of values (Cartesian product).
 *
 * @example
 * ```ts
 * import { ap, mapOperation, pureOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const functions = pureOperation("fn", () => [(text: string) => text.length])
 * const values = mapOperation("trim", (text: string) => text.trim())
 * const operation = ap(functions, values)
 *
 * console.log(operation.name) // "ap(fn, trim)"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const ap: {
  <A, B, C, R1, E1, R2, E2>(
    opFn: TextOperation<A, (b: B) => C, R1, E1>,
    opVal: TextOperation<A, B, R2, E2>
  ): TextOperation<A, C, R1 | R2, E1 | E2>;
  <A, B, C, R1, E1, R2, E2>(
    opVal: TextOperation<A, B, R2, E2>
  ): (opFn: TextOperation<A, (b: B) => C, R1, E1>) => TextOperation<A, C, R1 | R2, E1 | E2>;
} = dual(
  2,
  <A, B, C, R1, E1, R2, E2>(
    opFn: TextOperation<A, (b: B) => C, R1, E1>,
    opVal: TextOperation<A, B, R2, E2>
  ): TextOperation<A, C, R1 | R2, E1 | E2> =>
    makeOperation(
      `ap(${opFn.name}, ${opVal.name})`,
      Effect.fnUntraced(function* (node) {
        const fnNodes = yield* opFn.apply(node);
        const valNodes = yield* opVal.apply(node);
        // Each Cartesian-product pair must mint a fresh node id; spreading
        // valNode would reuse valNode.id across function-node branches and
        // corrupt the graph's id-to-index mapping on insertion.
        const pairs = A.flatMap(fnNodes, (fnNode) => A.map(valNodes, (valNode) => [fnNode, valNode] as const));
        return yield* Effect.forEach(pairs, ([fnNode, valNode]) =>
          Effect.map(generateNodeId, (id) => ({
            ...valNode,
            id,
            data: fnNode.data(valNode.data),
          }))
        );
      })
    )
);

/**
 * Lift a value into an operation that always produces it.
 *
 * @example
 * ```ts
 * import { pure } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = pure<string, number>(1)
 * console.log(operation.name) // "pure"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const pure = <A, B>(value: B): TextOperation<A, B> =>
  makeOperation("pure", (node) => Effect.map(makeNode(value, O.some(node.id), O.some("pure")), A.of));

// =============================================================================
// Monad Instance for TextOperation
// =============================================================================

/**
 * Sequence dependent operations: the first's outputs choose the next operation.
 *
 * @example
 * ```ts
 * import { chain, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = chain(
 *   mapOperation("trim", (text: string) => text.trim()),
 *   (text) => mapOperation("length", () => text.length)
 * )
 *
 * console.log(operation.name) // "trim >>= chain"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const chain: {
  <A, B, C, R1, E1, R2, E2>(
    operation: TextOperation<A, B, R1, E1>,
    f: (b: B) => TextOperation<B, C, R2, E2>
  ): TextOperation<A, C, R1 | R2, E1 | E2>;
  <A, B, C, R1, E1, R2, E2>(
    f: (b: B) => TextOperation<B, C, R2, E2>
  ): (operation: TextOperation<A, B, R1, E1>) => TextOperation<A, C, R1 | R2, E1 | E2>;
} = dual(
  2,
  <A, B, C, R1, E1, R2, E2>(
    operation: TextOperation<A, B, R1, E1>,
    f: (b: B) => TextOperation<B, C, R2, E2>
  ): TextOperation<A, C, R1 | R2, E1 | E2> =>
    makeOperation(
      `${operation.name} >>= chain`,
      Effect.fnUntraced(function* (node) {
        const intermediateNodes = yield* operation.apply(node);
        const results = yield* Effect.all(
          A.map(intermediateNodes, (intermediate) => f(intermediate.data).apply(intermediate)),
          { concurrency: 1 }
        );
        return A.flatten(results);
      })
    )
);

/**
 * Flatten nested operations (alias of {@link chain}).
 *
 * @example
 * ```ts
 * import { flatten, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = flatten(
 *   mapOperation("trim", (text: string) => text.trim()),
 *   (text) => mapOperation("length", () => text.length)
 * )
 *
 * console.log(operation.name) // "trim >>= chain"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const flatten: {
  <A, B, C, R1, E1, R2, E2>(
    operation: TextOperation<A, B, R1, E1>,
    getInnerOp: (b: B) => TextOperation<B, C, R2, E2>
  ): TextOperation<A, C, R1 | R2, E1 | E2>;
  <A, B, C, R1, E1, R2, E2>(
    getInnerOp: (b: B) => TextOperation<B, C, R2, E2>
  ): (operation: TextOperation<A, B, R1, E1>) => TextOperation<A, C, R1 | R2, E1 | E2>;
} = dual(
  2,
  <A, B, C, R1, E1, R2, E2>(
    operation: TextOperation<A, B, R1, E1>,
    getInnerOp: (b: B) => TextOperation<B, C, R2, E2>
  ): TextOperation<A, C, R1 | R2, E1 | E2> => chain(operation, getInnerOp)
);

// =============================================================================
// Alternative Instance
// =============================================================================

/**
 * Combine two operations, collecting results from both (parallel branching).
 *
 * @example
 * ```ts
 * import { alt, mapOperation } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = alt(
 *   mapOperation("lower", (text: string) => text.toLowerCase()),
 *   mapOperation("upper", (text: string) => text.toUpperCase())
 * )
 *
 * console.log(operation.name) // "alt(lower, upper)"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const alt: {
  <A, B, R1, E1, R2, E2>(
    op1: TextOperation<A, B, R1, E1>,
    op2: TextOperation<A, B, R2, E2>
  ): TextOperation<A, B, R1 | R2, E1 | E2>;
  <A, B, R1, E1, R2, E2>(
    op2: TextOperation<A, B, R2, E2>
  ): (op1: TextOperation<A, B, R1, E1>) => TextOperation<A, B, R1 | R2, E1 | E2>;
} = dual(
  2,
  <A, B, R1, E1, R2, E2>(
    op1: TextOperation<A, B, R1, E1>,
    op2: TextOperation<A, B, R2, E2>
  ): TextOperation<A, B, R1 | R2, E1 | E2> =>
    makeOperation(
      `alt(${op1.name}, ${op2.name})`,
      Effect.fnUntraced(function* (node) {
        const results1 = yield* op1.apply(node);
        const results2 = yield* op2.apply(node);
        return A.appendAll(results1, results2);
      })
    )
);

/**
 * The empty operation (identity for {@link alt}): produces no nodes.
 *
 * @example
 * ```ts
 * import { empty } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = empty<string, number>()
 * console.log(operation.name) // "empty"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const empty = <A, B>(): TextOperation<A, B> =>
  makeOperation("empty", () => Effect.succeed(A.empty<GraphNode<B>>()));

// =============================================================================
// Traversable Instance
// =============================================================================

/**
 * Traverse an operation's outputs with an effectful function.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { mapOperation, traverse } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = traverse(
 *   mapOperation("trim", (text: string) => text.trim()),
 *   (text) => Effect.succeed(text.length)
 * )
 *
 * console.log(operation.name) // "trim |> traverse"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const traverse: EffectfulMapOperationSignature = dual(2, makeEffectfulMapBody("traverse"));

// =============================================================================
// Utility Combinators
// =============================================================================

/**
 * Apply an operation `n` times and collect all results.
 *
 * @example
 * ```ts
 * import { mapOperation, replicate } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = replicate(mapOperation("length", (text: string) => text.length), 2)
 * console.log(operation.name) // "replicate(length, 2)"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const replicate: {
  <A, B, R, E>(operation: TextOperation<A, B, R, E>, n: number): TextOperation<A, B, R, E>;
  (n: number): <A, B, R, E>(operation: TextOperation<A, B, R, E>) => TextOperation<A, B, R, E>;
} = dual(
  2,
  <A, B, R, E>(operation: TextOperation<A, B, R, E>, n: number): TextOperation<A, B, R, E> =>
    makeOperation(`replicate(${operation.name}, ${n})`, (node) =>
      n <= 0
        ? Effect.succeed(A.empty<GraphNode<B>>())
        : Effect.map(
            Effect.all(
              A.map(A.makeBy(n, identity), () => operation.apply(node)),
              { concurrency: 1 }
            ),
            A.flatten
          )
    )
);

/**
 * Apply an operation only when the node data satisfies the predicate.
 *
 * @example
 * ```ts
 * import { mapOperation, when } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = when(
 *   (text: string) => text.length > 0,
 *   mapOperation("length", (text: string) => text.length)
 * )
 *
 * console.log(operation.name) // "when(length)"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const when: {
  <A, B, R, E>(predicate: (a: A) => boolean, operation: TextOperation<A, B, R, E>): TextOperation<A, B, R, E>;
  <A, B, R, E>(operation: TextOperation<A, B, R, E>): (predicate: (a: A) => boolean) => TextOperation<A, B, R, E>;
} = dual(
  2,
  <A, B, R, E>(predicate: (a: A) => boolean, operation: TextOperation<A, B, R, E>): TextOperation<A, B, R, E> =>
    makeOperation(`when(${operation.name})`, (node) =>
      predicate(node.data) ? operation.apply(node) : Effect.succeed(A.empty<GraphNode<B>>())
    )
);

/**
 * Apply an operation unless the node data satisfies the predicate.
 *
 * @example
 * ```ts
 * import { mapOperation, unless } from "@beep/nlp-processing/Graph/TypeClass"
 *
 * const operation = unless(
 *   (text: string) => text.length === 0,
 *   mapOperation("length", (text: string) => text.length)
 * )
 *
 * console.log(operation.name) // "when(length)"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const unless: {
  <A, B, R, E>(predicate: (a: A) => boolean, operation: TextOperation<A, B, R, E>): TextOperation<A, B, R, E>;
  <A, B, R, E>(operation: TextOperation<A, B, R, E>): (predicate: (a: A) => boolean) => TextOperation<A, B, R, E>;
} = dual(
  2,
  <A, B, R, E>(predicate: (a: A) => boolean, operation: TextOperation<A, B, R, E>): TextOperation<A, B, R, E> =>
    when((a: A) => !predicate(a), operation)
);

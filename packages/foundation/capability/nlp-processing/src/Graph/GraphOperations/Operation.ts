/**
 * GraphOperations/Operation - the core graph-operation abstraction.
 *
 * A {@link GraphOperation} is a morphism in the category of graphs: it maps a
 * node of data `A` to an array of child nodes of data `B`, possibly requiring
 * context `R` and failing with `E`, alongside validation and cost-estimation.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - operations that mint nodes are EFFECTFUL ({@link pure}/{@link identity} use
 *   `EffectGraph.makeNode`/`generateNodeId`, which read `Clock`/`Random`).
 * - native `Array#map` becomes `effect/Array` + `Effect.forEach`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A } from "@beep/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import { generateNodeId, makeNode } from "../EffectGraph.ts";
import * as Types from "./Types.ts";
import type { GraphNode } from "../EffectGraph.ts";
import type { OperationCategory, OperationCost, ValidationResult } from "./Types.ts";

// =============================================================================
// Core Operation Interface
// =============================================================================

/**
 * Operation contract for expanding one graph node into zero or more child nodes.
 *
 * **Details**
 *
 * `apply` is the only field allowed to create child nodes. The executor calls it
 * for leaf nodes and records operation failures per leaf instead of throwing away
 * the whole execution result. `validate` and `estimateCost` are advisory hooks
 * used before execution and for planning; the default constructor supplies a
 * valid result and zero cost when they are omitted.
 *
 * **Example** (Make filtering GraphOperation)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { make, type GraphOperation } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const operation: GraphOperation<string, string> = make({
 *   name: "drop-empty",
 *   description: "Keep only non-empty leaf text.",
 *   category: "filtering",
 *   apply: () => Effect.succeed([])
 * })
 *
 * console.log(operation.category) // "filtering"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface GraphOperation<A, B, R = never, E = never> {
  /** Apply the operation to a single node, producing child nodes. */
  readonly apply: (node: GraphNode<A>) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>;
  readonly category: OperationCategory;
  readonly description: string;
  /** Estimate the cost of applying the operation to a node. */
  readonly estimateCost: (node: GraphNode<A>) => Effect.Effect<OperationCost>;
  readonly name: string;
  /** Validate that the operation can be applied to a node. */
  readonly validate: (node: GraphNode<A>) => Effect.Effect<ValidationResult>;
}

// =============================================================================
// Operation Constructors
// =============================================================================

/**
 * Build a graph operation while filling in safe validation and cost defaults.
 *
 * **Details**
 *
 * Use this constructor when the operation already owns node creation, validation,
 * or backend effects. Omitted validation means the executor may apply the
 * operation to every leaf; omitted cost means a zero-cost planning estimate.
 *
 * **Example** (Build emit-none operation)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { make } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const operation = make<string, string>({
 *   name: "emit-none",
 *   description: "Suppress every matched leaf.",
 *   category: "filtering",
 *   apply: () => Effect.succeed([])
 * })
 *
 * console.log(operation.name) // "emit-none"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = <A, B, R = never, E = never>(config: {
  readonly apply: (node: GraphNode<A>) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>;
  readonly category: OperationCategory;
  readonly description: string;
  readonly estimateCost?: (node: GraphNode<A>) => Effect.Effect<OperationCost>;
  readonly name: string;
  readonly validate?: (node: GraphNode<A>) => Effect.Effect<ValidationResult>;
}): GraphOperation<A, B, R, E> => ({
  apply: config.apply,
  category: config.category,
  description: config.description,
  estimateCost: config.estimateCost ?? (() => Effect.succeed(Types.OperationCost.zero())),
  name: config.name,
  validate: config.validate ?? (() => Effect.succeed(Types.ValidationResult.valid())),
});

/**
 * Create an operation from a pure data function that emits child payloads.
 *
 * **Details**
 *
 * The supplied function never receives the full node. Parent linkage, generated
 * child node ids, timestamps, and operation metadata are added by this helper via
 * {@link makeNode}. Returning an empty array is the filtering case.
 *
 * **Example** (Pure duplicate expansion)
 *
 * ```ts import.meta.vitest name="Pure duplicate expansion"
 * import { pure } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const duplicate = pure({
 *   name: "duplicate",
 *   description: "Emit two child payloads for each input.",
 *   category: "expansion",
 *   f: (text: string) => [text, text]
 * })
 *
 * duplicate.category // => "expansion"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pure = <A, B>(config: {
  readonly category: OperationCategory;
  readonly description: string;
  readonly f: (data: A) => ReadonlyArray<B>;
  readonly name: string;
}): GraphOperation<A, B> =>
  make({
    apply: (node) => Effect.forEach(config.f(node.data), makeNode(O.some(node.id), O.some(config.name))),
    category: config.category,
    description: config.description,
    name: config.name,
  });

/**
 * Create a one-to-one transformation operation.
 *
 * **Details**
 *
 * Each input leaf produces exactly one child node. The child node is linked to
 * the input leaf and records this operation's name in its metadata.
 *
 * **Example** (Lowercase transform operation)
 *
 * ```ts import.meta.vitest name="Lowercase transform operation"
 * import { transform } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const normalize = transform({
 *   name: "normalize-case",
 *   description: "Lowercase a text leaf.",
 *   f: (text: string) => text.toLowerCase()
 * })
 *
 * normalize.category // => "transformation"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const transform = <A, B>(config: {
  readonly description: string;
  readonly f: (data: A) => B;
  readonly name: string;
}): GraphOperation<A, B> =>
  pure({
    category: "transformation",
    description: config.description,
    f: (data) => A.of(config.f(data)),
    name: config.name,
  });

/**
 * Create a one-to-many expansion operation.
 *
 * **Details**
 *
 * Expansion preserves all emitted values as sibling children of the source leaf.
 * The executor treats every produced child as a new candidate leaf for later
 * operation passes.
 *
 * **Example** (Split words expansion)
 *
 * ```ts import.meta.vitest name="Split words expansion"
 * import { expand } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const splitWords = expand({
 *   name: "split-words",
 *   description: "Emit one child payload per whitespace-delimited token.",
 *   f: (text: string) => text.split(/\s+/).filter((token) => token.length > 0)
 * })
 *
 * splitWords.category // => "expansion"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const expand = <A, B>(config: {
  readonly description: string;
  readonly f: (data: A) => ReadonlyArray<B>;
  readonly name: string;
}): GraphOperation<A, B> =>
  pure({ category: "expansion", description: config.description, f: config.f, name: config.name });

/**
 * Create a predicate operation that keeps or drops leaf payloads.
 *
 * **Details**
 *
 * Kept payloads are emitted as fresh child nodes; dropped payloads emit no
 * children. The original graph is not mutated by the operation itself.
 *
 * **Example** (Filter non-empty leaves)
 *
 * ```ts import.meta.vitest name="Filter non-empty leaves"
 * import { filter } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const nonEmpty = filter({
 *   name: "non-empty",
 *   description: "Keep only leaves containing text.",
 *   predicate: (text: string) => text.trim().length > 0
 * })
 *
 * nonEmpty.category // => "filtering"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const filter = <A>(config: {
  readonly description: string;
  readonly name: string;
  readonly predicate: (data: A) => boolean;
}): GraphOperation<A, A> =>
  pure({
    category: "filtering",
    description: config.description,
    f: (data) => (config.predicate(data) ? A.of(data) : A.empty<A>()),
    name: config.name,
  });

// =============================================================================
// Identity & Basic Combinators
// =============================================================================

/**
 * Re-emit a leaf payload under a fresh child node id.
 *
 * **Gotchas**
 *
 * This is identity for payload values, not for node identity: the child keeps the
 * same data but receives a new id and points back to the original node as parent.
 *
 * **Example** (Create identity operation)
 *
 * ```ts
 * import { identity } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const passthrough = identity<string>()
 * console.log(passthrough.name) // "identity"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const identity = <A>(): GraphOperation<A, A> =>
  make({
    apply: (node) => Effect.map(generateNodeId, (id) => A.of({ ...node, id, parentId: O.some(node.id) })),
    category: "transformation",
    description: "Identity operation (no transformation)",
    name: "identity",
  });

/**
 * Build a named `map` transformation for leaf payloads.
 *
 * **Example** (Map text to lengths)
 *
 * ```ts import.meta.vitest name="Map text to lengths"
 * import { map } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const lengths = map((text: string) => text.length)
 * lengths.category // => "transformation"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const map = <A, B>(f: (a: A) => B): GraphOperation<A, B> =>
  transform({ description: "Map with function", f, name: "map" });

/**
 * Build a named `flatMap` expansion for leaf payloads.
 *
 * **Example** (FlatMap into characters)
 *
 * ```ts import.meta.vitest name="FlatMap into characters"
 * import { flatMap } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const characters = flatMap((text: string) => text.split(""))
 * characters.category // => "expansion"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const flatMap = <A, B>(f: (a: A) => ReadonlyArray<B>): GraphOperation<A, B> =>
  expand({ description: "FlatMap with function", f, name: "flatMap" });

// =============================================================================
// Metadata Helpers
// =============================================================================

/**
 * Read an operation's morphism category.
 *
 * **Example** (Read mapped operation category)
 *
 * ```ts import.meta.vitest name="Read mapped operation category"
 * import { getCategory, map } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const category = getCategory(map((text: string) => text.length))
 * category // => "transformation"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getCategory = <A, B, R, E>(operation: GraphOperation<A, B, R, E>): OperationCategory => operation.category;

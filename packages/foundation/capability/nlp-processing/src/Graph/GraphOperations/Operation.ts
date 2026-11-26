/**
 * GraphOperations/Operation - the core graph-operation abstraction.
 *
 * **Details**
 *
 * A {@link GraphOperation} is an {@link Operation} from one node of data `A` to
 * its child nodes of data `B`, possibly requiring context `R` and failing with
 * `E`, plus its category, validation and cost estimation. The arrow's name is
 * the operation's registry term, which also keys the executor's result cache.
 *
 * Operations that mint nodes are effectful: {@link pure} uses
 * `EffectGraph.makeNode`, which reads `Clock` and `Random`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { makeNode } from "../EffectGraph.ts";
import * as Types from "./Types.ts";
import type { TermIri } from "@beep/identity/Term";
import type { Operation } from "../../Operation.ts";
import type { GraphNode } from "../EffectGraph.ts";
import type { OperationCategory, OperationCost, ValidationResult } from "./Types.ts";

/**
 * Operation contract for expanding one graph node into zero or more child nodes.
 *
 * **Details**
 *
 * `operation.run` is the only field allowed to create child nodes. The executor
 * calls it for leaf nodes and records operation failures per leaf instead of
 * throwing away the whole execution result. `validate` and `estimateCost` are
 * advisory hooks used before execution and for planning; {@link make} supplies a
 * valid result and zero cost when they are omitted.
 *
 * **Example** (Make filtering GraphOperation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { make, type GraphOperation } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const operation: GraphOperation<string, string> = make({
 *   operation: { name: TermIri.make(iri("operation:Trim")), run: () => Effect.succeed([]) },
 *   category: "filtering",
 * })
 *
 * console.log(operation.category) // "filtering"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface GraphOperation<A, B, R = never, E = never> {
  readonly category: OperationCategory;
  readonly estimateCost: (node: GraphNode<A>) => Effect.Effect<OperationCost>;
  readonly operation: Operation<GraphNode<A>, ReadonlyArray<GraphNode<B>>, E, R>;
  readonly validate: (node: GraphNode<A>) => Effect.Effect<ValidationResult>;
}

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
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { make } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const operation = make<string, string>({
 *   operation: { name: TermIri.make(iri("operation:Trim")), run: () => Effect.succeed([]) },
 *   category: "filtering",
 * })
 *
 * console.log(operation.operation.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = <A, B, R = never, E = never>(config: {
  readonly category: OperationCategory;
  readonly estimateCost?: (node: GraphNode<A>) => Effect.Effect<OperationCost>;
  readonly operation: Operation<GraphNode<A>, ReadonlyArray<GraphNode<B>>, E, R>;
  readonly validate?: (node: GraphNode<A>) => Effect.Effect<ValidationResult>;
}): GraphOperation<A, B, R, E> => ({
  category: config.category,
  estimateCost: config.estimateCost ?? (() => Effect.succeed(Types.OperationCost.zero())),
  operation: config.operation,
  validate: config.validate ?? (() => Effect.succeed(Types.ValidationResult.valid())),
});

/**
 * Create an operation from a pure data function that emits child payloads.
 *
 * **Details**
 *
 * The supplied function never receives the full node. Parent linkage, generated
 * child node ids, timestamps, and the operation term are added by this helper via
 * {@link makeNode}. Returning an empty array is the filtering case.
 *
 * **Example** (Pure duplicate expansion)
 *
 * ```ts import.meta.vitest name="Pure duplicate expansion"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { pure } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const duplicate = pure({
 *   name: TermIri.make(iri("operation:Tokenize")),
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
  readonly f: (data: A) => ReadonlyArray<B>;
  readonly name: TermIri;
}): GraphOperation<A, B> =>
  make({
    category: config.category,
    operation: {
      name: config.name,
      run: (node) =>
        Effect.forEach(config.f(node.data), makeNode(O.some(node.id), O.some(config.name)), { concurrency: 1 }),
    },
  });

/**
 * Create a one-to-one transformation operation.
 *
 * **Details**
 *
 * Each input leaf produces exactly one child node. The child node is linked to
 * the input leaf and records this operation's term in its metadata.
 *
 * **Example** (Lowercase transform operation)
 *
 * ```ts import.meta.vitest name="Lowercase transform operation"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { transform } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const normalize = transform({
 *   name: TermIri.make(iri("operation:ToLowerCase")),
 *   f: (text: string) => text.toLowerCase()
 * })
 *
 * normalize.category // => "transformation"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const transform = <A, B>(config: { readonly f: (data: A) => B; readonly name: TermIri }): GraphOperation<A, B> =>
  pure({
    category: "transformation",
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
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { expand } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const splitWords = expand({
 *   name: TermIri.make(iri("operation:Tokenize")),
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
  readonly f: (data: A) => ReadonlyArray<B>;
  readonly name: TermIri;
}): GraphOperation<A, B> => pure({ category: "expansion", f: config.f, name: config.name });

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
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { filter } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const nonEmpty = filter({
 *   name: TermIri.make(iri("operation:Trim")),
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
  readonly name: TermIri;
  readonly predicate: (data: A) => boolean;
}): GraphOperation<A, A> =>
  pure({
    category: "filtering",
    f: (data) => (config.predicate(data) ? A.of(data) : A.empty<A>()),
    name: config.name,
  });

/**
 * Read an operation's shape category.
 *
 * **Example** (Read transform category)
 *
 * ```ts import.meta.vitest name="Read transform category"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { getCategory, transform } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 *
 * const category = getCategory(transform({ name: TermIri.make(iri("operation:Trim")), f: (text: string) => text.trim() }))
 * category // => "transformation"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getCategory = <A, B, R, E>(operation: GraphOperation<A, B, R, E>): OperationCategory => operation.category;

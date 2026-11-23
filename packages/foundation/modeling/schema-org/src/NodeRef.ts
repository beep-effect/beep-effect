/**
 * Node identifiers and `@id` references that link nodes inside one JSON-LD
 * graph.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaOrgId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $SchemaOrgId.create("NodeRef");

const JsonString = S.fromJsonString(S.String);

/**
 * **Details**
 *
 * The rule behind this error is deliberately loose. An `@id` is an IRI in the
 * consumer's own namespace, and absolute IRIs, blank-node identifiers (`_:pkg`)
 * and relative or fragment forms are all legal JSON-LD. A stricter IRI grammar
 * would reject legal input in order to catch a typo, which is the wrong trade
 * for an identifier the consumer mints themselves.
 *
 * Identity is validated at graph assembly rather than at node construction, so
 * this error surfaces from `JsonLdDocument.buildResult` on the `E` channel — never as a
 * defect thrown out of a node's `make`.
 *
 * **Example** (Inspect an invalid node identifier)
 *
 * ```ts
 * import { InvalidNodeIdError } from "@beep/schema-org/NodeRef";
 *
 * const error = InvalidNodeIdError.make({ input: "bad id" });
 * console.log(error.message) // Invalid JSON-LD node id: "bad id"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class InvalidNodeIdError extends S.TaggedError<InvalidNodeIdError, { readonly brand: unique symbol }>(
  $I`InvalidNodeIdError`
)(
  "InvalidNodeIdError",
  {
    /**
     * The string that could not be used as an `@id`.
     *
     * @since 0.0.0
     */
    input: S.String.pipe(
      $I.annoteKey("InvalidNodeIdError.input", { description: "The string that could not be used as an `@id`." })
    ),
  },
  $I.annoteError<InvalidNodeIdError>("InvalidNodeIdError", {
    description:
      "Indicates that a string is not usable as a JSON-LD node identifier: it is empty, contains whitespace, or contains a control character.",
  })
) {
  /**
   * Formats the rejected identifier as a JSON string in the error message.
   *
   * **Example** (Read an identifier error message)
   *
   * ```ts
   * import { InvalidNodeIdError } from "@beep/schema-org/NodeRef";
   *
   * console.log(InvalidNodeIdError.make({ input: "" }).message) // Invalid JSON-LD node id: ""
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Invalid JSON-LD node id: ${Result.getOrThrow(S.encodeResult(JsonString)(this.input))}`;
  }
}

/**
 * The identifier rule: non-empty, no whitespace, no control characters.
 *
 * **Details**
 *
 * Written lookahead-free so that `Arbitrary.schema` derivation stays possible
 * for property tests.
 *
 * Control characters are excluded via `\p{Cc}` rather than a hand-written
 * `\u0000-\u001F\u007F` range. The property escape is both narrower to read and
 * strictly more correct: it also covers the C1 block (`U+0080`-`U+009F`), which
 * the explicit range silently admitted.
 */
const NODE_ID_PATTERN = /^[^\s\p{Cc}]+$/u;

/**
 * A JSON-LD node identifier: a non-empty string carrying no whitespace and no
 * control characters.
 *
 * **Details**
 *
 * Exported so a consumer can reuse the rule by identity rather than re-deriving
 * it. Node classes deliberately type their `@id` as a plain `Schema.String` and
 * defer the check to `JsonLdDocument.buildResult`, so a malformed identifier fails
 * through {@link InvalidNodeIdError} on the error channel instead of throwing
 * out of a constructor.
 *
 * **Example** (Validate a node identifier)
 *
 * ```ts
 * import { NodeId } from "@beep/schema-org/NodeRef";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(NodeId)("_:pkg")) // true
 * console.log(S.is(NodeId)("bad id")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const NodeId = S.String.check(
  S.isPattern(
    NODE_ID_PATTERN,
    $I.annote("NodeIdPattern", {
      // The native arbitrary cannot construct Unicode property escapes; guide its
      // fallback away from the empty size-zero string, which the pattern rejects.
      arbitraryConstraint: { minLength: 1 },
      description: "A non-empty string without whitespace or control characters.",
      message: "JSON-LD node identifier pattern",
    })
  )
).pipe(
  $I.annoteSchema("NodeId", { description: "A JSON-LD node identifier without whitespace or control characters." })
);

/**
 * The string accepted by the NodeId schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NodeId = typeof NodeId.Type;

/**
 * **Details**
 *
 * Every node-valued property in this package holds a `NodeRef` rather than an
 * embedded node. The `@graph` form exists so that nodes are siblings addressed
 * by `@id`; embedding is the alternative serialization of the same
 * information, and supporting both would double the value space of every
 * node-valued property for no additional capability. A consumer who wants a
 * nested node gives it an `@id` and adds it to the graph.
 *
 * A reference to an `@id` that is not in the graph is **not** an error — it is
 * how a node points at something described on another page. `JsonLdDocument` reports
 * such references through its `danglingReferences` accessor so that a consumer
 * whose graph is meant to be closed can gate on them, and one whose graph is
 * deliberately open can ignore them.
 *
 * **Example** (Reference an article author)
 *
 * ```ts
 * import { Person } from "@beep/schema-org/Person";
 * import { NodeRef } from "@beep/schema-org/NodeRef";
 * import { TechArticle } from "@beep/schema-org/TechArticle";
 *
 * const author = Person.make({ "@id": "https://example.com/#alice", name: "Alice" });
 * const article = TechArticle.make({
 * 	"@id": "https://example.com/docs#intro",
 * 	author: [NodeRef.to(author)],
 * });
 *
 * console.log(article.author?.[0]?.["@id"]) // https://example.com/#alice
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class NodeRef extends S.Opaque<NodeRef, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The identifier of the referenced node.
     *
     * @since 0.0.0
     */
    "@id": S.String.pipe($I.annoteKey("NodeRef.@id", { description: "The identifier of the referenced node." })),
  }).pipe($I.annoteSchema("NodeRef", { description: 'A reference from one node to another: the `{"@id": "…"}` form.' }))
) {
  /**
   * Builds a reference to a node you are already holding, or to a bare
   * identifier string.
   *
   * **Details**
   *
   * Total: it never throws and never validates. A malformed identifier is
   * reported by `JsonLdDocument.buildResult` along with every other identity problem,
   * so that the whole class of failure arrives typed and in one place rather
   * than as a throw at an arbitrary call site.
   *
   * **Example** (Reference an existing node)
   *
   * ```ts
   * import { NodeRef } from "@beep/schema-org/NodeRef";
   * const target = { "@id": "_:author" };
   * console.log(NodeRef.to(target)["@id"]) // _:author
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static to(target: string | HasNodeId): NodeRef {
    return NodeRef.make({ "@id": P.isString(target) ? target : target["@id"] });
  }

  /**
   * Validates an identifier and returns a reference, or fails with
   * {@link InvalidNodeIdError}.
   *
   * **Details**
   *
   * The synchronous `Result` form is the primitive; {@link NodeRef.toChecked}
   * is its `Effect` twin.
   *
   * **Example** (Reject an invalid reference)
   *
   * ```ts
   * import { NodeRef } from "@beep/schema-org/NodeRef";
   * import * as Result from "effect/Result";
   *
   * console.log(Result.isFailure(NodeRef.toCheckedResult("bad id"))) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static toCheckedResult(id: string): Result.Result<NodeRef, InvalidNodeIdError> {
    return NodeRef.isValidId(id)
      ? Result.succeed(NodeRef.make({ "@id": id }))
      : Result.fail(InvalidNodeIdError.make({ input: id }));
  }

  /**
   * The `Effect` twin of {@link NodeRef.toCheckedResult}, derived from it so the
   * two cannot drift.
   *
   * **Example** (Build a checked reference with an effect)
   *
   * ```ts
   * import { NodeRef } from "@beep/schema-org/NodeRef";
   * import * as Effect from "effect/Effect";
   *
   * const ref = Effect.runSync(NodeRef.toChecked("_:pkg"));
   * console.log(ref["@id"]) // _:pkg
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly toChecked = Effect.fn("NodeRef.toChecked")((id: string) =>
    Effect.fromResult(NodeRef.toCheckedResult(id))
  );

  /**
   * Whether a string is usable as an `@id`: non-empty, no whitespace, no
   * control characters.
   *
   * **Example** (Check identifier validity)
   *
   * ```ts
   * import { NodeRef } from "@beep/schema-org/NodeRef";
   * console.log(NodeRef.isValidId("_:pkg")) // true
   * console.log(NodeRef.isValidId("")) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly isValidId: (id: string) => boolean = S.is(NodeId);
}

/**
 * Anything carrying an `@id`. Every node class in this package satisfies it.
 *
 * **Details**
 *
 * Derived from the encoded side of {@link NodeRef}, so the shape has one
 * schema-owned definition: any object with a string `@id` qualifies.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type HasNodeId = typeof NodeRef.Encoded;

/**
 * The shared structural guard for node references.
 *
 * **Details**
 *
 * `NodeRef` is plain data, so any object carrying a string `@id` is accepted.
 *
 * **Example** (Recognize a node reference)
 *
 * ```ts
 * import { isNodeRef, NodeRef } from "@beep/schema-org/NodeRef";
 *
 * console.log(isNodeRef(NodeRef.to("_:pkg"))) // true
 * console.log(isNodeRef({ "@id": "_:pkg" })) // true
 * console.log(isNodeRef({ id: "_:pkg" })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isNodeRef = S.is(NodeRef);

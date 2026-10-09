import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/schema-org/NodeRef");

/**
 * Indicates that a string is not usable as a JSON-LD node identifier: it is
 * empty, contains whitespace, or contains a control character.
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
 * @public
 */
export class InvalidNodeIdError extends S.TaggedError<InvalidNodeIdError>($I`InvalidNodeIdError`)("InvalidNodeIdError", {
	/** The string that could not be used as an `@id`. */
	input: S.String.annotateKey({ description: "The string that could not be used as an `@id`." }),
}, $I.annote("InvalidNodeIdError", { description: "Indicates that a string is not usable as a JSON-LD node identifier: it is empty, contains whitespace, or contains a control character." })) {
	override get message(): string {
		return `Invalid JSON-LD node id: ${JSON.stringify(this.input)}`;
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
 * Exported so a consumer can reuse the rule by identity rather than re-deriving
 * it. Node classes deliberately type their `@id` as a plain `Schema.String` and
 * defer the check to `JsonLdDocument.buildResult`, so a malformed identifier fails
 * through {@link InvalidNodeIdError} on the error channel instead of throwing
 * out of a constructor.
 *
 * @public
 */
export const NodeId = S.String.check(S.isPattern(NODE_ID_PATTERN, {
	identifier: $I`NodeIdPattern`,
	title: "JSON-LD node identifier pattern",
	description: "A non-empty string without whitespace or control characters.",
})).pipe($I.annoteSchema("NodeId", { description: "A JSON-LD node identifier without whitespace or control characters." }));

/** The string accepted by the NodeId schema. */
export type NodeId = typeof NodeId.Type;

/**
 * Anything carrying an `@id`. Every node class in this package satisfies it.
 *
 * @public
 */
export interface HasNodeId {
	readonly "@id": string;
}

/**
 * A reference from one node to another: the `{"@id": "…"}` form.
 *
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
 * import { Person, NodeRef, TechArticle } from "./index.ts";
 *
 * const author = Person.make({ "@id": "https://example.com/#alice", name: "Alice" });
 * const article = TechArticle.make({
 * 	"@id": "https://example.com/docs#intro",
 * 	author: [NodeRef.to(author)],
 * });
 * ```
 *
 * @public
 */
export class NodeRef extends S.Class<NodeRef>($I`NodeRef`)({
	/** The identifier of the referenced node. */
	"@id": S.String.annotateKey({ description: "The identifier of the referenced node." }),
}, $I.annote("NodeRef", { description: "A reference from one node to another: the `{\"@id\": \"…\"}` form." })) {
	/**
	 * Builds a reference to a node you are already holding, or to a bare
	 * identifier string.
	 *
	 * Total: it never throws and never validates. A malformed identifier is
	 * reported by `JsonLdDocument.buildResult` along with every other identity problem,
	 * so that the whole class of failure arrives typed and in one place rather
	 * than as a throw at an arbitrary call site.
	 */
	static to(target: string | HasNodeId): NodeRef {
		return NodeRef.make({ "@id": P.isString(target) ? target : target["@id"] });
	}

	/**
	 * Validates an identifier and returns a reference, or fails with
	 * {@link InvalidNodeIdError}.
	 *
	 * The synchronous `Result` form is the primitive; {@link NodeRef.toChecked}
	 * is its `Effect` twin.
	 */
	static toCheckedResult(id: string): Result.Result<NodeRef, InvalidNodeIdError> {
		return NodeRef.isValidId(id)
			? Result.succeed(NodeRef.make({ "@id": id }))
			: Result.fail(InvalidNodeIdError.make({ input: id }));
	}

	/**
	 * The `Effect` twin of {@link NodeRef.toCheckedResult}, derived from it so the
	 * two cannot drift.
	 */
	static readonly toChecked = Effect.fn("NodeRef.toChecked")((id: string) =>
		Effect.fromResult(NodeRef.toCheckedResult(id)),
	);

	/**
	 * Whether a string is usable as an `@id`: non-empty, no whitespace, no
	 * control characters.
	 */
	static readonly isValidId: (id: string) => boolean = S.is(NodeId);
}

/** The shared nominal guard for typed node references. */
export const isNodeRef = S.is(NodeRef);

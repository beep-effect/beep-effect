import { Effect, Result, Schema } from "effect";
import { APIReference } from "./APIReference.ts";
import { CreativeWork } from "./CreativeWork.ts";
import { InvalidNodeIdError, NodeRef } from "./NodeRef.ts";
import { Organization } from "./Organization.ts";
import { Person } from "./Person.ts";
import { SoftwareSourceCode } from "./SoftwareSourceCode.ts";
import { TechArticle } from "./TechArticle.ts";

/**
 * Indicates that two nodes in one graph claim the same `@id`.
 *
 * This is caller error rather than a reportable issue: JSON-LD would silently
 * merge the two nodes, so a graph that contains it does not mean what its
 * author thinks it means.
 *
 * @public
 */
export class DuplicateNodeIdError extends Schema.TaggedError<DuplicateNodeIdError>()("DuplicateNodeIdError", {
	/** The `@id` claimed by more than one node. */
	id: Schema.String,
}) {
	override get message(): string {
		return `Two nodes claim the same @id: ${JSON.stringify(this.id)}`;
	}
}

/**
 * Indicates that a key in a node's `additional` catch-all collides with a
 * typed field on that node, or with `@id` or `@type`.
 *
 * Unambiguous caller error: the flattened output would carry one term twice
 * with one of the two silently winning.
 *
 * @public
 */
export class ConflictingTermError extends Schema.TaggedError<ConflictingTermError>()("ConflictingTermError", {
	/** The `@id` of the node carrying the collision. */
	nodeId: Schema.String,
	/** The colliding term. */
	term: Schema.String,
}) {
	override get message(): string {
		return `Node ${JSON.stringify(this.nodeId)} sets ${JSON.stringify(this.term)} in both a typed field and \`additional\``;
	}
}

/**
 * Any node this package can place in a graph.
 *
 * @public
 */
export const JsonLdNode = Schema.Union([
	SoftwareSourceCode,
	TechArticle,
	APIReference,
	Person,
	Organization,
	CreativeWork,
]);

/**
 * Any node this package can place in a graph.
 *
 * @public
 */
export type JsonLdNode = typeof JsonLdNode.Type;

/** Every node class, keyed by its `@type`, for reserved-key lookup. */
const NODE_SCHEMAS = {
	SoftwareSourceCode,
	TechArticle,
	APIReference,
	Person,
	Organization,
	CreativeWork,
} as const;

/** The terms a node's `additional` catch-all may never set. */
const reservedTerms = (node: JsonLdNode): ReadonlySet<string> =>
	new Set(Object.keys(NODE_SCHEMAS[node["@type"]].fields));

/** Every `@id` a node points at through a `NodeRef`, in any field. */
const referencedIds = (node: JsonLdNode): ReadonlyArray<string> => {
	const ids: Array<string> = [];
	for (const value of Object.values(node)) {
		if (value instanceof NodeRef) ids.push(value["@id"]);
		else if (Array.isArray(value)) for (const item of value) if (item instanceof NodeRef) ids.push(item["@id"]);
	}
	return ids;
};

/**
 * The three characters escaped by {@link JsonLdDocument.toScriptBody}.
 *
 * In a JSON document these can occur only inside string literals — no other
 * JSON token contains them — so a blanket post-`stringify` replacement cannot
 * corrupt the document's structure. That is what makes the escape exhaustive
 * rather than heuristic.
 */
const SCRIPT_ESCAPES: Readonly<Record<string, string>> = {
	"<": "\\u003c",
	">": "\\u003e",
	"&": "\\u0026",
};

/** Drops keys whose value is `undefined`; JSON-LD has no undefined and no meaningful null. */
const withoutUndefined = (value: Record<string, unknown>): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) if (entry !== undefined) out[key] = entry;
	return out;
};

/**
 * A JSON-LD document: `@context` plus a flat `@graph` of nodes that reference
 * each other by `@id`.
 *
 * `JsonLdDocument` is a `Schema.Class`, so its encode direction is available through the
 * schema as well as through {@link JsonLdDocument.toJsonLd}. **The two are not the same
 * value**, and the difference is deliberate: `Schema.encodeSync(JsonLdDocument)` produces the
 * structural form, in which each node's catch-all is still nested under an
 * `additional` key, while `toJsonLd` produces the JSON-LD wire form, in which
 * the catch-all is flattened into the node object as the format requires.
 * `toJsonLd` is the documented output; the schema's own encode is not a
 * publishable JSON-LD document.
 *
 * **Do not rely on decoding.** Decoding a JSON-LD document back into typed
 * nodes would have to re-gather every unrecognized key into `additional`, and
 * this schema does not: decoding `toJsonLd()` output succeeds but silently
 * drops the flattened catch-all keys. Do not infer `decode(encode(g))`
 * round-tripping from the fact that this is a `Schema.Class`.
 *
 * @example
 * ```ts
 * import { JsonLdDocument, NodeRef, SoftwareSourceCode, TechArticle } from "./index.ts";
 * import { Result } from "effect";
 *
 * const built = JsonLdDocument.buildResult([
 * 	SoftwareSourceCode.make({ "@id": "https://example.com/pkg#source", name: "example" }),
 * 	TechArticle.make({
 * 		"@id": "https://example.com/docs#intro",
 * 		headline: "Getting started",
 * 		isPartOf: [NodeRef.to("https://example.com/pkg#source")],
 * 	}),
 * ]);
 *
 * if (Result.isSuccess(built)) {
 * 	console.log(built.success.toScriptBody());
 * }
 * ```
 *
 * @public
 */
export class JsonLdDocument extends Schema.Class<JsonLdDocument>("JsonLdDocument")({
	/** The JSON-LD context, fixed at `https://schema.org` and populated automatically. */
	"@context": Schema.tag("https://schema.org"),
	/** The nodes in the document. */
	"@graph": Schema.Array(JsonLdNode),
}) {
	/**
	 * Assembles nodes into a graph, checking identity.
	 *
	 * This is the synchronous primitive; {@link JsonLdDocument.build} is its
	 * `Effect` twin. Note that
	 * `make` is reserved by `Schema.Class` for its raw structural constructor,
	 * which runs none of these checks — `buildResult` is the entry point.
	 *
	 * Three failures, all of them caller error rather than reportable issues:
	 *
	 * - a malformed `@id` on a node or on a reference ({@link InvalidNodeIdError})
	 * - two nodes claiming one `@id` ({@link DuplicateNodeIdError})
	 * - a catch-all key colliding with a typed field ({@link ConflictingTermError})
	 *
	 * A **dangling reference is not a failure.** Pointing at a node described
	 * on another page is legal, common and often correct; refusing it would
	 * make this package wrong. Read {@link JsonLdDocument.danglingReferences} to gate on
	 * closure if your graph is meant to be closed.
	 */
	static buildResult(
		nodes: ReadonlyArray<JsonLdNode>,
	): Result.Result<JsonLdDocument, InvalidNodeIdError | DuplicateNodeIdError | ConflictingTermError> {
		const seen = new Set<string>();
		for (const node of nodes) {
			const id = node["@id"];
			if (!NodeRef.isValidId(id)) return Result.fail(new InvalidNodeIdError({ input: id }));
			if (seen.has(id)) return Result.fail(new DuplicateNodeIdError({ id }));
			seen.add(id);

			for (const referenced of referencedIds(node)) {
				if (!NodeRef.isValidId(referenced)) return Result.fail(new InvalidNodeIdError({ input: referenced }));
			}

			const reserved = reservedTerms(node);
			for (const term of Object.keys(node.additional ?? {})) {
				if (reserved.has(term)) return Result.fail(new ConflictingTermError({ nodeId: id, term }));
			}
		}
		return Result.succeed(JsonLdDocument.make({ "@graph": nodes }));
	}

	/**
	 * The `Effect` twin of {@link JsonLdDocument.buildResult}, derived from it so the
	 * two cannot drift. Nothing here is asynchronous and nothing does IO, so
	 * the `Effect` carries only the span and the error channel.
	 */
	static readonly build = Effect.fn("JsonLdDocument.build")((nodes: ReadonlyArray<JsonLdNode>) =>
		Effect.fromResult(JsonLdDocument.buildResult(nodes)),
	);

	/** The `@id` of every node in the graph. */
	get nodeIds(): ReadonlySet<string> {
		return new Set(this["@graph"].map((node) => node["@id"]));
	}

	/**
	 * Every `@id` referenced by a node in this graph that no node in this graph
	 * defines, deduplicated.
	 *
	 * Not an error: a reference to an organization described on another page is
	 * correct JSON-LD. This accessor exists so a consumer whose graph is
	 * supposed to be closed can gate on it, and one whose graph is deliberately
	 * open can ignore it. The package refuses to decide which you are.
	 */
	get danglingReferences(): ReadonlyArray<string> {
		const defined = this.nodeIds;
		const dangling = new Set<string>();
		for (const node of this["@graph"]) {
			for (const id of referencedIds(node)) if (!defined.has(id)) dangling.add(id);
		}
		return [...dangling];
	}

	/**
	 * The JSON-LD wire form of this graph as a plain value: every node's
	 * catch-all flattened into the node object, and every `undefined`-valued
	 * key dropped.
	 *
	 * **If you are producing text, use {@link JsonLdDocument.toScriptBody}. Never
	 * `JSON.stringify` this value into an HTML page.** `JSON.stringify` does
	 * not escape `<`, so a description containing the literal `</script>`
	 * closes the JSON-LD block early and injects markup into the document. That
	 * is the failure this package exists to prevent, and it is reintroduced the
	 * moment this value is serialized by hand.
	 *
	 * This accessor exists because the encoded value is reachable through
	 * `Schema.encodeSync` whatever this package does, so naming it is the only way
	 * to attach that warning to it. Its legitimate use is handing an object to
	 * a framework that serializes JSON-LD itself.
	 */
	toJsonLd(): Schema.Json {
		const encoded = Schema.encodeSync(JsonLdDocument)(this) as {
			readonly "@context": string;
			readonly "@graph": ReadonlyArray<Record<string, unknown>>;
		};
		return {
			"@context": encoded["@context"],
			"@graph": encoded["@graph"].map((node) => {
				const { additional, "@id": id, "@type": type, ...rest } = node;
				// `@id` and `@type` lead, so a human reading the emitted document
				// meets the node's identity before its payload.
				const flattened = {
					"@id": id,
					"@type": type,
					...withoutUndefined(rest),
					...(additional as Record<string, unknown> | undefined),
				};
				return flattened as Schema.Json;
			}),
		};
	}

	/**
	 * The graph serialized as a JSON-LD body that is safe to place inside a
	 * `<script type="application/ld+json">` element.
	 *
	 * **This is the only text serializer in this package, and it is the escaped
	 * one.** There is deliberately no unescaped twin: the escaped output is not
	 * a restricted form but a semantically identical one, since `<` and
	 * friends are valid JSON string escapes that every conforming parser
	 * resolves to the original characters. No caller needs the raw bytes, so a
	 * second entry point could only ever be chosen wrongly.
	 *
	 * `<`, `>` and `&` are escaped after `JSON.stringify`. With no `<` in the
	 * body, neither `</script` nor `<!--` can appear, which is the whole HTML
	 * raw-text hazard; `&` is included so the output is also well-formed when
	 * the document is served as XHTML, where script content is parsed as
	 * ordinary element content. `U+2028` and `U+2029` are deliberately not
	 * escaped: they matter only inside JavaScript source, and this is never
	 * JavaScript source.
	 *
	 * **The escape is idempotent**, so a caller layering its own escaping over
	 * this output is safe: the escaped form contains none of the three
	 * characters the escape matches on, so a second pass matches nothing and
	 * changes nothing. That is a composition guarantee a consumer can rely on.
	 * Note that it
	 * is a property of *this* escape form specifically — an HTML entity form
	 * (`&lt;`) would be equally correct escaping and would **not** be
	 * idempotent, because it reintroduces an `&`.
	 *
	 * The return value is the element's **body**, not the element. Wrap it:
	 *
	 * ```html
	 * <script type="application/ld+json">BODY</script>
	 * ```
	 */
	toScriptBody(): string {
		return JSON.stringify(this.toJsonLd()).replace(/[<>&]/g, (char) => SCRIPT_ESCAPES[char] ?? char);
	}
}

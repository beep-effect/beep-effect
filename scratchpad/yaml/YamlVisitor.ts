/**
 * SAX-style YAML AST visitor: a demand-driven `Stream` of typed events over a
 * parsed document, enabling early termination (`Stream.take`) without building
 * a full in-memory result beyond the AST itself.
 *
 * The event union is a `Data.TaggedEnum` — serializable tagged values with
 * structural equality. v3's `visitCollect` is dropped: `Stream.filter` +
 * `Stream.runCollect` cover it. Lexical tokens are public via {@link YamlTokens};
 * this visitor stays at the AST layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Data, Stream } from "effect";
import { composeAllDocuments } from "./internal/composer/document.ts";
import type { RawYamlDocument } from "./internal/raw-document.ts";
import type { YamlParseOptions } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import type { YamlPath } from "./YamlEdit.ts";
import type { CollectionStyle, ScalarStyle, YamlNode, YamlPair } from "./YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "./YamlNode.ts";

/**
 * The discriminated union of YAML AST visitor events. Every variant carries
 * `path` (segments from the document root) and `depth` (zero-based nesting
 * level); collection/scalar begin events also carry `style` and the optional
 * `tag`/`anchor`. `Error` carries a materialized {@link YamlDiagnostic} for
 * every diagnostic recorded while composing the document — fatal or not.
 *
 * @see {@link YamlVisitor.visit} for the stream that yields these events.
 * @see {@link (YamlVisitorEvent:variable)} for the constructors and `$is` matchers.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlVisitorEvent = Data.TaggedEnum<{
	DocumentStart: {
		readonly path: YamlPath;
		readonly depth: number;
		readonly directives: ReadonlyArray<{ readonly name: string; readonly parameters: ReadonlyArray<string> }>;
	};
	DocumentEnd: { readonly path: YamlPath; readonly depth: number };
	MapStart: {
		readonly path: YamlPath;
		readonly depth: number;
		readonly style: CollectionStyle;
		readonly tag?: string;
		readonly anchor?: string;
	};
	MapEnd: { readonly path: YamlPath; readonly depth: number };
	SeqStart: {
		readonly path: YamlPath;
		readonly depth: number;
		readonly style: CollectionStyle;
		readonly tag?: string;
		readonly anchor?: string;
	};
	SeqEnd: { readonly path: YamlPath; readonly depth: number };
	Pair: { readonly path: YamlPath; readonly depth: number; readonly key: unknown; readonly value: unknown };
	Scalar: {
		readonly path: YamlPath;
		readonly depth: number;
		readonly value: unknown;
		readonly style: ScalarStyle;
		readonly tag?: string;
		readonly anchor?: string;
	};
	Alias: { readonly path: YamlPath; readonly depth: number; readonly name: string };
	Comment: {
		readonly path: YamlPath;
		readonly depth: number;
		readonly text: string;
		/** Where the comment sits relative to its construct: own-line above (`"leading"`) or same-line after (`"trailing"`). */
		readonly placement: "leading" | "trailing";
	};
	Directive: { readonly path: YamlPath; readonly depth: number; readonly name: string; readonly parameters: string };
	Error: { readonly path: YamlPath; readonly depth: number; readonly diagnostic: YamlDiagnostic };
}>;

/**
 * Constructors and matchers for the `YamlVisitorEvent` union (e.g.
 * `YamlVisitorEvent.Scalar({ path, depth, value, style })`,
 * `YamlVisitorEvent.$is("MapStart")`).
 *
 * **Example** (Construct and narrow an event)
 *
 * ```ts
 * import { YamlVisitorEvent } from "@beep/scratchpad/yaml"
 *
 * const start = YamlVisitorEvent.DocumentStart({ path: [], depth: 0, directives: [] })
 *
 * console.log(start._tag) // "DocumentStart"
 * console.log(YamlVisitorEvent.$is("DocumentStart")(start)) // true
 * ```
 *
 * @see {@link (YamlVisitorEvent:type)} for the discriminated union these constructors inhabit.
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const YamlVisitorEvent = Data.taggedEnum<YamlVisitorEvent>();

/**
 * Walk a YAML document as a demand-driven stream of SAX-style AST events.
 *
 * **Gotchas**
 *
 * The stream is type-level infallible: fatal and non-fatal compose diagnostics
 * (including `AliasCountExceeded`) are `Error` events in-band. Do not `Stream.run`
 * expecting failure on bad YAML — you get a successful stream of `Error` events.
 * {@link YamlVisitorEvent} `Pair` resolves only scalar key/value (`null` for
 * complex keys) but still walks nested nodes. Comments live on key/value nodes
 * and are not re-emitted on the pair.
 *
 * **Example** (Take DocumentStart and match in-band errors)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { YamlVisitor } from "@beep/scratchpad/yaml"
 *
 * const prefix = Effect.runSync(Stream.runCollect(Stream.take(YamlVisitor.visit("name: Alice\n"), 1)))
 * console.log(prefix[0]?._tag) // "DocumentStart"
 *
 * const events = Effect.runSync(Stream.runCollect(YamlVisitor.visit("a: 1\na: 2\n")))
 * console.log(events.some((event) => event._tag === "Error")) // true
 * ```
 *
 * @see {@link YamlTokens.tokenize} for the lexical token stream used by lint/LSP.
 * @see {@link YamlDocument.parse} for a fully materialized AST plus recovered diagnostics.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class YamlVisitor {
	private constructor() {}

	/**
	 * Create a lazy `Stream` of `YamlVisitorEvent` from YAML text, in document
	 * order. Multi-document streams (separated by `---`) produce a separate
	 * `DocumentStart`/`DocumentEnd` pair per document. Events are produced on
	 * demand, so combining with `Stream.take` allows efficient partial scans
	 * of large documents without materializing the whole event sequence.
	 *
	 * **Gotchas**
	 *
	 * Infallible at the type level: diagnostics recorded while composing
	 * (fatal or not, including an exceeded `maxAliasCount`, recorded as
	 * `AliasCountExceeded`) surface as `Error` events inside the stream rather
	 * than failing it.
	 */
	static visit(text: string, options?: YamlParseOptions): Stream.Stream<YamlVisitorEvent> {
		return Stream.fromIterable(visitGen(text, options));
	}
}

function* visitGen(text: string, options?: YamlParseOptions): Generator<YamlVisitorEvent> {
	const { documents, streamErrors } = composeAllDocuments(text, {
		strict: options?.strict,
		maxAliasCount: options?.maxAliasCount,
		uniqueKeys: options?.uniqueKeys,
	});

	for (const raw of streamErrors) {
		yield YamlVisitorEvent.Error({ path: [], depth: 0, diagnostic: YamlDiagnostic.fromRaw(raw, text) });
	}

	for (const doc of documents) {
		yield* walkDocument(doc, text);
	}
}

function* walkDocument(doc: RawYamlDocument, text: string): Generator<YamlVisitorEvent> {
	const path: YamlPath = [];
	const depth = 0;

	for (const dir of doc.directives) {
		yield YamlVisitorEvent.Directive({ path, depth, name: dir.name, parameters: dir.parameters.join(" ") });
	}

	yield YamlVisitorEvent.DocumentStart({
		path,
		depth,
		directives: doc.directives.map((d) => ({ name: d.name, parameters: d.parameters })),
	});

	for (const raw of doc.errors) {
		yield YamlVisitorEvent.Error({ path, depth, diagnostic: YamlDiagnostic.fromRaw(raw, text) });
	}
	for (const raw of doc.warnings) {
		yield YamlVisitorEvent.Error({ path, depth, diagnostic: YamlDiagnostic.fromRaw(raw, text) });
	}

	if (doc.commentBefore !== undefined) {
		yield YamlVisitorEvent.Comment({ path, depth, text: doc.commentBefore, placement: "leading" });
	}

	if (doc.contents !== null) {
		yield* walkNode(doc.contents, path, depth);
	}

	if (doc.comment !== undefined) {
		yield YamlVisitorEvent.Comment({ path, depth, text: doc.comment, placement: "trailing" });
	}

	yield YamlVisitorEvent.DocumentEnd({ path, depth });
}

function* walkNode(node: YamlNode, path: YamlPath, depth: number): Generator<YamlVisitorEvent> {
	if (node instanceof YamlScalar) {
		if (node.commentBefore !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.commentBefore, placement: "leading" });
		}
		if (node.comment !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.comment, placement: "trailing" });
		}
		yield YamlVisitorEvent.Scalar({
			path,
			depth,
			value: node.value,
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
		});
	} else if (node instanceof YamlAlias) {
		if (node.commentBefore !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.commentBefore, placement: "leading" });
		}
		if (node.comment !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.comment, placement: "trailing" });
		}
		yield YamlVisitorEvent.Alias({ path, depth, name: node.name });
	} else if (node instanceof YamlMap) {
		if (node.commentBefore !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.commentBefore, placement: "leading" });
		}
		if (node.comment !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.comment, placement: "trailing" });
		}
		yield YamlVisitorEvent.MapStart({
			path,
			depth,
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
		});
		for (const pair of node.items) {
			yield* walkPair(pair, path, depth + 1);
		}
		yield YamlVisitorEvent.MapEnd({ path, depth });
	} else if (node instanceof YamlSeq) {
		if (node.commentBefore !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.commentBefore, placement: "leading" });
		}
		if (node.comment !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.comment, placement: "trailing" });
		}
		yield YamlVisitorEvent.SeqStart({
			path,
			depth,
			style: node.style,
			...(node.tag !== undefined ? { tag: node.tag } : {}),
			...(node.anchor !== undefined ? { anchor: node.anchor } : {}),
		});
		for (let i = 0; i < node.items.length; i++) {
			const item = node.items[i] as YamlNode;
			yield* walkNode(item, [...path, i], depth + 1);
		}
		yield YamlVisitorEvent.SeqEnd({ path, depth });
	}
}

function* walkPair(pair: YamlPair, parentPath: YamlPath, depth: number): Generator<YamlVisitorEvent> {
	const resolvedKey = pair.key instanceof YamlScalar ? pair.key.value : null;
	const resolvedValue = pair.value instanceof YamlScalar ? pair.value.value : null;

	const keySegment: string | number =
		typeof resolvedKey === "string" ? resolvedKey : typeof resolvedKey === "number" ? resolvedKey : String(resolvedKey);

	const pairPath: YamlPath = [...parentPath, keySegment];

	// An entry's comments live on its key and value NODES, and both walks below
	// run at this same pairPath — so the Comment events a consumer sees are
	// unchanged, and emitting them here as well would duplicate every one.

	yield YamlVisitorEvent.Pair({ path: pairPath, depth, key: resolvedKey, value: resolvedValue });

	// Walk into the key node — emits a Scalar event for scalar keys, or
	// sub-events for complex keys (e.g. a YamlMap used as a key).
	yield* walkNode(pair.key, pairPath, depth + 1);

	// Walk into the value node — emits a Scalar event for scalar values, or
	// sub-events for complex values (maps, sequences, aliases).
	if (pair.value !== null) {
		yield* walkNode(pair.value, pairPath, depth + 1);
	}
}

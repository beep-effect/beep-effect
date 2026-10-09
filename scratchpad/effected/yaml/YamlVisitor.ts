// SAX-style AST visitor: a demand-driven `Stream` of typed events over a
// parsed YAML document, enabling early termination (`Stream.take`) without
// building a full in-memory result beyond the AST itself.
//
// The event union is a `Data.TaggedEnum` — serializable tagged values with
// structural equality, consistent with the rest of the library; `_tag`
// narrowing suffices, so there are no `is*` guards. There is no collecting
// variant: `Stream.filter` + `Stream.runCollect` cover it.
//
// This is the AST-level visitor only — the CST layer stays internal.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Data from "effect/Data";
import * as Stream from "effect/Stream";
import * as S from "effect/Schema";
import { composeAllDocuments } from "./internal/composer/document.ts";
import type { RawYamlDocument } from "./internal/raw-document.ts";
import type { YamlParseOptions } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import type { YamlPath } from "./YamlEdit.ts";
import { CollectionStyle, ScalarStyle, type YamlNode, type YamlPair } from "./YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "./YamlNode.ts";
import * as P from "effect/Predicate";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/yaml/YamlVisitor");

const eventContext = {
	path: S.Array(S.Union([S.String, S.Finite])).annotateKey({ description: "Ordered mapping keys and sequence indices from the document root." }),
	depth: S.Finite.annotateKey({ description: "Zero-based nesting depth of the visited construct." }),
};
const eventProperties = {
	tag: S.optionalKey(S.String).annotateKey({ description: "Explicit YAML tag attached to the construct, when present." }),
	anchor: S.optionalKey(S.String).annotateKey({ description: "Anchor name attached to the construct, when present." }),
};
const collectionContext = {
	...eventContext,
	...eventProperties,
	style: CollectionStyle.annotateKey({ description: "Block or flow presentation of the collection." }),
};
const visitorEvent = S.TaggedUnion({
	DocumentStart: {
		...eventContext,
		directives: S.Array(S.Struct({
			name: S.String.annotateKey({ description: "Directive name without its percent indicator." }),
			parameters: S.Array(S.String).annotateKey({ description: "Ordered directive parameters." }),
		}).annotate($I.annote("VisitorDirective", { description: "A directive attached to a visited document." }))).annotateKey({ description: "Directives applying to the document in source order." }),
	},
	DocumentEnd: eventContext,
	MapStart: collectionContext,
	MapEnd: eventContext,
	SeqStart: collectionContext,
	SeqEnd: eventContext,
	Pair: {
		...eventContext,
		key: S.Unknown.annotateKey({ description: "Resolved scalar key, or null for a complex key." }),
		value: S.Unknown.annotateKey({ description: "Resolved scalar value, or null for a collection or omitted value." }),
	},
	Scalar: {
		...eventContext,
		...eventProperties,
		value: S.Unknown.annotateKey({ description: "Resolved YAML scalar value." }),
		style: ScalarStyle.annotateKey({ description: "Scalar presentation style in the source." }),
	},
	Alias: { ...eventContext, name: S.String.annotateKey({ description: "Referenced anchor name." }) },
	Comment: {
		...eventContext,
		text: S.String.annotateKey({ description: "Comment text attached to the visited construct." }),
		placement: S.Literals(["leading", "trailing"]).annotateKey({ description: "Own-line comment before the construct or same-line comment after it." }),
	},
	Directive: {
		...eventContext,
		name: S.String.annotateKey({ description: "Directive name without its percent indicator." }),
		parameters: S.String.annotateKey({ description: "Directive parameters joined with spaces." }),
	},
	Error: { ...eventContext, diagnostic: YamlDiagnostic.annotateKey({ description: "Positioned diagnostic recorded while composing the document." }) },
}).annotate($I.annote("YamlVisitorEvent", { description: "Concrete YAML AST visitor events with shared path and nesting context." }));

/**
 * The discriminated union of YAML AST visitor events. Every variant carries
 * `path` (segments from the document root) and `depth` (zero-based nesting
 * level); collection/scalar begin events also carry `style` and the optional
 * `tag`/`anchor`. `Error` carries a materialized {@link YamlDiagnostic} for
 * every diagnostic recorded while composing the document — fatal or not.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlVisitorEvent = typeof visitorEvent.Type;

/**
 * Constructors and matchers for the `YamlVisitorEvent` union (e.g.
 * `YamlVisitorEvent.Scalar({ path, depth, value, style })`,
 * `YamlVisitorEvent.$is("MapStart")`).
 *

 * **Example** (Construct and identify a scalar event)
 *
 * ```ts
 * import { YamlVisitorEvent } from "@beep/scratchpad/effected/yaml/YamlVisitor";
 *
 * const event = YamlVisitorEvent.Scalar({ path: [], depth: 0, value: "hello", style: "plain" });
 * console.log(YamlVisitorEvent.$is("Scalar")(event)) // true
 * ```
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export const YamlVisitorEvent = Data.taggedEnum<YamlVisitorEvent>();

/**
 * Walks YAML text as a lazy `Stream` of typed events — documents, collections,
 * pairs, scalars, aliases, comments, directives and recovered errors — in
 * document order. Not instantiable.
 *
 * **Example** (Collect YAML mapping keys and scalar values)
 *
 * ```ts
 * import { YamlVisitor, YamlVisitorEvent } from "@beep/scratchpad/effected/yaml/YamlVisitor";
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 *
 * // Mapping keys are scalar events too, so keys and values interleave.
 * const scalars = YamlVisitor.visit("a: 1\nb:\n  - x\n").pipe(
 *   Stream.filter(YamlVisitorEvent.$is("Scalar")),
 *   Stream.map((event) => event.value),
 *   Stream.runCollect,
 * );
 * console.log(JSON.stringify(await Effect.runPromise(scalars))) // ["a",1,"b","x"]
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export class YamlVisitor {
	private constructor() {}

	/**
 * Create a lazy `Stream` of `YamlVisitorEvent` from YAML text, in document
 * order.
 *
 * **Details**
 *
 * Multi-document streams (separated by `---`) produce a separate
 * `DocumentStart`/`DocumentEnd` pair per document. Events are produced on
 * demand, so combining with `Stream.take` allows efficient partial scans
 * of large documents without materializing the whole event sequence.
 *
 * Infallible at the type level: diagnostics recorded while composing
 * (fatal or not, including an exceeded `maxAliasCount`, recorded as
 * `AliasCountExceeded`) surface as `Error` events inside the stream rather
 * than failing it.
 *
 * **Example** (Visit the first document event)
 *
 * ```ts
 * import { YamlVisitor } from "@beep/scratchpad/effected/yaml/YamlVisitor";
 * import * as A from "effect/Array";
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 *
 * const events = await Effect.runPromise(
 *   YamlVisitor.visit("a: 1\n").pipe(Stream.take(1), Stream.runCollect),
 * );
 * console.log(JSON.stringify(A.map(events, (event) => event._tag))) // ["DocumentStart"]
 * ```
 *
 * @param text - The YAML source to visit.
 * @param options - Optional {@link YamlParseOptions} controlling composition.
 * @returns A lazy `Stream` of `YamlVisitorEvent`, infallible at the type
 *   level.
 * @category streams
 * @since 0.0.0
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
	if (S.is(YamlScalar)(node)) {
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
			...O.getSomesStruct({ tag: O.fromUndefinedOr(node.tag) }),
			...O.getSomesStruct({ anchor: O.fromUndefinedOr(node.anchor) }),
		});
	} else if (S.is(YamlAlias)(node)) {
		if (node.commentBefore !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.commentBefore, placement: "leading" });
		}
		if (node.comment !== undefined) {
			yield YamlVisitorEvent.Comment({ path, depth, text: node.comment, placement: "trailing" });
		}
		yield YamlVisitorEvent.Alias({ path, depth, name: node.name });
	} else if (S.is(YamlMap)(node)) {
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
			...O.getSomesStruct({ tag: O.fromUndefinedOr(node.tag) }),
			...O.getSomesStruct({ anchor: O.fromUndefinedOr(node.anchor) }),
		});
		for (const pair of node.items) {
			yield* walkPair(pair, path, depth + 1);
		}
		yield YamlVisitorEvent.MapEnd({ path, depth });
	} else if (S.is(YamlSeq)(node)) {
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
			...O.getSomesStruct({ tag: O.fromUndefinedOr(node.tag) }),
			...O.getSomesStruct({ anchor: O.fromUndefinedOr(node.anchor) }),
		});
		for (const [i, item] of node.items.entries()) {
			yield* walkNode(item, [...path, i], depth + 1);
		}
		yield YamlVisitorEvent.SeqEnd({ path, depth });
	}
}

function* walkPair(pair: YamlPair, parentPath: YamlPath, depth: number): Generator<YamlVisitorEvent> {
	const resolvedKey = S.is(YamlScalar)(pair.key) ? pair.key.value : null;
	const resolvedValue = S.is(YamlScalar)(pair.value) ? pair.value.value : null;

	const keySegment: string | number =
		P.isString(resolvedKey) ? resolvedKey : P.isNumber(resolvedKey) ? resolvedKey : String(resolvedKey);

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

// The mutually-recursive YAML AST: YamlScalar, YamlMap, YamlSeq, YamlPair,
// YamlAlias and the YamlNode union, co-located in one module to break the
// import cycle inherent in the recursive node types.
//
// Nodes deliberately carry no parent pointers (circular references would
// break structural equality, serialization and Schema encode/decode). Child
// relationships are expressed via `items`/`key`/`value`, and the recursive
// types are handled with `Schema.suspend`.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { YamlPath } from "./YamlEdit.ts";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/yaml/YamlNode");

/**
 * YAML scalar presentation styles.
 *
 * @public
 */
export const ScalarStyle = LiteralKit([
	"plain",
	"single-quoted",
	"double-quoted",
	"block-literal",
	"block-folded",
]).pipe($I.annoteSchema("ScalarStyle", { description: "YAML scalar presentation styles." }));

/**
 * The union of all scalar style string literals.
 *
 * @public
 */
export type ScalarStyle = typeof ScalarStyle.Type;

/**
 * YAML collection presentation styles.
 *
 * @public
 */
export const CollectionStyle = LiteralKit(["block", "flow"]).pipe($I.annoteSchema("CollectionStyle", { description: "YAML collection presentation styles." }));

/**
 * The union of all collection style string literals.
 *
 * @public
 */
export type CollectionStyle = typeof CollectionStyle.Type;

/**
 * Quote characters available to the stringifier's plain-scalar fallback: the
 * style a `plain`-styled scalar is rendered in when it turns out to require
 * quoting. Referenced by the `quoteStyle` field of `YamlStringifyOptions`;
 * unlike `ScalarStyle` it is a stringify-option vocabulary, never a property
 * of a composed node.
 *
 * @public
 */
export const QuoteStyle = LiteralKit(["single", "double"]).pipe($I.annoteSchema("QuoteStyle", { description: "Quote characters available to the stringifier's plain-scalar fallback: the style a `plain`-styled scalar is rendered in when it turns out to require quoting. Referenced by the `quoteStyle` field of `YamlStringifyOptions`; unlike `ScalarStyle` it is a stringify-option vocabulary, never a property of a composed node." }));

/**
 * The union of all fallback quote style string literals.
 *
 * @public
 */
export type QuoteStyle = typeof QuoteStyle.Type;

/**
 * Foreign resolution dialects the stringifier's plain-scalar fallback can
 * defend against: setting the `quoteCompat` field of `YamlStringifyOptions`
 * to `"yaml-1.1"` additionally quotes every plain scalar a YAML 1.1 parser
 * (js-yaml, PyYAML, libyaml, and the `yaml` npm package's YAML 1.1 schema,
 * whose lenient resolvers set the outer bound) would implicitly resolve to a
 * non-string —
 * `yes`/`no`/`on`/`off` booleans, ISO 8601 and space-separated timestamps,
 * sexagesimal `1:30`, underscored `1_000` and base-2/8/16 numbers. Like
 * `QuoteStyle` it is a stringify-option vocabulary, never a property of a
 * composed node.
 *
 * @public
 */
export const QuoteCompat = LiteralKit(["yaml-1.1"]).pipe($I.annoteSchema("QuoteCompat", { description: "Foreign resolution dialects the stringifier's plain-scalar fallback can defend against: setting the `quoteCompat` field of `YamlStringifyOptions` to `\"yaml-1.1\"` additionally quotes every plain scalar a YAML 1.1 parser (js-yaml, PyYAML, libyaml, and the `yaml` npm package's YAML 1.1 schema, whose lenient resolvers set the outer bound) would implicitly resolve to a non-string — `yes`/`no`/`on`/`off` booleans, ISO 8601 and space-separated timestamps, sexagesimal `1:30`, underscored `1_000` and base-2/8/16 numbers. Like `QuoteStyle` it is a stringify-option vocabulary, never a property of a composed node." }));

/**
 * The union of all quote-compat dialect string literals.
 *
 * @public
 */
export type QuoteCompat = typeof QuoteCompat.Type;

/**
 * Block-scalar chomping indicators (`-` strip, default clip, `+` keep).
 * Referenced by the {@link YamlScalar} `chomp` field schema.
 *
 * @public
 */
export const ScalarChomp = LiteralKit(["strip", "clip", "keep"]).pipe($I.annoteSchema("ScalarChomp", { description: "Block-scalar chomping indicators (`-` strip, default clip, `+` keep). Referenced by the YamlScalar `chomp` field schema." }));

/**
 * The union of all block-scalar chomping indicator string literals.
 *
 * @public
 */
export type ScalarChomp = typeof ScalarChomp.Type;

/**
 * A YAML scalar AST node, representing a leaf value such as a string,
 * number, boolean, or null.
 *
 * - `value` — the resolved JavaScript value (null, boolean, number, bigint or
 *   string).
 * - `style` — the scalar presentation style in the source document.
 * - `tag` — optional explicit YAML tag (e.g. `!!str`, `!!int`).
 * - `anchor` — optional anchor name for aliasing.
 * - `commentBefore` — own-line comment text directly above the node
 *   (multiple consecutive comment lines join with `\n`).
 * - `comment` — trailing comment text on the node's line (strictly trailing;
 *   own-line comments live on `commentBefore`).
 * - `spaceBefore` — `true` when a blank line precedes the node (and its
 *   `commentBefore` block, when present) in the source.
 * - `chomp` — block-scalar chomping indicator, when the scalar is a block
 *   scalar.
 * - `blockIndent` — the EXPLICIT indentation-indicator digit from a block
 *   scalar's header (`|2`, `>1+`), when the source spelled one; absent when
 *   the header let the reader auto-detect the indent.
 * - `raw` — the raw source text, preserved when it differs from the resolved
 *   value in a way stringification needs to know about.
 * - `sourceMultiline` — `true` when the source span covers two or more lines;
 *   absent on synthetic nodes.
 * - `offset` / `length` — the node's span in the source.
 *
 * @public
 */
export class YamlScalar extends S.TaggedClass<YamlScalar>($I`YamlScalar`)("YamlScalar", {
	value: S.Unknown.annotateKey({ description: "Resolved scalar content used when reconstructing the document's plain JavaScript value" }),
	tag: S.optionalKey(S.String).annotateKey({ description: "Explicit YAML tag attached to the scalar, such as `!!str` or `!!int`" }),
	style: ScalarStyle.annotateKey({ description: "Scalar presentation in YAML: plain, single-quoted, double-quoted, literal block, or folded block" }),
	anchor: S.optionalKey(S.String).annotateKey({ description: "Anchor identifier used by aliases to reference this scalar, without the leading `&`" }),
	commentBefore: S.optionalKey(S.String).annotateKey({ description: "Own-line comment text directly above the scalar, with consecutive comment lines joined by newlines" }),
	comment: S.optionalKey(S.String).annotateKey({ description: "Trailing comment text on the scalar's line, including header-line comments for block scalars" }),
	spaceBefore: S.optionalKey(S.Boolean).annotateKey({ description: "Whether a blank line precedes the scalar and any leading comment block in the source" }),
	chomp: S.optionalKey(ScalarChomp).annotateKey({ description: "Block-scalar trailing newline handling: `strip` removes them, `clip` retains one, and `keep` retains all" }),
	blockIndent: S.optionalKey(S.Finite).annotateKey({ description: "Explicit indentation-indicator digit from the block-scalar header, absent when indentation is automatically detected" }),
	raw: S.optionalKey(S.String).annotateKey({ description: "Original scalar spelling retained when resolution changes its representation, preserving numeric forms such as hexadecimal or trailing zeros" }),
	sourceMultiline: S.optionalKey(S.Boolean).annotateKey({ description: "Whether the scalar's source span contains a line break; absent on synthetic nodes" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the scalar's source span, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Extent of the scalar's source span, measured in UTF-16 code units" }),
}, $I.annote("YamlScalar", { description: "A YAML scalar AST node, representing a leaf value such as a string, number, boolean, or null." })) {
	/**
	 * Navigate to a descendant by path (string segments for mapping keys,
	 * numbers for sequence indices). `Option.none()` when any segment cannot
	 * be resolved. Pure.
	 */
	find(path: YamlPath): O.Option<YamlNode> {
		return findByPath(this, path);
	}

	/**
	 * Find the deepest node whose span contains `offset` (half-open interval),
	 * or `Option.none()` when the offset falls outside this subtree. Pure.
	 */
	findAtOffset(offset: number): O.Option<YamlNode> {
		return findDeepestAtOffset(this, offset);
	}

	/**
	 * Return the path from this node to the given descendant node (matched by
	 * reference identity), or `Option.none()` when it is not in this subtree.
	 * The inverse of {@link YamlScalar.find}. Pure.
	 */
	pathOf(node: YamlNode): O.Option<YamlPath> {
		return pathToNode(this, node);
	}

	/**
	 * Reconstruct the plain JavaScript value of this subtree. Aliases resolve
	 * through `anchors` (anchors encountered during the walk register
	 * incrementally, so an alias sees the most recent definition at its point
	 * of use); unresolvable aliases yield `null`. Pure and total.
	 */
	toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
		return nodeToValue(this, anchors, defaultBudget());
	}
}

/**
 * A YAML alias AST node, referencing a previously defined anchor by name
 * (without the leading `*`).
 *
 * Carries the same comment triple as every other node class — see
 * {@link YamlScalar} for the field semantics. An alias is a node like any
 * other and a comment can legally sit above or after one.
 *
 * @public
 */
export class YamlAlias extends S.TaggedClass<YamlAlias>($I`YamlAlias`)("YamlAlias", {
	name: S.String.annotateKey({ description: "Identifier of the previously defined anchor referenced by this alias, without the leading `*`" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the alias's source span, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Extent of the alias's source span, measured in UTF-16 code units" }),
	commentBefore: S.optionalKey(S.String).annotateKey({ description: "Own-line comment text directly above the alias, with consecutive comment lines joined by newlines" }),
	comment: S.optionalKey(S.String).annotateKey({ description: "Trailing comment text on the alias's line" }),
	spaceBefore: S.optionalKey(S.Boolean).annotateKey({ description: "Whether a blank line precedes the alias and any leading comment block in the source" }),
}, $I.annote("YamlAlias", { description: "A YAML alias AST node, referencing a previously defined anchor by name (without the leading `*`)." })) {
	/** See `YamlScalar.find`. Pure. */
	find(path: YamlPath): O.Option<YamlNode> {
		return findByPath(this, path);
	}

	/** See `YamlScalar.findAtOffset`. Pure. */
	findAtOffset(offset: number): O.Option<YamlNode> {
		return findDeepestAtOffset(this, offset);
	}

	/** See `YamlScalar.pathOf`. Pure. */
	pathOf(node: YamlNode): O.Option<YamlPath> {
		return pathToNode(this, node);
	}

	/** See `YamlScalar.toValue`. Pure and total. */
	toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
		return nodeToValue(this, anchors, defaultBudget());
	}
}

/**
 * The encoded (plain-object) form of a {@link YamlScalar} — the class fields
 * without the instance methods. Named so the recursive {@link (YamlNode:variable)}
 * codec can state its encoded side without a circular type annotation.
 *
 * @public
 */
export interface YamlScalarEncoded extends S.Codec.Encoded<typeof YamlScalar> {}

/**
 * The encoded (plain-object) form of a {@link YamlMap}. See
 * {@link YamlScalarEncoded} for why the encoded forms are named interfaces.
 *
 * @public
 */
export interface YamlMapEncoded extends S.Codec.Encoded<typeof YamlMap> {}

/**
 * The encoded (plain-object) form of a {@link YamlSeq}. See
 * {@link YamlScalarEncoded} for why the encoded forms are named interfaces.
 *
 * @public
 */
export interface YamlSeqEncoded extends S.Codec.Encoded<typeof YamlSeq> {}

/**
 * The encoded (plain-object) form of a {@link YamlAlias}. See
 * {@link YamlScalarEncoded} for why the encoded forms are named interfaces.
 *
 * @public
 */
export interface YamlAliasEncoded extends S.Codec.Encoded<typeof YamlAlias> {}

/**
 * A discriminated-union schema covering all four YAML AST value node types:
 * {@link YamlScalar}, {@link YamlMap}, {@link YamlSeq} and {@link YamlAlias}.
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `YamlNode → YamlMap → YamlPair → YamlNode`.
 *
 * **Gotchas**
 *
 * Construct member nodes via their `.make(...)` static (e.g.
 * `YamlScalar.make(...)`), never `new YamlScalar(...)` — the internal
 * composer's hot-path `new` construction is the one recorded exception, kept
 * internal to the engine for its allocation-sensitive walk.
 *
 * @public
 */
export const YamlNode: S.Codec<
	YamlScalar | YamlMap | YamlSeq | YamlAlias,
	YamlScalarEncoded | YamlMapEncoded | YamlSeqEncoded | YamlAliasEncoded
> = S.suspend(() => S.Union([YamlScalar, YamlMap, YamlSeq, YamlAlias])).pipe(
	$I.annoteSchema("YamlNode", { description: "Recursive union of YAML scalar, mapping, sequence and alias value nodes." }),
);

/**
 * The union of all YAML AST value node types.
 *
 * @public
 */
export type YamlNode = YamlScalar | YamlMap | YamlSeq | YamlAlias;

/**
 * A YAML key-value pair AST node, representing one entry within a mapping.
 * `value` is `null` when absent (e.g. `key:` with no value).
 *
 * A pair carries **no comment fields**. Comments belong to the pair's `key`
 * and `value` nodes, which have one comment slot each: an own-line comment
 * above the entry leads the `key`, and a trailing comment on the entry's line
 * follows the `value`. Two slots rather than one is what lets `a: # kc` keep
 * its comment where the author wrote it instead of relocating it onto the
 * value's line.
 *
 * @public
 */
export class YamlPair extends S.TaggedClass<YamlPair>($I`YamlPair`)("YamlPair", {
	key: S.suspend((): typeof YamlNode => YamlNode).annotateKey({ description: "Node identifying the mapping entry, carrying any own-line comments above that entry" }),
	value: S.NullOr(S.suspend((): typeof YamlNode => YamlNode)).annotateKey({ description: "Node containing the mapping entry's content, or `null` when no value follows the key" }),
}, $I.annote("YamlPair", { description: "A YAML key-value pair AST node, representing one entry within a mapping. `value` is `null` when absent (e.g. `key:` with no value)." })) {}

/**
 * A YAML mapping AST node, representing a collection of {@link YamlPair}
 * entries.
 *
 * - `style` — the presentation style: `"block"` or `"flow"`.
 * - `commentBefore` — own-line comment text directly above the mapping.
 * - `comment` — trailing comment text: own-line comment lines after the
 *   mapping's last entry (still at the mapping's item indent), or a same-line
 *   trailing comment for a flow mapping.
 * - `spaceBefore` — `true` when a blank line precedes the mapping.
 * - `sourceMultiline` — `true` when the source span covers two or more lines;
 *   used by the canonical stringifier. Absent on synthetic nodes.
 *
 * @public
 */
export class YamlMap extends S.TaggedClass<YamlMap>($I`YamlMap`)("YamlMap", {
	items: S.Array(S.suspend((): typeof YamlPair => YamlPair)).annotateKey({ description: "Key-value entries in their stored order within the YAML mapping" }),
	tag: S.optionalKey(S.String).annotateKey({ description: "Explicit YAML tag attached to the mapping and retained when emitting it" }),
	anchor: S.optionalKey(S.String).annotateKey({ description: "Anchor identifier used by aliases to reference this mapping, without the leading `&`" }),
	style: CollectionStyle.annotateKey({ description: "Mapping presentation as indented block entries or a flow collection enclosed in braces" }),
	commentBefore: S.optionalKey(S.String).annotateKey({ description: "Own-line comment text directly above the mapping, with consecutive comment lines joined by newlines" }),
	comment: S.optionalKey(S.String).annotateKey({ description: "Comment text after the last block entry at item indentation, or a same-line trailing comment for a flow mapping" }),
	spaceBefore: S.optionalKey(S.Boolean).annotateKey({ description: "Whether a blank line precedes the mapping and any leading comment block in the source" }),
	sourceMultiline: S.optionalKey(S.Boolean).annotateKey({ description: "Whether the mapping's source span contains a line break; used by the canonical stringifier and absent on synthetic nodes" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the mapping's source span, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Extent of the mapping's source span, measured in UTF-16 code units" }),
}, $I.annote("YamlMap", { description: "A YAML mapping AST node, representing a collection of YamlPair entries." })) {
	/** See `YamlScalar.find`. Pure. */
	find(path: YamlPath): O.Option<YamlNode> {
		return findByPath(this, path);
	}

	/** See `YamlScalar.findAtOffset`. Pure. */
	findAtOffset(offset: number): O.Option<YamlNode> {
		return findDeepestAtOffset(this, offset);
	}

	/** See `YamlScalar.pathOf`. Pure. */
	pathOf(node: YamlNode): O.Option<YamlPath> {
		return pathToNode(this, node);
	}

	/** See `YamlScalar.toValue`. Pure and total. */
	toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
		return nodeToValue(this, anchors, defaultBudget());
	}
}

/**
 * A YAML sequence AST node, representing an ordered list of
 * {@link (YamlNode:type)} values.
 *
 * - `commentBefore` — own-line comment text directly above the sequence.
 * - `comment` — trailing comment text: own-line comment lines after the
 *   sequence's last item (still at the sequence's item indent), or a
 *   same-line trailing comment for a flow sequence.
 * - `spaceBefore` — `true` when a blank line precedes the sequence.
 *
 * @public
 */
export class YamlSeq extends S.TaggedClass<YamlSeq>($I`YamlSeq`)("YamlSeq", {
	items: S.Array(S.suspend((): typeof YamlNode => YamlNode)).annotateKey({ description: "Child nodes in YAML sequence order, addressed by their zero-based positions" }),
	tag: S.optionalKey(S.String).annotateKey({ description: "Explicit YAML tag attached to the sequence and retained when emitting it" }),
	anchor: S.optionalKey(S.String).annotateKey({ description: "Anchor identifier used by aliases to reference this sequence, without the leading `&`" }),
	style: CollectionStyle.annotateKey({ description: "Sequence presentation as dash-prefixed block items or a flow collection enclosed in brackets" }),
	commentBefore: S.optionalKey(S.String).annotateKey({ description: "Own-line comment text directly above the sequence, with consecutive comment lines joined by newlines" }),
	comment: S.optionalKey(S.String).annotateKey({ description: "Comment text after the last block item at item indentation, or a same-line trailing comment for a flow sequence" }),
	spaceBefore: S.optionalKey(S.Boolean).annotateKey({ description: "Whether a blank line precedes the sequence and any leading comment block in the source" }),
	sourceMultiline: S.optionalKey(S.Boolean).annotateKey({ description: "Whether the sequence's source span contains a line break; used by the canonical stringifier and absent on synthetic nodes" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the sequence's source span, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Extent of the sequence's source span, measured in UTF-16 code units" }),
}, $I.annote("YamlSeq", { description: "A YAML sequence AST node, representing an ordered list of (YamlNode:type) values." })) {
	/** See `YamlScalar.find`. Pure. */
	find(path: YamlPath): O.Option<YamlNode> {
		return findByPath(this, path);
	}

	/** See `YamlScalar.findAtOffset`. Pure. */
	findAtOffset(offset: number): O.Option<YamlNode> {
		return findDeepestAtOffset(this, offset);
	}

	/** See `YamlScalar.pathOf`. Pure. */
	pathOf(node: YamlNode): O.Option<YamlPath> {
		return pathToNode(this, node);
	}

	/** See `YamlScalar.toValue`. Pure and total. */
	toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
		return nodeToValue(this, anchors, defaultBudget());
	}
}

const isScalar = S.is(YamlScalar);
const isMap = S.is(YamlMap);
const isSeq = S.is(YamlSeq);
const isAlias = S.is(YamlAlias);

// ── Shared method implementations ───────────────────────────────────────────
// Module-level so the four union classes share one body each. Declared after
// the classes; function declarations hoist.

function findByPath(root: YamlNode, path: YamlPath): O.Option<YamlNode> {
	let current: YamlNode | null = root;

	for (const segment of path) {
		if (current === null) {
			return O.none();
		}

		if (P.isString(segment)) {
			// Navigate by key — requires a YamlMap
			if (!isMap(current)) {
				return O.none();
			}
			const pair: YamlPair | undefined = current.items.find(
				(p: YamlPair) => isScalar(p.key) && P.isString(p.key.value) && p.key.value === segment,
			);
			if (pair === undefined || pair.value === null) {
				return O.none();
			}
			current = pair.value;
		} else {
			// Navigate by index — requires a YamlSeq
			if (!isSeq(current)) {
				return O.none();
			}
			const item: YamlNode | undefined = current.items[segment];
			if (item === undefined) {
				return O.none();
			}
			current = item;
		}
	}

	return current === null ? O.none() : O.some(current);
}

/**
 * Half-open interval test `[offset, offset + length)` so a cursor positioned
 * immediately after a node is NOT considered inside it.
 */
function containsOffset(node: YamlNode, offset: number): boolean {
	return offset >= node.offset && offset < node.offset + node.length;
}

function findDeepestAtOffset(node: YamlNode, offset: number): O.Option<YamlNode> {
	if (!containsOffset(node, offset)) {
		return O.none();
	}

	if (isMap(node)) {
		for (const pair of node.items) {
			const keyResult = findDeepestAtOffset(pair.key, offset);
			if (O.isSome(keyResult)) return keyResult;
			if (pair.value !== null) {
				const valResult = findDeepestAtOffset(pair.value, offset);
				if (O.isSome(valResult)) return valResult;
			}
		}
	}

	if (isSeq(node)) {
		for (const item of node.items) {
			const itemResult = findDeepestAtOffset(item, offset);
			if (O.isSome(itemResult)) return itemResult;
		}
	}

	// This node contains the offset but no child does — this is the deepest
	return O.some(node);
}

function pathToNode(root: YamlNode, target: YamlNode): O.Option<YamlPath> {
	const path: Array<string | number> = [];
	return descendToNode(root, target, path) ? O.some(path) : O.none();
}

/**
 * Depth-first identity search accumulating mapping-key/sequence-index
 * segments. Only scalar string keys produce navigable segments (matching
 * `find`); descendants reachable only through complex keys are not
 * addressable by path.
 */
function descendToNode(node: YamlNode, target: YamlNode, path: Array<string | number>): boolean {
	if (node === target) {
		return true;
	}

	if (isMap(node)) {
		for (const pair of node.items) {
			if (isScalar(pair.key) && P.isString(pair.key.value)) {
				if (pair.key === target) {
					path.push(pair.key.value);
					return true;
				}
				if (pair.value !== null) {
					path.push(pair.key.value);
					if (descendToNode(pair.value, target, path)) {
						return true;
					}
					path.pop();
				}
			}
		}
	}

	if (isSeq(node)) {
		for (const [i, item] of node.items.entries()) {
			path.push(i);
			if (descendToNode(item, target, path)) {
				return true;
			}
			path.pop();
		}
	}

	return false;
}

/** Set a mapping key as an own data property — `__proto__` included. */
function setOwnProperty(obj: Record<string, unknown>, key: string, value: unknown): void {
	if (key === "__proto__") {
		// Own data property, not a prototype mutation — matches JSON.parse
		// semantics and the jsonc precedent.
		Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
	} else {
		obj[key] = value;
	}
}

/**
 * Thrown by the value-extraction walk when alias expansion materializes more
 * output nodes than the budget allows — the YAML "billion laughs" guard. A
 * chain of aliases each referencing the previous (`a2: [*a1×10]`, `a3:
 * [*a2×10]`, …) multiplies output size exponentially while the alias-*token*
 * count stays small, so the composer's per-token `maxAliasCount` limit does
 * not catch it; only bounding the expanded node count does.
 *
 * Not re-exported from the package entry point (`index.ts`) — the facade
 * catches it and materializes a fatal `AliasCountExceeded` `YamlParseError`
 * (or, for `Yaml.equals`, treats the input as malformed).
 */
export class AliasExpansionBudgetExceeded extends S.TaggedError<AliasExpansionBudgetExceeded>($I`AliasExpansionBudgetExceeded`)("AliasExpansionBudgetExceeded", {
	message: S.String.annotateKey({ description: "Alias expansion budget failure message, including the output-node limit." }),
}, $I.annote("AliasExpansionBudgetExceeded", { description: "Value extraction exceeded its alias-expanded output-node budget." })) {
	override readonly name = "AliasExpansionBudgetExceeded";
}

/**
 * Multiplier converting a `maxAliasCount` budget into a cap on the number of
 * output nodes materialized *through alias expansion*. Deliberately generous:
 * alias-free content never ticks the counter (see {@link nodeToValue}), so a
 * large but benign document — or a single alias referencing a large alias-free
 * block — stays far under the cap, while an exponential alias chain accumulates
 * across the shared budget and trips it long before the heap is exhausted.
 */
const ALIAS_EXPANSION_FACTOR = 10_000;

/** The output-node cap for a given `maxAliasCount`. */
export function aliasExpansionLimit(maxAliasCount: number): number {
	return (maxAliasCount + 1) * ALIAS_EXPANSION_FACTOR;
}

/** Default cap for a direct `toValue()` call, matching the default `maxAliasCount` of 100. */
const DEFAULT_ALIAS_EXPANSION_LIMIT = aliasExpansionLimit(100);

/** Mutable counter carried through one value-extraction walk. */
interface ExpansionBudget {
	count: number;
	readonly limit: number;
}

/** A fresh default budget for a direct `toValue()` call. */
function defaultBudget(): ExpansionBudget {
	return { count: 0, limit: DEFAULT_ALIAS_EXPANSION_LIMIT };
}

/**
 * Value extraction with an explicit alias-expansion budget derived from
 * `maxAliasCount`. The facade drives this so a `maxAliasCount` from parse
 * options bounds the "billion laughs" expansion; throws
 * {@link AliasExpansionBudgetExceeded} when the cap is exceeded. Not
 * re-exported from the package entry point.
 */
export const nodeToJsValue: {
	(node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): unknown;
	(anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): (node: YamlNode | null) => unknown;
} = dual(3, (node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): unknown =>
	nodeToValue(node, anchors, { count: 0, limit: aliasExpansionLimit(maxAliasCount) }),
);

function nodeToValue(
	node: YamlNode | null,
	anchors?: MutableHashMap.MutableHashMap<string, YamlNode>,
	budget?: ExpansionBudget,
	counting = false,
): unknown {
	if (node === null) return null;
	// Count only nodes materialized *through* an alias expansion (counting=true).
	// Alias-free content never ticks the counter, so large but benign documents
	// are not falsely rejected; an exponential alias chain accumulates across the
	// shared budget and trips the cap before the heap is exhausted.
	if (counting && budget !== undefined) {
		budget.count++;
		if (budget.count > budget.limit) {
			throw AliasExpansionBudgetExceeded.make({ message: `Alias expansion exceeded budget of ${budget.limit} nodes` });
		}
	}
	// Register this node's anchor incrementally so aliases resolve to the most
	// recent anchor at the point of reference (not the last definition in the
	// entire document).
	if (anchors !== undefined && !isAlias(node) && node.anchor !== undefined) {
		MutableHashMap.set(anchors, node.anchor, node);
	}
	if (isScalar(node)) return node.value;
	if (isMap(node)) {
		const result: Record<string, unknown> = {};
		for (const pair of node.items) {
			let key: string;
			if (isScalar(pair.key)) {
				// Register key anchor before resolving value
				if (anchors !== undefined && pair.key.anchor !== undefined) {
					MutableHashMap.set(anchors, pair.key.anchor, pair.key);
				}
				key = String(pair.key.value ?? "");
			} else if (isAlias(pair.key)) {
				const resolved = anchors === undefined ? undefined : O.getOrUndefined(MutableHashMap.get(anchors, pair.key.name));
				// Resolving an alias key enters alias expansion → count its subtree.
				key = resolved !== undefined ? String(nodeToValue(resolved, anchors, budget, true) ?? "") : "";
			} else {
				key = "";
			}
			setOwnProperty(result, key, nodeToValue(pair.value, anchors, budget, counting));
		}
		return result;
	}
	if (isSeq(node)) return node.items.map((item) => nodeToValue(item, anchors, budget, counting));
	if (isAlias(node)) {
		const resolved = anchors === undefined ? undefined : O.getOrUndefined(MutableHashMap.get(anchors, node.name));
		// Resolving an alias enters alias expansion → count the resolved subtree.
		return resolved !== undefined ? nodeToValue(resolved, anchors, budget, true) : null;
	}
	return null;
}

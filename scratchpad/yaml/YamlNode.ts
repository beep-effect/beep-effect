/**
 * Mutually recursive YAML AST nodes: scalar, map, seq, pair, alias and the
 * {@link YamlNode} union.
 *
 * Nodes deliberately carry no parent pointers (circular references would
 * break structural equality, serialization and Schema encode/decode). Child
 * relationships are expressed via `items`/`key`/`value`, and the recursive
 * types are handled with `S.suspend`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { MutableHashMap } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { YamlPath } from "./YamlEdit.ts";

const $I = $ScratchpadId.create("yaml/YamlNode");

/**
 * YAML scalar presentation styles stored on composed {@link YamlScalar} nodes.
 *
 * **Example** (Decode a scalar style)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScalarStyle } from "@beep/scratchpad/yaml"
 *
 * console.log(S.decodeUnknownSync(ScalarStyle)("plain")) // "plain"
 * console.log(S.is(ScalarStyle)("double-quoted")) // true
 * ```
 *
 * @see {@link QuoteStyle} for the stringify-option fallback, which is not a node field.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ScalarStyle = S.Literals([
  "plain",
  "single-quoted",
  "double-quoted",
  "block-literal",
  "block-folded",
]).pipe(
  $I.annoteSchema("ScalarStyle", {
    description: "YAML scalar presentation styles stored on composed scalar nodes.",
  }),
);

/**
 * Decoded literal union produced by {@link ScalarStyle}.
 *
 * @see {@link ScalarStyle} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ScalarStyle = typeof ScalarStyle.Type;

/**
 * YAML collection presentation styles stored on composed maps and sequences.
 *
 * **Example** (Match a collection style)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CollectionStyle } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(CollectionStyle)("block")) // true
 * console.log(S.is(CollectionStyle)("flow")) // true
 * ```
 *
 * @see {@link YamlMap} for a mapping node that carries this style.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CollectionStyle = S.Literals(["block", "flow"]).pipe(
  $I.annoteSchema("CollectionStyle", {
    description: "YAML collection presentation styles stored on composed maps and sequences.",
  }),
);

/**
 * Decoded literal union produced by {@link CollectionStyle}.
 *
 * @see {@link CollectionStyle} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CollectionStyle = typeof CollectionStyle.Type;

/**
 * Quote characters available to the stringifier's plain-scalar fallback: the
 * style a `plain`-styled scalar is rendered in when it turns out to require
 * quoting. Referenced by the `quoteStyle` field of `YamlStringifyOptions`;
 * unlike `ScalarStyle` it is a stringify-option vocabulary, never a property
 * of a composed node.
 *
 * **Gotchas**
 *
 * {@link QuoteStyle} is not a {@link YamlScalar} field. Set it on
 * {@link YamlStringifyOptions}, never on a node.
 *
 * **Example** (Match a fallback quote style)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { QuoteStyle } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(QuoteStyle)("single")) // true
 * console.log(S.is(QuoteStyle)("plain")) // false
 * ```
 *
 * @see {@link ScalarStyle} for the node-field presentation vocabulary this option is not.
 * @see {@link YamlStringifyOptions} for the stringify options that consume this fallback.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const QuoteStyle = S.Literals(["single", "double"]).pipe(
  $I.annoteSchema("QuoteStyle", {
    description: "Quote characters used when a plain-styled scalar requires quoting during stringify.",
  }),
);

/**
 * Decoded literal union produced by {@link QuoteStyle}.
 *
 * @see {@link QuoteStyle} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Match the YAML 1.1 compat dialect)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { QuoteCompat } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(QuoteCompat)("yaml-1.1")) // true
 * ```
 *
 * @see {@link QuoteStyle} for the quote-character fallback used with this dialect.
 * @see {@link YamlStringifyOptions} for the stringify options that consume `quoteCompat`.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const QuoteCompat = S.Literals(["yaml-1.1"]).pipe(
  $I.annoteSchema("QuoteCompat", {
    description: "Foreign resolution dialects the stringifier can defend against when quoting plain scalars.",
  }),
);

/**
 * Decoded literal union produced by {@link QuoteCompat}.
 *
 * @see {@link QuoteCompat} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type QuoteCompat = typeof QuoteCompat.Type;

/**
 * Block-scalar chomping indicators (`-` strip, default clip, `+` keep).
 * Referenced by the {@link YamlScalar} `chomp` field schema.
 *
 * **Example** (Match a chomping indicator)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScalarChomp } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(ScalarChomp)("strip")) // true
 * console.log(S.is(ScalarChomp)("keep")) // true
 * ```
 *
 * @see {@link YamlScalar} for the node that stores this indicator on block scalars.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ScalarChomp = S.Literals(["strip", "clip", "keep"]).pipe(
  $I.annoteSchema("ScalarChomp", {
    description: "Block-scalar chomping indicators stored on composed scalar nodes.",
  }),
);

/**
 * Decoded literal union produced by {@link ScalarChomp}.
 *
 * @see {@link ScalarChomp} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
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
 * **Gotchas**
 *
 * Construct via {@link YamlScalar.make}, never `new` (the engine hot path is
 * the recorded exception). Nodes have no parent pointers. Unresolvable aliases
 * yield `null` from `toValue`. `pathOf` is reference identity; `find` only
 * string scalar keys.
 *
 * **Example** (Make a scalar and read its value)
 *
 * ```ts
 * import { YamlScalar } from "@beep/scratchpad/yaml"
 *
 * const scalar = YamlScalar.make({
 *   value: "Alice",
 *   style: "plain",
 *   offset: 0,
 *   length: 5,
 * })
 *
 * console.log(scalar.toValue()) // "Alice"
 * console.log(scalar.style) // "plain"
 * ```
 *
 * @see {@link YamlNode} for the union that includes this node.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlScalar extends S.TaggedClass<YamlScalar>()(
  "YamlScalar",
  {
    value: S.Unknown,
    tag: S.optionalKey(S.String),
    style: ScalarStyle,
    anchor: S.optionalKey(S.String),
    commentBefore: S.optionalKey(S.String),
    comment: S.optionalKey(S.String),
    spaceBefore: S.optionalKey(S.Boolean),
    chomp: S.optionalKey(ScalarChomp),
    blockIndent: S.optionalKey(S.Finite),
    raw: S.optionalKey(S.String),
    sourceMultiline: S.optionalKey(S.Boolean),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("YamlScalar", {
    description: "A YAML scalar AST node representing a leaf value such as a string, number, boolean, or null.",
  }),
) {
  /**
   * Navigate to a descendant by path (string segments for mapping keys,
   * numbers for sequence indices). `O.none()` when any segment cannot
   * be resolved. Pure.
   *
   * **Example** (Find the scalar itself)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlScalar } from "@beep/scratchpad/yaml"
   *
   * const scalar = YamlScalar.make({ value: "x", style: "plain", offset: 0, length: 1 })
   * console.log(O.isSome(scalar.find([]))) // true
   * ```
   */
  find(path: YamlPath): O.Option<YamlNode> {
    return findByPath(this, path);
  }

  /**
   * Find the deepest node whose span contains `offset` (half-open interval),
   * or `O.none()` when the offset falls outside this subtree. Pure.
   *
   * **Example** (Find a scalar by source offset)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlScalar } from "@beep/scratchpad/yaml"
   *
   * const scalar = YamlScalar.make({ value: "x", style: "plain", offset: 4, length: 1 })
   * console.log(O.isSome(scalar.findAtOffset(4))) // true
   * ```
   */
  findAtOffset(offset: number): O.Option<YamlNode> {
    return findDeepestAtOffset(this, offset);
  }

  /**
   * Return the path from this node to the given descendant node (matched by
   * reference identity), or `O.none()` when it is not in this subtree.
   * The inverse of {@link YamlScalar.find}. Pure.
   *
   * **Example** (Find the scalar's empty self path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlScalar } from "@beep/scratchpad/yaml"
   *
   * const scalar = YamlScalar.make({ value: "x", style: "plain", offset: 0, length: 1 })
   * console.log(O.isSome(scalar.pathOf(scalar))) // true
   * ```
   */
  pathOf(node: YamlNode): O.Option<YamlPath> {
    return pathToNode(this, node);
  }

  /**
   * Reconstruct the plain JavaScript value of this subtree. Aliases resolve
   * through `anchors` (anchors encountered during the walk register
   * incrementally, so an alias sees the most recent definition at its point
   * of use); unresolvable aliases yield `null`. Pure and total.
   *
   * **Example** (Read a scalar value)
   *
   * ```ts
   * import { YamlScalar } from "@beep/scratchpad/yaml"
   *
   * const scalar = YamlScalar.make({ value: "x", style: "plain", offset: 0, length: 1 })
   * console.log(scalar.toValue()) // "x"
   * ```
   */
  toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
    return nodeToValue(this, anchors, defaultBudget());
  }

  static readonly is = S.is(YamlScalar);
}

/**
 * A YAML alias AST node, referencing a previously defined anchor by name
 * (without the leading `*`).
 *
 * Carries the same comment triple as every other node class — see
 * {@link YamlScalar} for the field semantics. An alias is a node like any
 * other and a comment can legally sit above or after one.
 *
 * **Example** (Make an unresolved alias)
 *
 * ```ts
 * import { YamlAlias } from "@beep/scratchpad/yaml"
 *
 * const alias = YamlAlias.make({ name: "item", offset: 0, length: 5 })
 *
 * console.log(alias.name) // "item"
 * console.log(alias.toValue()) // null
 * ```
 *
 * @see {@link YamlScalar} for the comment-field semantics shared by every node class.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlAlias extends S.TaggedClass<YamlAlias>()(
  "YamlAlias",
  {
    name: S.String,
    offset: S.Finite,
    length: S.Finite,
    commentBefore: S.optionalKey(S.String),
    comment: S.optionalKey(S.String),
    spaceBefore: S.optionalKey(S.Boolean),
  },
  $I.annote("YamlAlias", {
    description: "A YAML alias AST node referencing a previously defined anchor by name.",
  }),
) {
  /**
   * See `YamlScalar.find`. Pure.
   *
   * **Example** (Find the alias itself)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlAlias } from "@beep/scratchpad/yaml"
   *
   * const alias = YamlAlias.make({ name: "item", offset: 0, length: 5 })
   * console.log(O.isSome(alias.find([]))) // true
   * ```
   */
  find(path: YamlPath): O.Option<YamlNode> {
    return findByPath(this, path);
  }

  /**
   * See `YamlScalar.findAtOffset`. Pure.
   *
   * **Example** (Find an alias by source offset)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlAlias } from "@beep/scratchpad/yaml"
   *
   * const alias = YamlAlias.make({ name: "item", offset: 2, length: 5 })
   * console.log(O.isSome(alias.findAtOffset(2))) // true
   * ```
   */
  findAtOffset(offset: number): O.Option<YamlNode> {
    return findDeepestAtOffset(this, offset);
  }

  /**
   * See `YamlScalar.pathOf`. Pure.
   *
   * **Example** (Find the alias's empty self path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlAlias } from "@beep/scratchpad/yaml"
   *
   * const alias = YamlAlias.make({ name: "item", offset: 0, length: 5 })
   * console.log(O.isSome(alias.pathOf(alias))) // true
   * ```
   */
  pathOf(node: YamlNode): O.Option<YamlPath> {
    return pathToNode(this, node);
  }

  /**
   * See `YamlScalar.toValue`. Pure and total.
   *
   * **Example** (Read an unresolved alias)
   *
   * ```ts
   * import { YamlAlias } from "@beep/scratchpad/yaml"
   *
   * const alias = YamlAlias.make({ name: "missing", offset: 0, length: 8 })
   * console.log(alias.toValue()) // null
   * ```
   */
  toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
    return nodeToValue(this, anchors, defaultBudget());
  }

  static readonly is = S.is(YamlAlias);
}

/**
 * The encoded (plain-object) form of a {@link YamlScalar} — the class fields
 * without the instance methods. Named so the recursive {@link (YamlNode:variable)}
 * codec can state its encoded side without a circular type annotation.
 *
 * **Details**
 *
 * This interface is genuinely type-level machinery: it extends the encoded
 * side derived directly from the schema class and exists only to break the
 * recursive `YamlNode` codec annotation. It does not define independent data.
 *
 * @see {@link YamlScalar} for the runtime class this encoded form corresponds to.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface YamlScalarEncoded extends S.Codec.Encoded<typeof YamlScalar> {
}

/**
 * The encoded (plain-object) form of a {@link YamlMap}. See
 * {@link YamlScalarEncoded} for why the encoded forms are named interfaces.
 *
 * **Details**
 *
 * This is the schema-derived encoded side of `YamlMap`, named only so the
 * recursive union codec can reference it; it owns no shape independently.
 *
 * @see {@link YamlMap} for the runtime class this encoded form corresponds to.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface YamlMapEncoded extends S.Codec.Encoded<typeof YamlMap> {
}

/**
 * The encoded (plain-object) form of a {@link YamlSeq}. See
 * {@link YamlScalarEncoded} for why the encoded forms are named interfaces.
 *
 * **Details**
 *
 * This is the schema-derived encoded side of `YamlSeq`, named only so the
 * recursive union codec can reference it; it owns no shape independently.
 *
 * @see {@link YamlSeq} for the runtime class this encoded form corresponds to.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface YamlSeqEncoded extends S.Codec.Encoded<typeof YamlSeq> {
}

/**
 * The encoded (plain-object) form of a {@link YamlAlias}. See
 * {@link YamlScalarEncoded} for why the encoded forms are named interfaces.
 *
 * **Details**
 *
 * This is the schema-derived encoded side of `YamlAlias`, named only so the
 * recursive union codec can reference it; it owns no shape independently.
 *
 * @see {@link YamlAlias} for the runtime class this encoded form corresponds to.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface YamlAliasEncoded extends S.Codec.Encoded<typeof YamlAlias> {
}

/**
 * A discriminated-union schema covering all four YAML AST value node types:
 * {@link YamlScalar}, {@link YamlMap}, {@link YamlSeq} and {@link YamlAlias}.
 * Defined lazily via `S.suspend` to break the recursive reference chain
 * `YamlNode → YamlMap → YamlPair → YamlNode`.
 *
 * **Gotchas**
 *
 * Construct member nodes via their `.make(...)` static (e.g.
 * `YamlScalar.make(...)`), never `new YamlScalar(...)` — the internal
 * composer's hot-path `new` construction is the one recorded exception, kept
 * internal to the engine for its allocation-sensitive walk. Nodes have no
 * parent pointers. `toValue` resolves aliases incrementally; unresolvable
 * aliases yield `null`. `pathOf` is reference identity; `find` only string
 * scalar keys. `__proto__` keys become own data properties.
 *
 * **Example** (Guard a made scalar as a YamlNode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlNode, YamlScalar } from "@beep/scratchpad/yaml"
 *
 * const scalar = YamlScalar.make({ value: 1, style: "plain", offset: 0, length: 1 })
 * console.log(S.is(YamlNode)(scalar)) // true
 * console.log(scalar.toValue()) // 1
 * ```
 *
 * @see {@link YamlScalar.make} for the constructor to use on synthetic scalars.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlNode: S.Codec<
  YamlScalar | YamlMap | YamlSeq | YamlAlias,
  YamlScalarEncoded | YamlMapEncoded | YamlSeqEncoded | YamlAliasEncoded
> = S.suspend(() => S.Union([YamlScalar, YamlMap, YamlSeq, YamlAlias])).pipe(
  $I.annoteSchema("YamlNode", {
    description: "Discriminated union of YAML AST value nodes: scalar, map, seq and alias.",
  }),
);

/**
 * The union of all YAML AST value node types.
 *
 * @see {@link (YamlNode:variable)} for the runtime schema that decodes this union.
 * @public
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Make a mapping pair)
 *
 * ```ts
 * import { YamlPair, YamlScalar } from "@beep/scratchpad/yaml"
 *
 * const pair = YamlPair.make({
 *   key: YamlScalar.make({ value: "name", style: "plain", offset: 0, length: 4 }),
 *   value: YamlScalar.make({ value: "Alice", style: "plain", offset: 6, length: 5 }),
 * })
 *
 * console.log(YamlScalar.is(pair.key) && pair.key.value) // "name"
 * ```
 *
 * @see {@link YamlMap} for the mapping that stores these pairs in `items`.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlPair extends S.TaggedClass<YamlPair>()(
  "YamlPair",
  {
    key: S.suspend((): typeof YamlNode => YamlNode),
    value: S.NullOr(S.suspend((): typeof YamlNode => YamlNode)),
  },
  $I.annote("YamlPair", {
    description: "A YAML key-value pair AST node representing one mapping entry.",
  }),
) {
}

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
 * **Example** (Make a mapping and resolve a key)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { YamlMap, YamlPair, YamlScalar } from "@beep/scratchpad/yaml"
 *
 * const map = YamlMap.make({
 *   items: [
 *     YamlPair.make({
 *       key: YamlScalar.make({ value: "name", style: "plain", offset: 0, length: 4 }),
 *       value: YamlScalar.make({ value: "Alice", style: "plain", offset: 6, length: 5 }),
 *     }),
 *   ],
 *   style: "block",
 *   offset: 0,
 *   length: 12,
 * })
 *
 * console.log(map.toValue()) // { name: "Alice" }
 * console.log(O.isSome(map.find(["name"]))) // true
 * ```
 *
 * @see {@link YamlPair} for the entries stored in `items`.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlMap extends S.TaggedClass<YamlMap>()(
  "YamlMap",
  {
    items: S.Array(S.suspend((): typeof YamlPair => YamlPair)),
    tag: S.optionalKey(S.String),
    anchor: S.optionalKey(S.String),
    style: CollectionStyle,
    commentBefore: S.optionalKey(S.String),
    comment: S.optionalKey(S.String),
    spaceBefore: S.optionalKey(S.Boolean),
    sourceMultiline: S.optionalKey(S.Boolean),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("YamlMap", {
    description: "A YAML mapping AST node representing a collection of key-value pairs.",
  }),
) {
  /**
   * See `YamlScalar.find`. Pure.
   *
   * **Example** (Find an empty mapping by its root path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlMap } from "@beep/scratchpad/yaml"
   *
   * const map = YamlMap.make({ items: [], style: "block", offset: 0, length: 2 })
   * console.log(O.isSome(map.find([]))) // true
   * ```
   */
  find(path: YamlPath): O.Option<YamlNode> {
    return findByPath(this, path);
  }

  /**
   * See `YamlScalar.findAtOffset`. Pure.
   *
   * **Example** (Find a mapping by source offset)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlMap } from "@beep/scratchpad/yaml"
   *
   * const map = YamlMap.make({ items: [], style: "flow", offset: 4, length: 2 })
   * console.log(O.isSome(map.findAtOffset(4))) // true
   * ```
   */
  findAtOffset(offset: number): O.Option<YamlNode> {
    return findDeepestAtOffset(this, offset);
  }

  /**
   * See `YamlScalar.pathOf`. Pure.
   *
   * **Example** (Find the mapping's empty self path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlMap } from "@beep/scratchpad/yaml"
   *
   * const map = YamlMap.make({ items: [], style: "block", offset: 0, length: 2 })
   * console.log(O.isSome(map.pathOf(map))) // true
   * ```
   */
  pathOf(node: YamlNode): O.Option<YamlPath> {
    return pathToNode(this, node);
  }

  /**
   * See `YamlScalar.toValue`. Pure and total.
   *
   * **Example** (Read an empty mapping)
   *
   * ```ts
   * import { YamlMap } from "@beep/scratchpad/yaml"
   *
   * const map = YamlMap.make({ items: [], style: "block", offset: 0, length: 2 })
   * console.log(map.toValue()) // {}
   * ```
   */
  toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
    return nodeToValue(this, anchors, defaultBudget());
  }

  static readonly is = S.is(YamlMap);
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
 * **Example** (Make a sequence and read its value)
 *
 * ```ts
 * import { YamlScalar, YamlSeq } from "@beep/scratchpad/yaml"
 *
 * const seq = YamlSeq.make({
 *   items: [YamlScalar.make({ value: "a", style: "plain", offset: 2, length: 1 })],
 *   style: "block",
 *   offset: 0,
 *   length: 3,
 * })
 *
 * console.log(seq.toValue()) // ["a"]
 * ```
 *
 * @see {@link YamlNode} for the item union stored in `items`.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlSeq extends S.TaggedClass<YamlSeq>()(
  "YamlSeq",
  {
    items: S.Array(S.suspend((): typeof YamlNode => YamlNode)),
    tag: S.optionalKey(S.String),
    anchor: S.optionalKey(S.String),
    style: CollectionStyle,
    commentBefore: S.optionalKey(S.String),
    comment: S.optionalKey(S.String),
    spaceBefore: S.optionalKey(S.Boolean),
    sourceMultiline: S.optionalKey(S.Boolean),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("YamlSeq", {
    description: "A YAML sequence AST node representing an ordered list of nodes.",
  }),
) {
  /**
   * See `YamlScalar.find`. Pure.
   *
   * **Example** (Find an empty sequence by its root path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlSeq } from "@beep/scratchpad/yaml"
   *
   * const sequence = YamlSeq.make({ items: [], style: "block", offset: 0, length: 2 })
   * console.log(O.isSome(sequence.find([]))) // true
   * ```
   */
  find(path: YamlPath): O.Option<YamlNode> {
    return findByPath(this, path);
  }

  /**
   * See `YamlScalar.findAtOffset`. Pure.
   *
   * **Example** (Find a sequence by source offset)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlSeq } from "@beep/scratchpad/yaml"
   *
   * const sequence = YamlSeq.make({ items: [], style: "flow", offset: 4, length: 2 })
   * console.log(O.isSome(sequence.findAtOffset(4))) // true
   * ```
   */
  findAtOffset(offset: number): O.Option<YamlNode> {
    return findDeepestAtOffset(this, offset);
  }

  /**
   * See `YamlScalar.pathOf`. Pure.
   *
   * **Example** (Find the sequence's empty self path)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import { YamlSeq } from "@beep/scratchpad/yaml"
   *
   * const sequence = YamlSeq.make({ items: [], style: "block", offset: 0, length: 2 })
   * console.log(O.isSome(sequence.pathOf(sequence))) // true
   * ```
   */
  pathOf(node: YamlNode): O.Option<YamlPath> {
    return pathToNode(this, node);
  }

  /**
   * See `YamlScalar.toValue`. Pure and total.
   *
   * **Example** (Read an empty sequence)
   *
   * ```ts
   * import { YamlSeq } from "@beep/scratchpad/yaml"
   *
   * const sequence = YamlSeq.make({ items: [], style: "block", offset: 0, length: 2 })
   * console.log(sequence.toValue()) // []
   * ```
   */
  toValue(anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
    return nodeToValue(this, anchors, defaultBudget());
  }

  static readonly is = S.is(YamlSeq);
}

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
      if (!YamlMap.is(current)) {
        return O.none();
      }
      const pair: YamlPair | undefined = current.items.find(
        (p: YamlPair) => YamlScalar.is(p.key) && P.isString(p.key.value) && p.key.value === segment,
      );
      if (P.isUndefined(pair) || pair.value === null) {
        return O.none();
      }
      current = pair.value;
    } else {
      // Navigate by index — requires a YamlSeq
      if (!YamlSeq.is(current)) {
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

  if (YamlMap.is(node)) {
    for (const pair of node.items) {
      const keyResult = findDeepestAtOffset(pair.key, offset);
      if (O.isSome(keyResult)) return keyResult;
      if (pair.value !== null) {
        const valResult = findDeepestAtOffset(pair.value, offset);
        if (O.isSome(valResult)) return valResult;
      }
    }
  }

  if (YamlSeq.is(node)) {
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

  if (YamlMap.is(node)) {
    for (const pair of node.items) {
      if (YamlScalar.is(pair.key) && P.isString(pair.key.value)) {
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

  if (YamlSeq.is(node)) {
    for (let i = 0; i < node.items.length; i++) {
      const item = node.items[i] as YamlNode;
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
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
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
 *
 * **Gotchas**
 *
 * Callers catching {@link Yaml.parse} errors will never see this class — the
 * facade maps it to `AliasCountExceeded` on {@link YamlParseError}.
 *
 * **Example** (Public parse maps the budget blow-up to AliasCountExceeded)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlParseOptions } from "@beep/scratchpad/yaml"
 *
 * const parsed = Yaml.parseResult(
 *   "a: &id 1\nb: *id\n",
 *   YamlParseOptions.make({ maxAliasCount: 0 }),
 * )
 * console.log(Result.isFailure(parsed)) // true
 * if (Result.isFailure(parsed)) {
 *   console.log(parsed.failure.diagnostics[0]?.code) // "AliasCountExceeded"
 * }
 * ```
 *
 * @see {@link YamlParseError} for the facade error that materializes `AliasCountExceeded`.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class AliasExpansionBudgetExceeded extends S.TaggedError<AliasExpansionBudgetExceeded>($I`AliasExpansionBudgetExceeded`)(
  "AliasExpansionBudgetExceeded",
  {
    limit: S.Finite,
  },
  $I.annote("AliasExpansionBudgetExceeded", {
    description: ""
  })
) {
  static readonly is = S.is(AliasExpansionBudgetExceeded);

  override get message() {
    return `Alias expansion exceeded budget of ${this.limit} nodes`;
  }
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

/**
 * Convert a `maxAliasCount` parse budget into the output-node cap used while
 * expanding aliases.
 *
 * Alias-free content never ticks the counter, so a large but benign document
 * stays far under the cap; an exponential alias chain accumulates across the
 * shared budget and trips it long before the heap is exhausted.
 *
 * **Example** (Parse with a tight alias budget still succeeds for alias-free YAML)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml, YamlParseOptions } from "@beep/scratchpad/yaml"
 *
 * const parsed = Yaml.parseResult("a: 1", YamlParseOptions.make({ maxAliasCount: 1 }))
 * console.log(Result.isSuccess(parsed)) // true
 * ```
 *
 * @see {@link nodeToJsValue} for the walk that enforces this cap.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
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
  return {count: 0, limit: DEFAULT_ALIAS_EXPANSION_LIMIT};
}

/**
 * Value extraction with an explicit alias-expansion budget derived from
 * `maxAliasCount`. The facade drives this so a `maxAliasCount` from parse
 * options bounds the "billion laughs" expansion; throws
 * {@link AliasExpansionBudgetExceeded} when the cap is exceeded. Not
 * re-exported from the package entry point.
 *
 * **Example** (Resolve an alias through the value-level parse)
 *
 * ```ts
 * import { Result } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * const parsed = Yaml.parseResult("a: &x 1\nb: *x\n")
 * console.log(Result.isSuccess(parsed)) // true
 * if (Result.isSuccess(parsed)) {
 *   console.log(parsed.success) // { a: 1, b: 1 }
 * }
 * ```
 *
 * @throws Throws {@link AliasExpansionBudgetExceeded} when alias expansion materializes more nodes than the budget derived from `maxAliasCount`.
 * @see {@link YamlParseError} for the facade mapping of that throw to `AliasCountExceeded`.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const nodeToJsValue: {
  (node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): unknown,
  (anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): (node: YamlNode | null) => unknown
} = dual(3, (node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): unknown =>
  nodeToValue(node, anchors, {
    count: 0,
    limit: aliasExpansionLimit(maxAliasCount)
  }));

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
      throw AliasExpansionBudgetExceeded.make({
        limit: budget.limit,
      });
    }
  }
  // Register this node's anchor incrementally so aliases resolve to the most
  // recent anchor at the point of reference (not the last definition in the
  // entire document).
  if (anchors !== undefined && !(YamlAlias.is(node)) && node.anchor !== undefined) {
    MutableHashMap.set(anchors, node.anchor, node);
  }
  if (YamlScalar.is(node)) return node.value;
  if (YamlMap.is(node)) {
    const result: Record<string, unknown> = {};
    for (const pair of node.items) {
      let key: string;
      if (YamlScalar.is(pair.key)) {
        // Register key anchor before resolving value
        if (anchors !== undefined && pair.key.anchor !== undefined) {
          MutableHashMap.set(anchors, pair.key.anchor, pair.key);
        }
        key = String(pair.key.value ?? "");
      } else if (YamlAlias.is(pair.key)) {
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
  if (YamlSeq.is(node)) return node.items.map((item) => nodeToValue(item, anchors, budget, counting));
  if (YamlAlias.is(node)) {
    const resolved = anchors === undefined ? undefined : O.getOrUndefined(MutableHashMap.get(anchors, node.name));
    // Resolving an alias enters alias expansion → count the resolved subtree.
    return resolved !== undefined ? nodeToValue(resolved, anchors, budget, true) : null;
  }
  return null;
}

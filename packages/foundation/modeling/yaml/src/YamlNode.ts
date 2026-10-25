/**
 * The mutually-recursive YAML AST: YamlScalar, YamlMap, YamlSeq, YamlPair,
 * YamlAlias and the YamlNode union, co-located in one module to break the
 * import cycle inherent in the recursive node types.
 *
 * **Details**
 *
 * Nodes deliberately carry no parent pointers (circular references would
 * break structural equality, serialization and Schema encode/decode). Child
 * relationships are expressed via `items`/`key`/`value`, and the recursive
 * types are handled with `Schema.suspend`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $YamlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { Mutable } from "effect/Struct";
import type { YamlPath } from "./YamlEdit.ts";

const $I = $YamlId.create("YamlNode");

/**
 * YAML scalar presentation styles.
 *
 * **Example** (Decode ScalarStyle vocabulary)
 *
 * ```ts
 * import { ScalarStyle } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ScalarStyle)("block-literal")) // block-literal
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
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
 * @category type-level
 * @since 0.0.0
 */
export type ScalarStyle = typeof ScalarStyle.Type;

/**
 * YAML collection presentation styles.
 *
 * **Example** (Decode CollectionStyle vocabulary)
 *
 * ```ts
 * import { CollectionStyle } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(CollectionStyle)("flow")) // flow
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CollectionStyle = LiteralKit(["block", "flow"]).pipe(
  $I.annoteSchema("CollectionStyle", { description: "YAML collection presentation styles." })
);

/**
 * The union of all collection style string literals.
 *
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
 * **Example** (Decode QuoteStyle vocabulary)
 *
 * ```ts
 * import { QuoteStyle } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(QuoteStyle)("double")) // double
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const QuoteStyle = LiteralKit(["single", "double"]).pipe(
  $I.annoteSchema("QuoteStyle", {
    description:
      "Quote characters available to the stringifier's plain-scalar fallback: the style a `plain`-styled scalar is rendered in when it turns out to require quoting. Referenced by the `quoteStyle` field of `YamlStringifyOptions`; unlike `ScalarStyle` it is a stringify-option vocabulary, never a property of a composed node.",
  })
);

/**
 * The union of all fallback quote style string literals.
 *
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
 * **Example** (Decode QuoteCompat vocabulary)
 *
 * ```ts
 * import { QuoteCompat } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(QuoteCompat)("yaml-1.1")) // yaml-1.1
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const QuoteCompat = LiteralKit(["yaml-1.1"]).pipe(
  $I.annoteSchema("QuoteCompat", {
    description:
      "Foreign resolution dialects the stringifier's plain-scalar fallback can defend against: setting the `quoteCompat` field of `YamlStringifyOptions` to `\"yaml-1.1\"` additionally quotes every plain scalar a YAML 1.1 parser (js-yaml, PyYAML, libyaml, and the `yaml` npm package's YAML 1.1 schema, whose lenient resolvers set the outer bound) would implicitly resolve to a non-string — `yes`/`no`/`on`/`off` booleans, ISO 8601 and space-separated timestamps, sexagesimal `1:30`, underscored `1_000` and base-2/8/16 numbers. Like `QuoteStyle` it is a stringify-option vocabulary, never a property of a composed node.",
  })
);

/**
 * The union of all quote-compat dialect string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type QuoteCompat = typeof QuoteCompat.Type;

/**
 * Block-scalar chomping indicators (`-` strip, default clip, `+` keep).
 * Referenced by the {@link YamlScalar} `chomp` field schema.
 *
 * **Example** (Decode ScalarChomp vocabulary)
 *
 * ```ts
 * import { ScalarChomp } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ScalarChomp)("strip")) // strip
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ScalarChomp = LiteralKit(["strip", "clip", "keep"]).pipe(
  $I.annoteSchema("ScalarChomp", {
    description:
      "Block-scalar chomping indicators (`-` strip, default clip, `+` keep). Referenced by the YamlScalar `chomp` field schema.",
  })
);

/**
 * The union of all block-scalar chomping indicator string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ScalarChomp = typeof ScalarChomp.Type;

/**
 * The navigation and extraction surface every YAML AST value node shares —
 * {@link YamlScalar}, {@link YamlAlias}, {@link YamlMap} and
 * {@link YamlSeq} all extend it.
 *
 * **Example** (Navigate from any node)
 *
 * ```ts
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 * import * as O from "effect/Option"
 *
 * const node = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
 * console.log(O.isSome(node.find([])), node.toValue()) // true hello
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlNodeBase extends S.Class<YamlNodeBase, { readonly yamlNode: unique symbol }>($I`YamlNodeBase`)(
  {},
  $I.annote("YamlNodeBase", {
    description: "Shared navigation and value-extraction surface of the four YAML AST value node classes.",
  })
) {
  /**
   * Navigate to a descendant by path (string segments for mapping keys,
   * numbers for sequence indices). `Option.none()` when any segment cannot
   * be resolved. Pure.
   *
   * **Example** (Resolve the empty path)
   *
   * ```ts
   * import { YamlScalar } from "@beep/yaml/YamlNode"
   * import * as O from "effect/Option"
   *
   * const node = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
   * console.log(O.isSome(node.find([]))) // true
   * ```
   * @category getters
   * @since 0.0.0
   */
  find(this: YamlNode, path: YamlPath): O.Option<YamlNode> {
    return findByPath(this, path);
  }

  /**
   * Find the deepest node whose span contains `offset` (half-open interval),
   * or `Option.none()` when the offset falls outside this subtree. Pure.
   *
   * **Example** (Exclude the end of the source span)
   *
   * ```ts
   * import { YamlScalar } from "@beep/yaml/YamlNode"
   * import * as O from "effect/Option"
   *
   * const node = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
   * console.log(O.isNone(node.findAtOffset(node.offset + node.length))) // true
   * ```
   * @category getters
   * @since 0.0.0
   */
  findAtOffset(this: YamlNode, offset: number): O.Option<YamlNode> {
    return findDeepestAtOffset(this, offset);
  }

  /**
   * Return the path from this node to the given descendant node (matched by
   * reference identity), or `Option.none()` when it is not in this subtree.
   *
   * **Details**
   *
   * The inverse of {@link YamlNodeBase.find}. Pure.
   *
   * **Example** (Locate the root by identity)
   *
   * ```ts
   * import { YamlScalar } from "@beep/yaml/YamlNode"
   * import * as O from "effect/Option"
   *
   * const node = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
   * console.log(JSON.stringify(O.getOrNull(node.pathOf(node)))) // []
   * ```
   * @category getters
   * @since 0.0.0
   */
  pathOf(this: YamlNode, node: YamlNode): O.Option<YamlPath> {
    return pathToNode(this, node);
  }

  /**
   * Reconstruct the plain JavaScript value of this subtree.
   *
   * **Details**
   *
   * Aliases resolve
   * through `anchors` (anchors encountered during the walk register
   * incrementally, so an alias sees the most recent definition at its point
   * of use); unresolvable aliases yield `null`. Pure and total.
   *
   * **Gotchas**
   *
   * Providing an anchor map registers encountered anchors in that map. Alias
   * expansion can throw {@link AliasExpansionBudgetExceeded} when the default
   * output-node budget is exceeded.
   *
   * **Example** (Extract the node value)
   *
   * ```ts
   * import { YamlScalar } from "@beep/yaml/YamlNode"
   *
   * const node = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
   * console.log(node.toValue()) // hello
   * ```
   * @category decoding
   * @since 0.0.0
   */
  toValue(this: YamlNode, anchors?: MutableHashMap.MutableHashMap<string, YamlNode>): unknown {
    return nodeToValue(this, anchors, defaultBudget());
  }
}

/**
 * A YAML scalar AST node, representing a leaf value such as a string,
 * number, boolean, or null.
 *
 * **Details**
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
 * **Example** (Extract a scalar value)
 *
 * ```ts
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const scalar = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
 * console.log(scalar.toValue()) // hello
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlScalar extends YamlNodeBase.extend<YamlScalar, {}, { readonly brand: unique symbol }>($I`YamlScalar`)(
  {
    _tag: S.tag("YamlScalar"),
    value: S.Unknown.pipe(
      $I.annoteKey("YamlScalar.value", {
        description: "Resolved scalar content used when reconstructing the document's plain JavaScript value",
      })
    ),
    tag: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlScalar.tag", {
        description: "Explicit YAML tag attached to the scalar, such as `!!str` or `!!int`",
      })
    ),
    style: ScalarStyle.pipe(
      $I.annoteKey("YamlScalar.style", {
        description: "Scalar presentation in YAML: plain, single-quoted, double-quoted, literal block, or folded block",
      })
    ),
    anchor: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlScalar.anchor", {
        description: "Anchor identifier used by aliases to reference this scalar, without the leading `&`",
      })
    ),
    commentBefore: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlScalar.commentBefore", {
        description:
          "Own-line comment text directly above the scalar, with consecutive comment lines joined by newlines",
      })
    ),
    comment: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlScalar.comment", {
        description: "Trailing comment text on the scalar's line, including header-line comments for block scalars",
      })
    ),
    spaceBefore: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlScalar.spaceBefore", {
        description: "Whether a blank line precedes the scalar and any leading comment block in the source",
      })
    ),
    chomp: S.optionalKey(ScalarChomp).pipe(
      $I.annoteKey("YamlScalar.chomp", {
        description:
          "Block-scalar trailing newline handling: `strip` removes them, `clip` retains one, and `keep` retains all",
      })
    ),
    blockIndent: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("YamlScalar.blockIndent", {
        description:
          "Explicit indentation-indicator digit from the block-scalar header, absent when indentation is automatically detected",
      })
    ),
    raw: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlScalar.raw", {
        description:
          "Original scalar spelling retained when resolution changes its representation, preserving numeric forms such as hexadecimal or trailing zeros",
      })
    ),
    sourceMultiline: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlScalar.sourceMultiline", {
        description: "Whether the scalar's source span contains a line break; absent on synthetic nodes",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("YamlScalar.offset", {
        description: "Zero-based start of the scalar's source span, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlScalar.length", {
        description: "Extent of the scalar's source span, measured in UTF-16 code units",
      })
    ),
  },
  $I.annote("YamlScalar", {
    description: "A YAML scalar AST node, representing a leaf value such as a string, number, boolean, or null.",
  })
) {}

/**
 * A YAML alias AST node, referencing a previously defined anchor by name
 * (without the leading `*`).
 *
 * **Details**
 *
 * Carries the same comment triple as every other node class — see
 * {@link YamlScalar} for the field semantics. An alias is a node like any
 * other and a comment can legally sit above or after one.
 *
 * **Example** (Resolve an anchored scalar)
 *
 * ```ts
 * import { YamlAlias, YamlScalar, YamlNode } from "@beep/yaml/YamlNode"
 * import * as MutableHashMap from "effect/MutableHashMap"
 *
 * const anchors = MutableHashMap.empty<string, YamlNode>()
 * MutableHashMap.set(anchors, "greeting", YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 }))
 * const alias = YamlAlias.make({ name: "greeting", offset: 0, length: 9 })
 * console.log(alias.toValue(anchors)) // hello
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlAlias extends YamlNodeBase.extend<YamlAlias, {}, { readonly brand: unique symbol }>($I`YamlAlias`)(
  {
    _tag: S.tag("YamlAlias"),
    name: S.String.pipe(
      $I.annoteKey("YamlAlias.name", {
        description: "Identifier of the previously defined anchor referenced by this alias, without the leading `*`",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("YamlAlias.offset", {
        description: "Zero-based start of the alias's source span, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlAlias.length", {
        description: "Extent of the alias's source span, measured in UTF-16 code units",
      })
    ),
    commentBefore: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlAlias.commentBefore", {
        description:
          "Own-line comment text directly above the alias, with consecutive comment lines joined by newlines",
      })
    ),
    comment: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlAlias.comment", { description: "Trailing comment text on the alias's line" })
    ),
    spaceBefore: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlAlias.spaceBefore", {
        description: "Whether a blank line precedes the alias and any leading comment block in the source",
      })
    ),
  },
  $I.annote("YamlAlias", {
    description: "A YAML alias AST node, referencing a previously defined anchor by name (without the leading `*`).",
  })
) {
  /**
   * Retain the alias target for one extraction scope so later anchor updates
   * cannot change a reference already resolved in source order.
   *
   * **Example** (Extract an unresolved alias)
   *
   * ```ts
   * import { YamlAlias } from "@beep/yaml/YamlNode"
   * const alias = YamlAlias.make({ name: "missing", offset: 0, length: 8 })
   * console.log(alias.toValue()) // null
   * ```
   *
   * @internal
   * @category decoding
   * @since 0.0.0
   */
  #extractionBinding?: { readonly scope: ExpansionBudget; readonly target: YamlNode | undefined };

  /**
   * Resolve once within an extraction, retaining the source-order target.
   *
   * **Example** (Extract with a fresh binding scope)
   *
   * ```ts
   * import { YamlAlias } from "@beep/yaml/YamlNode"
   * console.log(YamlAlias.make({ name: "missing", offset: 0, length: 8 }).toValue()) // null
   * ```
   *
   * @internal
   * @category decoding
   * @since 0.0.0
   */
  resolveTarget(
    anchors: MutableHashMap.MutableHashMap<string, YamlNode> | undefined,
    scope: ExpansionBudget
  ): YamlNode | undefined {
    if (this.#extractionBinding?.scope !== scope) {
      this.#extractionBinding = {
        scope,
        target: anchors === undefined ? undefined : O.getOrUndefined(MutableHashMap.get(anchors, this.name)),
      };
    }
    return this.#extractionBinding.target;
  }
}

/**
 * Companion namespace for {@link YamlScalar}.
 *
 * **Example** (Type the encoded YamlScalar form)
 *
 * ```ts
 * import type { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const tagOf = (encoded: YamlScalar.Encoded): string => encoded._tag
 * console.log(tagOf)
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace YamlScalar {
  /**
   * The encoded (plain-object) form of a {@link YamlScalar} — the class fields
   * without the instance methods. Named so the recursive {@link (YamlNode:variable)}
   * codec can state its encoded side without a circular type annotation.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded extends S.Codec.Encoded<typeof YamlScalar> {}
}

/**
 * Companion namespace for {@link YamlMap}.
 *
 * **Example** (Type the encoded YamlMap form)
 *
 * ```ts
 * import type { YamlMap } from "@beep/yaml/YamlNode"
 *
 * const tagOf = (encoded: YamlMap.Encoded): string => encoded._tag
 * console.log(tagOf)
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace YamlMap {
  /**
   * The encoded (plain-object) form of a {@link YamlMap}. See
   * {@link YamlScalar.Encoded} for why the encoded forms are named interfaces.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded extends S.Codec.Encoded<typeof YamlMap> {}
}

/**
 * Companion namespace for {@link YamlSeq}.
 *
 * **Example** (Type the encoded YamlSeq form)
 *
 * ```ts
 * import type { YamlSeq } from "@beep/yaml/YamlNode"
 *
 * const tagOf = (encoded: YamlSeq.Encoded): string => encoded._tag
 * console.log(tagOf)
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace YamlSeq {
  /**
   * The encoded (plain-object) form of a {@link YamlSeq}. See
   * {@link YamlScalar.Encoded} for why the encoded forms are named interfaces.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded extends S.Codec.Encoded<typeof YamlSeq> {}
}

/**
 * Companion namespace for {@link YamlAlias}.
 *
 * **Example** (Type the encoded YamlAlias form)
 *
 * ```ts
 * import type { YamlAlias } from "@beep/yaml/YamlNode"
 *
 * const tagOf = (encoded: YamlAlias.Encoded): string => encoded._tag
 * console.log(tagOf)
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace YamlAlias {
  /**
   * The encoded (plain-object) form of a {@link YamlAlias}. See
   * {@link YamlScalar.Encoded} for why the encoded forms are named interfaces.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded extends S.Codec.Encoded<typeof YamlAlias> {}
}

/**
 * A discriminated-union schema covering all four YAML AST value node types:
 * {@link YamlScalar}, {@link YamlMap}, {@link YamlSeq} and {@link YamlAlias}.
 * **Details**
 *
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `YamlNode → YamlMap → YamlPair → YamlNode`.
 * **Gotchas**
 *
 * Construct member nodes via their `.make(...)` static (e.g.
 * `YamlScalar.make(...)`), never `new YamlScalar(...)` — the internal
 * composer's hot-path `new` construction is the one recorded exception, kept
 * internal to the engine for its allocation-sensitive walk.
 * **Example** (Recognize a scalar union member)
 *
 * ```ts
 * import { YamlNode, YamlScalar } from "@beep/yaml/YamlNode"
 * import * as S from "effect/Schema"
 *
 * const scalar = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
 * console.log(S.is(YamlNode)(scalar)) // true
 * ```
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlNode: S.Codec<
  YamlScalar | YamlMap | YamlSeq | YamlAlias,
  YamlScalar.Encoded | YamlMap.Encoded | YamlSeq.Encoded | YamlAlias.Encoded
> = S.suspend(() => S.Union([YamlScalar, YamlMap, YamlSeq, YamlAlias])).pipe(
  $I.annoteSchema("YamlNode", {
    description: "Recursive union of YAML scalar, mapping, sequence and alias value nodes.",
  })
);

/**
 * The union of all YAML AST value node types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlNode = YamlScalar | YamlMap | YamlSeq | YamlAlias;

/**
 * A YAML key-value pair AST node, representing one entry within a mapping.
 * `value` is `null` when absent (e.g. `key:` with no value).
 *
 * **Details**
 *
 * A pair carries **no comment fields**. Comments belong to the pair's `key`
 * and `value` nodes, which have one comment slot each: an own-line comment
 * above the entry leads the `key`, and a trailing comment on the entry's line
 * follows the `value`. Two slots rather than one is what lets `a: # kc` keep
 * its comment where the author wrote it instead of relocating it onto the
 * value's line.
 *
 * **Example** (Represent an entry without a value)
 *
 * ```ts
 * import { YamlPair, YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const pair = YamlPair.make({ key: YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 }), value: null })
 * console.log(pair.value) // null
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlPair extends S.Opaque<YamlPair, { readonly brand: unique symbol }>()(
  S.TaggedStruct("YamlPair", {
    key: $I.annoteKey("YamlPair.key", {
      description: "Node identifying the mapping entry, carrying any own-line comments above that entry",
    })(S.suspend((): typeof YamlNode => YamlNode)),
    value: $I.annoteKey("YamlPair.value", {
      description: "Node containing the mapping entry's content, or `null` when no value follows the key",
    })(S.suspend((): S.NullOr<typeof YamlNode> => S.NullOr(YamlNode))),
  }).pipe(
    $I.annoteSchema("YamlPair", {
      description:
        "A YAML key-value pair AST node, representing one entry within a mapping. `value` is `null` when absent (e.g. `key:` with no value).",
    })
  )
) {}

/**
 * A YAML mapping AST node, representing a collection of {@link YamlPair}
 * entries.
 *
 * **Details**
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
 * **Example** (Extract an empty mapping)
 *
 * ```ts
 * import { YamlMap } from "@beep/yaml/YamlNode"
 *
 * const mapping = YamlMap.make({ items: [], style: "block", offset: 0, length: 2 })
 * console.log(JSON.stringify(mapping.toValue())) // {}
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlMap extends YamlNodeBase.extend<YamlMap, {}, { readonly brand: unique symbol }>($I`YamlMap`)(
  {
    _tag: S.tag("YamlMap"),
    items: S.Array(S.suspend((): typeof YamlPair => YamlPair)).pipe(
      $I.annoteKey("YamlMap.items", { description: "Key-value entries in their stored order within the YAML mapping" })
    ),
    tag: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlMap.tag", {
        description: "Explicit YAML tag attached to the mapping and retained when emitting it",
      })
    ),
    anchor: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlMap.anchor", {
        description: "Anchor identifier used by aliases to reference this mapping, without the leading `&`",
      })
    ),
    style: CollectionStyle.pipe(
      $I.annoteKey("YamlMap.style", {
        description: "Mapping presentation as indented block entries or a flow collection enclosed in braces",
      })
    ),
    commentBefore: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlMap.commentBefore", {
        description:
          "Own-line comment text directly above the mapping, with consecutive comment lines joined by newlines",
      })
    ),
    comment: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlMap.comment", {
        description:
          "Comment text after the last block entry at item indentation, or a same-line trailing comment for a flow mapping",
      })
    ),
    spaceBefore: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlMap.spaceBefore", {
        description: "Whether a blank line precedes the mapping and any leading comment block in the source",
      })
    ),
    sourceMultiline: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlMap.sourceMultiline", {
        description:
          "Whether the mapping's source span contains a line break; used by the canonical stringifier and absent on synthetic nodes",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("YamlMap.offset", {
        description: "Zero-based start of the mapping's source span, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlMap.length", {
        description: "Extent of the mapping's source span, measured in UTF-16 code units",
      })
    ),
  },
  $I.annote("YamlMap", { description: "A YAML mapping AST node, representing a collection of YamlPair entries." })
) {}

/**
 * A YAML sequence AST node, representing an ordered list of
 * {@link (YamlNode:type)} values.
 *
 * **Details**
 *
 * - `commentBefore` — own-line comment text directly above the sequence.
 * - `comment` — trailing comment text: own-line comment lines after the
 *   sequence's last item (still at the sequence's item indent), or a
 *   same-line trailing comment for a flow sequence.
 * - `spaceBefore` — `true` when a blank line precedes the sequence.
 *
 * **Example** (Extract sequence items in order)
 *
 * ```ts
 * import { YamlSeq, YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const sequence = YamlSeq.make({ items: [YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })], style: "flow", offset: 0, length: 7 })
 * console.log(JSON.stringify(sequence.toValue())) // ["hello"]
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlSeq extends YamlNodeBase.extend<YamlSeq, {}, { readonly brand: unique symbol }>($I`YamlSeq`)(
  {
    _tag: S.tag("YamlSeq"),
    items: S.Array(S.suspend((): typeof YamlNode => YamlNode)).pipe(
      $I.annoteKey("YamlSeq.items", {
        description: "Child nodes in YAML sequence order, addressed by their zero-based positions",
      })
    ),
    tag: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlSeq.tag", {
        description: "Explicit YAML tag attached to the sequence and retained when emitting it",
      })
    ),
    anchor: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlSeq.anchor", {
        description: "Anchor identifier used by aliases to reference this sequence, without the leading `&`",
      })
    ),
    style: CollectionStyle.pipe(
      $I.annoteKey("YamlSeq.style", {
        description: "Sequence presentation as dash-prefixed block items or a flow collection enclosed in brackets",
      })
    ),
    commentBefore: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlSeq.commentBefore", {
        description:
          "Own-line comment text directly above the sequence, with consecutive comment lines joined by newlines",
      })
    ),
    comment: S.optionalKey(S.String).pipe(
      $I.annoteKey("YamlSeq.comment", {
        description:
          "Comment text after the last block item at item indentation, or a same-line trailing comment for a flow sequence",
      })
    ),
    spaceBefore: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlSeq.spaceBefore", {
        description: "Whether a blank line precedes the sequence and any leading comment block in the source",
      })
    ),
    sourceMultiline: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("YamlSeq.sourceMultiline", {
        description:
          "Whether the sequence's source span contains a line break; used by the canonical stringifier and absent on synthetic nodes",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("YamlSeq.offset", {
        description: "Zero-based start of the sequence's source span, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlSeq.length", {
        description: "Extent of the sequence's source span, measured in UTF-16 code units",
      })
    ),
  },
  $I.annote("YamlSeq", {
    description: "A YAML sequence AST node, representing an ordered list of (YamlNode:type) values.",
  })
) {}

const isScalar = S.is(YamlScalar);
const isMap = S.is(YamlMap);
const isSeq = S.is(YamlSeq);

// ── Shared method implementations ───────────────────────────────────────────
// Module-level so the four union classes share one body each. Declared after
// the classes; function declarations hoist.

const findByPath: {
  (root: YamlNode, path: YamlPath): O.Option<YamlNode>;
  (path: YamlPath): (root: YamlNode) => O.Option<YamlNode>;
} = dual(2, (root: YamlNode, path: YamlPath): O.Option<YamlNode> => {
  let current: YamlNode = root;
  for (const segment of path) {
    const next = P.isString(segment) ? childByKey(current, segment) : childByIndex(current, segment);
    if (next === undefined) return O.none();
    current = next;
  }
  return O.some(current);
});

/** Navigate by key — requires a YamlMap whose matching pair has a value. */
const childByKey = (current: YamlNode, segment: string): YamlNode | undefined => {
  if (!isMap(current)) return undefined;
  const pair: O.Option<YamlPair> = A.findFirst(
    current.items,
    (p: YamlPair) => isScalar(p.key) && P.isString(p.key.value) && p.key.value === segment
  );
  return O.isNone(pair) || pair.value.value === null ? undefined : pair.value.value;
};

/** Navigate by index — requires a YamlSeq. */
const childByIndex = (current: YamlNode, segment: number): YamlNode | undefined =>
  isSeq(current) ? current.items[segment] : undefined;

/**
 * Half-open interval test `[offset, offset + length)` so a cursor positioned
 * immediately after a node is NOT considered inside it.
 */
const containsOffset: {
  (node: YamlNode, offset: number): boolean;
  (offset: number): (node: YamlNode) => boolean;
} = dual(2, (node: YamlNode, offset: number): boolean => offset >= node.offset && offset < node.offset + node.length);

const findDeepestAtOffset: {
  (node: YamlNode, offset: number): O.Option<YamlNode>;
  (offset: number): (node: YamlNode) => O.Option<YamlNode>;
} = dual(2, (node: YamlNode, offset: number): O.Option<YamlNode> => {
  if (!containsOffset(node, offset)) {
    return O.none();
  }
  const child = deepestInChildren(node, offset);
  // This node contains the offset but no child does — this is the deepest
  return O.isSome(child) ? child : O.some(node);
});

/** The deepest node at `offset` within a pair: its key first, then its value. */
const deepestInPair = (pair: YamlPair, offset: number): O.Option<YamlNode> => {
  const keyResult = findDeepestAtOffset(pair.key, offset);
  if (O.isSome(keyResult) || pair.value === null) return keyResult;
  return findDeepestAtOffset(pair.value, offset);
};

/** The first child (in document order) holding a deepest node at `offset`. */
const deepestInChildren = (node: YamlNode, offset: number): O.Option<YamlNode> => {
  if (isMap(node)) return firstDeepest(node.items, (pair) => deepestInPair(pair, offset));
  if (isSeq(node)) return firstDeepest(node.items, (item) => findDeepestAtOffset(item, offset));
  return O.none<YamlNode>();
};

/** The first `Some` produced by `search` over `children`, in order. */
const firstDeepest = <C>(children: ReadonlyArray<C>, search: (child: C) => O.Option<YamlNode>): O.Option<YamlNode> => {
  for (const child of children) {
    const result = search(child);
    if (O.isSome(result)) return result;
  }
  return O.none<YamlNode>();
};

const pathToNode: {
  (root: YamlNode, target: YamlNode): O.Option<YamlPath>;
  (target: YamlNode): (root: YamlNode) => O.Option<YamlPath>;
} = dual(2, (root: YamlNode, target: YamlNode): O.Option<YamlPath> => {
  const path: Array<string | number> = [];
  return descendToNode(root, target, path) ? O.some(path) : O.none();
});

/**
 * Depth-first identity search accumulating mapping-key/sequence-index
 * segments. Only scalar string keys produce navigable segments (matching
 * `find`); descendants reachable only through complex keys are not
 * addressable by path.
 */
const descendToNode: {
  (node: YamlNode, target: YamlNode, path: Array<string | number>): boolean;
  (target: YamlNode, path: Array<string | number>): (node: YamlNode) => boolean;
} = dual(3, (node: YamlNode, target: YamlNode, path: Array<string | number>): boolean => {
  if (node === target) {
    return true;
  }
  if (isMap(node)) return descendThroughPairs(node.items, target, path);
  return isSeq(node) && descendThroughItems(node.items, target, path);
});

const descendThroughPairs = (
  pairs: ReadonlyArray<YamlPair>,
  target: YamlNode,
  path: Array<string | number>
): boolean => {
  for (const pair of pairs) {
    if (descendThroughPair(pair, target, path)) return true;
  }
  return false;
};

const descendThroughItems = (
  items: ReadonlyArray<YamlNode>,
  target: YamlNode,
  path: Array<string | number>
): boolean => {
  for (const [i, item] of items.entries()) {
    if (descendWithSegment(item, target, path, i)) return true;
  }
  return false;
};

/** Push `segment`, search `node`, and pop the segment again on a miss. */
const descendWithSegment = (
  node: YamlNode,
  target: YamlNode,
  path: Array<string | number>,
  segment: string | number
): boolean => {
  path.push(segment);
  if (descendToNode(node, target, path)) {
    return true;
  }
  path.pop();
  return false;
};

/** Search one pair; only scalar string keys produce navigable segments. */
const descendThroughPair = (pair: YamlPair, target: YamlNode, path: Array<string | number>): boolean => {
  if (!isScalar(pair.key) || !P.isString(pair.key.value)) return false;
  if (pair.key === target) {
    path.push(pair.key.value);
    return true;
  }
  return pair.value !== null && descendWithSegment(pair.value, target, path, pair.key.value);
};

/** Set a mapping key as an own data property — `__proto__` included. */
const setOwnProperty: {
  (obj: Record<string, unknown>, key: string, value: unknown): void;
  (key: string, value: unknown): (obj: Record<string, unknown>) => void;
} = dual(3, (obj: Record<string, unknown>, key: string, value: unknown): void => {
  R.assignProperty(obj, key, value);
});

/**
 * Thrown by the value-extraction walk when alias expansion materializes more
 * output nodes than the budget allows — the YAML "billion laughs" guard. A
 * chain of aliases each referencing the previous (`a2: [*a1×10]`,
 * `a3: [*a2×10]`, …) multiplies output size exponentially while the alias-*token*
 * count stays small, so the composer's per-token `maxAliasCount` limit does
 * not catch it; only bounding the expanded node count does.
 *
 * **Details**
 *
 * Not re-exported from the package entry point (`index.ts`) — the facade
 * catches it and materializes a fatal `AliasCountExceeded` `YamlParseError`
 * (or, for `Yaml.equals`, treats the input as malformed).
 *
 * **Example** (Inspect an expansion budget failure)
 *
 * ```ts
 * import { AliasExpansionBudgetExceeded } from "@beep/yaml/YamlNode"
 *
 * const error = AliasExpansionBudgetExceeded.make({ message: "Alias expansion exceeded budget of 10000 nodes" })
 * console.log(error.message) // Alias expansion exceeded budget of 10000 nodes
 * ```
 * @category errors
 * @since 0.0.0
 */
export class AliasExpansionBudgetExceeded extends S.TaggedError<
  AliasExpansionBudgetExceeded,
  { readonly brand: unique symbol }
>($I`AliasExpansionBudgetExceeded`)(
  "AliasExpansionBudgetExceeded",
  {
    message: S.String.pipe(
      $I.annoteKey("AliasExpansionBudgetExceeded.message", {
        description: "Alias expansion budget failure message, including the output-node limit.",
      })
    ),
  },
  $I.annoteError<AliasExpansionBudgetExceeded>("AliasExpansionBudgetExceeded", {
    description: "Value extraction exceeded its alias-expanded output-node budget.",
  })
) {
  /**
   * Identifies an alias-expansion budget failure in error reports.
   *
   * **Example** (Read the expansion error name)
   *
   * ```ts
   * import { AliasExpansionBudgetExceeded } from "@beep/yaml/YamlNode"
   *
   * const error = AliasExpansionBudgetExceeded.make({ message: "Expansion budget exceeded" })
   * console.log(error.name) // AliasExpansionBudgetExceeded
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
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

/**
 * The output-node cap for a given `maxAliasCount`.
 *
 * **Example** (Calculate the output node budget)
 *
 * ```ts
 * import { aliasExpansionLimit } from "@beep/yaml/YamlNode"
 *
 * console.log(aliasExpansionLimit(100)) // 1010000
 * ```
 * @category utilities
 * @since 0.0.0
 */
export function aliasExpansionLimit(maxAliasCount: number): number {
  return (maxAliasCount + 1) * ALIAS_EXPANSION_FACTOR;
}

/** Default cap for a direct `toValue()` call, matching the default `maxAliasCount` of 100. */
const DEFAULT_ALIAS_EXPANSION_LIMIT = aliasExpansionLimit(100);

/** Mutable counter carried through one value-extraction walk. */
const ExpansionBudget = S.Struct({
  count: S.Finite.pipe(
    $I.annoteKey("ExpansionBudget.count", {
      description: "Number of output nodes materialized through alias expansion during this walk.",
    })
  ),
  limit: S.declare(P.isNumber).pipe(
    $I.annoteKey("ExpansionBudget.limit", {
      description:
        "Calculated output-node cap; retains the full numeric domain of the existing budget calculation, including overflow.",
    })
  ),
}).pipe(
  $I.annoteSchema("ExpansionBudget", {
    description: "Shared output-node budget for one recursive value-extraction walk.",
  })
);
type ExpansionBudget = Omit<typeof ExpansionBudget.Type, "count"> & Mutable<Pick<typeof ExpansionBudget.Type, "count">>;

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
 *
 * **Example** (Extract a scalar with an explicit budget)
 *
 * ```ts
 * import { nodeToJsValue, YamlScalar, YamlNode } from "@beep/yaml/YamlNode"
 * import * as MutableHashMap from "effect/MutableHashMap"
 *
 * const anchors = MutableHashMap.empty<string, YamlNode>()
 * const scalar = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
 * console.log(nodeToJsValue(scalar, anchors, 100)) // hello
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const nodeToJsValue: {
  (node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): unknown;
  (anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): (node: YamlNode | null) => unknown;
} = dual(
  3,
  (node: YamlNode | null, anchors: MutableHashMap.MutableHashMap<string, YamlNode>, maxAliasCount: number): unknown =>
    nodeToValue(node, anchors, { count: 0, limit: aliasExpansionLimit(maxAliasCount) })
);

const nodeToValue: {
  (
    anchors?: MutableHashMap.MutableHashMap<string, YamlNode>,
    budget?: ExpansionBudget,
    counting?: boolean,
    ancestors?: ReadonlyArray<YamlNode>
  ): (node: YamlNode | null) => unknown;
  (
    node: YamlNode | null,
    anchors?: MutableHashMap.MutableHashMap<string, YamlNode>,
    budget?: ExpansionBudget,
    counting?: boolean,
    ancestors?: ReadonlyArray<YamlNode>
  ): unknown;
} = dual(
  (args) => args[0] === null || P.hasProperty(args[0], "_tag"),
  (
    node: YamlNode | null,
    anchors?: MutableHashMap.MutableHashMap<string, YamlNode>,
    budget: ExpansionBudget = defaultBudget(),
    counting?: boolean,
    ancestors: ReadonlyArray<YamlNode> = []
  ): unknown => (node === null ? null : walkValue(node, { anchors, budget, counting: counting === true, ancestors }))
);

/** The shared state of one value-extraction walk. */
type ValueWalk = {
  readonly anchors: MutableHashMap.MutableHashMap<string, YamlNode> | undefined;
  readonly budget: ExpansionBudget;
  readonly counting: boolean;
  readonly ancestors: ReadonlyArray<YamlNode>;
};

/**
 * Count only nodes materialized *through* an alias expansion (counting=true).
 * Alias-free content never ticks the counter, so large but benign documents
 * are not falsely rejected; an exponential alias chain accumulates across the
 * shared budget and trips the cap before the heap is exhausted.
 */
const tickBudget = (budget: ExpansionBudget): void => {
  budget.count++;
  if (budget.count > budget.limit) {
    throw AliasExpansionBudgetExceeded.make({
      message: `Alias expansion exceeded budget of ${budget.limit} nodes`,
    });
  }
};

/**
 * Register this node's anchor incrementally so aliases resolve to the most
 * recent anchor at the point of reference (not the last definition in the
 * entire document).
 */
const registerLiveAnchor = (walk: ValueWalk, node: YamlNode): void => {
  if (walk.counting || walk.anchors === undefined || node._tag === "YamlAlias" || node.anchor === undefined) return;
  MutableHashMap.set(walk.anchors, node.anchor, node);
};

/**
 * The input is already a typed AST node. Dispatch on its schema tag here;
 * revalidating recursive schemas for every expanded node makes the budget
 * guard itself expensive under coverage instrumentation.
 */
const walkValue = (node: YamlNode, walk: ValueWalk): unknown => {
  if (walk.counting) tickBudget(walk.budget);
  registerLiveAnchor(walk, node);
  if (node._tag === "YamlScalar") return node.value;
  if (node._tag === "YamlMap") return mapToValue(node, walk);
  if (node._tag === "YamlSeq")
    return A.map(node.items, nodeToValue(walk.anchors, walk.budget, walk.counting, walk.ancestors));
  return aliasToValue(node, walk);
};

/** The own-property key a mapping key extracts to. */
const pairKeyString = (key: YamlNode, walk: ValueWalk): string => {
  if (key._tag === "YamlScalar") {
    // Register key anchor before resolving value
    if (!walk.counting && walk.anchors !== undefined && key.anchor !== undefined) {
      MutableHashMap.set(walk.anchors, key.anchor, key);
    }
    return String(key.value ?? "");
  }
  // Resolving an alias key uses the same historical binding and cycle guard.
  if (key._tag === "YamlAlias") return String(nodeToValue(key, walk.anchors, walk.budget, false, walk.ancestors) ?? "");
  return "";
};

const mapToValue = (node: YamlMap, walk: ValueWalk): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const pair of node.items) {
    const key = pairKeyString(pair.key, walk);
    setOwnProperty(result, key, nodeToValue(pair.value, walk.anchors, walk.budget, walk.counting, walk.ancestors));
  }
  return result;
};

const aliasToValue = (node: YamlAlias, walk: ValueWalk): unknown => {
  const resolved = node.resolveTarget(walk.anchors, walk.budget);
  if (resolved === undefined) return null;
  // Identity is essential here: structurally equal sibling nodes are not cycles.
  if (A.some(walk.ancestors, (ancestor) => ancestor === resolved)) {
    throw AliasExpansionBudgetExceeded.make({
      message: `Alias expansion exceeded budget of ${walk.budget.limit} nodes (cyclic alias)`,
    });
  }
  // Historical expansion reuses bindings without changing the live anchor map.
  return nodeToValue(resolved, walk.anchors, walk.budget, true, [...walk.ancestors, resolved]);
};

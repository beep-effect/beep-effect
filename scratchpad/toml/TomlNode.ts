/**
 * Lossless linear CST: a TOML document is a flat list of expressions whose
 * source spans tile the document exactly.
 *
 * **Details**
 *
 * Concatenating every expression's source slice in order reproduces the input
 * byte-for-byte. Value nodes recurse only through arrays and inline tables,
 * handled with the `S.suspend` idiom. This is a leaf module: it imports
 * only `effect` and `./TomlDateTime.ts`.
 *
 * **Gotchas**
 *
 * Expression spans start at the line's leading whitespace and end after the
 * terminating newline (or EOF). Comment text stored on key-values and headers
 * has `#` stripped and one leading space removed — prepending `#` will
 * double-hash.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as S from "effect/Schema";
import { $ScratchpadId } from "@beep/identity";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "./TomlDateTime.ts";

const $I = $ScratchpadId.create("toml/TomlNode");

/**
 * The three simple-key spellings: `bare`, `basic` (`"..."`) and `literal`
 * (`'...'`).
 *
 * **Example** (Guard a key kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlKeyKind } from "@beep/scratchpad/toml"
 *
 * console.log(S.is(TomlKeyKind)("bare")) // true
 * console.log(S.is(TomlKeyKind)("quoted")) // false
 * ```
 *
 * @see {@link TomlKey} for the CST node that stores this kind.
 * @category schemas
 * @since 0.0.0
 */
export const TomlKeyKind = S.Literals(["bare", "basic", "literal"]).pipe(
  $I.annoteSchema("TomlKeyKind", {
    description: "The three simple-key spellings: bare, basic-quoted, and literal-quoted.",
  })
);

/**
 * The union of all key-kind string literals.
 *
 * @see {@link TomlKeyKind} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlKeyKind = typeof TomlKeyKind.Type;

/**
 * One simple key within a (possibly dotted) key path.
 *
 * - `value` — the decoded key text (escapes resolved, quotes stripped).
 * - `kind` — how the key was spelled in the source.
 * - `offset` / `length` — the key's span in the source, quotes included.
 *
 * **Example** (Construct a bare key)
 *
 * ```ts
 * import { TomlKey } from "@beep/scratchpad/toml"
 *
 * const key = new TomlKey({ value: "name", kind: "bare", offset: 0, length: 4 })
 * console.log(key.value) // "name"
 * console.log(key._tag) // "TomlKey"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlKey extends S.TaggedClass<TomlKey>($I`TomlKey`)(
  "TomlKey",
  {
    value: S.String,
    kind: TomlKeyKind,
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlKey", {
    description: "One simple key within a possibly dotted TOML key path, with source span and spelling.",
  })
) {
  static readonly is = S.is(TomlKey);
}

/**
 * The four TOML string forms.
 *
 * **Example** (Guard a string style)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlStringStyle } from "@beep/scratchpad/toml"
 *
 * console.log(S.is(TomlStringStyle)("multiline-basic")) // true
 * console.log(S.is(TomlStringStyle)("raw")) // false
 * ```
 *
 * @see {@link TomlString} for the CST node that stores this style.
 * @category schemas
 * @since 0.0.0
 */
export const TomlStringStyle = S.Literals(["basic", "literal", "multiline-basic", "multiline-literal"]).pipe(
  $I.annoteSchema("TomlStringStyle", {
    description: "The four TOML string forms: basic, literal, and their multiline variants.",
  })
);

/**
 * The union of all string-style literals.
 *
 * @see {@link TomlStringStyle} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlStringStyle = typeof TomlStringStyle.Type;

/**
 * A string value node. `value` is the decoded text; the raw spelling lives in
 * the source span.
 *
 * **Example** (Construct a basic string node)
 *
 * ```ts
 * import { TomlString } from "@beep/scratchpad/toml"
 *
 * const node = new TomlString({ value: "Alice", style: "basic", offset: 7, length: 7 })
 * console.log(node.value) // "Alice"
 * console.log(node._tag) // "TomlString"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlString extends S.TaggedClass<TomlString>($I`TomlString`)(
  "TomlString",
  {
    value: S.String,
    style: TomlStringStyle,
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlString", {
    description: "A TOML string value node storing decoded text, source style, and span.",
  })
) {
  static readonly is = S.is(TomlString);
}

/**
 * An integer value node. Decodes to `number` when the magnitude fits in
 * 2^53 - 1, else `bigint` (TOML integers span the full signed 64-bit range).
 *
 * **Gotchas**
 *
 * Comparing `node.value === 9007199254740993` against a `number` misses the
 * `bigint` narrowing used past `Number.MAX_SAFE_INTEGER`.
 *
 * **Example** (Construct a safe integer node)
 *
 * ```ts
 * import { TomlInteger } from "@beep/scratchpad/toml"
 *
 * const node = new TomlInteger({ value: 42, offset: 6, length: 2 })
 * console.log(node.value) // 42
 * console.log(typeof node.value) // "number"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlInteger extends S.TaggedClass<TomlInteger>($I`TomlInteger`)(
  "TomlInteger",
  {
    value: S.Union([S.Finite, S.BigInt]),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlInteger", {
    description: "A TOML integer value node: number within 2^53-1, otherwise bigint.",
  })
) {
  static readonly is = S.is(TomlInteger);
}

/**
 * A float value node, including the special spellings (`inf`, `nan`).
 *
 * **Example** (Construct a NaN float node)
 *
 * ```ts
 * import { TomlFloat } from "@beep/scratchpad/toml"
 *
 * const node = new TomlFloat({ value: Number.NaN, offset: 0, length: 3 })
 * console.log(Number.isNaN(node.value)) // true
 * console.log(node._tag) // "TomlFloat"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlFloat extends S.TaggedClass<TomlFloat>($I`TomlFloat`)(
  "TomlFloat",
  {
    value: S.Finite,
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlFloat", {
    description: "A TOML float value node, including inf and nan spellings.",
  })
) {
  static readonly is = S.is(TomlFloat);
}

/**
 * A boolean value node.
 *
 * **Example** (Construct a boolean node)
 *
 * ```ts
 * import { TomlBoolean } from "@beep/scratchpad/toml"
 *
 * const node = new TomlBoolean({ value: true, offset: 0, length: 4 })
 * console.log(node.value) // true
 * console.log(node._tag) // "TomlBoolean"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlBoolean extends S.TaggedClass<TomlBoolean>($I`TomlBoolean`)(
  "TomlBoolean",
  {
    value: S.Boolean,
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlBoolean", {
    description: "A TOML boolean value node.",
  })
) {
  static readonly is = S.is(TomlBoolean);
}

/**
 * A date-time value node wrapping one of the four TOML date-time classes.
 *
 * **Example** (Wrap a local date)
 *
 * ```ts
 * import { TomlDateTimeLiteral, TomlLocalDate } from "@beep/scratchpad/toml"
 *
 * const node = new TomlDateTimeLiteral({
 *   value: TomlLocalDate.make({ year: 1979, month: 5, day: 27 }),
 *   offset: 0,
 *   length: 10,
 * })
 * console.log(String(node.value)) // "1979-05-27"
 * console.log(node._tag) // "TomlDateTimeLiteral"
 * ```
 *
 * @see {@link TomlOffsetDateTime} for offset date-times stored in `value`.
 * @see {@link TomlLocalDateTime} for local date-times stored in `value`.
 * @see {@link TomlLocalDate} for local dates stored in `value`.
 * @see {@link TomlLocalTime} for local times stored in `value`.
 * @category models
 * @since 0.0.0
 */
export class TomlDateTimeLiteral extends S.TaggedClass<TomlDateTimeLiteral>($I`TomlDateTimeLiteral`)(
  "TomlDateTimeLiteral",
  {
    value: S.Union([TomlOffsetDateTime, TomlLocalDateTime, TomlLocalDate, TomlLocalTime]),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlDateTimeLiteral", {
    description: "A TOML date-time value node wrapping one of the four date-time classes.",
  })
) {
  static readonly is = S.is(TomlDateTimeLiteral);
}

/**
 * An array value node. Heterogeneous per TOML; may span multiple lines
 * (the span covers brackets, inner newlines and inner comments).
 *
 * **Example** (Construct an empty array node)
 *
 * ```ts
 * import { TomlArray } from "@beep/scratchpad/toml"
 *
 * const node = new TomlArray({ items: [], offset: 0, length: 2 })
 * console.log(node.items.length) // 0
 * console.log(node._tag) // "TomlArray"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlArray extends S.TaggedClass<TomlArray>($I`TomlArray`)(
  "TomlArray",
  {
    items: S.Array(S.suspend((): S.Codec<TomlValueNode> => TomlValueNode)),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlArray", {
    description: "A TOML array value node whose span covers brackets, inner newlines, and inner comments.",
  })
) {
  static readonly is = S.is(TomlArray);
}

/**
 * One `key = value` entry inside an inline table. `keyPath` has more than one
 * element for dotted keys (`{a.b = 1}`).
 *
 * **Example** (Construct a dotted inline entry)
 *
 * ```ts
 * import { TomlBoolean, TomlInlineEntry, TomlKey } from "@beep/scratchpad/toml"
 *
 * const entry = new TomlInlineEntry({
 *   keyPath: [
 *     new TomlKey({ value: "a", kind: "bare", offset: 2, length: 1 }),
 *     new TomlKey({ value: "b", kind: "bare", offset: 4, length: 1 }),
 *   ],
 *   value: new TomlBoolean({ value: true, offset: 8, length: 4 }),
 *   offset: 2,
 *   length: 10,
 * })
 * console.log(entry.keyPath.map((key) => key.value)) // ["a", "b"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlInlineEntry extends S.TaggedClass<TomlInlineEntry>($I`TomlInlineEntry`)(
  "TomlInlineEntry",
  {
    keyPath: S.Array(TomlKey),
    value: S.suspend((): S.Codec<TomlValueNode> => TomlValueNode),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlInlineEntry", {
    description: "One key = value entry inside an inline table, including dotted key paths.",
  })
) {
  static readonly is = S.is(TomlInlineEntry);
}

/**
 * An inline table value node (`{ k = v, ... }`). May span multiple lines
 * since TOML 1.1 (the span covers braces, inner newlines and inner comments).
 *
 * **Gotchas**
 *
 * TOML 1.1 allows multiline inline tables. Assuming they are single-line
 * mis-computes spans on 1.1 input.
 *
 * **Example** (Construct an empty inline table)
 *
 * ```ts
 * import { TomlInlineTable } from "@beep/scratchpad/toml"
 *
 * const node = new TomlInlineTable({ entries: [], offset: 0, length: 2 })
 * console.log(node.entries.length) // 0
 * console.log(node._tag) // "TomlInlineTable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlInlineTable extends S.TaggedClass<TomlInlineTable>($I`TomlInlineTable`)(
  "TomlInlineTable",
  {
    entries: S.Array(TomlInlineEntry),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlInlineTable", {
    description: "A TOML inline table value node; may span multiple lines since TOML 1.1.",
  })
) {
  static readonly is = S.is(TomlInlineTable);
}

/**
 * A discriminated-union schema covering all seven TOML value node types.
 * Defined lazily via `S.suspend` to break the recursive reference chain
 * `TomlValueNode → TomlArray/TomlInlineTable → TomlValueNode`.
 *
 * **Example** (Guard a value node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlBoolean, TomlValueNode } from "@beep/scratchpad/toml"
 *
 * const node = new TomlBoolean({ value: true, offset: 0, length: 4 })
 * console.log(S.is(TomlValueNode)(node)) // true
 * console.log(S.is(TomlValueNode)({ value: true })) // false
 * ```
 *
 * @see {@link TomlExpression} for the document-level expression union.
 * @category schemas
 * @since 0.0.0
 */
export const TomlValueNode: S.Codec<
  TomlString | TomlInteger | TomlFloat | TomlBoolean | TomlDateTimeLiteral | TomlArray | TomlInlineTable
> = S.suspend(() =>
  S.Union([TomlString, TomlInteger, TomlFloat, TomlBoolean, TomlDateTimeLiteral, TomlArray, TomlInlineTable])
).pipe(
  $I.annoteSchema("TomlValueNode", {
    description: "Discriminated union of the seven TOML value node types, defined lazily via S.suspend.",
  })
);

/**
 * The union of all TOML value node types.
 *
 * @see {@link TomlValueNode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type TomlValueNode =
  | TomlString
  | TomlInteger
  | TomlFloat
  | TomlBoolean
  | TomlDateTimeLiteral
  | TomlArray
  | TomlInlineTable;

/**
 * A `key = value` expression. The span starts at the first character of the
 * line's leading whitespace and ends after the terminating newline (or at
 * EOF); multi-line values extend it. `comment` holds the decoded trailing
 * comment (without `#`, one leading space stripped) when present.
 *
 * **Gotchas**
 *
 * Concatenating every expression's source slice reproduces the input
 * byte-for-byte. Comment consumers who prepend `#` will double-hash because
 * `comment` already strips the marker and one leading space.
 *
 * **Example** (Construct a key-value expression)
 *
 * ```ts
 * import { TomlInteger, TomlKey, TomlKeyValue } from "@beep/scratchpad/toml"
 *
 * const expr = new TomlKeyValue({
 *   keyPath: [new TomlKey({ value: "age", kind: "bare", offset: 0, length: 3 })],
 *   value: new TomlInteger({ value: 30, offset: 6, length: 2 }),
 *   offset: 0,
 *   length: 9,
 * })
 * console.log(expr._tag) // "TomlKeyValue"
 * console.log(expr.value._tag) // "TomlInteger"
 * ```
 *
 * @see {@link TomlDocument} for the lossless document that stores these expressions.
 * @category models
 * @since 0.0.0
 */
export class TomlKeyValue extends S.TaggedClass<TomlKeyValue>($I`TomlKeyValue`)(
  "TomlKeyValue",
  {
    keyPath: S.Array(TomlKey),
    value: S.suspend((): S.Codec<TomlValueNode> => TomlValueNode),
    comment: S.optionalKey(S.String),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlKeyValue", {
    description: "A key = value expression whose span includes leading whitespace and the terminating newline.",
  })
) {
  static readonly is = S.is(TomlKeyValue);
}

/**
 * A `[table]` header expression. Span contract as in {@link TomlKeyValue}.
 *
 * **Example** (Construct a table header)
 *
 * ```ts
 * import { TomlKey, TomlTableHeader } from "@beep/scratchpad/toml"
 *
 * const header = new TomlTableHeader({
 *   keyPath: [new TomlKey({ value: "owner", kind: "bare", offset: 1, length: 5 })],
 *   offset: 0,
 *   length: 8,
 * })
 * console.log(header._tag) // "TomlTableHeader"
 * console.log(header.keyPath[0]?.value) // "owner"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlTableHeader extends S.TaggedClass<TomlTableHeader>($I`TomlTableHeader`)(
  "TomlTableHeader",
  {
    keyPath: S.Array(TomlKey),
    comment: S.optionalKey(S.String),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlTableHeader", {
    description: "A [table] header expression with the same span contract as TomlKeyValue.",
  })
) {
  static readonly is = S.is(TomlTableHeader);
}

/**
 * A `[[array-of-tables]]` header expression. Span contract as in
 * {@link TomlKeyValue}.
 *
 * **Example** (Construct an array-of-tables header)
 *
 * ```ts
 * import { TomlArrayTableHeader, TomlKey } from "@beep/scratchpad/toml"
 *
 * const header = new TomlArrayTableHeader({
 *   keyPath: [new TomlKey({ value: "products", kind: "bare", offset: 2, length: 8 })],
 *   offset: 0,
 *   length: 14,
 * })
 * console.log(header._tag) // "TomlArrayTableHeader"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlArrayTableHeader extends S.TaggedClass<TomlArrayTableHeader>($I`TomlArrayTableHeader`)(
  "TomlArrayTableHeader",
  {
    keyPath: S.Array(TomlKey),
    comment: S.optionalKey(S.String),
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlArrayTableHeader", {
    description: "A [[array-of-tables]] header expression with the same span contract as TomlKeyValue.",
  })
) {
  static readonly is = S.is(TomlArrayTableHeader);
}

/**
 * A run of consecutive blank and comment-only lines, coalesced into one
 * expression. `text` is the raw source slice, newlines included.
 *
 * **Example** (Construct a trivia run)
 *
 * ```ts
 * import { TomlTrivia } from "@beep/scratchpad/toml"
 *
 * const trivia = new TomlTrivia({ text: "# heading\n\n", offset: 0, length: 11 })
 * console.log(trivia._tag) // "TomlTrivia"
 * console.log(trivia.text.startsWith("#")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TomlTrivia extends S.TaggedClass<TomlTrivia>($I`TomlTrivia`)(
  "TomlTrivia",
  {
    text: S.String,
    offset: S.Finite,
    length: S.Finite,
  },
  $I.annote("TomlTrivia", {
    description: "A coalesced run of blank and comment-only lines whose text is the raw source slice.",
  })
) {
  static readonly is = S.is(TomlTrivia);
}

/**
 * The union schema of the four expression types making up a document's
 * linear CST.
 *
 * **Example** (Guard an expression node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlExpression, TomlTrivia } from "@beep/scratchpad/toml"
 *
 * const trivia = new TomlTrivia({ text: "\n", offset: 0, length: 1 })
 * console.log(S.is(TomlExpression)(trivia)) // true
 * ```
 *
 * @see {@link TomlDocument} for the lossless document that stores this expression list.
 * @category schemas
 * @since 0.0.0
 */
export const TomlExpression = S.Union([TomlKeyValue, TomlTableHeader, TomlArrayTableHeader, TomlTrivia]).pipe(
  $I.annoteSchema("TomlExpression", {
    description: "Union of the four expression types making up a document's linear CST.",
  })
);

/**
 * The union of all expression node types.
 *
 * @see {@link TomlExpression} for the runtime schema and decoding behavior.
 * @see {@link TomlDocument} for the lossless document that stores this expression list.
 * @category type-level
 * @since 0.0.0
 */
export type TomlExpression = typeof TomlExpression.Type;

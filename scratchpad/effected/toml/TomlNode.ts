// The lossless linear CST: a TOML document is a flat list of expressions
// (key-values, table headers, array-of-table headers and trivia runs) whose
// source spans tile the document exactly — concatenating every expression's
// source slice in order reproduces the input byte-for-byte. Value nodes
// recurse only through arrays and inline tables, handled with the
// `Schema.suspend` idiom (the `packages/yaml/src/YamlNode.ts` precedent).
//
// Leaf module: imports only `effect` and `./TomlDateTime.js`.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "./TomlDateTime.ts";

const $I = $ScratchpadId.create("effected/toml/TomlNode");

const NonFiniteSpelling = LiteralKit(["Infinity", "-Infinity", "NaN"]).pipe(
	$I.annoteSchema("NonFiniteSpelling", { description: "String spellings of non-finite IEEE numbers used by the JSON and string-tree codecs." }),
);
const spellNonFinite = (n: number) => (Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity");
const fromJsonSpelling = SchemaTransformation.transform<number, number | typeof NonFiniteSpelling.Type>({
	decode: (value) => (P.isNumber(value) ? value : Number(value)),
	encode: (n) => (Number.isFinite(n) ? n : spellNonFinite(n)),
});
const jsonLink = () => S.link<number>()(S.Union([S.Finite, NonFiniteSpelling]), fromJsonSpelling);
const stringTreeLink = () =>
	S.link<number>()(S.Union([S.String.check(S.isStringFinite()), NonFiniteSpelling]), SchemaTransformation.numberFromString);

/** Any JavaScript number, including `NaN`, `Infinity` and `-Infinity`. */
const IeeeNumber = S.declare(P.isNumber, {
	expected: "number",
	toCodecJson: jsonLink,
	toCodecStringTree: stringTreeLink,
	toCodecArbitrary: jsonLink,
}).pipe($I.annoteSchema("IeeeNumber", { description: "Any JavaScript number, including NaN and positive or negative infinity, with non-finite codec spellings." }));

/**
 * The three simple-key spellings: `bare`, `basic` (`"..."`) and `literal`
 * (`'...'`).
 *
 * **Example** (Validate a quoted key kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlKeyKind } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * console.log(S.is(TomlKeyKind)("basic")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlKeyKind = LiteralKit(["bare", "basic", "literal"]).pipe($I.annoteSchema("TomlKeyKind", { description: "The three simple-key spellings: `bare`, `basic` (`\"...\"`) and `literal` (`'...'`)." }));

/**
 * The union of all key-kind string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlKeyKind = typeof TomlKeyKind.Type;

/**
 * One simple key within a (possibly dotted) key path.
 *
 * **Details**
 *
 * - `value` — the decoded key text (escapes resolved, quotes stripped).
 * - `kind` — how the key was spelled in the source.
 * - `offset` / `length` — the key's span in the source, quotes included.
 *
 * **Example** (Preserve a quoted key span)
 *
 * ```ts
 * import { TomlKey } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const key = TomlKey.make({ value: "name", kind: "basic", offset: 0, length: 6 })
 * console.log(key.value, key.length) // name 6
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlKey extends S.TaggedClass<TomlKey>($I`TomlKey`)("TomlKey", {
	value: S.String.annotateKey({ description: "Decoded key text with escapes resolved and surrounding quotes removed" }),
	kind: TomlKeyKind.annotateKey({ description: "Source spelling of the key: `bare`, `basic` for double quotes, or `literal` for single quotes" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the key in the source, measured in UTF-16 code units and including any opening quote" }),
	length: S.Finite.annotateKey({ description: "Source span of the key in UTF-16 code units, including any surrounding quotes" }),
}, $I.annote("TomlKey", { description: "One simple key within a (possibly dotted) key path." })) {}

/**
 * The four TOML string forms.
 *
 * **Example** (Validate a multiline string style)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlStringStyle } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * console.log(S.is(TomlStringStyle)("multiline-literal")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlStringStyle = LiteralKit(["basic", "literal", "multiline-basic", "multiline-literal"]).pipe($I.annoteSchema("TomlStringStyle", { description: "The four TOML string forms." }));

/**
 * The union of all string-style literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlStringStyle = typeof TomlStringStyle.Type;

/**
 * A string value node. `value` is the decoded text; the raw spelling lives in
 * the source span.
 *
 * **Example** (Read decoded string text)
 *
 * ```ts
 * import { TomlString } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const node = TomlString.make({ value: "hello", style: "basic", offset: 0, length: 7 })
 * console.log(node.value) // hello
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlString extends S.TaggedClass<TomlString>($I`TomlString`)("TomlString", {
	value: S.String.annotateKey({ description: "Decoded string text after applying the source form's escape, newline, and whitespace rules" }),
	style: TomlStringStyle.annotateKey({ description: "Source string form: basic or literal, each with a single-line or multiline spelling" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the opening string delimiter in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the string in UTF-16 code units, including opening and closing delimiters" }),
}, $I.annote("TomlString", { description: "A string value node. `value` is the decoded text; the raw spelling lives in the source span." })) {}

/**
 * An integer value node. Decodes to `number` when the magnitude fits in
 * 2^53 - 1, else `bigint` (TOML integers span the full signed 64-bit range).
 *
 * **Example** (Preserve an integer beyond safe precision)
 *
 * ```ts
 * import { TomlInteger } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const node = TomlInteger.make({ value: 9007199254740993n, offset: 0, length: 16 })
 * console.log(node.value.toString()) // 9007199254740993
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlInteger extends S.TaggedClass<TomlInteger>($I`TomlInteger`)("TomlInteger", {
	value: S.Union([S.Finite, S.BigInt]).annotateKey({ description: "Decoded integer within TOML's signed 64-bit range, preserving exact precision beyond the safe integer range" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the integer token in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the integer token in UTF-16 code units, including any sign, base prefix, and underscores" }),
}, $I.annote("TomlInteger", { description: "An integer value node. Decodes to `number` when the magnitude fits in 2^53 - 1, else `bigint` (TOML integers span the full signed 64-bit range)." })) {}

/**
 * A float value node, including the special spellings (`inf`, `nan`).
 *
 * **Example** (Represent positive infinity)
 *
 * ```ts
 * import { TomlFloat } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const node = TomlFloat.make({ value: Infinity, offset: 0, length: 3 })
 * console.log(node.value) // Infinity
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlFloat extends S.TaggedClass<TomlFloat>($I`TomlFloat`)("TomlFloat", {
	value: IeeeNumber.annotateKey({ description: "Decoded floating-point value, including positive or negative infinity and NaN" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the float token in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the float token in UTF-16 code units, including any sign, exponent, and underscores" }),
}, $I.annote("TomlFloat", { description: "A float value node, including the special spellings (`inf`, `nan`)." })) {}

/**
 * A boolean value node.
 *
 * **Example** (Read a boolean literal)
 *
 * ```ts
 * import { TomlBoolean } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const node = TomlBoolean.make({ value: true, offset: 0, length: 4 })
 * console.log(node.value) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlBoolean extends S.TaggedClass<TomlBoolean>($I`TomlBoolean`)("TomlBoolean", {
	value: S.Boolean.annotateKey({ description: "Decoded truth value of the source literal `true` or `false`" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the boolean token in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the boolean token in UTF-16 code units" }),
}, $I.annote("TomlBoolean", { description: "A boolean value node." })) {}

/**
 * A date-time value node wrapping one of the four TOML date-time classes.
 *
 * **Example** (Wrap a local calendar date)
 *
 * ```ts
 * import { TomlDateTimeLiteral } from "@beep/scratchpad/effected/toml/TomlNode"
 * import { TomlLocalDate } from "@beep/scratchpad/effected/toml/TomlDateTime"
 *
 * const node = TomlDateTimeLiteral.make({
 *   value: TomlLocalDate.make({ year: 2026, month: 10, day: 9 }),
 *   offset: 0,
 *   length: 10
 * })
 * console.log(node.value.toString()) // 2026-10-09
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlDateTimeLiteral extends S.TaggedClass<TomlDateTimeLiteral>($I`TomlDateTimeLiteral`)("TomlDateTimeLiteral", {
	value: S.Union([TomlOffsetDateTime, TomlLocalDateTime, TomlLocalDate, TomlLocalTime]).annotateKey({ description: "Decoded calendar value preserving whether the literal represents an offset date-time, local date-time, local date, or local time" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the date-time token in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the date-time token in UTF-16 code units, including any fractional seconds and UTC offset" }),
}, $I.annote("TomlDateTimeLiteral", { description: "A date-time value node wrapping one of the four TOML date-time classes." })) {}

/**
 * An array value node. Heterogeneous per TOML; may span multiple lines
 * (the span covers brackets, inner newlines and inner comments).
 *
 * **Example** (Keep mixed array values in source order)
 *
 * ```ts
 * import { TomlArray, TomlBoolean, TomlInteger } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const node = TomlArray.make({
 *   items: [
 *     TomlInteger.make({ value: 1, offset: 1, length: 1 }),
 *     TomlBoolean.make({ value: true, offset: 4, length: 4 })
 *   ],
 *   offset: 0,
 *   length: 9
 * })
 * console.log(node.items.map((item) => item._tag).join(", ")) // TomlInteger, TomlBoolean
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlArray extends S.TaggedClass<TomlArray>($I`TomlArray`)("TomlArray", {
	items: S.Array(S.suspend((): S.Codec<TomlValueNode> => TomlValueNode)).annotateKey({ description: "Parsed array values in source order, allowing mixed TOML value kinds" }),
	offset: S.Finite.annotateKey({ description: "Zero-based position of the opening array bracket in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the array in UTF-16 code units, including brackets, inner whitespace, newlines, and comments" }),
}, $I.annote("TomlArray", { description: "An array value node. Heterogeneous per TOML; may span multiple lines (the span covers brackets, inner newlines and inner comments)." })) {}

/**
 * One `key = value` entry inside an inline table. `keyPath` has more than one
 * element for dotted keys (`{a.b = 1}`).
 *
 * **Example** (Represent a dotted inline key)
 *
 * ```ts
 * import { TomlInlineEntry, TomlInteger, TomlKey } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const entry = TomlInlineEntry.make({
 *   keyPath: [
 *     TomlKey.make({ value: "a", kind: "bare", offset: 1, length: 1 }),
 *     TomlKey.make({ value: "b", kind: "bare", offset: 3, length: 1 })
 *   ],
 *   value: TomlInteger.make({ value: 1, offset: 7, length: 1 }),
 *   offset: 1,
 *   length: 7
 * })
 * console.log(entry.keyPath.map((key) => key.value).join(".")) // a.b
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlInlineEntry extends S.TaggedClass<TomlInlineEntry>($I`TomlInlineEntry`)("TomlInlineEntry", {
	keyPath: S.Array(TomlKey).annotateKey({ description: "Ordered key segments locating the entry within its inline table, with multiple segments for dotted keys" }),
	value: S.suspend((): S.Codec<TomlValueNode> => TomlValueNode).annotateKey({ description: "Parsed TOML value assigned to the entry's key path inside the inline table" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the entry's first key in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span from the first key through the value in UTF-16 code units, excluding trailing separators and comments" }),
}, $I.annote("TomlInlineEntry", { description: "One `key = value` entry inside an inline table. `keyPath` has more than one element for dotted keys (`{a.b = 1}`)." })) {}

/**
 * An inline table value node (`{ k = v, ... }`). May span multiple lines
 * since TOML 1.1 (the span covers braces, inner newlines and inner comments).
 *
 * **Example** (Construct an empty inline table)
 *
 * ```ts
 * import { TomlInlineTable } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const node = TomlInlineTable.make({ entries: [], offset: 0, length: 2 })
 * console.log(node.entries.length) // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlInlineTable extends S.TaggedClass<TomlInlineTable>($I`TomlInlineTable`)("TomlInlineTable", {
	entries: S.Array(TomlInlineEntry).annotateKey({ description: "Parsed key-value entries in source order within the inline table" }),
	offset: S.Finite.annotateKey({ description: "Zero-based position of the opening inline-table brace in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the inline table in UTF-16 code units, including braces, inner whitespace, newlines, and comments" }),
}, $I.annote("TomlInlineTable", { description: "An inline table value node (`{ k = v, ... }`). May span multiple lines since TOML 1.1 (the span covers braces, inner newlines and inner comments)." })) {}

/**
 * A discriminated-union schema covering all seven TOML value node types.
 *
 * **Details**
 *
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `TomlValueNode → TomlArray/TomlInlineTable → TomlValueNode`.
 *
 * **Example** (Validate a recursive array node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlArray, TomlBoolean, TomlValueNode } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const node = TomlArray.make({
 *   items: [TomlBoolean.make({ value: true, offset: 1, length: 4 })],
 *   offset: 0,
 *   length: 6
 * })
 * console.log(S.is(TomlValueNode)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlValueNode: S.Codec<
	TomlString | TomlInteger | TomlFloat | TomlBoolean | TomlDateTimeLiteral | TomlArray | TomlInlineTable
> = S.suspend(() =>
	S.Union([TomlString, TomlInteger, TomlFloat, TomlBoolean, TomlDateTimeLiteral, TomlArray, TomlInlineTable]),
).pipe($I.annoteSchema("TomlValueNode", { description: "A recursively suspended union of all seven TOML value node types, including arrays and inline tables." }));

/**
 * The union of all TOML value node types.
 *
 * @public
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
 * **Example** (Retain an assignment comment)
 *
 * ```ts
 * import { TomlBoolean, TomlKey, TomlKeyValue } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const expression = TomlKeyValue.make({
 *   keyPath: [TomlKey.make({ value: "enabled", kind: "bare", offset: 0, length: 7 })],
 *   value: TomlBoolean.make({ value: true, offset: 10, length: 4 }),
 *   comment: "active",
 *   offset: 0,
 *   length: 24
 * })
 * console.log(expression.comment) // active
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlKeyValue extends S.TaggedClass<TomlKeyValue>($I`TomlKeyValue`)("TomlKeyValue", {
	keyPath: S.Array(TomlKey).annotateKey({ description: "Ordered key segments locating the assignment relative to the current table, with multiple segments for dotted keys" }),
	value: S.suspend((): S.Codec<TomlValueNode> => TomlValueNode).annotateKey({ description: "Parsed TOML value assigned to the expression's key path" }),
	comment: S.optionalKey(S.String).annotateKey({ description: "Optional trailing comment text with `#` removed and one leading space stripped" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the assignment's line in UTF-16 code units, including leading whitespace and any initial BOM" }),
	length: S.Finite.annotateKey({ description: "Source span of the assignment in UTF-16 code units, including leading whitespace, multiline values, trailing comment, and terminating newline" }),
}, $I.annote("TomlKeyValue", { description: "A `key = value` expression. The span starts at the first character of the line's leading whitespace and ends after the terminating newline (or at EOF); multi-line values extend it. `comment` holds the decoded trailing comment (without `#`, one leading space stripped) when present." })) {}

/**
 * A `[table]` header expression. Span contract as in {@link TomlKeyValue}.
 *
 * **Example** (Locate a named table)
 *
 * ```ts
 * import { TomlKey, TomlTableHeader } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const header = TomlTableHeader.make({
 *   keyPath: [TomlKey.make({ value: "server", kind: "bare", offset: 1, length: 6 })],
 *   offset: 0,
 *   length: 9
 * })
 * console.log(header.keyPath.map((key) => key.value).join(".")) // server
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlTableHeader extends S.TaggedClass<TomlTableHeader>($I`TomlTableHeader`)("TomlTableHeader", {
	keyPath: S.Array(TomlKey).annotateKey({ description: "Ordered key segments locating the table from the document root" }),
	comment: S.optionalKey(S.String).annotateKey({ description: "Optional trailing header comment text with `#` removed and one leading space stripped" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the header's line in UTF-16 code units, including leading whitespace and any initial BOM" }),
	length: S.Finite.annotateKey({ description: "Source span of the table header in UTF-16 code units, including leading whitespace, trailing comment, and terminating newline" }),
}, $I.annote("TomlTableHeader", { description: "A `[table]` header expression. Span contract as in TomlKeyValue." })) {}

/**
 * A `[[array-of-tables]]` header expression. Span contract as in
 * {@link TomlKeyValue}.
 *
 * **Example** (Locate an array of tables)
 *
 * ```ts
 * import { TomlArrayTableHeader, TomlKey } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const header = TomlArrayTableHeader.make({
 *   keyPath: [TomlKey.make({ value: "products", kind: "bare", offset: 2, length: 8 })],
 *   offset: 0,
 *   length: 13
 * })
 * console.log(header.keyPath.map((key) => key.value).join(".")) // products
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlArrayTableHeader extends S.TaggedClass<TomlArrayTableHeader>($I`TomlArrayTableHeader`)("TomlArrayTableHeader", {
	keyPath: S.Array(TomlKey).annotateKey({ description: "Ordered key segments locating the array of tables from the document root, where this header opens a new element" }),
	comment: S.optionalKey(S.String).annotateKey({ description: "Optional trailing header comment text with `#` removed and one leading space stripped" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the header's line in UTF-16 code units, including leading whitespace and any initial BOM" }),
	length: S.Finite.annotateKey({ description: "Source span of the array-of-tables header in UTF-16 code units, including leading whitespace, trailing comment, and terminating newline" }),
}, $I.annote("TomlArrayTableHeader", { description: "A `[[array-of-tables]]` header expression. Span contract as in TomlKeyValue." })) {}

/**
 * A run of consecutive blank and comment-only lines, coalesced into one
 * expression. `text` is the raw source slice, newlines included.
 *
 * **Example** (Retain comment and blank lines)
 *
 * ```ts
 * import { TomlTrivia } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const trivia = TomlTrivia.make({ text: "# note\n\n", offset: 0, length: 8 })
 * console.log(trivia.text.length) // 8
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlTrivia extends S.TaggedClass<TomlTrivia>($I`TomlTrivia`)("TomlTrivia", {
	text: S.String.annotateKey({ description: "Raw source text of consecutive blank and comment-only lines, preserving whitespace and newlines" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start of the blank or comment-only run in the source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span of the blank or comment-only run in UTF-16 code units, including whitespace and newlines" }),
}, $I.annote("TomlTrivia", { description: "A run of consecutive blank and comment-only lines, coalesced into one expression. `text` is the raw source slice, newlines included." })) {}

/**
 * The union schema of the four expression types making up a document's
 * linear CST.
 *
 * **Example** (Recognize a trivia expression)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TomlExpression, TomlTrivia } from "@beep/scratchpad/effected/toml/TomlNode"
 *
 * const trivia = TomlTrivia.make({ text: "\n", offset: 0, length: 1 })
 * console.log(S.is(TomlExpression)(trivia)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlExpression = S.Union([TomlKeyValue, TomlTableHeader, TomlArrayTableHeader, TomlTrivia]).pipe($I.annoteSchema("TomlExpression", { description: "The union schema of the four expression types making up a document's linear CST." }));

/**
 * The union of all expression node types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlExpression = typeof TomlExpression.Type;

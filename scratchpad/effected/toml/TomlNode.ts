// The lossless linear CST: a TOML document is a flat list of expressions
// (key-values, table headers, array-of-table headers and trivia runs) whose
// source spans tile the document exactly — concatenating every expression's
// source slice in order reproduces the input byte-for-byte. Value nodes
// recurse only through arrays and inline tables, handled with the
// `Schema.suspend` idiom (the `packages/yaml/src/YamlNode.ts` precedent).
//
// Leaf module: imports only `effect` and `./TomlDateTime.js`.

import { Schema } from "effect";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "./TomlDateTime.ts";

/**
 * The three simple-key spellings: `bare`, `basic` (`"..."`) and `literal`
 * (`'...'`).
 *
 * @public
 */
export const TomlKeyKind = Schema.Literals(["bare", "basic", "literal"]);

/**
 * The union of all key-kind string literals.
 *
 * @public
 */
export type TomlKeyKind = typeof TomlKeyKind.Type;

/**
 * One simple key within a (possibly dotted) key path.
 *
 * - `value` — the decoded key text (escapes resolved, quotes stripped).
 * - `kind` — how the key was spelled in the source.
 * - `offset` / `length` — the key's span in the source, quotes included.
 *
 * @public
 */
export class TomlKey extends Schema.TaggedClass<TomlKey>()("TomlKey", {
	value: Schema.String,
	kind: TomlKeyKind,
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * The four TOML string forms.
 *
 * @public
 */
export const TomlStringStyle = Schema.Literals(["basic", "literal", "multiline-basic", "multiline-literal"]);

/**
 * The union of all string-style literals.
 *
 * @public
 */
export type TomlStringStyle = typeof TomlStringStyle.Type;

/**
 * A string value node. `value` is the decoded text; the raw spelling lives in
 * the source span.
 *
 * @public
 */
export class TomlString extends Schema.TaggedClass<TomlString>()("TomlString", {
	value: Schema.String,
	style: TomlStringStyle,
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * An integer value node. Decodes to `number` when the magnitude fits in
 * 2^53 - 1, else `bigint` (TOML integers span the full signed 64-bit range).
 *
 * @public
 */
export class TomlInteger extends Schema.TaggedClass<TomlInteger>()("TomlInteger", {
	value: Schema.Union([Schema.Number, Schema.BigInt]),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A float value node, including the special spellings (`inf`, `nan`).
 *
 * @public
 */
export class TomlFloat extends Schema.TaggedClass<TomlFloat>()("TomlFloat", {
	value: Schema.Number,
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A boolean value node.
 *
 * @public
 */
export class TomlBoolean extends Schema.TaggedClass<TomlBoolean>()("TomlBoolean", {
	value: Schema.Boolean,
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A date-time value node wrapping one of the four TOML date-time classes.
 *
 * @public
 */
export class TomlDateTimeLiteral extends Schema.TaggedClass<TomlDateTimeLiteral>()("TomlDateTimeLiteral", {
	value: Schema.Union([TomlOffsetDateTime, TomlLocalDateTime, TomlLocalDate, TomlLocalTime]),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * An array value node. Heterogeneous per TOML; may span multiple lines
 * (the span covers brackets, inner newlines and inner comments).
 *
 * @public
 */
export class TomlArray extends Schema.TaggedClass<TomlArray>()("TomlArray", {
	items: Schema.Array(Schema.suspend((): Schema.Codec<TomlValueNode> => TomlValueNode)),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * One `key = value` entry inside an inline table. `keyPath` has more than one
 * element for dotted keys (`{a.b = 1}`).
 *
 * @public
 */
export class TomlInlineEntry extends Schema.TaggedClass<TomlInlineEntry>()("TomlInlineEntry", {
	keyPath: Schema.Array(TomlKey),
	value: Schema.suspend((): Schema.Codec<TomlValueNode> => TomlValueNode),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * An inline table value node (`{ k = v, ... }`). May span multiple lines
 * since TOML 1.1 (the span covers braces, inner newlines and inner comments).
 *
 * @public
 */
export class TomlInlineTable extends Schema.TaggedClass<TomlInlineTable>()("TomlInlineTable", {
	entries: Schema.Array(TomlInlineEntry),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A discriminated-union schema covering all seven TOML value node types.
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `TomlValueNode → TomlArray/TomlInlineTable → TomlValueNode`.
 *
 * @public
 */
export const TomlValueNode: Schema.Codec<
	TomlString | TomlInteger | TomlFloat | TomlBoolean | TomlDateTimeLiteral | TomlArray | TomlInlineTable
> = Schema.suspend(() =>
	Schema.Union([TomlString, TomlInteger, TomlFloat, TomlBoolean, TomlDateTimeLiteral, TomlArray, TomlInlineTable]),
);

/**
 * The union of all TOML value node types.
 *
 * @public
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
 * @public
 */
export class TomlKeyValue extends Schema.TaggedClass<TomlKeyValue>()("TomlKeyValue", {
	keyPath: Schema.Array(TomlKey),
	value: Schema.suspend((): Schema.Codec<TomlValueNode> => TomlValueNode),
	comment: Schema.optionalKey(Schema.String),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A `[table]` header expression. Span contract as in {@link TomlKeyValue}.
 *
 * @public
 */
export class TomlTableHeader extends Schema.TaggedClass<TomlTableHeader>()("TomlTableHeader", {
	keyPath: Schema.Array(TomlKey),
	comment: Schema.optionalKey(Schema.String),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A `[[array-of-tables]]` header expression. Span contract as in
 * {@link TomlKeyValue}.
 *
 * @public
 */
export class TomlArrayTableHeader extends Schema.TaggedClass<TomlArrayTableHeader>()("TomlArrayTableHeader", {
	keyPath: Schema.Array(TomlKey),
	comment: Schema.optionalKey(Schema.String),
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A run of consecutive blank and comment-only lines, coalesced into one
 * expression. `text` is the raw source slice, newlines included.
 *
 * @public
 */
export class TomlTrivia extends Schema.TaggedClass<TomlTrivia>()("TomlTrivia", {
	text: Schema.String,
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * The union schema of the four expression types making up a document's
 * linear CST.
 *
 * @public
 */
export const TomlExpression = Schema.Union([TomlKeyValue, TomlTableHeader, TomlArrayTableHeader, TomlTrivia]);

/**
 * The union of all expression node types.
 *
 * @public
 */
export type TomlExpression = typeof TomlExpression.Type;

// The lossless linear CST: a TOML document is a flat list of expressions
// (key-values, table headers, array-of-table headers and trivia runs) whose
// source spans tile the document exactly — concatenating every expression's
// source slice in order reproduces the input byte-for-byte. Value nodes
// recurse only through arrays and inline tables, handled with the
// `Schema.suspend` idiom (the `packages/yaml/src/YamlNode.ts` precedent).
//
// Leaf module: imports only `effect` and `./TomlDateTime.js`.

import * as S from "effect/Schema";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "./TomlDateTime.ts";

/**
 * The three simple-key spellings: `bare`, `basic` (`"..."`) and `literal`
 * (`'...'`).
 *
 * @public
 */
export const TomlKeyKind = S.Literals(["bare", "basic", "literal"]);

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
export class TomlKey extends S.TaggedClass<TomlKey>()("TomlKey", {
	value: S.String,
	kind: TomlKeyKind,
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * The four TOML string forms.
 *
 * @public
 */
export const TomlStringStyle = S.Literals(["basic", "literal", "multiline-basic", "multiline-literal"]);

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
export class TomlString extends S.TaggedClass<TomlString>()("TomlString", {
	value: S.String,
	style: TomlStringStyle,
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * An integer value node. Decodes to `number` when the magnitude fits in
 * 2^53 - 1, else `bigint` (TOML integers span the full signed 64-bit range).
 *
 * @public
 */
export class TomlInteger extends S.TaggedClass<TomlInteger>()("TomlInteger", {
	value: S.Union([S.Finite, S.BigInt]),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * A float value node, including the special spellings (`inf`, `nan`).
 *
 * @public
 */
export class TomlFloat extends S.TaggedClass<TomlFloat>()("TomlFloat", {
	// A TOML float may be `inf` or `nan`, so the finite-only schema would reject valid documents.
	// @effect-diagnostics-next-line schemaNumber:off
	value: S.Number,
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * A boolean value node.
 *
 * @public
 */
export class TomlBoolean extends S.TaggedClass<TomlBoolean>()("TomlBoolean", {
	value: S.Boolean,
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * A date-time value node wrapping one of the four TOML date-time classes.
 *
 * @public
 */
export class TomlDateTimeLiteral extends S.TaggedClass<TomlDateTimeLiteral>()("TomlDateTimeLiteral", {
	value: S.Union([TomlOffsetDateTime, TomlLocalDateTime, TomlLocalDate, TomlLocalTime]),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * An array value node. Heterogeneous per TOML; may span multiple lines
 * (the span covers brackets, inner newlines and inner comments).
 *
 * @public
 */
export class TomlArray extends S.TaggedClass<TomlArray>()("TomlArray", {
	items: S.Array(S.suspend((): S.Codec<TomlValueNode> => TomlValueNode)),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * One `key = value` entry inside an inline table. `keyPath` has more than one
 * element for dotted keys (`{a.b = 1}`).
 *
 * @public
 */
export class TomlInlineEntry extends S.TaggedClass<TomlInlineEntry>()("TomlInlineEntry", {
	keyPath: S.Array(TomlKey),
	value: S.suspend((): S.Codec<TomlValueNode> => TomlValueNode),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * An inline table value node (`{ k = v, ... }`). May span multiple lines
 * since TOML 1.1 (the span covers braces, inner newlines and inner comments).
 *
 * @public
 */
export class TomlInlineTable extends S.TaggedClass<TomlInlineTable>()("TomlInlineTable", {
	entries: S.Array(TomlInlineEntry),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * A discriminated-union schema covering all seven TOML value node types.
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `TomlValueNode → TomlArray/TomlInlineTable → TomlValueNode`.
 *
 * @public
 */
export const TomlValueNode: S.Codec<
	TomlString | TomlInteger | TomlFloat | TomlBoolean | TomlDateTimeLiteral | TomlArray | TomlInlineTable
> = S.suspend(() =>
	S.Union([TomlString, TomlInteger, TomlFloat, TomlBoolean, TomlDateTimeLiteral, TomlArray, TomlInlineTable]),
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
export class TomlKeyValue extends S.TaggedClass<TomlKeyValue>()("TomlKeyValue", {
	keyPath: S.Array(TomlKey),
	value: S.suspend((): S.Codec<TomlValueNode> => TomlValueNode),
	comment: S.optionalKey(S.String),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * A `[table]` header expression. Span contract as in {@link TomlKeyValue}.
 *
 * @public
 */
export class TomlTableHeader extends S.TaggedClass<TomlTableHeader>()("TomlTableHeader", {
	keyPath: S.Array(TomlKey),
	comment: S.optionalKey(S.String),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * A `[[array-of-tables]]` header expression. Span contract as in
 * {@link TomlKeyValue}.
 *
 * @public
 */
export class TomlArrayTableHeader extends S.TaggedClass<TomlArrayTableHeader>()("TomlArrayTableHeader", {
	keyPath: S.Array(TomlKey),
	comment: S.optionalKey(S.String),
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * A run of consecutive blank and comment-only lines, coalesced into one
 * expression. `text` is the raw source slice, newlines included.
 *
 * @public
 */
export class TomlTrivia extends S.TaggedClass<TomlTrivia>()("TomlTrivia", {
	text: S.String,
	offset: S.Finite,
	length: S.Finite,
}) {}

/**
 * The union schema of the four expression types making up a document's
 * linear CST.
 *
 * @public
 */
export const TomlExpression = S.Union([TomlKeyValue, TomlTableHeader, TomlArrayTableHeader, TomlTrivia]);

/**
 * The union of all expression node types.
 *
 * @public
 */
export type TomlExpression = typeof TomlExpression.Type;

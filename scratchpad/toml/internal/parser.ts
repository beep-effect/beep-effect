// Recursive descent over the scanner producing the lossless linear CST.
// The load-bearing contract is the SPAN TILING INVARIANT: every expression's
// span starts at the first character of its line's leading whitespace (the
// BOM included, on the first line) and ends after its terminating newline (or
// at EOF); consecutive blank/comment-only lines coalesce into one TomlTrivia;
// concatenating every expression's source slice in order reproduces the
// source byte-exactly. Task 11's stringify rides on it.
//
// The one recursion surface is parseValue → parseArray/parseInlineTable,
// guarded by an explicit `depth` parameter against MAX_NESTING_DEPTH
// (GuardExceeded at the opening bracket). Everything else is a linear walk.

import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../TomlDateTime.ts";
import type { TomlExpression, TomlValueNode } from "../TomlNode.ts";
import {
	TomlArray,
	TomlArrayTableHeader,
	TomlBoolean,
	TomlDateTimeLiteral,
	TomlFloat,
	TomlInlineEntry,
	TomlInlineTable,
	TomlInteger,
	TomlKey,
	TomlKeyValue,
	TomlString,
	TomlTableHeader,
	TomlTrivia,
} from "../TomlNode.ts";
import type { TomlErrorCodeRaw } from "./diagnostics.ts";
import { RawTomlError } from "./diagnostics.ts";
import { GuardExceeded, MAX_NESTING_DEPTH } from "./limits.ts";
import {
	assertValidUnicode,
	classifyValueToken,
	scanBareKey,
	scanBasicString,
	scanComment,
	scanLiteralString,
	scanMultilineBasicString,
	scanMultilineLiteralString,
	scanNewline,
	scanValueToken,
	scanWhitespace,
	skipBom,
} from "./scanner.ts";

const LF = 0x0a;
const CR = 0x0d;
const QUOTE = 0x22;
const HASH = 0x23;
const APOSTROPHE = 0x27;
const COMMA = 0x2c;
const DOT = 0x2e;
const EQUALS = 0x3d;
const LEFT_BRACKET = 0x5b;
const RIGHT_BRACKET = 0x5d;
const LEFT_BRACE = 0x7b;
const RIGHT_BRACE = 0x7d;

const raise = (code: TomlErrorCodeRaw, message: string, offset: number, length: number): never => {
	throw new RawTomlError({ code, message, offset, length });
};

/** A parsed piece and the position after it. */
interface Parsed<T> {
	readonly node: T;
	readonly end: number;
}

/** Decoded trailing-comment text: the raw text after `#` with one leading space stripped. */
const decodeComment = (raw: string): string => (raw.startsWith(" ") ? raw.slice(1) : raw);

/** One simple key: bare, basic-quoted or literal-quoted. */
const parseSimpleKey = (source: string, pos: number): Parsed<TomlKey> => {
	const code = source.charCodeAt(pos);
	if (code === QUOTE) {
		const scanned = scanBasicString(source, pos);
		return {
			node: new TomlKey({ value: scanned.value, kind: "basic", offset: pos, length: scanned.end - pos }),
			end: scanned.end,
		};
	}
	if (code === APOSTROPHE) {
		const scanned = scanLiteralString(source, pos);
		return {
			node: new TomlKey({ value: scanned.value, kind: "literal", offset: pos, length: scanned.end - pos }),
			end: scanned.end,
		};
	}
	const bare = scanBareKey(source, pos);
	if (bare.end === pos) {
		return raise("ExpectedKey", "expected a key", pos, 1);
	}
	return { node: new TomlKey({ value: bare.value, kind: "bare", offset: pos, length: bare.end - pos }), end: bare.end };
};

/** A dotted key path: `simple-key ( ws "." ws simple-key )*`. */
const parseKeyPath = (source: string, pos: number): Parsed<ReadonlyArray<TomlKey>> => {
	const keys: Array<TomlKey> = [];
	const first = parseSimpleKey(source, pos);
	keys.push(first.node);
	let i = first.end;
	for (;;) {
		const afterWs = scanWhitespace(source, i);
		if (source.charCodeAt(afterWs) !== DOT) {
			break;
		}
		const keyStart = scanWhitespace(source, afterWs + 1);
		const next = parseSimpleKey(source, keyStart);
		keys.push(next.node);
		i = next.end;
	}
	return { node: keys, end: i };
};

/** The end of an expression line: ws + optional comment + newline (or EOF), else ExpectedNewline. */
const parseLineEnd = (source: string, pos: number): { readonly comment?: string; readonly end: number } => {
	let i = scanWhitespace(source, pos);
	let comment: string | undefined;
	if (source.charCodeAt(i) === HASH) {
		const scanned = scanComment(source, i);
		comment = decodeComment(scanned.value);
		i = scanned.end;
	}
	if (i >= source.length) {
		return { ...(comment !== undefined ? { comment } : {}), end: i };
	}
	const after = scanNewline(source, i);
	if (after === i) {
		return raise("ExpectedNewline", "expected a newline after the expression", i, 1);
	}
	return { ...(comment !== undefined ? { comment } : {}), end: after };
};

/**
 * Skip whitespace, newlines and comments inside array brackets or inline-table
 * braces — the grammar's `ws-comment-newline`, shared by both container
 * parsers since TOML 1.1 let inline tables span lines.
 */
const skipValueGap = (source: string, pos: number): number => {
	let i = pos;
	for (;;) {
		i = scanWhitespace(source, i);
		if (source.charCodeAt(i) === HASH) {
			i = scanComment(source, i).end;
			continue;
		}
		const after = scanNewline(source, i);
		if (after !== i) {
			i = after;
			continue;
		}
		return i;
	}
};

/** Whether a token that classified as `number` spells a float (never called on hex/oct/bin). */
const isFloatToken = (token: string): boolean =>
	!/^0[xob]/.test(token) && (/[.eE]/.test(token) || token.includes("inf") || token.includes("nan"));

/** An array value starting at `[`; `depth` is this array's own nesting count. */
const parseArray = (source: string, openPos: number, depth: number): Parsed<TomlArray> => {
	if (depth > MAX_NESTING_DEPTH) {
		throw new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, openPos);
	}
	const items: Array<TomlValueNode> = [];
	let i = openPos + 1;
	for (;;) {
		i = skipValueGap(source, i);
		if (i >= source.length) {
			raise("UnterminatedArray", "array not closed before end of input", openPos, i - openPos);
		}
		if (source.charCodeAt(i) === RIGHT_BRACKET) {
			i += 1;
			break;
		}
		const item = parseValue(source, i, depth);
		items.push(item.node);
		i = skipValueGap(source, item.end);
		const code = source.charCodeAt(i);
		if (code === COMMA) {
			i += 1;
			continue;
		}
		if (code === RIGHT_BRACKET) {
			i += 1;
			break;
		}
		if (i >= source.length) {
			raise("UnterminatedArray", "array not closed before end of input", openPos, i - openPos);
		}
		raise("UnterminatedArray", "expected , or ] in array", i, 1);
	}
	return { node: new TomlArray({ items, offset: openPos, length: i - openPos }), end: i };
};

/**
 * An inline table starting at `{`; `depth` is this table's own nesting count.
 * TOML 1.1 grammar: `ws-comment-newline` may sit before each key-value,
 * before each separator and before the closing brace, and a trailing comma is
 * allowed — but `keyval-sep` is still ws-only, so no newline may split a key
 * from its `=` or the `=` from its value.
 */
const parseInlineTable = (source: string, openPos: number, depth: number): Parsed<TomlInlineTable> => {
	if (depth > MAX_NESTING_DEPTH) {
		throw new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, depth, openPos);
	}
	const entries: Array<TomlInlineEntry> = [];
	let i = openPos + 1;
	for (;;) {
		i = skipValueGap(source, i);
		if (i >= source.length) {
			raise("UnterminatedInlineTable", "inline table not closed before end of input", openPos, i - openPos);
		}
		if (source.charCodeAt(i) === RIGHT_BRACE) {
			i += 1;
			break;
		}
		const entryStart = i;
		const keyPath = parseKeyPath(source, i);
		i = scanWhitespace(source, keyPath.end);
		if (source.charCodeAt(i) !== EQUALS) {
			raise("ExpectedEquals", "expected = after key", i, 1);
		}
		i = scanWhitespace(source, i + 1);
		const value = parseValue(source, i, depth);
		entries.push(
			new TomlInlineEntry({
				keyPath: keyPath.node,
				value: value.node,
				offset: entryStart,
				length: value.end - entryStart,
			}),
		);
		i = skipValueGap(source, value.end);
		const code = source.charCodeAt(i);
		if (code === RIGHT_BRACE) {
			i += 1;
			break;
		}
		if (code === COMMA) {
			i += 1;
			continue;
		}
		if (i >= source.length) {
			raise("UnterminatedInlineTable", "inline table not closed before end of input", openPos, i - openPos);
		}
		raise("UnterminatedInlineTable", "expected , or } in inline table", i, 1);
	}
	return { node: new TomlInlineTable({ entries, offset: openPos, length: i - openPos }), end: i };
};

/** Wrap a classified scalar token into its value node. */
const scalarNode = (source: string, pos: number): Parsed<TomlValueNode> => {
	const token = scanValueToken(source, pos);
	if (token.value === "") {
		return raise("ExpectedValue", "expected a value", pos, 1);
	}
	const scalar = classifyValueToken(token.value, pos);
	const length = token.end - pos;
	if (typeof scalar === "boolean") {
		return { node: new TomlBoolean({ value: scalar, offset: pos, length }), end: token.end };
	}
	if (typeof scalar === "bigint") {
		return { node: new TomlInteger({ value: scalar, offset: pos, length }), end: token.end };
	}
	if (typeof scalar === "number") {
		const node = isFloatToken(token.value)
			? new TomlFloat({ value: scalar, offset: pos, length })
			: new TomlInteger({ value: scalar, offset: pos, length });
		return { node, end: token.end };
	}
	if (
		scalar instanceof TomlOffsetDateTime ||
		scalar instanceof TomlLocalDateTime ||
		scalar instanceof TomlLocalDate ||
		scalar instanceof TomlLocalTime
	) {
		return { node: new TomlDateTimeLiteral({ value: scalar, offset: pos, length }), end: token.end };
	}
	// classifyValueToken never returns a plain string; unreachable backstop.
	return raise("InvalidValue", `${String(scalar)} is not a valid TOML value`, pos, length);
};

/** A value at `pos`; `depth` is the number of containers already enclosing it. */
const parseValue = (source: string, pos: number, depth: number): Parsed<TomlValueNode> => {
	const code = source.charCodeAt(pos);
	if (
		pos >= source.length ||
		code === LF ||
		code === CR ||
		code === HASH ||
		code === COMMA ||
		code === EQUALS ||
		code === RIGHT_BRACKET ||
		code === RIGHT_BRACE
	) {
		return raise("ExpectedValue", "expected a value", pos, 1);
	}
	if (code === QUOTE) {
		if (source.charCodeAt(pos + 1) === QUOTE && source.charCodeAt(pos + 2) === QUOTE) {
			const scanned = scanMultilineBasicString(source, pos);
			return {
				node: new TomlString({
					value: scanned.value,
					style: "multiline-basic",
					offset: pos,
					length: scanned.end - pos,
				}),
				end: scanned.end,
			};
		}
		const scanned = scanBasicString(source, pos);
		return {
			node: new TomlString({ value: scanned.value, style: "basic", offset: pos, length: scanned.end - pos }),
			end: scanned.end,
		};
	}
	if (code === APOSTROPHE) {
		if (source.charCodeAt(pos + 1) === APOSTROPHE && source.charCodeAt(pos + 2) === APOSTROPHE) {
			const scanned = scanMultilineLiteralString(source, pos);
			return {
				node: new TomlString({
					value: scanned.value,
					style: "multiline-literal",
					offset: pos,
					length: scanned.end - pos,
				}),
				end: scanned.end,
			};
		}
		const scanned = scanLiteralString(source, pos);
		return {
			node: new TomlString({ value: scanned.value, style: "literal", offset: pos, length: scanned.end - pos }),
			end: scanned.end,
		};
	}
	if (code === LEFT_BRACKET) {
		return parseArray(source, pos, depth + 1);
	}
	if (code === LEFT_BRACE) {
		return parseInlineTable(source, pos, depth + 1);
	}
	return scalarNode(source, pos);
};

/** One `key = value` expression line; returns the position after its newline. */
const parseKeyValueExpression = (source: string, lineStart: number, keyStart: number): Parsed<TomlKeyValue> => {
	const keyPath = parseKeyPath(source, keyStart);
	const equalsPos = scanWhitespace(source, keyPath.end);
	if (source.charCodeAt(equalsPos) !== EQUALS) {
		raise("ExpectedEquals", "expected = after key", equalsPos, 1);
	}
	const valueStart = scanWhitespace(source, equalsPos + 1);
	const value = parseValue(source, valueStart, 0);
	const lineEnd = parseLineEnd(source, value.end);
	return {
		node: new TomlKeyValue({
			keyPath: keyPath.node,
			value: value.node,
			...(lineEnd.comment !== undefined ? { comment: lineEnd.comment } : {}),
			offset: lineStart,
			length: lineEnd.end - lineStart,
		}),
		end: lineEnd.end,
	};
};

/** One `[table]` or `[[array-of-tables]]` header line. */
const parseHeaderExpression = (
	source: string,
	lineStart: number,
	bracketPos: number,
): Parsed<TomlTableHeader | TomlArrayTableHeader> => {
	const isArrayTable = source.charCodeAt(bracketPos + 1) === LEFT_BRACKET;
	const keyStart = scanWhitespace(source, bracketPos + (isArrayTable ? 2 : 1));
	const keyPath = parseKeyPath(source, keyStart);
	let i = scanWhitespace(source, keyPath.end);
	if (isArrayTable) {
		if (source.charCodeAt(i) !== RIGHT_BRACKET || source.charCodeAt(i + 1) !== RIGHT_BRACKET) {
			raise("ExpectedTableHeaderClose", "expected ]] to close the array-of-tables header", i, 1);
		}
		i += 2;
	} else {
		if (source.charCodeAt(i) !== RIGHT_BRACKET) {
			raise("ExpectedTableHeaderClose", "expected ] to close the table header", i, 1);
		}
		i += 1;
	}
	const lineEnd = parseLineEnd(source, i);
	const fields = {
		keyPath: keyPath.node,
		...(lineEnd.comment !== undefined ? { comment: lineEnd.comment } : {}),
		offset: lineStart,
		length: lineEnd.end - lineStart,
	};
	return { node: isArrayTable ? new TomlArrayTableHeader(fields) : new TomlTableHeader(fields), end: lineEnd.end };
};

/**
 * Parse a TOML document into its linear CST: the flat, source-tiling list of
 * expressions. Throws RawTomlError on malformed input and GuardExceeded when
 * value nesting exceeds MAX_NESTING_DEPTH; the facade (Task 7) materializes
 * both into typed errors.
 */
export const parseExpressions = (source: string): ReadonlyArray<TomlExpression> => {
	assertValidUnicode(source);
	const expressions: Array<TomlExpression> = [];
	let triviaStart = -1;
	const flushTrivia = (end: number): void => {
		if (triviaStart !== -1) {
			expressions.push(
				new TomlTrivia({ text: source.slice(triviaStart, end), offset: triviaStart, length: end - triviaStart }),
			);
			triviaStart = -1;
		}
	};
	let pos = 0;
	while (pos < source.length) {
		const lineStart = pos;
		// the BOM folds into the first line's leading whitespace, keeping the tiling exact
		let i = scanWhitespace(source, lineStart === 0 ? skipBom(source) : lineStart);
		const code = source.charCodeAt(i);
		if (i >= source.length || code === LF || code === CR || code === HASH) {
			// blank or comment-only line → trivia accumulation
			if (code === HASH) {
				i = scanComment(source, i).end;
			}
			pos = i < source.length ? scanNewline(source, i) : i;
			if (triviaStart === -1) {
				triviaStart = lineStart;
			}
			continue;
		}
		flushTrivia(lineStart);
		const parsed =
			code === LEFT_BRACKET
				? parseHeaderExpression(source, lineStart, i)
				: parseKeyValueExpression(source, lineStart, i);
		expressions.push(parsed.node);
		pos = parsed.end;
	}
	flushTrivia(source.length);
	return expressions;
};

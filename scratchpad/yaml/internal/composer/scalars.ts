// Scalar resolution and decoding: YAML 1.2 Core Schema type resolution
// (spec chapter 10.3.2), flow/block scalar decoding, multi-line plain-scalar
// collection, and the CST-scanning helpers those routines share with the
// block/flow/document seams (placed here because this is the lowest seam
// that uses them — everything above already imports this module).

import type { ScalarStyle } from "../../YamlNode.ts";
import { YamlScalar } from "../../YamlNode.ts";
import type { CstNode } from "../cst.ts";
import { registerAnchor } from "./anchors.ts";
import { rawCommentText } from "./comments.ts";
import type { ComposerState, NodeMeta } from "./state.ts";
import { lineCol } from "./state.ts";
import { resolveTagHandle } from "./tags.ts";

// ---------------------------------------------------------------------------
// YAML 1.2 Core Schema type resolution
// ---------------------------------------------------------------------------

const NULL_RE = /^(?:null|Null|NULL|~)$/;
const TRUE_RE = /^(?:true|True|TRUE)$/;
const FALSE_RE = /^(?:false|False|FALSE)$/;
const INT_RE = /^[-+]?[0-9]+$/;
const OCT_RE = /^0o[0-7]+$/;
const HEX_RE = /^0x[\dA-Fa-f]+$/;
const FLOAT_RE = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;
const INF_RE = /^[-+]?\.(?:inf|Inf|INF)$/;
const NAN_RE = /^\.(?:nan|NaN|NAN)$/;

/**
 * Parses an integer string, returning `bigint` when the value exceeds
 * `Number.MAX_SAFE_INTEGER` to avoid silent precision loss.
 */
function safeParseInt(value: string, radix: number): number | bigint {
	const n = Number.parseInt(value, radix);
	if (Number.isSafeInteger(n)) return n;
	// Fall back to BigInt for values that exceed safe integer range
	const prefix = radix === 16 ? "0x" : radix === 8 ? "0o" : "";
	return BigInt(`${prefix}${value}`);
}

/**
 * Classify a plain scalar's numeric form for duplicate-key identity. `1` is an
 * `!!int` and `1.0` an `!!float` even though both resolve to the JS number `1`,
 * so they are distinct mapping keys; `1` and `0x1` are both `!!int 1` and so
 * are the same key. Returns `null` for non-numeric plain text. Uses the same
 * regexes as {@link resolvePlainScalar} so the classification always agrees
 * with how the value was resolved.
 */
export function classifyPlainNumeric(raw: string): "int" | "float" | null {
	const t = raw.trim();
	if (OCT_RE.test(t) || HEX_RE.test(t) || INT_RE.test(t)) return "int";
	if (INF_RE.test(t) || NAN_RE.test(t) || FLOAT_RE.test(t)) return "float";
	return null;
}

function resolvePlainScalar(value: string): unknown {
	if (value === "" || NULL_RE.test(value)) return null;
	if (TRUE_RE.test(value)) return true;
	if (FALSE_RE.test(value)) return false;
	if (OCT_RE.test(value)) return safeParseInt(value.slice(2), 8);
	if (HEX_RE.test(value)) return safeParseInt(value.slice(2), 16);
	if (INT_RE.test(value)) return safeParseInt(value, 10);
	if (INF_RE.test(value)) return value.startsWith("-") ? -Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
	if (NAN_RE.test(value)) return Number.NaN;
	if (FLOAT_RE.test(value)) {
		const n = Number.parseFloat(value);
		if (!Number.isNaN(n)) return n;
	}
	return value;
}

function resolveTaggedScalar(rawValue: string, tag: string): unknown {
	switch (tag) {
		case "!!str":
		case "tag:yaml.org,2002:str":
			return rawValue;
		case "!!int":
		case "tag:yaml.org,2002:int": {
			if (OCT_RE.test(rawValue)) return Number.parseInt(rawValue.slice(2), 8);
			if (HEX_RE.test(rawValue)) return Number.parseInt(rawValue.slice(2), 16);
			const n = Number.parseInt(rawValue, 10);
			return Number.isNaN(n) ? rawValue : n;
		}
		case "!!float":
		case "tag:yaml.org,2002:float": {
			if (INF_RE.test(rawValue)) return rawValue.startsWith("-") ? -Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
			if (NAN_RE.test(rawValue)) return Number.NaN;
			const n = Number.parseFloat(rawValue);
			return Number.isNaN(n) ? rawValue : n;
		}
		case "!!bool":
		case "tag:yaml.org,2002:bool": {
			if (TRUE_RE.test(rawValue)) return true;
			if (FALSE_RE.test(rawValue)) return false;
			return rawValue;
		}
		case "!!null":
		case "tag:yaml.org,2002:null":
			return null;
		default:
			return rawValue;
	}
}

export function resolveScalar(rawValue: string, style: ScalarStyle, tag?: string, state?: ComposerState): unknown {
	if (tag) {
		const resolvedTag = state ? resolveTagHandle(tag, state) : tag;
		return resolveTaggedScalar(rawValue, resolvedTag);
	}
	if (style !== "plain") return rawValue;
	return resolvePlainScalar(rawValue);
}

// ---------------------------------------------------------------------------
// Scalar decoding
// ---------------------------------------------------------------------------

export function getScalarStyle(node: CstNode): ScalarStyle {
	if (node.type === "block-scalar") {
		const ch = node.source.trimStart()[0];
		return ch === ">" ? "block-folded" : "block-literal";
	}
	const first = node.source[0];
	if (first === "'") return "single-quoted";
	if (first === '"') return "double-quoted";
	return "plain";
}

/**
 * Extracts the chomp indicator from a block scalar's header.
 * Returns "strip" for `-`, "keep" for `+`, "clip" otherwise (default).
 * Returns undefined for non-block scalars.
 */
export function getBlockChomp(node: CstNode): "strip" | "clip" | "keep" | undefined {
	if (node.type !== "block-scalar") return undefined;
	// Inspect only the INDICATOR RUN directly after `|`/`>` — never the rest
	// of the header line, where a `+`/`-` inside a header comment
	// (`| # keep+this`) would misread as a chomp indicator.
	const indicators = node.source.trimStart().match(/^[|>]([0-9+-]*)/)?.[1] ?? "";
	if (indicators.includes("+")) return "keep";
	if (indicators.includes("-")) return "strip";
	return "clip";
}

/**
 * Extracts the EXPLICIT indentation-indicator digit from a block scalar's
 * header (`|2`, `>1+`), or undefined when the header carries none (the
 * reader auto-detects) or the node is not a block scalar. Inspects only the
 * indicator run — see {@link getBlockChomp} for why the rest of the header
 * line (a comment can contain digits) must not be read.
 */
export function getBlockIndent(node: CstNode): number | undefined {
	if (node.type !== "block-scalar") return undefined;
	const indicators = node.source.trimStart().match(/^[|>]([0-9+-]*)/)?.[1] ?? "";
	const digit = indicators.match(/[1-9]/)?.[0];
	return digit === undefined ? undefined : Number(digit);
}

/**
 * The trailing comment on a block scalar's HEADER line (`key: | # c`,
 * `- >-2 # c`) as stored raw-slice text, or `undefined` when the header
 * carries none. The header is the only line of a block scalar that can carry
 * a `#` comment — body lines absorb `#` as content — and the lexer packs the
 * whole scalar (header comment included) into one CST token, so the comment
 * never surfaces as a sibling comment token for the ordinary attribution
 * pass (#341).
 */
function blockScalarHeaderComment(cst: CstNode): string | undefined {
	const src = cst.source.trimStart();
	const nl = src.search(/[\r\n]/);
	const header = nl < 0 ? src : src.slice(0, nl);
	const hash = header.indexOf("#");
	if (hash < 1) return undefined;
	// A header comment requires separation whitespace after the indicators.
	const before = header[hash - 1];
	if (before !== " " && before !== "\t") return undefined;
	return rawCommentText(header.slice(hash));
}

export function getScalarValue(node: CstNode, fullText?: string): string {
	if (node.type === "block-scalar") return decodeBlockScalar(node.source, fullText, node.offset);
	const style = getScalarStyle(node);
	if (style === "single-quoted") return decodeSingleQuoted(node.source);
	if (style === "double-quoted") return decodeDoubleQuoted(node.source);
	return decodePlainScalar(node.source);
}

/**
 * YAML 1.2 §6.5 flow line folding for plain scalars.
 * - Bare newline between non-empty lines becomes a space (fold)
 * - Empty line(s) preserved as newline characters
 * - Leading whitespace on continuation lines trimmed
 * - Trailing whitespace before newlines trimmed
 */
function decodePlainScalar(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed.includes("\n")) return trimmed;
	return foldFlowLines(trimmed);
}

/**
 * Decode single-quoted scalar with flow folding.
 * Only escape: '' → '
 * Bare newlines follow flow folding rules.
 */
function decodeSingleQuoted(raw: string): string {
	const inner = raw.slice(1, -1);
	const unescaped = inner.replace(/''/g, "'");
	if (!unescaped.includes("\n")) return unescaped;
	return foldFlowLines(unescaped);
}

function decodeDoubleQuoted(raw: string): string {
	const inner = raw.slice(1, -1);
	let result = "";
	// Track position in result beyond which only raw whitespace was added.
	// Escape-produced content always advances this, so it's never trimmed.
	let significantEnd = 0;
	let i = 0;
	while (i < inner.length) {
		const ch = inner[i];
		if (ch === "\\") {
			i++;
			const esc = inner[i];
			switch (esc) {
				case "\\":
					result += "\\";
					break;
				case '"':
					result += '"';
					break;
				case "/":
					result += "/";
					break;
				case "b":
					result += "\b";
					break;
				case "f":
					result += "\f";
					break;
				case "n":
					result += "\n";
					break;
				case "r":
					result += "\r";
					break;
				case "t":
					result += "\t";
					break;
				case "0":
					result += "\0";
					break;
				case "a":
					result += "\x07";
					break;
				case "e":
					result += "\x1B";
					break;
				case "v":
					result += "\x0B";
					break;
				case " ":
					result += " ";
					break;
				case "N":
					result += "\u0085";
					break;
				case "_":
					result += "\u00a0";
					break;
				case "L":
					result += "\u2028";
					break;
				case "P":
					result += "\u2029";
					break;
				case "x": {
					const hex = inner.slice(i + 1, i + 3);
					result += String.fromCharCode(Number.parseInt(hex, 16));
					i += 2;
					break;
				}
				case "u": {
					const hex = inner.slice(i + 1, i + 5);
					result += String.fromCodePoint(Number.parseInt(hex, 16));
					i += 4;
					break;
				}
				case "U": {
					const hex = inner.slice(i + 1, i + 9);
					// Defensive: the lexer already rejects `\U` escapes above U+10FFFF
					// with an error token, but guard the composer's re-decode too so a
					// stray code point can never throw a RangeError as a defect.
					const cp = Number.parseInt(hex, 16);
					result += cp <= 0x10ffff ? String.fromCodePoint(cp) : "\uFFFD";
					i += 8;
					break;
				}
				case "\n": {
					i++;
					while (i < inner.length && (inner[i] === " " || inner[i] === "\t")) i++;
					continue;
				}
				case "\r": {
					i++;
					if (i < inner.length && inner[i] === "\n") i++;
					while (i < inner.length && (inner[i] === " " || inner[i] === "\t")) i++;
					continue;
				}
				default:
					result += esc === undefined ? "\\" : esc;
			}
			// Escape-produced content is always significant (never trimmed)
			significantEnd = result.length;
			i++;
		} else if (ch === "\n" || (ch === "\r" && inner[i + 1] === "\n")) {
			// Bare newline: apply flow folding (YAML 1.2 §6.5)
			// Trim only raw trailing whitespace (not escape-produced content)
			result = result.slice(0, significantEnd);
			i += ch === "\r" ? 2 : 1;
			// Skip leading whitespace on next line (indentation)
			while (i < inner.length && (inner[i] === " " || inner[i] === "\t")) i++;
			// Check for empty lines (consecutive newlines → preserved as \n)
			if (i < inner.length && (inner[i] === "\n" || inner[i] === "\r")) {
				// Consume all consecutive empty lines
				while (i < inner.length && (inner[i] === "\n" || inner[i] === "\r")) {
					result += "\n";
					i += inner[i] === "\r" && inner[i + 1] === "\n" ? 2 : 1;
					// Skip leading whitespace on next line
					while (i < inner.length && (inner[i] === " " || inner[i] === "\t")) i++;
				}
			} else {
				// Non-empty continuation: fold to space
				result += " ";
			}
			significantEnd = result.length;
		} else {
			result += ch;
			if (ch !== " " && ch !== "\t") significantEnd = result.length;
			i++;
		}
	}
	return result;
}

/**
 * Apply YAML 1.2 §6.5 flow line folding to a string.
 * - Split into lines, trim trailing whitespace from each
 * - Newline between non-empty lines becomes a space
 * - Empty line preserved as newline in output
 * - Leading whitespace (indentation) on continuation lines trimmed
 */
export function foldFlowLines(text: string): string {
	const lines = text.split("\n");
	let result = "";
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (i === 0) {
			// First line: trim trailing whitespace only
			result += line.replace(/[ \t]+$/, "");
			continue;
		}
		// Continuation line: trim leading whitespace (indentation)
		// Trim trailing whitespace only on non-last lines (before a line break)
		const isLast = i === lines.length - 1;
		const trimmed = isLast ? line.trimStart() : line.trim();
		if (trimmed === "") {
			if (isLast) {
				// Last line empty after trimming indentation — just the closing
				// delimiter's line; fold the preceding newline to a space if no
				// empty lines came before it, otherwise drop silently.
				if (result.length === 0 || result[result.length - 1] !== "\n") {
					result += " ";
				}
			} else {
				// Empty line → newline
				result += "\n";
			}
		} else {
			// Non-empty continuation line: fold (previous non-empty → space → this)
			// But if the last char of result is already \n (from empty lines), don't add space
			if (result.length > 0 && result[result.length - 1] !== "\n") {
				result += " ";
			}
			result += trimmed;
		}
	}
	return result;
}

/**
 * Collect a multi-line plain scalar key from consecutive CST children.
 * Like `collectMultilinePlainScalar`, but for keys: collects plain scalars
 * up until the `:` value separator, merging them with flow line folding.
 * Returns the folded key text and the index after the last consumed child.
 */
export function collectMultilineKey(
	children: readonly CstNode[],
	startIdx: number,
): { value: string; nextIdx: number } {
	const first = children[startIdx];
	if (first?.type !== "flow-scalar") {
		return { value: first?.source.trim() ?? "", nextIdx: startIdx + 1 };
	}

	const parts: string[] = [first.source.trim()];
	let idx = startIdx + 1;

	while (idx < children.length) {
		const child = children[idx];
		if (!child) break;

		if (child.type === "newline" || (child.type === "whitespace" && child.source.trim() === "")) {
			idx++;
			continue;
		}
		// Stop at the value separator or comma (segment boundary)
		if (child.type === "whitespace" && (child.source === ":" || child.source === ",")) break;
		if (child.type === "flow-scalar" && getScalarStyle(child) === "plain") {
			parts.push(child.source.trim());
			idx++;
			continue;
		}
		// Any other node type — stop merging
		break;
	}

	if (parts.length === 1) {
		return { value: parts[0] ?? "", nextIdx: idx };
	}

	return { value: foldFlowLines(parts.join("\n")), nextIdx: idx };
}

/**
 * Extract the trimmed content of the line at `offset` in `text`.
 * Returns the trimmed text and the offset of the next line (or EOF).
 */
function extractLineContent(text: string, offset: number): { lineText: string; lineEndOffset: number } {
	// Find start of line
	let lineStart = offset;
	while (lineStart > 0 && text[lineStart - 1] !== "\n") {
		lineStart--;
	}
	// Find end of line
	let lineEnd = offset;
	while (lineEnd < text.length && text[lineEnd] !== "\n" && text[lineEnd] !== "\r") {
		lineEnd++;
	}
	return { lineText: text.slice(lineStart, lineEnd).trim(), lineEndOffset: lineEnd };
}

/**
 * Skip all children whose offset falls on the same line as `lineOffset`.
 * Returns the index of the first child that is past the line end.
 */
function skipChildrenOnLine(children: readonly CstNode[], startIdx: number, lineEndOffset: number): number {
	let idx = startIdx;
	while (idx < children.length) {
		const c = children[idx];
		if (!c) break;
		// Children that start at or before the line end belong to this line.
		// But newlines at the line end separate lines — stop before the newline.
		if (c.type === "newline" && c.offset >= lineEndOffset) break;
		if (c.offset > lineEndOffset) break;
		idx++;
	}
	return idx;
}

/**
 * Collect a multi-line plain scalar from consecutive CST children.
 * Starting from a plain flow-scalar at `startIdx`, look ahead through
 * newlines and whitespace for more plain flow-scalars that continue the
 * same value. Returns the folded scalar text and the index after the last
 * consumed child.
 *
 * A continuation scalar must:
 * - Be a plain flow-scalar (not quoted)
 * - NOT be followed by a value-sep (`:`) — that makes it a mapping key
 * - Be separated from the previous scalar only by newlines/whitespace
 *
 * When the lexer mis-tokenizes continuation line content as anchors, tags,
 * aliases, directives, or block-seq entries, this function detects such
 * lines and extracts the raw source text as continuation parts (3MYT, FBC9,
 * XLQ9, AB8U).
 *
 * `endOffset` is the source end of the last consumed fragment, so callers
 * can span the composed scalar node across the whole folded value (the
 * sourceMultiline decoration pass then stamps it from the span).
 */
export function collectMultilinePlainScalar(
	children: readonly CstNode[],
	startIdx: number,
	minContinuationColumn?: number,
	sourceText?: string,
): { value: string; nextIdx: number; partsCount: number; endOffset: number } {
	const first = children[startIdx];
	if (first?.type !== "flow-scalar") {
		return {
			value: first?.source.trim() ?? "",
			nextIdx: startIdx + 1,
			partsCount: 1,
			endOffset: first === undefined ? 0 : first.offset + first.length,
		};
	}

	// Only merge plain scalars (not quoted)
	const style = getScalarStyle(first);
	if (style !== "plain") {
		return {
			value: getScalarValue(first),
			nextIdx: startIdx + 1,
			partsCount: 1,
			endOffset: first.offset + first.length,
		};
	}

	const parts: string[] = [first.source.trim()];
	let endOffset = first.offset + first.length;
	let emptyLines = 0;
	let idx = startIdx + 1;
	// Track whether we've seen a newline since the last content (for continuation detection)
	let sawNewline = false;

	while (idx < children.length) {
		const child = children[idx];
		if (!child) break;

		if (child.type === "newline") {
			emptyLines++;
			sawNewline = true;
			idx++;
			continue;
		}
		if (child.type === "whitespace") {
			// Block structure indicators terminate plain scalar continuation
			if (child.source === ":" || child.source === "?" || child.source === "-") break;
			idx++;
			continue;
		}
		if (child.type === "comment") {
			// Comments terminate plain scalar continuation
			break;
		}
		if (child.type === "flow-scalar" && getScalarStyle(child) === "plain") {
			// Check if this scalar is followed by `:` — if so, it's a key, stop
			if (hasValueSepAfterInList(children, idx + 1)) break;
			// Also stop if scalar is followed by a block-map (it's the first
			// key of a nested mapping — i.e., an implicit key, not a value
			// continuation). EW3V: `k1: v1\n k2: v2` — k2 is a key, don't merge.
			if (hasBlockMapAfterInList(children, idx + 1)) break;

			// Don't merge scalars below the minimum continuation indent (236B).
			// This prevents merging e.g. "bar" (col 2) with "invalid" (col 0)
			// when the block mapping key is at col 0.
			if (minContinuationColumn !== undefined && sourceText) {
				const childColumn = lineCol(sourceText, child.offset).column;
				if (childColumn < minContinuationColumn) break;
			}

			// Merge: empty lines between content become \n, otherwise fold to space
			if (emptyLines > 1) {
				// emptyLines counts all newlines including the one ending the previous line
				// Subtract 1 for the line-ending newline; remaining are empty lines
				for (let e = 0; e < emptyLines - 1; e++) {
					parts.push("");
				}
			}
			parts.push(child.source.trim());
			endOffset = child.offset + child.length;
			emptyLines = 0;
			sawNewline = false;
			idx++;
			continue;
		}

		// Non-scalar node (anchor, tag, alias, directive, block-seq, etc.)
		// On a continuation line, these may be mis-tokenized plain scalar text.
		// Check if the raw source line is indented (indicating continuation).
		// Directive nodes (e.g., %YAML 1.2) inside document content are always
		// continuations since real directives only appear before `---` (XLQ9).
		// Exclude flow-scalar and block-scalar nodes — the lexer correctly
		// identifies these (e.g., quoted scalars like '' should not be merged
		// as plain scalar continuation text).
		if (sawNewline && sourceText && child.type !== "flow-scalar" && child.type !== "block-scalar") {
			const childCol = lineCol(sourceText, child.offset).column;
			const isDirectiveContinuation = child.type === "directive";
			// Apply minContinuationColumn check for non-directive nodes — when
			// the caller specifies an implicit-mapping continuation indent,
			// nodes shallower than that aren't continuations and shouldn't
			// be absorbed (ZVH3: `key: value\n - item1` — the nested block-seq
			// at col 1 isn't a continuation of the value at col 7+).
			if (minContinuationColumn !== undefined && !isDirectiveContinuation && childCol < minContinuationColumn) {
				break;
			}
			// Continuation lines must be indented (column > 0), or be directives
			if (childCol > 0 || isDirectiveContinuation) {
				const { lineText, lineEndOffset } = extractLineContent(sourceText, child.offset);
				if (lineText.length > 0) {
					// Merge empty lines
					if (emptyLines > 1) {
						for (let e = 0; e < emptyLines - 1; e++) {
							parts.push("");
						}
					}
					parts.push(lineText);
					// The span end is the last non-whitespace character of the
					// absorbed line, not the raw line end.
					let contentEnd = lineEndOffset;
					while (contentEnd > 0 && (sourceText[contentEnd - 1] === " " || sourceText[contentEnd - 1] === "\t")) {
						contentEnd--;
					}
					endOffset = contentEnd;
					emptyLines = 0;
					sawNewline = false;
					// Skip all children on this line
					idx = skipChildrenOnLine(children, idx, lineEndOffset);
					continue;
				}
			}
		}

		// Any other node type — stop merging
		break;
	}

	if (parts.length === 1) {
		return { value: parts[0] ?? "", nextIdx: idx, partsCount: 1, endOffset };
	}

	// Apply flow folding to the collected parts
	return { value: foldFlowLines(parts.join("\n")), nextIdx: idx, partsCount: parts.length, endOffset };
}

// ---------------------------------------------------------------------------
// CST scanning helpers (shared by the block/flow/document seams)
// ---------------------------------------------------------------------------

/**
 * Find the index of the next non-trivia child (skips newline, whitespace, comment).
 * If `stopAtDash` is true, returns null when a `-` indicator is encountered before
 * any significant child (used to avoid merging across sequence entry boundaries).
 */
export function findNextSignificantChild(
	children: readonly CstNode[],
	startIdx: number,
	stopAtDash = false,
): number | null {
	for (let j = startIdx; j < children.length; j++) {
		const c = children[j];
		if (!c) continue;
		if (c.type === "newline" || c.type === "comment") continue;
		if (c.type === "whitespace") {
			if (stopAtDash && c.source.trim() === "-") return null;
			continue;
		}
		return j;
	}
	return null;
}

/**
 * Check if a value separator (`:`) follows in a CST children list,
 * skipping whitespace and newlines.
 */
export function hasValueSepAfterInList(children: readonly CstNode[], startIdx: number): boolean {
	return findValueSepOffset(children, startIdx) >= 0;
}

/**
 * Check if the next non-trivia child is a block-map (indicating that the
 * preceding scalar is the first key of a nested implicit mapping). Returns
 * false if a sibling `:` value-sep is encountered first, since that means
 * the scalar is a key at the current level (not a nested mapping start).
 */
export function hasBlockMapAfterInList(children: readonly CstNode[], startIdx: number): boolean {
	for (let j = startIdx; j < children.length; j++) {
		const c = children[j];
		if (!c) continue;
		if (c.type === "newline" || c.type === "comment") continue;
		if (c.type === "whitespace") {
			if (c.source === ":") return false;
			continue;
		}
		return c.type === "block-map";
	}
	return false;
}

/** Find the offset of the next ":" value separator in a CST children list, or -1 if none. */
export function findValueSepOffset(children: readonly CstNode[], startIdx: number): number {
	for (let j = startIdx; j < children.length; j++) {
		const c = children[j];
		if (!c) continue;
		if (c.type === "newline" || c.type === "comment") continue;
		if (c.type === "whitespace") {
			if (c.source === ":") return c.offset;
			continue;
		}
		return -1;
	}
	return -1;
}

/** Check if a ":" value-sep exists between startIdx (inclusive) and endIdx (exclusive). */
export function hasValueSepBetween(children: readonly CstNode[], startIdx: number, endIdx: number): boolean {
	for (let j = startIdx; j < endIdx; j++) {
		const c = children[j];
		if (!c) continue;
		if (c.type === "whitespace" && c.source === ":") return true;
	}
	return false;
}

/**
 * Returns true when the first non-trivia child of a block-map CST node is a
 * `:` value separator (i.e., the block map begins with an implicit empty key
 * followed by a value indicator). Used to decide whether a pending anchor/tag
 * belongs to that empty key rather than to the block map itself.
 */
export function blockMapStartsWithValueSep(blockMap: CstNode): boolean {
	for (const c of blockMap.children ?? []) {
		if (!c) continue;
		if (c.type === "newline" || c.type === "comment") continue;
		if (c.type === "whitespace") {
			if (c.source === ":") return true;
			if (c.source.trim() === "") continue;
			return false;
		}
		return false;
	}
	return false;
}

/**
 * Like `hasValueSepAfterInList`, but also skips over plain flow-scalars
 * that appear after a newline. Used to detect multi-line keys:
 * `multi\n  line: value` where `:` comes after continuation plain scalars.
 * Only allows skipping plain scalars that were preceded by a newline,
 * preventing false matches across comma-delimited entries on the same line.
 */
export function hasValueSepThroughPlainScalars(children: readonly CstNode[], startIdx: number): boolean {
	let sawNewline = false;
	for (let j = startIdx; j < children.length; j++) {
		const c = children[j];
		if (!c) continue;
		if (c.type === "newline") {
			sawNewline = true;
			continue;
		}
		if (c.type === "comment") continue;
		if (c.type === "whitespace") {
			if (c.source === ":") return true;
			// Commas delimit segments — stop looking across them
			if (c.source === ",") return false;
			continue;
		}
		// Only skip plain scalars on continuation lines (after a newline)
		if (sawNewline && c.type === "flow-scalar" && getScalarStyle(c) === "plain") continue;
		return false;
	}
	return false;
}

/** Find the next non-trivia CST child in a list, returning the node and its index. */
export function findNextContentInList(
	children: readonly CstNode[],
	startIdx: number,
): { node: CstNode; idx: number } | null {
	for (let j = startIdx; j < children.length; j++) {
		const c = children[j];
		if (!c) continue;
		if (c.type === "whitespace" || c.type === "newline" || c.type === "comment") continue;
		return { node: c, idx: j };
	}
	return null;
}

export function findFirstContent(children: readonly CstNode[]): CstNode | undefined {
	for (const c of children) {
		if (!c) continue;
		if (c.type === "whitespace" && c.source.trim() === "") continue;
		if (c.type === "newline") continue;
		return c;
	}
	return undefined;
}

export function findLastContent(children: readonly CstNode[]): CstNode | undefined {
	for (let i = children.length - 1; i >= 0; i--) {
		const c = children[i];
		if (!c) continue;
		if (c.type === "whitespace" && c.source.trim() === "") continue;
		if (c.type === "newline") continue;
		return c;
	}
	return undefined;
}

/**
 * Find the next content child (skipping trivia AND anchor/tag properties),
 * or null. Used at the document level where properties precede content.
 */
export function findNextContentChild(children: readonly CstNode[], startIdx: number): CstNode | null {
	for (let i = startIdx; i < children.length; i++) {
		const c = children[i];
		if (!c) continue;
		if (
			c.type === "whitespace" ||
			c.type === "newline" ||
			c.type === "comment" ||
			c.type === "anchor" ||
			c.type === "tag"
		)
			continue;
		return c;
	}
	return null;
}

export function indexOfChild(children: readonly CstNode[], target: CstNode): number {
	for (let i = 0; i < children.length; i++) {
		if (children[i] === target) return i;
	}
	return -1;
}

/** Check if there's a value separator ":" after startIdx (skipping only whitespace). */
export function hasValueSepAfter(children: readonly CstNode[], startIdx: number): boolean {
	for (let j = startIdx; j < children.length; j++) {
		const c = children[j];
		if (!c) continue;
		if (c.type === "whitespace" && c.source === ":") return true;
		if (c.type === "whitespace" && c.source !== ":") continue;
		if (c.type === "newline") continue;
		break;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Block scalar decoding
// ---------------------------------------------------------------------------

/**
 * Scan backward in the full document text from a block scalar indicator's
 * position to find the parent context indentation level n. This handles:
 * - Same-line ":" (mapping value): n = key's column indent
 * - Same-line "-" (seq entry): n = column of "-"
 * - Own-line (preceded by newline, tag, anchor): scan further back across
 *   lines to find the ":" or "-" that introduced this value
 */
function findParentIndent(fullText: string, indicatorOffset: number): number {
	let scanBack = indicatorOffset - 1;
	// Skip whitespace on the same line
	while (scanBack >= 0 && (fullText[scanBack] === " " || fullText[scanBack] === "\t")) {
		scanBack--;
	}
	// If we hit ":" or "-" on the same line, handle directly
	if (scanBack >= 0 && fullText[scanBack] === ":") {
		return findKeyIndent(fullText, scanBack);
	}
	if (scanBack >= 0 && fullText[scanBack] === "-") {
		return findColOnLine(fullText, scanBack);
	}
	// Block scalar is on its own line (after tag, anchor, or newline).
	// Scan backward across lines to find the ":" or "-" that introduces
	// this block scalar as a value.
	while (scanBack >= 0) {
		const ch = fullText[scanBack];
		if (ch === ":") {
			return findKeyIndent(fullText, scanBack);
		}
		if (ch === "-") {
			// Check if this is a seq entry indicator (followed by space/newline)
			const afterDash = scanBack + 1;
			if (
				afterDash >= fullText.length ||
				fullText[afterDash] === " " ||
				fullText[afterDash] === "\t" ||
				fullText[afterDash] === "\n" ||
				fullText[afterDash] === "\r"
			) {
				return findColOnLine(fullText, scanBack);
			}
		}
		scanBack--;
	}
	return 0;
}

/** Find the column of a character on its line. */
function findColOnLine(text: string, pos: number): number {
	let lineStart = pos;
	while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") {
		lineStart--;
	}
	return pos - lineStart;
}

/** Find the key indentation for a mapping ":" at the given position. */
function findKeyIndent(text: string, colonPos: number): number {
	let lineStart = colonPos;
	while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") {
		lineStart--;
	}
	let spaces = 0;
	while (lineStart + spaces < text.length && text[lineStart + spaces] === " ") {
		spaces++;
	}
	// If the first non-space char is "-" followed by space (compact sequence),
	// the key starts after "- "
	if (lineStart + spaces < text.length && text[lineStart + spaces] === "-") {
		const afterDash = lineStart + spaces + 1;
		if (afterDash < text.length && (text[afterDash] === " " || text[afterDash] === "\t")) {
			return spaces + 2;
		}
	}
	return spaces;
}

function decodeBlockScalar(raw: string, fullText?: string, nodeOffset?: number): string {
	const firstChar = raw.trimStart()[0];
	const isFolded = firstChar === ">";
	let i = raw.indexOf(firstChar === ">" ? ">" : "|");
	if (i < 0) return "";
	i++;

	let chomp: "clip" | "strip" | "keep" = "clip";
	let explicitIndent = 0;

	for (let hc = 0; hc < 2 && i < raw.length && raw[i] !== "\n" && raw[i] !== "\r"; hc++) {
		const ch = raw[i];
		if (ch === "-") {
			chomp = "strip";
			i++;
		} else if (ch === "+") {
			chomp = "keep";
			i++;
		} else if (ch !== undefined && ch >= "1" && ch <= "9") {
			explicitIndent = Number.parseInt(ch, 10);
			i++;
		} else {
			break;
		}
	}

	while (i < raw.length && raw[i] !== "\n" && raw[i] !== "\r") i++;
	if (i < raw.length) {
		if (raw[i] === "\r" && raw[i + 1] === "\n") i += 2;
		else i++;
	}

	// When an explicit indentation indicator is present (e.g., |2), the digit
	// specifies additional spaces relative to the parent block indent n
	// (YAML 1.2 §8.1.1.1). The raw CST source includes the full absolute
	// indentation, so we need contentIndent = n + m. We compute n by scanning
	// backward in the full text to find the parent context, using the same
	// logic as the lexer's scanBlockScalar. When fullText/nodeOffset are not
	// available, fall back to the explicit digit alone (works for top-level).
	let contentIndent = explicitIndent;
	let foundContent = explicitIndent > 0;
	if (explicitIndent > 0 && fullText !== undefined && nodeOffset !== undefined) {
		// Determine parent indent by scanning backward from the block scalar
		// indicator in the full text, mirroring the lexer's approach.
		// Scan backward past whitespace, newlines, tags, anchors, and comments
		// to find the ":" or "-" that introduces this block scalar value.
		const parentIndent = findParentIndent(fullText, nodeOffset);
		contentIndent = parentIndent + explicitIndent;
		foundContent = true;
	} else if (contentIndent === 0) {
		// Auto-detect from first non-empty line
		let scanAhead = i;
		while (scanAhead < raw.length) {
			let spaces = 0;
			while (scanAhead < raw.length && raw[scanAhead] === " ") {
				spaces++;
				scanAhead++;
			}
			if (scanAhead >= raw.length || raw[scanAhead] === "\n" || raw[scanAhead] === "\r") {
				if (scanAhead < raw.length) {
					scanAhead++;
					if (raw[scanAhead - 1] === "\r" && scanAhead < raw.length && raw[scanAhead] === "\n") scanAhead++;
				}
				continue;
			}
			contentIndent = spaces;
			foundContent = true;
			break;
		}
	}

	if (!foundContent) {
		if (chomp === "keep") {
			// Count all trailing empty/whitespace-only lines after the header
			let count = 0;
			let j = i;
			while (j < raw.length) {
				// Skip whitespace on this line
				while (j < raw.length && (raw[j] === " " || raw[j] === "\t")) j++;
				if (j >= raw.length) {
					// Whitespace-only content at EOF counts as one empty line
					if (count === 0) count = 1;
					break;
				}
				if (raw[j] === "\n") {
					count++;
					j++;
				} else if (raw[j] === "\r") {
					count++;
					j++;
					if (j < raw.length && raw[j] === "\n") j++;
				} else {
					break;
				}
			}
			return "\n".repeat(count);
		}
		return "";
	}

	const lines: string[] = [];
	const trailingNewlines: string[] = [];

	while (i < raw.length) {
		let spaces = 0;
		while (i < raw.length && raw[i] === " ") {
			spaces++;
			i++;
		}

		if (i >= raw.length || raw[i] === "\n" || raw[i] === "\r") {
			if (spaces > contentIndent) {
				// Whitespace-only line with spaces beyond content indent — this is content
				// (not an empty line), so flush any pending trailing newlines and add it
				for (const nl of trailingNewlines) lines.push(nl);
				trailingNewlines.length = 0;
				lines.push(" ".repeat(spaces - contentIndent));
			} else {
				// Empty line (at or below content indent) — defer as trailing
				trailingNewlines.push("");
			}
			if (i < raw.length) {
				if (raw[i] === "\r" && i + 1 < raw.length && raw[i + 1] === "\n") i += 2;
				else i++;
			}
			continue;
		}

		if (spaces < contentIndent) break;

		for (const _nl of trailingNewlines) lines.push("");
		trailingNewlines.length = 0;

		const extra = " ".repeat(spaces - contentIndent);
		const contentStart = i;
		while (i < raw.length && raw[i] !== "\n" && raw[i] !== "\r") i++;
		lines.push(extra + raw.slice(contentStart, i));

		if (i < raw.length) {
			if (raw[i] === "\r" && i + 1 < raw.length && raw[i + 1] === "\n") i += 2;
			else i++;
		}
	}

	let value: string;
	if (isFolded) {
		let result = "";
		let prevMoreIndented = false;
		let hadContent = false;
		for (let li = 0; li < lines.length; li++) {
			const ln = lines[li] ?? "";
			const isMoreIndented = ln.length > 0 && (ln[0] === " " || ln[0] === "\t");
			if (ln === "") {
				// Empty line — preserved as newline
				result += "\n";
				// Don't reset prevMoreIndented — we need to track last content line type
			} else if (!hadContent) {
				// First content line
				result += ln;
				prevMoreIndented = isMoreIndented;
				hadContent = true;
			} else {
				const lastChar = result[result.length - 1];
				if (lastChar === "\n") {
					// After empty line(s): if transition involves more-indented,
					// add extra newline for the preserved line break
					if (isMoreIndented || prevMoreIndented) {
						result += `\n${ln}`;
					} else {
						result += ln;
					}
				} else if (isMoreIndented || prevMoreIndented) {
					// Transition to/from more-indented: preserve newline
					result += `\n${ln}`;
				} else {
					// Normal folding: adjacent base-indent lines fold to space
					result += ` ${ln}`;
				}
				prevMoreIndented = isMoreIndented;
			}
		}
		// The break terminating the last CONTENT line exists only when there
		// was content; a body of nothing but empty lines contributes exactly
		// one break per empty line under keep (and nothing under clip — the
		// spec excludes the final break when there are no non-empty lines).
		// Without the hadContent gate, `>2+` over an empty body counted one
		// break too many — a value that then GREW on every format round-trip.
		if (hadContent || trailingNewlines.length > 0) {
			if (chomp === "keep") {
				if (hadContent) result += "\n";
				for (const _nl of trailingNewlines) result += "\n";
			} else if (chomp !== "strip") {
				if (hadContent) result += "\n";
			}
		}
		value = result;
	} else {
		value = lines.join("\n");
		// Mirror of the folded gate above: the terminating break belongs to
		// the last content line, not to an all-empty body (`|2+\n\n` is one
		// kept break, not two; `|2\n\n` under clip is the empty string).
		if (lines.length > 0 || trailingNewlines.length > 0) {
			if (chomp === "keep") {
				if (lines.length > 0) value += "\n";
				for (const _nl of trailingNewlines) value += "\n";
			} else if (chomp !== "strip") {
				if (lines.length > 0) value += "\n";
			}
		}
	}

	return value;
}

// ---------------------------------------------------------------------------
// Scalar node construction
// ---------------------------------------------------------------------------

/**
 * 5LLU, S98Z, W9L4: per YAML 1.2 §8.1.1, leading empty lines preceding the
 * first content line in a block scalar must satisfy l-empty(n,c) — at most
 * n leading spaces, where n is the content indent. When the indent indicator
 * is auto-detected from the first non-empty line, that line establishes n;
 * any preceding empty line with more than n spaces is malformed.
 */
function validateBlockScalarLeadingEmpties(cst: CstNode, state: ComposerState): void {
	const raw = cst.source;
	let i = 0;
	// Skip header line (e.g. ">", "|", "|+2", etc.)
	while (i < raw.length && raw[i] !== "\n" && raw[i] !== "\r") i++;
	if (i < raw.length) {
		if (raw[i] === "\r" && raw[i + 1] === "\n") i += 2;
		else i++;
	}
	// Walk lines, tracking offsets of leading-empty lines and their indent.
	const emptyIndents: { indent: number; offsetInRaw: number }[] = [];
	while (i < raw.length) {
		const lineStart = i;
		let spaces = 0;
		while (i < raw.length && raw[i] === " ") {
			spaces++;
			i++;
		}
		if (i >= raw.length || raw[i] === "\n" || raw[i] === "\r") {
			// Empty (whitespace-only) line.
			emptyIndents.push({ indent: spaces, offsetInRaw: lineStart });
			if (i < raw.length) {
				if (raw[i] === "\r" && raw[i + 1] === "\n") i += 2;
				else i++;
			}
			continue;
		}
		// First non-empty line found.
		const contentIndent = spaces;
		for (const empty of emptyIndents) {
			if (empty.indent > contentIndent) {
				const offset = cst.offset + empty.offsetInRaw;
				state.errors.push({
					code: "InvalidIndentation",
					message: "Block scalar leading empty line cannot be more indented than the first content line",
					offset,
					length: empty.indent,
				});
				return;
			}
		}
		return;
	}
}

export function makeScalar(cst: CstNode, state: ComposerState, meta?: NodeMeta): YamlScalar {
	const style = getScalarStyle(cst);
	if (style === "block-literal" || style === "block-folded") {
		// 5LLU, S98Z, W9L4: leading empty lines in a block scalar must not be
		// indented beyond the first content line's indent.
		validateBlockScalarLeadingEmpties(cst, state);
	}
	const rawValue = getScalarValue(cst, state.text);
	const value = resolveScalar(rawValue, style, meta?.tag, state);
	const chomp = getBlockChomp(cst);
	const blockIndent = getBlockIndent(cst);
	// #341: a block scalar's header-line comment (`| # c`) lives inside the
	// CST token, so it is captured here as the SCALAR's trailing `comment`
	// (reference `yaml` parity) rather than by the sibling attribution pass.
	const headerComment =
		style === "block-literal" || style === "block-folded" ? blockScalarHeaderComment(cst) : undefined;
	const comment = headerComment ?? meta?.comment;
	// Preserve the source representation when the resolved value is non-string
	// (number/bool/null) and the source form is not the canonical JS output —
	// e.g. `0xFFEEBB` resolves to 16772795 but should round-trip as hex,
	// `450.00` resolves to 450 but should keep the trailing zeros.
	const needsRaw =
		style === "plain" && typeof value !== "string" && value !== undefined && shouldPreserveRaw(rawValue, value);
	const scalar = new YamlScalar({
		value,
		style,
		offset: cst.offset,
		length: cst.length,
		...(meta?.tag !== undefined ? { tag: meta.tag } : {}),
		...(meta?.anchor !== undefined ? { anchor: meta.anchor } : {}),
		...(comment !== undefined ? { comment } : {}),
		...(chomp !== undefined ? { chomp } : {}),
		...(blockIndent !== undefined ? { blockIndent } : {}),
		...(needsRaw ? { raw: rawValue } : {}),
	});
	if (meta?.anchor) registerAnchor(scalar, meta.anchor, state, cst.offset);
	return scalar;
}

/**
 * Returns true when the scalar's source representation should be preserved
 * for canonical round-trip — i.e. the source form differs from `String(value)`
 * but resolves to the same value.
 *
 * Special-float values (NaN, +/-Infinity) are excluded: their canonical YAML
 * spelling is the lowercase `.inf` / `.nan` form per spec §10.3, so source
 * variants like `.INF` or `.NaN` should normalize on round-trip rather than
 * preserve.
 */
export function shouldPreserveRaw(rawValue: string, value: unknown): boolean {
	if (typeof value === "number") {
		if (Number.isNaN(value) || !Number.isFinite(value)) return false;
		return rawValue !== String(value);
	}
	return false;
}

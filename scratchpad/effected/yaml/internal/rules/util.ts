// Shared rule helpers: span queries over the eager token array, the
// scalar walk the style rules share, and the bounded numeric option schema.

import * as S from "effect/Schema";
import type { LintLine } from "../../YamlLintRule.ts";
import type { YamlNode, YamlScalar } from "../../YamlNode.ts";
import { YamlScalar as Scalar, YamlMap, YamlSeq } from "../../YamlNode.ts";
import type { YamlToken } from "../../YamlToken.ts";
import { dual } from "effect/Function";

/**
 * A non-negative integer — the shape every numeric rule option takes.
 * Rejects NaN, negatives and fractions with a message naming the constraint;
 * the config layer's wrapper names the rule and the field.
 */
// The check below rejects NaN and the infinities itself and names the option domain in its message;
// a finite-only base would answer first with a different message.
// @effect-diagnostics-next-line schemaNumber:off
export const nonNegativeIntegerOption = S.Number.check(
	S.makeFilter((n) => (Number.isInteger(n) && n >= 0 ? undefined : "Expected a non-negative integer")),
);

/**
 * A positive integer — for the `maxSpacesAfter` options, where `0` would make
 * the fix delete the separation space after an indicator and fuse it with its
 * content (`- item` → `-item`, `a: val` → `a:val` — different tokens, not a
 * spacing change).
 */
// Same as above: the check owns the rejection and its message.
// @effect-diagnostics-next-line schemaNumber:off
export const positiveIntegerOption = S.Number.check(
	S.makeFilter((n) =>
		Number.isInteger(n) && n >= 1 ? undefined : "Expected an integer greater than or equal to 1",
	),
);

/** Where a scalar sits in its parent construct. */
export type ScalarRole = "key" | "value" | "item" | "root";

/** Depth-first walk over every scalar node with its structural role. */
export function walkScalars(node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): void;
export function walkScalars(role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): (node: YamlNode | null) => void;
export function walkScalars(...args: [node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void] | [role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void]): void | ((node: YamlNode | null) => void) {
	return dual<
		(...args: [node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void] | [role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void]) => void | ((node: YamlNode | null) => void),
		(node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void) => void
	>(3, function walkScalars(node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): void {
	if (node === null) return;
	if (S.is(Scalar)(node)) {
		visit(node, role);
		return;
	}
	if (S.is(YamlMap)(node)) {
		for (const pair of node.items) {
			walkScalars(pair.key, "key", visit);
			walkScalars(pair.value, "value", visit);
		}
		return;
	}
	if (S.is(YamlSeq)(node)) {
		for (const item of node.items) walkScalars(item, "item", visit);
	}
})(...args);
}

/**
 * True when the first content of a line is the CONTINUATION of a scalar
 * token that began on an earlier line — block-scalar bodies and multi-line
 * plain/quoted scalars. The indentation rule skips such lines: their layout
 * is the value's, not block structure's.
 */
export function isScalarContinuationLine(tokens: ReadonlyArray<YamlToken>, lineOffset: number, probeOffset: number): boolean;
export function isScalarContinuationLine(lineOffset: number, probeOffset: number): (tokens: ReadonlyArray<YamlToken>) => boolean;
export function isScalarContinuationLine(...args: [tokens: ReadonlyArray<YamlToken>, lineOffset: number, probeOffset: number] | [lineOffset: number, probeOffset: number]): boolean | ((tokens: ReadonlyArray<YamlToken>) => boolean) {
	return dual<
		(...args: [tokens: ReadonlyArray<YamlToken>, lineOffset: number, probeOffset: number] | [lineOffset: number, probeOffset: number]) => boolean | ((tokens: ReadonlyArray<YamlToken>) => boolean),
		(tokens: ReadonlyArray<YamlToken>, lineOffset: number, probeOffset: number) => boolean
	>(3, function isScalarContinuationLine(tokens: ReadonlyArray<YamlToken>, lineOffset: number, probeOffset: number): boolean {
	const token = coveringToken(tokens, probeOffset);
	return token !== undefined && token.kind === "scalar" && token.offset < lineOffset;
})(...args);
}

/** The token whose span covers `offset`, when one does. */
export function coveringToken(tokens: ReadonlyArray<YamlToken>, offset: number): YamlToken | undefined;
export function coveringToken(offset: number): (tokens: ReadonlyArray<YamlToken>) => YamlToken | undefined;
export function coveringToken(...args: [tokens: ReadonlyArray<YamlToken>, offset: number] | [offset: number]): YamlToken | undefined | ((tokens: ReadonlyArray<YamlToken>) => YamlToken | undefined) {
	return dual<
		(...args: [tokens: ReadonlyArray<YamlToken>, offset: number] | [offset: number]) => YamlToken | undefined | ((tokens: ReadonlyArray<YamlToken>) => YamlToken | undefined),
		(tokens: ReadonlyArray<YamlToken>, offset: number) => YamlToken | undefined
	>(2, function coveringToken(tokens: ReadonlyArray<YamlToken>, offset: number): YamlToken | undefined {
	let lo = 0;
	let hi = tokens.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const token = tokens[mid] as YamlToken;
		if (offset < token.offset) {
			hi = mid - 1;
		} else if (offset >= token.offset + token.length) {
			lo = mid + 1;
		} else {
			return token;
		}
	}
	return undefined;
})(...args);
}

/**
 * True when `offset` falls inside a scalar token's span. Layout rules use
 * this to stay off scalar CONTENT — trailing whitespace or blank lines
 * inside a block scalar are part of the parsed value, and a lint layer that
 * edits content under the banner of layout is corrupting, not fixing.
 */
export function insideScalarSpan(tokens: ReadonlyArray<YamlToken>, offset: number): boolean;
export function insideScalarSpan(offset: number): (tokens: ReadonlyArray<YamlToken>) => boolean;
export function insideScalarSpan(...args: [tokens: ReadonlyArray<YamlToken>, offset: number] | [offset: number]): boolean | ((tokens: ReadonlyArray<YamlToken>) => boolean) {
	return dual<
		(...args: [tokens: ReadonlyArray<YamlToken>, offset: number] | [offset: number]) => boolean | ((tokens: ReadonlyArray<YamlToken>) => boolean),
		(tokens: ReadonlyArray<YamlToken>, offset: number) => boolean
	>(2, function insideScalarSpan(tokens: ReadonlyArray<YamlToken>, offset: number): boolean {
	return coveringToken(tokens, offset)?.kind === "scalar";
})(...args);
}

/**
 * The line containing `offset` and the character index within it — a binary
 * search over the ordered `LintLine` array (lines are ordered by `offset`,
 * the same invariant {@link coveringToken} rests on for tokens).
 */
export function positionAt(lines: ReadonlyArray<LintLine>, offset: number): { readonly line: number; readonly character: number };
export function positionAt(offset: number): (lines: ReadonlyArray<LintLine>) => { readonly line: number; readonly character: number };
export function positionAt(...args: [lines: ReadonlyArray<LintLine>, offset: number] | [offset: number]): { readonly line: number; readonly character: number } | ((lines: ReadonlyArray<LintLine>) => { readonly line: number; readonly character: number }) {
	return dual<
		(...args: [lines: ReadonlyArray<LintLine>, offset: number] | [offset: number]) => { readonly line: number; readonly character: number } | ((lines: ReadonlyArray<LintLine>) => { readonly line: number; readonly character: number }),
		(lines: ReadonlyArray<LintLine>, offset: number) => { readonly line: number; readonly character: number }
	>(2, function positionAt(lines: ReadonlyArray<LintLine>, offset: number): { readonly line: number; readonly character: number } {
	let lo = 0;
	let hi = lines.length - 1;
	let found: LintLine | undefined;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const line = lines[mid] as LintLine;
		if (line.offset <= offset) {
			found = line;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return found === undefined ? { line: 0, character: 0 } : { line: found.number, character: offset - found.offset };
})(...args);
}

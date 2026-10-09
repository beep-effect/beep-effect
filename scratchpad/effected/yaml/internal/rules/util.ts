import { dual } from "effect/Function";
// Shared rule helpers: span queries over the eager token array, the
// scalar walk the style rules share, and the bounded numeric option schema.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import * as A from "effect/Array";
import type { LintLine } from "../../YamlLintRule.ts";
import type { YamlNode, YamlScalar } from "../../YamlNode.ts";
import { YamlScalar as Scalar, YamlMap, YamlSeq } from "../../YamlNode.ts";
import type { YamlToken } from "../../YamlToken.ts";
const $I = $ScratchpadId.create("effected/yaml/internal/rules/util");

/**
 * Validates non-negative integer options used by numeric lint rules.
 *
 * **Details**
 *
 * A non-negative integer is the shape every numeric rule option takes.
 * Rejects NaN, negatives and fractions with a message naming the constraint;
 * the config layer's wrapper names the rule and the field.
 *
 * **Example** (Validate a zero-valued rule option)
 *
 * ```ts
 * import { nonNegativeIntegerOption } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(nonNegativeIntegerOption)(0)) // 0
 * console.log(S.is(nonNegativeIntegerOption)(-1)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const nonNegativeIntegerOption = S.Number.annotate(
	$I.annote("nonNegativeIntegerOption", {
		title: "Non-negative integer option",
		description: "A finite integral rule option greater than or equal to zero.",
	}),
).check(
	S.makeFilter(
		(n) => (Number.isInteger(n) && n >= 0 ? undefined : "Expected a non-negative integer"),
		$I.annote("nonNegativeIntegerCheck", {
			title: "Non-negative integer",
			description: "An integral number greater than or equal to zero, including integers outside the safe range.",
		}),
		true,
	),
	S.isFinite(),
);

/**
 * The decoded non-negative integer accepted by numeric lint-rule options.
 *
 * @category type-level
 * @since 0.0.0
 */
export type nonNegativeIntegerOption = typeof nonNegativeIntegerOption.Type;

/**
 * Validates positive integer options that preserve separation after YAML indicators.
 *
 * **Gotchas**
 *
 * A positive integer is required for the `maxSpacesAfter` options, where `0` would make
 * the fix delete the separation space after an indicator and fuse it with its
 * content (`- item` → `-item`, `a: val` → `a:val` — different tokens, not a
 * spacing change).
 *
 * **Example** (Require at least one separation space)
 *
 * ```ts
 * import { positiveIntegerOption } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(positiveIntegerOption)(1)) // 1
 * console.log(S.is(positiveIntegerOption)(0)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const positiveIntegerOption = S.Number.annotate(
	$I.annote("positiveIntegerOption", {
		title: "Positive integer option",
		description: "A finite integral rule option greater than or equal to one.",
	}),
).check(
	S.makeFilter(
		(n) => (Number.isInteger(n) && n >= 1 ? undefined : "Expected an integer greater than or equal to 1"),
		$I.annote("positiveIntegerCheck", {
			title: "Positive integer",
			description: "An integral number greater than or equal to one, including integers outside the safe range.",
		}),
		true,
	),
	S.isFinite(),
);

/**
 * The decoded positive integer accepted by separation-preserving lint-rule options.
 *
 * @category type-level
 * @since 0.0.0
 */
export type positiveIntegerOption = typeof positiveIntegerOption.Type;

/**
 * Identifies where a scalar sits in its parent construct.
 *
 * **Example** (Decode a mapping-key role)
 *
 * ```ts
 * import { ScalarRole } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ScalarRole)("key")) // key
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScalarRole = LiteralKit(["key", "value", "item", "root"]).pipe(
	$I.annoteSchema("ScalarRole", {
		title: "Scalar role",
		description: "The structural role of a scalar in its parent mapping, sequence or document.",
	}),
);

/**
 * The structural role assigned to a scalar during traversal.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScalarRole = typeof ScalarRole.Type;

/**
 * Walks every scalar node depth-first and supplies its structural role to the visitor.
 *
 * **Details**
 *
 * Mapping keys and values receive their respective roles; sequence elements receive
 * the `item` role. A scalar at the starting node receives the supplied role.
 * Null nodes and aliases are skipped.
 *
 * **Example** (Visit a root scalar)
 *
 * ```ts
 * import { walkScalars } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 * import { YamlScalar } from "@beep/scratchpad/effected/yaml/YamlNode"
 *
 * const node = YamlScalar.make({ value: "hello", style: "plain", offset: 0, length: 5 })
 * let visitedRole = ""
 * walkScalars(node, "root", (_scalar, role) => { visitedRole = role })
 * console.log(visitedRole) // root
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const walkScalars: {
	(role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): (node: YamlNode | null) => void;
	(node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): void;
} = dual(3, (node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): void => {
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
});

/**
 * Detects when the first content of a line continues a scalar token that began on an earlier line.
 *
 * **Details**
 *
 * This includes block-scalar bodies and multi-line plain/quoted scalars.
 * The indentation rule skips such lines: their layout is the value's,
 * not block structure's.
 *
 * **Example** (Recognize a multi-line scalar continuation)
 *
 * ```ts
 * import { isScalarContinuationLine } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 * import { YamlToken } from "@beep/scratchpad/effected/yaml/YamlToken"
 *
 * const token = YamlToken.make({
 *   kind: "scalar", text: '"a\nb"', offset: 0, length: 5, line: 0, character: 0
 * })
 * console.log(isScalarContinuationLine([token], 3, 3)) // true
 * console.log(isScalarContinuationLine([token], 0, 0)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isScalarContinuationLine: {
	(lineOffset: number, probeOffset: number): (tokens: ReadonlyArray<YamlToken>) => boolean;
	(tokens: ReadonlyArray<YamlToken>, lineOffset: number, probeOffset: number): boolean;
} = dual(3, (tokens: ReadonlyArray<YamlToken>, lineOffset: number, probeOffset: number): boolean => {
	const token = coveringToken(tokens, probeOffset);
	return token !== undefined && token.kind === "scalar" && token.offset < lineOffset;
});

/**
 * Finds the token whose span covers an offset, when one does.
 *
 * **Details**
 *
 * Binary search requires tokens ordered by offset. A span includes its start and
 * excludes its end; uncovered offsets return `undefined`.
 *
 * **Example** (Find a token within its half-open span)
 *
 * ```ts
 * import { coveringToken } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 * import { YamlToken } from "@beep/scratchpad/effected/yaml/YamlToken"
 *
 * const token = YamlToken.make({
 *   kind: "scalar", text: "hello", offset: 0, length: 5, line: 0, character: 0
 * })
 * console.log(coveringToken([token], 2)?.text) // hello
 * console.log(coveringToken([token], 5)) // undefined
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const coveringToken: {
	(offset: number): (tokens: ReadonlyArray<YamlToken>) => YamlToken | undefined;
	(tokens: ReadonlyArray<YamlToken>, offset: number): YamlToken | undefined;
} = dual(2, (tokens: ReadonlyArray<YamlToken>, offset: number): YamlToken | undefined => {
	let lo = 0;
	let hi = tokens.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const token = A.getUnsafe(tokens, mid);
		if (offset < token.offset) {
			hi = mid - 1;
		} else if (offset >= token.offset + token.length) {
			lo = mid + 1;
		} else {
			return token;
		}
	}
	return undefined;
});

/**
 * Detects when an offset falls inside a scalar token's span.
 *
 * **Gotchas**
 *
 * Layout rules use this to stay off scalar CONTENT — trailing whitespace or blank lines
 * inside a block scalar are part of the parsed value, and a lint layer that
 * edits content under the banner of layout is corrupting, not fixing.
 *
 * **Example** (Protect scalar content from layout edits)
 *
 * ```ts
 * import { insideScalarSpan } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 * import { YamlToken } from "@beep/scratchpad/effected/yaml/YamlToken"
 *
 * const token = YamlToken.make({
 *   kind: "scalar", text: "hello", offset: 0, length: 5, line: 0, character: 0
 * })
 * console.log(insideScalarSpan([token], 2)) // true
 * console.log(insideScalarSpan([token], 5)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const insideScalarSpan: {
	(offset: number): (tokens: ReadonlyArray<YamlToken>) => boolean;
	(tokens: ReadonlyArray<YamlToken>, offset: number): boolean;
} = dual(2, (tokens: ReadonlyArray<YamlToken>, offset: number): boolean => coveringToken(tokens, offset)?.kind === "scalar");

/**
 * Locates the line containing an offset and the character index within it.
 *
 * **Details**
 *
 * Uses a binary search over the ordered `LintLine` array (lines are ordered by
 * `offset`, the same invariant {@link coveringToken} rests on for tokens).
 * Returns line zero and character zero when no line starts at or before the offset.
 *
 * **Example** (Locate a character on the second line)
 *
 * ```ts
 * import { positionAt } from "@beep/scratchpad/effected/yaml/internal/rules/util"
 *
 * const lines = [
 *   { text: "a", offset: 0, number: 0 },
 *   { text: "hello", offset: 2, number: 1 }
 * ]
 * const position = positionAt(lines, 4)
 * console.log(position.line) // 1
 * console.log(position.character) // 2
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const positionAt: {
	(offset: number): (lines: ReadonlyArray<LintLine>) => { readonly line: number; readonly character: number };
	(lines: ReadonlyArray<LintLine>, offset: number): { readonly line: number; readonly character: number };
} = dual(2, (lines: ReadonlyArray<LintLine>, offset: number): { readonly line: number; readonly character: number } => {
	let lo = 0;
	let hi = lines.length - 1;
	let found: LintLine | undefined;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const line = A.getUnsafe(lines, mid);
		if (line.offset <= offset) {
			found = line;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return found === undefined ? { line: 0, character: 0 } : { line: found.number, character: offset - found.offset };
});

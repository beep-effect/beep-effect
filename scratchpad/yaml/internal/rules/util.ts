/**
 * Shared lint-rule helpers: span queries over the eager token array, the
 * scalar walk the style rules share, and the bounded numeric option schemas.
 *
 * **Details**
 *
 * Schemas use the YAML scratchpad identity composer so diagnostics and
 * generated documentation retain stable identifiers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import { dual } from "effect/Function";
import type { LintLine } from "../../YamlLintRule.ts";
import type { YamlNode, YamlScalar } from "../../YamlNode.ts";
import { YamlScalar as Scalar, YamlMap, YamlSeq } from "../../YamlNode.ts";
import type { YamlToken } from "../../YamlToken.ts";

const $I = $ScratchpadId.create("yaml/internal/rules/util");

type LintPosition = { readonly line: number; readonly character: number };

/**
 * A non-negative integer — the shape every numeric rule option takes.
 * Rejects NaN, negatives and fractions with a message naming the constraint;
 * the config layer's wrapper names the rule and the field.
 *
 * **Example** (Reject a negative line-length max)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * let rejected = false
 * try {
 *   YamlLintConfig.make({ rules: { "line-length": { max: -1 } } })
 * } catch {
 *   rejected = true
 * }
 * console.log(rejected) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const nonNegativeIntegerOption = Schema.Finite.check(
	Schema.makeFilter((n) => (Number.isInteger(n) && n >= 0 ? undefined : "Expected a non-negative integer")),
).pipe(
	$I.annoteSchema("nonNegativeIntegerOption", {
		description: "Finite non-negative integer accepted by numeric YAML lint-rule options.",
	}),
);

/**
 * A positive integer — for the `maxSpacesAfter` options, where `0` would make
 * the fix delete the separation space after an indicator and fuse it with its
 * content (`- item` → `-item`, `a: val` → `a:val` — different tokens, not a
 * spacing change).
 *
 * **Gotchas**
 *
 * Schema decode of `0` fails. A hand-built `{ maxSpacesAfter: 0 }` is still
 * clamped at runtime in {@link colonSpacing} / {@link hyphenSpacing}.
 *
 * **Example** (Reject a zero after-colon budget)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * let rejected = false
 * try {
 *   YamlLintConfig.make({ rules: { "colon-spacing": { maxSpacesAfter: 0 } } })
 * } catch {
 *   rejected = true
 * }
 * console.log(rejected) // true
 * ```
 *
 * @see {@link colonSpacing} for the runtime clamp that backs this schema.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const positiveIntegerOption = Schema.Finite.check(
	Schema.makeFilter((n) =>
		Number.isInteger(n) && n >= 1 ? undefined : "Expected an integer greater than or equal to 1",
	),
).pipe(
	$I.annoteSchema("positiveIntegerOption", {
		description: "Finite positive integer accepted by YAML spacing-rule option budgets.",
	}),
);

/**
 * Where a scalar sits in its parent construct.
 *
 * **Example** (Guard a scalar role)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ScalarRole } from "@beep/scratchpad/yaml/internal/rules/util"
 *
 * console.log(S.is(ScalarRole)("key")) // true
 * ```
 *
 * @see {@link walkScalars} for the walk that yields this role.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const ScalarRole = Schema.Literals(["key", "value", "item", "root"]).pipe(
	$I.annoteSchema("ScalarRole", {
		description: "Structural role occupied by a scalar while a YAML lint rule walks the AST.",
	}),
);

/**
 * TypeScript representation of structural role occupied by a scalar while a YAML lint rule walks the AST.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ScalarRole = typeof ScalarRole.Type;

/**
 * Depth-first walk over every scalar node with its structural role.
 *
 * **Example** (Truthy uses this walk to visit keys and values)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("on: push\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { truthy: "error" },
 * }))
 * console.log(hits.some((d) => d.rule === "truthy")) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const walkScalars: {
	(role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): (node: YamlNode | null) => void;
	(node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): void;
} = dual(3, (node: YamlNode | null, role: ScalarRole, visit: (scalar: YamlScalar, role: ScalarRole) => void): void => {
	if (node === null) return;
	if (Scalar.is(node)) {
		visit(node, role);
		return;
	}
	if (YamlMap.is(node)) {
		for (const pair of node.items) {
			walkScalars(pair.key, "key", visit);
			walkScalars(pair.value, "value", visit);
		}
		return;
	}
	if (YamlSeq.is(node)) {
		for (const item of node.items) walkScalars(item, "item", visit);
	}
});

/**
 * True when the first content of a line is the continuation of a scalar
 * token that began on an earlier line — block-scalar bodies and multi-line
 * plain/quoted scalars. The indentation rule skips such lines: their layout
 * is the value's, not block structure's.
 *
 * **Gotchas**
 *
 * Layout rules must not edit those lines. A `|` body that looks
 * "over-indented" is content.
 *
 * **Example** (Block-scalar body is not an indentation miss)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("a: |\n     keep\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { indentation: { spaces: 2 } },
 * }))
 * console.log(hits.every((d) => d.rule !== "indentation")) // true
 * ```
 *
 * @see {@link insideScalarSpan} for the offset-level scalar firewall.
 * @internal
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
 * The token whose span covers `offset`, when one does.
 *
 * **Example** (Public tokens still tile the source)
 *
 * ```ts
 * import { Result } from "effect"
 * import { YamlTokens } from "@beep/scratchpad/yaml"
 *
 * const result = YamlTokens.tokenize("a: 1\n")
 * console.log(Result.isSuccess(result) && result.success[0]?.kind === "scalar") // true
 * ```
 *
 * @internal
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
});

/**
 * True when `offset` falls inside a scalar token's span. Layout rules use
 * this to stay off scalar content — trailing whitespace or blank lines
 * inside a block scalar are part of the parsed value, and a lint layer that
 * edits content under the banner of layout is corrupting, not fixing.
 *
 * **Gotchas**
 *
 * Porting yamllint tests that flag trailing spaces inside `|` scalars will
 * look like rule bugs. This predicate is the corruption firewall for
 * {@link trailingSpaces} and {@link emptyLines}.
 *
 * **Example** (Block-scalar trailing spaces are not a layout hit)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("a: |\n  keep  \n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "trailing-spaces": "error" },
 * }))
 * console.log(hits.every((d) => d.rule !== "trailing-spaces")) // true
 * ```
 *
 * @see {@link trailingSpaces} for a layout rule that consults this predicate.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const insideScalarSpan: {
	(offset: number): (tokens: ReadonlyArray<YamlToken>) => boolean;
	(tokens: ReadonlyArray<YamlToken>, offset: number): boolean;
} = dual(2, (tokens: ReadonlyArray<YamlToken>, offset: number): boolean => coveringToken(tokens, offset)?.kind === "scalar");

/**
 * The line containing `offset` and the character index within it — a binary
 * search over the ordered `LintLine` array (lines are ordered by `offset`,
 * the same invariant {@link coveringToken} rests on for tokens).
 *
 * **Example** (Diagnostics carry line and character)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("a: 1  \n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "trailing-spaces": "error" },
 * }))
 * const hit = hits.find((d) => d.rule === "trailing-spaces")
 * console.log(hit?.line === 0) // true
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const positionAt: {
	(lines: ReadonlyArray<LintLine>, offset: number): LintPosition;
	(offset: number): (lines: ReadonlyArray<LintLine>) => LintPosition;
} = dual(2, (lines: ReadonlyArray<LintLine>, offset: number): LintPosition => {
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
});

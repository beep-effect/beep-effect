// colon-spacing: spaces around the block-mapping `:` indicator —
// none before it (a `key :` reads as a key containing a space), at most one
// after it. An explicit-value `:` at the head of its line is structure, not
// spacing, and a comment after the colon belongs to comments-spacing.

import { $ScratchpadId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { nonNegativeIntegerOption, positiveIntegerOption } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/colon-spacing");

/**
 * Options for `colon-spacing`: `maxSpacesBefore` (default 0) and
 * `maxSpacesAfter` (default 1) around the `:` indicator.
 *
 * **Gotchas**
 *
 * `maxSpacesBefore: 0` is legal (`key:` needs no space before the colon),
 * but at least one separation space must FOLLOW it — `0` would make the fix
 * emit `a:val`, a plain scalar, not a mapping entry.
 *
 * **Example** (Decode colon-spacing options)
 *
 * ```ts
 * import { colonSpacingOptions } from "@beep/scratchpad/effected/yaml/internal/rules/colon-spacing";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(colonSpacingOptions)({ maxSpacesBefore: 0, maxSpacesAfter: 1 });
 * console.log(options.maxSpacesAfter); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const colonSpacingOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for colon-spacing findings, defaulting to `error`" }),
	maxSpacesBefore: S.optionalKey(nonNegativeIntegerOption).annotateKey({ description: "Maximum spaces between preceding line content and a block-mapping `:`, defaulting to 0" }),
	maxSpacesAfter: S.optionalKey(positiveIntegerOption).annotateKey({ description: "Maximum spaces between a block-mapping `:` and its same-line value, at least 1 and defaulting to 1" }),
}).pipe($I.annoteSchema("colonSpacingOptions", { description: "Options for `colon-spacing`: `maxSpacesBefore` (default 0) and `maxSpacesAfter` (default 1) around the `:` indicator. `maxSpacesBefore: 0` is legal (`key:` needs no space before the colon), but at least one separation space must FOLLOW it — `0` would make the fix emit `a:val`, a plain scalar, not a mapping entry." }));

/**
 * Decoded options for block-mapping colon spacing.
 *
 * @category type-level
 * @since 0.0.0
 */
export type colonSpacingOptions = typeof colonSpacingOptions.Type;

/**
 * Enforces spacing around the block-mapping `:` indicator.
 *
 * **Details**
 *
 * The default permits no spaces before the colon and at most one after it.
 * An explicit-value colon at the head of its line is structure rather than
 * spacing; a comment after the colon belongs to the comments-spacing rule.
 *
 * **Example** (Report colon-spacing violations)
 *
 * ```ts
 * import { colonSpacing } from "@beep/scratchpad/effected/yaml/internal/rules/colon-spacing";
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/effected/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({ rules: { "colon-spacing": "error" } });
 * const diagnostics = YamlLint.run("a:  1\n", [colonSpacing], config);
 * console.log(diagnostics[0]?.message); // Too many spaces after ":" (2 > 1)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const colonSpacing: YamlRule = {
	id: "colon-spacing",
	check: (ctx, options) => {
		const opts = P.isObject(options) ? options : {};
		const maxBefore = P.isNumber(opts.maxSpacesBefore) ? opts.maxSpacesBefore : 0;
		// Clamped so a hand-built options object cannot bypass the schema and
		// delete the separation space.
		const maxAfter = Math.max(1, P.isNumber(opts.maxSpacesAfter) ? opts.maxSpacesAfter : 1);
		const out: Array<YamlLintDiagnostic> = [];
		for (const token of ctx.tokens) {
			if (token.kind !== "block-map-value") continue;
			// Spaces before: count the run, but only when non-space content
			// precedes it on the line — a `:` opening an explicit value sits
			// after indentation, which is not "space before the colon".
			let i = token.offset - 1;
			let before = 0;
			while (i >= 0 && ctx.text[i] === " ") {
				before++;
				i--;
			}
			const hasContentBefore = i >= 0 && ctx.text[i] !== "\n" && ctx.text[i] !== "\r" && ctx.text[i] !== "\t";
			if (hasContentBefore && before > maxBefore) {
				out.push(
					YamlLintDiagnostic.make({
						rule: "colon-spacing",
						severity: "error",
						message: `Too many spaces before ":" (${before} > ${maxBefore})`,
						offset: token.offset - before,
						length: before,
						line: token.line,
						character: token.character - before,
						fix: YamlEdit.make({
							offset: token.offset - before,
							length: before - maxBefore,
							content: "",
						}),
					}),
				);
			}
			// Spaces after: at most maxAfter before the value — unless the line
			// ends (value on the next line) or a comment follows (that spacing
			// is comments-spacing's business).
			let j = token.offset + token.length;
			let after = 0;
			while (j < ctx.text.length && ctx.text[j] === " ") {
				after++;
				j++;
			}
			const next = ctx.text[j];
			if (next === undefined || next === "\n" || next === "\r" || next === "#") continue;
			if (after > maxAfter) {
				out.push(
					YamlLintDiagnostic.make({
						rule: "colon-spacing",
						severity: "error",
						message: `Too many spaces after ":" (${after} > ${maxAfter})`,
						offset: token.offset + token.length,
						length: after,
						line: token.line,
						character: token.character + token.length,
						fix: YamlEdit.make({
							offset: token.offset + token.length,
							length: after - maxAfter,
							content: "",
						}),
					}),
				);
			}
		}
		return out;
	},
};

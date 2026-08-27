// colon-spacing (#129): spaces around the block-mapping `:` indicator —
// none before it (a `key :` reads as a key containing a space), at most one
// after it. An explicit-value `:` at the head of its line is structure, not
// spacing, and a comment after the colon belongs to comments-spacing.

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { nonNegativeIntegerOption, positiveIntegerOption } from "./util.ts";

/**
 * Options for `colon-spacing`: `maxSpacesBefore` (default 0) and
 * `maxSpacesAfter` (default 1) around the `:` indicator. `maxSpacesBefore: 0`
 * is legal (`key:` needs no space before the colon), but at least one
 * separation space must FOLLOW it — `0` would make the fix emit `a:val`, a
 * plain scalar, not a mapping entry.
 */
export const colonSpacingOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	maxSpacesBefore: Schema.optionalKey(nonNegativeIntegerOption),
	maxSpacesAfter: Schema.optionalKey(positiveIntegerOption),
});

interface ColonSpacingOptions {
	readonly maxSpacesBefore?: number;
	readonly maxSpacesAfter?: number;
}

/** Spacing around the block-mapping `:` indicator. */
export const colonSpacing: YamlRule = {
	id: "colon-spacing",
	check: (ctx, options) => {
		const opts = (options ?? {}) as ColonSpacingOptions;
		const maxBefore = opts.maxSpacesBefore ?? 0;
		// Clamped so a hand-built options object cannot bypass the schema and
		// delete the separation space.
		const maxAfter = Math.max(1, opts.maxSpacesAfter ?? 1);
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
					new YamlLintDiagnostic({
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
					new YamlLintDiagnostic({
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

/**
 * hyphen-spacing: at most one space after the block-sequence `-` indicator.
 *
 * Spaces before the hyphen are indentation — the indentation rule's
 * business — and a comment after the hyphen belongs to comments-spacing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { positiveIntegerOption } from "./util.ts";

/**
 * Options for `hyphen-spacing`: `maxSpacesAfter` (default 1) after the `-`.
 * At least one separation space must follow the indicator — `0` would make
 * the fix emit `-item`, a plain scalar, not a sequence entry.
 *
 * **Example** (Keep the one-space budget)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "hyphen-spacing": { maxSpacesAfter: 1 } } })
 * console.log(config.rules["hyphen-spacing"])
 * ```
 *
 * @see {@link hyphenSpacing} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const hyphenSpacingOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	maxSpacesAfter: Schema.optionalKey(positiveIntegerOption),
});

interface HyphenSpacingOptions {
	readonly maxSpacesAfter?: number;
}

/**
 * Spacing after the block-sequence `-` indicator.
 *
 * **Gotchas**
 *
 * Runtime `maxSpacesAfter` is clamped with `Math.max(1, …)` so a hand-built
 * `{ maxSpacesAfter: 0 }` cannot emit `-item`. Spaces before the hyphen are
 * indentation, not this rule.
 *
 * **Example** (Flag extra spaces after `-`)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("-  item\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "hyphen-spacing": "error" },
 * }))
 * console.log(hits.some((d) => d.rule === "hyphen-spacing")) // true
 * ```
 *
 * @see {@link positiveIntegerOption} for the schema that rejects `0`.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const hyphenSpacing: YamlRule = {
	id: "hyphen-spacing",
	check: (ctx, options) => {
		const opts = (options ?? {}) as HyphenSpacingOptions;
		// Clamped so a hand-built options object cannot bypass the schema and
		// delete the separation space.
		const maxAfter = Math.max(1, opts.maxSpacesAfter ?? 1);
		const out: Array<YamlLintDiagnostic> = [];
		for (const token of ctx.tokens) {
			if (token.kind !== "block-seq-entry") continue;
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
						rule: "hyphen-spacing",
						severity: "error",
						message: `Too many spaces after "-" (${after} > ${maxAfter})`,
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

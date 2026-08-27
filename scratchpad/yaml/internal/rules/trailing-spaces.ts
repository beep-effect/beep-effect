/**
 * trailing-spaces: no trailing whitespace at line ends — except inside
 * scalar content, where trailing whitespace is part of the parsed value.
 *
 * Recorded divergence from yamllint, which flags content too. A layout
 * rule must not corrupt values, and its fix certainly must not.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { insideScalarSpan } from "./util.ts";

/**
 * Options for `trailing-spaces` (severity only — nothing to tune).
 *
 * **Example** (Enable as an error)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "trailing-spaces": "error" } })
 * console.log(config.rules["trailing-spaces"]) // "error"
 * ```
 *
 * @see {@link trailingSpaces} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const trailingSpacesOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
});

/**
 * Trailing spaces or tabs at the end of a line, with a deleting fix.
 *
 * **Gotchas**
 *
 * Trailing whitespace inside a `|` scalar is value, not layout. Porting
 * yamllint tests that flag those lines will look like rule bugs.
 *
 * **Example** (Mapping line vs block-scalar body)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "trailing-spaces": "error" } })
 * const mapping = YamlLint.run("a: 1  \n", YamlLint.builtins, config)
 * console.log(mapping.some((d) => d.rule === "trailing-spaces")) // true
 *
 * const scalar = YamlLint.run("a: |\n  keep  \n", YamlLint.builtins, config)
 * console.log(scalar.every((d) => d.rule !== "trailing-spaces")) // true
 * ```
 *
 * @see {@link insideScalarSpan} for the scalar-content firewall.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const trailingSpaces: YamlRule = {
	id: "trailing-spaces",
	check: (ctx) => {
		const out: Array<YamlLintDiagnostic> = [];
		for (const line of ctx.lines) {
			// Line text excludes the terminator (CRLF's `\r` included), so a
			// plain end-of-text match sees exactly the trailing run; the fix span
			// stays in source coordinates and never touches the terminator.
			const match = /[ \t]+$/.exec(line.text);
			if (match === null) continue;
			const runOffset = line.offset + match.index;
			// Trailing whitespace inside scalar content is the value's business.
			if (insideScalarSpan(ctx.tokens, runOffset)) continue;
			out.push(
				YamlLintDiagnostic.make({
					rule: "trailing-spaces",
					severity: "error",
					message: "Trailing whitespace",
					offset: runOffset,
					length: match[0].length,
					line: line.number,
					character: match.index,
					fix: YamlEdit.make({ offset: runOffset, length: match[0].length, content: "" }),
				}),
			);
		}
		return out;
	},
};

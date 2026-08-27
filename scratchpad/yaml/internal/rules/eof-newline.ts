/**
 * eof-newline: a non-empty document must end with a newline.
 *
 * The fix inserts one — a zero-length surgical edit at end-of-input.
 * Empty documents are skipped.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";

/**
 * Options for `eof-newline` (severity only — nothing to tune).
 *
 * **Example** (Enable as an error)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "eof-newline": "error" } })
 * console.log(config.rules["eof-newline"]) // "error"
 * ```
 *
 * @see {@link eofNewline} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const eofNewlineOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
});

/**
 * A missing final newline, with an inserting fix.
 *
 * **Example** (Insert a newline at EOF)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("a: 1", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "eof-newline": "error" },
 * }))
 * const fix = hits.find((d) => d.rule === "eof-newline")?.fix
 * console.log(fix?.content === "\n") // true
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const eofNewline: YamlRule = {
	id: "eof-newline",
	check: (ctx) => {
		if (ctx.text.length === 0 || ctx.text.endsWith("\n")) return [];
		const lastLine = ctx.lines[ctx.lines.length - 1];
		if (lastLine === undefined) return [];
		return [
			new YamlLintDiagnostic({
				rule: "eof-newline",
				severity: "error",
				message: "No newline at end of file",
				offset: ctx.text.length,
				length: 0,
				line: lastLine.number,
				character: lastLine.text.length,
				fix: YamlEdit.make({ offset: ctx.text.length, length: 0, content: "\n" }),
			}),
		];
	},
};

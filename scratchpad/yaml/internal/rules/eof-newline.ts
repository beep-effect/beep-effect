// eof-newline (#129): a non-empty document must end with a newline. The fix
// inserts one — a zero-length surgical edit at end-of-input.

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";

/** Options for `eof-newline` (severity only — nothing to tune). */
export const eofNewlineOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
});

/** A missing final newline, with an inserting fix. */
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

// trailing-spaces (#129): no trailing whitespace at line ends — except
// inside scalar content, where trailing whitespace is part of the parsed
// value (a recorded divergence from yamllint, which flags content too; a
// layout rule must not corrupt values, and its fix certainly must not).

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { insideScalarSpan } from "./util.ts";

/** Options for `trailing-spaces` (severity only — nothing to tune). */
export const trailingSpacesOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
});

/** Trailing spaces or tabs at the end of a line, with a deleting fix. */
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
				new YamlLintDiagnostic({
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

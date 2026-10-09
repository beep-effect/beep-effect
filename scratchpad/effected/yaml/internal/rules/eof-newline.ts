// eof-newline: a non-empty document must end with a newline. The fix
// inserts one — a zero-length surgical edit at end-of-input.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/eof-newline");

/** Options for `eof-newline` (severity only — nothing to tune). */
export const eofNewlineOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for missing final-newline findings, defaulting to `error`" }),
}).pipe($I.annoteSchema("eofNewlineOptions", { description: "Options for `eof-newline` (severity only — nothing to tune)." }));

/** A missing final newline, with an inserting fix. */
export const eofNewline: YamlRule = {
	id: "eof-newline",
	check: (ctx) => {
		if (ctx.text.length === 0 || ctx.text.endsWith("\n")) return [];
		const lastLine = ctx.lines[ctx.lines.length - 1];
		if (lastLine === undefined) return [];
		return [
			YamlLintDiagnostic.make({
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

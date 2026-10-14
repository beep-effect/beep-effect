// eof-newline: a non-empty document must end with a newline. The fix
// inserts one — a zero-length surgical edit at end-of-input.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { walkScalars } from "./util.ts";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/eof-newline");

/**
 * Configure the reporting severity for a missing final newline.
 *
 * **Details**
 *
 * Options for `eof-newline` (severity only — nothing to tune).
 *
 * **Example** (Decode eof-newline options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { eofNewlineOptions } from "@beep/scratchpad/effected/yaml/internal/rules/eof-newline";
 *
 * const options = S.decodeUnknownSync(eofNewlineOptions)({ severity: "warning" });
 * console.log(options.severity) // warning
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const eofNewlineOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for missing final-newline findings, defaulting to `error`" }),
}).pipe($I.annoteSchema("eofNewlineOptions", { description: "Options for `eof-newline` (severity only — nothing to tune)." }));
/**
 * Decoded options for the `eof-newline` lint rule.
 *
 * @category type-level
 * @since 0.0.0
 */
export type eofNewlineOptions = typeof eofNewlineOptions.Type;

/**
 * Report a missing final newline, with an inserting fix.
 *
 * **Details**
 *
 * Empty input is accepted. For non-empty input without a final newline, the
 * fix inserts a newline with a zero-length edit at the end of the source.
 * The diagnostic has no fix when completing a keep-chomp scalar blank line
 * would add a retained content newline.
 *
 * **Example** (Find a missing final newline)
 *
 * ```ts
 * import { eofNewline } from "@beep/scratchpad/effected/yaml/internal/rules/eof-newline";
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/effected/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "eof-newline": {} },
 * });
 * const diagnostics = YamlLint.run("name: Ada", [eofNewline], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const eofNewline: YamlRule = {
	id: "eof-newline",
	check: (ctx) => {
		if (ctx.text.length === 0 || ctx.text.endsWith("\n")) return [];
		const lastLine = ctx.lines[ctx.lines.length - 1];
		if (lastLine === undefined) return [];
		let addsContentBreak = false;
		if (/^ +$/.test(lastLine.text)) {
			walkScalars(ctx.document.contents, "root", (scalar) => {
				if (scalar.chomp !== "keep" || (scalar.style !== "block-literal" && scalar.style !== "block-folded") ||
					!P.isString(scalar.value) || scalar.offset >= lastLine.offset ||
					lastLine.offset >= scalar.offset + scalar.length) return;
				const firstContent = A.findFirst(ctx.lines, (line) => line.offset > scalar.offset &&
					line.offset < scalar.offset + scalar.length && !/^[ \t]*$/.test(line.text));
				const firstValueContent = A.findFirst(Str.split(scalar.value, "\n"), (line) => !/^[ \t]*$/.test(line));
				if (O.isNone(firstContent)) {
					// A wholly blank scalar gains a break only when an earlier body
					// line was completed; its lone unfinished line already clips to one.
					addsContentBreak = A.some(ctx.lines, (line) => line.offset > scalar.offset && line.offset < lastLine.offset);
					return;
				}
				if (O.isNone(firstValueContent)) return;
				let sourceSpaces = 0;
				while (firstContent.value.text[sourceSpaces] === " ") sourceSpaces++;
				let valueSpaces = 0;
				while (firstValueContent.value[valueSpaces] === " ") valueSpaces++;
				// Extra spaces beyond the content indent are scalar text: completing
				// that line already has the same implicit final content break. A
				// blank line within the indent instead gains a keep-chomp break.
				if (lastLine.text.length <= sourceSpaces - valueSpaces) addsContentBreak = true;
			});
		}
		const fix = addsContentBreak ? undefined : YamlEdit.make({ offset: ctx.text.length, length: 0, content: "\n" });
		return [
			YamlLintDiagnostic.make({
				rule: "eof-newline",
				severity: "error",
				message: "No newline at end of file",
				offset: ctx.text.length,
				length: 0,
				line: lastLine.number,
				character: lastLine.text.length,
				...O.getSomesStruct({ fix: O.fromUndefinedOr(fix) }),
			}),
		];
	},
};

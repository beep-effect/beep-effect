// eof-newline: a non-empty document must end with a newline. The fix
// inserts one — a zero-length surgical edit at end-of-input.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
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

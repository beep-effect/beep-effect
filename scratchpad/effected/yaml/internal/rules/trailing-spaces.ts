// trailing-spaces: no trailing whitespace at line ends — except
// inside scalar content, where trailing whitespace is part of the parsed
// value (a recorded divergence from yamllint, which flags content too; a
// layout rule must not corrupt values, and its fix certainly must not).

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { insideScalarSpan } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/trailing-spaces");

/**
 * Validates the reporting severity for trailing-whitespace findings.
 *
 * **Details**
 *
 * Options for `trailing-spaces` contain severity only — nothing to tune.
 *
 * **Example** (Validate warning-level whitespace reports)
 *
 * ```ts
 * import { trailingSpacesOptions } from "@beep/scratchpad/effected/yaml/internal/rules/trailing-spaces"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(trailingSpacesOptions)({ severity: "warning" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const trailingSpacesOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for trailing-whitespace findings, defaulting to `error`" }),
}).pipe($I.annoteSchema("trailingSpacesOptions", { description: "Options for `trailing-spaces` (severity only — nothing to tune)." }));
/**
 * The decoded reporting options accepted by the trailing-spaces rule.
 *
 * @see {@link trailingSpacesOptions} for the options validation schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type trailingSpacesOptions = typeof trailingSpacesOptions.Type;

/**
 * Reports trailing spaces or tabs at the end of a line, with a deleting fix.
 *
 * **Details**
 *
 * Fix spans use source coordinates and leave line terminators intact,
 * including CRLF terminators.
 *
 * **Gotchas**
 *
 * Trailing whitespace inside scalar content is preserved because it is
 * part of the parsed value; a layout rule and its fix must not corrupt values.
 *
 * **Example** (Identify the whitespace cleanup rule)
 *
 * ```ts
 * import { trailingSpaces } from "@beep/scratchpad/effected/yaml/internal/rules/trailing-spaces"
 *
 * console.log(trailingSpaces.id) // trailing-spaces
 * ```
 *
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

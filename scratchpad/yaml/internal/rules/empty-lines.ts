/**
 * empty-lines: caps runs of consecutive blank lines — in the body (`max`),
 * at document start (`maxStart`) and at document end (`maxEnd`).
 *
 * Blank lines inside scalar content are the value's business and are
 * skipped. The fix deletes the excess lines surgically.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleFloor, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { insideScalarSpan, nonNegativeIntegerOption } from "./util.ts";

/**
 * Options for `empty-lines`: `max` consecutive blank lines in the body
 * (default 2), `maxStart` at the document start and `maxEnd` at the end
 * (both default 0).
 *
 * **Example** (Cap body blanks at two)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "empty-lines": { max: 2 } } })
 * console.log(config.rules["empty-lines"])
 * ```
 *
 * @see {@link emptyLines} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const emptyLinesOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	max: Schema.optionalKey(nonNegativeIntegerOption),
	maxStart: Schema.optionalKey(nonNegativeIntegerOption),
	maxEnd: Schema.optionalKey(nonNegativeIntegerOption),
});

interface EmptyLinesOptions {
	readonly max?: number;
	readonly maxStart?: number;
	readonly maxEnd?: number;
}

/**
 * Runs of blank lines beyond the configured caps, with a deleting fix.
 *
 * **Gotchas**
 *
 * A blank line inside a `|` scalar is value, not layout — {@link insideScalarSpan}
 * skips it so a "helpful" deletion cannot grow or shrink the parsed string.
 *
 * **Example** (Body blanks are flagged; block-scalar interior blanks are not)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "empty-lines": { max: 1 } } })
 * const body = YamlLint.run("a: 1\n\n\n\nb: 2\n", YamlLint.builtins, config)
 * console.log(body.some((d) => d.rule === "empty-lines")) // true
 *
 * const scalar = YamlLint.run("a: |\n  keep\n\n  this\n", YamlLint.builtins, config)
 * console.log(scalar.every((d) => d.rule !== "empty-lines")) // true
 * ```
 *
 * @see {@link insideScalarSpan} for the scalar-content firewall.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const emptyLines: YamlRule = {
	id: "empty-lines",
	check: (ctx: LintContext, options) => {
		const opts = (options ?? {}) as EmptyLinesOptions;
		const max = opts.max ?? 2;
		const maxStart = opts.maxStart ?? 0;
		const maxEnd = opts.maxEnd ?? 0;
		const out: Array<YamlLintDiagnostic> = [];
		const lines = ctx.lines;
		// Line text excludes the terminator whole (a CRLF blank line is `""`),
		// but fix spans are SOURCE coordinates: the deletion below derives its
		// end from the next line's offset so a CRLF terminator goes whole.
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			if (line === undefined || line.text !== "" || insideScalarSpan(ctx.tokens, line.offset)) {
				i++;
				continue;
			}
			// A run of blank lines [i, end).
			let end = i;
			while (end < lines.length && (lines[end]?.text ?? "x") === "") end++;
			const runLength = end - i;
			const atStart = i === 0;
			const atEnd = end === lines.length;
			const allowed = atStart ? maxStart : atEnd ? maxEnd : max;
			if (runLength > allowed) {
				const firstExcess = lines[i + allowed];
				const lastBlank = lines[end - 1];
				if (firstExcess !== undefined && lastBlank !== undefined) {
					// Delete from the first excess blank line's start through the
					// last blank line's terminator — derived from the NEXT line's
					// offset (or the text end) so a CRLF terminator goes whole.
					const nextLine = lines[end];
					const deleteEnd = nextLine !== undefined ? nextLine.offset : ctx.text.length;
					out.push(
						YamlLintDiagnostic.make({
							rule: "empty-lines",
							severity: "error",
							message: `Too many consecutive blank lines (${runLength} > ${allowed})`,
							offset: firstExcess.offset,
							length: deleteEnd - firstExcess.offset,
							line: firstExcess.number,
							character: 0,
							fix: YamlEdit.make({
								offset: firstExcess.offset,
								length: deleteEnd - firstExcess.offset,
								content: "",
							}),
						}),
					);
				}
			}
			i = end;
		}
		return out;
	},
	// Inference (#345): the max blank run is inferable only as a FLOOR — a
	// corpus whose longest body run is N proves `max` must be at least N to
	// accept it, not that the author would forbid N+1. The floor rides in
	// the evidence; the caps stay default-driven under both resolvers. Same
	// segmentation as the check: body runs only (start/end runs are the
	// `maxStart`/`maxEnd` caps' business), scalar content skipped.
	infer: (ctx) => {
		let longest = 0;
		const lines = ctx.lines;
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			if (line === undefined || line.text !== "" || insideScalarSpan(ctx.tokens, line.offset)) {
				i++;
				continue;
			}
			let end = i;
			while (end < lines.length && (lines[end]?.text ?? "x") === "") end++;
			if (i !== 0 && end !== lines.length && end - i > longest) longest = end - i;
			i = end;
		}
		return longest > 0 ? [StyleFloor.make({ dimension: "max", value: longest })] : [];
	},
};

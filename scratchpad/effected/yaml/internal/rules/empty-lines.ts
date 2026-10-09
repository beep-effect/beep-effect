// empty-lines: caps runs of consecutive blank lines — in the body
// (`max`), at document start (`maxStart`) and at document end (`maxEnd`).
// Blank lines inside scalar content are the value's business and are
// skipped. The fix deletes the excess lines surgically.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleFloor, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { insideScalarSpan, nonNegativeIntegerOption } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/empty-lines");

/**
 * Limit consecutive blank lines in the body and at document boundaries.
 *
 * **Details**
 *
 * Options for `empty-lines`: `max` consecutive blank lines in the body
 * (default 2), `maxStart` at the document start and `maxEnd` at the end
 * (both default 0).
 *
 * **Example** (Decode empty-lines options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { emptyLinesOptions } from "@beep/scratchpad/effected/yaml/internal/rules/empty-lines";
 *
 * const options = S.decodeUnknownSync(emptyLinesOptions)({ max: 1, maxStart: 0, maxEnd: 0 });
 * console.log(options.max) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const emptyLinesOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({
		description: "Reporting level for excessive blank-line findings, defaulting to `error`",
	}),
	max: S.optionalKey(nonNegativeIntegerOption).annotateKey({
		description: "Maximum consecutive blank lines in the document body outside scalar content, defaulting to 2",
	}),
	maxStart: S.optionalKey(nonNegativeIntegerOption).annotateKey({
		description: "Maximum consecutive blank lines at the start of the input, defaulting to 0",
	}),
	maxEnd: S.optionalKey(nonNegativeIntegerOption).annotateKey({
		description: "Maximum consecutive blank lines at the end of the input outside scalar content, defaulting to 0",
	}),
}).pipe(
	$I.annoteSchema("emptyLinesOptions", {
		description:
			"Options for `empty-lines`: `max` consecutive blank lines in the body (default 2), `maxStart` at the document start and `maxEnd` at the end (both default 0).",
	}),
);

/**
 * Decoded options for the `empty-lines` lint rule.
 *
 * @category type-level
 * @since 0.0.0
 */
export type emptyLinesOptions = typeof emptyLinesOptions.Type;

/**
 * Report runs of blank lines beyond the configured caps, with a deleting fix.
 *
 * **Details**
 *
 * Blank lines inside scalar content are skipped. Deletions cover whole line
 * terminators, including CRLF. Inference records the longest body run as a
 * floor; it does not infer the caps.
 *
 * **Example** (Count an excessive blank-line run)
 *
 * ```ts
 * import { emptyLines } from "@beep/scratchpad/effected/yaml/internal/rules/empty-lines";
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/effected/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "empty-lines": { max: 1 } },
 * });
 * const diagnostics = YamlLint.run("name: Ada\n\n\n\nnext: item\n", [emptyLines], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const emptyLines: YamlRule = {
	id: "empty-lines",
	check: (ctx: LintContext, options) => {
		const max =
			P.hasProperty(options, "max") && S.is(emptyLinesOptions.fields.max.schema)(options.max) ? options.max : 2;
		const maxStart =
			P.hasProperty(options, "maxStart") && S.is(emptyLinesOptions.fields.maxStart.schema)(options.maxStart)
				? options.maxStart
				: 0;
		const maxEnd =
			P.hasProperty(options, "maxEnd") && S.is(emptyLinesOptions.fields.maxEnd.schema)(options.maxEnd)
				? options.maxEnd
				: 0;
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
	// Inference: the max blank run is inferable only as a FLOOR — a
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

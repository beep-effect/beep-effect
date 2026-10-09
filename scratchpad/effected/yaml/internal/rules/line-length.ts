// line-length: lines must not exceed the configured maximum. No fix —
// a line can only be shortened by reflowing content, and reflowing is
// formatting, not fixing.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type { YamlRule } from "../../YamlLintRule.ts";
import { StyleFloor, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { nonNegativeIntegerOption } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/line-length");

/**
 * Options for `line-length`. `max` defaults to 120 — the kit-native line
 * width (the yamllint id is recognizable; the option surface and defaults
 * are ours).
 */
export const lineLengthOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for excessive line-length findings, defaulting to `error`" }),
	max: S.optionalKey(nonNegativeIntegerOption).annotateKey({ description: "Maximum line length in UTF-16 code units, excluding the line terminator, defaulting to 120" }),
}).pipe($I.annoteSchema("lineLengthOptions", { description: "Options for `line-length`. `max` defaults to 120 — the kit-native line width (the yamllint id is recognizable; the option surface and defaults are ours)." }));

const DEFAULT_MAX = 120;

/** Lines longer than the configured maximum. */
export const lineLength: YamlRule = {
	id: "line-length",
	check: (ctx, options) => {
		const opts = S.is(lineLengthOptions)(options) ? options : {};
		const max = opts.max ?? DEFAULT_MAX;
		const out: Array<YamlLintDiagnostic> = [];
		for (const line of ctx.lines) {
			if (line.text.length > max) {
				out.push(
					YamlLintDiagnostic.make({
						rule: "line-length",
						severity: "error",
						message: `Line is longer than ${max} characters (${line.text.length})`,
						offset: line.offset + max,
						length: line.text.length - max,
						line: line.number,
						character: max,
					}),
				);
			}
		}
		return out;
	},
	// Inference: line length is inferable only as a FLOOR — the
	// longest observed line proves `max` is at least that long, never what
	// it is. The floor rides in the evidence for callers that want it; the
	// option stays default-driven under both resolvers.
	infer: (ctx) => {
		let longest = 0;
		for (const line of ctx.lines) {
			if (line.text.length > longest) longest = line.text.length;
		}
		return longest > 0 ? [StyleFloor.make({ dimension: "max", value: longest })] : [];
	},
};

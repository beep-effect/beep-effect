// line-length: lines must not exceed the configured maximum. No fix —
// a line can only be shortened by reflowing content, and reflowing is
// formatting, not fixing.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import type { YamlRule } from "../../YamlLintRule.ts";
import { StyleFloor, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { nonNegativeIntegerOption } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/line-length");

/**
 * Configure the maximum permitted line width.
 *
 * **Details**
 *
 * Options for `line-length`. `max` defaults to 120 — the kit-native line
 * width (the yamllint id is recognizable; the option surface and defaults
 * are ours).
 *
 * **Example** (Decode line-length options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { lineLengthOptions } from "@beep/scratchpad/effected/yaml/internal/rules/line-length";
 *
 * const options = S.decodeUnknownSync(lineLengthOptions)({ max: 80 });
 * console.log(options.max) // 80
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const lineLengthOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({
		description: "Reporting level for excessive line-length findings, defaulting to `error`",
	}),
	max: S.optionalKey(nonNegativeIntegerOption).annotateKey({
		description: "Maximum line length in UTF-16 code units, excluding the line terminator, defaulting to 120",
	}),
}).pipe(
	$I.annoteSchema("lineLengthOptions", {
		description:
			"Options for `line-length`. `max` defaults to 120 — the kit-native line width (the yamllint id is recognizable; the option surface and defaults are ours).",
	}),
);

/**
 * Decoded options for the `line-length` lint rule.
 *
 * @category type-level
 * @since 0.0.0
 */
export type lineLengthOptions = typeof lineLengthOptions.Type;

const DEFAULT_MAX = 120;

/**
 * Report lines longer than the configured maximum.
 *
 * **Details**
 *
 * Lengths count UTF-16 code units and exclude line terminators. Inference
 * records the longest observed line as a floor; the configured maximum
 * remains default-driven.
 *
 * **Gotchas**
 *
 * There is no fix: shortening a line requires reflowing content, which is
 * formatting.
 *
 * **Example** (Find an overlong line)
 *
 * ```ts
 * import { lineLength } from "@beep/scratchpad/effected/yaml/internal/rules/line-length";
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/effected/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "line-length": { max: 5 } },
 * });
 * const diagnostics = YamlLint.run("name: Ada\n", [lineLength], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const lineLength: YamlRule = {
	id: "line-length",
	check: (ctx, options) => {
		const max =
			P.hasProperty(options, "max") && S.is(lineLengthOptions.fields.max.schema)(options.max)
				? options.max
				: DEFAULT_MAX;
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

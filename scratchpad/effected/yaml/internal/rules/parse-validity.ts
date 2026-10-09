// parse-validity: the always-on rule #1. Bridges the engine's
// recovered diagnostics into the lint layer — the reason `YamlLint.run`
// works on documents that do not parse.
//
// Not configurable: it cannot be demoted or disabled ("off" and severity
// overrides are rejected at config-validation time by YamlLint's config),
// and its options schema accepts no options.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic } from "../../YamlLintRule.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/parse-validity");

/**
 * Validates the empty options object for the always-on parse-validity rule.
 *
 * **Details**
 *
 * parse-validity accepts no options; the config layer additionally rejects
 * every attempt to set a severity or `"off"` on this rule.
 *
 * **Example** (Validate empty parse-validity options)
 *
 * ```ts
 * import { parseValidityOptions } from "@beep/scratchpad/effected/yaml/internal/rules/parse-validity"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(parseValidityOptions)({})) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const parseValidityOptions = S.Struct({}).pipe($I.annoteSchema("parseValidityOptions", { description: "parse-validity accepts no options; the config layer additionally rejects any attempt to set a severity or `\"off\"` on this rule." }));
/**
 * The decoded empty options object accepted by the parse-validity rule.
 *
 * @see {@link parseValidityOptions} for the options validation schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type parseValidityOptions = typeof parseValidityOptions.Type;

/**
 * Bridges recovered parser diagnostics into the always-on parse-validity lint rule.
 *
 * **Details**
 *
 * Engine errors remain lint errors, and engine warnings remain warnings.
 * This bridge lets linting report findings on documents that do not parse.
 * Duplicate-key policy belongs to the configurable key-duplicates rule.
 *
 * **Example** (Identify the mandatory parser rule)
 *
 * ```ts
 * import { parseValidity } from "@beep/scratchpad/effected/yaml/internal/rules/parse-validity"
 *
 * console.log(parseValidity.id) // parse-validity
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const parseValidity: YamlRule = {
	id: "parse-validity",
	check: (ctx: LintContext) => [
		// Engine errors are lint errors; engine warnings stay warnings.
		// (Duplicate keys never reach this bridge: the lint context composes
		// with uniqueKeys disabled because duplicate-key POLICY belongs to
		// the configurable `key-duplicates` rule.)
		...ctx.document.errors.map(
			(d) =>
				YamlLintDiagnostic.make({
					rule: "parse-validity",
					severity: "error",
					message: d.message,
					offset: d.offset,
					length: d.length,
					line: d.line,
					character: d.character,
				}),
		),
		...ctx.document.warnings.map(
			(d) =>
				YamlLintDiagnostic.make({
					rule: "parse-validity",
					severity: "warning",
					message: d.message,
					offset: d.offset,
					length: d.length,
					line: d.line,
					character: d.character,
				}),
		),
	],
};

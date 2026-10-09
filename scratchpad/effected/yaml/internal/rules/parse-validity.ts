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
 * parse-validity accepts no options; the config layer additionally rejects
 * any attempt to set a severity or `"off"` on this rule.
 */
export const parseValidityOptions = S.Struct({}).pipe($I.annoteSchema("parseValidityOptions", { description: "parse-validity accepts no options; the config layer additionally rejects any attempt to set a severity or `\"off\"` on this rule." }));
export type parseValidityOptions = typeof parseValidityOptions.Type;

/** The always-on parse-validity rule. */
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

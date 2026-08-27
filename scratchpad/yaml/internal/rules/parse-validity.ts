/**
 * parse-validity: the always-on rule #1. Bridges the engine's recovered
 * diagnostics into the lint layer — the reason `YamlLint.run` works on
 * documents that do not parse.
 *
 * Not configurable: it cannot be demoted or disabled (`"off"` and severity
 * overrides are rejected at config-validation time), and its options schema
 * accepts no options.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic } from "../../YamlLintRule.ts";

/**
 * parse-validity accepts no options; the config layer additionally rejects
 * any attempt to set a severity or `"off"` on this rule.
 *
 * **Example** (Empty options struct)
 *
 * ```ts
 * import { YamlLint } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlLint.builtins[0]?.id) // "parse-validity"
 * ```
 *
 * @see {@link parseValidity} for the always-on rule this schema belongs to.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const parseValidityOptions = Schema.Struct({});

/**
 * The always-on parse-validity rule.
 *
 * **Gotchas**
 *
 * `"off"` and severity overrides are rejected at config time. Duplicate
 * keys never reach this bridge: lint composes with `uniqueKeys` disabled
 * because duplicate-key policy belongs to {@link keyDuplicates}. Engine
 * errors become lint errors; engine warnings stay warnings.
 *
 * **Example** (Engine error becomes a parse-validity diagnostic)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("*missing\n", YamlLint.builtins, YamlLintConfig.make({ rules: {} }))
 * console.log(hits.some((d) => d.rule === "parse-validity")) // true
 *
 * const dups = YamlLint.run("a: 1\na: 2\n", YamlLint.builtins, YamlLintConfig.make({ rules: {} }))
 * console.log(dups.every((d) => d.rule !== "parse-validity")) // true
 * ```
 *
 * @see {@link keyDuplicates} for the configurable duplicate-key policy.
 * @internal
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

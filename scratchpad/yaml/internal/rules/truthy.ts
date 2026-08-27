/**
 * truthy: the YAML 1.1 boolean trap. `yes`/`no`/`on`/`off` parse as strings
 * in YAML 1.2 but read as booleans to humans (the `on:` key of a workflow
 * file is the canonical victim).
 *
 * Flags plain scalars — keys included by default — whose spelling is in
 * the 1.1 boolean family but not in `allowed`. Tagged `!!bool` / `!!str`
 * is explicit intent and never flagged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O as OU } from "@beep/utils";
import { HashSet, Schema } from "effect";
import * as P from "effect/Predicate";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { positionAt, walkScalars } from "./util.ts";

/**
 * Options for `truthy`: the `allowed` boolean spellings (default
 * `["true", "false"]`) and whether mapping keys are checked (`checkKeys`,
 * default `true` — the workflow `on:` key is the point).
 *
 * **Example** (Keep keys in scope)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { truthy: { checkKeys: true } } })
 * console.log(config.rules.truthy)
 * ```
 *
 * @see {@link truthy} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const truthyOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	allowed: Schema.optionalKey(Schema.Array(Schema.String)),
	checkKeys: Schema.optionalKey(Schema.Boolean),
});

interface TruthyOptions {
	readonly allowed?: ReadonlyArray<string>;
	readonly checkKeys?: boolean;
}

/** The YAML 1.1 boolean family, per spelling case the 1.1 grammar admits. */
const TRUTHY = HashSet.fromIterable([
	"yes",
	"Yes",
	"YES",
	"no",
	"No",
	"NO",
	"on",
	"On",
	"ON",
	"off",
	"Off",
	"OFF",
	"true",
	"True",
	"TRUE",
	"false",
	"False",
	"FALSE",
]);

const TRUE_SET = HashSet.make("yes", "on", "true");

/**
 * YAML 1.1 truthy spellings outside the allowed list.
 *
 * **Details**
 *
 * Two value-preserving fixes: a real boolean respells to the allowed
 * spelling of the same truth value; a string lookalike gets quoted so it
 * reads as the string it already is.
 *
 * **Example** (Flag `on:` and leave tagged `!!bool yes` alone)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { truthy: "error" } })
 * const workflow = YamlLint.run("on: push\n", YamlLint.builtins, config)
 * console.log(workflow.some((d) => d.rule === "truthy")) // true
 *
 * const tagged = YamlLint.run("ok: !!bool yes\n", YamlLint.builtins, config)
 * console.log(tagged.every((d) => d.rule !== "truthy")) // true
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const truthy: YamlRule = {
	id: "truthy",
	check: (ctx: LintContext, options) => {
		const opts = (options ?? {}) as TruthyOptions;
		const allowed = HashSet.fromIterable(opts.allowed ?? ["true", "false"]);
		const checkKeys = opts.checkKeys ?? true;
		const out: Array<YamlLintDiagnostic> = [];
		walkScalars(ctx.document.contents, "root", (scalar, role) => {
			if (role === "key" && !checkKeys) return;
			if (scalar.style !== "plain" || scalar.tag !== undefined) return;
			const raw = ctx.text.slice(scalar.offset, scalar.offset + scalar.length);
			if (!HashSet.has(TRUTHY, raw) || HashSet.has(allowed, raw)) return;
			const pos = positionAt(ctx.lines, scalar.offset);
			const isBool = P.isBoolean(scalar.value);
			const truth = HashSet.has(TRUE_SET, raw.toLowerCase());
			const respell = truth ? "true" : "false";
			// A real boolean respells when the canonical spelling is allowed; a
			// string lookalike gets quoted. Both preserve the parsed value.
			const fix = isBool
				? HashSet.has(allowed, respell)
					? YamlEdit.make({ offset: scalar.offset, length: scalar.length, content: respell })
					: undefined
				: YamlEdit.make({ offset: scalar.offset, length: scalar.length, content: `"${raw}"` });
			out.push(
				YamlLintDiagnostic.make({
					rule: "truthy",
					severity: "error",
					message: `Truthy value "${raw}" is not in the allowed spellings`,
					offset: scalar.offset,
					length: scalar.length,
					line: pos.line,
					character: pos.character,
					...OU.getSomesStruct({ fix: OU.fromUndefinedOr(fix) }),
				}),
			);
		});
		return out;
	},
};

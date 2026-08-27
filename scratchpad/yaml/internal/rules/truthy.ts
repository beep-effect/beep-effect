// truthy (#129): the YAML 1.1 boolean trap. `yes`/`no`/`on`/`off` parse as
// STRINGS in YAML 1.2 but read as booleans to humans (the `on:` key of a
// workflow file is the canonical victim), and `True`/`FALSE` are booleans in
// spellings a config may not want. Flags plain scalars — keys included —
// whose spelling is in the 1.1 boolean family but not in `allowed`.
//
// Two value-preserving fixes: a real boolean respells to the allowed
// spelling of the same truth value; a string lookalike gets quoted so it
// reads as the string it already is. A tagged scalar (`!!bool`, `!!str`) is
// explicit intent and never flagged.

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { positionAt, walkScalars } from "./util.ts";

/**
 * Options for `truthy`: the `allowed` boolean spellings (default
 * `["true", "false"]`) and whether mapping keys are checked (`checkKeys`,
 * default `true` — the workflow `on:` key is the point).
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
const TRUTHY = new Set([
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

const TRUE_SET = new Set(["yes", "on", "true"]);

/** YAML 1.1 truthy spellings outside the allowed list. */
export const truthy: YamlRule = {
	id: "truthy",
	check: (ctx: LintContext, options) => {
		const opts = (options ?? {}) as TruthyOptions;
		const allowed = new Set(opts.allowed ?? ["true", "false"]);
		const checkKeys = opts.checkKeys ?? true;
		const out: Array<YamlLintDiagnostic> = [];
		walkScalars(ctx.document.contents, "root", (scalar, role) => {
			if (role === "key" && !checkKeys) return;
			if (scalar.style !== "plain" || scalar.tag !== undefined) return;
			const raw = ctx.text.slice(scalar.offset, scalar.offset + scalar.length);
			if (!TRUTHY.has(raw) || allowed.has(raw)) return;
			const pos = positionAt(ctx.lines, scalar.offset);
			const isBool = typeof scalar.value === "boolean";
			const truth = TRUE_SET.has(raw.toLowerCase());
			const respell = truth ? "true" : "false";
			// A real boolean respells when the canonical spelling is allowed; a
			// string lookalike gets quoted. Both preserve the parsed value.
			const fix = isBool
				? allowed.has(respell)
					? YamlEdit.make({ offset: scalar.offset, length: scalar.length, content: respell })
					: undefined
				: YamlEdit.make({ offset: scalar.offset, length: scalar.length, content: `"${raw}"` });
			out.push(
				new YamlLintDiagnostic({
					rule: "truthy",
					severity: "error",
					message: `Truthy value "${raw}" is not in the allowed spellings`,
					offset: scalar.offset,
					length: scalar.length,
					line: pos.line,
					character: pos.character,
					...(fix !== undefined ? { fix } : {}),
				}),
			);
		});
		return out;
	},
};

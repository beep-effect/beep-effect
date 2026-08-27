/**
 * quoted-strings: quote-style policy for string VALUE scalars (and sequence
 * items). Keys are out of scope (they belong to `truthy` when they matter).
 *
 * **Details**
 *
 * `quoteType` defaults to double. Fixes are conservative: a quote swap or
 * wrap happens only when it provably preserves the parsed value; otherwise
 * the diagnostic ships without a fix.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O as OU } from "@beep/utils";
import { Schema } from "effect";
import * as P from "effect/Predicate";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlScalar } from "../../YamlNode.ts";
import { requoteScalarText } from "../requote.ts";
import { positionAt, walkScalars } from "./util.ts";

/**
 * Options for `quoted-strings`: the preferred `quoteType` (default
 * `"double"`) and whether plain string scalars are `required` to be quoted
 * at all (default `false` — only already-quoted scalars are policed).
 *
 * **Example** (Prefer double quotes)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "quoted-strings": { quoteType: "double" } } })
 * console.log(config.rules["quoted-strings"])
 * ```
 *
 * @see {@link quotedStrings} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const quotedStringsOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	quoteType: Schema.optionalKey(Schema.Literals(["single", "double"])),
	required: Schema.optionalKey(Schema.Boolean),
});

interface QuotedStringsOptions {
	readonly quoteType?: "single" | "double";
	readonly required?: boolean;
}

/**
 * A value-preserving requote/wrap edit, or undefined when none is safe.
 * Delegates to the shared helper's CONSERVATIVE mode (#347) — the shipped
 * fix behavior stays exactly as released; the escaping-capable mode belongs
 * to the format path's opt-in `requoteScalars`, not the lint fix.
 */
const safeQuoteFix = (ctx: LintContext, scalar: YamlScalar, quote: '"' | "'"): YamlEdit | undefined => {
	const content = requoteScalarText(ctx.text, scalar, quote, "conservative");
	if (content === undefined) return undefined;
	return YamlEdit.make({ offset: scalar.offset, length: scalar.length, content });
};

/**
 * Quote-style policy for string value scalars.
 *
 * **Gotchas**
 *
 * Lint fixes use {@link requoteScalarText} in `"conservative"` mode only.
 * A diagnostic without a `fix` is a successful conservative skip, not an
 * incomplete implementation. Do not upgrade the lint fix to `"escaping"` —
 * that dialect belongs to format `requoteScalars`. Keys are out of scope
 * (`required: false` polices only already-quoted scalars).
 *
 * **Example** (Safe wrap vs skipped escaped scalar)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const wrap = YamlLint.run("a: hello\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "quoted-strings": { quoteType: "double", required: true } },
 * }))
 * console.log(wrap.some((d) => d.rule === "quoted-strings" && d.fix !== undefined)) // true
 *
 * const skip = YamlLint.run("a: \"hi\\tthere\"\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "quoted-strings": { quoteType: "single" } },
 * }))
 * console.log(skip.filter((d) => d.rule === "quoted-strings").every((d) => d.fix === undefined)) // true
 * ```
 *
 * @see {@link requoteScalarText} for the shared conservative/escaping helper.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const quotedStrings: YamlRule = {
	id: "quoted-strings",
	check: (ctx, options) => {
		const opts = (options ?? {}) as QuotedStringsOptions;
		const quoteType = opts.quoteType ?? "double";
		const required = opts.required ?? false;
		const quote = quoteType === "double" ? '"' : "'";
		const wrongStyle = quoteType === "double" ? "single-quoted" : "double-quoted";
		const out: Array<YamlLintDiagnostic> = [];
		walkScalars(ctx.document.contents, "root", (scalar, role) => {
			if (role === "key") return;
			if (!P.isString(scalar.value)) return;
			if (scalar.style === wrongStyle) {
				const fix = safeQuoteFix(ctx, scalar, quote);
				const pos = positionAt(ctx.lines, scalar.offset);
				out.push(
					YamlLintDiagnostic.make({
						rule: "quoted-strings",
						severity: "error",
						message: `String should use ${quoteType} quotes`,
						offset: scalar.offset,
						length: scalar.length,
						line: pos.line,
						character: pos.character,
						...OU.getSomesStruct({ fix: OU.fromUndefinedOr(fix) }),
					}),
				);
				return;
			}
			if (required && scalar.style === "plain" && scalar.length > 0) {
				const fix = safeQuoteFix(ctx, scalar, quote);
				const pos = positionAt(ctx.lines, scalar.offset);
				out.push(
					YamlLintDiagnostic.make({
						rule: "quoted-strings",
						severity: "error",
						message: `String should be quoted (${quoteType})`,
						offset: scalar.offset,
						length: scalar.length,
						line: pos.line,
						character: pos.character,
						...OU.getSomesStruct({ fix: OU.fromUndefinedOr(fix) }),
					}),
				);
			}
		});
		return out;
	},
	// Inference (#345): every already-quoted string VALUE scalar votes its
	// quote style for `quoteType` — the same scope the check polices (keys
	// excluded, plain scalars say nothing about quote preference).
	infer: (ctx) => {
		const out: Array<StyleVote> = [];
		walkScalars(ctx.document.contents, "root", (scalar, role) => {
			if (role === "key") return;
			if (!P.isString(scalar.value)) return;
			if (scalar.style !== "single-quoted" && scalar.style !== "double-quoted") return;
			const pos = positionAt(ctx.lines, scalar.offset);
			out.push(
				StyleVote.make({
					dimension: "quoteType",
					value: scalar.style === "single-quoted" ? "single" : "double",
					offset: scalar.offset,
					length: scalar.length,
					line: pos.line,
					character: pos.character,
				}),
			);
		});
		return out;
	},
};

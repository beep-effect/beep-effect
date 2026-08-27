// quoted-strings (#129): quote-style policy for string VALUE scalars (and
// sequence items) — keys are out of scope (they belong to `truthy`'s trap
// detection when they matter). `quoteType` defaults to DOUBLE — the one
// taste call the design doc pins for the default preset.
//
// Fixes are conservative: a quote swap or a wrap happens only when it
// provably preserves the parsed value (single-line, no escapes in play, no
// quote character of the target style in the content, no tag/anchor on the
// node); otherwise the diagnostic ships without a fix.

import { Schema } from "effect";
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

/** Quote-style policy for string value scalars. */
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
			if (typeof scalar.value !== "string") return;
			if (scalar.style === wrongStyle) {
				const fix = safeQuoteFix(ctx, scalar, quote);
				const pos = positionAt(ctx.lines, scalar.offset);
				out.push(
					new YamlLintDiagnostic({
						rule: "quoted-strings",
						severity: "error",
						message: `String should use ${quoteType} quotes`,
						offset: scalar.offset,
						length: scalar.length,
						line: pos.line,
						character: pos.character,
						...(fix !== undefined ? { fix } : {}),
					}),
				);
				return;
			}
			if (required && scalar.style === "plain" && scalar.length > 0) {
				const fix = safeQuoteFix(ctx, scalar, quote);
				const pos = positionAt(ctx.lines, scalar.offset);
				out.push(
					new YamlLintDiagnostic({
						rule: "quoted-strings",
						severity: "error",
						message: `String should be quoted (${quoteType})`,
						offset: scalar.offset,
						length: scalar.length,
						line: pos.line,
						character: pos.character,
						...(fix !== undefined ? { fix } : {}),
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
			if (typeof scalar.value !== "string") return;
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

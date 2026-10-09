// quoted-strings: quote-style policy for string VALUE scalars (and
// sequence items) — keys are out of scope (they belong to `truthy`'s trap
// detection when they matter). `quoteType` defaults to DOUBLE, the
// default preset's one taste call.
//
// Fixes are conservative: a quote swap or a wrap happens only when it
// provably preserves the parsed value (single-line, no escapes in play, no
// quote character of the target style in the content, no tag/anchor on the
// node); otherwise the diagnostic ships without a fix.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlScalar } from "../../YamlNode.ts";
import { requoteScalarText } from "../requote.ts";
import { positionAt, walkScalars } from "./util.ts";
import * as P from "effect/Predicate";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/quoted-strings");

/**
 * Validates quote-style preferences and whether plain string scalars require quotes.
 *
 * **Details**
 *
 * Options for `quoted-strings`: the preferred `quoteType` (default
 * `"double"`) and whether plain string scalars are `required` to be quoted
 * at all (default `false` — only already-quoted scalars are policed).
 *
 * **Example** (Validate required single quotes)
 *
 * ```ts
 * import { quotedStringsOptions } from "@beep/scratchpad/effected/yaml/internal/rules/quoted-strings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(quotedStringsOptions)({ quoteType: "single", required: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const quotedStringsOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({
		description: "Reporting level for string-quoting findings, defaulting to `error`",
	}),
	quoteType: S.optionalKey(S.Literals(["single", "double"])).annotateKey({
		description:
			"Required quote style for quoted string values and sequence items, excluding mapping keys and defaulting to `double`",
	}),
	required: S.optionalKey(S.Boolean).annotateKey({
		description:
			"Whether plain string values and sequence items must be quoted, excluding mapping keys and defaulting to `false`",
	}),
}).pipe(
	$I.annoteSchema("quotedStringsOptions", {
		description:
			'Options for `quoted-strings`: the preferred `quoteType` (default `"double"`) and whether plain string scalars are `required` to be quoted at all (default `false` — only already-quoted scalars are policed).',
	}),
);

/**
 * The decoded quote-style and reporting options accepted by the quoted-strings rule.
 *
 * @see {@link quotedStringsOptions} for the options validation schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type quotedStringsOptions = typeof quotedStringsOptions.Type;

/**
 * A value-preserving requote/wrap edit, or undefined when none is safe.
 *
 * **Details**
 *
 * Delegates to the shared helper's CONSERVATIVE mode — the shipped
 * fix behavior stays exactly as released; the escaping-capable mode belongs
 * to the format path's opt-in `requoteScalars`, not the lint fix.
 */
const safeQuoteFix = (ctx: LintContext, scalar: YamlScalar, quote: '"' | "'"): YamlEdit | undefined => {
	const content = requoteScalarText(ctx.text, scalar, quote, "conservative");
	if (content === undefined) return undefined;
	return YamlEdit.make({ offset: scalar.offset, length: scalar.length, content });
};

/**
 * Enforces quote-style policy for string value scalars and sequence items.
 *
 * **Details**
 *
 * Mapping keys are outside this rule's scope. Already-quoted string values
 * vote their quote style during inference; plain scalars do not vote.
 *
 * **Gotchas**
 *
 * A quote swap or wrap has a fix only when it preserves the parsed value:
 * the scalar must be single-line, without escapes, target-style quote
 * characters, tags, or anchors. Otherwise the diagnostic has no fix.
 *
 * **Example** (Identify the string quoting rule)
 *
 * ```ts
 * import { quotedStrings } from "@beep/scratchpad/effected/yaml/internal/rules/quoted-strings"
 *
 * console.log(quotedStrings.id) // quoted-strings
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const quotedStrings: YamlRule = {
	id: "quoted-strings",
	check: (ctx, options) => {
		const quoteType =
			P.hasProperty(options, "quoteType") && S.is(quotedStringsOptions.fields.quoteType.schema)(options.quoteType)
				? options.quoteType
				: "double";
		const required =
			P.hasProperty(options, "required") && S.is(quotedStringsOptions.fields.required.schema)(options.required)
				? options.required
				: false;
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
						...O.getSomesStruct({ fix: O.fromUndefinedOr(fix) }),
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
						...O.getSomesStruct({ fix: O.fromUndefinedOr(fix) }),
					}),
				);
			}
		});
		return out;
	},
	// Inference: every already-quoted string VALUE scalar votes its
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

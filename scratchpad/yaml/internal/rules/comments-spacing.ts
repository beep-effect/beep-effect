/**
 * comments-spacing: a `#` needs a space after it to read as prose, and a
 * trailing comment needs breathing room from the content before it.
 *
 * **Details**
 *
 * Own-line versus trailing is decided from token adjacency. A shebang
 * (`#!` at the very start of the stream) is exempt.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";
import { nonNegativeIntegerOption } from "./util.ts";

/**
 * Options for `comments-spacing`: `minSpacesBefore` between content and a
 * trailing `#` (default 1 — the kit's own emission spelling) and
 * `requireSpaceAfter` the `#` (default `true`).
 *
 * **Example** (Enable the default spacing budget)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "comments-spacing": { minSpacesBefore: 1 } } })
 * console.log(config.rules["comments-spacing"])
 * ```
 *
 * @see {@link commentsSpacing} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const commentsSpacingOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	minSpacesBefore: Schema.optionalKey(nonNegativeIntegerOption),
	requireSpaceAfter: Schema.optionalKey(Schema.Boolean),
});

interface CommentsSpacingOptions {
	readonly minSpacesBefore?: number;
	readonly requireSpaceAfter?: boolean;
}

/**
 * The horizontal whitespace run directly before a comment token, and whether
 * line content precedes it (a TRAILING comment) — shared by the check and
 * the inference hook so the two cannot disagree about what "before" means.
 */
const spacingBefore = (
	ctx: LintContext,
	token: YamlToken,
): { readonly spaces: number; readonly hasContentBefore: boolean } => {
	let i = token.offset - 1;
	let spaces = 0;
	while (i >= 0 && (ctx.text[i] === " " || ctx.text[i] === "\t")) {
		spaces++;
		i--;
	}
	return { spaces, hasContentBefore: i >= 0 && ctx.text[i] !== "\n" && ctx.text[i] !== "\r" };
};

/** Shebang exemption: `#!` at the very start of the stream. */
const isShebang = (token: YamlToken): boolean => token.offset === 0 && token.text.startsWith("#!");

/**
 * Comment spacing: after the `#`, and before a trailing comment's `#`.
 *
 * **Example** (Trailing `#` without a space vs shebang)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "comments-spacing": "error" } })
 * const missing = YamlLint.run("a: 1# note\n", YamlLint.builtins, config)
 * console.log(missing.some((d) => d.rule === "comments-spacing")) // true
 *
 * const shebang = YamlLint.run("#!/usr/bin/env\na: 1\n", YamlLint.builtins, config)
 * console.log(shebang.every((d) => d.rule !== "comments-spacing")) // true
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const commentsSpacing: YamlRule = {
	id: "comments-spacing",
	check: (ctx, options) => {
		const opts = (options ?? {}) as CommentsSpacingOptions;
		const minBefore = opts.minSpacesBefore ?? 1;
		const requireAfter = opts.requireSpaceAfter ?? true;
		const out: Array<YamlLintDiagnostic> = [];
		for (const token of ctx.tokens) {
			if (token.kind !== "comment") continue;
			if (isShebang(token)) continue;
			// Space after `#`: a bare `#` is fine, `#text` is not.
			if (requireAfter && token.text.length > 1 && !/[ \t]/.test(token.text[1] as string)) {
				out.push(
					YamlLintDiagnostic.make({
						rule: "comments-spacing",
						severity: "error",
						message: 'Missing space after "#"',
						offset: token.offset,
						length: 1,
						line: token.line,
						character: token.character,
						fix: YamlEdit.make({ offset: token.offset + 1, length: 0, content: " " }),
					}),
				);
			}
			// Space before a TRAILING comment's `#`: only when content precedes
			// the comment on its line (own-line comments are indentation's
			// business).
			const { spaces, hasContentBefore } = spacingBefore(ctx, token);
			if (hasContentBefore && spaces < minBefore) {
				out.push(
					YamlLintDiagnostic.make({
						rule: "comments-spacing",
						severity: "error",
						message: `Too few spaces before comment (${spaces} < ${minBefore})`,
						offset: token.offset - spaces,
						length: spaces,
						line: token.line,
						character: token.character - spaces,
						fix: YamlEdit.make({
							offset: token.offset,
							length: 0,
							content: " ".repeat(minBefore - spaces),
						}),
					}),
				);
			}
		}
		return out;
	},
	// Inference (#345): every non-shebang comment with content after its `#`
	// votes `requireSpaceAfter` (does a space follow?), and every TRAILING
	// comment votes its observed spacing for `minSpacesBefore`. A bare `#`
	// says nothing about after-spacing; own-line comments say nothing about
	// before-spacing (their leading run is indentation).
	infer: (ctx) => {
		const out: Array<StyleVote> = [];
		for (const token of ctx.tokens) {
			if (token.kind !== "comment") continue;
			if (isShebang(token)) continue;
			if (token.text.length > 1) {
				out.push(
					StyleVote.make({
						dimension: "requireSpaceAfter",
						value: /[ \t]/.test(token.text[1] as string),
						offset: token.offset,
						length: token.length,
						line: token.line,
						character: token.character,
					}),
				);
			}
			const { spaces, hasContentBefore } = spacingBefore(ctx, token);
			if (hasContentBefore) {
				out.push(
					StyleVote.make({
						dimension: "minSpacesBefore",
						value: spaces,
						offset: token.offset - spaces,
						length: spaces,
						line: token.line,
						character: token.character - spaces,
					}),
				);
			}
		}
		return out;
	},
};

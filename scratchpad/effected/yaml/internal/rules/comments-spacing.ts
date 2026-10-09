// comments-spacing: a `#` needs a space after it to read as prose,
// and a TRAILING comment needs breathing room from the content before it.
// Own-line versus trailing is decided from token adjacency (content before
// the comment on its line) — the comment model's leading/trailing split
// at the source level. A shebang (`#!` at the very start of the stream) is
// exempt.

import { $ScratchpadId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";
import { nonNegativeIntegerOption } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/comments-spacing");

/**
 * Options for `comments-spacing`: `minSpacesBefore` between content and a
 * trailing `#` (default 1 — the kit's own emission spelling) and
 * `requireSpaceAfter` the `#` (default `true`).
 *
 * **Example** (Decode comments-spacing options)
 *
 * ```ts
 * import { commentsSpacingOptions } from "@beep/scratchpad/effected/yaml/internal/rules/comments-spacing";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(commentsSpacingOptions)({ minSpacesBefore: 2, requireSpaceAfter: true });
 * console.log(options.minSpacesBefore); // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const commentsSpacingOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for comment-spacing findings, defaulting to `error`" }),
	minSpacesBefore: S.optionalKey(nonNegativeIntegerOption).annotateKey({ description: "Minimum spaces or tabs between line content and a trailing comment's `#`, defaulting to 1" }),
	requireSpaceAfter: S.optionalKey(S.Boolean).annotateKey({ description: "Whether nonempty comments require a space or tab after `#`, defaulting to `true` and exempting an initial shebang" }),
}).pipe($I.annoteSchema("commentsSpacingOptions", { description: "Options for `comments-spacing`: `minSpacesBefore` between content and a trailing `#` (default 1 — the kit's own emission spelling) and `requireSpaceAfter` the `#` (default `true`)." }));

/**
 * Decoded options for comment spacing.
 *
 * @category type-level
 * @since 0.0.0
 */
export type commentsSpacingOptions = typeof commentsSpacingOptions.Type;

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
	return {
		spaces,
		hasContentBefore: i >= 0 && ctx.text[i] !== "\n" && ctx.text[i] !== "\r" && !(i === 0 && ctx.text[i] === "\uFEFF"),
	};
};

/** Recognizes a shebang (hash followed by an exclamation mark) at the very start of the stream. */
const isShebang = (token: YamlToken): boolean => token.offset === 0 && token.text.startsWith("#!");

/**
 * Enforces spacing after the `#`, and before a trailing comment's `#`.
 *
 * **Details**
 *
 * Spaces or tabs separate comment prose from the hash and trailing comments
 * from preceding line content. Own-line comments do not contribute
 * before-spacing evidence. A shebang at the very start of the stream is exempt.
 *
 * **Example** (Report comments-spacing violations)
 *
 * ```ts
 * import { commentsSpacing } from "@beep/scratchpad/effected/yaml/internal/rules/comments-spacing";
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/effected/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({ rules: { "comments-spacing": "error" } });
 * const diagnostics = YamlLint.run("a: 1 #text\n", [commentsSpacing], config);
 * console.log(diagnostics[0]?.message); // Missing space after "#"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const commentsSpacing: YamlRule = {
	id: "comments-spacing",
	check: (ctx, options) => {
		const opts = P.isObject(options) ? options : {};
		const minBefore = P.isNumber(opts.minSpacesBefore) ? opts.minSpacesBefore : 1;
		const requireAfter = S.is(S.Boolean)(opts.requireSpaceAfter) ? opts.requireSpaceAfter : true;
		const out: Array<YamlLintDiagnostic> = [];
		for (const token of ctx.tokens) {
			if (token.kind !== "comment") continue;
			if (isShebang(token)) continue;
			// Space after `#`: a bare `#` is fine, `#text` is not.
			if (requireAfter && token.text.length > 1 && !/[ \t]/.test(token.text.charAt(1))) {
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
	// Inference: every non-shebang comment with content after its `#`
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
						value: /[ \t]/.test(token.text.charAt(1)),
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

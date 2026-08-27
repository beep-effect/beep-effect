// document-end (#129): the `...` marker at the tail of the stream —
// required (`present: true`, the default when the rule is enabled) or
// forbidden (`present: false`). Tail-of-stream scope only, mirroring
// document-start's head-of-stream scope: mid-stream `...` markers are
// document structure.
//
// Opt-in: absent from both presets.

import { Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";

/** Options for `document-end`: require (`true`, default) or forbid the marker. */
export const documentEndOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	present: Schema.optionalKey(Schema.Boolean),
});

const TRIVIA = new Set(["newline", "whitespace", "comment", "byte-order-mark"]);

/** The last non-trivia token: it decides whether the stream ends with `...`. */
const tailToken = (ctx: LintContext): YamlToken | undefined =>
	[...ctx.tokens].reverse().find((t) => !TRIVIA.has(t.kind));

/**
 * The end-of-stream position, shared by the missing-marker diagnostic and
 * the absent-marker vote so the two cannot drift apart. `line`/`character`
 * must agree with `offset` (= text length): when the text ends with a
 * newline, that offset sits at the head of the line AFTER the last content
 * line `buildLines` kept.
 */
const endOfStreamPosition = (
	ctx: LintContext,
): { readonly offset: number; readonly length: number; readonly line: number; readonly character: number } => {
	const lastLine = ctx.lines[ctx.lines.length - 1];
	const trailingNewline = ctx.text.endsWith("\n");
	return {
		offset: ctx.text.length,
		length: 0,
		line: (lastLine?.number ?? 0) + (trailingNewline ? 1 : 0),
		character: trailingNewline ? 0 : (lastLine?.text.length ?? 0),
	};
};

/** The `...` marker at the tail of the stream. */
export const documentEnd: YamlRule = {
	id: "document-end",
	check: (ctx, options) => {
		const present = (options as { readonly present?: boolean } | undefined)?.present ?? true;
		// The last non-trivia token decides: does the stream end with `...`?
		const tail = tailToken(ctx);
		const ended = tail?.kind === "document-end";
		if (present && !ended && ctx.text.trim() !== "") {
			return [
				new YamlLintDiagnostic({
					rule: "document-end",
					severity: "error",
					message: 'Missing "..." document end marker',
					...endOfStreamPosition(ctx),
					// The fix appends the marker line; a missing final newline is
					// eof-newline's business, so insert one first when needed.
					fix: YamlEdit.make({
						offset: ctx.text.length,
						length: 0,
						content: ctx.text.endsWith("\n") ? "...\n" : "\n...\n",
					}),
				}),
			];
		}
		if (!present && tail !== undefined && tail.kind === "document-end") {
			const lineText = ctx.lines[tail.line]?.text ?? "";
			const alone = lineText.trim() === "...";
			// The fix removes the marker line whole: marker plus its terminator
			// (two characters under CRLF, one under LF).
			const terminator = ctx.text.startsWith("\r\n", tail.offset + tail.length) ? 2 : 1;
			return [
				new YamlLintDiagnostic({
					rule: "document-end",
					severity: "error",
					message: 'Forbidden "..." document end marker',
					offset: tail.offset,
					length: tail.length,
					line: tail.line,
					character: tail.character,
					...(alone
						? { fix: YamlEdit.make({ offset: tail.offset, length: tail.length + terminator, content: "" }) }
						: {}),
				}),
			];
		}
		return [];
	},
	// Inference (#345): a non-empty stream votes `present` — tailed by `...`
	// or not; absence votes `false` (mirroring document-start).
	infer: (ctx) => {
		if (ctx.text.trim() === "") return [];
		const tail = tailToken(ctx);
		if (tail === undefined) return [];
		const ended = tail.kind === "document-end";
		if (ended) {
			return [
				StyleVote.make({
					dimension: "present",
					value: true,
					offset: tail.offset,
					length: tail.length,
					line: tail.line,
					character: tail.character,
				}),
			];
		}
		// Same end-of-stream position math as the missing-marker diagnostic.
		return [StyleVote.make({ dimension: "present", value: false, ...endOfStreamPosition(ctx) })];
	},
};

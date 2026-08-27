/**
 * document-start: the `---` marker at the head of the stream — required
 * (`present: true`, the default) or forbidden (`present: false`).
 *
 * Scope is the stream head only: `---` separators between documents are
 * structure — removing one would merge documents. Opt-in and absent from
 * both presets. Directives require `---`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HashSet, Schema } from "effect";
import { YamlEdit } from "../../YamlEdit.ts";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";

/**
 * Options for `document-start`: require (`true`, default) or forbid the marker.
 *
 * **Gotchas**
 *
 * Directives (`%YAML` / `%TAG`) require `---`. Forbidding the marker on a
 * directive-carrying stream is a conflict the rule will not "fix" by
 * deleting structure.
 *
 * **Example** (Require a stream-head `---`)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "document-start": { present: true } } })
 * console.log(config.rules["document-start"])
 * ```
 *
 * @see {@link documentStart} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const documentStartOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
	present: Schema.optionalKey(Schema.Boolean),
});

const TRIVIA = HashSet.make("newline", "whitespace", "comment", "byte-order-mark", "directive");

/** True when the stream carries `%YAML`/`%TAG` directives — which REQUIRE `---`. */
const hasDirectives = (ctx: LintContext): boolean => ctx.tokens.some((t) => t.kind === "directive");

/** The first non-trivia token: it decides whether the stream is headed by `---`. */
const headToken = (ctx: LintContext): YamlToken | undefined => ctx.tokens.find((t) => !HashSet.has(TRIVIA, t.kind));

/**
 * The `---` marker at the head of the stream.
 *
 * **Gotchas**
 *
 * A two-document stream whose head already has `---` is not a
 * document-start violation for the internal separator. Removing a
 * mid-stream `---` would merge documents.
 *
 * **Example** (Internal `---` is structure, not a style miss)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const hits = YamlLint.run("---\na: 1\n---\nb: 2\n", YamlLint.builtins, YamlLintConfig.make({
 *   rules: { "document-start": { present: true } },
 * }))
 * console.log(hits.every((d) => d.rule !== "document-start")) // true
 * ```
 *
 * @see {@link documentEnd} for the matching stream-tail marker rule.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const documentStart: YamlRule = {
	id: "document-start",
	check: (ctx, options) => {
		const present = (options as { readonly present?: boolean } | undefined)?.present ?? true;
		// The first non-trivia token decides: is the stream headed by `---`?
		const directives = hasDirectives(ctx);
		const first = headToken(ctx);
		const headed = first?.kind === "document-start";
		if (present && !headed && ctx.text.trim() !== "") {
			return [
				YamlLintDiagnostic.make({
					rule: "document-start",
					severity: "error",
					message: 'Missing "---" document start marker',
					offset: 0,
					length: 0,
					line: 0,
					character: 0,
					// A stream with %directives cannot take a synthesized `---` at
					// offset 0 (directives precede the marker); no fix there.
					...(directives ? {} : { fix: YamlEdit.make({ offset: 0, length: 0, content: "---\n" }) }),
				}),
			];
		}
		if (!present && headed && first !== undefined) {
			// Only a marker ALONE on its line takes a fix — `--- content` would
			// splice the content line. A stream with %directives REQUIRES the
			// marker, so removing it would invalidate the directives: no fix.
			const lineText = ctx.lines[first.line]?.text ?? "";
			const alone = !directives && lineText.trim() === "---";
			// The fix removes the marker line whole: marker plus its terminator
			// (two characters under CRLF, one under LF).
			const terminator = ctx.text.startsWith("\r\n", first.offset + first.length) ? 2 : 1;
			return [
				YamlLintDiagnostic.make({
					rule: "document-start",
					severity: "error",
					message: 'Forbidden "---" document start marker',
					offset: first.offset,
					length: first.length,
					line: first.line,
					character: first.character,
					...(alone
						? { fix: YamlEdit.make({ offset: first.offset, length: first.length + terminator, content: "" }) }
						: {}),
				}),
			];
		}
		return [];
	},
	// Inference (#345): a non-empty stream votes `present` — headed by `---`
	// or not. An unmarked file IS evidence of the no-marker style (the
	// workflow-file corpus above all), so absence votes `false` rather than
	// saying nothing.
	infer: (ctx) => {
		if (ctx.text.trim() === "") return [];
		const first = headToken(ctx);
		if (first === undefined) return [];
		const headed = first.kind === "document-start";
		// A %directive-headed stream REQUIRES the marker (check refuses to
		// synthesize or remove one there): an unmarked directive stream is
		// malformed input, not evidence of the no-marker style — no vote.
		if (!headed && hasDirectives(ctx)) return [];
		return [
			StyleVote.make(
				headed
					? {
							dimension: "present",
							value: true,
							offset: first.offset,
							length: first.length,
							line: first.line,
							character: first.character,
						}
					: { dimension: "present", value: false, offset: 0, length: 0, line: 0, character: 0 },
			),
		];
	},
};

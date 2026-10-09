// hyphen-spacing: at most one space after the block-sequence `-`
// indicator. Spaces BEFORE the hyphen are indentation — the indentation
// rule's business — and a comment after the hyphen belongs to
// comments-spacing.

import { $ScratchpadId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import type { YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import { positiveIntegerOption } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/hyphen-spacing");

/**
 * Limit spaces after the block-sequence hyphen indicator.
 *
 * **Details**
 *
 * Options for `hyphen-spacing`: `maxSpacesAfter` (default 1) after the `-`.
 *
 * **Gotchas**
 *
 * At least one separation space must follow the indicator — `0` would make
 * the fix emit `-item`, a plain scalar, not a sequence entry.
 *
 * **Example** (Decode hyphen-spacing options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { hyphenSpacingOptions } from "@beep/scratchpad/effected/yaml/internal/rules/hyphen-spacing";
 *
 * const options = S.decodeUnknownSync(hyphenSpacingOptions)({ maxSpacesAfter: 1 });
 * console.log(options.maxSpacesAfter) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const hyphenSpacingOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for sequence-entry spacing findings, defaulting to `error`" }),
	maxSpacesAfter: S.optionalKey(positiveIntegerOption).annotateKey({ description: "Maximum spaces between a block-sequence `-` and its same-line item, at least 1 and defaulting to 1" }),
}).pipe($I.annoteSchema("hyphenSpacingOptions", { description: "Options for `hyphen-spacing`: `maxSpacesAfter` (default 1) after the `-`. At least one separation space must follow the indicator — `0` would make the fix emit `-item`, a plain scalar, not a sequence entry." }));

/**
 * Decoded options for block-sequence hyphen spacing.
 *
 * @category type-level
 * @since 0.0.0
 */
export type hyphenSpacingOptions = typeof hyphenSpacingOptions.Type;

/**
 * Check spacing after the block-sequence `-` indicator.
 *
 * **Details**
 *
 * Spaces before the hyphen belong to indentation; comments after it belong
 * to comment spacing. Excess spaces can be deleted while preserving at least
 * one separation space. A finding has no fix when moving a compact block
 * collection would change the indentation of its continuation entries.
 *
 * **Example** (Find excess sequence-entry spacing)
 *
 * ```ts
 * import { hyphenSpacing } from "@beep/scratchpad/effected/yaml/internal/rules/hyphen-spacing";
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/effected/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "hyphen-spacing": { maxSpacesAfter: 1 } },
 * });
 * const diagnostics = YamlLint.run("-   item\n", [hyphenSpacing], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const hyphenSpacing: YamlRule = {
	id: "hyphen-spacing",
	check: (ctx, options) => {
		const opts = P.isObject(options) ? options : {};
		// Clamped so a hand-built options object cannot bypass the schema and
		// delete the separation space.
		const maxAfter = Math.max(1, P.isNumber(opts.maxSpacesAfter) ? opts.maxSpacesAfter : 1);
		const out: Array<YamlLintDiagnostic> = [];
		for (let tokenIndex = 0; tokenIndex < ctx.tokens.length; tokenIndex++) {
			const token = ctx.tokens[tokenIndex];
			if (token === undefined || token.kind !== "block-seq-entry") continue;
			let j = token.offset + token.length;
			let after = 0;
			while (j < ctx.text.length && ctx.text[j] === " ") {
				after++;
				j++;
			}
			const next = ctx.text[j];
			if (next === undefined || next === "\n" || next === "\r" || next === "#") continue;
			if (after > maxAfter) {
				// Moving a compact block collection's first entry without its
				// continuation entries changes their relative indentation. Flow
				// collections' colons do not introduce a compact block mapping.
				let compact = false;
				let flowDepth = 0;
				let relocatesCollection = false;
				for (let followingIndex = tokenIndex + 1; followingIndex < ctx.tokens.length; followingIndex++) {
					const following = ctx.tokens[followingIndex];
					if (following === undefined) break;
					if (following.offset < j) continue;
					if (following.line > token.line) {
						if (following.kind === "whitespace" || following.kind === "newline" || following.kind === "comment") continue;
						relocatesCollection = compact && following.character > token.character;
						break;
					}
					if (following.kind === "flow-map-start" || following.kind === "flow-seq-start") {
						flowDepth++;
					} else if (following.kind === "flow-map-end" || following.kind === "flow-seq-end") {
						flowDepth--;
					} else if (
						flowDepth === 0 &&
						(following.kind === "block-seq-entry" || following.kind === "block-map-key" || following.kind === "block-map-value")
					) {
						compact = true;
					}
				}
				out.push(
					YamlLintDiagnostic.make({
						rule: "hyphen-spacing",
						severity: "error",
						message: `Too many spaces after "-" (${after} > ${maxAfter})`,
						offset: token.offset + token.length,
						length: after,
						line: token.line,
						character: token.character + token.length,
						...(relocatesCollection
							? {}
							: {
								fix: YamlEdit.make({
									offset: token.offset + token.length,
									length: after - maxAfter,
									content: "",
								}),
							}),
					}),
				);
			}
		}
		return out;
	},
};

// hyphen-spacing: at most one space after the block-sequence `-`
// indicator. Spaces BEFORE the hyphen are indentation — the indentation
// rule's business — and a comment after the hyphen belongs to
// comments-spacing.

import { $ScratchpadId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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
		// Index same-line structure once. Flow colons are not compact block
		// mappings, and only a scalar's immediate parent indicator determines
		// whether moving a hyphen changes its explicit indentation.
		const compactEntries = A.makeBy(ctx.tokens.length, () => false);
		const explicitScalarParents = A.makeBy(ctx.tokens.length, () => false);
		let line = -1;
		let flowDepth = 0;
		let previousContentIndex = -1;
		for (let index = 0; index < ctx.tokens.length; index++) {
			const token = A.getUnsafe(ctx.tokens, index);
			if (token.line !== line) {
				line = token.line;
				flowDepth = 0;
				previousContentIndex = -1;
			}
			if (token.kind === "whitespace" || token.kind === "tag" || token.kind === "anchor") continue;
			if (
				token.kind === "scalar" && previousContentIndex >= 0 &&
				A.getUnsafe(ctx.tokens, previousContentIndex).kind === "block-seq-entry" &&
				O.isSome(Str.match(/^[|>](?:[1-9][+-]?|[+-][1-9])(?:[ \t\r\n]|$)/)(token.text))
			) {
				explicitScalarParents[previousContentIndex] = true;
			}
			if (token.kind === "flow-map-start" || token.kind === "flow-seq-start") {
				flowDepth++;
			} else if (token.kind === "flow-map-end" || token.kind === "flow-seq-end") {
				flowDepth--;
			} else if (
				flowDepth === 0 &&
				(token.kind === "block-seq-entry" || token.kind === "block-map-key" || token.kind === "block-map-value")
			) {
				compactEntries[index] = true;
			}
			previousContentIndex = index;
		}
		// Suffix summaries make each hyphen's safety query constant-time. The
		// next content column skips blank/comment lines, as the old scan did.
		const relocatesCollections = A.makeBy(ctx.tokens.length, () => false);
		line = -1;
		let nextContentCharacter = -1;
		let nextLineCharacter = -1;
		let compact = false;
		let movesScalarParent = false;
		for (let index = ctx.tokens.length - 1; index >= 0; index--) {
			const token = A.getUnsafe(ctx.tokens, index);
			if (token.line !== line) {
				line = token.line;
				nextLineCharacter = nextContentCharacter;
				compact = false;
				movesScalarParent = false;
			}
			relocatesCollections[index] = movesScalarParent || (compact && nextLineCharacter > token.character);
			compact = compact || A.getUnsafe(compactEntries, index);
			// The parent hyphen itself stays put when deleting spaces after it.
			// Only earlier hyphens move that parent and must withhold their fix.
			movesScalarParent = movesScalarParent || A.getUnsafe(explicitScalarParents, index);
			if (token.kind !== "whitespace" && token.kind !== "newline" && token.kind !== "comment") {
				nextContentCharacter = token.character;
			}
		}
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
				const relocatesCollection = A.getUnsafe(relocatesCollections, tokenIndex);
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

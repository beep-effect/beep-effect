// Character-level text diffing shared by the formatter and modifier: turns
// (original, modified) into minimal raw edit records. The facade
// materializes public `YamlEdit` instances from these.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as A from "effect/Array";

const $I = $ScratchpadId.create("effected/yaml/internal/diff");

/**
 * A raw text-edit record: replace `[offset, offset + length)` with `content`.
 *
 * **Example** (Validate a source replacement)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RawEdit } from "@beep/scratchpad/effected/yaml/internal/diff"
 *
 * console.log(S.is(RawEdit)({ offset: 0, length: 3, content: "new" })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RawEdit = S.Struct({
	offset: S.Finite.annotate({ description: "The source offset where replacement begins." }),
	length: S.Finite.annotate({ description: "The number of source characters to replace." }),
	content: S.String.annotate({ description: "The replacement text." }),
}).pipe($I.annoteSchema("RawEdit", { description: "A plain text edit replacing a source span before facade materialization." }));

/**
 * The structural edit type described by {@link RawEdit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawEdit = typeof RawEdit.Type;

/**
 * Compute edits by diffing two strings character by character.
 *
 * **Details**
 *
 * Walks both strings from each end inward to find the common prefix and
 * suffix, then emits a single edit covering the changed region in the
 * middle. This is sufficient because both strings derive from the same AST
 * and share structural skeleton — typically only whitespace and values differ.
 *
 * For more granular edits (multiple disjoint changes), a line-level pass
 * splits the middle region into per-line edits when possible.
 *
 * This relies on the assumption that both strings share an identical
 * structural skeleton (they were produced from the same AST); a simple
 * prefix/suffix match is sufficient and a full Myers diff is unnecessary.
 *
 * **Example** (Inspect a changed scalar and unchanged text)
 *
 * ```ts
 * import { computeEdits } from "@beep/scratchpad/effected/yaml/internal/diff"
 *
 * console.log(JSON.stringify(computeEdits("name: Ada", "name: Eva"))) // [{"offset":6,"length":2,"content":"Ev"}]
 * console.log(computeEdits("name: Ada", "name: Ada").length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function computeEdits(original: string, ...[modified]: [modified: string]): ReadonlyArray<RawEdit> {
	if (original === modified) return [];

	// Find common prefix
	let prefixLen = 0;
	const minLen = Math.min(original.length, modified.length);
	while (prefixLen < minLen && original[prefixLen] === modified[prefixLen]) {
		prefixLen++;
	}

	// Find common suffix (not overlapping with prefix)
	let suffixLen = 0;
	while (
		suffixLen < minLen - prefixLen &&
		original[original.length - 1 - suffixLen] === modified[modified.length - 1 - suffixLen]
	) {
		suffixLen++;
	}

	const origStart = prefixLen;
	const origEnd = original.length - suffixLen;
	const modStart = prefixLen;
	const modEnd = modified.length - suffixLen;

	// Try to split into line-level edits for better granularity
	const origMiddle = original.substring(origStart, origEnd);
	const modMiddle = modified.substring(modStart, modEnd);
	const origLines = origMiddle.split("\n");
	const modLines = modMiddle.split("\n");

	if (origLines.length === modLines.length && origLines.length > 1) {
		// Same number of lines — emit per-line edits for changed lines only
		const edits: RawEdit[] = [];
		let offset = origStart;
		for (const [origLine, modLine] of A.zip(origLines, modLines)) {
			if (origLine !== modLine) {
				edits.push({
					offset,
					length: origLine.length,
					content: modLine,
				});
			}
			// +1 for the \n delimiter. For CRLF input, split("\n") leaves \r in each
			// element so origLine.length already includes it; the +1 accounts for
			// the \n only. This is correct because computeEdits operates on text
			// produced by the stringifier which always uses LF endings.
			offset += origLine.length + 1;
		}
		return edits;
	}

	// Fallback: single edit covering the entire changed region
	return [
		{
			offset: origStart,
			length: origEnd - origStart,
			content: modified.substring(modStart, modEnd),
		},
	];
}

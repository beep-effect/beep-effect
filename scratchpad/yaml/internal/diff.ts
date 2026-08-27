/**
 * Character-level text diffing shared by the formatter and modifier.
 *
 * Turns `(original, modified)` into minimal raw edit records. The facade
 * materializes public `YamlEdit` instances from these.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * A raw text-edit record: replace `[offset, offset + length)` with `content`.
 *
 * @see {@link computeEdits} for the prefix/suffix diff that produces these records.
 * @see {@link YamlEdit} for the public edit the facade materializes.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface RawEdit {
	readonly offset: number;
	readonly length: number;
	readonly content: string;
}

/**
 * Compute edits by diffing two strings character by character.
 *
 * Walks both strings from each end inward to find the common prefix and
 * suffix, then emits a single edit covering the changed region in the
 * middle. This is sufficient because both strings derive from the same AST
 * and share structural skeleton — typically only whitespace and values differ.
 *
 * For more granular edits (multiple disjoint changes), a line-level pass
 * splits the middle region into per-line edits when possible.
 *
 * **Gotchas**
 *
 * This is not a general-purpose diff. It assumes a shared AST skeleton and
 * LF endings from the stringifier. Diffing CRLF originals against LF
 * output, or two unrelated strings, collapses to one coarse middle edit
 * (and offsets are wrong if CR is present). Empty when the prefix plus
 * suffix cover both strings.
 *
 * **Example** (One-line value change is a single edit)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { YamlFormat } from "@beep/scratchpad/yaml"
 *
 * const edits = Effect.runSync(YamlFormat.modify("a: 1\nb: 2\n", ["a"], 9))
 * console.log(edits.length) // 1
 * console.log(edits[0]?.offset) // 3
 * console.log(edits[0]?.content) // "9"
 * ```
 *
 * @see {@link YamlFormat.format} for the public formatter that consumes these edits.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export function computeEdits(original: string, modified: string): ReadonlyArray<RawEdit> {
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

	if (origStart >= origEnd && modStart >= modEnd) {
		return [];
	}

	// Try to split into line-level edits for better granularity
	const origMiddle = original.substring(origStart, origEnd);
	const modMiddle = modified.substring(modStart, modEnd);
	const origLines = origMiddle.split("\n");
	const modLines = modMiddle.split("\n");

	if (origLines.length === modLines.length && origLines.length > 1) {
		// Same number of lines — emit per-line edits for changed lines only
		const edits: RawEdit[] = [];
		let offset = origStart;
		for (let i = 0; i < origLines.length; i++) {
			const origLine = origLines[i] ?? "";
			const modLine = modLines[i] ?? "";
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

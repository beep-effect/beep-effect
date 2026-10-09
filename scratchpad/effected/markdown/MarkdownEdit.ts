// The non-mutating text-edit vocabulary shared by the formatter and the
// modifier: MarkdownEdit, MarkdownRange, MarkdownPath and MarkdownSegment.
//
// Edits describe replacements as `offset`/`length`/`content`; applying them in
// reverse-offset order is byte-minimal and preserves everything outside the
// spliced spans — the offset-splice editing model chosen over a
// lossless CST (nobody in the ecosystem ships one; positional splicing is the
// remark maintainers' own recommendation).
//
// `MarkdownEdit`, `MarkdownRange`, `MarkdownPath` and `MarkdownSegment` are
// bound by the jsonc/yaml/toml parity convention: they are structurally
// identical to their `Jsonc*`, `Yaml*` and `Toml*` counterparts (same field
// names, types and semantics) so consumer code can be written once over "a
// document codec's Edit/Range/Path". All four packages share the `applyAll`
// overlap check: rejecting overlapping edits as a thrown defect. The formatter
// and modifier never produce overlapping edits, so the check only ever fires on
// a hand-constructed edit array, which is a programmer error worth surfacing.
// The `format` range-filter posture still diverges: this module and toml use
// owning-node/expression intersection, yaml requires edits fully within range.

import { Schema } from "effect";

/**
 * A single path segment: a `number` for child indices in the node tree, or a
 * `string` for named addressing (reserved, e.g. for definition identifiers).
 *
 * @public
 */
export type MarkdownSegment = string | number;

/**
 * An ordered sequence of {@link MarkdownSegment} values describing a location
 * within a markdown document tree.
 *
 * @public
 */
export type MarkdownPath = ReadonlyArray<MarkdownSegment>;

/**
 * A range within a markdown document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units. Pass to `MarkdownFormat.format`
 * to restrict formatting to a region.
 *
 * @public
 */
export class MarkdownRange extends Schema.Class<MarkdownRange>("MarkdownRange")({
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * @remarks
 * Structurally identical to `@effected/jsonc`'s, `@effected/yaml`'s and
 * `@effected/toml`'s edit shapes (same field names, types and semantics) per
 * the cross-package parity convention, so consumer code can be written once
 * over "a document codec's Edit/Range/Path".
 *
 * @public
 */
export class MarkdownEdit extends Schema.Class<MarkdownEdit>("MarkdownEdit")({
	offset: Schema.Number,
	length: Schema.Number,
	content: Schema.String,
}) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated. Overlapping edits are a programmer error and throw
	 * as a defect — `MarkdownFormat` never produces them.
	 *
	 * @param text - The source text to edit.
	 * @param edits - The edits to apply, in any order.
	 * @returns The edited text.
	 */
	static applyAll(text: string, edits: ReadonlyArray<MarkdownEdit>): string {
		const sorted = [...edits].sort((a, b) => b.offset - a.offset);
		for (let i = 0; i + 1 < sorted.length; i++) {
			const upper = sorted[i];
			const lower = sorted[i + 1];
			if (lower.offset + lower.length > upper.offset) {
				throw new Error(
					`MarkdownEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
				);
			}
		}
		let result = text;
		for (const edit of sorted) {
			result = result.slice(0, edit.offset) + edit.content + result.slice(edit.offset + edit.length);
		}
		return result;
	}
}

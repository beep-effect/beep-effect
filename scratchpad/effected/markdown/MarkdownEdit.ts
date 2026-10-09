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

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/markdown/MarkdownEdit");

class OverlappingMarkdownEditsError extends S.TaggedError<OverlappingMarkdownEditsError>($I`OverlappingMarkdownEditsError`)("OverlappingMarkdownEditsError", {
	message: S.String.annotateKey({ description: "Explanation identifying the overlapping edit offsets and the programmer-error contract" }),
}, $I.annote("OverlappingMarkdownEditsError", { description: "Rejects intersecting source edits before MarkdownEdit.applyAll can splice ambiguous replacements." })) {}

/**
 * A single path segment: a `number` for child indices in the node tree, or a
 * `string` for named addressing (reserved, e.g. for definition identifiers).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownSegment = string | number;

/**
 * An ordered sequence of {@link MarkdownSegment} values describing a location
 * within a markdown document tree.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownPath = ReadonlyArray<MarkdownSegment>;

/**
 * A range within a markdown document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units. Pass to `MarkdownFormat.format`
 * to restrict formatting to a region.
 *
 * **Example** (Select a source region)
 *
 * ```ts
 * import { MarkdownRange } from "@beep/scratchpad/effected/markdown/MarkdownEdit";
 *
 * const range = MarkdownRange.make({ offset: 3, length: 5 });
 * console.log(range.offset + range.length) // 8
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MarkdownRange extends S.Class<MarkdownRange>($I`MarkdownRange`)({
	offset: S.Finite.annotateKey({ description: "Zero-based start of the formatting region in the source string, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Extent of the formatting region in UTF-16 code units, used to select intersecting nodes" }),
}, $I.annote("MarkdownRange", { description: "A range within a markdown document, expressed as a zero-based character `offset` and a `length` in UTF-16 code units. Pass to `MarkdownFormat.format` to restrict formatting to a region." })) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * **Details**
 *
 * Structurally identical to `@effected/jsonc`'s, `@effected/yaml`'s and
 * `@effected/toml`'s edit shapes (same field names, types and semantics) per
 * the cross-package parity convention, so consumer code can be written once
 * over "a document codec's Edit/Range/Path".
 *
 * **Example** (Insert and delete source text)
 *
 * ```ts
 * import { MarkdownEdit } from "@beep/scratchpad/effected/markdown/MarkdownEdit";
 *
 * const insertion = MarkdownEdit.make({ offset: 5, length: 0, content: " world" });
 * const deletion = MarkdownEdit.make({ offset: 0, length: 1, content: "" });
 * console.log(MarkdownEdit.applyAll("Hello", [insertion, deletion])) // ello world
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MarkdownEdit extends S.Class<MarkdownEdit>($I`MarkdownEdit`)({
	offset: S.Finite.annotateKey({ description: "Zero-based start of the span to replace in the original source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Number of UTF-16 code units to replace in the original source; `0` inserts without removing text" }),
	content: S.String.annotateKey({ description: "Replacement text for the source span; an empty string deletes the span" }),
}, $I.annote("MarkdownEdit", { description: "A non-mutating text edit: replace the span `[offset, offset + length)` with `content`. Set `length` to `0` to insert, `content` to `\"\"` to delete." })) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated.
	 *
	 * **Gotchas**
	 *
	 * Overlapping edits are a programmer error and throw
	 * as a defect — `MarkdownFormat` never produces them.
	 *
	 * **Example** (Apply edits in arbitrary offset order)
	 *
	 * ```ts
	 * import { MarkdownEdit } from "@beep/scratchpad/effected/markdown/MarkdownEdit";
	 *
	 * const edits = [
	 *   MarkdownEdit.make({ offset: 0, length: 1, content: "h" }),
	 *   MarkdownEdit.make({ offset: 5, length: 0, content: " world" }),
	 * ];
	 * console.log(MarkdownEdit.applyAll("Hello", edits)) // hello world
	 * ```
	 *
	 * @param text - The source text to edit.
	 * @param edits - The edits to apply, in arbitrary order.
	 * @returns The edited text.
	 * @category utilities
	 * @since 0.0.0
	 */
	static applyAll(text: string, edits: ReadonlyArray<MarkdownEdit>): string {
		const sorted = A.sort(edits, Order.mapInput(Order.flip(Order.Number), (edit: MarkdownEdit) => edit.offset));
		for (let i = 0; i + 1 < sorted.length; i++) {
			const upper = sorted[i];
			const lower = sorted[i + 1];
			if (lower !== undefined && upper !== undefined && lower.offset + lower.length > upper.offset) {
				throw OverlappingMarkdownEditsError.make({
					message: `MarkdownEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
				});
			}
		}
		let result = text;
		for (const edit of sorted) {
			result = result.slice(0, edit.offset) + edit.content + result.slice(edit.offset + edit.length);
		}
		return result;
	}
}

// The non-mutating text-edit vocabulary shared by the formatter and the
// modifier: TomlEdit, TomlRange, TomlPath and TomlSegment. Edits are text
// splices computed against the linear CST's expression spans — applying them
// in reverse-offset order is byte-minimal and preserves comments and layout,
// the core value proposition over parse → re-stringify round trips.
//
// `TomlEdit`, `TomlRange`, `TomlPath` and `TomlSegment` are bound by the
// cross-package parity convention: they are structurally identical to their
// `Jsonc*`, `Yaml*` and `Markdown*` counterparts (same field names, types and
// semantics) so consumer code can be written once over "a document codec's
// Edit/Range/Path".

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/toml/TomlEdit");

class TomlEditInvariantError extends S.TaggedError<TomlEditInvariantError>($I`TomlEditInvariantError`)(
	"TomlEditInvariantError",
	{ message: S.String.annotateKey({ description: "Explanation of the missing or overlapping edit that violates the application invariant." }) },
	$I.annote("TomlEditInvariantError", { description: "A programmer defect encountered while applying TOML text edits." }),
) {}

/**
 * A single path segment: a `string` for table keys or a `number` for array
 * and array-of-tables indices.
 *
 * @public
 */
export type TomlSegment = string | number;

/**
 * An ordered sequence of {@link TomlSegment} values describing a location
 * within a TOML document's semantic tree.
 *
 * @public
 */
export type TomlPath = ReadonlyArray<TomlSegment>;

/**
 * A range within a TOML document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units. Pass to `TomlFormat.format`
 * to restrict formatting to the expressions intersecting a region.
 *
 * @public
 */
export class TomlRange extends S.Class<TomlRange>($I`TomlRange`)({
	offset: S.Finite.annotateKey({ description: "Zero-based starting position in UTF-16 code units for selecting expressions to format" }),
	length: S.Finite.annotateKey({ description: "Extent of the formatting region in UTF-16 code units" }),
}, $I.annote("TomlRange", { description: "A range within a TOML document, expressed as a zero-based character `offset` and a `length` in UTF-16 code units. Pass to `TomlFormat.format` to restrict formatting to the expressions intersecting a region." })) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * **Details**
 *
 * Structurally identical to the edit shapes of `@effected/jsonc`,
 * `@effected/yaml` and `@effected/markdown` (same field names, types and
 * semantics), so consumer code can be written once over "a document codec's
 * Edit/Range/Path".
 *
 * @public
 */
export class TomlEdit extends S.Class<TomlEdit>($I`TomlEdit`)({
	offset: S.Finite.annotateKey({ description: "Zero-based starting position of the text splice in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Number of UTF-16 code units to replace, with zero inserting text without removing any" }),
	content: S.String.annotateKey({ description: "Replacement text for the selected span, with an empty string deleting that span" }),
}, $I.annote("TomlEdit", { description: "A non-mutating text edit: replace the span `[offset, offset + length)` with `content`. Set `length` to `0` to insert, `content` to `\"\"` to delete." })) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated. Overlapping edits are a programmer error and throw
	 * as a defect — `TomlFormat` never produces them.
	 *
	 * @param text - The source text to edit.
	 * @param edits - The edits to apply, in any order.
	 * @returns The edited text.
	 */
	static applyAll(text: string, edits: ReadonlyArray<TomlEdit>): string {
		const sorted = A.sort(edits, Order.mapInput(Order.flip(Order.Number), (edit: TomlEdit) => edit.offset));
		for (let i = 0; i + 1 < sorted.length; i++) {
			const upper = sorted[i];
			const lower = sorted[i + 1];
			if (upper === undefined || lower === undefined) {
				throw TomlEditInvariantError.make({ message: "missing edit" });
			}
			if (lower.offset + lower.length > upper.offset) {
				throw TomlEditInvariantError.make({
					message: `TomlEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
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

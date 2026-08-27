/**
 * Non-mutating text-edit vocabulary shared by the formatter and the modifier:
 * {@link TomlEdit}, {@link TomlRange}, {@link TomlPath}, and {@link TomlSegment}.
 *
 * **Details**
 *
 * Edits are text splices computed against the linear CST's expression spans —
 * applying them in reverse-offset order is byte-minimal and preserves comments
 * and layout, the package's real differentiator over parse → re-stringify
 * round trips. The shapes are bound by the jsonc/yaml parity convention: they
 * are structurally identical to their `Jsonc*` and `Yaml*` counterparts (same
 * field names, types, and semantics) so consumer code can be written once over
 * "a document codec's Edit/Range/Path".
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";

const $I = $ScratchpadId.create("toml/TomlEdit");

/**
 * A single path segment: a `string` for table keys or a `number` for array
 * and array-of-tables indices.
 *
 * @see {@link TomlPath} for the ordered sequence of segments used by {@link TomlFormat.modify}.
 * @category type-level
 * @since 0.0.0
 */
export type TomlSegment = string | number;

/**
 * An ordered sequence of {@link TomlSegment} values describing a location
 * within a TOML document's semantic tree.
 *
 * @see {@link TomlSegment} for the per-step key-or-index type.
 * @see {@link TomlFormat.modify} for the entry point that resolves a path against a document.
 * @category type-level
 * @since 0.0.0
 */
export type TomlPath = ReadonlyArray<TomlSegment>;

/**
 * A range within a TOML document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units. Pass to `TomlFormat.format`
 * to restrict formatting to the expressions intersecting a region.
 *
 * **Gotchas**
 *
 * Offsets are UTF-16 code units, not bytes. Supplementary-plane characters
 * occupy two units, so a byte-oriented splice will miss the intended span.
 *
 * **Example** (Restrict formatting to a span)
 *
 * ```ts
 * import { TomlFormat, TomlRange } from "@beep/scratchpad/toml"
 *
 * const range = TomlRange.make({ offset: 0, length: 12 })
 * const edits = TomlFormat.format('name="Alice"\nage=1\n', range)
 * console.log(edits.length > 0) // true
 * console.log(range.offset) // 0
 * ```
 *
 * @see {@link TomlFormat.format} to apply this range as a formatting window.
 * @category models
 * @since 0.0.0
 */
export class TomlRange extends Schema.Class<TomlRange>($I`TomlRange`)(
	{
		offset: Schema.Number,
		length: Schema.Number,
	},
	$I.annote("TomlRange", {
		description: "A UTF-16 offset/length window used to restrict TOML formatting to intersecting expressions.",
	}),
) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * **Details**
 *
 * Structurally identical to jsonc and yaml edit shapes (same field names,
 * types, and semantics) per the document-codec parity convention, so consumer
 * code can be written once over "a document codec's Edit/Range/Path".
 *
 * **Gotchas**
 *
 * {@link TomlEdit.applyAll} sorts by reverse offset so earlier offsets stay
 * valid and does not mutate the input array. Overlapping edits are a
 * programmer defect (`Error`), not {@link TomlModificationError} —
 * {@link TomlFormat} never produces overlaps. Offsets are UTF-16 code units.
 *
 * **Example** (Replace a quoted string span)
 *
 * ```ts
 * import { TomlEdit } from "@beep/scratchpad/toml"
 *
 * const text = 'name = "Alice"\n'
 * const edited = TomlEdit.applyAll(text, [
 *   TomlEdit.make({ offset: 8, length: 5, content: "Bob" }),
 * ])
 * console.log(edited) // 'name = "Bob"\n'
 * ```
 *
 * @see {@link TomlFormat.format} for the producer that never emits overlapping edits.
 * @see {@link TomlFormat.modify} for path-based edits applied through {@link TomlEdit.applyAll}.
 * @category models
 * @since 0.0.0
 */
export class TomlEdit extends Schema.Class<TomlEdit>($I`TomlEdit`)(
	{
		offset: Schema.Number,
		length: Schema.Number,
		content: Schema.String,
	},
	$I.annote("TomlEdit", {
		description: "A non-mutating text splice replacing [offset, offset + length) with content.",
	}),
) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated. Overlapping edits are a programmer error and throw
	 * as a defect — `TomlFormat` never produces them.
	 *
	 * **Example** (Insert then replace without mutating the edit list)
	 *
	 * ```ts
	 * import { TomlEdit } from "@beep/scratchpad/toml"
	 *
	 * const edits = [
	 *   TomlEdit.make({ offset: 0, length: 0, content: "# hi\n" }),
	 *   TomlEdit.make({ offset: 8, length: 5, content: "Bob" }),
	 * ]
	 * const edited = TomlEdit.applyAll('name = "Alice"\n', edits)
	 * console.log(edited) // '# hi\nname = "Bob"\n'
	 * console.log(edits.length) // 2
	 * ```
	 *
	 * @param text - Source text to splice; never mutated.
	 * @param edits - Splices applied last-offset-first; the array is copied before sorting.
	 * @returns The spliced string.
	 * @throws An `Error` when two edits overlap — a programmer defect, not a typed modification failure.
	 * @see {@link TomlFormat.format} for the producer that never emits overlapping edits.
	 */
	static applyAll(text: string, edits: ReadonlyArray<TomlEdit>): string {
		const sorted = [...edits].sort((a, b) => b.offset - a.offset);
		for (let i = 0; i + 1 < sorted.length; i++) {
			const upper = sorted[i];
			const lower = sorted[i + 1];
			if (lower.offset + lower.length > upper.offset) {
				throw new Error(
					`TomlEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
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

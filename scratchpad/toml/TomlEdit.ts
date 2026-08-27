// The non-mutating text-edit vocabulary shared by the formatter and the
// modifier: TomlEdit, TomlRange, TomlPath and TomlSegment. Edits are text
// splices computed against the linear CST's expression spans — applying them
// in reverse-offset order is byte-minimal and preserves comments and layout,
// the package's real differentiator over parse → re-stringify round trips.
//
// `TomlEdit`, `TomlRange`, `TomlPath` and `TomlSegment` are bound by the
// jsonc/yaml parity convention: they are structurally identical to their
// `Jsonc*` and `Yaml*` counterparts (same field names, types and semantics)
// so consumer code can be written once over "a document codec's
// Edit/Range/Path".

import { Schema } from "effect";

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
export class TomlRange extends Schema.Class<TomlRange>("TomlRange")({
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * @remarks
 * Structurally identical to `@effected/jsonc`'s and `@effected/yaml`'s edit
 * shapes (same field names, types and semantics) per the jsonc/yaml parity
 * convention, so consumer code can be written once over "a document codec's
 * Edit/Range/Path".
 *
 * @public
 */
export class TomlEdit extends Schema.Class<TomlEdit>("TomlEdit")({
	offset: Schema.Number,
	length: Schema.Number,
	content: Schema.String,
}) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated. Overlapping edits are a programmer error and throw
	 * as a defect — `TomlFormat` never produces them.
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

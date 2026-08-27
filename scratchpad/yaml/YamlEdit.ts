// The non-mutating text-edit vocabulary shared by the formatter and modifier:
// YamlEdit, YamlRange, YamlPath and YamlSegment.
//
// Edits describe replacements as `offset`/`length`/`content`; applying them in
// reverse-offset order is byte-minimal and preserves comments and whitespace —
// the library's real differentiator over `yaml` round-trips.
//
// `YamlEdit`, `YamlRange`, `YamlPath`, `YamlSegment` and
// `YamlFormattingOptions` are bound by the jsonc/yaml parity convention: they
// are structurally identical to their `Jsonc*` counterparts (same field names,
// types, optionality and semantics) so consumer code can be written once over
// "a document codec's Edit/Range/Path".

import { Schema } from "effect";

/**
 * A single path segment: a `string` for mapping keys or a `number` for
 * sequence indices.
 *
 * @public
 */
export type YamlSegment = string | number;

/**
 * An ordered sequence of {@link (YamlSegment:type)} values describing a
 * location within a YAML document tree.
 *
 * @public
 */
export type YamlPath = ReadonlyArray<YamlSegment>;

/**
 * A range within a YAML document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units. Pass to `YamlFormat.format`
 * to restrict formatting to a region.
 *
 * @public
 */
export class YamlRange extends Schema.Class<YamlRange>("YamlRange")({
	offset: Schema.Number,
	length: Schema.Number,
}) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * @remarks
 * Structurally identical to `@effected/jsonc`'s edit shape (same field names,
 * types and semantics) per the jsonc/yaml parity convention, so consumer code
 * can be written once over "a document codec's Edit/Range/Path".
 *
 * @public
 */
export class YamlEdit extends Schema.Class<YamlEdit>("YamlEdit")({
	offset: Schema.Number,
	length: Schema.Number,
	content: Schema.String,
}) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated. Overlapping edits are a programmer error and throw
	 * as a defect — `YamlFormat` never produces them.
	 */
	static applyAll(text: string, edits: ReadonlyArray<YamlEdit>): string {
		const sorted = [...edits].sort((a, b) => b.offset - a.offset);
		for (let i = 0; i + 1 < sorted.length; i++) {
			const upper = sorted[i];
			const lower = sorted[i + 1];
			if (lower.offset + lower.length > upper.offset) {
				throw new Error(
					`YamlEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
				);
			}
		}
		let result = text;
		for (const edit of sorted) {
			result = result.substring(0, edit.offset) + edit.content + result.substring(edit.offset + edit.length);
		}
		return result;
	}
}

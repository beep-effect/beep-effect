// The non-mutating text-edit vocabulary shared by the formatter and modifier:
// YamlEdit, YamlRange, YamlPath and YamlSegment.
//
// Edits describe replacements as `offset`/`length`/`content`; applying them in
// reverse-offset order is byte-minimal and preserves comments and whitespace —
// the core value proposition over `yaml` round-trips.
//
// `YamlEdit`, `YamlRange`, `YamlPath`, `YamlSegment` and
// `YamlFormattingOptions` are bound by the cross-package parity convention:
// they are structurally identical to their `Jsonc*`, `Toml*` and `Markdown*`
// counterparts (same field names, types, optionality and semantics) so
// consumer code can be written once over "a document codec's Edit/Range/Path".

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/yaml/YamlEdit");

/** A defect raised when a YAML helper invariant is violated. */
class YamlEditFailure extends S.TaggedError<YamlEditFailure>($I`YamlEditFailure`)("YamlEditFailure", {
	message: S.String,
}) {}

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
export class YamlRange extends S.Class<YamlRange>($I`YamlRange`)({
	offset: S.Finite.annotateKey({ description: "Zero-based start of the source region to format, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Extent of the source region to format, measured in UTF-16 code units" }),
}, $I.annote("YamlRange", { description: "A range within a YAML document, expressed as a zero-based character `offset` and a `length` in UTF-16 code units. Pass to `YamlFormat.format` to restrict formatting to a region." })) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * @remarks
 * Structurally identical to the edit shape of `@effected/jsonc`,
 * `@effected/toml` and `@effected/markdown` (same field names, types and
 * semantics), so consumer code can be written once over "a document codec's
 * Edit/Range/Path".
 *
 * @public
 */
export class YamlEdit extends S.Class<YamlEdit>($I`YamlEdit`)({
	offset: S.Finite.annotateKey({ description: "Zero-based start of the replacement span in the original source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Number of source UTF-16 code units to replace; `0` inserts without removing text" }),
	content: S.String.annotateKey({ description: "Replacement text for the selected source span; an empty string deletes the span" }),
}, $I.annote("YamlEdit", { description: "A non-mutating text edit: replace the span `[offset, offset + length)` with `content`. Set `length` to `0` to insert, `content` to `\"\"` to delete." })) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated. Overlapping edits are a programmer error and throw
	 * as a defect — `YamlFormat` never produces them.
	 *
	 * @param text - The source text to edit.
	 * @param edits - The edits to apply, in any order.
	 * @returns The edited text.
	 */
	static applyAll(text: string, edits: ReadonlyArray<YamlEdit>): string {
		const sorted = A.sort(edits, Order.flip(Order.mapInput(Order.Number, (edit: YamlEdit) => edit.offset)));
		for (let i = 0; i + 1 < sorted.length; i++) {
			const upper = sorted[i];
			if (upper === undefined) throw YamlEditFailure.make({ message: "Missing upper" });
			const lower = sorted[i + 1];
			if (lower === undefined) throw YamlEditFailure.make({ message: "Missing lower" });
			if (lower.offset + lower.length > upper.offset) {
				throw YamlEditFailure.make({
					message: `YamlEdit.applyAll received overlapping edits at offsets ${lower.offset} and ${upper.offset} — overlapping edits are a programmer error`,
				});
			}
		}
		let result = text;
		for (const edit of sorted) {
			result = result.substring(0, edit.offset) + edit.content + result.substring(edit.offset + edit.length);
		}
		return result;
	}
}

/**
 * Non-mutating YAML text edits shared by the formatter and modifier.
 *
 * Edits describe replacements as `offset`/`length`/`content`. Applying them in
 * reverse-offset order is byte-minimal and preserves comments and whitespace —
 * the differentiator over round-trip stringify.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";

const $I = $ScratchpadId.create("yaml/YamlEdit");

class YamlEditOverlapError extends Schema.TaggedError<YamlEditOverlapError>($I`YamlEditOverlapError`)(
	"YamlEditOverlapError",
	{
		lowerOffset: Schema.Finite,
		upperOffset: Schema.Finite,
	},
	$I.annote("YamlEditOverlapError", {
		description: "Programmer defect raised when two YAML text edits overlap.",
	}),
) {
	override get message(): string {
		return `YamlEdit.applyAll received overlapping edits at offsets ${this.lowerOffset} and ${this.upperOffset} — overlapping edits are a programmer error`;
	}
}

/**
 * A single path segment: a `string` for mapping keys or a `number` for
 * sequence indices.
 *
 * **Example** (Guard a path segment)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlSegment } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlSegment)("name")) // true
 * console.log(S.is(YamlSegment)(0)) // true
 * ```
 *
 * @see {@link YamlPath} for an ordered sequence of segments naming a tree location.
 * @see {@link YamlFormat.modify} for the path-targeted editor that consumes these segments.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export const YamlSegment = Schema.Union([Schema.String, Schema.Finite]).pipe(
	$I.annoteSchema("YamlSegment", {
		description: "A YAML path segment: a mapping key string or finite sequence index.",
	}),
);

export type YamlSegment = typeof YamlSegment.Type;

/**
 * An ordered sequence of {@link (YamlSegment:type)} values describing a
 * location within a YAML document tree.
 *
 * **Example** (Guard a YAML path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlPath } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlPath)(["users", 0, "name"])) // true
 * ```
 *
 * @see {@link YamlSegment} for the string-key / numeric-index members.
 * @see {@link YamlFormat.modify} for applying a path against a composed document.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export const YamlPath = Schema.Array(YamlSegment).pipe(
	$I.annoteSchema("YamlPath", {
		description: "Ordered YAML path from the document root through mapping keys and sequence indices.",
	}),
);

export type YamlPath = typeof YamlPath.Type;

/**
 * A range within a YAML document, expressed as a zero-based character
 * `offset` and a `length` in UTF-16 code units. Pass to {@link YamlFormat.format}
 * to restrict formatting to a region.
 *
 * **Example** (Make a range and restrict formatting)
 *
 * ```ts
 * import { YamlFormat, YamlFormattingOptions, YamlRange } from "@beep/scratchpad/yaml"
 *
 * const text = "key:\n- a\n- b\n"
 * const options = YamlFormattingOptions.make({ indentSequences: true })
 * const range = YamlRange.make({ offset: 0, length: 4 })
 *
 * console.log(YamlFormat.formatToString(text, range, options) === text) // true
 * console.log(YamlFormat.formatToString(text, undefined, options).includes("  - a")) // true
 * ```
 *
 * @see {@link YamlRangeLike} for the structurally interchangeable plain `{ offset, length }` literal.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlRange extends Schema.Class<YamlRange>("YamlRange")(
	{
		offset: Schema.Finite,
		length: Schema.Finite,
	},
	$I.annote("YamlRange", {
		description: "A zero-based UTF-16 span used to restrict YAML formatting to a region.",
	}),
) {}

/**
 * A non-mutating text edit: replace the span `[offset, offset + length)` with
 * `content`. Set `length` to `0` to insert, `content` to `""` to delete.
 *
 * **Details**
 *
 * Structurally identical to `@effected/jsonc`'s edit shape (same field names,
 * types and semantics) per the jsonc/yaml parity convention, so consumer code
 * can be written once over "a document codec's Edit/Range/Path".
 *
 * **Gotchas**
 *
 * {@link YamlEdit.applyAll} throws when edits overlap. That throw is a
 * programmer defect outside any typed error channel — {@link YamlFormat} never
 * produces overlapping edits, so hand-built arrays must not either. Treat
 * `applyAll` as total only for non-overlapping input.
 *
 * **Example** (Apply non-overlapping replacements)
 *
 * ```ts
 * import { YamlEdit } from "@beep/scratchpad/yaml"
 *
 * const updated = YamlEdit.applyAll("a: 1\nb: 2\n", [
 *   YamlEdit.make({ offset: 3, length: 1, content: "9" }),
 *   YamlEdit.make({ offset: 8, length: 1, content: "8" }),
 * ])
 *
 * console.log(updated) // "a: 9\nb: 8\n"
 * ```
 *
 * @see {@link YamlFormat.format} for the producer that never emits overlapping edits.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlEdit extends Schema.Class<YamlEdit>("YamlEdit")(
	{
		offset: Schema.Finite,
		length: Schema.Finite,
		content: Schema.String,
	},
	$I.annote("YamlEdit", {
		description: "A byte-span replacement used to format or modify YAML without mutating the source string.",
	}),
) {
	/**
	 * Apply `edits` to `text`, producing a new string. Edits are applied in
	 * reverse-offset order so earlier offsets stay valid; the input `edits`
	 * array is not mutated.
	 *
	 * **Gotchas**
	 *
	 * Overlapping edits — including two insertions at the same offset — are a
	 * programmer error and throw as a defect. {@link YamlFormat} never produces
	 * them.
	 *
	 * **Example** (Apply edits from the end of the source)
	 *
	 * ```ts
	 * import { YamlEdit } from "@beep/scratchpad/yaml"
	 *
	 * const text = "a: 1\nb: 2\n"
	 * const edits = [
	 *   YamlEdit.make({ offset: 3, length: 1, content: "9" }),
	 *   YamlEdit.make({ offset: 8, length: 1, content: "8" }),
	 * ]
	 * console.log(YamlEdit.applyAll(text, edits)) // "a: 9\nb: 8\n"
	 * ```
	 *
	 * @throws Overlapping edits abort as a programmer defect because {@link YamlFormat} never produces them.
	 * @see {@link YamlFormat.format} for the producer that never overlaps.
	 */
	static applyAll(text: string, edits: ReadonlyArray<YamlEdit>): string {
		const sorted = [...edits].sort((a, b) => b.offset - a.offset);
		for (let i = 0; i + 1 < sorted.length; i++) {
			const upper = sorted[i];
			const lower = sorted[i + 1];
			if (lower.offset + lower.length > upper.offset) {
				throw YamlEditOverlapError.make({ lowerOffset: lower.offset, upperOffset: upper.offset });
			}
		}
		let result = text;
		for (const edit of sorted) {
			result = result.substring(0, edit.offset) + edit.content + result.substring(edit.offset + edit.length);
		}
		return result;
	}
}

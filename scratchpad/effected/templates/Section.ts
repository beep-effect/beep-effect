import { Effect, Schema } from "effect";
import { CommentStyle } from "./CommentStyle.ts";

/**
 * The name identifying a managed section, as it literally appears in the
 * file's markers.
 *
 * @remarks
 * Keys are **case-sensitive** and rendered verbatim: the key a consumer
 * declares is the key the marker carries. A file already containing
 * `SAVVY-LINT` markers is managed by declaring the key `"SAVVY-LINT"`.
 *
 * The character set is bounded so a key can always be read back out of a
 * marker unambiguously — whitespace in particular would make the scanner's
 * key capture ambiguous against the marker phrase that follows it.
 *
 * This is a checked string rather than a branded one **deliberately**: a
 * brand would force every call site through a decode step to spell
 * `SectionId.make({ key: "example-tool", … })`, and the validation a brand
 * would carry is already enforced by the check at construction.
 *
 * @public
 */
export const SectionKey = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u));

/**
 * What identifies a managed section inside a document: its key and the
 * comment style its markers are written in.
 *
 * @remarks
 * `commentStyle` is **required, with no default**. A defaulted style is how a
 * caller who forgets the argument writes `#` markers into a TypeScript file —
 * a syntax error in the user's own source, produced silently by an omission.
 *
 * @example
 * ```ts
 * import { CommentStyle, SectionId } from "./index.ts";
 *
 * const ToolSection = SectionId.make({
 *   key: "example-tool",
 *   commentStyle: CommentStyle.hash,
 * });
 *
 * const block = ToolSection.section("echo hello");
 * ```
 *
 * @public
 */
export class SectionId extends Schema.Class<SectionId>("SectionId")({
	/** The section's name, exactly as it appears in the markers. */
	key: SectionKey,
	/** How this section's markers are commented out. */
	commentStyle: CommentStyle,
}) {
	/**
	 * Pair this identity with the content a tool wants inside it.
	 *
	 * @remarks
	 * `attributes` become `name="value"` pairs on the section's BEGIN marker,
	 * emitted in the record's insertion order. They are metadata, not identity:
	 * see {@link Section} for the grammar and the equality rules.
	 */
	section(content: string, attributes?: Readonly<Record<string, string>>): Section {
		return Section.make({
			key: this.key,
			commentStyle: this.commentStyle,
			content,
			// An absent optional argument must be OMITTED, not passed as undefined.
			...(attributes === undefined ? {} : { attributes }),
		});
	}
}

/**
 * A managed section: an identity plus the content its owner wants between the
 * markers.
 *
 * @remarks
 * Equality is **structural and whitespace-significant**: a template change that
 * alters only indentation is a real change and reaches the file. The one
 * normalization this package applies is to line endings, and it happens at
 * parse time rather than inside equality, so `Equal.equals` stays honest for
 * a consumer comparing two sections directly.
 *
 * `attributes` are `name="value"` pairs carried on the BEGIN marker — metadata
 * a tool wants readable from the marker line itself, without opening the
 * content. They **participate in equality** (an attribute change is real
 * drift) but **never in identity**: the section a marker names is decided by
 * key and comment style alone, so changing an attribute updates a block in
 * place rather than orphaning it. Equality over attributes is record equality
 * — order-insensitive, so two sections carrying the same pairs in different
 * insertion orders compare equal — while an actual rewrite renders the pairs
 * in the record's insertion order. Omitting the field and passing `{}` are
 * the same section: the constructor defaults to an empty record.
 *
 * Attribute names must match `[A-Za-z][A-Za-z0-9_-]*` and values may not
 * contain `"` or a line break; violations fail typed at render, not here, so
 * runtime data can never turn construction into a defect.
 *
 * @public
 */
export class Section extends Schema.Class<Section>("Section")({
	/** The section's name, exactly as it appears in the markers. */
	key: SectionKey,
	/** How this section's markers are commented out. */
	commentStyle: CommentStyle,
	/** Everything between the markers, exclusive of the boundary line breaks. */
	content: Schema.String,
	/** The BEGIN marker's `name="value"` pairs. Empty when the marker carries none. */
	attributes: Schema.Record(Schema.String, Schema.String).pipe(Schema.withConstructorDefault(Effect.succeed({}))),
}) {
	/** This section's identity, without its content. */
	get id(): SectionId {
		return SectionId.make({ key: this.key, commentStyle: this.commentStyle });
	}

	/** The same section carrying different content. Attributes are preserved. */
	withContent(content: string): Section {
		return Section.make({ key: this.key, commentStyle: this.commentStyle, content, attributes: this.attributes });
	}
}

/**
 * A managed section as found in a document, carrying the span it occupies.
 *
 * @remarks
 * `start` and `end` bound the **whole** block, from the first character of
 * the begin marker to one past the last character of the end marker, so
 * `text.slice(start, end)` is exactly the block as written. `line` is 1-based
 * and points at the begin marker, which is what a diagnostic needs.
 *
 * @public
 */
export class PlacedSection extends Schema.Class<PlacedSection>("PlacedSection")({
	/** The section, with line endings already normalized to `\n`. */
	section: Section,
	/** Offset of the begin marker's first character. */
	start: Schema.Finite,
	/** Offset one past the end marker's last character. */
	end: Schema.Finite,
	/** 1-based line of the begin marker. */
	line: Schema.Finite,
}) {}

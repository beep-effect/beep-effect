import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CommentStyle } from "./CommentStyle.ts";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/templates/Section");

/**
 * The name identifying a managed section, as it literally appears in the
 * file's markers.
 *
 * **Details**
 *
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
 * **Example** (Validate a case-sensitive marker key)
 *
 * ```ts
 * import { SectionKey } from "@beep/scratchpad/effected/templates/Section";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(SectionKey)("SAVVY-LINT")) // true
 * console.log(S.is(SectionKey)("two words")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const SectionKey = S.String.check(
	S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u, {
		identifier: $I`SectionKeyCheck`,
		title: "Section key grammar",
		description: "A section key starts with an ASCII letter or digit and continues with letters, digits, dots, underscores, or hyphens.",
		message: "Expected a section key starting with a letter or digit and containing only letters, digits, '.', '_', or '-'.",
	}),
).annotate($I.annote("SectionKey", { description: "The case-sensitive name of a managed section, rendered verbatim in its markers." }));

/**
 * The unbranded string type validated by {@link SectionKey}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SectionKey = typeof SectionKey.Type;

/**
 * What identifies a managed section inside a document: its key and the
 * comment style its markers are written in.
 *
 * **Gotchas**
 *
 * `commentStyle` is **required, with no default**. A defaulted style is how a
 * caller who forgets the argument writes `#` markers into a TypeScript file —
 * a syntax error in the user's own source, produced silently by an omission.
 *
 * **Example** (Create a named section with hash markers)
 *
 * ```ts
 * import { SectionId } from "@beep/scratchpad/effected/templates/Section";
 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
 *
 * const ToolSection = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
 * const block = ToolSection.section("echo hello");
 * console.log(block.content) // echo hello
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SectionId extends S.Class<SectionId>($I`SectionId`)({
	/**
	 * The section's name, exactly as it appears in the markers.
	 *
	 * @since 0.0.0
	 */
	key: SectionKey.annotateKey({ description: "The section's name, exactly as it appears in the markers." }),
	/**
	 * How this section's markers are commented out.
	 *
	 * @since 0.0.0
	 */
	commentStyle: CommentStyle.annotateKey({ description: "How this section's markers are commented out." }),
}, $I.annote("SectionId", { description: "What identifies a managed section inside a document: its key and the comment style its markers are written in." })) {
	/**
	 * Pair this identity with the content a tool wants inside it.
	 *
	 * **Details**
	 *
	 * `attributes` become `name="value"` pairs on the section's BEGIN marker,
	 * emitted in the record's insertion order. They are metadata, not identity:
	 * see {@link Section} for the grammar and the equality rules.
	 *
	 * **Example** (Attach marker metadata to content)
	 *
	 * ```ts
	 * import { SectionId } from "@beep/scratchpad/effected/templates/Section";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
	 * console.log(id.section("echo hello", { origin: "ci" }).attributes.origin) // ci
	 * ```
	 * @category constructors
	 * @since 0.0.0
	 */
	section(content: string, attributes?: Readonly<Record<string, string>>): Section {
		return Section.make({
			key: this.key,
			commentStyle: this.commentStyle,
			content,
			// An absent optional argument must be OMITTED, not passed as undefined.
			...O.getSomesStruct({ attributes: O.fromUndefinedOr(attributes) }),
		});
	}
}

/**
 * A managed section: an identity plus the content its owner wants between the
 * markers.
 *
 * **Details**
 *
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
 * **Example** (Construct a section with empty metadata)
 *
 * ```ts
 * import { Section } from "@beep/scratchpad/effected/templates/Section";
 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
 * import * as R from "effect/Record";
 *
 * const section = Section.make({ key: "tool", commentStyle: CommentStyle.hash, content: "echo hello" });
 * console.log(R.isEmptyRecord(section.attributes)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Section extends S.Class<Section>($I`Section`)({
	/**
	 * The section's name, exactly as it appears in the markers.
	 *
	 * @since 0.0.0
	 */
	key: SectionKey.annotateKey({ description: "The section's name, exactly as it appears in the markers." }),
	/**
	 * How this section's markers are commented out.
	 *
	 * @since 0.0.0
	 */
	commentStyle: CommentStyle.annotateKey({ description: "How this section's markers are commented out." }),
	/**
	 * Everything between the markers, exclusive of the boundary line breaks.
	 *
	 * @since 0.0.0
	 */
	content: S.String.annotateKey({ description: "Everything between the markers, exclusive of the boundary line breaks." }),
	/**
	 * The BEGIN marker's `name="value"` pairs. Empty when the marker carries none.
	 *
	 * @since 0.0.0
	 */
	attributes: S.Record(S.String, S.String).pipe(S.withConstructorDefault(Effect.succeed({}))).annotateKey({ description: "The BEGIN marker's `name=\"value\"` pairs. Empty when the marker carries none." }),
}, $I.annote("Section", { description: "A managed section: an identity plus the content its owner wants between the markers." })) {
	/**
	 * This section's identity, without its content.
	 *
	 * **Example** (Recover the section identity)
	 *
	 * ```ts
	 * import { Section } from "@beep/scratchpad/effected/templates/Section";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * const section = Section.make({ key: "tool", commentStyle: CommentStyle.hash, content: "echo hello" });
	 * console.log(section.id.key) // tool
	 * ```
	 * @category getters
	 * @since 0.0.0
	 */
	get id(): SectionId {
		return SectionId.make({ key: this.key, commentStyle: this.commentStyle });
	}

	/**
	 * The same section carrying different content. Attributes are preserved.
	 *
	 * **Example** (Replace content while preserving metadata)
	 *
	 * ```ts
	 * import { SectionId } from "@beep/scratchpad/effected/templates/Section";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
	 * const updated = id.section("old", { origin: "ci" }).withContent("new");
	 * console.log(updated.content) // new
	 * console.log(updated.attributes.origin) // ci
	 * ```
	 * @category mapping
	 * @since 0.0.0
	 */
	withContent(content: string): Section {
		return Section.make({ key: this.key, commentStyle: this.commentStyle, content, attributes: this.attributes });
	}
}

/**
 * A managed section as found in a document, carrying the span it occupies.
 *
 * **Details**
 *
 * `start` and `end` bound the **whole** block, from the first character of
 * the begin marker to one past the last character of the end marker, so
 * `text.slice(start, end)` is exactly the block as written. `line` is 1-based
 * and points at the begin marker, which is what a diagnostic needs.
 *
 * **Example** (Inspect a parsed block span)
 *
 * ```ts
 * import { PlacedSection, SectionId } from "@beep/scratchpad/effected/templates/Section";
 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
 *
 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
 * const placed = PlacedSection.make({ section: id.section("echo hello"), start: 0, end: 80, line: 1 });
 * console.log(placed.end - placed.start) // 80
 * console.log(placed.line) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PlacedSection extends S.Class<PlacedSection>($I`PlacedSection`)({
	/**
	 * The section, with line endings already normalized to `\n`.
	 *
	 * @since 0.0.0
	 */
	section: Section.annotateKey({ description: "The section, with line endings already normalized to `\\n`." }),
	/**
	 * Offset of the begin marker's first character.
	 *
	 * @since 0.0.0
	 */
	start: S.Finite.annotateKey({ description: "Offset of the begin marker's first character." }),
	/**
	 * Offset one past the end marker's last character.
	 *
	 * @since 0.0.0
	 */
	end: S.Finite.annotateKey({ description: "Offset one past the end marker's last character." }),
	/**
	 * 1-based line of the begin marker.
	 *
	 * @since 0.0.0
	 */
	line: S.Finite.annotateKey({ description: "1-based line of the begin marker." }),
}, $I.annote("PlacedSection", { description: "A managed section as found in a document, carrying the span it occupies." })) {}

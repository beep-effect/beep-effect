import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/templates/CommentStyle");

/**
 * A comment delimiter: non-empty, and free of control characters.
 *
 * **Details**
 *
 * Every constraint is load-bearing rather than decorative. An empty delimiter
 * would make the marker scanner match every line in a document. A delimiter
 * containing a line break would let a caller inject arbitrary lines into a
 * rendered marker. And a delimiter containing NUL would collide in
 * {@link CommentStyle.id}, where NUL is the field separator — `{ prefix: "a\0b" }`
 * and `{ prefix: "a", suffix: "b" }` would key the same lookup entry. All of
 * them fail at construction.
 *
 * The pattern is a negated character class with a single quantifier, so it
 * cannot backtrack on hostile input.
 *
 * @since 0.0.0
 */
const Delimiter = S.String.check(
	S.isPattern(/^\P{Cc}+$/u, {
		identifier: $I`DelimiterCheck`,
		title: "Comment delimiter grammar",
		description: "A comment delimiter is non-empty and contains no control characters.",
		message: "Expected a non-empty comment delimiter without control characters.",
	}),
).annotate($I.annote("Delimiter", { description: "A non-empty comment delimiter free of control characters." }));

/**
 * How a managed section's markers are commented out in a given file format.
 *
 * **Details**
 *
 * A **line** style carries only a `prefix` (`#`, `//`); a **wrapped** style
 * carries a `suffix` as well (`<!--` … `-->`). The wrapped form is what makes
 * managed sections representable in Markdown, HTML and XML.
 *
 * The preset set is a convenience, not a closed world: a format nobody
 * anticipated is one `CommentStyle.make({ prefix: "%" })` away.
 *
 * **Example** (Use preset and custom comment styles)
 *
 * ```ts
 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
 *
 * console.log(CommentStyle.hash.prefix) // #
 * console.log(CommentStyle.html.suffix) // -->
 * // ML comments need no preset.
 * console.log(CommentStyle.make({ prefix: "(*", suffix: "*)" }).suffix) // *)
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommentStyle extends S.Class<CommentStyle>($I`CommentStyle`)({
	/**
	 * Opens the comment. Non-empty, single-line.
	 *
	 * @since 0.0.0
	 */
	prefix: Delimiter.annotateKey({ description: "Opens the comment. Non-empty, single-line." }),
	/**
	 * Closes the comment, for wrapped styles. Omitted for line styles.
	 *
	 * @since 0.0.0
	 */
	suffix: S.optionalKey(Delimiter).annotateKey({ description: "Closes the comment, for wrapped styles. Omitted for line styles." }),
}, $I.annote("CommentStyle", { description: "How a managed section's markers are commented out in a given file format." })) {
	/**
	 * Provides hash-prefixed comments for Shell, YAML, TOML, Python, Dockerfile, and `.env`.
	 *
	 * **Example** (Inspect the hash preset)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.hash.prefix) // #
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly hash: CommentStyle = CommentStyle.make({ prefix: "#" });

	/**
	 * Provides slash-prefixed comments for JavaScript, TypeScript, C, Go, Rust, and JSONC.
	 *
	 * **Example** (Inspect the slash preset)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.slash.prefix) // //
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly slash: CommentStyle = CommentStyle.make({ prefix: "//" });

	/**
	 * Provides semicolon-prefixed comments for INI, Lisp, and assembly.
	 *
	 * **Example** (Inspect the semicolon preset)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.semicolon.prefix) // ;
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly semicolon: CommentStyle = CommentStyle.make({ prefix: ";" });

	/**
	 * Provides dash-prefixed comments for SQL, Lua, and Haskell.
	 *
	 * **Example** (Inspect the dash preset)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.dash.prefix) // --
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly dash: CommentStyle = CommentStyle.make({ prefix: "--" });

	/**
	 * Wraps comments for Markdown, HTML, and XML.
	 *
	 * **Example** (Inspect the html preset)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.html.prefix) // <!--
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly html: CommentStyle = CommentStyle.make({ prefix: "<!--", suffix: "-->" });

	/**
	 * Provides block comments for CSS and the block form of every C-family language.
	 *
	 * **Example** (Inspect the block preset)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.block.prefix) // /*
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly block: CommentStyle = CommentStyle.make({ prefix: "/*", suffix: "*/" });

	/**
	 * Every preset, in the order a reader would expect: line styles first,
	 * then wrapped.
	 *
	 * **Details**
	 *
	 * A grouped static over variants of one concept that live in one module
	 * and reach nothing heavier than each other — nothing sits behind a preset
	 * but a two-field object, so this is not the namespace-object hazard.
	 *
	 * **Example** (Count the built-in styles)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.presets.length) // 6
	 * ```
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly presets: ReadonlyArray<CommentStyle> = [
		CommentStyle.hash,
		CommentStyle.slash,
		CommentStyle.semicolon,
		CommentStyle.dash,
		CommentStyle.html,
		CommentStyle.block,
	];

	/**
	 * A stable string identity, for keying a plain `Map`.
	 *
	 * **Details**
	 *
	 * The `NUL` separator is not cosmetic: without it `{ prefix: "ab" }`
	 * and `{ prefix: "a", suffix: "b" }` would produce the same id and two
	 * genuinely different styles would collide in a lookup table. `NUL`
	 * cannot occur in a delimiter, because delimiters exclude control characters,
	 * so the encoding is unambiguous.
	 *
	 * **Example** (Inspect the collision-safe identity)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.hash.id === "#\u0000") // true
	 * ```
	 * @category getters
	 * @since 0.0.0
	 */
	get id(): string {
		return `${this.prefix}\u0000${this.suffix ?? ""}`;
	}

	/**
	 * True when the style wraps its content, i.e. it carries a suffix.
	 *
	 * **Example** (Distinguish wrapped comments)
	 *
	 * ```ts
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(CommentStyle.html.isWrapped) // true
	 * console.log(CommentStyle.hash.isWrapped) // false
	 * ```
	 * @category predicates
	 * @since 0.0.0
	 */
	get isWrapped(): boolean {
		return this.suffix !== undefined;
	}
}

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/templates/CommentStyle");

/**
 * A comment delimiter: non-empty, and free of control characters.
 *
 * @remarks
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
 * @remarks
 * A **line** style carries only a `prefix` (`#`, `//`); a **wrapped** style
 * carries a `suffix` as well (`<!--` … `-->`). The wrapped form is what makes
 * managed sections representable in Markdown, HTML and XML.
 *
 * The preset set is a convenience, not a closed world: a format nobody
 * anticipated is one `CommentStyle.make({ prefix: "%" })` away.
 *
 * @example
 * ```ts
 * import { CommentStyle } from "./index.ts";
 *
 * CommentStyle.hash;                                  // # …
 * CommentStyle.html;                                  // <!-- … -->
 * CommentStyle.make({ prefix: "(*", suffix: "*)" });  // ML, no preset needed
 * ```
 *
 * @public
 */
export class CommentStyle extends S.Class<CommentStyle>($I`CommentStyle`)({
	/** Opens the comment. Non-empty, single-line. */
	prefix: Delimiter.annotateKey({ description: "Opens the comment. Non-empty, single-line." }),
	/** Closes the comment, for wrapped styles. Omitted for line styles. */
	suffix: S.optionalKey(Delimiter).annotateKey({ description: "Closes the comment, for wrapped styles. Omitted for line styles." }),
}, $I.annote("CommentStyle", { description: "How a managed section's markers are commented out in a given file format." })) {
	/** Shell, YAML, TOML, Python, Dockerfile, `.env`. */
	static readonly hash: CommentStyle = CommentStyle.make({ prefix: "#" });

	/** JavaScript, TypeScript, C, Go, Rust, JSONC. */
	static readonly slash: CommentStyle = CommentStyle.make({ prefix: "//" });

	/** INI, Lisp, assembly. */
	static readonly semicolon: CommentStyle = CommentStyle.make({ prefix: ";" });

	/** SQL, Lua, Haskell. */
	static readonly dash: CommentStyle = CommentStyle.make({ prefix: "--" });

	/** Markdown, HTML, XML — a wrapped style. */
	static readonly html: CommentStyle = CommentStyle.make({ prefix: "<!--", suffix: "-->" });

	/** CSS, and the block form of every C-family language. */
	static readonly block: CommentStyle = CommentStyle.make({ prefix: "/*", suffix: "*/" });

	/**
	 * Every preset, in the order a reader would expect: line styles first,
	 * then wrapped.
	 *
	 * @remarks
	 * A grouped static over variants of one concept that live in one module
	 * and reach nothing heavier than each other — nothing sits behind a preset
	 * but a two-field object, so this is not the namespace-object hazard.
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
	 * @remarks
	 * The `NUL` separator is not cosmetic: without it `{ prefix: "ab" }`
	 * and `{ prefix: "a", suffix: "b" }` would produce the same id and two
	 * genuinely different styles would collide in a lookup table. `NUL`
	 * cannot occur in a delimiter, because delimiters exclude control characters,
	 * so the encoding is unambiguous.
	 */
	get id(): string {
		return `${this.prefix}\u0000${this.suffix ?? ""}`;
	}

	/** True when the style wraps its content, i.e. it carries a suffix. */
	get isWrapped(): boolean {
		return this.suffix !== undefined;
	}
}

import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Equal from "effect/Equal";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CommentStyle } from "./CommentStyle.ts";
import { isValidAttributeName, isValidAttributeValue, parseAttributeRun } from "./internal/attributes.ts";
import type { Section, SectionId } from "./Section.ts";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/templates/SectionDialect");

/**
 * The line ending a document uses.
 *
 * **Example** (Accepted line endings)
 *
 * ```ts
 * import { Eol } from "@beep/scratchpad/effected/templates/SectionDialect";
 *
 * console.log(Eol.literals.length) // 2
 * console.log(Eol.literals[0] === "\n") // true
 * console.log(Eol.literals[1] === "\r\n") // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Eol = LiteralKit(["\n", "\r\n"]).annotate(
	$I.annote("Eol", { description: "The LF or CRLF line ending used by a document." }),
);
/**
 * The LF or CRLF literal accepted by the {@link Eol} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Eol = typeof Eol.Type;

/**
 * Raised when a section cannot be turned into marker-delimited text.
 *
 * **Details**
 *
 * These reasons describe a document this package would be unable to read back
 * correctly, so rendering refuses rather than writing something it cannot
 * re-parse.
 *
 * **Example** (Inspect a duplicate declaration refusal)
 *
 * ```ts
 * import { SectionRenderError } from "@beep/scratchpad/effected/templates/SectionDialect";
 *
 * const error = SectionRenderError.make({ reason: "duplicateDeclaration", key: "tool" });
 * console.log(error.message) // Section "tool" was declared twice in one call
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SectionRenderError extends S.TaggedError<SectionRenderError>($I`SectionRenderError`)("SectionRenderError", {
	/**
	 * `markerInContent` — the content carries a line the scanner would read as
	 * a marker, which would move the block boundary and let the next sync
	 * consume user text. `unknownCommentStyle` — the section's comment style
	 * is not in the dialect's set, so the block would be written into a
	 * document where the scanner could never find it again, growing a
	 * duplicate on every run. `duplicateDeclaration` — the same identity was
	 * declared twice in one call, so the caller stated two intentions for one
	 * block and any choice between them would be a guess; this is the
	 * caller-side twin of the document-side `duplicateSection`.
	 * `invalidAttribute` — an attribute's name is outside the
	 * `[A-Za-z][A-Za-z0-9_-]*` grammar, or its value contains `"` or a line
	 * break; either would render a marker the scanner could not read back
	 * verbatim, and there is no escaping mechanism by design.
	 *
	 * @since 0.0.0
	 */
	reason: S.Literals(["markerInContent", "unknownCommentStyle", "duplicateDeclaration", "invalidAttribute"]).annotateKey({ description: "`markerInContent` — the content carries a line the scanner would read as a marker, which would move the block boundary and let the next sync consume user text. `unknownCommentStyle` — the section's comment style is not in the dialect's set, so the block would be written into a document where the scanner could never find it again, growing a duplicate on every run. `duplicateDeclaration` — the same identity was declared twice in one call, so the caller stated two intentions for one block and any choice between them would be a guess; this is the caller-side twin of the document-side `duplicateSection`. `invalidAttribute` — an attribute's name is outside the `[A-Za-z][A-Za-z0-9_-]*` grammar, or its value contains `\"` or a line break; either would render a marker the scanner could not read back verbatim, and there is no escaping mechanism by design." }),
	/**
	 * The key of the section that could not be rendered.
	 *
	 * @since 0.0.0
	 */
	key: S.String.annotateKey({ description: "The key of the section that could not be rendered." }),
	/**
	 * The offending attribute's name, when the refusal names one.
	 *
	 * @since 0.0.0
	 */
	attribute: S.optionalKey(S.String).annotateKey({ description: "The offending attribute's name, when the refusal names one." }),
}, $I.annote("SectionRenderError", { description: "Raised when a section cannot be turned into marker-delimited text." })) {
	/**
	 * Explains why rendering refused the named section.
	 *
	 * **Example** (Name the invalid attribute)
	 *
	 * ```ts
	 * import { SectionRenderError } from "@beep/scratchpad/effected/templates/SectionDialect";
	 *
	 * const error = SectionRenderError.make({ reason: "invalidAttribute", key: "tool", attribute: "origin" });
	 * console.log(error.message) // Section "tool" declares attribute "origin" with an invalid name or value
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return Match.value(this.reason).pipe(
			Match.when("markerInContent", () => `Section "${this.key}" has content containing a managed-section marker`),
			Match.when("unknownCommentStyle", () => `Section "${this.key}" uses a comment style this dialect does not recognize`),
			Match.when("invalidAttribute", () =>
				this.attribute === undefined
					? `Section "${this.key}" declares an attribute with an invalid name or value`
					: `Section "${this.key}" declares attribute "${this.attribute}" with an invalid name or value`,
			),
			Match.when("duplicateDeclaration", () => `Section "${this.key}" was declared twice in one call`),
			Match.exhaustive,
		);
	}
}

/** The key grammar, mirrored from `SectionKey` for the scanner's capture group. */
const KEY_CAPTURE = "([A-Za-z0-9][A-Za-z0-9._-]*)";

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Inter-token whitespace is tolerated on read, normalized on write. */
const GAP = "[ \\t]+";

/**
 * The marker vocabulary: what phrase delimits a managed section, and which
 * comment styles a document is scanned for.
 *
 * **Details**
 *
 * `styles` exists because reconciliation must **recognize sections it does
 * not own** — a foreign tool's block in the same file is preserved verbatim
 * and must never be mistaken for prose. That set cannot be derived from the
 * caller's own sections, because a foreign block's style may appear nowhere
 * in them.
 *
 * One phrase per dialect is deliberate: two marker families in one document
 * make parsing ambiguous for no benefit anyone has asked for.
 *
 * **Example** (Choose a custom marker phrase)
 *
 * ```ts
 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
 *
 * const dialect = SectionDialect.make({ phrase: "GENERATED CODE", styles: [CommentStyle.slash] });
 * console.log(dialect.phrase) // GENERATED CODE
 * console.log(dialect.recognizes(CommentStyle.slash)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SectionDialect extends S.Class<SectionDialect>($I`SectionDialect`)({
	/**
	 * The phrase between the key and the closing rule.
	 *
	 * **Details**
	 *
	 * Letters, digits, spaces and underscores only. Dashes are excluded so a
	 * phrase can never contain the `---` rule and make a marker ambiguous
	 * against itself.
	 *
	 * @since 0.0.0
  */
	phrase: S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9 _]*$/u)).annotateKey({ description: "The phrase between the key and the closing rule." }),
	/**
	 * Which comment styles the document scanner recognizes. At least one.
	 *
	 * @since 0.0.0
	 */
	styles: S.Array(CommentStyle).check(S.isMinLength(1)).annotateKey({ description: "Which comment styles the document scanner recognizes. At least one." }),
}, $I.annote("SectionDialect", { description: "The marker vocabulary: what phrase delimits a managed section, and which comment styles a document is scanned for." })) {
	// Runtime-only state belongs to its dialect; private fields never enter the wire form.
	/**
	 * Keeps the compiled scanners on this dialect instance, outside its wire form.
	 *
	 * **Example** (Observe the instance scanner cache)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 *
	 * const dialect = SectionDialect.default;
	 * console.log(dialect.matchers() === dialect.matchers()) // true
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	readonly #compiledMatchers = this.compileMatchers();

	/**
	 * The zero-configuration dialect: the phrase `MANAGED SECTION` and every
	 * preset comment style.
	 *
	 * **Example** (Inspect the default marker vocabulary)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 *
	 * console.log(SectionDialect.default.phrase) // MANAGED SECTION
	 * console.log(SectionDialect.default.styles.length) // 6
	 * ```
	 *
	 * @category constants
	 * @since 0.0.0
	 */
	static readonly default: SectionDialect = SectionDialect.make({
		phrase: "MANAGED SECTION",
		styles: CommentStyle.presets,
	});

	/**
	 * True when a section written in this style can be scanned back.
	 *
	 * **Example** (Check a custom style against the dialect)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * console.log(SectionDialect.default.recognizes(CommentStyle.hash)) // true
	 * console.log(SectionDialect.default.recognizes(CommentStyle.make({ prefix: "%" }))) // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	recognizes(style: CommentStyle): boolean {
		return this.styles.some((candidate) => Equal.equals(candidate, style));
	}

	/**
	 * The opening marker line for an identity, without a line break.
	 *
	 * **Example** (Format a hash BEGIN marker)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 * import { SectionId } from "@beep/scratchpad/effected/templates/Section";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
	 * console.log(SectionDialect.default.beginMarker(id)) // # --- BEGIN tool MANAGED SECTION ---
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	beginMarker(id: SectionId): string {
		return this.marker("BEGIN", id);
	}

	/**
	 * The closing marker line for an identity, without a line break.
	 *
	 * **Example** (Format a hash END marker)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 * import { SectionId } from "@beep/scratchpad/effected/templates/Section";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
	 * console.log(SectionDialect.default.endMarker(id)) // # --- END tool MANAGED SECTION ---
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	endMarker(id: SectionId): string {
		return this.marker("END", id);
	}

	/**
	 * A section as marker-delimited text, or a typed refusal.
	 *
	 * **Details**
	 *
	 * Fails rather than producing a document it could not read back: see
	 * {@link SectionRenderError}. Content is emitted with `eol` throughout,
	 * so a section rendered into a CRLF document stays CRLF.
	 *
	 * **Example** (Render content with CRLF line endings)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 * import { SectionId } from "@beep/scratchpad/effected/templates/Section";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 * import * as Result from "effect/Result";
	 *
	 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
	 * const rendered = SectionDialect.default.render(id.section("first\nsecond"), "\r\n");
	 * console.log(Result.isSuccess(rendered)) // true
	 * console.log(Result.isSuccess(rendered) && rendered.success.split("\r\n").length) // 4
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	render(section: Section, eol: Eol = "\n"): Result.Result<string, SectionRenderError> {
		if (!this.recognizes(section.commentStyle)) {
			return Result.fail(SectionRenderError.make({ reason: "unknownCommentStyle", key: section.key }));
		}
		for (const [name, value] of R.toEntries(section.attributes)) {
			// Attribute names and values are runtime data, so a violation is a
			// typed failure here rather than a defect at construction. Either kind
			// of violation would emit a marker the scanner reads differently — or
			// not at all — so both are refused before anything is written.
			if (!isValidAttributeName(name) || !isValidAttributeValue(value)) {
				return Result.fail(SectionRenderError.make({ reason: "invalidAttribute", key: section.key, attribute: name }));
			}
		}
		if (this.containsMarker(section.content)) {
			return Result.fail(SectionRenderError.make({ reason: "markerInContent", key: section.key }));
		}
		const normalized = section.content.replace(/\r\n/g, "\n");
		const body = eol === "\n" ? normalized : normalized.replace(/\n/g, eol);
		const begin = this.marker("BEGIN", section.id, section.attributes);
		return Result.succeed(`${begin}${eol}${body}${eol}${this.endMarker(section.id)}`);
	}

	/**
	 * True when `text` contains a line this dialect would read as a marker.
	 *
	 * **Example** (Detect markers inside proposed content)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 *
	 * console.log(SectionDialect.default.containsMarker("# --- BEGIN tool MANAGED SECTION ---")) // true
	 * console.log(SectionDialect.default.containsMarker("echo hello")) // false
	 * ```
	 *
	 * @internal
	 * @category predicates
	 * @since 0.0.0
	 */
	containsMarker(text: string): boolean {
		// `matchAll` clones the regex internally; `regex.test` would advance the
		// shared `lastIndex` and make a second call on the same text answer
		// differently from the first.
		for (const matcher of this.matchers()) {
			for (const match of text.matchAll(matcher.regex)) {
				const run = match[3];
				if (run === undefined) {
					return true;
				}
				// The scanner's rule, mirrored exactly: an END never carries
				// attributes, and a run that does not parse cleanly makes the line
				// ordinary content rather than a marker. Refusing more than the
				// scanner reads back would reject content that round-trips fine.
				if (match[1] !== "END" && parseAttributeRun(run) !== undefined) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * One compiled scanner per recognized comment style, memoized.
	 *
	 * **Details**
	 *
	 * Each pattern is anchored per line, bounds the key with an explicit
	 * character class, and carries no nested quantifier, so scanning is linear
	 * in document length. Every caller-supplied fragment — prefix, suffix,
	 * phrase — is regex-escaped before interpolation.
	 *
	 * **Example** (Inspect the memoized scanner set)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 *
	 * const dialect = SectionDialect.default;
	 * console.log(dialect.matchers().length) // 6
	 * console.log(dialect.matchers() === dialect.matchers()) // true
	 * ```
	 *
	 * @internal
	 * @category getters
	 * @since 0.0.0
  */
	matchers(): ReadonlyArray<{ readonly style: CommentStyle; readonly regex: RegExp }> {
		return this.#compiledMatchers;
	}

	/**
	 * Builds a line-anchored scanner for each recognized comment style.
	 *
	 * **Example** (Scan with a newly constructed dialect)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 *
	 * const dialect = SectionDialect.make({ phrase: "GENERATED CODE", styles: [CommentStyle.hash] });
	 * console.log(dialect.containsMarker("# --- BEGIN tool GENERATED CODE ---")) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	private compileMatchers(): ReadonlyArray<{ readonly style: CommentStyle; readonly regex: RegExp }> {
		// A phrase's internal spaces read as "some whitespace" so a hand-edited
		// file with a double space still matches.
		const phrase = escapeRegex(this.phrase).replace(/ +/g, GAP);
		const compiled = this.styles.map((style) => {
			const tail = style.suffix === undefined ? "" : `${GAP}${escapeRegex(style.suffix)}`;
			return {
				style,
				// The zero-width BOM alternative only matches after a BOM at absolute
				// offset zero; the marker span starts after that preserved byte.
				// Three further subtleties, the first two load-bearing for CRLF documents.
				//
				// The `\r?` is what makes them match at all: under `m`, `$` matches
				// before the LF and leaves the CR sitting in the line.
				//
				// It is a LOOKAHEAD rather than a consumed character so the match —
				// and therefore the section's span — stops before the CR. A match
				// that consumed it would put the CR inside the span while the
				// canonical render emits none, so every reconciliation would strip
				// one CR and the document would never reach a fixed point.
				//
				// The optional group between the phrase and the closing rule is the
				// attribute run, captured LOOSELY as one group — a repeated capture
				// group would keep only its last pair — and validated by the
				// anchored grammar in internal/attributes.ts afterwards. It is a
				// single lazy quantifier under a once-only `(?:…)?`, so the pattern
				// still carries no nested quantifier and backtracking stays bounded
				// by the line. The lazy interior is also what lets a quoted value
				// contain `---` without being mistaken for the closing rule.
				regex: new RegExp(
					`(?:^|(?<=(?<![\\s\\S])\\uFEFF))${escapeRegex(style.prefix)}${GAP}---${GAP}(BEGIN|END)${GAP}${KEY_CAPTURE}${GAP}${phrase}(?:${GAP}([^ \\t\\r\\n][^\\r\\n]*?))?${GAP}---${tail}[ \\t]*(?=\r?$)`,
					"gm",
				),
			};
		});
		return compiled;
	}

	/**
	 * Formats a marker with the identity's comment delimiters and optional BEGIN attributes.
	 *
	 * **Example** (Include attributes in the opening marker)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 * import { SectionId } from "@beep/scratchpad/effected/templates/Section";
	 * import { CommentStyle } from "@beep/scratchpad/effected/templates/CommentStyle";
	 * import * as Result from "effect/Result";
	 *
	 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
	 * const rendered = SectionDialect.default.render(id.section("echo hello", { origin: "ci" }));
	 * console.log(Result.isSuccess(rendered) && rendered.success.split("\n")[0]) // # --- BEGIN tool MANAGED SECTION origin="ci" ---
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	private marker(kind: "BEGIN" | "END", id: SectionId, attributes?: Readonly<Record<string, string>>): string {
		const tail = id.commentStyle.suffix === undefined ? "" : ` ${id.commentStyle.suffix}`;
		// Emission order is the record's insertion order — the caller's declared
		// order — while equality over attributes is order-insensitive, so a
		// hand-reordered marker with equal pairs compares Unchanged and an actual
		// rewrite renders in declared order.
		const run =
			attributes === undefined
				? ""
				: R.toEntries(attributes)
						.map(([name, value]) => ` ${name}="${value}"`)
						.join("");
		return `${id.commentStyle.prefix} --- ${kind} ${id.key} ${this.phrase}${run} ---${tail}`;
	}
}

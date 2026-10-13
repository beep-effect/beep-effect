import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Str from "effect/String";
import * as O from "effect/Option";
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
	 * `trailingCarriageReturn` — LF rendering would absorb the final bare CR
	 * into the boundary line ending and lose a byte on the next parse.
	 *
	 * @since 0.0.0
	 */
	reason: S.Literals(["markerInContent", "unknownCommentStyle", "duplicateDeclaration", "invalidAttribute", "trailingCarriageReturn"]).annotateKey({ description: "`markerInContent` — the content carries a line the scanner would read as a marker, which would move the block boundary and let the next sync consume user text. `unknownCommentStyle` — the section's comment style is not in the dialect's set, so the block would be written into a document where the scanner could never find it again, growing a duplicate on every run. `duplicateDeclaration` — the same identity was declared twice in one call, so the caller stated two intentions for one block and any choice between them would be a guess; this is the caller-side twin of the document-side `duplicateSection`. `invalidAttribute` — an attribute's name is outside the `[A-Za-z][A-Za-z0-9_-]*` grammar, or its value contains `\"` or a line break; either would render a marker the scanner could not read back verbatim, and there is no escaping mechanism by design. `trailingCarriageReturn` — LF rendering would absorb the final bare CR into the boundary line ending and lose a byte on the next parse." }),
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
			Match.when("trailingCarriageReturn", () => `Section "${this.key}" ends in a bare carriage return that LF rendering cannot preserve`),
			Match.when("duplicateDeclaration", () => `Section "${this.key}" was declared twice in one call`),
			Match.exhaustive,
		);
	}
}

/** The key grammar, mirrored from `SectionKey` for the scanner's capture group. */
const KEY_CAPTURE = "([A-Za-z0-9][A-Za-z0-9._-]*)";

const escapeRegex = (value: string): string => Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")(value);

/** Inter-token whitespace is tolerated on read, normalized on write. */
const GAP = "[ \\t]+";

/** The first offset of a trailing horizontal separator run. */
const markerGapStart = (text: string, end: number): number => {
	let index = end;
	while (index > 0 && (text[index - 1] === " " || text[index - 1] === "\t")) index -= 1;
	return index;
};

/** Recognize a closing rule at one multiline boundary without parsing attributes. */
const closingRule = (text: string, boundary: number, style: CommentStyle): readonly [number, number] | undefined => {
	let end = markerGapStart(text, boundary);
	if (style.suffix !== undefined) {
		const suffix = style.suffix;
		const suffixEnd = markerGapStart(suffix, suffix.length);
		if (suffixEnd === 0) {
			// A whitespace-only suffix still requires a separate preceding gap.
			if (!Str.includes(suffix)(Str.slice(end + 1, boundary)(text))) return undefined;
		} else {
			const suffixStart = end - suffixEnd;
			if (suffixStart < 0 || end + suffix.length - suffixEnd > boundary ||
				Str.slice(suffixStart, end + suffix.length - suffixEnd)(text) !== suffix) return undefined;
			end = markerGapStart(text, suffixStart);
			if (end === suffixStart) return undefined;
		}
	}
	if (end < 3 || Str.slice(end - 3, end)(text) !== "---") return undefined;
	const ruleStart = end - 3;
	const runEnd = markerGapStart(text, ruleStart);
	return runEnd === ruleStart ? undefined : [ruleStart, runEnd];
};

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
		return A.some(this.styles, (candidate) => Equal.equals(candidate, style));
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
		const normalized = Str.replace(/\r\n/g, "\n")(section.content);
		if (eol === "\n" && Str.endsWith("\r")(normalized)) {
			return Result.fail(SectionRenderError.make({ reason: "trailingCarriageReturn", key: section.key }));
		}
		const body = eol === "\n" ? normalized : Str.replace(/\n/g, eol)(normalized);
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
		// Content is embedded after an opening marker, so its BOM is never at
		// absolute document offset zero. Real line anchors still apply.
		for (const _marker of this.markerMatches(`\n${text}`)) return true;
		return false;
	}

	/**
	 * Yields recognized markers with their captures, source spans and attributes.
	 *
	 * **Details**
	 *
	 * Closing boundaries are recognized once per multiline boundary and style.
	 * A forward cursor associates each candidate prefix with the first closing
	 * boundary before CR or LF, then parses its single extracted attribute run.
	 * Unicode multiline boundaries may end a marker or occur inside a quoted
	 * value, preserving the regex grammar without repeated tail backtracking.
	 *
	 * **Example** (Read marker captures and source offsets)
	 *
	 * ```ts
	 * import { SectionDialect } from "@beep/scratchpad/effected/templates/SectionDialect";
	 *
	 * for (const [style, match, attributes] of SectionDialect.default.markerMatches("# --- BEGIN tool MANAGED SECTION ---")) {
	 *   console.log(style.prefix, match[1], match[2], match.index, attributes) // # BEGIN tool 0 {}
	 * }
	 * ```
	 *
	 * @internal
	 * @category parsing
	 * @since 0.0.0
	 */
	*markerMatches(text: string): Iterable<readonly [CommentStyle, RegExpMatchArray, Record<string, string>]> {
		const endings: Array<number> = [];
		const breaks: Array<number> = [];
		for (const match of Str.matchAll(/[\r\n\u2028\u2029]|$/g)(text)) {
			const offset = O.getOrThrow(O.fromUndefinedOr(match.index));
			endings.push(offset);
			if (text[offset] === "\r" || text[offset] === "\n") breaks.push(offset);
		}
		for (const matcher of this.matchers()) {
			const boundaries: Array<readonly [number, number, number]> = [];
			for (const end of endings) {
				const boundary = closingRule(text, end, matcher.style);
				if (boundary !== undefined) boundaries.push([end, boundary[0], boundary[1]]);
			}
			let boundaryCursor = 0;
			let breakCursor = 0;
			let consumed = 0;
			for (const match of Str.matchAll(matcher.regex)(text)) {
				const start = O.getOrThrow(O.fromUndefinedOr(match.index));
				if (start < consumed) continue;
				const headEnd = start + match[0].length;
				while (breakCursor < breaks.length && A.getUnsafe(breaks, breakCursor) < headEnd) breakCursor += 1;
				while (boundaryCursor < boundaries.length && A.getUnsafe(boundaries, boundaryCursor)[1] <= headEnd) boundaryCursor += 1;
				if (boundaryCursor === boundaries.length) break;
				const [end, ruleStart, runEnd] = A.getUnsafe(boundaries, boundaryCursor);
				const lineEnd = breakCursor < breaks.length ? A.getUnsafe(breaks, breakCursor) : text.length;
				if (end > lineEnd || ruleStart <= headEnd) continue;
				// A syntactically matched marker consumes its span even when its
				// attribute grammar subsequently rejects it, just as matchAll did.
				consumed = end;
				let runStart = headEnd;
				while (runStart < runEnd && (text[runStart] === " " || text[runStart] === "\t")) runStart += 1;
				let attributes: Record<string, string> = {};
				if (runStart < runEnd) {
					if (match[1] === "END") continue;
					const run = Str.slice(runStart, runEnd)(text);
					const parsed = parseAttributeRun(run);
					if (parsed === undefined) continue;
					attributes = parsed;
					match[3] = run;
				}
				match[0] = Str.slice(start, end)(text);
				yield [matcher.style, match, attributes] as const;
			}
		}
	}

	/**
	 * One compiled scanner per recognized comment style, memoized.
	 *
	 * **Details**
	 *
	 * Each candidate pattern is anchored per line and bounds the key with an
	 * explicit character class. {@link markerMatches} recognizes the closing
	 * boundaries in linear time before parsing the attribute run. Prefix and phrase
	 * fragments are regex-escaped; suffixes are compared literally.
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
		const compile = () => this.compileMatchers();
		return #compiledMatchers in this ? this.#compiledMatchers : compile();
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
		const phrase = Str.replace(/ +/g, GAP)(escapeRegex(this.phrase));
		const compiled = A.map(this.styles, (style) => ({
			style,
			// Prefix candidates preserve multiline and absolute-leading-BOM anchors.
			// Closing spans and attribute captures are filled by markerMatches.
			regex: new RegExp(
				`(?:^|(?<=(?<![\\s\\S])\\uFEFF))${escapeRegex(style.prefix)}${GAP}---${GAP}(BEGIN|END)${GAP}${KEY_CAPTURE}${GAP}${phrase}(?=[ \\t])`,
				"gm",
			),
		}));
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
				: A.join(A.map(R.toEntries(attributes), ([name, value]) => ` ${name}="${value}"`), "");
		return `${id.commentStyle.prefix} --- ${kind} ${id.key} ${this.phrase}${run} ---${tail}`;
	}
}

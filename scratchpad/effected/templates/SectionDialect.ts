import { Equal, Result, Schema } from "effect";
import { CommentStyle } from "./CommentStyle.ts";
import { ATTRIBUTE_NAME_PATTERN, isValidAttributeValue, parseAttributeRun } from "./internal/attributes.ts";
import type { Section, SectionId } from "./Section.ts";

/**
 * The line ending a document uses.
 *
 * @public
 */
export type Eol = "\n" | "\r\n";

/**
 * Raised when a section cannot be turned into marker-delimited text.
 *
 * @remarks
 * Both reasons describe a document this package would be unable to read back
 * correctly, so rendering refuses rather than writing something it cannot
 * re-parse.
 *
 * @public
 */
export class SectionRenderError extends Schema.TaggedError<SectionRenderError>()("SectionRenderError", {
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
	 */
	reason: Schema.Literals(["markerInContent", "unknownCommentStyle", "duplicateDeclaration", "invalidAttribute"]),
	/** The key of the section that could not be rendered. */
	key: Schema.String,
	/** The offending attribute's name, when the refusal names one. */
	attribute: Schema.optionalKey(Schema.String),
}) {
	override get message(): string {
		switch (this.reason) {
			case "markerInContent":
				return `Section "${this.key}" has content containing a managed-section marker`;
			case "unknownCommentStyle":
				return `Section "${this.key}" uses a comment style this dialect does not recognize`;
			case "invalidAttribute":
				return this.attribute === undefined
					? `Section "${this.key}" declares an attribute with an invalid name or value`
					: `Section "${this.key}" declares attribute "${this.attribute}" with an invalid name or value`;
			default:
				return `Section "${this.key}" was declared twice in one call`;
		}
	}
}

/** The key grammar, mirrored from `SectionKey` for the scanner's capture group. */
const KEY_CAPTURE = "([A-Za-z0-9][A-Za-z0-9._-]*)";

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Inter-token whitespace is tolerated on read, normalized on write. */
const GAP = "[ \\t]+";

/**
 * Compiled matchers are cached per dialect instance. A `WeakMap` rather than
 * a field keeps `SectionDialect` a pure schema class.
 */
const matcherCache = new WeakMap<
	SectionDialect,
	ReadonlyArray<{ readonly style: CommentStyle; readonly regex: RegExp }>
>();

/**
 * The marker vocabulary: what phrase delimits a managed section, and which
 * comment styles a document is scanned for.
 *
 * @remarks
 * `styles` exists because reconciliation must **recognize sections it does
 * not own** — a foreign tool's block in the same file is preserved verbatim
 * and must never be mistaken for prose. That set cannot be derived from the
 * caller's own sections, because a foreign block's style may appear nowhere
 * in them.
 *
 * One phrase per dialect is deliberate: two marker families in one document
 * make parsing ambiguous for no benefit anyone has asked for.
 *
 * @public
 */
export class SectionDialect extends Schema.Class<SectionDialect>("SectionDialect")({
	/**
	 * The phrase between the key and the closing rule.
	 *
	 * @remarks
	 * Letters, digits, spaces and underscores only. Dashes are excluded so a
	 * phrase can never contain the `---` rule and make a marker ambiguous
	 * against itself.
	 */
	phrase: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9 _]*$/u)),
	/** Which comment styles the document scanner recognizes. At least one. */
	styles: Schema.Array(CommentStyle).check(Schema.isMinLength(1)),
}) {
	/**
	 * The zero-configuration dialect: the phrase `MANAGED SECTION` and every
	 * preset comment style.
	 */
	static readonly default: SectionDialect = SectionDialect.make({
		phrase: "MANAGED SECTION",
		styles: CommentStyle.presets,
	});

	/** True when a section written in this style can be scanned back. */
	recognizes(style: CommentStyle): boolean {
		return this.styles.some((candidate) => Equal.equals(candidate, style));
	}

	/** The opening marker line for an identity, without a line break. */
	beginMarker(id: SectionId): string {
		return this.marker("BEGIN", id);
	}

	/** The closing marker line for an identity, without a line break. */
	endMarker(id: SectionId): string {
		return this.marker("END", id);
	}

	/**
	 * A section as marker-delimited text, or a typed refusal.
	 *
	 * @remarks
	 * Fails rather than producing a document it could not read back: see
	 * {@link SectionRenderError}. Content is emitted with `eol` throughout,
	 * so a section rendered into a CRLF document stays CRLF.
	 */
	render(section: Section, eol: Eol = "\n"): Result.Result<string, SectionRenderError> {
		if (!this.recognizes(section.commentStyle)) {
			return Result.fail(SectionRenderError.make({ reason: "unknownCommentStyle", key: section.key }));
		}
		for (const [name, value] of Object.entries(section.attributes)) {
			// Attribute names and values are runtime data, so a violation is a
			// typed failure here rather than a defect at construction. Either kind
			// of violation would emit a marker the scanner reads differently — or
			// not at all — so both are refused before anything is written.
			if (!ATTRIBUTE_NAME_PATTERN.test(name) || !isValidAttributeValue(value)) {
				return Result.fail(SectionRenderError.make({ reason: "invalidAttribute", key: section.key, attribute: name }));
			}
		}
		if (this.containsMarker(section.content)) {
			return Result.fail(SectionRenderError.make({ reason: "markerInContent", key: section.key }));
		}
		const body = eol === "\n" ? section.content : section.content.replace(/\n/g, eol);
		const begin = this.marker("BEGIN", section.id, section.attributes);
		return Result.succeed(`${begin}${eol}${body}${eol}${this.endMarker(section.id)}`);
	}

	/**
	 * True when `text` contains a line this dialect would read as a marker.
	 *
	 * @internal
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
	 * @remarks
	 * Each pattern is anchored per line, bounds the key with an explicit
	 * character class, and carries no nested quantifier, so scanning is linear
	 * in document length. Every caller-supplied fragment — prefix, suffix,
	 * phrase — is regex-escaped before interpolation.
	 *
	 * @internal
	 */
	matchers(): ReadonlyArray<{ readonly style: CommentStyle; readonly regex: RegExp }> {
		const cached = matcherCache.get(this);
		if (cached !== undefined) {
			return cached;
		}
		// A phrase's internal spaces read as "some whitespace" so a hand-edited
		// file with a double space still matches.
		const phrase = escapeRegex(this.phrase).replace(/ +/g, GAP);
		const compiled = this.styles.map((style) => {
			const tail = style.suffix === undefined ? "" : `${GAP}${escapeRegex(style.suffix)}`;
			return {
				style,
				// Three subtleties, the first two load-bearing for CRLF documents.
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
					`^${escapeRegex(style.prefix)}${GAP}---${GAP}(BEGIN|END)${GAP}${KEY_CAPTURE}${GAP}${phrase}(?:${GAP}([^ \\t\\r\\n][^\\r\\n]*?))?${GAP}---${tail}[ \\t]*(?=\r?$)`,
					"gm",
				),
			};
		});
		matcherCache.set(this, compiled);
		return compiled;
	}

	private marker(kind: "BEGIN" | "END", id: SectionId, attributes?: Readonly<Record<string, string>>): string {
		const tail = id.commentStyle.suffix === undefined ? "" : ` ${id.commentStyle.suffix}`;
		// Emission order is the record's insertion order — the caller's declared
		// order — while equality over attributes is order-insensitive, so a
		// hand-reordered marker with equal pairs compares Unchanged and an actual
		// rewrite renders in declared order.
		const run =
			attributes === undefined
				? ""
				: Object.entries(attributes)
						.map(([name, value]) => ` ${name}="${value}"`)
						.join("");
		return `${id.commentStyle.prefix} --- ${kind} ${id.key} ${this.phrase}${run} ---${tail}`;
	}
}

/**
 * The marker dialect for managed sections: how BEGIN/END markers are
 * rendered and scanned, line endings, and the render error.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ManagedSectionId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CommentStyle } from "./CommentStyle.ts";
import { isValidAttributeName, isValidAttributeValue, parseAttributeRun } from "./internal/attributes.ts";
import { SectionKey } from "./Section.ts";
import type { Section, SectionId } from "./Section.ts";

const $I = $ManagedSectionId.create("SectionDialect");

/**
 * The line ending a document uses.
 *
 * **Example** (Accepted line endings)
 *
 * ```ts
 * import { Eol } from "@beep/managed-section/SectionDialect";
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
export const Eol = LiteralKit(["\n", "\r\n"]).pipe(
  $I.annoteSchema("Eol", { description: "The LF or CRLF line ending used by a document." })
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
 * import { SectionRenderError } from "@beep/managed-section/SectionDialect";
 *
 * const error = SectionRenderError.make({ reason: "duplicateDeclaration", key: "tool" });
 * console.log(error.message) // Section "tool" was declared twice in one call
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SectionRenderError extends S.TaggedError<SectionRenderError, { readonly brand: unique symbol }>(
  $I`SectionRenderError`
)(
  "SectionRenderError",
  {
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
    reason: S.Literals([
      "markerInContent",
      "unknownCommentStyle",
      "duplicateDeclaration",
      "invalidAttribute",
      "trailingCarriageReturn",
    ]).pipe(
      $I.annoteKey("SectionRenderError.reason", {
        description:
          "`markerInContent` — the content carries a line the scanner would read as a marker, which would move the block boundary and let the next sync consume user text. `unknownCommentStyle` — the section's comment style is not in the dialect's set, so the block would be written into a document where the scanner could never find it again, growing a duplicate on every run. `duplicateDeclaration` — the same identity was declared twice in one call, so the caller stated two intentions for one block and any choice between them would be a guess; this is the caller-side twin of the document-side `duplicateSection`. `invalidAttribute` — an attribute's name is outside the `[A-Za-z][A-Za-z0-9_-]*` grammar, or its value contains `\"` or a line break; either would render a marker the scanner could not read back verbatim, and there is no escaping mechanism by design. `trailingCarriageReturn` — LF rendering would absorb the final bare CR into the boundary line ending and lose a byte on the next parse.",
      })
    ),
    /**
     * The key of the section that could not be rendered.
     *
     * @since 0.0.0
     */
    key: S.String.pipe(
      $I.annoteKey("SectionRenderError.key", { description: "The key of the section that could not be rendered." })
    ),
    /**
     * The offending attribute's name, when the refusal names one.
     *
     * @since 0.0.0
     */
    attribute: S.optionalKey(S.String).pipe(
      $I.annoteKey("SectionRenderError.attribute", {
        description: "The offending attribute's name, when the refusal names one.",
      })
    ),
  },
  $I.annoteError<SectionRenderError>("SectionRenderError", {
    description: "Raised when a section cannot be turned into marker-delimited text.",
  })
) {
  /**
   * Explains why rendering refused the named section.
   *
   * **Example** (Name the invalid attribute)
   *
   * ```ts
   * import { SectionRenderError } from "@beep/managed-section/SectionDialect";
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
      Match.when(
        "unknownCommentStyle",
        () => `Section "${this.key}" uses a comment style this dialect does not recognize`
      ),
      Match.when("invalidAttribute", () =>
        this.attribute === undefined
          ? `Section "${this.key}" declares an attribute with an invalid name or value`
          : `Section "${this.key}" declares attribute "${this.attribute}" with an invalid name or value`
      ),
      Match.when(
        "trailingCarriageReturn",
        () => `Section "${this.key}" ends in a bare carriage return that LF rendering cannot preserve`
      ),
      Match.when("duplicateDeclaration", () => `Section "${this.key}" was declared twice in one call`),
      Match.exhaustive
    );
  }
}

/** The key grammar, mirrored from `SectionKey` for the scanner's capture group. */
const KEY_CAPTURE = "([A-Za-z0-9][A-Za-z0-9._-]*)";

const escapeRegex = (value: string): string => Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")(value);

/** Inter-token whitespace is tolerated on read, normalized on write. */
const GAP = "[ \\t]+";

/** The first offset of a trailing horizontal separator run. */
const markerGapStart: {
  (text: string, end: number): number;
  (end: number): (text: string) => number;
} = dual(2, (text: string, end: number): number => {
  let index = end;
  while (index > 0 && (text[index - 1] === " " || text[index - 1] === "\t")) index -= 1;
  return index;
});

/** The first offset after a leading horizontal separator run, bounded by `limit`. */
const markerGapEnd = (text: string, start: number, limit: number): number => {
  let index = start;
  while (index < limit && (text[index] === " " || text[index] === "\t")) index += 1;
  return index;
};

/** A literal suffix's preceding gap start, or `undefined` when the suffix is absent or unseparated. */
const literalSuffixGap = (text: string, boundary: number, end: number, suffix: string, suffixEnd: number) => {
  const suffixStart = end - suffixEnd;
  const suffixStop = end + suffix.length - suffixEnd;
  if (suffixStart < 0 || suffixStop > boundary || Str.slice(suffixStart, suffixStop)(text) !== suffix) {
    return undefined;
  }
  const gapStart = markerGapStart(text, suffixStart);
  return gapStart === suffixStart ? undefined : gapStart;
};

/** Where the closing rule must end once a style's suffix is accounted for. */
const suffixGap = (text: string, boundary: number, suffix: string): number | undefined => {
  const end = markerGapStart(text, boundary);
  const suffixEnd = markerGapStart(suffix, suffix.length);
  if (suffixEnd !== 0) {
    return literalSuffixGap(text, boundary, end, suffix, suffixEnd);
  }
  // A whitespace-only suffix still requires a separate preceding gap.
  return Str.includes(suffix)(Str.slice(end + 1, boundary)(text)) ? end : undefined;
};

/** The `---` rule ending at `end` and the start of its preceding gap. */
const ruleSpan = (text: string, end: number): readonly [number, number] | undefined => {
  if (end < 3 || Str.slice(end - 3, end)(text) !== "---") return undefined;
  const ruleStart = end - 3;
  const runEnd = markerGapStart(text, ruleStart);
  return runEnd === ruleStart ? undefined : [ruleStart, runEnd];
};

/** Recognize a closing rule at one multiline boundary without parsing attributes. */
const closingRule: {
  (text: string, boundary: number, style: CommentStyle): readonly [number, number] | undefined;
  (boundary: number, style: CommentStyle): (text: string) => readonly [number, number] | undefined;
} = dual(3, (text: string, boundary: number, style: CommentStyle): readonly [number, number] | undefined => {
  const end = style.suffix === undefined ? markerGapStart(text, boundary) : suffixGap(text, boundary, style.suffix);
  return end === undefined ? undefined : ruleSpan(text, end);
});

/** Every multiline boundary offset (including the end), and the subset that are CR or LF. */
const lineEndings = (text: string): readonly [Array<number>, Array<number>] => {
  const endings: Array<number> = [];
  const breaks: Array<number> = [];
  for (const match of Str.matchAll(/[\r\n\u2028\u2029]|$/g)(text)) {
    const offset = O.getOrThrow(O.fromUndefinedOr(match.index));
    endings.push(offset);
    if (text[offset] === "\r" || text[offset] === "\n") breaks.push(offset);
  }
  return [endings, breaks];
};

/** Each boundary that closes a marker in `style`, as `[end, ruleStart, runEnd]`, in offset order. */
const closingBoundaries = (
  text: string,
  endings: ReadonlyArray<number>,
  style: CommentStyle
): Array<readonly [number, number, number]> => {
  const boundaries: Array<readonly [number, number, number]> = [];
  for (const end of endings) {
    const boundary = closingRule(text, end, style);
    if (boundary !== undefined) boundaries.push([end, boundary[0], boundary[1]]);
  }
  return boundaries;
};

/** The parsed attributes of a marker head, `{}` for none, `undefined` when the run refuses the marker. */
const markerAttributes = (
  text: string,
  match: RegExpMatchArray,
  headEnd: number,
  runEnd: number
): Record<string, string> | undefined => {
  const runStart = markerGapEnd(text, headEnd, runEnd);
  if (runStart >= runEnd) return {};
  if (match[1] === "END") return undefined;
  const run = Str.slice(runStart, runEnd)(text);
  const parsed = parseAttributeRun(run);
  if (O.isNone(parsed)) return undefined;
  match[3] = run;
  return parsed.value;
};

/**
 * A forward cursor over one style's closing boundaries and the CR/LF breaks,
 * associating each candidate head with the first closing boundary on its line.
 */
class BoundaryCursor {
  #boundary = 0;
  #break = 0;
  #consumed = 0;
  readonly #text: string;
  readonly #breaks: ReadonlyArray<number>;
  readonly #boundaries: ReadonlyArray<readonly [number, number, number]>;

  constructor(
    text: string,
    breaks: ReadonlyArray<number>,
    boundaries: ReadonlyArray<readonly [number, number, number]>
  ) {
    this.#text = text;
    this.#breaks = breaks;
    this.#boundaries = boundaries;
  }

  /** The `[end, runEnd]` closing a head, `"skip"` for a non-marker head, `"exhausted"` when none can close. */
  locate(start: number, headEnd: number): readonly [number, number] | "skip" | "exhausted" {
    if (start < this.#consumed) return "skip";
    this.advance(headEnd);
    if (this.#boundary === this.#boundaries.length) return "exhausted";
    const [end, ruleStart, runEnd] = A.getUnsafe(this.#boundaries, this.#boundary);
    const lineEnd = this.#break < this.#breaks.length ? A.getUnsafe(this.#breaks, this.#break) : this.#text.length;
    if (end > lineEnd || ruleStart <= headEnd) return "skip";
    // A syntactically matched marker consumes its span even when its
    // attribute grammar subsequently rejects it, just as matchAll did.
    this.#consumed = end;
    return [end, runEnd];
  }

  private advance(headEnd: number): void {
    while (this.#break < this.#breaks.length && A.getUnsafe(this.#breaks, this.#break) < headEnd) this.#break += 1;
    while (this.#boundary < this.#boundaries.length && A.getUnsafe(this.#boundaries, this.#boundary)[1] <= headEnd)
      this.#boundary += 1;
  }
}

/** Recognized markers of one style, in offset order. */
function* styleMatches(
  text: string,
  matcher: { readonly style: CommentStyle; readonly regex: RegExp },
  breaks: ReadonlyArray<number>,
  endings: ReadonlyArray<number>
): Generator<readonly [CommentStyle, RegExpMatchArray, Record<string, string>]> {
  const cursor = new BoundaryCursor(text, breaks, closingBoundaries(text, endings, matcher.style));
  for (const match of Str.matchAll(matcher.regex)(text)) {
    const start = O.getOrThrow(O.fromUndefinedOr(match.index));
    const headEnd = start + match[0].length;
    const span = cursor.locate(start, headEnd);
    if (span === "exhausted") break;
    if (span === "skip") continue;
    const attributes = markerAttributes(text, match, headEnd, span[1]);
    if (attributes === undefined) continue;
    match[0] = Str.slice(start, span[0])(text);
    yield [matcher.style, match, attributes] as const;
  }
}

/** The first attribute name a marker could not carry verbatim, if any. */
const invalidAttribute = (attributes: Readonly<Record<string, string>>): O.Option<string> =>
  O.map(
    A.findFirst(
      R.toEntries(attributes),
      ([name, value]) => !isValidAttributeName(name) || !isValidAttributeValue(value)
    ),
    ([name]) => name
  );

/**
 * The text of one literal marker, between the comment prefix and suffix.
 *
 * **Details**
 *
 * Single-line, free of control characters, with no leading or trailing
 * whitespace (both would be lost on a read), and never starting with the
 * `---` rule, so a literal marker can never be read as a ruled one.
 *
 * @since 0.0.0
 */
const MarkerText = S.String.check(
  S.isPattern(
    /^[^\s\u0000-\u001f\u007f-\u009f](?:[^\u0000-\u001f\u007f-\u009f\u2028\u2029]*[^\s\u0000-\u001f\u007f-\u009f])?$/u,
    $I.annote("MarkerTextCheck", {
      description: "A literal marker text is one trimmed line without control characters.",
      message: "Expected a trimmed single-line marker text without control characters.",
    })
  ),
  S.makeFilter(
    (text: string) => !Str.startsWith("---")(text),
    $I.annote("MarkerTextRuleCheck", {
      description: "A literal marker text does not start with the `---` rule of the ruled form.",
      message: "Expected a marker text that does not start with '---'.",
    })
  )
).pipe($I.annoteSchema("MarkerText", { description: "The text of one literal marker inside its comment." }));

/** The scanner reads a run of spaces as one gap, so texts compare by that form. */
const canonicalText = (text: string): string => Str.replace(/ +/g, " ")(text);

/**
 * A fixed BEGIN/END marker spelling for one section key.
 *
 * **Details**
 *
 * Some documents carry markers written before this package existed, such as
 * `<!-- BEGIN GENERATED: INSTRUMENTATION CATALOG -->`. Listing them on a
 * dialect lets those sections be read and rewritten byte for byte without a
 * one-time marker migration. `begin` and `end` are the text between the
 * comment prefix and suffix, compared with the same whitespace tolerance as
 * the ruled form. A literal marker carries no attributes.
 *
 * **Example** (Spell a legacy section's markers)
 *
 * ```ts
 * import { SectionMarkers } from "@beep/managed-section/SectionDialect";
 *
 * const markers = SectionMarkers.make({
 *   key: "status",
 *   begin: "BEGIN GENERATED: STATUS",
 *   end: "END GENERATED: STATUS",
 * });
 * console.log(markers.begin) // BEGIN GENERATED: STATUS
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SectionMarkers extends S.Opaque<SectionMarkers, { readonly brand: unique symbol }>()(
  S.Struct({
    key: SectionKey.pipe($I.annoteKey("SectionMarkers.key", { description: "The section key these markers spell." })),
    begin: MarkerText.pipe(
      $I.annoteKey("SectionMarkers.begin", { description: "The opening marker text inside its comment." })
    ),
    end: MarkerText.pipe(
      $I.annoteKey("SectionMarkers.end", { description: "The closing marker text inside its comment." })
    ),
  })
    .check(
      S.makeFilter(
        (markers) => canonicalText(markers.begin) !== canonicalText(markers.end),
        $I.annote("SectionMarkers.DistinctEnds", {
          description: "The opening and closing marker texts differ, also once space runs are collapsed.",
          message: "Expected the begin and end marker texts to differ.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("SectionMarkers", {
        description: "A fixed BEGIN/END marker spelling for one section key.",
      })
    )
) {}

/** No two literal spellings share a key, and no marker text is used twice. */
const DistinctSpellings = S.makeFilter(
  (markers: ReadonlyArray<SectionMarkers>) =>
    A.length(A.dedupe(A.map(markers, (entry) => entry.key))) === A.length(markers) &&
    A.length(A.dedupe(A.flatMap(markers, (entry) => [canonicalText(entry.begin), canonicalText(entry.end)]))) ===
      2 * A.length(markers),
  $I.annote("SectionDialect.DistinctSpellings", {
    description:
      "Each key has at most one literal spelling, and every literal marker text is distinct once space runs are collapsed.",
    message: "Expected distinct keys and distinct marker texts across the literal spellings.",
  })
);

/** A literal marker's text, with internal spaces read as "some whitespace". */
const literalPattern = (text: string): string => `(${Str.replace(/ +/g, GAP)(escapeRegex(text))})`;

/**
 * Yields every literal marker in `text`, in the same capture shape the ruled
 * scanner produces: `[1]` is BEGIN or END and `[2]` the section key.
 */
function* literalMatches(
  text: string,
  matcher: { readonly style: CommentStyle; readonly regex: RegExp },
  markers: ReadonlyArray<SectionMarkers>
): Generator<readonly [CommentStyle, RegExpMatchArray, Record<string, string>]> {
  for (const match of Str.matchAll(matcher.regex)(text)) {
    // Groups come in BEGIN/END pairs, one pair per spelling, in declared order.
    // Exactly one alternative matched, so exactly one group is defined.
    const group = O.getOrThrow(A.findFirstIndex(A.drop(match, 1), (capture) => capture !== undefined));
    const spelling = A.getUnsafe(markers, group >> 1);
    match[1] = group % 2 === 0 ? "BEGIN" : "END";
    match[2] = spelling.key;
    yield [matcher.style, match, {}] as const;
  }
}

/** The literal spelling listed for a key, if any. */
const spellingFor: {
  (spellings: ReadonlyArray<SectionMarkers>, key: string): O.Option<SectionMarkers>;
  (key: string): (spellings: ReadonlyArray<SectionMarkers>) => O.Option<SectionMarkers>;
} = dual(
  2,
  (spellings: ReadonlyArray<SectionMarkers>, key: string): O.Option<SectionMarkers> =>
    A.findFirst(spellings, (entry) => entry.key === key)
);

/** One line-anchored scanner per comment style over every literal spelling. */
const compileLiteralMatchers = (
  styles: ReadonlyArray<CommentStyle>,
  markers: ReadonlyArray<SectionMarkers>
): ReadonlyArray<{ readonly style: CommentStyle; readonly regex: RegExp }> => {
  const texts = A.join(
    A.flatMap(markers, (entry) => [literalPattern(entry.begin), literalPattern(entry.end)]),
    "|"
  );
  return A.map(styles, (style) => {
    const suffix = style.suffix === undefined ? "" : `${GAP}${escapeRegex(style.suffix)}`;
    return {
      style,
      // Same line and leading-BOM anchors as the ruled scanner; the trailing
      // line break is a lookahead, never consumed.
      regex: new RegExp(
        `(?:^|(?<=(?<![\\s\\S])\\uFEFF))${escapeRegex(style.prefix)}${GAP}(?:${texts})${suffix}[ \\t]*(?=[\\r\\n\\u2028\\u2029]|(?![\\s\\S]))`,
        "gm"
      ),
    };
  });
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
 * One phrase per dialect is deliberate: two ruled marker families in one
 * document make parsing ambiguous for no benefit anyone has asked for.
 *
 * A document whose markers predate this package is read with a
 * {@link LiteralMarkerDialect}, which adds fixed spellings for individual keys.
 *
 * **Example** (Choose a custom marker phrase)
 *
 * ```ts
 * import { SectionDialect } from "@beep/managed-section/SectionDialect";
 * import { CommentStyle } from "@beep/managed-section/CommentStyle";
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
export class SectionDialect extends S.Class<SectionDialect, { readonly brand: unique symbol }>($I`SectionDialect`)(
  {
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
    phrase: S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9 _]*$/u)).pipe(
      $I.annoteKey("SectionDialect.phrase", { description: "The phrase between the key and the closing rule." })
    ),
    /**
     * Which comment styles the document scanner recognizes. At least one.
     *
     * @since 0.0.0
     */
    styles: S.Array(CommentStyle)
      .check(S.isMinLength(1))
      .pipe(
        $I.annoteKey("SectionDialect.styles", {
          description: "Which comment styles the document scanner recognizes. At least one.",
        })
      ),
  },
  $I.annote("SectionDialect", {
    description:
      "The marker vocabulary: what phrase delimits a managed section, and which comment styles a document is scanned for.",
  })
) {
  // Runtime-only state belongs to its dialect; private fields never enter the wire form.
  /**
   * Keeps the compiled scanners on this dialect instance, outside its wire form.
   *
   * **Example** (Observe the instance scanner cache)
   *
   * ```ts
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
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
    // Attribute names and values are runtime data, so a violation is a
    // typed failure here rather than a defect at construction. Either kind
    // of violation would emit a marker the scanner reads differently — or
    // not at all — so both are refused before anything is written.
    const invalid = invalidAttribute(section.attributes);
    if (O.isSome(invalid)) {
      return Result.fail(
        SectionRenderError.make({ reason: "invalidAttribute", key: section.key, attribute: invalid.value })
      );
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
    // A closing rule before a Unicode boundary can truncate a quoted value.
    // Validate the emitted marker with the same scanner that reads it back.
    const recognized = this.readsBack(begin, section);
    if (!recognized) {
      return Result.fail(SectionRenderError.make({ reason: "invalidAttribute", key: section.key }));
    }
    return Result.succeed(`${begin}${eol}${body}${eol}${this.endMarker(section.id)}`);
  }

  /**
   * True when `text` contains a line this dialect would read as a marker.
   *
   * **Example** (Detect markers inside proposed content)
   *
   * ```ts
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
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
    const [endings, breaks] = lineEndings(text);
    for (const matcher of this.matchers()) {
      for (const hit of styleMatches(text, matcher, breaks, endings)) {
        // A key with a literal spelling has no ruled one.
        if (O.isNone(spellingFor(this.spellings(), A.getUnsafe(hit[1], 2)))) yield hit;
      }
    }
    for (const matcher of this.literalMatchers()) yield* literalMatches(text, matcher, this.spellings());
  }

  /**
   * The fixed marker spellings this dialect renders and scans, by key.
   *
   * **Details**
   *
   * Empty for a ruled dialect; a {@link LiteralMarkerDialect} returns its
   * `markers`. A key with a literal spelling has no ruled one.
   *
   * **Example** (Inspect the literal spellings)
   *
   * ```ts
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   *
   * console.log(SectionDialect.default.spellings().length) // 0
   * ```
   *
   * @internal
   * @category getters
   * @since 0.0.0
   */
  spellings(): ReadonlyArray<SectionMarkers> {
    return [];
  }

  /**
   * The compiled literal-marker scanners, one per recognized comment style.
   *
   * **Details**
   *
   * Empty for a ruled dialect. A literal marker starts its line (after an
   * optional leading BOM), and only horizontal whitespace may follow it
   * before the line ending.
   *
   * **Example** (A ruled dialect has no literal scanners)
   *
   * ```ts
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   *
   * console.log(SectionDialect.default.literalMatchers().length) // 0
   * ```
   *
   * @internal
   * @category getters
   * @since 0.0.0
   */
  literalMatchers(): ReadonlyArray<{ readonly style: CommentStyle; readonly regex: RegExp }> {
    return [];
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
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
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
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
        "gm"
      ),
    }));
    return compiled;
  }

  /**
   * True when the scanner reads an emitted BEGIN marker back as exactly this section's head.
   *
   * **Details**
   *
   * A closing rule before a Unicode boundary can truncate a quoted value, so
   * the emitted marker is validated with the same scanner that reads it back.
   *
   * **Example** (Round-trip a rendered opening marker)
   *
   * ```ts
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import * as Result from "effect/Result";
   *
   * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
   * console.log(Result.isSuccess(SectionDialect.default.render(id.section("echo")))) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */

  private readsBack(begin: string, section: Section): boolean {
    return A.some(
      A.fromIterable(this.markerMatches(begin)),
      ([style, match, attributes]) =>
        match.index === 0 &&
        match[0] === begin &&
        match[1] === "BEGIN" &&
        match[2] === section.key &&
        Equal.equals(style, section.commentStyle) &&
        Equal.equals(attributes, section.attributes)
    );
  }

  /**
   * Formats a marker with the identity's comment delimiters and optional BEGIN attributes.
   *
   * **Example** (Include attributes in the opening marker)
   *
   * ```ts
   * import { SectionDialect } from "@beep/managed-section/SectionDialect";
   * import { SectionId } from "@beep/managed-section/Section";
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
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
    const literal = spellingFor(this.spellings(), id.key);
    if (O.isSome(literal)) {
      // A literal marker has no attribute slot; `render` refuses attributes
      // on it through the read-back check.
      return id.commentStyle.comment(kind === "BEGIN" ? literal.value.begin : literal.value.end);
    }
    // Emission order is the record's insertion order — the caller's declared
    // order — while equality over attributes is order-insensitive, so a
    // hand-reordered marker with equal pairs compares Unchanged and an actual
    // rewrite renders in declared order.
    const run =
      attributes === undefined
        ? ""
        : A.join(
            A.map(R.toEntries(attributes), ([name, value]) => ` ${name}="${value}"`),
            ""
          );
    return id.commentStyle.comment(`--- ${kind} ${id.key} ${this.phrase}${run} ---`);
  }
}

/**
 * A dialect that adds fixed marker spellings for individual keys.
 *
 * **Details**
 *
 * Every key listed in `markers` is rendered and scanned with its literal
 * {@link SectionMarkers} instead of the ruled
 * `--- BEGIN <key> <phrase> ---` form; every other key keeps the ruled form.
 * A listed key has exactly one spelling, so a ruled marker naming it is
 * ordinary text to this dialect. Everything else, the scanner's refusals,
 * line-ending handling and read-back check included, is the base dialect's.
 * `markers` is non-empty, holds one spelling per key and never reuses a
 * marker text.
 *
 * **Example** (Read and rewrite a legacy generated section)
 *
 * ```ts
 * import { CommentStyle } from "@beep/managed-section/CommentStyle";
 * import { SectionId } from "@beep/managed-section/Section";
 * import { LiteralMarkerDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
 * import { SectionDocument } from "@beep/managed-section/SectionDocument";
 * import * as Result from "effect/Result";
 *
 * const dialect = LiteralMarkerDialect.make({
 *   phrase: "MANAGED SECTION",
 *   styles: [CommentStyle.html],
 *   markers: [SectionMarkers.make({ key: "status", begin: "BEGIN STATUS", end: "END STATUS" })],
 * });
 * const id = SectionId.make({ key: "status", commentStyle: CommentStyle.html });
 * const parsed = SectionDocument.parseResult("<!-- BEGIN STATUS -->\nold\n<!-- END STATUS -->\n", dialect);
 * const next = Result.flatMap(parsed, (document) => document.reconcile([id.section("new")]));
 * console.log(Result.isSuccess(next) && next.success.text) // <!-- BEGIN STATUS -->\nnew\n<!-- END STATUS -->\n
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LiteralMarkerDialect extends SectionDialect.extend<LiteralMarkerDialect>($I`LiteralMarkerDialect`)(
  {
    /**
     * The fixed spellings, one per key. Non-empty.
     *
     * @since 0.0.0
     */
    markers: S.NonEmptyArray(SectionMarkers)
      .check(DistinctSpellings)
      .pipe(
        $I.annoteKey("LiteralMarkerDialect.markers", {
          description: "The fixed BEGIN/END spellings, one per key, rendered and scanned instead of the ruled form.",
        })
      ),
  },
  $I.annote("LiteralMarkerDialect", {
    description: "A dialect that adds fixed marker spellings for individual keys.",
  })
) {
  /**
   * Keeps the compiled literal-marker scanners on this instance, outside its wire form.
   *
   * **Example** (Observe the literal scanner cache)
   *
   * ```ts
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import { LiteralMarkerDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
   *
   * const dialect = LiteralMarkerDialect.make({
   *   phrase: "MANAGED SECTION",
   *   styles: [CommentStyle.html],
   *   markers: [SectionMarkers.make({ key: "status", begin: "BEGIN STATUS", end: "END STATUS" })],
   * });
   * console.log(dialect.literalMatchers() === dialect.literalMatchers()) // true
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  readonly #compiledLiteralMatchers = compileLiteralMatchers(this.styles, this.markers);

  /**
   * The listed spellings.
   *
   * **Example** (Read the spellings back)
   *
   * ```ts
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import { LiteralMarkerDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
   *
   * const dialect = LiteralMarkerDialect.make({
   *   phrase: "MANAGED SECTION",
   *   styles: [CommentStyle.html],
   *   markers: [SectionMarkers.make({ key: "status", begin: "BEGIN STATUS", end: "END STATUS" })],
   * });
   * console.log(dialect.spellings()[0]?.key) // status
   * ```
   *
   * @internal
   * @category getters
   * @since 0.0.0
   */
  override spellings(): ReadonlyArray<SectionMarkers> {
    return this.markers;
  }

  /**
   * One compiled literal-marker scanner per recognized comment style, memoized.
   *
   * **Example** (Count the literal scanners)
   *
   * ```ts
   * import { CommentStyle } from "@beep/managed-section/CommentStyle";
   * import { LiteralMarkerDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
   *
   * const dialect = LiteralMarkerDialect.make({
   *   phrase: "MANAGED SECTION",
   *   styles: [CommentStyle.html, CommentStyle.hash],
   *   markers: [SectionMarkers.make({ key: "status", begin: "BEGIN STATUS", end: "END STATUS" })],
   * });
   * console.log(dialect.literalMatchers().length) // 2
   * ```
   *
   * @internal
   * @category getters
   * @since 0.0.0
   */
  override literalMatchers(): ReadonlyArray<{ readonly style: CommentStyle; readonly regex: RegExp }> {
    const compile = () => compileLiteralMatchers(this.styles, this.markers);
    return #compiledLiteralMatchers in this ? this.#compiledLiteralMatchers : compile();
  }
}

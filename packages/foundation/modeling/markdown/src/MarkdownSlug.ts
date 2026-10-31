/**
 * Heading anchor slugs in the GitHub convention as `markdown-toc` 0.1.0
 * spells it: the rule behind the `[text](#slug)` links a table of contents
 * carries, plus the title text and the percent-escaped anchor that go with
 * it.
 *
 * **Details**
 *
 * The rule is reproduced step for step from `markdown-toc`'s `slugify` so a
 * TOC rendered here is byte-identical to one it rendered (the docgen
 * oracle): a leading `[text](` link stands in for the whole heading, the
 * text is lower-cased, spaces become `-` and tabs `--`, HTML tags and a
 * fixed set of ASCII and CJK punctuation are deleted, Latin-1 and Latin
 * Extended-A letters fold to ASCII, and a duplicate heading gets a `-N`
 * ordinal from its second occurrence on (`N` starting at 1). Underscores
 * survive, which GitHub's own slugger shares; GitHub keeps more punctuation
 * (`$`, `&`, `+`, `.`) that this rule deletes, so a slug here is not always
 * the one GitHub renders for the same heading.
 *
 * **Gotchas**
 *
 * The deletion step is a fixed character list, not a Unicode category, so
 * punctuation outside the list (`§`, `¿`, `€`) survives into the slug. The
 * `markdown-toc` rule also strips ANSI colour sequences, which no Markdown
 * heading carries; that step is not reproduced.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $MarkdownId.create("MarkdownSlug");

/**
 * A heading anchor slug: the fragment identifier (without `#`) a heading's
 * TOC link points at. Never contains an ASCII space or tab.
 *
 * **Example** (Validate a slug)
 *
 * ```ts
 * import { HeadingSlug } from "@beep/markdown/MarkdownSlug";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(HeadingSlug)("exports-grouped-by-category")) // true
 * console.log(S.is(HeadingSlug)("has space")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const HeadingSlug = S.String.pipe(
  S.check(S.isPattern(/^[^ \t\r\n]*$/, { message: "a heading slug carries no ASCII space, tab or line break" })),
  $I.annoteSchema("HeadingSlug", {
    description:
      "A heading anchor slug: the fragment identifier a TOC link points at, free of ASCII spaces, tabs and line breaks.",
  })
);

/**
 * The slug string type.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type HeadingSlug = typeof HeadingSlug.Type;

// A heading that opens with a markdown link: its text stands in for the whole heading.
const LEADING_LINK = /^\[([^\]]+)\]\(/;
const HTML_TAG = /<\/?[^>]+>/g;
const SPACE_RUN = /[ \t]+/g;
// A multi-line setext heading's soft line breaks: read as one space each, as CommonMark renders them.
const LINE_BREAK = /\r\n?|\n/g;
const unwrapLines = Str.replace(LINE_BREAK, " ");
// `markdown-toc`'s two deletion lists, verbatim (the ASCII list names `=` twice; the CJK list carries an ASCII space).
const ASCII_PUNCTUATION = /[|$&`~=\\/@+*!?({[\]})<>=.,;:'"^]/g;
const CJK_PUNCTUATION = /[。？！，、；：“”【】（）〔〕［］﹃﹄“ ”‘’﹁﹂—…－～《》〈〉「」]/g;
// The fold runs over Latin-1 Supplement letters and Latin Extended-A only (U+00C0..U+017E), as `diacritics-map` is applied.
const FOLDED_RANGE_START = 0xc0;
const FOLDED_RANGE_END = 0x17e;
const COMBINING_MARKS = /[̀-ͯ]/g;
// The letters in that range whose `diacritics-map` entry is not their NFD base letter. The fold
// runs after lower-casing, so only the lower-case rows of the map are reachable.
const FOLD_EXCEPTIONS = HashMap.fromIterable<string, string>([
  ["ß", "ss"],
  ["æ", "ae"],
  ["ð", "d"],
  ["ø", "o"],
  ["þ", "th"],
  ["đ", "d"],
  ["ħ", "h"],
  ["ı", "i"],
  ["ĳ", "ij"],
  ["ĸ", "q"],
  ["ŀ", "l"],
  ["ł", "l"],
  ["ŉ", "n"],
  ["ŋ", "n"],
  ["œ", "oe"],
  ["ŧ", "t"],
]);

const isFoldedLetter = (character: string): boolean =>
  O.exists(Str.codePointAt(0)(character), (code) => code >= FOLDED_RANGE_START && code <= FOLDED_RANGE_END);

const foldLetter = (character: string): string =>
  isFoldedLetter(character)
    ? O.getOrElse(HashMap.get(FOLD_EXCEPTIONS, character), () =>
        Str.replace(COMBINING_MARKS, "")(Str.normalize("NFD")(character))
      )
    : character;

const foldDiacritics = (text: string): string => A.join(A.map(A.fromIterable(text), foldLetter), "");

/**
 * The anchor-slug rule and its companions: {@link MarkdownSlug.slugify} for
 * the fragment, {@link MarkdownSlug.titleize} for the link text and
 * {@link MarkdownSlug.anchor} for the percent-escaped `#href`.
 *
 * **Example** (Slug, title and anchor of one heading)
 *
 * ```ts
 * import { MarkdownSlug } from "@beep/markdown/MarkdownSlug";
 *
 * console.log(MarkdownSlug.slugify("Exports Grouped by Category")) // exports-grouped-by-category
 * console.log(MarkdownSlug.slugify("Signature", 2)) // signature-2
 * console.log(MarkdownSlug.titleize("Use  <b>Effect.gen</b>")) // Use Effect.gen
 * console.log(MarkdownSlug.anchor(MarkdownSlug.slugify("Über uns"))) // #uber-uns
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export abstract class MarkdownSlug {
  /**
   * The text a heading contributes to its slug and title: when the heading
   * opens with a markdown link, `[text](`, that link's text; otherwise the
   * heading as given.
   *
   * **Example** (A linked heading)
   *
   * ```ts
   * import { MarkdownSlug } from "@beep/markdown/MarkdownSlug";
   *
   * console.log(MarkdownSlug.linkText("[Guide](./guide.md) and more")) // Guide
   * console.log(MarkdownSlug.linkText("Plain heading")) // Plain heading
   * ```
   *
   * @param text - A heading's content as written.
   * @returns The leading link's text, or `text` unchanged.
   * @category utilities
   * @since 0.0.0
   */
  static readonly linkText = (text: string): string => LEADING_LINK.exec(text)?.[1] ?? text;

  /**
   * The anchor slug of a heading text, with the duplicate ordinal
   * `occurrence` appended as `-N` when it is positive.
   *
   * **Details**
   *
   * Steps, in `markdown-toc` order: each line break of a multi-line setext
   * heading becomes one space (the kit's one departure from `markdown-toc`,
   * which kept the raw newline in the anchor); {@link MarkdownSlug.linkText}; lower-case;
   * each space becomes `-` and each tab `--`; HTML tags are deleted; the
   * ASCII list (pipe, dollar, ampersand, backtick, tilde, equals, backslash,
   * slash, at, plus, asterisk, exclamation and question marks, braces,
   * brackets, parentheses, angle brackets, period, comma, semicolon, colon,
   * both quotes and caret) and the CJK punctuation list are deleted; letters
   * U+00C0..U+017E fold to ASCII; then `-N`. A document assigns `occurrence` by counting earlier
   * headings with the same lower-cased text; see `MarkdownToc.entries`.
   *
   * **Example** (Punctuation, case and diacritics)
   *
   * ```ts
   * import { MarkdownSlug } from "@beep/markdown/MarkdownSlug";
   *
   * console.log(MarkdownSlug.slugify("Effect.fn (function)")) // effectfn-function
   * console.log(MarkdownSlug.slugify("Straße über Ærø")) // strasse-uber-aero
   * console.log(MarkdownSlug.slugify("~~deprecated~~ make", 1)) // deprecated-make-1
   * ```
   *
   * @param text - A heading's content as written.
   * @param occurrence - How many earlier headings share the text; `0` for the first.
   * @returns The slug.
   * @category utilities
   * @since 0.0.0
   */
  static readonly slugify = (text: string, occurrence = 0): HeadingSlug => {
    const base = Str.toLowerCase(MarkdownSlug.linkText(unwrapLines(text)));
    const hyphenated = Str.replaceAll("\t", "--")(Str.replaceAll(" ", "-")(base));
    const stripped = Str.replace(
      CJK_PUNCTUATION,
      ""
    )(Str.replace(ASCII_PUNCTUATION, "")(Str.replace(HTML_TAG, "")(hyphenated)));
    const folded = foldDiacritics(stripped);
    return occurrence > 0 ? `${folded}-${occurrence}` : folded;
  };

  /**
   * The link text a TOC entry shows for a heading: the leading link's text
   * if any, with line breaks read as spaces, HTML tags deleted, space and
   * tab runs collapsed to one space, and the ends trimmed.
   *
   * **Example** (Inline HTML and spacing)
   *
   * ```ts
   * import { MarkdownSlug } from "@beep/markdown/MarkdownSlug";
   *
   * console.log(MarkdownSlug.titleize(" Use  <code>pipe</code>\tnow ")) // Use pipe now
   * ```
   *
   * @param text - A heading's content as written.
   * @returns The display text.
   * @category utilities
   * @since 0.0.0
   */
  static readonly titleize = (text: string): string =>
    Str.trim(Str.replace(SPACE_RUN, " ")(Str.replace(HTML_TAG, "")(MarkdownSlug.linkText(unwrapLines(text)))));

  /**
   * The `href` of a slug: `#` followed by the slug percent-escaped as a
   * URL component (unreserved ASCII, `-` and `_` survive; everything else,
   * non-ASCII included, is `%XX`-encoded as UTF-8). A lone surrogate is
   * replaced by U+FFFD before escaping.
   *
   * **Example** (A non-ASCII slug)
   *
   * ```ts
   * import { MarkdownSlug } from "@beep/markdown/MarkdownSlug";
   *
   * console.log(MarkdownSlug.anchor("effectfn-function")) // #effectfn-function
   * console.log(MarkdownSlug.anchor("日本語")) // #%E6%97%A5%E6%9C%AC%E8%AA%9E
   * ```
   *
   * @param slug - A heading slug.
   * @returns The fragment href.
   * @category utilities
   * @since 0.0.0
   */
  static readonly anchor = (slug: HeadingSlug): string => `#${encodeURIComponent(slug.toWellFormed())}`;
}

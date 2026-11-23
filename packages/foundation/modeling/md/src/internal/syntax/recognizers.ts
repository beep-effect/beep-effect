/**
 * Pure recognizers the syntax bridge runs over raw source slices.
 *
 * Every recognizer reads `MarkdownDocument.source`, never decoded text, so a
 * backslash-escaped marker (`\[!NOTE]`, `\$`) is never recognized.
 *
 * @since 0.0.0
 */

import { Point, Position } from "@beep/markdown/MarkdownNode";
import * as A from "@beep/utils/Array";
import { constVoid, dual, pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AdmonitionKind, YouTubeVideoId } from "../../Md.model.ts";

/**
 * The source text a positioned node spans.
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const sourceSlice: {
  (position: Position): (source: string) => string;
  (source: string, position: Position): string;
} = dual(2, (source: string, position: Position): string =>
  Str.slice(position.start.offset, position.end.offset)(source)
);

const pointAt = (position: Position, raw: string, index: number): Point => {
  const before = Str.slice(0, index)(raw);
  const lines = Str.split("\n")(before);
  const lastLine = A.lastNonEmpty(lines);
  return Point.make({
    line: position.start.line + lines.length - 1,
    column: lines.length === 1 ? position.start.column + index : Str.length(lastLine) + 1,
    offset: position.start.offset + index,
  });
};

/**
 * The position of `raw[from, to)` inside a node whose raw slice is `raw`.
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const subPosition: {
  (raw: string, from: number, to: number): (position: Position) => Position;
  (position: Position, raw: string, from: number, to: number): Position;
} = dual(
  4,
  (position: Position, raw: string, from: number, to: number): Position =>
    Position.make({ start: pointAt(position, raw, from), end: pointAt(position, raw, to) })
);

/**
 * One piece of a text run after inline-math recognition.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class MathSegment extends S.Opaque<MathSegment, { readonly brand: unique symbol }>()(
  S.Struct({
    math: S.Boolean,
    from: S.Int,
    to: S.Int,
  })
) {}

const isSpace = (char: string | undefined): boolean => char === " " || char === "\t" || char === "\n";

const isDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9";

type MeteredCharAtForEveryScanRead = (index: number) => string | undefined;

const followsUnescapedBackslashByIndex = (
  charAt: MeteredCharAtForEveryScanRead,
  length: number
): ReadonlyArray<boolean> => {
  const escaped = A.makeBy(length + 1, () => false);
  for (let index = 0; index < length; index++) {
    escaped[index + 1] = charAt(index) === "\\" && escaped[index] !== true;
  }
  return escaped;
};

const isDollarAt = (charAt: MeteredCharAtForEveryScanRead, escaped: ReadonlyArray<boolean>, index: number): boolean =>
  charAt(index) === "$" && escaped[index] !== true;

const isClosingDollar = (
  charAt: MeteredCharAtForEveryScanRead,
  escaped: ReadonlyArray<boolean>,
  index: number
): boolean => isDollarAt(charAt, escaped, index) && !isSpace(charAt(index - 1)) && !isDigit(charAt(index + 1));

const firstClosingDollarAtOrAfterOrMinusOne = (
  charAt: MeteredCharAtForEveryScanRead,
  escaped: ReadonlyArray<boolean>,
  length: number
): ReadonlyArray<number> => {
  const closers = A.makeBy(length + 2, () => -1);
  for (let index = length - 1; index >= 0; index--) {
    closers[index] = isClosingDollar(charAt, escaped, index) ? index : (closers[index + 1] ?? -1);
  }
  return closers;
};

const isDoubleDollar = (
  charAt: MeteredCharAtForEveryScanRead,
  escaped: ReadonlyArray<boolean>,
  index: number
): boolean => isDollarAt(charAt, escaped, index) && charAt(index + 1) === "$";

const mathCloseAt = (
  charAt: MeteredCharAtForEveryScanRead,
  escaped: ReadonlyArray<boolean>,
  closers: ReadonlyArray<number>,
  index: number
): O.Option<number> =>
  isDollarAt(charAt, escaped, index) && !isDoubleDollar(charAt, escaped, index) && !isSpace(charAt(index + 1))
    ? O.filter(O.fromUndefinedOr(closers[index + 2]), N.isGreaterThanOrEqualTo(0))
    : O.none();

const pushText = (segments: Array<MathSegment>, from: number, to: number): void => {
  if (to > from) {
    segments.push(MathSegment.make({ math: false, from, to }));
  }
};

/**
 * {@link scanInlineMath} with its work metered: `step` is called once per
 * character the scan reads, so the number of calls is the scan's step count.
 *
 * **Details**
 *
 * The scan behaves exactly as {@link scanInlineMath}; the meter only observes.
 * Every read, the closer table and the opener checks alike, goes through the
 * metered reader, so a closer search that re-reads the text shows up in the
 * count. `test/Md.syntax.test.ts` pins the step count as an exact linear
 * function of the text length instead of timing the scan.
 *
 * **Example** (Count the steps of one scan)
 *
 * ```ts
 * import { scanInlineMathMetered } from "@beep/md/internal/syntax/recognizers"
 *
 * let steps = 0
 * scanInlineMathMetered("a $b$ c", () => {
 *   steps += 1
 * })
 * console.log(steps) // 29
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanInlineMathMetered: {
  (step: () => void): (text: string) => ReadonlyArray<MathSegment>;
  (text: string, step: () => void): ReadonlyArray<MathSegment>;
} = dual(2, (text: string, step: () => void): ReadonlyArray<MathSegment> => {
  const charAt: MeteredCharAtForEveryScanRead = (at) => {
    step();
    return text[at];
  };
  const escaped = followsUnescapedBackslashByIndex(charAt, Str.length(text));
  const closers = firstClosingDollarAtOrAfterOrMinusOne(charAt, escaped, Str.length(text));
  const segments: Array<MathSegment> = [];
  let textStart = 0;
  let index = 0;
  while (index < Str.length(text)) {
    const close = mathCloseAt(charAt, escaped, closers, index);
    if (O.isNone(close)) {
      index += isDoubleDollar(charAt, escaped, index) ? 2 : 1;
      continue;
    }
    pushText(segments, textStart, index);
    segments.push(MathSegment.make({ math: true, from: index + 1, to: close.value }));
    textStart = close.value + 1;
    index = textStart;
  }
  pushText(segments, textStart, Str.length(text));
  return segments;
});

/**
 * Split a text run into text and inline-math segments using pandoc's
 * `tex_math_dollars` rules: the opening `$` has a non-space character to its
 * right, the closing `$` has a non-space character to its left and is not
 * followed by a digit, and `$$` is never an inline opener. A `$` behind an
 * unescaped backslash is not a delimiter, so the scan can read a raw source
 * slice. Each opener takes the first closer after it, found in a precomputed
 * table, so the scan is linear in the text length.
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanInlineMath = (text: string): ReadonlyArray<MathSegment> => scanInlineMathMetered(text, constVoid);

const escapablePunctuation = /\\([!-/:-@[-`{-~])/g;

/**
 * Remove CommonMark backslash escapes (a backslash before ASCII punctuation),
 * the only decoding the inline-math recognizer undoes when a raw slice and
 * its decoded text differ.
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const unescapeBackslashes: (raw: string) => string = Str.replace(escapablePunctuation, "$1");

/**
 * The body of a `$$ … $$` display-math paragraph, read from its raw slice.
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const mathBlockBody = (raw: string): O.Option<string> =>
  Str.length(raw) >= 4 && Str.startsWith("$$")(raw) && Str.endsWith("$$")(raw)
    ? O.some(pipe(raw, Str.slice(2, -2), Str.replace(/^\r?\n/u, ""), Str.replace(/\r?\n$/u, "")))
    : O.none();

const admonitionMarker = /^\[!([A-Za-z]+)\]/u;

/**
 * The admonition kind and the marker text when a raw paragraph slice opens
 * with a GitHub alert marker such as `[!NOTE]`.
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const admonitionMarkerOf = (raw: string): O.Option<readonly [AdmonitionKind, string]> =>
  pipe(
    Str.match(admonitionMarker)(raw),
    O.flatMap((match) => {
      const kind = Str.toLowerCase(match[1] ?? "");
      return S.is(AdmonitionKind)(kind) ? O.some<readonly [AdmonitionKind, string]>([kind, match[0]]) : O.none();
    })
  );

const youtubeUrl =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[&#?][^\s]*)?$/u;

/**
 * The video id of a YouTube watch or short URL.
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const youtubeVideoId = (url: string): O.Option<string> =>
  pipe(
    Str.match(youtubeUrl)(url),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.filter(S.is(YouTubeVideoId))
  );

const breakTag = /^<br\s*\/?>$/iu;

/**
 * Whether a raw HTML span is a `<br>` tag in one of its void spellings.
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isBreakTag = (value: string): boolean => breakTag.test(value);

const htmlComment = /^<!--(?:(?!-->)[\s\S])*-->\s*$/u;

/**
 * Whether a raw HTML node is exactly one HTML comment.
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isHtmlComment = (value: string): boolean => htmlComment.test(value);

const footnoteInvalidRun = /[^A-Za-z0-9_.:-]+/gu;
const footnoteInvalidLead = /^[^A-Za-z0-9]+/u;

/**
 * Footnote identifier rewriter shared by references and definitions, so a
 * reference and its definition always land on the same Md identifier.
 *
 * **Details**
 *
 * Runs of characters outside `[A-Za-z0-9_.:-]` become `-`, a leading
 * non-alphanumeric run is removed, an empty result becomes `fn-<n>`, and a
 * collision with an identifier already handed out gets `-2`, `-3`, ….
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class FootnoteIdentifiers {
  private readonly assigned = MutableHashMap.empty<string, string>();
  private readonly used = MutableHashSet.empty<string>();
  private generated = 0;

  /**
   * The Md identifier for a kit footnote identifier.
   */
  rewrite(identifier: string): string {
    return O.getOrElse(MutableHashMap.get(this.assigned, identifier), () => this.assign(identifier));
  }

  private assign(identifier: string): string {
    const cleaned = pipe(identifier, Str.replace(footnoteInvalidRun, "-"), Str.replace(footnoteInvalidLead, ""));
    const base = Str.isEmpty(cleaned) ? this.nextGenerated() : cleaned;
    let candidate = base;
    let suffix = 2;
    while (MutableHashSet.has(this.used, candidate)) {
      candidate = `${base}-${suffix}`;
      suffix++;
    }
    MutableHashSet.add(this.used, candidate);
    MutableHashMap.set(this.assigned, identifier, candidate);
    return candidate;
  }

  private nextGenerated(): string {
    this.generated++;
    return `fn-${this.generated}`;
  }
}

// The frontmatter capture — an offset-0 pre-scan, deliberately NOT a
// registry construct.
//
// A registry entry would give this construct powers it must never have:
// block starts can fire on any line, and frontmatter exists only as the very
// first thing in a document. The scan runs once, before the line loop, and
// on success the block pass simply starts after the closing fence. The
// captured text is raw — it never enters the inline pass, and the engine
// never decodes it (the codec modules do, over the public node).
//
// Grammar and its authorities (the fence set is deliberately closed):
// - `---` opens yaml, closed by `---` — gray-matter@4.0.3's default
//   delimiters and default language, and remark-frontmatter's yaml preset.
// - `+++` opens toml, closed by `+++` — remark-frontmatter's toml preset
//   (the markdown-ecosystem standard; mdast-util-frontmatter names the
//   `toml` node the same way).
// - `---json` opens json, closed by `---` — gray-matter's language-hint
//   form (`---<language>` after the opening delimiter) with its built-in
//   JSON engine; the closing fence is the plain delimiter, as gray-matter
//   closes it.
// - No other language hint is recognized (`---yaml`, `---toml`, `---coffee`
//   are content, not fences) — gray-matter parity is capability parity at
//   the `Frontmatter.schema` seam, not convention-for-convention emulation.
// - A fence line is the fence followed by optional trailing spaces and tabs,
//   on the opening and the closing line alike. That is
//   micromark-extension-frontmatter@2.0.0's posture (its `openSequence` and
//   `closeSequence` states consume `markdownSpace` before the line ending),
//   so remark-frontmatter agrees; gray-matter trims the opening line's
//   language hint and closes on any line that starts with the delimiter; and
//   @changesets/parse 1.0.0 closes on `---` followed by any whitespace. A
//   widening of the upstream kit grammar, which required the exact fence.
//   Leading indentation is still not a fence: micromark (`Indent not
//   allowed`) and gray-matter (an offset-0 `startsWith` and a `\n---` close)
//   reject it, and only @changesets/parse accepts it. Line terminators are
//   already stripped by the preprocessor, so CRLF sources need no special
//   casing here.
// - No closing fence, no frontmatter: the scan returns null and the
//   document parses as if the toggle were off. That is remark-frontmatter's
//   behavior too, and it is not a diagnostic — an opening fence with no
//   close IS a thematic break followed by content.

import { $MarkdownId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SourceLine } from "../preprocess.ts";

const $I = $MarkdownId.create("internal/blocks/frontmatter");

/** The metadata formats selected by frontmatter opening fences.
 *
 * **Example** (Validate FrontmatterFormat data)
 *
 * ```ts
 * import { FrontmatterFormat } from "@beep/markdown/internal/blocks/frontmatter";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FrontmatterFormat)("yaml")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrontmatterFormat = LiteralKit(["yaml", "toml", "json"]).pipe(
  $I.annoteSchema("FrontmatterFormat", {
    description: "The frontmatter formats selected by the YAML, TOML and JSON opening fences.",
  })
);
/**
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterFormat = typeof FrontmatterFormat.Type;

/** What the fence's opening line commits the scan to. */
const FenceRule = S.Struct({
  format: FrontmatterFormat.pipe(
    $I.annoteKey("FenceRule.format", { description: "The format selected by the opening fence." })
  ),
  close: S.String.pipe($I.annoteKey("FenceRule.close", { description: "The exact closing fence line." })),
}).pipe(
  $I.annoteSchema("FenceRule", { description: "The format and exact closing fence committed to by an opening line." })
);
type FenceRule = typeof FenceRule.Type;

const FENCES = HashMap.fromIterable<string, FenceRule>([
  ["---", { format: "yaml", close: "---" }],
  ["+++", { format: "toml", close: "+++" }],
  ["---json", { format: "json", close: "---" }],
]);

/** Trailing spaces and tabs after a fence (micromark's `markdownSpace`; no other whitespace). */
const reFenceTrailingSpace = /[ \t]+$/;

/** A fence line's fence spelling: the line without its trailing spaces and tabs. */
const fenceSpelling = Str.replace(reFenceTrailingSpace, "");

/** The fence rule a line opens, when the line is an opening fence. */
const openingRule = (line: string): FenceRule | undefined => O.getOrUndefined(HashMap.get(FENCES, fenceSpelling(line)));

/** Whether `line` is `rule`'s closing fence, trailing spaces and tabs allowed. */
const isClosingFence = (line: string, rule: FenceRule): boolean => fenceSpelling(line) === rule.close;

/**
 * A successful capture: everything the parser needs to skip and materialize.
 *
 * **Example** (Validate FrontmatterCapture data)
 *
 * ```ts
 * import { FrontmatterCapture } from "@beep/markdown/internal/blocks/frontmatter";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FrontmatterCapture)({ format: "yaml", value: "title: Guide", lineCount: 3, endOffset: 20 })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrontmatterCapture extends S.Opaque<FrontmatterCapture, { readonly brand: unique symbol }>()(
  S.Struct({
    format: FrontmatterFormat.pipe(
      $I.annoteKey("FrontmatterCapture.format", { description: "The metadata format selected by the opening fence." })
    ),
    value: S.String.pipe(
      $I.annoteKey("FrontmatterCapture.value", {
        description: "Raw text between fences with original interior terminators and no fence lines.",
      })
    ),
    lineCount: S.Finite.pipe(
      $I.annoteKey("FrontmatterCapture.lineCount", {
        description: "Number of source lines spanned, including both fences.",
      })
    ),
    endOffset: S.Finite.pipe(
      $I.annoteKey("FrontmatterCapture.endOffset", {
        description: "Exclusive absolute offset of the closing fence's last character.",
      })
    ),
  }).pipe(
    $I.annoteSchema("FrontmatterCapture", {
      description: "A preprocessed frontmatter capture with raw interior terminators and source boundaries.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FrontmatterCapture {
  /**
   * The plain capture record: a constructed {@link FrontmatterCapture} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FrontmatterCapture.Encoded;
}

/**
 * The raw text between the fences: each value line's preprocessed content,
 * joined by the source's own terminators between them (a terminator never
 * holds U+0000, so slicing it from the source is exact).
 */
const interiorValue = (lines: ReadonlyArray<SourceLine.Encoded>, closeIndex: number, text: string): string => {
  let value = "";
  for (let inner = 1; inner < closeIndex; inner += 1) {
    const current = A.getUnsafe(lines, inner);
    value += current.text;
    if (inner + 1 < closeIndex) {
      value += Str.slice(current.start + current.text.length, A.getUnsafe(lines, inner + 1).start)(text);
    }
  }
  return value;
};

/**
 * Scan the head of a preprocessed document for a frontmatter block.
 *
 * **Details**
 *
 * `lines` is the preprocessor's line table (U+0000 already replaced,
 * terminators stripped, absolute `start` offsets); `text` is the original
 * source, consulted only for the terminators between value lines — a
 * terminator can never contain U+0000, so slicing it from the source is
 * exact, and the value keeps CRLF interiors verbatim while the line content
 * keeps the preprocessor's U+FFFD replacement.
 *
 * Returns `null` when the document has no frontmatter — which is the common
 * case and never an error.
 *
 * **Example** (Capture preprocessed YAML frontmatter)
 *
 * ```ts
 * import { scanFrontmatter } from "@beep/markdown/internal/blocks/frontmatter";
 * import { preprocessLines } from "@beep/markdown/internal/preprocess";
 *
 * const text = "---\nname: Ada\n---\nbody";
 * const capture = scanFrontmatter(preprocessLines(text), text);
 * console.log(capture?.format); // yaml
 * console.log(capture?.value); // name: Ada
 * console.log(scanFrontmatter(preprocessLines("body"), "body")); // null
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanFrontmatter: {
  (lines: ReadonlyArray<SourceLine.Encoded>, text: string): FrontmatterCapture | null;
  (text: string): (lines: ReadonlyArray<SourceLine.Encoded>) => FrontmatterCapture | null;
} = dual(2, (lines: ReadonlyArray<SourceLine.Encoded>, text: string): FrontmatterCapture | null => {
  const opening = lines[0];
  const rule = opening === undefined || opening.start !== 0 ? undefined : openingRule(opening.text);
  if (rule === undefined) {
    return null;
  }
  for (let closeIndex = 1; closeIndex < lines.length; closeIndex += 1) {
    const closing = A.getUnsafe(lines, closeIndex);
    if (isClosingFence(closing.text, rule)) {
      return FrontmatterCapture.make({
        format: rule.format,
        value: interiorValue(lines, closeIndex, text),
        lineCount: closeIndex + 1,
        endOffset: closing.start + closing.text.length,
      });
    }
  }
  return null;
});

/**
 * **Example** (Read the accepted terminators)
 *
 * ```ts
 * import { RawNewline } from "@beep/markdown/internal/blocks/frontmatter";
 *
 * console.log(RawNewline.literals.length); // 3
 * console.log(RawNewline.literals.includes("\r\n")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RawNewline = LiteralKit(["\n", "\r\n", "\r"]).pipe(
  $I.annoteSchema("RawNewline", {
    description: "The three raw line terminators recognized by the frontmatter scanners.",
  })
);

/**
 * A raw line terminator spelling derived from the shared literal domain.
 *
 * @category schemas
 * @since 0.0.0
 */
export type RawNewline = typeof RawNewline.Type;

/**
 * A successful raw string-level capture: exact byte boundaries into the
 * ORIGINAL source, no preprocessing (no U+0000 replacement — the value slice
 * is verbatim bytes; a fence line containing U+0000 simply is not a fence,
 * matching the preprocessed scan where the replacement character breaks the
 * fence match the same way).
 *
 * **Example** (Validate RawFrontmatterCapture data)
 *
 * ```ts
 * import { RawFrontmatterCapture } from "@beep/markdown/internal/blocks/frontmatter";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(RawFrontmatterCapture)({ format: "yaml", value: "title: Guide\n", newline: "\n", bodyOffset: 21 })); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawFrontmatterCapture extends S.Opaque<RawFrontmatterCapture, { readonly brand: unique symbol }>()(
  S.Struct({
    format: FrontmatterFormat.pipe(
      $I.annoteKey("RawFrontmatterCapture.format", {
        description: "The metadata format selected by the opening fence.",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("RawFrontmatterCapture.value", {
        description:
          "Exact source between fences, including each value line's terminator; empty and a blank value line stay distinct.",
      })
    ),
    newline: RawNewline.pipe(
      $I.annoteKey("RawFrontmatterCapture.newline", { description: "The line terminator following the opening fence." })
    ),
    bodyOffset: S.Finite.pipe(
      $I.annoteKey("RawFrontmatterCapture.bodyOffset", {
        description: "Absolute offset after the closing fence and its terminator, where the body begins.",
      })
    ),
  }).pipe(
    $I.annoteSchema("RawFrontmatterCapture", {
      description: "An exact raw frontmatter capture retaining value bytes, opening newline and body boundary.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RawFrontmatterCapture {
  /**
   * The plain raw capture record: a constructed {@link RawFrontmatterCapture} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RawFrontmatterCapture.Encoded;
}

/** Every raw line terminator; `\r\n` is tried first, so it is one terminator. */
const reRawTerminator = /\r\n|\r|\n/g;

const decodeRawNewline = S.decodeUnknownResult(RawNewline);

/**
 * Where the line starting at `from` ends, and where the next one starts:
 * equal at the end of `source`, where the last line has no terminator.
 */
const lineBounds = (source: string, from: number): readonly [lineEnd: number, next: number] => {
  reRawTerminator.lastIndex = from;
  const terminator = reRawTerminator.exec(source);
  return terminator === null
    ? [source.length, source.length]
    : [terminator.index, terminator.index + terminator[0].length];
};

/**
 * Scan the lines after the opening fence for `rule`'s closing fence,
 * capturing everything between the two.
 */
const closingFence = (
  source: string,
  rule: FenceRule,
  newline: RawNewline,
  valueStart: number
): O.Option<RawFrontmatterCapture> => {
  for (let lineStart = valueStart; ; ) {
    const [lineEnd, next] = lineBounds(source, lineStart);
    if (isClosingFence(Str.slice(lineStart, lineEnd)(source), rule)) {
      return RawFrontmatterCapture.makeOption({
        format: rule.format,
        value: Str.slice(valueStart, lineStart)(source),
        newline,
        bodyOffset: next,
      });
    }
    if (next === lineEnd) {
      return O.none();
    }
    lineStart = next;
  }
};

/**
 * Captures frontmatter from raw source with exact offsets for string-level
 * splitting and joining.
 *
 * **Details**
 *
 * Uses the same closed fence grammar as {@link scanFrontmatter}, over
 * unpreprocessed bytes, returning exact offsets. The two scans agree on every
 * input about WHETHER a block exists
 * (the preprocessor's substitutions are length-preserving and can only break
 * a fence match both scans require); this one exists for the string-level
 * split/join surface, whose contract is byte exactness.
 *
 * Returns `Option.none()` when the document has no frontmatter — no fence at
 * offset 0, or an opening fence with no closing fence, which per the grammar
 * is not frontmatter at all.
 *
 * **Example** (Preserve raw terminators and locate the body)
 *
 * ```ts
 * import { scanRawFrontmatter } from "@beep/markdown/internal/blocks/frontmatter";
 * import * as O from "effect/Option";
 *
 * const source = "---\r\nname: Ada\r\n---\r\nbody";
 * const capture = O.getOrThrow(scanRawFrontmatter(source));
 * console.log(capture.format); // yaml
 * console.log(capture.value === "name: Ada\r\n"); // true
 * console.log(capture.bodyOffset); // 21
 * console.log(O.isNone(scanRawFrontmatter("---\nno closing fence"))); // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanRawFrontmatter = (source: string): O.Option<RawFrontmatterCapture> => {
  // The opening fence line: source up to the first terminator. It must be
  // a fence (trailing spaces and tabs allowed) and must be terminated — a
  // closing fence needs somewhere to live.
  const [openingEnd, valueStart] = lineBounds(source, 0);
  const rule = openingRule(Str.slice(0, openingEnd)(source));
  if (rule === undefined || valueStart === openingEnd) {
    return O.none();
  }
  const newline = Result.getOrThrow(decodeRawNewline(Str.slice(openingEnd, valueStart)(source)));
  return closingFence(source, rule, newline, valueStart);
};

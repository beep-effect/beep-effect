import { $CliKitId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sanitize } from "../Fmt.ts";
import { LinkTarget } from "../LinkTarget.ts";
import { Style, TokenName } from "../Token.ts";
import { displayWidth, graphemes } from "./displayWidth.ts";
import type { Inline } from "../Doc.ts";
import type { LinkTargetInput } from "../LinkTarget.ts";
import type { RenderContext } from "../Render.ts";

const $I = $CliKitId.create("internal/layout");

/**
 * A run of text with one style and one link: the unit a renderer lays out.
 *
 * **Details**
 *
 * `text` is plain: flattening removes any escape sequence it carried. Spans that came from one `Link` inline share
 * the same `link` object, which is how painting wraps them in a single hyperlink.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { Span } from "@beep/cli-kit/internal/layout"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Span)({ text: "hello", token: "accent" })) // true
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export class Span extends S.Opaque<Span, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * It came from a `Code` inline. A renderer adds its own code markers, and `truncateSpans` reads the flag too:
     * an ellipsis after a code span is plain text beside it, not inside it.
     */
    code: S.optionalKey(S.Literal(true)).pipe($I.annoteKey("Span.code", { description: "The code field of Span." })),
    /** It came from inside an `Emphasis`: italic in `ansi`, `_` in markdown. */
    em: S.optionalKey(S.Literal(true)).pipe($I.annoteKey("Span.em", { description: "The em field of Span." })),
    /** It came from a `StatusMark`: a glyph, which `Counts` with `paint: "glyph"` keeps painted. */
    glyph: S.optionalKey(S.Literal(true)).pipe($I.annoteKey("Span.glyph", { description: "The glyph field of Span." })),
    /**
     * Whitespace kept at the end of a line, never trimmed: the indent of a blank line inside a compact list item, so
     * the item's lines read as one indented block (a test runner's diff has blank lines).
     */
    hold: S.optionalKey(S.Literal(true)).pipe($I.annoteKey("Span.hold", { description: "The hold field of Span." })),
    /** The link it belongs to. */
    link: S.optionalKey(S.suspend(() => LinkTarget)).pipe(
      $I.annoteKey("Span.link", { description: "The link field of Span." })
    ),
    /** It came from inside a `Strong`: bold in `ansi`, `**` in markdown. */
    strong: S.optionalKey(S.Literal(true)).pipe(
      $I.annoteKey("Span.strong", { description: "The strong field of Span." })
    ),
    /** The `suffix` option of the link it belongs to, when the `Link` set one. */
    suffix: S.optionalKey(S.Boolean).pipe($I.annoteKey("Span.suffix", { description: "The suffix field of Span." })),
    /** The plain text. */
    text: S.String.pipe($I.annoteKey("Span.text", { description: "The text field of Span." })),
    /** The token or style it is painted with. */
    token: S.optionalKey(S.Union([TokenName, Style])).pipe(
      $I.annoteKey("Span.token", { description: "The token field of Span." })
    ),
  }).pipe($I.annoteSchema("Span", { description: "Plain Span data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { Span } from "@beep/cli-kit/internal/layout"
 * import * as S from "effect/Schema"
 *
 * const plain: Span.Encoded = { text: "hello", token: "accent" }
 * console.log(S.is(Span)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Span {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Span.Encoded;
}

const pathSeparator = (ctx: RenderContext.Encoded): string =>
  ctx.audience === "agent" ? ctx.glyphs.pathSeparator.agent : ` ${ctx.glyphs.pathSeparator.human} `;

/** A link target is sanitized like content, and loses its line breaks, which no URL or path holds. */
const safeTargetText = (text: string): string => Str.replace(/[\r\n]/g, "")(sanitize(text));

const safeTarget = (target: LinkTargetInput): LinkTargetInput =>
  // A structural test, so this module needs no runtime edge to Doc.ts (which imports Render, which imports this). A
  // file target may carry `url: undefined` and stays a file target, as the schema decides.
  Match.value(target).pipe(
    Match.when({ url: P.isString }, (target) => ({ url: safeTargetText(target.url) })),
    Match.orElse((target) => ({
      file: safeTargetText(target.file),
      ...O.getSomesStruct({ line: O.fromUndefinedOr(target.line), col: O.fromUndefinedOr(target.col) }),
    }))
  );

const spansOf: {
  (inline: Inline, ctx: RenderContext.Encoded): ReadonlyArray<Span.Encoded>;
  (ctx: RenderContext.Encoded): (inline: Inline) => ReadonlyArray<Span.Encoded>;
} = dual(
  2,
  (inline: Inline, ctx: RenderContext.Encoded): ReadonlyArray<Span.Encoded> =>
    Match.valueTags(inline, {
      Text: (inline) => [
        { text: sanitize(inline.value), ...O.getSomesStruct({ token: O.fromUndefinedOr(inline.token) }) },
      ],
      Code: (inline): ReadonlyArray<Span.Encoded> => [{ text: sanitize(inline.value), code: true }],
      Link: (inline) => {
        // Links do not nest: the outer target wins over one inside the label. The target is sanitized like content,
        // since a control character in a URL ends an OSC 8 early; one copy is shared by every span of the link.
        const link = safeTarget(inline.target);
        const suffix = inline.suffix === undefined ? {} : { suffix: inline.suffix };
        return pipe(
          inline.label,
          A.flatMap(spansOf(ctx)),
          A.map((span) => ({ ...span, link, ...suffix }))
        );
      },
      StatusMark: (inline): ReadonlyArray<Span.Encoded> => [
        {
          text: sanitize(ctx.glyphs.kind === "ascii" ? inline.def.ascii : inline.def.glyph),
          token: inline.def.token,
          glyph: true,
        },
      ],
      Path: (inline) => [{ text: pipe(inline.segments, A.map(sanitize), A.join(pathSeparator(ctx))) }],
      Strong: (inline) =>
        pipe(
          inline.content,
          A.flatMap(spansOf(ctx)),
          A.map((span) => ({ ...span, strong: true as const }))
        ),
      Emphasis: (inline) =>
        pipe(
          inline.content,
          A.flatMap(spansOf(ctx)),
          A.map((span) => ({ ...span, em: true as const }))
        ),
      File: (inline) => [{ text: safeTargetText(ctx.displayPath(inline.path)) }],
    })
);

/**
 * Flatten inline nodes into spans.
 *
 * **Details**
 *
 * A `Path` becomes its segments joined by the audience's separator (`›` with spaces around it for a person, ` > `
 * for an agent), a `StatusMark` its glyph from the context's glyph set painted with the definition's token, and a
 * `Code` its text with `code` set. Escape sequences in content and in link targets are removed and empty spans
 * dropped.
 *
 * **Example** (Remove escapes while flattening text)
 *
 * ```ts
 * import { flatten } from "@beep/cli-kit/internal/layout"
 * import { Render } from "@beep/cli-kit/Render"
 *
 * const spans = flatten([{ _tag: "Text", value: "\u001b[31mready\u001b[39m" }], Render.contextOf({ audience: "agent" }))
 * console.log(JSON.stringify(spans)) // [{"text":"ready"}]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const flatten: {
  (ctx: RenderContext.Encoded): (inlines: ReadonlyArray<Inline>) => ReadonlyArray<Span.Encoded>;
  (inlines: ReadonlyArray<Inline>, ctx: RenderContext.Encoded): ReadonlyArray<Span.Encoded>;
} = dual(
  2,
  (inlines: ReadonlyArray<Inline>, ctx: RenderContext.Encoded): ReadonlyArray<Span.Encoded> =>
    pipe(
      inlines,
      A.flatMap(spansOf(ctx)),
      A.filter((span) => span.text !== "")
    )
);

/**
 * The display width of spans in terminal columns.
 *
 * **Details**
 *
 * Graphemes are measured within a span, deliberately: a cluster split across two spans (the two halves of a flag,
 * a joiner and the next emoji) counts as two characters, as it is laid out. Content does not split a cluster unless
 * the caller does.
 *
 * **Example** (Measure adjacent plain spans)
 *
 * ```ts
 * import { widthOf } from "@beep/cli-kit/internal/layout"
 *
 * console.log(widthOf([{ text: "界" }, { text: "ok" }])) // 4
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const widthOf = (spans: ReadonlyArray<Span.Encoded>): number =>
  A.reduce(spans, 0, (sum, span) => sum + displayWidth(span.text));

/** One grapheme with its width and the span it came from. */
interface Cell {
  readonly grapheme: string;
  readonly span: Span.Encoded;
  readonly width: number;
}

const cellsOf = (spans: ReadonlyArray<Span.Encoded>): ReadonlyArray<Cell> =>
  A.flatMap(spans, (span) =>
    A.map(graphemes(span.text), (grapheme) => ({ grapheme, width: displayWidth(grapheme), span }))
  );

/** Rebuild spans from cells, merging a run that came from the same span. */
const spansFromCells = (cells: ReadonlyArray<Cell>): ReadonlyArray<Span.Encoded> => {
  const out: Array<Span.Encoded> = [];
  let current: Cell["span"] | undefined;
  for (const cell of cells) {
    if (cell.span === current) {
      const last = A.getUnsafe(out, out.length - 1);
      out[out.length - 1] = { ...last, text: last.text + cell.grapheme };
    } else {
      current = cell.span;
      out.push({ ...cell.span, text: cell.grapheme });
    }
  }
  return out;
};

const takeCells = (spans: ReadonlyArray<Span.Encoded>, budget: number): ReadonlyArray<Span.Encoded> => {
  const kept: Array<Cell> = [];
  let used = 0;
  for (const cell of cellsOf(spans)) {
    if (used + cell.width > budget) break;
    kept.push(cell);
    used += cell.width;
  }
  return spansFromCells(kept);
};

const appendEllipsis = (
  out: ReadonlyArray<Span.Encoded>,
  spans: ReadonlyArray<Span.Encoded>,
  ellipsis: string
): ReadonlyArray<Span.Encoded> => {
  const last = out[out.length - 1];
  if (last === undefined) {
    // Nothing but the marker fits: it stands for the whole label, so it keeps the first span's style and link.
    const first = A.getUnsafe(spans, 0);
    return [
      {
        text: ellipsis,
        ...O.getSomesStruct({ token: O.fromUndefinedOr(first.token) }),
        ...O.getSomesStruct({ link: O.fromUndefinedOr(first.link) }),
      },
    ];
  }
  if (last.code === true) {
    return [...out, { text: ellipsis, ...O.getSomesStruct({ link: O.fromUndefinedOr(last.link) }) }];
  }
  return [...A.dropRight(out, 1), { ...last, text: last.text + ellipsis }];
};

/**
 * Cut spans to at most `width` columns, marking the cut with `ellipsis`.
 *
 * **Details**
 *
 * Cuts on grapheme boundaries and before any painting, so a colour or hyperlink is never cut in half: the kept
 * text keeps its span's token and link, and the marker joins the last kept span (or follows a `Code` span as plain
 * text under the same link). When nothing but the marker fits, it takes the first span's token and link, as it
 * stands for the whole label. Spans that already fit are returned as they are. An ellipsis that cannot fit is
 * omitted, and a `width` of 0 or less gives no spans.
 *
 * **Example** (Reserve columns for the truncation marker)
 *
 * ```ts
 * import { truncateSpans } from "@beep/cli-kit/internal/layout"
 *
 * console.log(JSON.stringify(truncateSpans([{ text: "world" }], 4, "…"))) // [{"text":"wor…"}]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const truncateSpans: {
  (width: number, ellipsis: string): (spans: ReadonlyArray<Span.Encoded>) => ReadonlyArray<Span.Encoded>;
  (spans: ReadonlyArray<Span.Encoded>, width: number, ellipsis: string): ReadonlyArray<Span.Encoded>;
} = dual(3, (spans: ReadonlyArray<Span.Encoded>, width: number, ellipsis: string): ReadonlyArray<Span.Encoded> => {
  const limit = Number.isNaN(width) ? 0 : Math.floor(width);
  if (limit <= 0) return [];
  if (widthOf(spans) <= limit) return spans;

  const ellipsisWidth = displayWidth(ellipsis);
  const useEllipsis = ellipsis !== "" && ellipsisWidth <= limit;
  const budget = useEllipsis ? limit - ellipsisWidth : limit;

  const out = takeCells(spans, budget);
  if (!useEllipsis) return out;

  return appendEllipsis(out, spans, ellipsis);
});

/**
 * Paint spans, then link them: the string a terminal shows.
 *
 * **Details**
 *
 * Each span is painted with its token, and consecutive spans that share a link (by identity) are wrapped in one
 * hyperlink. Truncate and wrap first: painting is last, so an escape sequence is never cut.
 *
 * **Example** (Render spans without terminal colour)
 *
 * ```ts
 * import { paintSpans } from "@beep/cli-kit/internal/layout"
 * import { Render } from "@beep/cli-kit/Render"
 *
 * console.log(paintSpans([{ text: "ready" }], Render.contextOf({ audience: "agent" }))) // ready
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const paintSpans: {
  (ctx: RenderContext.Encoded): (spans: ReadonlyArray<Span.Encoded>) => string;
  (spans: ReadonlyArray<Span.Encoded>, ctx: RenderContext.Encoded): string;
} = dual(2, (spans: ReadonlyArray<Span.Encoded>, ctx: RenderContext.Encoded): string => {
  const paint = (span: Span.Encoded): string => {
    const toned = span.token === undefined ? span.text : ctx.paint(span.token, span.text);
    const bold = span.strong === true ? ctx.paint({ bold: true }, toned) : toned;
    return span.em === true ? ctx.paint({ italic: true }, bold) : bold;
  };
  let out = "";
  let i = 0;
  while (i < spans.length) {
    const start = A.getUnsafe(spans, i);
    let run = paint(start);
    i++;
    if (start.link === undefined) {
      out += run;
      continue;
    }
    while (i < spans.length && A.getUnsafe(spans, i).link === start.link) {
      run += paint(A.getUnsafe(spans, i));
      i++;
    }
    out += ctx.link(start.link, run);
  }
  return out;
});

const isLineBreak = (grapheme: string): boolean => grapheme === "\n" || grapheme === "\r\n" || grapheme === "\r";

const cellsWidth = (cells: ReadonlyArray<Cell>): number => A.reduce(cells, 0, (sum, cell) => sum + cell.width);

const wordRun = (cells: ReadonlyArray<Cell>, start: number) => {
  let i = start;
  const spaces: Array<Cell> = [];
  while (i < cells.length && A.getUnsafe(cells, i).grapheme === " ") spaces.push(A.getUnsafe(cells, i++));
  const word: Array<Cell> = [];
  while (i < cells.length) {
    const { grapheme } = A.getUnsafe(cells, i);
    if (grapheme === " " || isLineBreak(grapheme)) break;
    word.push(A.getUnsafe(cells, i++));
  }
  return { spaces, word, end: i };
};

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { WrapOptions } from "@beep/cli-kit/internal/layout"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(WrapOptions)({ hardBreak: true })) // true
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export class WrapOptions extends S.Opaque<WrapOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Break a word longer than the width at the edge; `true` by default. When `false` it stays whole on its own line. */
    hardBreak: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("WrapOptions.hardBreak", { description: "The hardBreak field of WrapOptions." })
    ),
  }).pipe($I.annoteSchema("WrapOptions", { description: "Plain WrapOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { WrapOptions } from "@beep/cli-kit/internal/layout"
 * import * as S from "effect/Schema"
 *
 * const plain: WrapOptions.Encoded = { hardBreak: true }
 * console.log(S.is(WrapOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WrapOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WrapOptions.Encoded;
}

/**
 * Word-wrap spans to `width` columns.
 *
 * **Details**
 *
 * Spaces are the break points, and the space at a break is dropped, as are trailing spaces; spaces inside a line,
 * and the indentation of the first line or one after a newline, are kept. A newline is a forced break. A word
 * longer than the width starts on a line of its own and is broken at the edge, never inside a grapheme, so a wide
 * character never straddles it. A grapheme wider than the width (a width of 1 and a wide character) takes a line
 * to itself, the only way to make progress. With `hardBreak: false` a long word is not broken at all: it keeps a line
 * of its own and runs past the width, which is right for a URL or a path. A `width` under 1 is treated as 1. Each character keeps its span's
 * token and link.
 *
 * **Example** (Wrap at the space between words)
 *
 * ```ts
 * import { wrapSpans } from "@beep/cli-kit/internal/layout"
 *
 * const lines = wrapSpans([{ text: "hello world" }], 5)
 * console.log(JSON.stringify(lines)) // [[{"text":"hello"}],[{"text":"world"}]]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const wrapSpans: {
  (
    width: number,
    options?: WrapOptions.Encoded
  ): (spans: ReadonlyArray<Span.Encoded>) => ReadonlyArray<ReadonlyArray<Span.Encoded>>;
  (
    spans: ReadonlyArray<Span.Encoded>,
    width: number,
    options?: WrapOptions.Encoded
  ): ReadonlyArray<ReadonlyArray<Span.Encoded>>;
} = dual(
  (args) => A.isArray(args[0]),
  (
    spans: ReadonlyArray<Span.Encoded>,
    width: number,
    options?: WrapOptions.Encoded
  ): ReadonlyArray<ReadonlyArray<Span.Encoded>> => {
    const limit = Number.isNaN(width) ? 1 : Math.max(1, Math.floor(width));
    const cells = cellsOf(spans);
    const lines: Array<ReadonlyArray<Cell>> = [];
    let line: Array<Cell> = [];
    let used = 0;
    const flush = (): void => {
      lines.push(line);
      line = [];
      used = 0;
    };

    const appendOverflow = (word: ReadonlyArray<Cell>, wordWidth: number): void => {
      if (line.length > 0) {
        flush();
      }
      if (wordWidth <= limit || options?.hardBreak === false) {
        line.push(...word);
        used = wordWidth;
        return;
      }
      for (const cell of word) {
        if (used + cell.width > limit && line.length > 0) {
          flush();
        }
        line.push(cell);
        used += cell.width;
      }
    };

    const appendWord = (
      lead: ReadonlyArray<Cell>,
      word: ReadonlyArray<Cell>,
      leadWidth: number,
      wordWidth: number
    ): void => {
      if (used + leadWidth + wordWidth <= limit) {
        line.push(...lead, ...word);
        used += leadWidth + wordWidth;
        return;
      }
      appendOverflow(word, wordWidth);
    };

    let i = 0;
    while (i < cells.length) {
      if (isLineBreak(A.getUnsafe(cells, i).grapheme)) {
        flush();
        i++;
        continue;
      }
      const run = wordRun(cells, i);
      const { spaces, word } = run;
      i = run.end;
      if (word.length === 0) continue;

      // Every overflow flush immediately appends a word or cell; an empty line is a leading line.
      const lead = spaces;
      const leadWidth = cellsWidth(lead);
      const wordWidth = cellsWidth(word);
      appendWord(lead, word, leadWidth, wordWidth);
    }
    if (line.length > 0 || lines.length === 0) flush();
    return A.map(lines, spansFromCells);
  }
);

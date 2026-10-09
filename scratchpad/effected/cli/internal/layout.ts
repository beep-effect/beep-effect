import * as A from "effect/Array";
import * as Match from "effect/Match";
import { dual } from "effect/Function";
import type { Inline, LinkTarget } from "../Doc.ts";
import { sanitize } from "../Fmt.ts";
import type { RenderContext } from "../Render.ts";
import type { Style, TokenName } from "../Token.ts";
import { displayWidth, graphemes } from "./displayWidth.ts";
import * as O from "@beep/utils/Option";

/**
 * A run of text with one style and one link: the unit a renderer lays out.
 *
 * **Details**
 *
 * `text` is plain: flattening removes any escape sequence it carried. Spans that came from one `Link` inline share
 * the same `link` object, which is how painting wraps them in a single hyperlink.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface Span {
	/** The plain text. */
	readonly text: string;
	/** The token or style it is painted with. */
	readonly token?: TokenName | Style;
	/** The link it belongs to. */
	readonly link?: LinkTarget;
	/**
	 * It came from a `Code` inline. A renderer adds its own code markers, and `truncateSpans` reads the flag too:
	 * an ellipsis after a code span is plain text beside it, not inside it.
	 */
	readonly code?: true;
	/** The `suffix` option of the link it belongs to, when the `Link` set one. */
	readonly suffix?: boolean;
	/** It came from a `StatusMark`: a glyph, which `Counts` with `paint: "glyph"` keeps painted. */
	readonly glyph?: true;
	/** It came from inside a `Strong`: bold in `ansi`, `**` in markdown. */
	readonly strong?: true;
	/** It came from inside an `Emphasis`: italic in `ansi`, `_` in markdown. */
	readonly em?: true;
	/**
	 * Whitespace kept at the end of a line, never trimmed: the indent of a blank line inside a compact list item, so
	 * the item's lines read as one indented block (a test runner's diff has blank lines).
	 */
	readonly hold?: true;
}

const pathSeparator = (ctx: RenderContext): string =>
	ctx.audience === "agent" ? ctx.glyphs.pathSeparator.agent : ` ${ctx.glyphs.pathSeparator.human} `;

/** A link target is sanitized like content, and loses its line breaks, which no URL or path holds. */
const safeTargetText = (text: string): string => sanitize(text).replace(/[\r\n]/g, "");

const safeTarget = (target: LinkTarget): LinkTarget =>
	"url" in target ? { url: safeTargetText(target.url) } : { ...target, file: safeTargetText(target.file) };

const spansOf = (inline: Inline, ctx: RenderContext): ReadonlyArray<Span> =>
	Match.valueTags(inline, {
		Text: (inline) =>
			[{ text: sanitize(inline.value), ...O.getSomesStruct({ token: O.fromUndefinedOr(inline.token) }) }],
		Code: (inline): ReadonlyArray<Span> => [{ text: sanitize(inline.value), code: true }],
		Link: (inline) => {
			// Links do not nest: the outer target wins over one inside the label. The target is sanitized like content,
			// since a control character in a URL ends an OSC 8 early; one copy is shared by every span of the link.
			const link = safeTarget(inline.target);
			const suffix = inline.suffix === undefined ? {} : { suffix: inline.suffix };
			return inline.label.flatMap((part) => spansOf(part, ctx)).map((span) => ({ ...span, link, ...suffix }));
		},
		StatusMark: (inline): ReadonlyArray<Span> =>
			[
				{
					text: sanitize(ctx.glyphs.kind === "ascii" ? inline.def.ascii : inline.def.glyph),
					token: inline.def.token,
					glyph: true,
				},
			],
		Path: (inline) => [{ text: inline.segments.map(sanitize).join(pathSeparator(ctx)) }],
		Strong: (inline) =>
			inline.content.flatMap((part) => spansOf(part, ctx)).map((span) => ({ ...span, strong: true as const })),
		Emphasis: (inline) =>
			inline.content.flatMap((part) => spansOf(part, ctx)).map((span) => ({ ...span, em: true as const })),
		File: (inline) => [{ text: safeTargetText(ctx.displayPath(inline.path)) }],
	});

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
 * import { flatten } from "@beep/scratchpad/effected/cli/internal/layout"
 * import { Render } from "@beep/scratchpad/effected/cli/Render"
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
	(ctx: RenderContext): (inlines: ReadonlyArray<Inline>) => ReadonlyArray<Span>;
	(inlines: ReadonlyArray<Inline>, ctx: RenderContext): ReadonlyArray<Span>;
} = dual(2, (inlines: ReadonlyArray<Inline>, ctx: RenderContext): ReadonlyArray<Span> =>
	inlines.flatMap((inline) => spansOf(inline, ctx)).filter((span) => span.text !== ""));

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
 * import { widthOf } from "@beep/scratchpad/effected/cli/internal/layout"
 *
 * console.log(widthOf([{ text: "界" }, { text: "ok" }])) // 4
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const widthOf = (spans: ReadonlyArray<Span>): number =>
	spans.reduce((sum, span) => sum + displayWidth(span.text), 0);

/** One grapheme with its width and the span it came from. */
interface Cell {
	readonly grapheme: string;
	readonly width: number;
	readonly span: Span;
}

const cellsOf = (spans: ReadonlyArray<Span>): ReadonlyArray<Cell> =>
	spans.flatMap((span) => graphemes(span.text).map((grapheme) => ({ grapheme, width: displayWidth(grapheme), span })));

/** Rebuild spans from cells, merging a run that came from the same span. */
const spansFromCells = (cells: ReadonlyArray<Cell>): ReadonlyArray<Span> => {
	const out: Array<Span> = [];
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
 * import { truncateSpans } from "@beep/scratchpad/effected/cli/internal/layout"
 *
 * console.log(JSON.stringify(truncateSpans([{ text: "hello" }], 4, "…"))) // [{"text":"hel…"}]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const truncateSpans: {
	(width: number, ellipsis: string): (spans: ReadonlyArray<Span>) => ReadonlyArray<Span>;
	(spans: ReadonlyArray<Span>, width: number, ellipsis: string): ReadonlyArray<Span>;
} = dual(3, (spans: ReadonlyArray<Span>, width: number, ellipsis: string): ReadonlyArray<Span> => {
	const limit = Number.isNaN(width) ? 0 : Math.floor(width);
	if (limit <= 0) return [];
	if (widthOf(spans) <= limit) return spans;

	const ellipsisWidth = displayWidth(ellipsis);
	const useEllipsis = ellipsis !== "" && ellipsisWidth <= limit;
	const budget = useEllipsis ? limit - ellipsisWidth : limit;

	const kept: Array<Cell> = [];
	let used = 0;
	for (const cell of cellsOf(spans)) {
		if (used + cell.width > budget) break;
		kept.push(cell);
		used += cell.width;
	}
	const out = spansFromCells(kept);
	if (!useEllipsis) return out;

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
	return [...out.slice(0, -1), { ...last, text: last.text + ellipsis }];
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
 * import { paintSpans } from "@beep/scratchpad/effected/cli/internal/layout"
 * import { Render } from "@beep/scratchpad/effected/cli/Render"
 *
 * console.log(paintSpans([{ text: "ready" }], Render.contextOf({ audience: "agent" }))) // ready
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const paintSpans: {
	(ctx: RenderContext): (spans: ReadonlyArray<Span>) => string;
	(spans: ReadonlyArray<Span>, ctx: RenderContext): string;
} = dual(2, (spans: ReadonlyArray<Span>, ctx: RenderContext): string => {
	const paint = (span: Span): string => {
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
		while (i < spans.length && (A.getUnsafe(spans, i)).link === start.link) {
			run += paint(A.getUnsafe(spans, i));
			i++;
		}
		out += ctx.link(start.link, run);
	}
	return out;
});

const isLineBreak = (grapheme: string): boolean => grapheme === "\n" || grapheme === "\r\n" || grapheme === "\r";

const cellsWidth = (cells: ReadonlyArray<Cell>): number => cells.reduce((sum, cell) => sum + cell.width, 0);

/**
 * Options for {@link wrapSpans}.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface WrapOptions {
	/** Break a word longer than the width at the edge; `true` by default. When `false` it stays whole on its own line. */
	readonly hardBreak?: boolean;
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
 * import { wrapSpans } from "@beep/scratchpad/effected/cli/internal/layout"
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
	(width: number, options?: WrapOptions): (spans: ReadonlyArray<Span>) => ReadonlyArray<ReadonlyArray<Span>>;
	(spans: ReadonlyArray<Span>, width: number, options?: WrapOptions): ReadonlyArray<ReadonlyArray<Span>>;
} = dual((args) => A.isArray(args[0]), (
	spans: ReadonlyArray<Span>,
	width: number,
	options?: WrapOptions,
): ReadonlyArray<ReadonlyArray<Span>> => {
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

	let i = 0;
	while (i < cells.length) {
		if (isLineBreak((A.getUnsafe(cells, i)).grapheme)) {
			flush();
			i++;
			continue;
		}
		const spaces: Array<Cell> = [];
		while (i < cells.length && (A.getUnsafe(cells, i)).grapheme === " ") spaces.push(A.getUnsafe(cells, i++));
		const word: Array<Cell> = [];
		while (i < cells.length) {
			const { grapheme } = A.getUnsafe(cells, i);
			if (grapheme === " " || isLineBreak(grapheme)) break;
			word.push(A.getUnsafe(cells, i++));
		}
		if (word.length === 0) continue;

		// Every overflow flush immediately appends a word or cell; an empty line is a leading line.
		const lead = spaces;
		const leadWidth = cellsWidth(lead);
		const wordWidth = cellsWidth(word);
		if (used + leadWidth + wordWidth <= limit) {
			line.push(...lead, ...word);
			used += leadWidth + wordWidth;
			continue;
		}
		if (line.length > 0) {
			flush();
		}
		if (wordWidth <= limit || options?.hardBreak === false) {
			line.push(...word);
			used = wordWidth;
			continue;
		}
		for (const cell of word) {
			if (used + cell.width > limit && line.length > 0) {
				flush();
			}
			line.push(cell);
			used += cell.width;
		}
	}
	if (line.length > 0 || lines.length === 0) flush();
	return lines.map(spansFromCells);
});

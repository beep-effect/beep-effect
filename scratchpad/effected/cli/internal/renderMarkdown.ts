import { dual } from "effect/Function";
import type { Block, Document, Inline, LinkTarget } from "../Doc.ts";
import { Fmt, sanitize } from "../Fmt.ts";
import type { RenderContext } from "../Render.ts";
import { counterLabel, countsTableOf, totalOf, visibleCountersOf } from "./counts.ts";
import type { Span } from "./layout.ts";
import { flatten } from "./layout.ts";
import { isAllowedLinkUrl } from "./linkScheme.ts";
import { DRIVE, encodePath, fileUrlPath } from "./linkTarget.ts";
import { capOf, isAnnotation, showsSuffix, targetText, textLines } from "./renderDoc.ts";

type Lines = ReadonlyArray<string>;

/** How a line break inside text is written: a hard break in flowing text, `<br>` in a table cell, a space in a line. */
type Mode = "flow" | "cell" | "line";

/** Marks a line break inside flowing text until the paragraph is split into lines. Sanitized text never holds NUL. */
const BREAK = "\u0000";

/**
 * Escape what markdown would read as syntax: backslash, backtick, `*`, `_`, brackets, angle brackets, `&`, `~` and
 * `|` (so text can never form a table), and the start of an autolink literal (any scheme before `://`, or `www.`), which a GFM
 * reader would otherwise turn into a link. An email address is left alone: the `mailto:` link a reader makes of it
 * is harmless, and escaping its `@` does not stop every reader.
 */
const escapeText = (text: string): string =>
	text
		.replace(/[\\`*_[\]<>&~|]/g, "\\$&")
		.replace(/(?<=[a-z0-9+.-]):(?=\/\/)/gi, "\\:")
		.replace(/\b(www)\./gi, "$1\\.");

/**
 * Escape a block marker at the start of a line: a heading or an ordered item, and always a leading `-`, `+` or `=`,
 * which would make a bullet, a setext underline or (with spaces between dashes) a thematic break.
 */
const escapeLineStart = (line: string): string => {
	if (/^[-+=]/.test(line)) return `\\${line}`;
	if (/^#{1,6}(?:\s|$)/.test(line)) return `\\${line}`;
	const ordered = /^(\d{1,9})([.)])(?:\s|$)/.exec(line);
	if (ordered !== null) return `${ordered[1]}\\${line.slice((ordered[1] as string).length)}`;
	return line;
};

const htmlEscape = (text: string): string =>
	text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Whether some `|` in the text has an odd run of backslashes straight before it. */
const pipeAfterOddBackslashes = (text: string): boolean => {
	let run = 0;
	for (const ch of text) {
		if (ch === "|" && run % 2 === 1) return true;
		run = ch === "\\" ? run + 1 : 0;
	}
	return false;
};

/**
 * Inline code: a backtick fence longer than any run inside, padded where a reader would strip or merge a space.
 *
 * @remarks
 * In a table cell a `|` is written `\|`, which GFM unescapes before it reads the code span. GFM's row scanner reads a
 * backslash and the character after it as a pair, so a `|` survives the scanner only after an odd run of backslashes,
 * and the unescape then leaves an even run: a code span in a cell cannot hold a `|` after an odd run of backslashes at
 * all. That text is written as `<code>` around escaped text instead, which reads the same; every other `|` follows an
 * even run, which `\|` keeps.
 */
const codeSpan = (text: string, mode: Mode): string => {
	const flat = text.replace(/\r\n|\r|\n/g, " ");
	if (mode === "cell" && pipeAfterOddBackslashes(flat)) return `<code>${escapeText(flat)}</code>`;
	const longest = Math.max(0, ...[...flat.matchAll(/`+/g)].map((run) => run[0].length));
	const fence = "`".repeat(longest + 1);
	const padded = /^`|`$/.test(flat) || (/^ .* $/.test(flat) && flat.trim() !== "") || flat === "";
	// Backslashes in a code span are literal, so they are not escaped: every `|` here follows an even run of them.
	// Escaping them too would change the code a reader sees; the markdown oracle tests pin this.
	const body = mode === "cell" ? flat.split("|").join("\\|") : flat;
	const pad = padded ? " " : "";
	return `${fence}${pad}${body === "" ? " " : body}${pad}${fence}`;
};

const textPiece = (text: string, mode: Mode): string =>
	text
		.split(/\r\n|\r|\n/)
		.map(escapeText)
		.join(mode === "cell" ? "<br>" : mode === "line" ? " " : BREAK);

/**
 * A link's URL when it has a form a reader can follow: an allowed scheme, a relative URL, or an absolute file path.
 *
 * The scheme is read from a normalised copy, with whitespace and control characters removed and the case folded,
 * because a browser ignores them inside a scheme (`java<tab>script:`). An entity cannot hide one either: the
 * destination escapes `&`, so what a reader decodes is the text that was checked here.
 */
const linkUrl = (target: LinkTarget, ctx: RenderContext): string | undefined => {
	if ("url" in target) {
		const url = target.url.trim();
		return isAllowedLinkUrl(url) ? url : undefined;
	}
	if (ctx.linkBase !== undefined) {
		// A repository URL in place of `file://`: the display path under the base, with the line as GitHub's anchor. A
		// display path that is absolute or climbs out with `..` is not under the base, so it has no URL form.
		const display = sanitize(ctx.displayPath(target.file)).replace(/\\/g, "/");
		if (display.startsWith("/") || DRIVE.test(display) || display.split("/").includes("..")) return undefined;
		const url = `${ctx.linkBase}${encodePath(display)}${target.line === undefined ? "" : `#L${target.line}`}`;
		return isAllowedLinkUrl(url) ? url : undefined;
	}
	// The same builder as `CliLinks`, so a drive path links the same way here; a UNC or relative path has no link.
	if (!target.file.startsWith("/") && !DRIVE.test(target.file)) return undefined;
	const path = fileUrlPath(target.file);
	return path === undefined ? undefined : `file://${path}`;
};

/**
 * A link destination. `&` is escaped so a reader does not decode an entity into something other than what was written.
 * `|` and the backtick are percent-encoded, which is the same URL: GFM splits a table row into cells before it reads
 * inlines, so a raw `|` would split the row however the destination is written, and a backtick can open a code span.
 */
const destination = (raw: string): string => {
	const url = raw.replace(/&/g, "&amp;").replace(/\|/g, "%7C").replace(/`/g, "%60");
	return /^[^\s()<>\\]*$/.test(url)
		? url
		: `<${url
				.replace(/[\r\n]/g, "")
				.replace(/\\/g, "\\\\")
				.replace(/</g, "%3C")
				.replace(/>/g, "%3E")}>`;
};

/**
 * Spans as markdown: each piece escaped, or fenced as code, and `**` or `_` around each stretch of strong or emphasised
 * spans. The spaces at a stretch's edges stay outside its markers, where a reader would otherwise not see emphasis.
 */
const emphasized = (spans: ReadonlyArray<Span>, mode: Mode): string => {
	let out = "";
	let i = 0;
	while (i < spans.length) {
		const strong = (spans[i] as Span).strong === true;
		const em = (spans[i] as Span).em === true;
		let body = "";
		do {
			const span = spans[i] as Span;
			body += span.code === true ? codeSpan(span.text, mode) : textPiece(span.text, mode);
			i++;
		} while (
			i < spans.length &&
			((spans[i] as Span).strong === true) === strong &&
			((spans[i] as Span).em === true) === em
		);
		const lead = /^\s*/.exec(body)?.[0] ?? "";
		const core = body.slice(lead.length).trimEnd();
		const trail = body.slice(lead.length + core.length);
		if ((!strong && !em) || core === "") {
			out += body;
			continue;
		}
		// `*` for emphasis, not `_`: GFM opens and closes `*` inside a word, where `_` reads as literal text.
		out += `${lead}${strong ? "**" : ""}${em ? "*" : ""}${core}${em ? "*" : ""}${strong ? "**" : ""}${trail}`;
	}
	return out;
};

/** Inline nodes as markdown: text escaped, code fenced, a link as `[label](url)` or, with no URL form, label and path. */
const inlineMd = (inlines: ReadonlyArray<Inline>, ctx: RenderContext, mode: Mode): string => {
	const flat = flatten(inlines, ctx);
	let out = "";
	let i = 0;
	while (i < flat.length) {
		// A run of spans sharing one link (or none): its label is marked up as a whole, so emphasis spans the run.
		const link = (flat[i] as Span).link;
		const start = i;
		do i++;
		while (i < flat.length && (flat[i] as Span).link === link);
		const run = flat.slice(start, i);
		const label = emphasized(run, mode);
		if (link === undefined) {
			out += label;
			continue;
		}
		const raw = run.map((span) => span.text).join("");
		const url = linkUrl(link, ctx);
		const target = targetText(link, ctx);
		if (url !== undefined) out += `[${label}](${destination(url)})`;
		else out += showsSuffix((flat[i - 1] as Span).suffix, raw, target) ? `${label} (${codeSpan(target, mode)})` : label;
	}
	return out;
};

/** Flowing text as lines: blank lines dropped, each line cleared of indentation and of block markers, hard breaks between. */
const flowLines = (markdown: string): Lines => {
	const lines = markdown
		.split(BREAK)
		.map((line) => line.trimStart())
		.filter((line) => line.trim() !== "")
		.map(escapeLineStart);
	return lines.map((line, index) => (index < lines.length - 1 ? `${line}\\` : line.trimEnd()));
};

const joinBlocks = (blocks: ReadonlyArray<Lines>): Lines =>
	blocks.filter((block) => block.length > 0).flatMap((block, index) => (index === 0 ? block : ["", ...block]));

/** A line a paragraph ends on: text, rather than a heading, fence, table, quote, list item or HTML. */
const endsText = (line: string): boolean =>
	line !== "" && !/^(?:#{1,6}(?:\s|$)|`{3,}|~{3,}|\||>|[-+*] |\d+[.)] |<)/.test(line);

/**
 * Blocks joined with no blank line between them, for a compact list item. Where one block's text runs straight into
 * the next block's text they would merge into one paragraph, so a hard break keeps them apart.
 */
const joinTight = (blocks: ReadonlyArray<Lines>): Lines => {
	const joined: Array<string> = [];
	for (const block of blocks) {
		if (block.length === 0) continue;
		const last = joined[joined.length - 1];
		if (last !== undefined && endsText(last) && endsText(block[0] ?? "")) joined[joined.length - 1] = `${last}\\`;
		joined.push(...block);
	}
	return joined;
};

const hang = (lines: Lines, first: string, rest: string): Lines =>
	lines.length === 0 ? [first.trimEnd()] : lines.map((line, index) => `${index === 0 ? first : rest}${line}`.trimEnd());

const overflowMd = (
	overflow: ((hidden: number) => ReadonlyArray<Inline>) | undefined,
	hidden: number,
	ctx: RenderContext,
): Lines =>
	flowLines(
		overflow === undefined
			? escapeText(`${ctx.glyphs.ellipsis} ${hidden} more`)
			: inlineMd(overflow(hidden), ctx, "flow"),
	);

const fenced = (lines: Lines, info: string): Lines => {
	const longest = Math.max(0, ...lines.flatMap((line) => [...line.matchAll(/`+/g)].map((run) => run[0].length)));
	const fence = "`".repeat(Math.max(3, longest + 1));
	return [`${fence}${info}`, ...lines, fence];
};

const align = { left: ":--", right: "--:", center: ":-:" } as const;

const tableMd = (
	header: ReadonlyArray<string>,
	aligns: ReadonlyArray<"left" | "right" | "center" | undefined>,
	rows: ReadonlyArray<ReadonlyArray<string>>,
): Lines => {
	const row = (cells: ReadonlyArray<string>): string => `| ${cells.join(" | ")} |`.replace(/ {2}\|/g, " |");
	return [row(header), row(aligns.map((a) => (a === undefined ? "---" : align[a]))), ...rows.map(row)];
};

interface Walk {
	readonly ctx: RenderContext;
}

const countsMd = (walk: Walk, block: Extract<Block, { readonly _tag: "Counts" }>): ReadonlyArray<Lines> => {
	const { ctx } = walk;
	const visible = visibleCountersOf(block);
	const total = totalOf(block);
	const label = block.label === undefined ? "" : inlineMd(block.label, ctx, "line").trim();
	const qualifier = block.qualifier === undefined ? "" : inlineMd(block.qualifier, ctx, "line").trim();
	const duration = block.durationMs === undefined ? "" : Fmt.duration(block.durationMs);
	const suffix = block.suffix === undefined ? "" : inlineMd(block.suffix, ctx, "line").trim();
	const name = (counter: (typeof visible)[number], count?: number): string =>
		escapeText(sanitize(counterLabel(counter, count)).replace(/\r\n|\r|\n/g, " "));
	// A share headline's label reads by the total it is a share of: "1/3 repos".
	const headlineName = (counter: (typeof visible)[number], index: number): string =>
		index === 0 && block.share !== false ? name(counter, total) : name(counter);

	if (block.layout === "row") {
		// Every column of the table is named: the counters by their labels and the duration as `duration`. The label,
		// which names the row rather than a column, goes above it, and the qualifier and suffix below.
		const header = [...visible.map(headlineName), ...(duration === "" ? [] : ["duration"])];
		const cells = [
			...visible.map((counter, index) =>
				index === 0 && block.share !== false ? `${counter.n}/${total}` : String(counter.n),
			),
			...(duration === "" ? [] : [duration]),
		];
		const after = [qualifier, suffix].filter((part) => part !== "").join(" ");
		return [
			...(label === "" ? [] : [flowLines(label)]),
			...(header.length === 0
				? []
				: [
						tableMd(
							header,
							header.map(() => undefined),
							[cells],
						),
					]),
			...(after === "" ? [] : [flowLines(after)]),
		];
	}
	if (block.layout === "columns") {
		return [
			...(label === "" ? [] : [flowLines(label)]),
			...(visible.length === 0
				? []
				: // The name starts a list item, so it is cleared of indentation and of a block marker like any line start.
					[
						visible.flatMap((counter) =>
							hang([`${escapeLineStart(name(counter).trimStart())}: ${counter.n}`], "- ", "  "),
						),
					]),
			...(qualifier === "" ? [] : [flowLines(qualifier)]),
			...(duration === "" ? [] : [[duration]]),
			...(suffix === "" ? [] : [flowLines(suffix)]),
		];
	}
	const tally = visible
		.map((counter, index) =>
			index === 0 && block.share !== false
				? `${counter.n}/${total} ${headlineName(counter, index)}`
				: `${counter.n} ${name(counter)}`,
		)
		.join(", ");
	const head = [label === "" ? "" : `${label}:`, tally].filter((part) => part !== "").join(" ");
	const line = [head, qualifier, duration === "" ? "" : `(${duration})`, suffix]
		.filter((part) => part !== "")
		.join(" ");
	return line === "" ? [] : [flowLines(line)];
};

/**
 * A heading's text with any closing run of `#` escaped, so a reader does not take it for the optional closing sequence.
 *
 * @remarks
 * The text is already markdown: every backslash that came from the document was escaped as text, so a backslash can
 * never sit unescaped in front of the run.
 */
const headingText = (markdown: string): string => {
	const text = markdown.trim();
	let start = text.length;
	while (start > 0 && text[start - 1] === "#") start--;
	return `${text.slice(0, start)}${"\\#".repeat(text.length - start)}`;
};

const WHITESPACE = /\s/;

/**
 * A cell's text without the whitespace and `<br>` breaks at either edge, scanned from each end. A regex alternation
 * anchored only at the end retries from every position of an interior run, which is quadratic on a long one.
 */
const trimCellEdges = (text: string): string => {
	let start = 0;
	let end = text.length;
	for (;;) {
		if (start < end && WHITESPACE.test(text.charAt(start))) start += 1;
		else if (start + 4 <= end && text.startsWith("<br>", start)) start += 4;
		else break;
	}
	for (;;) {
		if (end > start && WHITESPACE.test(text.charAt(end - 1))) end -= 1;
		else if (end - 4 >= start && text.startsWith("<br>", end - 4)) end -= 4;
		else break;
	}
	return text.slice(start, end);
};

/** A block as markdown. `compact` is set on a compact list's item: a section there joins its parts with no blank lines. */
const blockMd = (walk: Walk, block: Block, depth: number, compact = false): Lines => {
	const { ctx } = walk;
	switch (block._tag) {
		case "Heading": {
			return [`${"#".repeat(block.level)} ${headingText(inlineMd(block.content, ctx, "line"))}`.trimEnd()];
		}
		case "Paragraph":
			return flowLines(inlineMd(block.content, ctx, "flow"));
		case "List": {
			const cap = capOf(block.cap);
			// Annotations are skipped before the cap, so it counts what is shown, as in the other renderers.
			const listed = block.items.filter((item) => !isAnnotation(item));
			const shown = cap === undefined ? listed : listed.slice(0, cap);
			const items = shown.flatMap((item) => hang(blockMd(walk, item, depth, block.compact === true), "- ", "  "));
			const hidden = listed.length - shown.length;
			return joinBlocks([items, hidden > 0 ? overflowMd(block.overflow, hidden, ctx) : []]);
		}
		case "Table": {
			const columns = Math.max(block.columns.length, ...block.rows.map((row) => row.length));
			if (columns === 0) return [];
			const cap = capOf(block.cap);
			const shown = cap === undefined ? block.rows : block.rows.slice(0, cap);
			// A line break at the edge of a cell is not content: the cell is its trimmed text.
			const cell = (inlines: ReadonlyArray<Inline> | undefined): string =>
				inlines === undefined ? "" : trimCellEdges(inlineMd(inlines, ctx, "cell"));
			const header = Array.from({ length: columns }, (_, index) => cell(block.columns[index]?.header));
			const aligns = Array.from({ length: columns }, (_, index) => block.columns[index]?.align);
			const rows = shown.map((row) => Array.from({ length: columns }, (_, index) => cell(row[index])));
			const hidden = block.rows.length - shown.length;
			const overflow = hidden > 0 ? overflowMd(block.overflow, hidden, ctx) : [];
			// No header text and no row shown, such as a counts table over zero projects: an empty table is noise, as in
			// the text renderers, which draw nothing for it.
			if (rows.length === 0 && header.every((text) => text === "")) return overflow;
			return joinBlocks([tableMd(header, aligns, rows), overflow]);
		}
		case "Tree": {
			const lines: Array<string> = [];
			const visit = (children: typeof block.root.children, indent: number): void => {
				for (const child of children) {
					const label = flowLines(inlineMd(child.label, ctx, "line"))[0] ?? "";
					lines.push(`${" ".repeat(indent)}- ${label}`.trimEnd());
					visit(child.children, indent + 2);
				}
			};
			visit(block.root.children, 0);
			return joinBlocks([flowLines(inlineMd(block.root.label, ctx, "line")), lines]);
		}
		case "Collapsible": {
			const title = htmlEscape(
				flatten(block.title, ctx)
					.map((span) => span.text)
					.join("")
					.replace(/\r\n|\r|\n/g, " "),
			);
			const open = block.open === true ? " open" : "";
			// The HTML block ends at a blank line, so the body needs one before it and the close one after it.
			const body = joinBlocks(block.body.map((child) => blockMd(walk, child, depth)));
			return [
				`<details${open}><summary>${title}</summary>`,
				"",
				...(body.length === 0 ? [] : [...body, ""]),
				"</details>",
			];
		}
		case "Callout": {
			const body = joinBlocks(block.body.map((child) => blockMd(walk, child, depth)));
			const first = block.body[0];
			const separate = first !== undefined && first._tag !== "Paragraph";
			const quoted = [`[!${block.kind.toUpperCase()}]`, ...(separate ? [""] : []), ...body];
			return quoted.map((line) => (line === "" ? ">" : `> ${line}`));
		}
		case "CodeBlock": {
			const info =
				sanitize(block.lang ?? "")
					.trim()
					.split(/\s+/)[0]
					?.replace(/`/g, "") ?? "";
			return fenced(block.text === "" ? [] : textLines(block.text), info);
		}
		case "Diff": {
			const cap = capOf(block.cap);
			const side = (marker: string, text: string): Lines => {
				const lines = textLines(text);
				const shown = cap === undefined ? lines : lines.slice(0, cap);
				const hidden = lines.length - shown.length;
				return [
					...shown.map((line) => `${marker} ${line}`.trimEnd()),
					...(hidden > 0 ? [`  ${ctx.glyphs.ellipsis} ${hidden} more lines`] : []),
				];
			};
			return fenced([...side("-", block.expected), ...side("+", block.received)], "diff");
		}
		case "Section": {
			const level = Math.min(2 + depth, 6);
			const title =
				block.title === undefined
					? []
					: [`${"#".repeat(level)} ${headingText(inlineMd(block.title, ctx, "line"))}`.trimEnd()];
			const parts = [title, ...block.children.map((child) => blockMd(walk, child, depth + 1))];
			return compact ? joinTight(parts) : joinBlocks(parts);
		}
		case "Counts":
			return joinBlocks(countsMd(walk, block));
		case "Verbatim": {
			// Fenced, so the indentation survives: markdown would drop it from text, or read four spaces as code.
			const indent = " ".repeat(Math.max(0, Math.floor(block.indent ?? 0)));
			return fenced(block.text === "" ? [] : textLines(block.text).map((line) => `${indent}${line}`), "");
		}
		case "Annotation":
			return [];
		case "CountsTable":
			return blockMd(walk, countsTableOf(block), depth);
		case "Lines": {
			// One paragraph, the entries kept apart by hard breaks, so a reader never runs them together. An empty entry
			// between two others is an empty line, a hard break of its own; at either end it has nothing to hold it.
			const entries = block.lines.map((entry) => escapeLineStart(inlineMd(entry, ctx, "line").trim()));
			let first = 0;
			let last = entries.length;
			while (first < last && entries[first] === "") first++;
			while (last > first && entries[last - 1] === "") last--;
			const kept = entries.slice(first, last);
			return kept.map((line, index) => (index < kept.length - 1 ? `${line}\\` : line));
		}
		case "Line":
			return flowLines(inlineMd(block.content, ctx, "line"));
		case "DiffText": {
			const cap = capOf(block.cap);
			const lines = block.text === "" ? [] : textLines(block.text);
			const shown = cap === undefined ? lines : lines.slice(0, cap);
			const hidden = lines.length - shown.length;
			return fenced([...shown, ...(hidden > 0 ? [`${ctx.glyphs.ellipsis} ${hidden} more lines`] : [])], "diff");
		}
	}
};

/**
 * Render a document as GitHub-flavoured markdown.
 *
 * @internal
 */
export const renderMarkdown: {
	(ctx: RenderContext): (doc: Document) => string;
	(doc: Document, ctx: RenderContext): string;
} = dual(2, (doc: Document, ctx: RenderContext): string =>
	joinBlocks(doc.map((block) => blockMd({ ctx }, block, 0))).join("\n"));

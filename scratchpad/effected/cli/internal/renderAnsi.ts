import type { Document, Inline } from "../Doc.ts";
import type { RenderContext } from "../Render.ts";
import type { Span } from "./layout.ts";
import { flatten, paintSpans } from "./layout.ts";
import type { Flavour } from "./renderDoc.ts";
import { renderDoc, showsSuffix, targetText } from "./renderDoc.ts";

/**
 * Inline content as styled spans: code painted `accent` with no backticks, and links kept on their spans so that
 * painting wraps them through `ctx.link`.
 *
 * When `ctx.link` does not make a hyperlink (it returns the label unchanged), the target would be lost, so it follows
 * the label in parentheses, muted, unless the label already is the target. That is decided here, before layout, so
 * widths and wrapping count it.
 */
const inline = (inlines: ReadonlyArray<Inline>, ctx: RenderContext): ReadonlyArray<Span> => {
	const flat = flatten(inlines, ctx);
	const out: Array<Span> = [];
	let i = 0;
	while (i < flat.length) {
		const link = (flat[i] as Span).link;
		let label = "";
		do {
			const span = flat[i] as Span;
			label += span.text;
			out.push(span.code === true && span.token === undefined ? { ...span, token: "accent" } : span);
			i++;
		} while (link !== undefined && i < flat.length && (flat[i] as Span).link === link);
		if (link !== undefined && ctx.link(link, label) === label) {
			const target = targetText(link, ctx);
			if (showsSuffix((flat[i - 1] as Span).suffix, label, target)) out.push({ text: ` (${target})`, token: "muted" });
		}
	}
	return out;
};

const ansi: Flavour = {
	inline,
	finish: (line, ctx) => paintSpans(line, ctx),
};

/**
 * Render a document for a person: the layout of plain text, painted with the context's tokens and linked through its
 * `link` function.
 *
 * @internal
 */
export const renderAnsi = (doc: Document, ctx: RenderContext): string => renderDoc(doc, ctx, ansi);

import * as A from "effect/Array";
import { dual } from "effect/Function";
import type { Document, Inline } from "../Doc.ts";
import type { RenderContext } from "../Render.ts";
import type { Span } from "./layout.ts";
import { flatten } from "./layout.ts";
import type { Flavour } from "./renderDoc.ts";
import { renderDocLines, showsSuffix, targetText } from "./renderDoc.ts";

/**
 * Inline content as spans of plain text: code in backticks, and a link as its label followed by its target in
 * parentheses unless the label already is the target. Tokens and links are dropped, as plain text has neither.
 *
 * **Example** (Flatten text to unstyled spans)
 *
 * ```ts
 * import { plainInline } from "@beep/scratchpad/effected/cli/internal/renderPlain"
 * import { Doc } from "@beep/scratchpad/effected/cli/Doc"
 * import { Render } from "@beep/scratchpad/effected/cli/Render"
 * const ctx = Render.contextOf({ audience: "human", color: "none" })
 * console.log(JSON.stringify(plainInline([Doc.text("Ready")], ctx))) // [{"text":"Ready"}]
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const plainInline: {
	(ctx: RenderContext): (inlines: ReadonlyArray<Inline>) => ReadonlyArray<Span>;
	(inlines: ReadonlyArray<Inline>, ctx: RenderContext): ReadonlyArray<Span>;
} = dual(2, (inlines: ReadonlyArray<Inline>, ctx: RenderContext): ReadonlyArray<Span> => {
	const flat = flatten(inlines, ctx);
	const out: Array<Span> = [];
	let i = 0;
	while (i < flat.length) {
		const link = (A.getUnsafe(flat, i)).link;
		let label = "";
		do {
			const span = A.getUnsafe(flat, i);
			label += span.text;
			out.push({ text: span.code === true ? `\`${span.text}\`` : span.text });
			i++;
		} while (link !== undefined && i < flat.length && (A.getUnsafe(flat, i)).link === link);
		if (link !== undefined) {
			const target = targetText(link, ctx);
			if (showsSuffix((A.getUnsafe(flat, i - 1)).suffix, label, target)) out.push({ text: ` (${target})` });
		}
	}
	return out;
});

const plain: Flavour = {
	inline: plainInline,
	finish: (line) => line.map((span) => span.text).join(""),
};

/**
 * {@link renderPlain}'s finished lines, one entry per line: a block that draws nothing contributes none.
 *
 * **Example** (Inspect individual output lines)
 *
 * ```ts
 * import { renderPlainLines } from "@beep/scratchpad/effected/cli/internal/renderPlain"
 * import { Doc } from "@beep/scratchpad/effected/cli/Doc"
 * import { Render } from "@beep/scratchpad/effected/cli/Render"
 * const ctx = Render.contextOf({ audience: "human", color: "none" })
 * console.log(JSON.stringify(renderPlainLines([Doc.paragraph("Ready")], ctx))) // ["Ready"]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const renderPlainLines: {
	(ctx: RenderContext): (doc: Document) => ReadonlyArray<string>;
	(doc: Document, ctx: RenderContext): ReadonlyArray<string>;
} = dual(2, (doc: Document, ctx: RenderContext): ReadonlyArray<string> =>
	// Plain text is for agents whatever the context says, so the path separator is always the agent one, and the
	// context's paint and link are never reached: a span's token and link are dropped when its line is finished.
	renderDocLines(doc, { ...ctx, audience: "agent" }, plain));

/**
 * Render a document as plain text for an agent: no escape sequences, no decoration.
 *
 * **Example** (Render a paragraph)
 *
 * ```ts
 * import { renderPlain } from "@beep/scratchpad/effected/cli/internal/renderPlain"
 * import { Doc } from "@beep/scratchpad/effected/cli/Doc"
 * import { Render } from "@beep/scratchpad/effected/cli/Render"
 * const ctx = Render.contextOf({ audience: "human", color: "none" })
 * console.log(renderPlain([Doc.paragraph("Ready")], ctx)) // Ready
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const renderPlain: {
	(ctx: RenderContext): (doc: Document) => string;
	(doc: Document, ctx: RenderContext): string;
} = dual(2, (doc: Document, ctx: RenderContext): string => renderPlainLines(doc, ctx).join("\n"));

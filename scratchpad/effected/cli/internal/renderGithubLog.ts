import * as Match from "effect/Match";
import { dual } from "effect/Function";
import { CommandNeutralizer, WorkflowCommand } from "../../github-commands/index.ts";
import type { Block, Document } from "../Doc.ts";
import { sanitize } from "../Fmt.ts";
import type { RenderContext } from "../Render.ts";
import { plainInline, renderPlainLines } from "./renderPlain.ts";
import * as O from "@beep/utils/Option";

/** Plain lines, neutralized; a block that draws nothing, such as an empty table, gives no line at all. */
const plainLines = (blocks: ReadonlyArray<Block>, ctx: RenderContext): ReadonlyArray<string> =>
	renderPlainLines(blocks, ctx).flatMap((line) => CommandNeutralizer.lines(line));

/** An annotation as the kit's own command, on the trusted path: escaped by `WorkflowCommand`, never neutralized. */
const annotationLine = (block: Extract<Block, { readonly _tag: "Annotation" }>): string =>
	WorkflowCommand[block.level](sanitize(block.message), {
		...O.getSomesStruct({ title: O.map(O.fromUndefinedOr(block.title), sanitize) }),
		...O.getSomesStruct({ file: O.map(O.fromUndefinedOr(block.file), sanitize) }),
		...O.getSomesStruct({ startLine: O.fromUndefinedOr(block.line) }),
		...O.getSomesStruct({ endLine: O.fromUndefinedOr(block.endLine) }),
		...O.getSomesStruct({ startColumn: O.fromUndefinedOr(block.col) }),
		...O.getSomesStruct({ endColumn: O.fromUndefinedOr(block.endColumn) }),
	});

/** A group's body: plain text, except an annotation, which is still a command inside a group. */
const bodyLines = (blocks: ReadonlyArray<Block>, ctx: RenderContext): ReadonlyArray<string> =>
	blocks.flatMap((block) =>
		block._tag === "Annotation" ? [annotationLine(block)] : plainLines([block], ctx),
	);

const blockLines = (block: Block, ctx: RenderContext): ReadonlyArray<string> =>
	Match.value(block).pipe(
		Match.tag("Annotation", (block): ReadonlyArray<string> => [annotationLine(block)]),
		Match.tag("Collapsible", (block): ReadonlyArray<string> => {
			// The title is a command's data, so its line breaks are escaped: a raw one would end the command.
			const title = plainInline(block.title, ctx)
				.map((span) => span.text)
				.join("");
			// Groups do not nest: inside this one a collapsible is plain text, its title and its indented body.
			return [WorkflowCommand.group(title), ...bodyLines(block.body, ctx), WorkflowCommand.endGroup()];
		}),
		Match.tag("Section", (block): ReadonlyArray<string> => {
			// A section's children start a line, so they may be groups. Everything else is plain text.
			const groups: Array<ReadonlyArray<string>> = [
				...(block.title === undefined
					? []
					: [plainLines([{ _tag: "Heading", level: 1, content: block.title }], ctx)]),
				...block.children.map((child) => blockLines(child, ctx)),
			];
			return groups.flatMap((group, index) => (index === 0 ? group : ["", ...group]));
		}),
		Match.orElse((block): ReadonlyArray<string> => plainLines([block], ctx)),
	);

/**
 * Render a document for a GitHub Actions log: plain text, with a top-level collapsible as a group.
 *
 * @internal
 */
export const renderGithubLog: {
	(ctx: RenderContext): (doc: Document) => string;
	(doc: Document, ctx: RenderContext): string;
} = dual(2, (doc: Document, ctx: RenderContext): string =>
	doc.flatMap((block) => blockLines(block, ctx)).join("\n"),
);

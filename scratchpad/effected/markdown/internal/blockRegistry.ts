// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: upstream's `blocks` object and `blockStarts` array are module
// globals. Here they are per-dialect tables, which is the whole point of the
// restructuring — a dialect is a registry composition and nothing else, so
// GFM and a future `obsidian` dialect land as new construct modules with
// no change to any public API.
//
// THE ORDER OF `starts` IS THE ALGORITHM, and it is upstream's order exactly.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { atxHeadingStart, headingConstruct } from "./blocks/atxHeading.ts";
import { blockquoteConstruct, blockquoteStart } from "./blocks/blockquote.ts";
import { codeConstruct } from "./blocks/code.ts";
import { documentConstruct } from "./blocks/document.ts";
import { fencedCodeStart } from "./blocks/fencedCode.ts";
import { footnoteDefinitionConstruct, footnoteDefinitionStart } from "./blocks/footnoteDefinition.ts";
import { htmlBlockConstruct, htmlBlockStart } from "./blocks/htmlBlock.ts";
import { indentedCodeStart } from "./blocks/indentedCode.ts";
import { definitionConstruct } from "./blocks/linkReferenceDefinition.ts";
import { listConstruct, listItemConstruct, listItemStart } from "./blocks/list.ts";
import { paragraphConstruct } from "./blocks/paragraph.ts";
import { setextHeadingStart } from "./blocks/setextHeading.ts";
import {
	tableCellConstruct,
	tableConstruct,
	tableHeaderStart,
	tableRowConstruct,
	tableRowStart,
} from "./blocks/table.ts";
import { taskListItemStart } from "./blocks/taskListItem.ts";
import { thematicBreakConstruct, thematicBreakStart } from "./blocks/thematicBreak.ts";
import type { BlockConstruct, BlockDialect, BlockType } from "./blockTypes.ts";

const $I = $ScratchpadId.create("effected/markdown/internal/blockRegistry");

class UnknownBlockDialectError extends S.TaggedError<UnknownBlockDialectError>($I`UnknownBlockDialectError`)("UnknownBlockDialectError", {
	message: S.String.annotateKey({ description: "The unknown-dialect invariant failure message." }),
}, $I.annote("UnknownBlockDialectError", { description: "An unrecognized block registry dialect was requested." })) {}

/**
 * The dialects the block pass can be keyed by.
 *
 * **Details**
 *
 * The name doubles as the inline pass's dialect key (`InlineDialectName`), so
 * one string selects both registries.
 * **Example** (Validate MarkdownDialect)
 *
 * ```ts
 * import { MarkdownDialect } from "@beep/scratchpad/effected/markdown/internal/blockRegistry"
 * import * as S from "effect/Schema"
 *
 * S.is(MarkdownDialect)("gfm") // => true
 * S.is(MarkdownDialect)("mdx") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownDialect = LiteralKit(["commonmark", "gfm"]).annotate(
	$I.annote("MarkdownDialect", { description: "The grammar names shared by the block and inline registries." }),
);

/** The supported grammar names derived from their schema.
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownDialect = typeof MarkdownDialect.Type;

const constructTable = (constructs: ReadonlyArray<BlockConstruct>): HashMap.HashMap<BlockType, BlockConstruct> =>
	HashMap.fromIterable(A.map(constructs, (construct): readonly [BlockType, BlockConstruct] => [construct.type, construct]));

const commonmarkDialect: BlockDialect = {
	constructs: constructTable([
		documentConstruct,
		blockquoteConstruct,
		listConstruct,
		listItemConstruct,
		paragraphConstruct,
		headingConstruct,
		thematicBreakConstruct,
		codeConstruct,
		htmlBlockConstruct,
		definitionConstruct,
	]),
	starts: [
		blockquoteStart,
		atxHeadingStart,
		fencedCodeStart,
		htmlBlockStart,
		setextHeadingStart,
		thematicBreakStart,
		listItemStart,
		indentedCodeStart,
	],
};

// GFM's block grammar is CommonMark's plus tables, task-list items and
// footnote definitions.
//
// The extension starts sit LAST, after every CommonMark start, because that is
// where cmark-gfm runs its extensions: `open_new_blocks` tries the core
// constructs first and only reaches `try_opening_block` when none of them
// claimed the line. The ordering is load-bearing rather than cosmetic — it is
// what makes `---` under a paragraph a setext heading instead of a one-column
// table, and `> quoted` under a table a blockquote instead of a row.
//
// The footnote definition is the exception, and deliberately so: it is not an
// extension at all. cmark-gfm keeps footnotes in its core, gated by
// `CMARK_OPT_FOOTNOTES`, and its branch of `open_new_blocks` sits between the
// thematic break and the list marker. It is registered at that same core
// position rather than with the extensions, because a `[^a]: ...` line has to
// beat the list-item start that would otherwise claim what follows.
const gfmDialect: BlockDialect = {
	constructs: constructTable([
		documentConstruct,
		blockquoteConstruct,
		listConstruct,
		listItemConstruct,
		paragraphConstruct,
		headingConstruct,
		thematicBreakConstruct,
		codeConstruct,
		htmlBlockConstruct,
		definitionConstruct,
		footnoteDefinitionConstruct,
		tableConstruct,
		tableRowConstruct,
		tableCellConstruct,
	]),
	starts: [
		blockquoteStart,
		atxHeadingStart,
		fencedCodeStart,
		htmlBlockStart,
		setextHeadingStart,
		thematicBreakStart,
		footnoteDefinitionStart,
		listItemStart,
		indentedCodeStart,
		taskListItemStart,
		tableHeaderStart,
		tableRowStart,
	],
	// commonmark.js's `reMaybeSpecial` fast path knows nothing of tables, task
	// lists or footnotes: a delimiter row can begin with `|` or `:`, a table
	// row can begin with any character at all, and both a task-list checkbox
	// and a footnote definition begin with `[`. cmark-gfm has no such filter,
	// so this restores the lines it would hide — and only those.
	mayStartBlock: (rest, container) =>
		container.type === "table" || rest.startsWith("[") || rest.startsWith("|") || rest.startsWith(":"),
};

const dialects = HashMap.fromIterable<MarkdownDialect, BlockDialect>([
	["commonmark", commonmarkDialect],
	["gfm", gfmDialect],
]);

/**
 * The block tables for `dialect`.
 *
 * **Gotchas**
 *
 * An unknown dialect cannot arrive through the schema-typed public surface,
 * so it is programmer error and dies as a defect.
 * **Example** (Inspect the CommonMark start order)
 *
 * ```ts
 * import { blockDialect } from "@beep/scratchpad/effected/markdown/internal/blockRegistry"
 *
 * console.log(blockDialect("commonmark").starts.length) // 8
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const blockDialect = (dialect: MarkdownDialect): BlockDialect =>
	O.getOrThrowWith(HashMap.get(dialects, dialect), () =>
		UnknownBlockDialectError.make({ message: `unknown markdown dialect: ${String(dialect)}` }),
	);

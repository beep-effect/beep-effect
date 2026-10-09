import type { Audience, TerminalEnv } from "../env/index.ts";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import type { CliLinks } from "./CliLinks.ts";
import type { CliTheme } from "./CliTheme.ts";
import { autoFormat } from "./internal/autoFormat.ts";
import { totalOf, visibleCountersOf } from "./internal/counts.ts";
import { Render } from "./Render.ts";
import type { Status, StatusDef } from "./Status.ts";
import type { Style, TokenName } from "./Token.ts";

/**
 * A status as a document stores it: its name and its resolved definition.
 *
 * @remarks
 * The definition is stored, not the vocabulary, so a node stays plain data.
 *
 * @public
 */
export interface StatusRef {
	/** The name in the vocabulary it was resolved from. */
	readonly name: string;
	/** The resolved definition. */
	readonly def: StatusDef;
}

/**
 * Where a link points: a URL, or a file with an optional position.
 *
 * @public
 */
export type LinkTarget =
	| { readonly url: string }
	| { readonly file: string; readonly line?: number; readonly col?: number };

/**
 * Content that flows inside a line.
 *
 * @remarks
 * - `Text`: a run of text, optionally painted with a token or style.
 * - `Code`: code in a monospace span.
 * - `Link`: a labelled link to a URL or a file position.
 * - `StatusMark`: a status glyph, carrying its resolved definition.
 * - `Path`: a path or breadcrumb, joined with the audience's path separator.
 * - `Strong` and `Emphasis`: content in bold or italic; markdown `**` and `_`.
 * - `File`: a path shown through the context's `displayPath`, never linked.
 *
 * @public
 */
export type Inline =
	| { readonly _tag: "Text"; readonly value: string; readonly token?: TokenName | Style }
	| { readonly _tag: "Code"; readonly value: string }
	| {
			readonly _tag: "Link";
			readonly target: LinkTarget;
			readonly label: ReadonlyArray<Inline>;
			/**
			 * Whether plain text (and `ansi` with links off, and markdown with no URL) follows the label with the target in
			 * parentheses. Unset, it does so only when the label does not already show the target's display form.
			 */
			readonly suffix?: boolean;
	  }
	| { readonly _tag: "StatusMark"; readonly name: string; readonly def: StatusDef }
	| { readonly _tag: "Path"; readonly segments: ReadonlyArray<string> }
	| { readonly _tag: "Strong"; readonly content: ReadonlyArray<Inline> }
	| { readonly _tag: "Emphasis"; readonly content: ReadonlyArray<Inline> }
	| { readonly _tag: "File"; readonly path: string };

/**
 * A node of a {@link TreeNode} tree: a label and its children.
 *
 * @public
 */
export interface TreeNode {
	/** What the node says. */
	readonly label: ReadonlyArray<Inline>;
	/** Its children, in order. */
	readonly children: ReadonlyArray<TreeNode>;
}

/**
 * One column of a table.
 *
 * @public
 */
export interface Column {
	/** The header cell. */
	readonly header: ReadonlyArray<Inline>;
	/** How the column's cells align; left when unset. */
	readonly align?: "left" | "right" | "center";
}

/**
 * One counter of a `Counts` block.
 *
 * @public
 */
export interface Counter {
	/** A stable identifier, for a caller's total rule. */
	readonly key: string;
	/**
	 * What the counter is called when shown: one label, or a singular and a plural form, `one` for a count of exactly 1
	 * and `other` for any other, 0 included. The count is the counter's own `n`, except in a share headline
	 * (`1/3 repos`), which reads by the total. A `CountsTable` heads its column with `other`, since the column holds
	 * every row's count.
	 */
	readonly label: string | { readonly one: string; readonly other: string };
	/** The count. */
	readonly n: number;
	/** The status the count is painted with. */
	readonly status: StatusRef;
	/** Show the counter when `n` is zero; by default a zero counter is hidden. */
	readonly showZero?: boolean;
}

/**
 * A block of a document.
 *
 * @remarks
 * - `Paragraph`: one logical line; a paragraph of paragraphs is a `Section`.
 * - `List` and `Table`: with an optional `cap` on the rows shown, and an `overflow` that says what the hidden rows
 *   amount to, given how many there are.
 * - `Tree`: nested labels.
 * - `Collapsible`: a titled body a renderer may fold.
 * - `Callout`: a body with a kind.
 * - `CodeBlock`: preformatted text, with an optional language.
 * - `Diff`: expected against received text, with an optional cap on the lines shown.
 * - `Section`: children under an optional title.
 * - `Counts`: labelled counters in one of three layouts. `total` replaces the default sum of every counter, and
 *   `durationMs` is how long it took. `share: false` drops the headline's share of the total, and `paint` limits what
 *   is painted.
 * - `Verbatim`: lines kept exactly, each indented, never wrapped.
 * - `CountsTable`: a table of `Counts` rows, a column per counter key, a `duration` column when some row has one, and
 *   an optional summed total row.
 * - `Lines`: one line per entry; markdown keeps them apart with hard breaks.
 * - `Line`: one line, which `truncate` cuts to the width instead of wrapping, and `wrap: false` keeps whole.
 * - `DiffText`: a unified diff, as given; `truncate` cuts each line to the width.
 * - A `List` may be `compact`, with no blank lines between an item's children (a blank line of an item's own content
 *   keeps the item's indent in plain and `ansi`), and a `Table` may be `style: "pipe"`.
 * - `Annotation`: a GitHub Actions annotation, which only `Render.githubLog` writes.
 *
 * Nodes are plain data and nothing decodes them, so a function field such as `overflow` or `total` is fine.
 *
 * @public
 */
export type Block =
	| { readonly _tag: "Heading"; readonly level: 1 | 2 | 3 | 4; readonly content: ReadonlyArray<Inline> }
	| { readonly _tag: "Paragraph"; readonly content: ReadonlyArray<Inline> }
	| {
			readonly _tag: "List";
			readonly items: ReadonlyArray<Block>;
			readonly cap?: number;
			readonly overflow?: (hidden: number) => ReadonlyArray<Inline>;
			readonly compact?: boolean;
	  }
	| {
			readonly _tag: "Table";
			readonly columns: ReadonlyArray<Column>;
			readonly rows: ReadonlyArray<ReadonlyArray<ReadonlyArray<Inline>>>;
			readonly cap?: number;
			readonly overflow?: (hidden: number) => ReadonlyArray<Inline>;
			readonly style?: "pipe";
	  }
	| { readonly _tag: "Tree"; readonly root: TreeNode }
	| {
			readonly _tag: "Collapsible";
			readonly title: ReadonlyArray<Inline>;
			readonly body: ReadonlyArray<Block>;
			readonly open?: boolean;
	  }
	| {
			readonly _tag: "Callout";
			readonly kind: "note" | "tip" | "important" | "warning" | "caution";
			readonly body: ReadonlyArray<Block>;
	  }
	| { readonly _tag: "CodeBlock"; readonly lang?: string; readonly text: string }
	| { readonly _tag: "Diff"; readonly expected: string; readonly received: string; readonly cap?: number }
	| { readonly _tag: "Section"; readonly title?: ReadonlyArray<Inline>; readonly children: ReadonlyArray<Block> }
	| {
			readonly _tag: "Counts";
			readonly label?: ReadonlyArray<Inline>;
			readonly counters: ReadonlyArray<Counter>;
			readonly total?: (counters: ReadonlyArray<Counter>) => number;
			readonly qualifier?: ReadonlyArray<Inline>;
			readonly durationMs?: number;
			readonly layout: "inline" | "columns" | "row";
			readonly share?: boolean;
			readonly paint?: "all" | "glyph" | "none";
			readonly suffix?: ReadonlyArray<Inline>;
	  }
	| {
			readonly _tag: "CountsTable";
			readonly rows: ReadonlyArray<CountsRow>;
			readonly totalRow?: boolean | ReadonlyArray<Inline>;
			readonly labelHeader?: ReadonlyArray<Inline>;
			readonly durationHeader?: ReadonlyArray<Inline>;
	  }
	| { readonly _tag: "Lines"; readonly lines: ReadonlyArray<ReadonlyArray<Inline>> }
	| {
			readonly _tag: "Line";
			readonly content: ReadonlyArray<Inline>;
			readonly truncate?: boolean;
			readonly wrap?: boolean;
	  }
	| { readonly _tag: "DiffText"; readonly text: string; readonly cap?: number; readonly truncate?: boolean }
	| { readonly _tag: "Verbatim"; readonly text: string; readonly indent?: number }
	| ({ readonly _tag: "Annotation"; readonly message: string } & AnnotationOptions);

/**
 * Where and how a GitHub Actions annotation is shown: its level, and an optional position and title.
 *
 * @public
 */
export interface AnnotationOptions {
	/** `error`, `warning` or `notice`. */
	readonly level: "error" | "warning" | "notice";
	/** The file it points at, as the runner should show it (relative to the workspace). */
	readonly file?: string;
	/** The line it starts on. */
	readonly line?: number;
	/** The column it starts at. */
	readonly col?: number;
	/** The line it ends on. */
	readonly endLine?: number;
	/** The column it ends at. */
	readonly endColumn?: number;
	/** Its title. */
	readonly title?: string;
}

/**
 * One row of a `CountsTable`: its label, its counters and how long it took.
 *
 * @public
 */
export interface CountsRow {
	/** What the row is, such as a project name. */
	readonly label: ReadonlyArray<Inline>;
	/** Its counters; their keys pick the column each lands in. */
	readonly counters: ReadonlyArray<Counter>;
	/** How long it took, in milliseconds, shown with `Fmt.duration` in the duration column. */
	readonly durationMs?: number;
}

/**
 * The options of {@link Doc.countsTable}.
 *
 * @public
 */
export interface CountsTableOptions {
	/** A last row summing each column: labelled with a plain `Total` when `true`, or with the content given (`Doc.strong("Total")` for a bold one). */
	readonly totalRow?: boolean | InlineInput;
	/** The header of the label column, such as `Project`; empty when unset. */
	readonly labelHeader?: InlineInput;
	/** The header of the duration column, shown only when some row has a `durationMs`; `duration` when unset. */
	readonly durationHeader?: InlineInput;
}

/**
 * Options for {@link Doc.list}.
 *
 * @public
 */
export interface ListOptions extends OverflowOptions {
	/** No blank lines between the children of an item, such as a section's title and body. */
	readonly compact?: boolean;
}

/**
 * Options for {@link Doc.table}.
 *
 * @public
 */
export interface TableOptions extends OverflowOptions {
	/**
	 * `pipe` gives plain and `ansi` istanbul's shape: rules above and below the header and at the end, cells joined
	 * with ` | `. Markdown's table is a pipe table either way. Unset, the columns are space-aligned.
	 */
	readonly style?: "pipe";
}

/**
 * Options for `Doc.link`.
 *
 * @public
 */
export interface LinkOptions {
	/**
	 * Whether the target follows the label in parentheses where a link cannot be followed: plain text, `ansi` with
	 * links off, markdown with no URL. `true` always, `false` never; unset, only when the label does not already show
	 * the target's display form (`displayPath(file)`, then `:line` and `:col` when present).
	 */
	readonly suffix?: boolean;
}

/**
 * A whole document: its blocks, in order.
 *
 * @public
 */
export type Document = ReadonlyArray<Block>;

/**
 * What a constructor accepts for content: a string, one `Inline`, or an array of either.
 *
 * @remarks
 * A string becomes a `Text` node with no token.
 *
 * @public
 */
export type InlineInput = string | Inline | ReadonlyArray<string | Inline>;

/**
 * A tree node as a constructor accepts it: the label may be a string and `children` may be left out.
 *
 * @public
 */
export interface TreeInput {
	/** What the node says. */
	readonly label: InlineInput;
	/** Its children; none when omitted. */
	readonly children?: ReadonlyArray<TreeInput>;
}

/**
 * The inline node with a given `_tag`, so a constructor can return its precise type.
 *
 * @public
 */
export type InlineOf<Tag extends Inline["_tag"]> = Extract<Inline, { readonly _tag: Tag }>;

/**
 * The block node with a given `_tag`, so a constructor can return its precise type.
 *
 * @public
 */
export type BlockOf<Tag extends Block["_tag"]> = Extract<Block, { readonly _tag: Tag }>;

/**
 * The cap and overflow options of a list or table.
 *
 * @public
 */
export interface OverflowOptions {
	/** The most rows to show; the renderer hides the rest. */
	readonly cap?: number;
	/** Says what the hidden rows amount to, given how many there are; it is a function and is never serialised. */
	readonly overflow?: (hidden: number) => InlineInput;
}

/**
 * The options of {@link Doc.counts}.
 *
 * @public
 */
export interface CountsOptions {
	/** A leading label. */
	readonly label?: InlineInput;
	/** The counters, in the order they are shown. */
	readonly counters: ReadonlyArray<Counter>;
	/** Replaces the default total, the sum of `n` over every counter, for example to fold timed-out runs in. */
	readonly total?: (counters: ReadonlyArray<Counter>) => number;
	/** Text after the counters, such as `(1 flaky)`. */
	readonly qualifier?: InlineInput;
	/** How long it took, in milliseconds. */
	readonly durationMs?: number;
	/** How the counters are laid out. */
	readonly layout: "inline" | "columns" | "row";
	/** Whether the first counter shows its share of the total, `n/total`; `true` by default. `false` shows `n label`. */
	readonly share?: boolean;
	/**
	 * What is painted: `all` (the default) paints the counters, the label, the qualifier and the duration; `glyph`
	 * paints only a status glyph, if one is shown; `none` paints nothing.
	 */
	readonly paint?: "all" | "glyph" | "none";
	/** Text after the duration, such as `across 3 files`. */
	readonly suffix?: InlineInput;
}

const isList = (input: InlineInput): input is ReadonlyArray<string | Inline> => Array.isArray(input);

const freeze = <A extends object>(value: A): Readonly<A> => Object.freeze(value);

const frozenArray = <A>(items: ReadonlyArray<A>): ReadonlyArray<A> => Object.freeze([...items]);

const text = (value: string, token?: TokenName | Style): InlineOf<"Text"> =>
	freeze({ _tag: "Text", value, ...(token === undefined ? {} : { token }) });

const inlineOne = (part: string | Inline): Inline => (typeof part === "string" ? text(part) : part);

const inlines = (input: InlineInput): ReadonlyArray<Inline> =>
	frozenArray(isList(input) ? input.map(inlineOne) : [inlineOne(input)]);

const overflowOf =
	(overflow: (hidden: number) => InlineInput): ((hidden: number) => ReadonlyArray<Inline>) =>
	(hidden) =>
		inlines(overflow(hidden));

const overflowFields = (options: OverflowOptions | undefined) => ({
	...(options?.cap === undefined ? {} : { cap: options.cap }),
	...(options?.overflow === undefined ? {} : { overflow: overflowOf(options.overflow) }),
});

const treeNode = (input: TreeInput): TreeNode =>
	freeze({ label: inlines(input.label), children: frozenArray((input.children ?? []).map(treeNode)) });

const counterOf = (counter: Counter): Counter =>
	freeze({
		...counter,
		label:
			typeof counter.label === "string"
				? counter.label
				: freeze({ one: counter.label.one, other: counter.label.other }),
		status: freeze({ name: counter.status.name, def: freeze({ ...counter.status.def }) }),
	});

/**
 * Options for {@link Doc.print}.
 *
 * @public
 */
export interface DocPrintOptions {
	/** The stream to write to; `stdout` by default. */
	readonly stream?: "stdout" | "stderr" | undefined;
	/**
	 * The renderer. `auto`, the default, is chosen from the audience: `plain` for an agent, `githubLog` for a CI
	 * that `CurrentRuntimeEnv` says is GitHub Actions and `plain` for any other, and `ansi` for a human.
	 */
	readonly format?: "auto" | "plain" | "ansi" | "markdown" | "githubLog" | undefined;
	/** Turns an absolute path into its display form, for example relative to the workspace; see `Render.context`. */
	readonly displayPath?: ((absolute: string) => string) | undefined;
	/** The display columns to lay out at, replacing the audience's default; see `Render.context`. */
	readonly width?: number | undefined;
}

/**
 * Constructors for the document IR, and two helpers a renderer shares.
 *
 * @remarks
 * Every constructor returns a frozen node and copies the arrays it is given, so editing an input afterwards
 * cannot change a document. An optional field that is not given is absent from the node, not `undefined`.
 * Content arguments accept a string, an `Inline` or an array of either.
 *
 * A node is plain data: nothing decodes or encodes one, so a function field such as `overflow` or `total` is fine
 * and a document is not meant to be serialised.
 *
 * Freezing covers what a `Doc` constructor builds. A literal you write by hand is not frozen, and a `Style` object
 * given as a token is shared by reference (the freeze of a status definition is shallow for the same reason).
 *
 * @example
 * ```ts
 * import { Doc, Status } from "./index.ts"
 *
 * const report = [
 * 	Doc.heading(2, "Results"),
 * 	Doc.paragraph(Doc.status(Status.core, "success"), " ", "3 checks passed"),
 * 	Doc.table([{ header: "Check" }, { header: "Time", align: "right" }], [["lint", "1.2s"]]),
 * ]
 * // Written for whoever is reading: `yield* Doc.print(report)`
 * ```
 *
 * @public
 */
export class Doc {
	private constructor() {}

	/**
	 * A run of text.
	 *
	 * @param value - the text
	 * @param token - a semantic token or a style to paint it with
	 */
	static text(value: string, token?: TokenName | Style): InlineOf<"Text"> {
		return text(value, token);
	}

	/**
	 * Code in a monospace span.
	 *
	 * @param value - the code
	 */
	static code(value: string): InlineOf<"Code"> {
		return freeze({ _tag: "Code", value });
	}

	/**
	 * A link to a URL or a file position.
	 *
	 * @param target - `{ url }` or `{ file, line?, col? }`
	 * @param label - what the link says; when omitted, the bare URL or file path, which leaves out `line` and `col`
	 * @param options - `suffix`, whether the target follows the label where the link cannot be followed
	 */
	static link(target: LinkTarget, label?: InlineInput, options?: LinkOptions): InlineOf<"Link">;
	/**
	 * A link when there is a target, and its label alone when there is none: a string label as a `Text`, any other
	 * inline as itself.
	 *
	 * @param target - `{ url }`, `{ file, line?, col? }`, or `undefined` for no link
	 * @param label - what the link says
	 * @param options - `suffix`, whether the target follows the label where the link cannot be followed
	 */
	static link(target: LinkTarget | undefined, label: string | Inline, options?: LinkOptions): Inline;
	static link(target: LinkTarget | undefined, label?: InlineInput, options?: LinkOptions): InlineInput | undefined {
		if (target === undefined) return typeof label === "string" ? text(label) : label;
		const fallback = "url" in target ? target.url : target.file;
		return freeze<InlineOf<"Link">>({
			_tag: "Link",
			target: freeze({ ...target }),
			label: inlines(label ?? fallback),
			...(options?.suffix === undefined ? {} : { suffix: options.suffix }),
		});
	}

	/**
	 * A status glyph, holding the resolved definition.
	 *
	 * @remarks
	 * A name the vocabulary does not have is a compile error.
	 *
	 * @param vocab - the vocabulary the name belongs to
	 * @param name - a status name in it
	 */
	static status<N extends string>(vocab: Status<N>, name: NoInfer<N>): InlineOf<"StatusMark"> {
		return freeze({ _tag: "StatusMark", name, def: vocab.resolve(name) });
	}

	/**
	 * Content in bold: markdown `**…**`, bold in `ansi`, and the content as is in plain and `githubLog`.
	 *
	 * @param content - any number of strings, inlines or arrays of them, in order
	 */
	static strong(...content: Array<InlineInput>): InlineOf<"Strong"> {
		return freeze({ _tag: "Strong", content: inlines(content.flatMap((part) => (isList(part) ? part : [part]))) });
	}

	/**
	 * Content in italic: markdown `*…*` (which GFM reads inside a word too), italic in `ansi`, and the content as is in
	 * plain and `githubLog`.
	 *
	 * @param content - any number of strings, inlines or arrays of them, in order
	 */
	static em(...content: Array<InlineInput>): InlineOf<"Emphasis"> {
		return freeze({ _tag: "Emphasis", content: inlines(content.flatMap((part) => (isList(part) ? part : [part]))) });
	}

	/**
	 * A file path, shown through the context's `displayPath` and never linked.
	 *
	 * @param path - the path, usually absolute
	 */
	static file(path: string): InlineOf<"File"> {
		return freeze({ _tag: "File", path });
	}

	/**
	 * A path or breadcrumb; a renderer joins the segments with the audience's separator.
	 *
	 * @param segments - the segments, in order
	 */
	static path(...segments: Array<string>): InlineOf<"Path"> {
		return freeze({ _tag: "Path", segments: frozenArray(segments) });
	}

	/**
	 * A heading.
	 *
	 * @param level - 1 to 4
	 * @param content - the heading text
	 */
	static heading(level: 1 | 2 | 3 | 4, content: InlineInput): BlockOf<"Heading"> {
		return freeze({ _tag: "Heading", level, content: inlines(content) });
	}

	/**
	 * One logical line of content.
	 *
	 * @param content - any number of strings, inlines or arrays of them, in order
	 */
	static paragraph(...content: Array<InlineInput>): BlockOf<"Paragraph"> {
		return freeze({ _tag: "Paragraph", content: inlines(content.flatMap((part) => (isList(part) ? part : [part]))) });
	}

	/**
	 * A list of blocks.
	 *
	 * @param items - the items
	 * @param options - `cap`, `overflow`, and `compact` for no blank lines inside an item
	 */
	static list(items: ReadonlyArray<Block>, options?: ListOptions): BlockOf<"List"> {
		return freeze({
			_tag: "List",
			items: frozenArray(items),
			...overflowFields(options),
			...(options?.compact === undefined ? {} : { compact: options.compact }),
		});
	}

	/**
	 * A table.
	 *
	 * @param columns - the columns: a header and an optional alignment each
	 * @param rows - the rows; each cell takes a string, an inline or an array of either
	 * @param options - `cap`, `overflow`, and `style: "pipe"` for istanbul's shape in plain and `ansi`
	 */
	static table(
		columns: ReadonlyArray<{ readonly header: InlineInput; readonly align?: "left" | "right" | "center" }>,
		rows: ReadonlyArray<ReadonlyArray<InlineInput>>,
		options?: TableOptions,
	): BlockOf<"Table"> {
		return freeze({
			_tag: "Table",
			columns: frozenArray(
				columns.map((column) =>
					freeze({ header: inlines(column.header), ...(column.align === undefined ? {} : { align: column.align }) }),
				),
			),
			rows: frozenArray(rows.map((row) => frozenArray(row.map(inlines)))),
			...overflowFields(options),
			...(options?.style === undefined ? {} : { style: options.style }),
		});
	}

	/**
	 * A tree of labels.
	 *
	 * @param root - the root; a node's `children` may be left out
	 */
	static tree(root: TreeInput): BlockOf<"Tree"> {
		return freeze({ _tag: "Tree", root: treeNode(root) });
	}

	/**
	 * A titled body a renderer may fold.
	 *
	 * @param title - the title
	 * @param body - the body
	 * @param options - `open` asks for it to start unfolded
	 */
	static collapsible(
		title: InlineInput,
		body: ReadonlyArray<Block>,
		options?: { readonly open?: boolean },
	): BlockOf<"Collapsible"> {
		return freeze({
			_tag: "Collapsible",
			title: inlines(title),
			body: frozenArray(body),
			...(options?.open === undefined ? {} : { open: options.open }),
		});
	}

	/**
	 * A callout.
	 *
	 * @param kind - `note`, `tip`, `important`, `warning` or `caution`
	 * @param body - the body
	 */
	static callout(
		kind: "note" | "tip" | "important" | "warning" | "caution",
		body: ReadonlyArray<Block>,
	): BlockOf<"Callout"> {
		return freeze({ _tag: "Callout", kind, body: frozenArray(body) });
	}

	/**
	 * Preformatted text.
	 *
	 * @param text - the text
	 * @param lang - its language, for a renderer that fences it
	 */
	static codeBlock(text: string, lang?: string): BlockOf<"CodeBlock"> {
		return freeze({ _tag: "CodeBlock", ...(lang === undefined ? {} : { lang }), text });
	}

	/**
	 * Expected against received text.
	 *
	 * @param expected - the expected text
	 * @param received - the received text
	 * @param options - `cap` limits the lines shown
	 */
	static diff(expected: string, received: string, options?: { readonly cap?: number }): BlockOf<"Diff"> {
		return freeze({
			_tag: "Diff",
			expected,
			received,
			...(options?.cap === undefined ? {} : { cap: options.cap }),
		});
	}

	/**
	 * Children under an optional title.
	 *
	 * @remarks
	 * The children are separated by blank lines (unless the document is compact); a title sits directly above the first.
	 * `Doc.section(undefined, blocks)` is the way to space a document's top-level blocks, which are otherwise joined with
	 * no blank line.
	 *
	 * @param title - the title, or `undefined` for none
	 * @param children - the blocks
	 */
	static section(title: InlineInput | undefined, children: ReadonlyArray<Block>): BlockOf<"Section"> {
		return freeze({
			_tag: "Section",
			...(title === undefined ? {} : { title: inlines(title) }),
			children: frozenArray(children),
		});
	}

	/**
	 * One counter of a `Counts` block, with its status definition resolved.
	 *
	 * @remarks
	 * A name the vocabulary does not have is a compile error.
	 *
	 * The label is one string, or `{ one, other }` to pluralise by count: `one` when the count is exactly 1 and `other`
	 * for every other count, 0 included. A count standing alone reads by its own `n` (`1 change`, `2 changes`); a
	 * headline shown as a share of the total reads by that total, the noun it counts (`1/1 repo`, `1/3 repos`,
	 * `2/3 repos`).
	 *
	 * @param vocab - the vocabulary the status belongs to
	 * @param name - a status name in it
	 * @param options - the counter's `key`, its `label` (one string, or `{ one, other }`), its count `n`, and `showZero`
	 * to keep it when `n` is zero
	 */
	static counter<N extends string>(
		vocab: Status<N>,
		name: NoInfer<N>,
		options: {
			readonly key: string;
			readonly label: string | { readonly one: string; readonly other: string };
			readonly n: number;
			readonly showZero?: boolean;
		},
	): Counter {
		return counterOf({
			key: options.key,
			label: options.label,
			n: options.n,
			status: { name, def: vocab.resolve(name) },
			...(options.showZero === undefined ? {} : { showZero: options.showZero }),
		});
	}

	/**
	 * Counters in one of three layouts.
	 *
	 * @param options - the counters, the layout and the optional label, total rule, qualifier and duration
	 */
	static counts(options: CountsOptions): BlockOf<"Counts"> {
		return freeze({
			_tag: "Counts",
			...(options.label === undefined ? {} : { label: inlines(options.label) }),
			counters: frozenArray(options.counters.map(counterOf)),
			...(options.total === undefined ? {} : { total: options.total }),
			...(options.qualifier === undefined ? {} : { qualifier: inlines(options.qualifier) }),
			...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
			layout: options.layout,
			...(options.share === undefined ? {} : { share: options.share }),
			...(options.paint === undefined ? {} : { paint: options.paint }),
			...(options.suffix === undefined ? {} : { suffix: inlines(options.suffix) }),
		});
	}

	/**
	 * Counters as a table: a row per entry, a column per counter key (in the order the keys first appear, headed by
	 * the counter's label), and an optional total row summing each column.
	 *
	 * @remarks
	 * A row without a counter for some key leaves that cell empty, and it counts as zero in the total. A counter whose
	 * `n` is zero shows `0`, as a `Doc.table` cell would: a counter's `showZero` has no effect in a table, only in a
	 * `Counts` block, so there is no need to set it. `totalRow`
	 * labels the total row with a plain `Total` when `true`, or with the content given: for a bold one, pass
	 * `totalRow: Doc.strong("Total")`. A column is headed by its counter's `label`; a counter's status paints its cells
	 * in `ansi` and is ignored in markdown, so a plain numbers table may pass any status. `labelHeader` heads the label column, which
	 * is otherwise empty. When some row has a `durationMs`, a last column shows it with `Fmt.duration`, headed
	 * `durationHeader` (`duration` by default); a row without one has an empty cell there and counts as zero in the
	 * total row's summed duration.
	 *
	 * @param rows - each row's label, counters and optional duration
	 * @param options - `totalRow`, to add the summed row; the label and duration column headers
	 */
	static countsTable(
		rows: ReadonlyArray<{
			readonly label: InlineInput;
			readonly counters: ReadonlyArray<Counter>;
			readonly durationMs?: number;
		}>,
		options?: CountsTableOptions,
	): BlockOf<"CountsTable"> {
		const totalRow = options?.totalRow;
		return freeze({
			_tag: "CountsTable",
			rows: frozenArray(
				rows.map((row) =>
					freeze({
						label: inlines(row.label),
						counters: frozenArray(row.counters.map(counterOf)),
						...(row.durationMs === undefined ? {} : { durationMs: row.durationMs }),
					}),
				),
			),
			...(totalRow === undefined ? {} : { totalRow: typeof totalRow === "boolean" ? totalRow : inlines(totalRow) }),
			...(options?.labelHeader === undefined ? {} : { labelHeader: inlines(options.labelHeader) }),
			...(options?.durationHeader === undefined ? {} : { durationHeader: inlines(options.durationHeader) }),
		});
	}

	/**
	 * Lines, one per entry, in every renderer: markdown joins them with hard breaks so they never collapse into one.
	 *
	 * @param lines - the entries; each takes a string, an inline or an array of either
	 */
	static lines(lines: ReadonlyArray<InlineInput>): BlockOf<"Lines"> {
		return freeze({ _tag: "Lines", lines: frozenArray(lines.map(inlines)) });
	}

	/**
	 * One line of content; with `truncate`, it is cut to the width with the glyph set's ellipsis instead of wrapping,
	 * and with `wrap: false` it is kept whole on one line whatever the width.
	 *
	 * @remarks
	 * By default a line longer than the width wraps. `wrap: false` keeps it atomic in every audience and renderer, still
	 * carrying its status glyphs, theme tokens and links, which {@link Doc.verbatim} (a plain string) cannot: the tool for
	 * a finding such as `✗ path:line:col  rule  message` that a reader greps or reads line by line, while the prose around
	 * it still wraps. A line break inside it is still a space. With both `truncate` and `wrap: false`, `truncate` wins:
	 * the line is cut to the width.
	 *
	 * @param content - the line
	 * @param options - `truncate`, to cut it to the width; `wrap: false`, to keep it whole
	 */
	static line(
		content: InlineInput,
		options?: { readonly truncate?: boolean; readonly wrap?: boolean },
	): BlockOf<"Line"> {
		return freeze({
			_tag: "Line",
			content: inlines(content),
			...(options?.truncate === undefined ? {} : { truncate: options.truncate }),
			...(options?.wrap === undefined ? {} : { wrap: options.wrap }),
		});
	}

	/**
	 * A unified diff as given, such as a test runner's: sanitized, its `+` and `-` lines painted `success` and
	 * `failure` in `ansi`, and a `diff` fence in markdown.
	 *
	 * @remarks
	 * With `truncate`, plain and `ansi` cut each line to the width with the glyph set's ellipsis instead of wrapping
	 * it; an agent's or a CI's width is unbounded, so nothing is cut for them unless the context gives a finite width.
	 * Markdown keeps every line whole. Inside a compact list item a blank line of the diff keeps the item's indent.
	 *
	 * A trailing line break ends the last line, as in a unified diff file, and adds no blank line after it: `"a\n"` is
	 * one line. To end on a blank line, end the text with two line breaks.
	 *
	 * @param unified - the diff
	 * @param options - `cap`, the most lines shown; `truncate`, to cut each line to the width
	 */
	static diffText(
		unified: string,
		options?: { readonly cap?: number; readonly truncate?: boolean },
	): BlockOf<"DiffText"> {
		return freeze({
			_tag: "DiffText",
			text: unified,
			...(options?.cap === undefined ? {} : { cap: options.cap }),
			...(options?.truncate === undefined ? {} : { truncate: options.truncate }),
		});
	}

	/**
	 * Lines kept exactly: each indented by `indent` spaces, sanitized, and never wrapped.
	 *
	 * @remarks
	 * Plain, `ansi` and `githubLog` write the lines as they are; markdown fences them, so the indentation survives.
	 *
	 * It is the tool for a single line that must never wrap nor be cut, whatever the width: {@link Doc.line} wraps at
	 * the width, or cuts with `truncate`, and `verbatim` does neither.
	 *
	 * @param text - the lines
	 * @param options - `indent`, the spaces in front of every line; none by default
	 */
	static verbatim(text: string, options?: { readonly indent?: number }): BlockOf<"Verbatim"> {
		return freeze({ _tag: "Verbatim", text, ...(options?.indent === undefined ? {} : { indent: options.indent }) });
	}

	/**
	 * A GitHub Actions annotation: `Render.githubLog` writes it as one workflow command (`::error file=…::message`),
	 * and every other renderer writes nothing.
	 *
	 * @remarks
	 * It is the kit's own command, so `githubLog` does not neutralize it; its message and properties are escaped, so
	 * no text in them can end the command or start another. It is a command where a line starts: at the top level, as a
	 * top-level section's child, or as a direct child of a group's body. Nested deeper, it is dropped.
	 *
	 * @param options - the level, and the optional file, position and title
	 * @param message - what it says
	 */
	static annotation(options: AnnotationOptions, message: string): BlockOf<"Annotation"> {
		return freeze({
			_tag: "Annotation",
			level: options.level,
			...(options.file === undefined ? {} : { file: options.file }),
			...(options.line === undefined ? {} : { line: options.line }),
			...(options.col === undefined ? {} : { col: options.col }),
			...(options.endLine === undefined ? {} : { endLine: options.endLine }),
			...(options.endColumn === undefined ? {} : { endColumn: options.endColumn }),
			...(options.title === undefined ? {} : { title: options.title }),
			message,
		});
	}

	/**
	 * The total of a `Counts` block: the caller's rule when it has one, otherwise the sum of `n` over every counter.
	 *
	 * @remarks
	 * The rule sees every counter, including the ones a renderer hides, so hiding never changes the total.
	 *
	 * @param block - the `Counts` block
	 */
	static total(block: BlockOf<"Counts">): number {
		return totalOf(block);
	}

	/**
	 * The counters a renderer shows: every one except a zero counter that does not ask for `showZero`.
	 *
	 * @param block - the `Counts` block
	 */
	static visibleCounters(block: BlockOf<"Counts">): ReadonlyArray<Counter> {
		return visibleCountersOf(block);
	}

	/**
	 * Render a document for whoever is running the program and write it to a stream.
	 *
	 * @remarks
	 * The context is {@link Render.context} for the stream, so the width, the colour, the links and the audience
	 * come from the services the program already has, and the text is written with `Console.log` or
	 * `Console.error`: a test captures it by swapping the `Console`. With `format: "auto"` the renderer follows
	 * the audience, and the width is unbounded for an agent, a CI, and a human whose stream is not a terminal.
	 *
	 * An agent is never written an escape of any kind, even with an explicit `format: "ansi"`: its context is
	 * colourless and its links are off. A document that renders to nothing prints nothing.
	 *
	 * The whole document is written as one `Console.log` (or `Console.error`) call, with its line breaks embedded, so a
	 * captured `Console` holds one entry per document, not one per line. Top-level blocks are joined with no blank
	 * line between them; wrap them in `Doc.section(undefined, [...])` to space them.
	 *
	 * `CurrentRuntimeEnv` is read if the environment has one and is not required: a `ci` audience prints
	 * GitHub's log format only when it says GitHub Actions, and plain text otherwise, including when it is
	 * absent. An explicit `format` is honoured whatever the audience.
	 *
	 * @param doc - the document
	 * @param options - the stream and the format
	 */
	static readonly print = (
		doc: Document,
		options?: DocPrintOptions,
	): Effect.Effect<void, never, CliTheme | TerminalEnv | Audience | CliLinks> =>
		Effect.gen(function* () {
			const stream = options?.stream ?? "stdout";
			const ctx = yield* Render.context(stream, {
				...(options?.displayPath === undefined ? {} : { displayPath: options.displayPath }),
				...(options?.width === undefined ? {} : { width: options.width }),
			});
			const requested = options?.format ?? "auto";
			const format = requested === "auto" ? yield* autoFormat(ctx.audience) : requested;
			const text = Render[format](doc, ctx);
			// An empty document prints nothing, not a blank line.
			if (text === "") return;
			yield* stream === "stderr" ? Console.error(text) : Console.log(text);
		});
}

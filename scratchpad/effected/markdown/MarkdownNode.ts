// The mdast-shaped syntax tree. Node `type` strings and field names match the
// mdast specification (https://github.com/syntax-tree/mdast) exactly — that
// shape is a contract, not an implementation detail, so a consumer can hand a
// tree to the remark ecosystem after the `Mdast` projection strips the
// fidelity extras this module carries alongside.
//
// Two deliberate departures from plain mdast:
//
// 1. Every node carries a required `position`. unist makes it optional because
//    synthesized trees have no source; here the offset-based edit layer
//    depends on it, so the schema enforces it on every decoded tree. `make`
//    alone softens the requirement: the field carries a constructor default of
//    `Position.synthetic` (the same mechanism as the `type` tag), so a
//    hand-built fragment constructs in one line while decode — the mdast
//    admission boundary — still demands a full position.
// 2. Fidelity fields (`headingStyle`, `fenceChar`, `bulletChar`, ...) ride
//    alongside the mdast fields as `optionalKey` extras. They record concrete
//    syntax mdast throws away, which lossless editing needs.
//
// All node classes live in this one module because the tree is mutually
// recursive (flow contains flow, phrasing contains phrasing) — splitting them
// per-file would close an import cycle. Recursion is broken with the
// `Schema.suspend` idiom and recursive references are typed `Schema.Codec<T>`
// (the `packages/toml/src/TomlNode.ts` precedent).
//
// Leaf module: imports only `effect`.

import { Effect, Schema } from "effect";

/**
 * A single point in a source document: 1-based `line` and `column`, 0-based
 * `offset`.
 *
 * `offset` is the index into the source string, which is what the edit layer
 * splices against; `line`/`column` are the human-facing coordinates unist
 * specifies.
 *
 * @public
 */
export class Point extends Schema.Class<Point>("Point")({
	line: Schema.Number,
	column: Schema.Number,
	offset: Schema.Number,
}) {}

/**
 * The source span of a node: `start` inclusive, `end` exclusive.
 *
 * @public
 */
export class Position extends Schema.Class<Position>("Position")({
	start: Point,
	end: Point,
}) {
	/**
	 * The zero-width synthetic position: line 1, column 1, offset 0 at both
	 * ends — the span every node class's `make` fills in when `position` is
	 * omitted, and the same sentinel `Mdast.fromMdast` synthesizes for foreign
	 * nodes that carry none.
	 *
	 * @remarks
	 * Clearly synthetic and inert for rendering: trees carrying it serve
	 * tree-level workflows (stringify, the visitor, `MarkdownFormat.modify`
	 * replacement fragments, projection out), not offset-splice editing, whose
	 * offsets must come from a real parse.
	 */
	static readonly synthetic: Position = Position.make({
		start: Point.make({ line: 1, column: 1, offset: 0 }),
		end: Point.make({ line: 1, column: 1, offset: 0 }),
	});
}

// Every node class takes `position` through this field schema: required on
// the decoded type (a parsed or decoded tree always carries a real span, so
// the mdast admission boundary is untouched) but constructor-defaulted to the
// zero-width sentinel, so a replacement fragment for `MarkdownFormat.modify`
// constructs in one line — `Text.make({ value: "shipped" })`. Constructor
// defaults apply only to `make`, never to decode or encode.
//
// A constructor-defaulted class field accepts a plain-object literal, not
// only a matching instance — `make` promotes a literal to real
// `Position`/`Point` instances, pinned by __test__/frontmatter.test.ts's
// "make accepts a plain-object position and promotes it to instances".
//
// An ALREADY-CONSTRUCTED `Position` instance passed as `position` is passed
// through by reference (`Text.make({ position: p }).position === p`); a
// plain literal is always promoted to a fresh instance instead. Nothing here
// depends on which happened — `Position` is an immutable value class with
// structural equality — but never assert a synthesized node's position by
// reference; use `deepStrictEqual`/`Equal.equals`.
const NodePosition = Position.pipe(Schema.withConstructorDefault(Effect.succeed(Position.synthetic)));

/**
 * The explicitness of a reference, per mdast's `referenceType` enum.
 *
 * - `shortcut` — implicit, identifier inferred from the content (`[foo]`).
 * - `collapsed` — explicit, identifier inferred from the content (`[foo][]`).
 * - `full` — explicit, identifier explicitly set (`[foo][bar]`).
 *
 * @public
 */
export const ReferenceType = Schema.Literals(["shortcut", "collapsed", "full"]);

/**
 * The union of all reference-type string literals.
 *
 * @public
 */
export type ReferenceType = typeof ReferenceType.Type;

/**
 * The two ways CommonMark spells a heading: `atx` (`# Title`) and `setext`
 * (a title underlined with `=` or `-`).
 *
 * @public
 */
export const HeadingStyle = Schema.Literals(["atx", "setext"]);

/**
 * The union of all heading-style string literals.
 *
 * @public
 */
export type HeadingStyle = typeof HeadingStyle.Type;

/**
 * The two ways CommonMark spells a hard line break: a trailing backslash or
 * two-or-more trailing spaces.
 *
 * @public
 */
export const BreakStyle = Schema.Literals(["backslash", "spaces"]);

/**
 * The union of all break-style string literals.
 *
 * @public
 */
export type BreakStyle = typeof BreakStyle.Type;

/**
 * The two fence characters a fenced code block may use.
 *
 * @public
 */
export const FenceChar = Schema.Literals(["`", "~"]);

/**
 * The union of all fence-character literals.
 *
 * @public
 */
export type FenceChar = typeof FenceChar.Type;

/**
 * The three bullet characters an unordered list may use.
 *
 * @public
 */
export const BulletChar = Schema.Literals(["-", "*", "+"]);

/**
 * The union of all bullet-character literals.
 *
 * @public
 */
export type BulletChar = typeof BulletChar.Type;

/**
 * The two delimiters an ordered list marker may use (`1.` or `1)`).
 *
 * @public
 */
export const ListDelimiter = Schema.Literals([".", ")"]);

/**
 * The union of all ordered-list delimiter literals.
 *
 * @public
 */
export type ListDelimiter = typeof ListDelimiter.Type;

/**
 * The three characters a thematic break may be drawn with.
 *
 * @public
 */
export const ThematicBreakChar = Schema.Literals(["-", "_", "*"]);

/**
 * The union of all thematic-break character literals.
 *
 * @public
 */
export type ThematicBreakChar = typeof ThematicBreakChar.Type;

/**
 * The two characters emphasis and strong emphasis may be marked with.
 *
 * @public
 */
export const EmphasisChar = Schema.Literals(["*", "_"]);

/**
 * The union of all emphasis-marker character literals.
 *
 * @public
 */
export type EmphasisChar = typeof EmphasisChar.Type;

/**
 * The six legal ATX/setext heading depths.
 *
 * @public
 */
export const HeadingDepth = Schema.Literals([1, 2, 3, 4, 5, 6]);

/**
 * The union of all legal heading depths.
 *
 * @public
 */
export type HeadingDepth = typeof HeadingDepth.Type;

/**
 * The three alignments a GFM table column may declare. A `null` entry in a
 * {@link Table}'s `align` array means the column carries no alignment.
 *
 * @public
 */
export const TableAlign = Schema.Literals(["left", "right", "center"]);

/**
 * The union of all table-alignment string literals.
 *
 * @public
 */
export type TableAlign = typeof TableAlign.Type;

// --- Phrasing content -------------------------------------------------------

/**
 * Text — a run of literal characters, with entity references and backslash
 * escapes already resolved into `value`.
 *
 * @remarks
 * `escapeStyle` is an opt-in emitter extra, the one fidelity field the
 * parser never sets: absent (or `"canonical"`), `Markdown.stringify` escapes
 * the value canonically so it re-parses to the same text. `"literal"` is the
 * caller vouching that `value` is already safe markdown source, so the
 * emitter writes it verbatim and applies no escaping aimed at inline syntax:
 * `~0.2.1`, `^1.0.0`, `some_pkg` and `@scope/pkg` come out as written, as do
 * `*`, `_`, `[`, `]`, `~`, `&`, `\`, the backtick and autolink-shaped
 * text.
 *
 * Escaping that defends the containing BLOCK'S structure still applies,
 * because its absence would corrupt the document around the text rather
 * than add formatting inside it:
 *
 * - in a table cell, every `|` not already backslash-escaped is written
 *   `\|` (a bare pipe splits the cell);
 *
 * - in any container, a value-final `\` is doubled when more content
 *   follows it (it would otherwise pair with that content's first
 *   character, escaping an inline-code backtick or freeing a cell's `\|`);
 *
 * - in a table cell or heading, a newline becomes a space (neither can
 *   hold a line break);
 *
 * - in a heading, a trailing `#` run that would read as the ATX closing
 *   sequence is escaped;
 *
 * - elsewhere, a newline that would form a blank line (ending the
 *   paragraph) becomes `&#10;`, and at every line start leading whitespace
 *   becomes a character reference, and a line start that can open a block
 *   is escaped: a `-`, `+` or `*` bullet or an ordered-list marker followed
 *   by a space, tab or line end; one to six `#` followed by the same; `>`;
 *   three or more backticks or tildes; a thematic-break or setext run
 *   (`***`, `___`, `==`); a `---` or `+++` frontmatter fence; a line of
 *   only `-`, `:`, `|` and whitespace; and, conservatively, any `<`, `[`,
 *   `|` or `:`. Text that cannot open a block there, such as `~0.2.1`,
 *   `1.0.0`, `-x` or `#x`, is written as is;
 *
 * - in a tree carrying MDX nodes, `{` and `<` stay escaped, since MDX reads
 *   a stray one as a syntax error rather than as text.
 *
 * **A literal text whose value parses as markdown does not round-trip to the
 * same value**: `*a*` emits verbatim and re-parses as emphasis. Keeping the
 * value free of inline syntax is the caller's promise, not something the
 * emitter checks. `Mdast.fromMdast` admits this field on a `text` node (it is
 * the one emitter instruction a plain tree can carry in), and `Mdast.toMdast`
 * projects it back out when present.
 *
 * @public
 */
export class Text extends Schema.Class<Text>("Text")({
	type: Schema.tag("text"),
	value: Schema.String,
	escapeStyle: Schema.optionalKey(Schema.Literals(["canonical", "literal"])),
	position: NodePosition,
}) {}

/**
 * InlineCode — a code span: `foo` written between backtick fences in the
 * source. `value` holds the span's content with the backtick fence stripped
 * and the spec's space-stripping applied.
 *
 * @public
 */
export class InlineCode extends Schema.Class<InlineCode>("InlineCode")({
	type: Schema.tag("inlineCode"),
	value: Schema.String,
	position: NodePosition,
}) {}

/**
 * Html — a fragment of raw HTML, kept verbatim. Used for both HTML blocks
 * (flow) and inline raw HTML (phrasing); the same node type serves both, as
 * mdast specifies.
 *
 * @public
 */
export class Html extends Schema.Class<Html>("Html")({
	type: Schema.tag("html"),
	value: Schema.String,
	position: NodePosition,
}) {}

/**
 * Break — a hard line break.
 *
 * `breakStyle` is a fidelity extra recording which of the two CommonMark
 * spellings produced it.
 *
 * @public
 */
export class Break extends Schema.Class<Break>("Break")({
	type: Schema.tag("break"),
	position: NodePosition,
	breakStyle: Schema.optionalKey(BreakStyle),
}) {}

/**
 * Image — an inline image (`![alt](url "title")`).
 *
 * @public
 */
export class Image extends Schema.Class<Image>("Image")({
	type: Schema.tag("image"),
	url: Schema.String,
	title: Schema.optionalKey(Schema.String),
	alt: Schema.optionalKey(Schema.String),
	position: NodePosition,
}) {}

/**
 * ImageReference — an image referring to a {@link Definition} by identifier
 * (`![alt][ref]`).
 *
 * The parser emits these unresolved, whether or not a matching definition
 * exists in the tree — resolution is the consumer's business.
 *
 * @public
 */
export class ImageReference extends Schema.Class<ImageReference>("ImageReference")({
	type: Schema.tag("imageReference"),
	identifier: Schema.String,
	label: Schema.optionalKey(Schema.String),
	referenceType: ReferenceType,
	alt: Schema.optionalKey(Schema.String),
	position: NodePosition,
}) {}

/**
 * Emphasis — `*foo*` or `_foo_`.
 *
 * `markerChar` is a fidelity extra recording which marker produced it.
 *
 * @public
 */
export class Emphasis extends Schema.Class<Emphasis>("Emphasis")({
	type: Schema.tag("emphasis"),
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
	markerChar: Schema.optionalKey(EmphasisChar),
}) {}

/**
 * Strong — `**foo**` or `__foo__`.
 *
 * `markerChar` is a fidelity extra recording which marker produced it.
 *
 * @public
 */
export class Strong extends Schema.Class<Strong>("Strong")({
	type: Schema.tag("strong"),
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
	markerChar: Schema.optionalKey(EmphasisChar),
}) {}

/**
 * Delete — GFM strikethrough (`~~foo~~`). Content that is no longer accurate
 * or relevant.
 *
 * `~~` is the only marker `~~foo~~` renders through, so unlike
 * {@link Emphasis} and {@link Strong} there is no marker-character fidelity
 * extra to carry.
 *
 * @public
 */
export class Delete extends Schema.Class<Delete>("Delete")({
	type: Schema.tag("delete"),
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
}) {}

/**
 * Link — an inline link (`[text](url "title")`), including autolinks.
 *
 * @public
 */
export class Link extends Schema.Class<Link>("Link")({
	type: Schema.tag("link"),
	url: Schema.String,
	title: Schema.optionalKey(Schema.String),
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
}) {}

/**
 * LinkReference — a link referring to a {@link Definition} by identifier
 * (`[text][ref]`).
 *
 * Emitted unresolved, on the same terms as {@link ImageReference}.
 *
 * @public
 */
export class LinkReference extends Schema.Class<LinkReference>("LinkReference")({
	type: Schema.tag("linkReference"),
	identifier: Schema.String,
	label: Schema.optionalKey(Schema.String),
	referenceType: ReferenceType,
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
}) {}

/**
 * FootnoteReference — a GFM footnote marker (`[^alpha]`), associating this
 * point in the text with a {@link FootnoteDefinition} by identifier.
 *
 * Has no content model of its own — the marker carries no children, only the
 * mdast Association pair `identifier`/`label`. Like {@link LinkReference},
 * the parser emits these unresolved: resolution against a matching
 * `FootnoteDefinition` is the consumer's business.
 *
 * @public
 */
export class FootnoteReference extends Schema.Class<FootnoteReference>("FootnoteReference")({
	type: Schema.tag("footnoteReference"),
	identifier: Schema.String,
	label: Schema.optionalKey(Schema.String),
	position: NodePosition,
}) {}

/**
 * The union of every node that may appear where mdast expects **phrasing**
 * content — the text of a document and its markup.
 *
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `PhrasingContent -> Emphasis/Strong/Link/LinkReference -> PhrasingContent`.
 *
 * @public
 */
export const PhrasingContent: Schema.Codec<PhrasingContent> = Schema.suspend(() =>
	Schema.Union([
		Break,
		Delete,
		Emphasis,
		FootnoteReference,
		Html,
		Image,
		ImageReference,
		InlineCode,
		Link,
		LinkReference,
		MdxJsxTextElement,
		MdxTextExpression,
		Strong,
		Text,
	]),
);

/**
 * The union of all phrasing-content node types. Widened for MDX with
 * {@link MdxJsxTextElement} and {@link MdxTextExpression}, per
 * mdast-util-mdx's `PhrasingContentMap` registrations — the parser never
 * produces either; they serve constructed trees.
 *
 * @public
 */
export type PhrasingContent =
	| Break
	| Delete
	| Emphasis
	| FootnoteReference
	| Html
	| Image
	| ImageReference
	| InlineCode
	| Link
	| LinkReference
	| MdxJsxTextElement
	| MdxTextExpression
	| Strong
	| Text;

// --- Flow content -----------------------------------------------------------

/**
 * ThematicBreak — a horizontal rule (`---`, `***`, `___`).
 *
 * `markerChar` is a fidelity extra recording which character drew it.
 *
 * @public
 */
export class ThematicBreak extends Schema.Class<ThematicBreak>("ThematicBreak")({
	type: Schema.tag("thematicBreak"),
	position: NodePosition,
	markerChar: Schema.optionalKey(ThematicBreakChar),
}) {}

/**
 * Code — a code block, fenced or indented.
 *
 * `lang` and `meta` split the fence's info string at the first run of
 * whitespace. The fidelity extras `fenceChar` and `fenceLength` are present
 * for fenced blocks and **absent for indented blocks** — their absence is how
 * the two are told apart on the way back out.
 *
 * A consequence worth knowing before it surprises: a language-less `Code`
 * node with no explicit `fenceChar` **serializes as an indented block**
 * through `Markdown.stringify`. To get a fence, set `fenceChar` on the node
 * (or a `lang`, which forces one), or format the emitted source with
 * `MarkdownFormattingOptions.codeBlockStyle: "fenced"`.
 *
 * @public
 */
export class Code extends Schema.Class<Code>("Code")({
	type: Schema.tag("code"),
	value: Schema.String,
	lang: Schema.optionalKey(Schema.String),
	meta: Schema.optionalKey(Schema.String),
	position: NodePosition,
	fenceChar: Schema.optionalKey(FenceChar),
	fenceLength: Schema.optionalKey(Schema.Number),
}) {}

/**
 * Definition — a link reference definition (`[ref]: /url "title"`).
 *
 * Kept in the tree at its source position rather than stripped, which is the
 * deliberate departure from commonmark.js and the reason references can stay
 * unresolved.
 *
 * @public
 */
export class Definition extends Schema.Class<Definition>("Definition")({
	type: Schema.tag("definition"),
	identifier: Schema.String,
	label: Schema.optionalKey(Schema.String),
	url: Schema.String,
	title: Schema.optionalKey(Schema.String),
	position: NodePosition,
}) {}

/**
 * FootnoteDefinition — a GFM footnote definition (`[^alpha]: bravo.`), the
 * content a {@link FootnoteReference} points at.
 *
 * Kept in the tree at its source position, on the same terms as
 * {@link Definition} — the parser never relocates it; a consumer that wants
 * cmark-gfm's end-of-document footnote section renders it there instead.
 *
 * @public
 */
export class FootnoteDefinition extends Schema.Class<FootnoteDefinition>("FootnoteDefinition")({
	type: Schema.tag("footnoteDefinition"),
	identifier: Schema.String,
	label: Schema.optionalKey(Schema.String),
	children: Schema.Array(Schema.suspend((): Schema.Codec<FlowContent> => FlowContent)),
	position: NodePosition,
}) {}

/**
 * Paragraph — a run of phrasing content.
 *
 * @public
 */
export class Paragraph extends Schema.Class<Paragraph>("Paragraph")({
	type: Schema.tag("paragraph"),
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
}) {}

/**
 * Heading — an ATX or setext heading of depth 1 to 6.
 *
 * `headingStyle` is a fidelity extra recording which spelling produced it;
 * setext headings can only be depth 1 or 2.
 *
 * @public
 */
export class Heading extends Schema.Class<Heading>("Heading")({
	type: Schema.tag("heading"),
	depth: HeadingDepth,
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
	headingStyle: Schema.optionalKey(HeadingStyle),
}) {}

/**
 * ListItem — one item of a {@link List}.
 *
 * `spread` follows mdast in being optional: absent means "not known", which a
 * hand-built tree may legitimately be. The parser always sets it.
 *
 * `checked` is a GFM extra (task-list items, `- [ ] foo` / `- [x] foo`):
 * `true` for done, `false` for not done, and **absent** — never `null` — for
 * an item that is not a task-list item at all. The parser only ever sets it
 * on items it recognized as task-list markers.
 *
 * @public
 */
export class ListItem extends Schema.Class<ListItem>("ListItem")({
	type: Schema.tag("listItem"),
	spread: Schema.optionalKey(Schema.Boolean),
	children: Schema.Array(Schema.suspend((): Schema.Codec<FlowContent> => FlowContent)),
	position: NodePosition,
	checked: Schema.optionalKey(Schema.Boolean),
}) {}

/**
 * List — an ordered or unordered list.
 *
 * `ordered`, `start` and `spread` are all optional per mdast (absent meaning
 * "not known"); the parser always sets `ordered` and `spread`, and sets
 * `start` only for ordered lists.
 *
 * The fidelity extras record the marker actually used: `bulletChar` for
 * unordered lists, `delimiter` for ordered ones.
 *
 * @public
 */
export class List extends Schema.Class<List>("List")({
	type: Schema.tag("list"),
	ordered: Schema.optionalKey(Schema.Boolean),
	start: Schema.optionalKey(Schema.Number),
	spread: Schema.optionalKey(Schema.Boolean),
	children: Schema.Array(Schema.suspend((): Schema.Codec<ListContent> => ListContent)),
	position: NodePosition,
	bulletChar: Schema.optionalKey(BulletChar),
	delimiter: Schema.optionalKey(ListDelimiter),
}) {}

/**
 * Blockquote — a section quoted from somewhere else.
 *
 * @public
 */
export class Blockquote extends Schema.Class<Blockquote>("Blockquote")({
	type: Schema.tag("blockquote"),
	children: Schema.Array(Schema.suspend((): Schema.Codec<FlowContent> => FlowContent)),
	position: NodePosition,
}) {}

/**
 * TableCell — one cell of a {@link TableRow}: a header cell if its
 * grandparent {@link Table}'s first row, a data cell otherwise.
 *
 * mdast's content model for `TableCell` is phrasing content **excluding**
 * `Break` nodes — GFM tables are single-line source, so a hard break cannot
 * occur inside one. This schema does not carve that exclusion out of
 * `PhrasingContent`: a second phrasing union just for table cells would
 * duplicate the whole recursive-suspend machinery above for one excluded
 * member, and a parser that never emits `Break` inside a cell satisfies the
 * exclusion in practice without it.
 *
 * @public
 */
export class TableCell extends Schema.Class<TableCell>("TableCell")({
	type: Schema.tag("tableCell"),
	children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
	position: NodePosition,
}) {}

/**
 * The union of every node that may appear where mdast expects **row**
 * content — the cells in a {@link TableRow}. A one-member union, kept because
 * mdast names the category.
 *
 * A REAL `Schema.Union`, not a bare suspended class reference. `make` passes
 * an already-constructed class instance through a nested class-typed field
 * by reference regardless of whether the field is a plain class type or —
 * as here — wrapped in a `Schema.Union`, so the wrapper buys no
 * construction-cost advantage over the bare member class. It is kept
 * because mdast names the category: the `children` fields of `TableRow`,
 * `Table` and `List` point at these category unions to mirror mdast's
 * content-model vocabulary, not for a performance reason.
 *
 * @public
 */
export const RowContent: Schema.Codec<RowContent> = Schema.suspend(() => Schema.Union([TableCell]));

/**
 * The union of all row-content node types.
 *
 * @public
 */
export type RowContent = TableCell;

/**
 * TableRow — one row of a {@link Table}: the labels of the columns if it is
 * the table's first row, a data row otherwise.
 *
 * @public
 */
export class TableRow extends Schema.Class<TableRow>("TableRow")({
	type: Schema.tag("tableRow"),
	children: Schema.Array(Schema.suspend((): Schema.Codec<RowContent> => RowContent)),
	position: NodePosition,
}) {}

/**
 * The union of every node that may appear where mdast expects **table**
 * content — the rows in a {@link Table}. A one-member union, kept because
 * mdast names the category — and a real `Schema.Union` for the construction
 * pass-through documented on `RowContent`.
 *
 * @public
 */
export const TableContent: Schema.Codec<TableContent> = Schema.suspend(() => Schema.Union([TableRow]));

/**
 * The union of all table-content node types.
 *
 * @public
 */
export type TableContent = TableRow;

/**
 * Table — GFM two-dimensional data.
 *
 * `align` is optional per mdast: absent means "not known" — which the parser
 * never produces, since a GFM table's delimiter row always yields one
 * `TableAlign | null` entry per column, but a hand-built tree may omit it.
 * When present, each entry is `null` for a column with no declared alignment.
 *
 * @public
 */
export class Table extends Schema.Class<Table>("Table")({
	type: Schema.tag("table"),
	align: Schema.optionalKey(Schema.Array(Schema.NullOr(TableAlign))),
	children: Schema.Array(Schema.suspend((): Schema.Codec<TableContent> => TableContent)),
	position: NodePosition,
}) {}

/**
 * The union of every node that may appear where mdast expects **flow**
 * content — the sections of a document.
 *
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `FlowContent -> Blockquote/List -> FlowContent`. Widened for GFM with
 * {@link FootnoteDefinition} and {@link Table}, per mdast's `FlowContent`
 * (GFM) category.
 *
 * @public
 */
export const FlowContent: Schema.Codec<FlowContent> = Schema.suspend(() =>
	Schema.Union([
		Blockquote,
		Code,
		Definition,
		FootnoteDefinition,
		Heading,
		Html,
		List,
		MdxFlowExpression,
		MdxJsxFlowElement,
		Paragraph,
		Table,
		ThematicBreak,
	]),
);

/**
 * The union of all flow-content node types. Includes mdast's `Content`
 * category (`Definition | Paragraph`) inline, as the spec's `FlowContent`
 * definition does, the GFM extras `FootnoteDefinition` and `Table`, and the
 * MDX extras {@link MdxJsxFlowElement} and {@link MdxFlowExpression} per
 * mdast-util-mdx's `BlockContentMap` registrations — the parser never
 * produces the MDX members; they serve constructed trees.
 *
 * @public
 */
export type FlowContent =
	| Blockquote
	| Code
	| Definition
	| FootnoteDefinition
	| Heading
	| Html
	| List
	| MdxFlowExpression
	| MdxJsxFlowElement
	| Paragraph
	| Table
	| ThematicBreak;

/**
 * The union of every node that may appear where mdast expects **list**
 * content. A one-member union, kept because mdast names the category and
 * later dialects widen it — and a real `Schema.Union` for the construction
 * pass-through documented on `RowContent`.
 *
 * @public
 */
export const ListContent: Schema.Codec<ListContent> = Schema.suspend(() => Schema.Union([ListItem]));

/**
 * The union of all list-content node types.
 *
 * @public
 */
export type ListContent = ListItem;

// --- MDX --------------------------------------------------------------------
//
// The MDX node vocabulary, shaped exactly to the mdast-util-mdx contracts
// (mdast-util-mdx-jsx@3.2.0, mdast-util-mdx-expression@2.0.1,
// mdast-util-mdxjs-esm@2.0.1 — the vendored serialization oracles): the JSX
// element pair with their attribute carriers, the expression pair and the ESM
// node. The parser NEVER produces these — MDX syntax is not parsed (a `<` or
// `{` in source stays CommonMark text/HTML) — they exist for construction and
// serialization: synthesize a tree carrying them and `Markdown.stringify`
// emits valid MDX. The ecosystem's `data.estree` compiler annotation is
// deliberately NOT modeled: this package has no estree vocabulary,
// serialization never consults it, and the `Mdast` admission boundary drops
// it silently the way it drops every foreign `data` field.

/**
 * MdxJsxAttributeValueExpression — a JSX attribute value written as an
 * expression (`<a b={c} />`); `value` holds the expression source text
 * between the braces, never evaluated or parsed.
 *
 * The primary construction path is a JSON-encoded prop:
 * `MdxJsxAttributeValueExpression.make({ value: JSON.stringify(props) })`.
 *
 * @public
 */
export class MdxJsxAttributeValueExpression extends Schema.Class<MdxJsxAttributeValueExpression>(
	"MdxJsxAttributeValueExpression",
)({
	type: Schema.tag("mdxJsxAttributeValueExpression"),
	value: Schema.String,
	position: NodePosition,
}) {}

/**
 * MdxJsxAttribute — a named JSX attribute (`<a b="c" />`). `value` is a
 * string literal, a {@link MdxJsxAttributeValueExpression}, or — for a
 * boolean attribute (`<a b />`) — absent or `null`, both of which the
 * mdast-util-mdx-jsx contract spells (its parser writes `null`; absence is
 * the constructed-tree spelling). The serializer treats the two identically.
 *
 * `name` must be non-empty — an attribute without a name has no MDX spelling,
 * so the schema refuses it at construction and decode (the oracle's
 * serialize-time crash, moved to the admission boundary).
 *
 * @public
 */
export class MdxJsxAttribute extends Schema.Class<MdxJsxAttribute>("MdxJsxAttribute")(
	Schema.Struct({
		type: Schema.tag("mdxJsxAttribute"),
		name: Schema.String,
		value: Schema.optionalKey(Schema.NullOr(Schema.Union([MdxJsxAttributeValueExpression, Schema.String]))),
		position: NodePosition,
	}).pipe(
		Schema.check(
			Schema.makeFilter((attribute) =>
				attribute.name.length === 0 ? "an MDX JSX attribute requires a non-empty name" : undefined,
			),
		),
	),
) {}

/**
 * MdxJsxExpressionAttribute — a JSX attribute written whole as an expression
 * (`<a {...b} />`); `value` holds the expression source text between the
 * braces.
 *
 * @public
 */
export class MdxJsxExpressionAttribute extends Schema.Class<MdxJsxExpressionAttribute>("MdxJsxExpressionAttribute")({
	type: Schema.tag("mdxJsxExpressionAttribute"),
	value: Schema.String,
	position: NodePosition,
}) {}

/**
 * The union of every node that may appear in a JSX element's `attributes`
 * array. A real `Schema.Union` for the construction pass-through documented
 * on `RowContent`.
 *
 * Attribute carriers are node-shaped values — they carry `type` and
 * `position` per the mdast-util-mdx-jsx contract — but they are **not tree
 * content**: they never appear in a `children` array, so they are excluded
 * from `MarkdownNode` and invisible to the visitor and to
 * `MarkdownDocument.find`.
 *
 * @public
 */
export const MdxJsxAttributeContent: Schema.Codec<MdxJsxAttributeContent> = Schema.Union([
	MdxJsxAttribute,
	MdxJsxExpressionAttribute,
]);

/**
 * The union of all JSX attribute node types.
 *
 * @public
 */
export type MdxJsxAttributeContent = MdxJsxAttribute | MdxJsxExpressionAttribute;

/**
 * MdxJsxFlowElement — a JSX element in flow (block) position (`<Component />`
 * on its own lines). `name` is `null` for a fragment (`<></>`); children are
 * flow content, per the oracle's `BlockContent | DefinitionContent` model.
 *
 * A fragment cannot carry attributes — that shape has no MDX spelling — so
 * the schema refuses it at construction and decode. A **named** element's
 * name must be non-empty on the same terms: `""` has no MDX spelling either
 * (the oracle's parser only ever produces a real name or `null`, and its
 * serializer treats a falsy name as the fragment), so `null` is the one
 * fragment spelling and the empty string fails typed.
 *
 * @public
 */
export class MdxJsxFlowElement extends Schema.Class<MdxJsxFlowElement>("MdxJsxFlowElement")(
	Schema.Struct({
		type: Schema.tag("mdxJsxFlowElement"),
		name: Schema.NullOr(Schema.String),
		attributes: Schema.Array(MdxJsxAttributeContent),
		children: Schema.Array(Schema.suspend((): Schema.Codec<FlowContent> => FlowContent)),
		position: NodePosition,
	}).pipe(
		Schema.check(
			Schema.makeFilter((element) => {
				if (element.name !== null && element.name.length === 0) {
					return "an MDX JSX element requires a non-empty name (`null` is the fragment spelling)";
				}
				return element.name === null && element.attributes.length > 0
					? "an MDX JSX fragment cannot carry attributes"
					: undefined;
			}),
		),
	),
) {}

/**
 * MdxJsxTextElement — a JSX element in text (phrasing) position
 * (`a <b>c</b> d`). `name` is `null` for a fragment; children are phrasing
 * content. Refuses attributes on a fragment and an empty-string name, on the
 * same terms as {@link MdxJsxFlowElement}.
 *
 * @public
 */
export class MdxJsxTextElement extends Schema.Class<MdxJsxTextElement>("MdxJsxTextElement")(
	Schema.Struct({
		type: Schema.tag("mdxJsxTextElement"),
		name: Schema.NullOr(Schema.String),
		attributes: Schema.Array(MdxJsxAttributeContent),
		children: Schema.Array(Schema.suspend((): Schema.Codec<PhrasingContent> => PhrasingContent)),
		position: NodePosition,
	}).pipe(
		Schema.check(
			Schema.makeFilter((element) => {
				if (element.name !== null && element.name.length === 0) {
					return "an MDX JSX element requires a non-empty name (`null` is the fragment spelling)";
				}
				return element.name === null && element.attributes.length > 0
					? "an MDX JSX fragment cannot carry attributes"
					: undefined;
			}),
		),
	),
) {}

/**
 * MdxFlowExpression — an expression in flow (block) position (`{a + b}` on
 * its own lines); `value` holds the expression source text between the
 * braces.
 *
 * @public
 */
export class MdxFlowExpression extends Schema.Class<MdxFlowExpression>("MdxFlowExpression")({
	type: Schema.tag("mdxFlowExpression"),
	value: Schema.String,
	position: NodePosition,
}) {}

/**
 * MdxTextExpression — an expression in text (phrasing) position
 * (`a {b} c`); `value` holds the expression source text between the braces.
 *
 * @public
 */
export class MdxTextExpression extends Schema.Class<MdxTextExpression>("MdxTextExpression")({
	type: Schema.tag("mdxTextExpression"),
	value: Schema.String,
	position: NodePosition,
}) {}

/**
 * MdxjsEsm — an MDX ESM block (`import`/`export` statements); `value` holds
 * the statement source verbatim.
 *
 * Only ever a child of {@link Root}, per the mdast-util-mdxjs-esm content
 * registration — ESM cannot nest inside a JSX element or any other
 * container. As with the frontmatter head node, the constraint is structural
 * (the `Root` children union admits it, no other union does), not validated.
 *
 * @public
 */
export class MdxjsEsm extends Schema.Class<MdxjsEsm>("MdxjsEsm")({
	type: Schema.tag("mdxjsEsm"),
	value: Schema.String,
	position: NodePosition,
}) {}

// --- Frontmatter ------------------------------------------------------------

/**
 * The frontmatter formats the capture recognizes, keyed by their opening
 * fence: `---` is yaml, `+++` is toml and `---json` is json.
 *
 * @public
 */
export const FrontmatterFormat = Schema.Literals(["yaml", "toml", "json"]);

/**
 * The union of all frontmatter format string literals.
 *
 * @public
 */
export type FrontmatterFormat = typeof FrontmatterFormat.Type;

/**
 * Frontmatter — the raw, fidelity-preserving capture of a document's metadata
 * block. `value` is the source text between the fences, exactly as written
 * (never inline-parsed, never decoded); `format` records which fence captured
 * it. The position spans the whole block including both fence lines.
 *
 * mdast has no single frontmatter node: it names `yaml` in the readme and
 * `toml` through the frontmatter extension, and json has no mdast name at
 * all. This package captures all three through ONE node — text plus a format
 * marker — and the `Mdast` projection maps `format` onto the mdast type
 * names where they exist. Decoding the value is the codec modules' job
 * (`YamlFrontmatter`/`TomlFrontmatter`/`JsonFrontmatter`); the engine never
 * looks inside it.
 *
 * Only ever the first child of {@link Root}, and only when parsing opted in
 * via `MarkdownParseOptions.frontmatter` — mdast's "limited to one node, only
 * as head" constraint is structural here, not validated.
 *
 * @public
 */
export class Frontmatter extends Schema.Class<Frontmatter>("Frontmatter")({
	type: Schema.tag("frontmatter"),
	format: FrontmatterFormat,
	value: Schema.String,
	position: NodePosition,
}) {}

/**
 * The union of every node that may appear where mdast expects
 * **frontmatter** content — a one-member union, kept because mdast names the
 * category (its member there is `Yaml`; ours is the format-agnostic capture).
 *
 * @public
 */
export const FrontmatterContent: Schema.Codec<FrontmatterContent> = Schema.suspend(() => Frontmatter);

/**
 * The union of all frontmatter-content node types.
 *
 * @public
 */
export type FrontmatterContent = Frontmatter;

// --- Root -------------------------------------------------------------------

/**
 * Root — a whole document, and the only node that is never a child.
 *
 * mdast leaves a root's content model open; a parsed markdown document is
 * flow content, optionally headed by one {@link Frontmatter} node — mdast's
 * `FlowContentFrontmatter` merge, which admits frontmatter at the root and
 * nowhere else. {@link MdxjsEsm} is likewise admitted at the root and nowhere
 * else, per mdast-util-mdxjs-esm's `RootContentMap` registration.
 *
 * @public
 */
export class Root extends Schema.Class<Root>("Root")({
	type: Schema.tag("root"),
	children: Schema.Array(
		Schema.suspend(
			(): Schema.Codec<Frontmatter | MdxjsEsm | FlowContent> => Schema.Union([Frontmatter, MdxjsEsm, FlowContent]),
		),
	),
	position: NodePosition,
}) {}

/**
 * The union of every mdast node type this package produces — the content
 * categories plus {@link Root}.
 *
 * @public
 */
export type MarkdownNode =
	| Root
	| FrontmatterContent
	| FlowContent
	| ListContent
	| MdxjsEsm
	| PhrasingContent
	| RowContent
	| TableContent;

/**
 * A schema matching any node in the tree.
 *
 * @public
 */
export const MarkdownNode: Schema.Codec<MarkdownNode> = Schema.suspend(() =>
	Schema.Union([
		Root,
		FrontmatterContent,
		FlowContent,
		ListContent,
		MdxjsEsm,
		PhrasingContent,
		RowContent,
		TableContent,
	]),
);

/**
 * The union of every node `type` tag this package produces — the selector
 * vocabulary of `MarkdownDocument.find`/`findAll`.
 *
 * @public
 */
export type MarkdownNodeType = MarkdownNode["type"];

/**
 * The node class whose `type` tag is `T` — how a type-string selector narrows
 * its result (`MarkdownNodeOfType<"heading">` is {@link Heading}).
 *
 * @public
 */
export type MarkdownNodeOfType<T extends MarkdownNodeType> = Extract<MarkdownNode, { readonly type: T }>;

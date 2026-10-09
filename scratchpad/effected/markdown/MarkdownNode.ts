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

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/markdown/MarkdownNode");

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
export class Point extends S.Class<Point>($I`Point`)({
	line: S.Finite.annotateKey({ description: "1-based line number in the source document" }),
	column: S.Finite.annotateKey({ description: "1-based column in the source line, measured in UTF-16 code units" }),
	offset: S.Finite.annotateKey({ description: "0-based index into the source string, measured in UTF-16 code units for offset-splice editing" }),
}, $I.annote("Point", { description: "A single point in a source document: 1-based `line` and `column`, 0-based `offset`." })) {}

/**
 * The source span of a node: `start` inclusive, `end` exclusive.
 *
 * @public
 */
export class Position extends S.Class<Position>($I`Position`)({
	start: Point.annotateKey({ description: "Inclusive source point where the node begins" }),
	end: Point.annotateKey({ description: "Exclusive source point immediately after the node" }),
}, $I.annote("Position", { description: "The source span of a node: `start` inclusive, `end` exclusive." })) {
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
const NodePosition = Position.pipe(S.withConstructorDefault(Effect.succeed(Position.synthetic)));

/**
 * The explicitness of a reference, per mdast's `referenceType` enum.
 *
 * - `shortcut` — implicit, identifier inferred from the content (`[foo]`).
 * - `collapsed` — explicit, identifier inferred from the content (`[foo][]`).
 * - `full` — explicit, identifier explicitly set (`[foo][bar]`).
 *
 * @public
 */
export const ReferenceType = S.Literals(["shortcut", "collapsed", "full"]).pipe($I.annoteSchema("ReferenceType", { description: "The explicitness of a reference, per mdast's `referenceType` enum." }));

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
export const HeadingStyle = S.Literals(["atx", "setext"]).pipe($I.annoteSchema("HeadingStyle", { description: "The two ways CommonMark spells a heading: `atx` (`# Title`) and `setext` (a title underlined with `=` or `-`)." }));

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
export const BreakStyle = S.Literals(["backslash", "spaces"]).pipe($I.annoteSchema("BreakStyle", { description: "The two ways CommonMark spells a hard line break: a trailing backslash or two-or-more trailing spaces." }));

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
export const FenceChar = S.Literals(["`", "~"]).pipe($I.annoteSchema("FenceChar", { description: "The two fence characters a fenced code block may use." }));

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
export const BulletChar = S.Literals(["-", "*", "+"]).pipe($I.annoteSchema("BulletChar", { description: "The three bullet characters an unordered list may use." }));

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
export const ListDelimiter = S.Literals([".", ")"]).pipe($I.annoteSchema("ListDelimiter", { description: "The two delimiters an ordered list marker may use (`1.` or `1)`)." }));

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
export const ThematicBreakChar = S.Literals(["-", "_", "*"]).pipe($I.annoteSchema("ThematicBreakChar", { description: "The three characters a thematic break may be drawn with." }));

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
export const EmphasisChar = S.Literals(["*", "_"]).pipe($I.annoteSchema("EmphasisChar", { description: "The two characters emphasis and strong emphasis may be marked with." }));

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
export const HeadingDepth = S.Literals([1, 2, 3, 4, 5, 6]).pipe($I.annoteSchema("HeadingDepth", { description: "The six legal ATX/setext heading depths." }));

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
export const TableAlign = S.Literals(["left", "right", "center"]).pipe($I.annoteSchema("TableAlign", { description: "The three alignments a GFM table column may declare. A `null` entry in a Table's `align` array means the column carries no alignment." }));

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
export class Text extends S.Class<Text>($I`Text`)({
	type: S.tag("text").annotateKey({ description: "The `text` discriminator identifying a run of literal characters" }),
	value: S.String.annotateKey({ description: "Literal text content with entity references and backslash escapes already resolved" }),
	escapeStyle: S.optionalKey(S.Literals(["canonical", "literal"])).annotateKey({ description: "Emitter instruction selecting canonical inline escaping or literal output, while retaining escapes that protect surrounding block structure" }),
	position: NodePosition.annotateKey({ description: "Source span of the text run, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Text", { description: "Text — a run of literal characters, with entity references and backslash escapes already resolved into `value`." })) {}

/**
 * InlineCode — a code span: `foo` written between backtick fences in the
 * source. `value` holds the span's content with the backtick fence stripped
 * and the spec's space-stripping applied.
 *
 * @public
 */
export class InlineCode extends S.Class<InlineCode>($I`InlineCode`)({
	type: S.tag("inlineCode").annotateKey({ description: "The `inlineCode` discriminator identifying an inline code span" }),
	value: S.String.annotateKey({ description: "Code span content with backtick fences removed and CommonMark space stripping applied" }),
	position: NodePosition.annotateKey({ description: "Source span of the code span, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("InlineCode", { description: "InlineCode — a code span: `foo` written between backtick fences in the source. `value` holds the span's content with the backtick fence stripped and the spec's space-stripping applied." })) {}

/**
 * Html — a fragment of raw HTML, kept verbatim. Used for both HTML blocks
 * (flow) and inline raw HTML (phrasing); the same node type serves both, as
 * mdast specifies.
 *
 * @public
 */
export class Html extends S.Class<Html>($I`Html`)({
	type: S.tag("html").annotateKey({ description: "The `html` discriminator identifying raw HTML in block or inline position" }),
	value: S.String.annotateKey({ description: "Raw HTML source preserved verbatim" }),
	position: NodePosition.annotateKey({ description: "Source span of the HTML fragment, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Html", { description: "Html — a fragment of raw HTML, kept verbatim. Used for both HTML blocks (flow) and inline raw HTML (phrasing); the same node type serves both, as mdast specifies." })) {}

/**
 * Break — a hard line break.
 *
 * `breakStyle` is a fidelity extra recording which of the two CommonMark
 * spellings produced it.
 *
 * @public
 */
export class Break extends S.Class<Break>($I`Break`)({
	type: S.tag("break").annotateKey({ description: "The `break` discriminator identifying a hard line break" }),
	position: NodePosition.annotateKey({ description: "Source span of the hard break, constructor-defaulted to the zero-width synthetic position" }),
	breakStyle: S.optionalKey(BreakStyle).annotateKey({ description: "Source spelling of the hard break: a trailing backslash or two or more trailing spaces" }),
}, $I.annote("Break", { description: "Break — a hard line break." })) {}

/**
 * Image — an inline image (`![alt](url "title")`).
 *
 * @public
 */
export class Image extends S.Class<Image>($I`Image`)({
	type: S.tag("image").annotateKey({ description: "The `image` discriminator identifying an inline image with a direct destination" }),
	url: S.String.annotateKey({ description: "Image destination with source escapes resolved, without URI percent encoding" }),
	title: S.optionalKey(S.String).annotateKey({ description: "Optional image title with enclosing delimiters removed and source escapes resolved" }),
	alt: S.optionalKey(S.String).annotateKey({ description: "Plain text alternative derived from the image's bracketed content" }),
	position: NodePosition.annotateKey({ description: "Source span of the image, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Image", { description: "Image — an inline image (`![alt](url \"title\")`)." })) {}

/**
 * ImageReference — an image referring to a {@link Definition} by identifier
 * (`![alt][ref]`).
 *
 * The parser emits these unresolved, whether or not a matching definition
 * exists in the tree — resolution is the consumer's business.
 *
 * @public
 */
export class ImageReference extends S.Class<ImageReference>($I`ImageReference`)({
	type: S.tag("imageReference").annotateKey({ description: "The `imageReference` discriminator identifying an image associated with a link reference definition" }),
	identifier: S.String.annotateKey({ description: "Normalized, lowercased reference label used to associate the image with a definition" }),
	label: S.optionalKey(S.String).annotateKey({ description: "Original reference label text with surrounding brackets removed" }),
	referenceType: ReferenceType.annotateKey({ description: "Reference spelling: `shortcut`, `collapsed`, or `full`, recording whether a separate reference label was written" }),
	alt: S.optionalKey(S.String).annotateKey({ description: "Plain text alternative derived from the reference image's bracketed content" }),
	position: NodePosition.annotateKey({ description: "Source span of the image reference, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("ImageReference", { description: "ImageReference — an image referring to a Definition by identifier (`![alt][ref]`)." })) {}

/**
 * Emphasis — `*foo*` or `_foo_`.
 *
 * `markerChar` is a fidelity extra recording which marker produced it.
 *
 * @public
 */
export class Emphasis extends S.Class<Emphasis>($I`Emphasis`)({
	type: S.tag("emphasis").annotateKey({ description: "The `emphasis` discriminator identifying emphasized inline content" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content enclosed by emphasis markers, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the emphasis, constructor-defaulted to the zero-width synthetic position" }),
	markerChar: S.optionalKey(EmphasisChar).annotateKey({ description: "Source character used for emphasis markers: `*` or `_`" }),
}, $I.annote("Emphasis", { description: "Emphasis — `*foo*` or `_foo_`." })) {}

/**
 * Strong — `**foo**` or `__foo__`.
 *
 * `markerChar` is a fidelity extra recording which marker produced it.
 *
 * @public
 */
export class Strong extends S.Class<Strong>($I`Strong`)({
	type: S.tag("strong").annotateKey({ description: "The `strong` discriminator identifying strongly emphasized inline content" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content enclosed by strong emphasis markers, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the strong emphasis, constructor-defaulted to the zero-width synthetic position" }),
	markerChar: S.optionalKey(EmphasisChar).annotateKey({ description: "Source character doubled for strong emphasis markers: `*` or `_`" }),
}, $I.annote("Strong", { description: "Strong — `**foo**` or `__foo__`." })) {}

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
export class Delete extends S.Class<Delete>($I`Delete`)({
	type: S.tag("delete").annotateKey({ description: "The `delete` discriminator identifying GFM strikethrough content" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content marked as no longer accurate or relevant by strikethrough, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the strikethrough, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Delete", { description: "Delete — GFM strikethrough (`~~foo~~`). Content that is no longer accurate or relevant." })) {}

/**
 * Link — an inline link (`[text](url "title")`), including autolinks.
 *
 * @public
 */
export class Link extends S.Class<Link>($I`Link`)({
	type: S.tag("link").annotateKey({ description: "The `link` discriminator identifying an inline link or autolink with a direct destination" }),
	url: S.String.annotateKey({ description: "Link destination with source escapes resolved, without URI percent encoding" }),
	title: S.optionalKey(S.String).annotateKey({ description: "Optional link title with enclosing delimiters removed and source escapes resolved" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content displayed as the link text, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the link, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Link", { description: "Link — an inline link (`[text](url \"title\")`), including autolinks." })) {}

/**
 * LinkReference — a link referring to a {@link Definition} by identifier
 * (`[text][ref]`).
 *
 * Emitted unresolved, on the same terms as {@link ImageReference}.
 *
 * @public
 */
export class LinkReference extends S.Class<LinkReference>($I`LinkReference`)({
	type: S.tag("linkReference").annotateKey({ description: "The `linkReference` discriminator identifying a link associated with a reference definition" }),
	identifier: S.String.annotateKey({ description: "Normalized, lowercased reference label used to associate the link with a definition" }),
	label: S.optionalKey(S.String).annotateKey({ description: "Original reference label text with surrounding brackets removed" }),
	referenceType: ReferenceType.annotateKey({ description: "Reference spelling: `shortcut`, `collapsed`, or `full`, recording whether a separate reference label was written" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content displayed as the reference link's text, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the link reference, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("LinkReference", { description: "LinkReference — a link referring to a Definition by identifier (`[text][ref]`)." })) {}

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
export class FootnoteReference extends S.Class<FootnoteReference>($I`FootnoteReference`)({
	type: S.tag("footnoteReference").annotateKey({ description: "The `footnoteReference` discriminator identifying a GFM footnote marker" }),
	identifier: S.String.annotateKey({ description: "Normalized, lowercased footnote label used to associate the marker with a footnote definition" }),
	label: S.optionalKey(S.String).annotateKey({ description: "Original footnote label text without the surrounding brackets and leading caret" }),
	position: NodePosition.annotateKey({ description: "Source span of the footnote marker, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("FootnoteReference", { description: "FootnoteReference — a GFM footnote marker (`[^alpha]`), associating this point in the text with a FootnoteDefinition by identifier." })) {}

/**
 * The union of every node that may appear where mdast expects **phrasing**
 * content — the text of a document and its markup.
 *
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `PhrasingContent -> Emphasis/Strong/Link/LinkReference -> PhrasingContent`.
 *
 * @public
 */
export const PhrasingContent: S.Codec<PhrasingContent> = S.suspend(() =>
	S.Union([
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
export class ThematicBreak extends S.Class<ThematicBreak>($I`ThematicBreak`)({
	type: S.tag("thematicBreak").annotateKey({ description: "The `thematicBreak` discriminator identifying a horizontal rule" }),
	position: NodePosition.annotateKey({ description: "Source span of the horizontal rule, constructor-defaulted to the zero-width synthetic position" }),
	markerChar: S.optionalKey(ThematicBreakChar).annotateKey({ description: "Source character used to draw the horizontal rule: `-`, `_`, or `*`" }),
}, $I.annote("ThematicBreak", { description: "ThematicBreak — a horizontal rule (`---`, `***`, `___`)." })) {}

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
export class Code extends S.Class<Code>($I`Code`)({
	type: S.tag("code").annotateKey({ description: "The `code` discriminator identifying a fenced or indented code block" }),
	value: S.String.annotateKey({ description: "Code block content with fence lines or code indentation removed" }),
	lang: S.optionalKey(S.String).annotateKey({ description: "Language token preceding the first whitespace run in a fenced code block's info string" }),
	meta: S.optionalKey(S.String).annotateKey({ description: "Additional fence info following the language token and its separating whitespace" }),
	position: NodePosition.annotateKey({ description: "Source span of the code block, constructor-defaulted to the zero-width synthetic position" }),
	fenceChar: S.optionalKey(FenceChar).annotateKey({ description: "Source fence character, backtick or tilde; absent on parsed indented code blocks" }),
	fenceLength: S.optionalKey(S.Finite).annotateKey({ description: "Number of repeated characters in the opening fence; absent on parsed indented code blocks" }),
}, $I.annote("Code", { description: "Code — a code block, fenced or indented." })) {}

/**
 * Definition — a link reference definition (`[ref]: /url "title"`).
 *
 * Kept in the tree at its source position rather than stripped, which is the
 * deliberate departure from commonmark.js and the reason references can stay
 * unresolved.
 *
 * @public
 */
export class Definition extends S.Class<Definition>($I`Definition`)({
	type: S.tag("definition").annotateKey({ description: "The `definition` discriminator identifying a link reference definition" }),
	identifier: S.String.annotateKey({ description: "Normalized, lowercased label used to associate links and images with this definition" }),
	label: S.optionalKey(S.String).annotateKey({ description: "Original definition label text with surrounding brackets removed" }),
	url: S.String.annotateKey({ description: "Defined link or image destination with source escapes resolved, without URI percent encoding" }),
	title: S.optionalKey(S.String).annotateKey({ description: "Optional destination title with enclosing delimiters removed and source escapes resolved" }),
	position: NodePosition.annotateKey({ description: "Source span of the reference definition, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Definition", { description: "Definition — a link reference definition (`[ref]: /url \"title\"`)." })) {}

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
export class FootnoteDefinition extends S.Class<FootnoteDefinition>($I`FootnoteDefinition`)({
	type: S.tag("footnoteDefinition").annotateKey({ description: "The `footnoteDefinition` discriminator identifying a GFM footnote definition" }),
	identifier: S.String.annotateKey({ description: "Normalized, lowercased label used to associate footnote markers with this definition" }),
	label: S.optionalKey(S.String).annotateKey({ description: "Original footnote label text without the surrounding brackets and leading caret" }),
	children: S.Array(S.suspend((): S.Codec<FlowContent> => FlowContent)).annotateKey({ description: "Block content forming the footnote body, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the footnote definition, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("FootnoteDefinition", { description: "FootnoteDefinition — a GFM footnote definition (`[^alpha]: bravo.`), the content a FootnoteReference points at." })) {}

/**
 * Paragraph — a run of phrasing content.
 *
 * @public
 */
export class Paragraph extends S.Class<Paragraph>($I`Paragraph`)({
	type: S.tag("paragraph").annotateKey({ description: "The `paragraph` discriminator identifying a paragraph of inline content" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content forming the paragraph, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the paragraph, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Paragraph", { description: "Paragraph — a run of phrasing content." })) {}

/**
 * Heading — an ATX or setext heading of depth 1 to 6.
 *
 * `headingStyle` is a fidelity extra recording which spelling produced it;
 * setext headings can only be depth 1 or 2.
 *
 * @public
 */
export class Heading extends S.Class<Heading>($I`Heading`)({
	type: S.tag("heading").annotateKey({ description: "The `heading` discriminator identifying an ATX or setext heading" }),
	depth: HeadingDepth.annotateKey({ description: "Heading level from 1 to 6, with 1 representing the highest level" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content forming the heading text, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the heading, constructor-defaulted to the zero-width synthetic position" }),
	headingStyle: S.optionalKey(HeadingStyle).annotateKey({ description: "Source spelling of the heading: `atx` hash markers or a `setext` underline" }),
}, $I.annote("Heading", { description: "Heading — an ATX or setext heading of depth 1 to 6." })) {}

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
export class ListItem extends S.Class<ListItem>($I`ListItem`)({
	type: S.tag("listItem").annotateKey({ description: "The `listItem` discriminator identifying one item in a list" }),
	spread: S.optionalKey(S.Boolean).annotateKey({ description: "Whether blank lines separate the item's child blocks; absent means unknown" }),
	children: S.Array(S.suspend((): S.Codec<FlowContent> => FlowContent)).annotateKey({ description: "Block content belonging to the list item, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the list item, constructor-defaulted to the zero-width synthetic position" }),
	checked: S.optionalKey(S.Boolean).annotateKey({ description: "Task completion state: `true` for done, `false` for unfinished, absent for an ordinary list item" }),
}, $I.annote("ListItem", { description: "ListItem — one item of a List." })) {}

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
export class List extends S.Class<List>($I`List`)({
	type: S.tag("list").annotateKey({ description: "The `list` discriminator identifying an ordered or unordered list" }),
	ordered: S.optionalKey(S.Boolean).annotateKey({ description: "Whether the list uses numbered markers rather than bullets; absent means unknown" }),
	start: S.optionalKey(S.Finite).annotateKey({ description: "Starting number from an ordered list's first marker; absent on parsed unordered lists" }),
	spread: S.optionalKey(S.Boolean).annotateKey({ description: "Whether blank lines separate items or blocks within items, making the list loose; absent means unknown" }),
	children: S.Array(S.suspend((): S.Codec<ListContent> => ListContent)).annotateKey({ description: "List items in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the list, constructor-defaulted to the zero-width synthetic position" }),
	bulletChar: S.optionalKey(BulletChar).annotateKey({ description: "Source marker character for an unordered list: `-`, `*`, or `+`" }),
	delimiter: S.optionalKey(ListDelimiter).annotateKey({ description: "Source character following an ordered list's marker number: `.` or `)`" }),
}, $I.annote("List", { description: "List — an ordered or unordered list." })) {}

/**
 * Blockquote — a section quoted from somewhere else.
 *
 * @public
 */
export class Blockquote extends S.Class<Blockquote>($I`Blockquote`)({
	type: S.tag("blockquote").annotateKey({ description: "The `blockquote` discriminator identifying a quoted section" }),
	children: S.Array(S.suspend((): S.Codec<FlowContent> => FlowContent)).annotateKey({ description: "Block content contained in the quoted section, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the blockquote, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Blockquote", { description: "Blockquote — a section quoted from somewhere else." })) {}

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
export class TableCell extends S.Class<TableCell>($I`TableCell`)({
	type: S.tag("tableCell").annotateKey({ description: "The `tableCell` discriminator identifying a header or data cell in a GFM table" }),
	children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)).annotateKey({ description: "Inline content forming the table cell, in document order" }),
	position: NodePosition.annotateKey({ description: "Source span of the trimmed cell content, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("TableCell", { description: "TableCell — one cell of a TableRow: a header cell if its grandparent Table's first row, a data cell otherwise." })) {}

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
export const RowContent: S.Codec<RowContent> = S.suspend(() => S.Union([TableCell]));

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
export class TableRow extends S.Class<TableRow>($I`TableRow`)({
	type: S.tag("tableRow").annotateKey({ description: "The `tableRow` discriminator identifying a header or data row in a GFM table" }),
	children: S.Array(S.suspend((): S.Codec<RowContent> => RowContent)).annotateKey({ description: "Table cells in column order" }),
	position: NodePosition.annotateKey({ description: "Source span of the table row, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("TableRow", { description: "TableRow — one row of a Table: the labels of the columns if it is the table's first row, a data row otherwise." })) {}

/**
 * The union of every node that may appear where mdast expects **table**
 * content — the rows in a {@link Table}. A one-member union, kept because
 * mdast names the category — and a real `Schema.Union` for the construction
 * pass-through documented on `RowContent`.
 *
 * @public
 */
export const TableContent: S.Codec<TableContent> = S.suspend(() => S.Union([TableRow]));

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
export class Table extends S.Class<Table>($I`Table`)({
	type: S.tag("table").annotateKey({ description: "The `table` discriminator identifying a GFM table" }),
	align: TableAlign.pipe(S.NullOr, S.Array, S.optionalKey).annotateKey({ description: "Declared alignment per column; `null` means no declared alignment, while an absent array means unknown" }),
	children: S.Array(S.suspend((): S.Codec<TableContent> => TableContent)).annotateKey({ description: "Table rows in document order, with the first row supplying column labels" }),
	position: NodePosition.annotateKey({ description: "Source span of the table, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Table", { description: "Table — GFM two-dimensional data." })) {}

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
export const FlowContent: S.Codec<FlowContent> = S.suspend(() =>
	S.Union([
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
export const ListContent: S.Codec<ListContent> = S.suspend(() => S.Union([ListItem]));

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
export class MdxJsxAttributeValueExpression extends S.Class<MdxJsxAttributeValueExpression>(
	$I`MdxJsxAttributeValueExpression`,
)({
	type: S.tag("mdxJsxAttributeValueExpression").annotateKey({ description: "The `mdxJsxAttributeValueExpression` discriminator identifying an expression used as a JSX attribute value" }),
	value: S.String.annotateKey({ description: "Unevaluated expression source between the braces of a JSX attribute value" }),
	position: NodePosition.annotateKey({ description: "Source span of the attribute value expression, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("MdxJsxAttributeValueExpression", { description: "MdxJsxAttributeValueExpression — a JSX attribute value written as an expression (`<a b={c} />`); `value` holds the expression source text between the braces, never evaluated or parsed." })) {}

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
export class MdxJsxAttribute extends S.Class<MdxJsxAttribute>($I`MdxJsxAttribute`)(
	S.Struct({
		type: S.tag("mdxJsxAttribute"),
		name: S.String,
		value: S.Union([MdxJsxAttributeValueExpression, S.String]).pipe(S.NullOr, S.optionalKey),
		position: NodePosition,
	}).pipe(
		S.check(
			S.makeFilter((attribute) =>
				attribute.name.length === 0 ? "an MDX JSX attribute requires a non-empty name" : undefined,
			),
		),
	), $I.annote("MdxJsxAttribute", { description: "MdxJsxAttribute — a named JSX attribute (`<a b=\"c\" />`). `value` is a string literal, a MdxJsxAttributeValueExpression, or — for a boolean attribute (`<a b />`) — absent or `null`, both of which the mdast-util-mdx-jsx contract spells (its parser writes `null`; absence is the constructed-tree spelling). The serializer treats the two identically." }),
) {}

/**
 * MdxJsxExpressionAttribute — a JSX attribute written whole as an expression
 * (`<a {...b} />`); `value` holds the expression source text between the
 * braces.
 *
 * @public
 */
export class MdxJsxExpressionAttribute extends S.Class<MdxJsxExpressionAttribute>($I`MdxJsxExpressionAttribute`)({
	type: S.tag("mdxJsxExpressionAttribute").annotateKey({ description: "The `mdxJsxExpressionAttribute` discriminator identifying a JSX attribute written wholly as an expression" }),
	value: S.String.annotateKey({ description: "Expression source between the braces of a JSX expression attribute, including spread syntax when present" }),
	position: NodePosition.annotateKey({ description: "Source span of the expression attribute, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("MdxJsxExpressionAttribute", { description: "MdxJsxExpressionAttribute — a JSX attribute written whole as an expression (`<a {...b} />`); `value` holds the expression source text between the braces." })) {}

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
export const MdxJsxAttributeContent: S.Codec<MdxJsxAttributeContent> = S.Union([
	MdxJsxAttribute,
	MdxJsxExpressionAttribute,
]).pipe($I.annoteSchema("MdxJsxAttributeContent", { description: "The union of every node that may appear in a JSX element's `attributes` array. A real `Schema.Union` for the construction pass-through documented on `RowContent`." }));

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
export class MdxJsxFlowElement extends S.Class<MdxJsxFlowElement>($I`MdxJsxFlowElement`)(
	S.Struct({
		type: S.tag("mdxJsxFlowElement"),
		name: S.NullOr(S.String),
		attributes: S.Array(MdxJsxAttributeContent),
		children: S.Array(S.suspend((): S.Codec<FlowContent> => FlowContent)),
		position: NodePosition,
	}).pipe(
		S.check(
			S.makeFilter((element) => {
				if (element.name !== null && element.name.length === 0) {
					return "an MDX JSX element requires a non-empty name (`null` is the fragment spelling)";
				}
				return element.name === null && element.attributes.length > 0
					? "an MDX JSX fragment cannot carry attributes"
					: undefined;
			}),
		),
	), $I.annote("MdxJsxFlowElement", { description: "MdxJsxFlowElement — a JSX element in flow (block) position (`<Component />` on its own lines). `name` is `null` for a fragment (`<></>`); children are flow content, per the oracle's `BlockContent | DefinitionContent` model." }),
) {}

/**
 * MdxJsxTextElement — a JSX element in text (phrasing) position
 * (`a <b>c</b> d`). `name` is `null` for a fragment; children are phrasing
 * content. Refuses attributes on a fragment and an empty-string name, on the
 * same terms as {@link MdxJsxFlowElement}.
 *
 * @public
 */
export class MdxJsxTextElement extends S.Class<MdxJsxTextElement>($I`MdxJsxTextElement`)(
	S.Struct({
		type: S.tag("mdxJsxTextElement"),
		name: S.NullOr(S.String),
		attributes: S.Array(MdxJsxAttributeContent),
		children: S.Array(S.suspend((): S.Codec<PhrasingContent> => PhrasingContent)),
		position: NodePosition,
	}).pipe(
		S.check(
			S.makeFilter((element) => {
				if (element.name !== null && element.name.length === 0) {
					return "an MDX JSX element requires a non-empty name (`null` is the fragment spelling)";
				}
				return element.name === null && element.attributes.length > 0
					? "an MDX JSX fragment cannot carry attributes"
					: undefined;
			}),
		),
	), $I.annote("MdxJsxTextElement", { description: "MdxJsxTextElement — a JSX element in text (phrasing) position (`a <b>c</b> d`). `name` is `null` for a fragment; children are phrasing content. Refuses attributes on a fragment and an empty-string name, on the same terms as MdxJsxFlowElement." }),
) {}

/**
 * MdxFlowExpression — an expression in flow (block) position (`{a + b}` on
 * its own lines); `value` holds the expression source text between the
 * braces.
 *
 * @public
 */
export class MdxFlowExpression extends S.Class<MdxFlowExpression>($I`MdxFlowExpression`)({
	type: S.tag("mdxFlowExpression").annotateKey({ description: "The `mdxFlowExpression` discriminator identifying an MDX expression in block position" }),
	value: S.String.annotateKey({ description: "Expression source between braces in an MDX block expression" }),
	position: NodePosition.annotateKey({ description: "Source span of the block expression, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("MdxFlowExpression", { description: "MdxFlowExpression — an expression in flow (block) position (`{a + b}` on its own lines); `value` holds the expression source text between the braces." })) {}

/**
 * MdxTextExpression — an expression in text (phrasing) position
 * (`a {b} c`); `value` holds the expression source text between the braces.
 *
 * @public
 */
export class MdxTextExpression extends S.Class<MdxTextExpression>($I`MdxTextExpression`)({
	type: S.tag("mdxTextExpression").annotateKey({ description: "The `mdxTextExpression` discriminator identifying an MDX expression within inline content" }),
	value: S.String.annotateKey({ description: "Expression source between braces in an inline MDX expression" }),
	position: NodePosition.annotateKey({ description: "Source span of the inline expression, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("MdxTextExpression", { description: "MdxTextExpression — an expression in text (phrasing) position (`a {b} c`); `value` holds the expression source text between the braces." })) {}

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
export class MdxjsEsm extends S.Class<MdxjsEsm>($I`MdxjsEsm`)({
	type: S.tag("mdxjsEsm").annotateKey({ description: "The `mdxjsEsm` discriminator identifying an MDX import or export block" }),
	value: S.String.annotateKey({ description: "Import or export statement source preserved verbatim" }),
	position: NodePosition.annotateKey({ description: "Source span of the ESM block, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("MdxjsEsm", { description: "MdxjsEsm — an MDX ESM block (`import`/`export` statements); `value` holds the statement source verbatim." })) {}

// --- Frontmatter ------------------------------------------------------------

/**
 * The frontmatter formats the capture recognizes, keyed by their opening
 * fence: `---` is yaml, `+++` is toml and `---json` is json.
 *
 * @public
 */
export const FrontmatterFormat = S.Literals(["yaml", "toml", "json"]).pipe($I.annoteSchema("FrontmatterFormat", { description: "The frontmatter formats the capture recognizes, keyed by their opening fence: `---` is yaml, `+++` is toml and `---json` is json." }));

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
export class Frontmatter extends S.Class<Frontmatter>($I`Frontmatter`)({
	type: S.tag("frontmatter").annotateKey({ description: "The `frontmatter` discriminator identifying a captured document metadata block" }),
	format: FrontmatterFormat.annotateKey({ description: "Metadata format selected by the opening fence: `yaml`, `toml`, or `json`" }),
	value: S.String.annotateKey({ description: "Raw metadata source between the fence lines, preserved without parsing or decoding" }),
	position: NodePosition.annotateKey({ description: "Source span including both frontmatter fence lines, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Frontmatter", { description: "Frontmatter — the raw, fidelity-preserving capture of a document's metadata block. `value` is the source text between the fences, exactly as written (never inline-parsed, never decoded); `format` records which fence captured it. The position spans the whole block including both fence lines." })) {}

/**
 * The union of every node that may appear where mdast expects
 * **frontmatter** content — a one-member union, kept because mdast names the
 * category (its member there is `Yaml`; ours is the format-agnostic capture).
 *
 * @public
 */
export const FrontmatterContent: S.Codec<FrontmatterContent> = S.suspend(() => Frontmatter);

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
export class Root extends S.Class<Root>($I`Root`)({
	type: S.tag("root").annotateKey({ description: "The `root` discriminator identifying the whole document" }),
	children: S.Array(
		S.suspend(
			(): S.Codec<Frontmatter | MdxjsEsm | FlowContent> => S.Union([Frontmatter, MdxjsEsm, FlowContent]),
		),
	).annotateKey({ description: "Top-level document content in order, admitting frontmatter, MDX ESM blocks, and flow content" }),
	position: NodePosition.annotateKey({ description: "Source span of the whole document, constructor-defaulted to the zero-width synthetic position" }),
}, $I.annote("Root", { description: "Root — a whole document, and the only node that is never a child." })) {}

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
export const MarkdownNode: S.Codec<MarkdownNode> = S.suspend(() =>
	S.Union([
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

// The mdast-shaped node schemas behind the curated public leaves
// `@beep/markdown/MarkdownNode` (the core vocabulary) and
// `@beep/markdown/MarkdownMdx` (the MDX vocabulary). Node `type` strings and
// field names match the mdast specification (https://github.com/syntax-tree/mdast)
// exactly — that shape is a contract, not an implementation detail, so a
// consumer can hand a tree to the remark ecosystem after the `Mdast`
// projection strips the fidelity extras this module carries alongside.
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
// Every node is a branded `S.Opaque` plain-data value (D-22): construct with
// `X.make`, which validates and copies nested data; guards are structural
// `S.is`. The parser does not call `make` per node — struct `make` re-walks
// every descendant, which is O(n·depth). It builds plain typed values through
// `trustedNode`, and each public entry point admits the finished tree once:
// `Markdown.parseResult` with `Root.make`, `Markdown.parsePhrasingResult`
// with one array `make`, `MarkdownDocument.parseResult` with
// `MarkdownDocument.make` (D-39).
//
// All node schemas live in this one module because the tree is mutually
// recursive (flow contains flow, phrasing contains phrasing, and the core
// content unions include the MDX nodes) — splitting core and MDX into
// separate modules would close an import cycle. Recursion is broken with the
// `Schema.suspend` idiom and recursive references are typed `Schema.Codec<T>`
// (the `packages/toml/src/TomlNode.ts` precedent).

import { $MarkdownId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FrontmatterFormat as InternalFrontmatterFormat } from "./blocks/frontmatter.ts";

const $I = $MarkdownId.create("MarkdownNode");

/**
 * A single point in a source document: 1-based `line` and `column`, 0-based
 * `offset`.
 *
 * **Details**
 *
 * `offset` is the index into the source string, which is what the edit layer
 * splices against; `line`/`column` are the human-facing coordinates unist
 * specifies.
 *
 * **Example** (Locate a source character)
 *
 * ```ts
 * import { Point } from "@beep/markdown/MarkdownNode";
 *
 * const point = Point.make({ line: 2, column: 3, offset: 8 });
 * console.log(point.offset) // 8
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Point extends S.Opaque<Point, { readonly brand: unique symbol }>()(
  S.Struct({
    line: S.Finite.pipe($I.annoteKey("Point.line", { description: "1-based line number in the source document" })),
    column: S.Finite.pipe(
      $I.annoteKey("Point.column", { description: "1-based column in the source line, measured in UTF-16 code units" })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("Point.offset", {
        description: "0-based index into the source string, measured in UTF-16 code units for offset-splice editing",
      })
    ),
  }).pipe(
    $I.annoteSchema("Point", {
      description: "A single point in a source document: 1-based `line` and `column`, 0-based `offset`.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link Point}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Point {
  /**
   * The plain encoded fields of {@link Point}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly column: number;
    readonly line: number;
    readonly offset: number;
  }
}

/**
 * The source span of a node: `start` inclusive, `end` exclusive.
 *
 * **Example** (Construct an exclusive source span)
 *
 * ```ts
 * import { Point, Position } from "@beep/markdown/MarkdownNode";
 *
 * const position = Position.make({
 *   start: Point.make({ line: 1, column: 1, offset: 0 }),
 *   end: Point.make({ line: 1, column: 4, offset: 3 }),
 * });
 * console.log(position.end.offset - position.start.offset) // 3
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Position extends S.Opaque<Position, { readonly brand: unique symbol }>()(
  S.Struct({
    start: S.suspend(() => Point).pipe(
      $I.annoteKey("Position.start", { description: "Inclusive source point where the node begins" })
    ),
    end: S.suspend(() => Point).pipe(
      $I.annoteKey("Position.end", { description: "Exclusive source point immediately after the node" })
    ),
  }).pipe(
    $I.annoteSchema("Position", { description: "The source span of a node: `start` inclusive, `end` exclusive." })
  )
) {
  /**
   * The zero-width synthetic position: line 1, column 1, offset 0 at both
   * ends — the span every node class's `make` fills in when `position` is
   * omitted, and the same sentinel `Mdast.fromMdast` synthesizes for foreign
   * nodes that carry none.
   *
   * **Gotchas**
   *
   * Clearly synthetic and inert for rendering: trees carrying it serve
   * tree-level workflows (stringify, the visitor, `MarkdownFormat.modify`
   * replacement fragments, projection out), not offset-splice editing, whose
   * offsets must come from a real parse.
   *
   * **Example** (Inspect the synthetic source offset)
   *
   * ```ts
   * import { Position } from "@beep/markdown/MarkdownNode";
   *
   * console.log(Position.synthetic.start.offset) // 0
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly synthetic: Position = Position.make({
    start: Point.make({ line: 1, column: 1, offset: 0 }),
    end: Point.make({ line: 1, column: 1, offset: 0 }),
  });
}

/**
 * The encoded (wire) shape of {@link Position}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Position {
  /**
   * The plain encoded fields of {@link Position}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly end: Point.Encoded;
    readonly start: Point.Encoded;
  }
}

// Every node class takes `position` through this field schema: required on
// the decoded type (a parsed or decoded tree always carries a real span, so
// the mdast admission boundary is untouched) but constructor-defaulted to the
// zero-width sentinel, so a replacement fragment for `MarkdownFormat.modify`
// constructs in one line — `Text.make({ value: "shipped" })`. Constructor
// defaults apply only to `make`, never to decode or encode.
//
// `make` validates and copies: a plain-object `position` literal and an
// existing `Position` value both come back as a fresh copy, so never assert a
// constructed node's position (or any nested node) by reference; use
// `deepStrictEqual`/`Equal.equals`, which compare these plain values
// structurally.
const NodePosition = Position.pipe(S.withConstructorDefault(Effect.succeed(Position.synthetic)));

/**
 * The explicitness of a reference, per mdast's `referenceType` enum.
 *
 * **Details**
 *
 * - `shortcut` — implicit, identifier inferred from the content (`[foo]`).
 * - `collapsed` — explicit, identifier inferred from the content (`[foo][]`).
 * - `full` — explicit, identifier explicitly set (`[foo][bar]`).
 *
 * **Example** (Validate ReferenceType syntax)
 *
 * ```ts
 * import { ReferenceType } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ReferenceType)("full")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ReferenceType = LiteralKit(["shortcut", "collapsed", "full"]).pipe(
  $I.annoteSchema("ReferenceType", {
    description: "The explicitness of a reference, per mdast's `referenceType` enum.",
  })
);

/**
 * The union of all reference-type string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ReferenceType = typeof ReferenceType.Type;

/**
 * The two ways CommonMark spells a heading: `atx` (`# Title`) and `setext`
 * (a title underlined with `=` or `-`).
 *
 * **Example** (Validate HeadingStyle syntax)
 *
 * ```ts
 * import { HeadingStyle } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(HeadingStyle)("setext")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const HeadingStyle = LiteralKit(["atx", "setext"]).pipe(
  $I.annoteSchema("HeadingStyle", {
    description:
      "The two ways CommonMark spells a heading: `atx` (`# Title`) and `setext` (a title underlined with `=` or `-`).",
  })
);

/**
 * The union of all heading-style string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type HeadingStyle = typeof HeadingStyle.Type;

/**
 * The two ways CommonMark spells a hard line break: a trailing backslash or
 * two-or-more trailing spaces.
 *
 * **Example** (Validate BreakStyle syntax)
 *
 * ```ts
 * import { BreakStyle } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(BreakStyle)("backslash")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const BreakStyle = LiteralKit(["backslash", "spaces"]).pipe(
  $I.annoteSchema("BreakStyle", {
    description:
      "The two ways CommonMark spells a hard line break: a trailing backslash or two-or-more trailing spaces.",
  })
);

/**
 * The union of all break-style string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type BreakStyle = typeof BreakStyle.Type;

/**
 * The two fence characters a fenced code block may use.
 *
 * **Example** (Validate FenceChar syntax)
 *
 * ```ts
 * import { FenceChar } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FenceChar)("~")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FenceChar = LiteralKit(["`", "~"]).pipe(
  $I.annoteSchema("FenceChar", { description: "The two fence characters a fenced code block may use." })
);

/**
 * The union of all fence-character literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FenceChar = typeof FenceChar.Type;

/**
 * The three bullet characters an unordered list may use.
 *
 * **Example** (Validate BulletChar syntax)
 *
 * ```ts
 * import { BulletChar } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(BulletChar)("+")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const BulletChar = LiteralKit(["-", "*", "+"]).pipe(
  $I.annoteSchema("BulletChar", { description: "The three bullet characters an unordered list may use." })
);

/**
 * The union of all bullet-character literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type BulletChar = typeof BulletChar.Type;

/**
 * The two delimiters an ordered list marker may use (`1.` or `1)`).
 *
 * **Example** (Validate ListDelimiter syntax)
 *
 * ```ts
 * import { ListDelimiter } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ListDelimiter)(")")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ListDelimiter = LiteralKit([".", ")"]).pipe(
  $I.annoteSchema("ListDelimiter", { description: "The two delimiters an ordered list marker may use (`1.` or `1)`)." })
);

/**
 * The union of all ordered-list delimiter literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ListDelimiter = typeof ListDelimiter.Type;

/**
 * The three characters a thematic break may be drawn with.
 *
 * **Example** (Validate ThematicBreakChar syntax)
 *
 * ```ts
 * import { ThematicBreakChar } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ThematicBreakChar)("_")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ThematicBreakChar = LiteralKit(["-", "_", "*"]).pipe(
  $I.annoteSchema("ThematicBreakChar", { description: "The three characters a thematic break may be drawn with." })
);

/**
 * The union of all thematic-break character literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ThematicBreakChar = typeof ThematicBreakChar.Type;

/**
 * The two characters emphasis and strong emphasis may be marked with.
 *
 * **Example** (Validate EmphasisChar syntax)
 *
 * ```ts
 * import { EmphasisChar } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(EmphasisChar)("*")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const EmphasisChar = LiteralKit(["*", "_"]).pipe(
  $I.annoteSchema("EmphasisChar", {
    description: "The two characters emphasis and strong emphasis may be marked with.",
  })
);

/**
 * The union of all emphasis-marker character literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type EmphasisChar = typeof EmphasisChar.Type;

/**
 * The six legal ATX/setext heading depths.
 *
 * **Example** (Validate HeadingDepth syntax)
 *
 * ```ts
 * import { HeadingDepth } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(HeadingDepth)(3)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const HeadingDepth = LiteralKit([1, 2, 3, 4, 5, 6]).pipe(
  $I.annoteSchema("HeadingDepth", { description: "The six legal ATX/setext heading depths." })
);

/**
 * The union of all legal heading depths.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type HeadingDepth = typeof HeadingDepth.Type;

/**
 * The three alignments a GFM table column may declare. A `null` entry in a
 * {@link Table}'s `align` array means the column carries no alignment.
 *
 * **Example** (Validate TableAlign syntax)
 *
 * ```ts
 * import { TableAlign } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TableAlign)("center")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TableAlign = LiteralKit(["left", "right", "center"]).pipe(
  $I.annoteSchema("TableAlign", {
    description:
      "The three alignments a GFM table column may declare. A `null` entry in a Table's `align` array means the column carries no alignment.",
  })
);

/**
 * The union of all table-alignment string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TableAlign = typeof TableAlign.Type;

// --- Phrasing content -------------------------------------------------------

/**
 * Text — a run of literal characters, with entity references and backslash
 * escapes already resolved into `value`.
 *
 * **Gotchas**
 *
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
 * **Example** (Construct Text content)
 *
 * ```ts
 * import { Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Text.make({ value: "Hello", escapeStyle: "literal" });
 * console.log(node.value) // Hello
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Text extends S.Opaque<Text, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("text").pipe(
      $I.annoteKey("Text.type", { description: "The `text` discriminator identifying a run of literal characters" })
    ),
    value: S.String.pipe(
      $I.annoteKey("Text.value", {
        description: "Literal text content with entity references and backslash escapes already resolved",
      })
    ),
    escapeStyle: S.optionalKey(S.Literals(["canonical", "literal"])).pipe(
      $I.annoteKey("Text.escapeStyle", {
        description:
          "Emitter instruction selecting canonical inline escaping or literal output, while retaining escapes that protect surrounding block structure",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Text.position", {
        description: "Source span of the text run, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("Text", {
      description:
        "Text — a run of literal characters, with entity references and backslash escapes already resolved into `value`.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link Text}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Text {
  /**
   * The plain encoded fields of {@link Text}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly escapeStyle?: "canonical" | "literal";
    readonly position: Position.Encoded;
    readonly type: "text";
    readonly value: string;
  }
}

/**
 * InlineCode — a code span: `foo` written between backtick fences in the
 * source. `value` holds the span's content with the backtick fence stripped
 * and the spec's space-stripping applied.
 *
 * **Example** (Construct InlineCode content)
 *
 * ```ts
 * import { InlineCode } from "@beep/markdown/MarkdownNode";
 *
 * const node = InlineCode.make({ value: "foo" });
 * console.log(node.value) // foo
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class InlineCode extends S.Opaque<InlineCode, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("inlineCode").pipe(
      $I.annoteKey("InlineCode.type", { description: "The `inlineCode` discriminator identifying an inline code span" })
    ),
    value: S.String.pipe(
      $I.annoteKey("InlineCode.value", {
        description: "Code span content with backtick fences removed and CommonMark space stripping applied",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("InlineCode.position", {
        description: "Source span of the code span, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("InlineCode", {
      description:
        "InlineCode — a code span: `foo` written between backtick fences in the source. `value` holds the span's content with the backtick fence stripped and the spec's space-stripping applied.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link InlineCode}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace InlineCode {
  /**
   * The plain encoded fields of {@link InlineCode}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly position: Position.Encoded;
    readonly type: "inlineCode";
    readonly value: string;
  }
}

/**
 * Html — a fragment of raw HTML, kept verbatim. Used for both HTML blocks
 * (flow) and inline raw HTML (phrasing); the same node type serves both, as
 * mdast specifies.
 *
 * **Example** (Construct Html content)
 *
 * ```ts
 * import { Html } from "@beep/markdown/MarkdownNode";
 *
 * const node = Html.make({ value: "<b>Hi</b>" });
 * console.log(node.value) // <b>Hi</b>
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Html extends S.Opaque<Html, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("html").pipe(
      $I.annoteKey("Html.type", {
        description: "The `html` discriminator identifying raw HTML in block or inline position",
      })
    ),
    value: S.String.pipe($I.annoteKey("Html.value", { description: "Raw HTML source preserved verbatim" })),
    position: NodePosition.pipe(
      $I.annoteKey("Html.position", {
        description: "Source span of the HTML fragment, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("Html", {
      description:
        "Html — a fragment of raw HTML, kept verbatim. Used for both HTML blocks (flow) and inline raw HTML (phrasing); the same node type serves both, as mdast specifies.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link Html}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Html {
  /**
   * The plain encoded fields of {@link Html}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly position: Position.Encoded;
    readonly type: "html";
    readonly value: string;
  }
}

/**
 * Break — a hard line break.
 *
 * **Details**
 *
 * `breakStyle` is a fidelity extra recording which of the two CommonMark
 * spellings produced it.
 *
 * **Example** (Construct Break content)
 *
 * ```ts
 * import { Break } from "@beep/markdown/MarkdownNode";
 *
 * const node = Break.make({ breakStyle: "backslash" });
 * console.log(node.breakStyle) // backslash
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Break extends S.Opaque<Break, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("break").pipe(
      $I.annoteKey("Break.type", { description: "The `break` discriminator identifying a hard line break" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Break.position", {
        description: "Source span of the hard break, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    breakStyle: S.optionalKey(BreakStyle).pipe(
      $I.annoteKey("Break.breakStyle", {
        description: "Source spelling of the hard break: a trailing backslash or two or more trailing spaces",
      })
    ),
  }).pipe($I.annoteSchema("Break", { description: "Break — a hard line break." }))
) {}

/**
 * The encoded (wire) shape of {@link Break}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Break {
  /**
   * The plain encoded fields of {@link Break}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly breakStyle?: BreakStyle;
    readonly position: Position.Encoded;
    readonly type: "break";
  }
}

/**
 * Image — an inline image (`![alt](url "title")`).
 *
 * **Example** (Construct Image content)
 *
 * ```ts
 * import { Image } from "@beep/markdown/MarkdownNode";
 *
 * const node = Image.make({ url: "/photo.png", alt: "A tree" });
 * console.log(node.alt) // A tree
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Image extends S.Opaque<Image, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("image").pipe(
      $I.annoteKey("Image.type", {
        description: "The `image` discriminator identifying an inline image with a direct destination",
      })
    ),
    url: S.String.pipe(
      $I.annoteKey("Image.url", {
        description: "Image destination with source escapes resolved, without URI percent encoding",
      })
    ),
    title: S.optionalKey(S.String).pipe(
      $I.annoteKey("Image.title", {
        description: "Optional image title with enclosing delimiters removed and source escapes resolved",
      })
    ),
    alt: S.optionalKey(S.String).pipe(
      $I.annoteKey("Image.alt", { description: "Plain text alternative derived from the image's bracketed content" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Image.position", {
        description: "Source span of the image, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe($I.annoteSchema("Image", { description: 'Image — an inline image (`![alt](url "title")`).' }))
) {}

/**
 * The encoded (wire) shape of {@link Image}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Image {
  /**
   * The plain encoded fields of {@link Image}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly alt?: string;
    readonly position: Position.Encoded;
    readonly title?: string;
    readonly type: "image";
    readonly url: string;
  }
}

/**
 * ImageReference — an image referring to a {@link Definition} by identifier
 * (`![alt][ref]`).
 *
 * **Details**
 *
 * The parser emits these unresolved, whether or not a matching definition
 * exists in the tree — resolution is the consumer's business.
 *
 * **Example** (Construct ImageReference content)
 *
 * ```ts
 * import { ImageReference } from "@beep/markdown/MarkdownNode";
 *
 * const node = ImageReference.make({ identifier: "photo", referenceType: "full" });
 * console.log(node.identifier) // photo
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ImageReference extends S.Opaque<ImageReference, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("imageReference").pipe(
      $I.annoteKey("ImageReference.type", {
        description:
          "The `imageReference` discriminator identifying an image associated with a link reference definition",
      })
    ),
    identifier: S.String.pipe(
      $I.annoteKey("ImageReference.identifier", {
        description: "Normalized, lowercased reference label used to associate the image with a definition",
      })
    ),
    label: S.optionalKey(S.String).pipe(
      $I.annoteKey("ImageReference.label", {
        description: "Original reference label text with surrounding brackets removed",
      })
    ),
    referenceType: ReferenceType.pipe(
      $I.annoteKey("ImageReference.referenceType", {
        description:
          "Reference spelling: `shortcut`, `collapsed`, or `full`, recording whether a separate reference label was written",
      })
    ),
    alt: S.optionalKey(S.String).pipe(
      $I.annoteKey("ImageReference.alt", {
        description: "Plain text alternative derived from the reference image's bracketed content",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("ImageReference.position", {
        description: "Source span of the image reference, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("ImageReference", {
      description: "ImageReference — an image referring to a Definition by identifier (`![alt][ref]`).",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link ImageReference}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ImageReference {
  /**
   * The plain encoded fields of {@link ImageReference}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly alt?: string;
    readonly identifier: string;
    readonly label?: string;
    readonly position: Position.Encoded;
    readonly referenceType: ReferenceType;
    readonly type: "imageReference";
  }
}

/**
 * Emphasis — `*foo*` or `_foo_`.
 *
 * **Details**
 *
 * `markerChar` is a fidelity extra recording which marker produced it.
 *
 * **Example** (Construct Emphasis content)
 *
 * ```ts
 * import { Emphasis, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Emphasis.make({ children: [Text.make({ value: "soft" })], markerChar: "_" });
 * console.log(node.markerChar) // _
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Emphasis extends S.Opaque<Emphasis, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("emphasis").pipe(
      $I.annoteKey("Emphasis.type", {
        description: "The `emphasis` discriminator identifying emphasized inline content",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("Emphasis.children", {
        description: "Inline content enclosed by emphasis markers, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Emphasis.position", {
        description: "Source span of the emphasis, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    markerChar: S.optionalKey(EmphasisChar).pipe(
      $I.annoteKey("Emphasis.markerChar", { description: "Source character used for emphasis markers: `*` or `_`" })
    ),
  }).pipe($I.annoteSchema("Emphasis", { description: "Emphasis — `*foo*` or `_foo_`." }))
) {}

/**
 * The encoded (wire) shape of {@link Emphasis}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Emphasis {
  /**
   * The plain encoded fields of {@link Emphasis}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly markerChar?: EmphasisChar;
    readonly position: Position.Encoded;
    readonly type: "emphasis";
  }
}

/**
 * Strong — `**foo**` or `__foo__`.
 *
 * **Details**
 *
 * `markerChar` is a fidelity extra recording which marker produced it.
 *
 * **Example** (Construct Strong content)
 *
 * ```ts
 * import { Strong, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Strong.make({ children: [Text.make({ value: "bold" })], markerChar: "*" });
 * console.log(node.markerChar) // *
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Strong extends S.Opaque<Strong, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("strong").pipe(
      $I.annoteKey("Strong.type", {
        description: "The `strong` discriminator identifying strongly emphasized inline content",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("Strong.children", {
        description: "Inline content enclosed by strong emphasis markers, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Strong.position", {
        description: "Source span of the strong emphasis, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    markerChar: S.optionalKey(EmphasisChar).pipe(
      $I.annoteKey("Strong.markerChar", {
        description: "Source character doubled for strong emphasis markers: `*` or `_`",
      })
    ),
  }).pipe($I.annoteSchema("Strong", { description: "Strong — `**foo**` or `__foo__`." }))
) {}

/**
 * The encoded (wire) shape of {@link Strong}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Strong {
  /**
   * The plain encoded fields of {@link Strong}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly markerChar?: EmphasisChar;
    readonly position: Position.Encoded;
    readonly type: "strong";
  }
}

/**
 * Delete — GFM strikethrough (`~~foo~~`). Content that is no longer accurate
 * or relevant.
 *
 * **Details**
 *
 * `~~` is the only marker `~~foo~~` renders through, so unlike
 * {@link Emphasis} and {@link Strong} there is no marker-character fidelity
 * extra to carry.
 *
 * **Example** (Construct Delete content)
 *
 * ```ts
 * import { Delete, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Delete.make({ children: [Text.make({ value: "old" })] });
 * console.log(node.children.length) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Delete extends S.Opaque<Delete, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("delete").pipe(
      $I.annoteKey("Delete.type", { description: "The `delete` discriminator identifying GFM strikethrough content" })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("Delete.children", {
        description: "Inline content marked as no longer accurate or relevant by strikethrough, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Delete.position", {
        description: "Source span of the strikethrough, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("Delete", {
      description: "Delete — GFM strikethrough (`~~foo~~`). Content that is no longer accurate or relevant.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link Delete}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Delete {
  /**
   * The plain encoded fields of {@link Delete}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly position: Position.Encoded;
    readonly type: "delete";
  }
}

/**
 * Link — an inline link (`[text](url "title")`), including autolinks.
 *
 * **Example** (Construct Link content)
 *
 * ```ts
 * import { Link, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Link.make({ url: "/guide", children: [Text.make({ value: "Guide" })] });
 * console.log(node.url) // /guide
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Link extends S.Opaque<Link, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("link").pipe(
      $I.annoteKey("Link.type", {
        description: "The `link` discriminator identifying an inline link or autolink with a direct destination",
      })
    ),
    url: S.String.pipe(
      $I.annoteKey("Link.url", {
        description: "Link destination with source escapes resolved, without URI percent encoding",
      })
    ),
    title: S.optionalKey(S.String).pipe(
      $I.annoteKey("Link.title", {
        description: "Optional link title with enclosing delimiters removed and source escapes resolved",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("Link.children", { description: "Inline content displayed as the link text, in document order" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Link.position", {
        description: "Source span of the link, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("Link", { description: 'Link — an inline link (`[text](url "title")`), including autolinks.' })
  )
) {}

/**
 * The encoded (wire) shape of {@link Link}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Link {
  /**
   * The plain encoded fields of {@link Link}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly position: Position.Encoded;
    readonly title?: string;
    readonly type: "link";
    readonly url: string;
  }
}

/**
 * LinkReference — a link referring to a {@link Definition} by identifier
 * (`[text][ref]`).
 *
 * **Details**
 *
 * Emitted unresolved, on the same terms as {@link ImageReference}.
 *
 * **Example** (Construct LinkReference content)
 *
 * ```ts
 * import { LinkReference, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = LinkReference.make({ identifier: "guide", referenceType: "full", children: [Text.make({ value: "Guide" })] });
 * console.log(node.identifier) // guide
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LinkReference extends S.Opaque<LinkReference, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("linkReference").pipe(
      $I.annoteKey("LinkReference.type", {
        description: "The `linkReference` discriminator identifying a link associated with a reference definition",
      })
    ),
    identifier: S.String.pipe(
      $I.annoteKey("LinkReference.identifier", {
        description: "Normalized, lowercased reference label used to associate the link with a definition",
      })
    ),
    label: S.optionalKey(S.String).pipe(
      $I.annoteKey("LinkReference.label", {
        description: "Original reference label text with surrounding brackets removed",
      })
    ),
    referenceType: ReferenceType.pipe(
      $I.annoteKey("LinkReference.referenceType", {
        description:
          "Reference spelling: `shortcut`, `collapsed`, or `full`, recording whether a separate reference label was written",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("LinkReference.children", {
        description: "Inline content displayed as the reference link's text, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("LinkReference.position", {
        description: "Source span of the link reference, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("LinkReference", {
      description: "LinkReference — a link referring to a Definition by identifier (`[text][ref]`).",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link LinkReference}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LinkReference {
  /**
   * The plain encoded fields of {@link LinkReference}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly identifier: string;
    readonly label?: string;
    readonly position: Position.Encoded;
    readonly referenceType: ReferenceType;
    readonly type: "linkReference";
  }
}

/**
 * FootnoteReference — a GFM footnote marker (`[^alpha]`), associating this
 * point in the text with a {@link FootnoteDefinition} by identifier.
 *
 * **Details**
 *
 * Has no content model of its own — the marker carries no children, only the
 * mdast Association pair `identifier`/`label`. Like {@link LinkReference},
 * the parser emits these unresolved: resolution against a matching
 * `FootnoteDefinition` is the consumer's business.
 *
 * **Example** (Construct FootnoteReference content)
 *
 * ```ts
 * import { FootnoteReference } from "@beep/markdown/MarkdownNode";
 *
 * const node = FootnoteReference.make({ identifier: "alpha" });
 * console.log(node.identifier) // alpha
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class FootnoteReference extends S.Opaque<FootnoteReference, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("footnoteReference").pipe(
      $I.annoteKey("FootnoteReference.type", {
        description: "The `footnoteReference` discriminator identifying a GFM footnote marker",
      })
    ),
    identifier: S.String.pipe(
      $I.annoteKey("FootnoteReference.identifier", {
        description: "Normalized, lowercased footnote label used to associate the marker with a footnote definition",
      })
    ),
    label: S.optionalKey(S.String).pipe(
      $I.annoteKey("FootnoteReference.label", {
        description: "Original footnote label text without the surrounding brackets and leading caret",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("FootnoteReference.position", {
        description: "Source span of the footnote marker, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("FootnoteReference", {
      description:
        "FootnoteReference — a GFM footnote marker (`[^alpha]`), associating this point in the text with a FootnoteDefinition by identifier.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link FootnoteReference}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FootnoteReference {
  /**
   * The plain encoded fields of {@link FootnoteReference}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly identifier: string;
    readonly label?: string;
    readonly position: Position.Encoded;
    readonly type: "footnoteReference";
  }
}

/**
 * The union of every node that may appear where mdast expects **phrasing**
 * content — the text of a document and its markup.
 *
 * **Details**
 *
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `PhrasingContent -> Emphasis/Strong/Link/LinkReference -> PhrasingContent`.
 *
 * **Example** (Admit Text content)
 *
 * ```ts
 * import { PhrasingContent, Text } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * const node = Text.make({ value: "Hello" });
 * console.log(S.is(PhrasingContent)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PhrasingContent: S.Codec<PhrasingContent, PhrasingContentEncoded> = S.suspend(() =>
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
  ])
).pipe(
  $I.annoteSchema("PhrasingContent", {
    description: "Nodes admitted as inline text and markup, including constructed MDX text elements and expressions.",
  })
);

/**
 * The union of all phrasing-content node types. Widened for MDX with
 * {@link MdxJsxTextElement} and {@link MdxTextExpression}, per
 * mdast-util-mdx's `PhrasingContentMap` registrations — the parser never
 * produces either; they serve constructed trees.
 *
 * @public
 * @category type-level
 * @since 0.0.0
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
 * **Details**
 *
 * `markerChar` is a fidelity extra recording which character drew it.
 *
 * **Example** (Construct ThematicBreak content)
 *
 * ```ts
 * import { ThematicBreak } from "@beep/markdown/MarkdownNode";
 *
 * const node = ThematicBreak.make({ markerChar: "_" });
 * console.log(node.markerChar) // _
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ThematicBreak extends S.Opaque<ThematicBreak, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("thematicBreak").pipe(
      $I.annoteKey("ThematicBreak.type", {
        description: "The `thematicBreak` discriminator identifying a horizontal rule",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("ThematicBreak.position", {
        description: "Source span of the horizontal rule, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    markerChar: S.optionalKey(ThematicBreakChar).pipe(
      $I.annoteKey("ThematicBreak.markerChar", {
        description: "Source character used to draw the horizontal rule: `-`, `_`, or `*`",
      })
    ),
  }).pipe($I.annoteSchema("ThematicBreak", { description: "ThematicBreak — a horizontal rule (`---`, `***`, `___`)." }))
) {}

/**
 * The encoded (wire) shape of {@link ThematicBreak}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ThematicBreak {
  /**
   * The plain encoded fields of {@link ThematicBreak}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly markerChar?: ThematicBreakChar;
    readonly position: Position.Encoded;
    readonly type: "thematicBreak";
  }
}

/**
 * Code — a code block, fenced or indented.
 *
 * **Details**
 *
 * `lang` and `meta` split the fence's info string at the first run of
 * whitespace. The fidelity extras `fenceChar` and `fenceLength` are present
 * for fenced blocks and **absent for indented blocks** — their absence is how
 * the two are told apart on the way back out. `unterminated` is `true` on a
 * parsed fenced block whose closing fence never came, and absent otherwise.
 *
 * **Gotchas**
 *
 * A consequence worth knowing before it surprises: a language-less `Code`
 * node with no explicit `fenceChar` **serializes as an indented block**
 * through `Markdown.stringify`. To get a fence, set `fenceChar` on the node
 * (or a `lang`, which forces one), or format the emitted source with
 * `MarkdownFormattingOptions.codeBlockStyle: "fenced"`.
 *
 * **Example** (Construct Code content)
 *
 * ```ts
 * import { Code } from "@beep/markdown/MarkdownNode";
 *
 * const node = Code.make({ value: "const x = 1", lang: "ts", fenceChar: "~" });
 * console.log(node.fenceChar) // ~
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Code extends S.Opaque<Code, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("code").pipe(
      $I.annoteKey("Code.type", { description: "The `code` discriminator identifying a fenced or indented code block" })
    ),
    value: S.String.pipe(
      $I.annoteKey("Code.value", { description: "Code block content with fence lines or code indentation removed" })
    ),
    lang: S.optionalKey(S.String).pipe(
      $I.annoteKey("Code.lang", {
        description: "Language token preceding the first whitespace run in a fenced code block's info string",
      })
    ),
    meta: S.optionalKey(S.String).pipe(
      $I.annoteKey("Code.meta", {
        description: "Additional fence info following the language token and its separating whitespace",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Code.position", {
        description: "Source span of the code block, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    fenceChar: S.optionalKey(FenceChar).pipe(
      $I.annoteKey("Code.fenceChar", {
        description: "Source fence character, backtick or tilde; absent on parsed indented code blocks",
      })
    ),
    fenceLength: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("Code.fenceLength", {
        description: "Number of repeated characters in the opening fence; absent on parsed indented code blocks",
      })
    ),
    unterminated: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Code.unterminated", {
        description:
          "Present and true on a parsed fenced block that no closing fence ended (the document or its container ended first)",
      })
    ),
  }).pipe($I.annoteSchema("Code", { description: "Code — a code block, fenced or indented." }))
) {}

/**
 * The encoded (wire) shape of {@link Code}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Code {
  /**
   * The plain encoded fields of {@link Code}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly fenceChar?: FenceChar;
    readonly fenceLength?: number;
    readonly lang?: string;
    readonly meta?: string;
    readonly position: Position.Encoded;
    readonly type: "code";
    readonly unterminated?: boolean;
    readonly value: string;
  }
}

/**
 * Definition — a link reference definition (`[ref]: /url "title"`).
 *
 * **Details**
 *
 * Kept in the tree at its source position rather than stripped, which is the
 * deliberate departure from commonmark.js and the reason references can stay
 * unresolved.
 *
 * **Example** (Construct Definition content)
 *
 * ```ts
 * import { Definition } from "@beep/markdown/MarkdownNode";
 *
 * const node = Definition.make({ identifier: "guide", url: "/guide" });
 * console.log(node.url) // /guide
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Definition extends S.Opaque<Definition, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("definition").pipe(
      $I.annoteKey("Definition.type", {
        description: "The `definition` discriminator identifying a link reference definition",
      })
    ),
    identifier: S.String.pipe(
      $I.annoteKey("Definition.identifier", {
        description: "Normalized, lowercased label used to associate links and images with this definition",
      })
    ),
    label: S.optionalKey(S.String).pipe(
      $I.annoteKey("Definition.label", {
        description: "Original definition label text with surrounding brackets removed",
      })
    ),
    url: S.String.pipe(
      $I.annoteKey("Definition.url", {
        description: "Defined link or image destination with source escapes resolved, without URI percent encoding",
      })
    ),
    title: S.optionalKey(S.String).pipe(
      $I.annoteKey("Definition.title", {
        description: "Optional destination title with enclosing delimiters removed and source escapes resolved",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Definition.position", {
        description:
          "Source span of the reference definition, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("Definition", { description: 'Definition — a link reference definition (`[ref]: /url "title"`).' })
  )
) {}

/**
 * The encoded (wire) shape of {@link Definition}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Definition {
  /**
   * The plain encoded fields of {@link Definition}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly identifier: string;
    readonly label?: string;
    readonly position: Position.Encoded;
    readonly title?: string;
    readonly type: "definition";
    readonly url: string;
  }
}

/**
 * FootnoteDefinition — a GFM footnote definition (`[^alpha]: bravo.`), the
 * content a {@link FootnoteReference} points at.
 *
 * **Details**
 *
 * Kept in the tree at its source position, on the same terms as
 * {@link Definition} — the parser never relocates it; a consumer that wants
 * cmark-gfm's end-of-document footnote section renders it there instead.
 *
 * **Example** (Construct FootnoteDefinition content)
 *
 * ```ts
 * import { FootnoteDefinition } from "@beep/markdown/MarkdownNode";
 *
 * const node = FootnoteDefinition.make({ identifier: "alpha", children: [] });
 * console.log(node.identifier) // alpha
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class FootnoteDefinition extends S.Opaque<FootnoteDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("footnoteDefinition").pipe(
      $I.annoteKey("FootnoteDefinition.type", {
        description: "The `footnoteDefinition` discriminator identifying a GFM footnote definition",
      })
    ),
    identifier: S.String.pipe(
      $I.annoteKey("FootnoteDefinition.identifier", {
        description: "Normalized, lowercased label used to associate footnote markers with this definition",
      })
    ),
    label: S.optionalKey(S.String).pipe(
      $I.annoteKey("FootnoteDefinition.label", {
        description: "Original footnote label text without the surrounding brackets and leading caret",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<FlowContent, FlowContentEncoded> => FlowContent)).pipe(
      $I.annoteKey("FootnoteDefinition.children", {
        description: "Block content forming the footnote body, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("FootnoteDefinition.position", {
        description:
          "Source span of the footnote definition, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("FootnoteDefinition", {
      description:
        "FootnoteDefinition — a GFM footnote definition (`[^alpha]: bravo.`), the content a FootnoteReference points at.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link FootnoteDefinition}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FootnoteDefinition {
  /**
   * The plain encoded fields of {@link FootnoteDefinition}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<FlowContentEncoded>;
    readonly identifier: string;
    readonly label?: string;
    readonly position: Position.Encoded;
    readonly type: "footnoteDefinition";
  }
}

/**
 * Paragraph — a run of phrasing content.
 *
 * **Example** (Construct Paragraph content)
 *
 * ```ts
 * import { Paragraph, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Paragraph.make({ children: [Text.make({ value: "Hello" })] });
 * console.log(node.children.length) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Paragraph extends S.Opaque<Paragraph, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("paragraph").pipe(
      $I.annoteKey("Paragraph.type", {
        description: "The `paragraph` discriminator identifying a paragraph of inline content",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("Paragraph.children", { description: "Inline content forming the paragraph, in document order" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Paragraph.position", {
        description: "Source span of the paragraph, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe($I.annoteSchema("Paragraph", { description: "Paragraph — a run of phrasing content." }))
) {}

/**
 * The encoded (wire) shape of {@link Paragraph}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Paragraph {
  /**
   * The plain encoded fields of {@link Paragraph}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly position: Position.Encoded;
    readonly type: "paragraph";
  }
}

/**
 * Heading — an ATX or setext heading of depth 1 to 6.
 *
 * **Details**
 *
 * `headingStyle` is a fidelity extra recording which spelling produced it;
 * setext headings can only be depth 1 or 2.
 *
 * **Example** (Construct Heading content)
 *
 * ```ts
 * import { Heading, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Heading.make({ depth: 2, headingStyle: "setext", children: [Text.make({ value: "Title" })] });
 * console.log(node.depth) // 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Heading extends S.Opaque<Heading, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("heading").pipe(
      $I.annoteKey("Heading.type", { description: "The `heading` discriminator identifying an ATX or setext heading" })
    ),
    depth: HeadingDepth.pipe(
      $I.annoteKey("Heading.depth", { description: "Heading level from 1 to 6, with 1 representing the highest level" })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("Heading.children", { description: "Inline content forming the heading text, in document order" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Heading.position", {
        description: "Source span of the heading, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    headingStyle: S.optionalKey(HeadingStyle).pipe(
      $I.annoteKey("Heading.headingStyle", {
        description: "Source spelling of the heading: `atx` hash markers or a `setext` underline",
      })
    ),
  }).pipe($I.annoteSchema("Heading", { description: "Heading — an ATX or setext heading of depth 1 to 6." }))
) {}

/**
 * The encoded (wire) shape of {@link Heading}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Heading {
  /**
   * The plain encoded fields of {@link Heading}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly depth: HeadingDepth;
    readonly headingStyle?: HeadingStyle;
    readonly position: Position.Encoded;
    readonly type: "heading";
  }
}

/**
 * ListItem — one item of a {@link List}.
 *
 * **Details**
 *
 * `spread` follows mdast in being optional: absent means "not known", which a
 * hand-built tree may legitimately be. The parser always sets it.
 *
 * `checked` is a GFM extra (task-list items, `- [ ] foo` / `- [x] foo`):
 * `true` for done, `false` for not done, and **absent** — never `null` — for
 * an item that is not a task-list item at all. The parser only ever sets it
 * on items it recognized as task-list markers.
 *
 * **Example** (Construct ListItem content)
 *
 * ```ts
 * import { ListItem } from "@beep/markdown/MarkdownNode";
 *
 * const node = ListItem.make({ checked: false, children: [] });
 * console.log(node.checked) // false
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ListItem extends S.Opaque<ListItem, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("listItem").pipe(
      $I.annoteKey("ListItem.type", { description: "The `listItem` discriminator identifying one item in a list" })
    ),
    spread: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ListItem.spread", {
        description: "Whether blank lines separate the item's child blocks; absent means unknown",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<FlowContent, FlowContentEncoded> => FlowContent)).pipe(
      $I.annoteKey("ListItem.children", { description: "Block content belonging to the list item, in document order" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("ListItem.position", {
        description: "Source span of the list item, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    checked: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ListItem.checked", {
        description: "Task completion state: `true` for done, `false` for unfinished, absent for an ordinary list item",
      })
    ),
  }).pipe($I.annoteSchema("ListItem", { description: "ListItem — one item of a List." }))
) {}

/**
 * The encoded (wire) shape of {@link ListItem}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ListItem {
  /**
   * The plain encoded fields of {@link ListItem}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly checked?: boolean;
    readonly children: ReadonlyArray<FlowContentEncoded>;
    readonly position: Position.Encoded;
    readonly spread?: boolean;
    readonly type: "listItem";
  }
}

/**
 * List — an ordered or unordered list.
 *
 * **Details**
 *
 * `ordered`, `start` and `spread` are all optional per mdast (absent meaning
 * "not known"); the parser always sets `ordered` and `spread`, and sets
 * `start` only for ordered lists.
 *
 * The fidelity extras record the marker actually used: `bulletChar` for
 * unordered lists, `delimiter` for ordered ones.
 *
 * **Example** (Construct List content)
 *
 * ```ts
 * import { List, ListItem } from "@beep/markdown/MarkdownNode";
 *
 * const node = List.make({ ordered: true, start: 3, delimiter: ")", children: [ListItem.make({ children: [] })] });
 * console.log(node.start) // 3
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class List extends S.Opaque<List, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("list").pipe(
      $I.annoteKey("List.type", { description: "The `list` discriminator identifying an ordered or unordered list" })
    ),
    ordered: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("List.ordered", {
        description: "Whether the list uses numbered markers rather than bullets; absent means unknown",
      })
    ),
    start: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("List.start", {
        description: "Starting number from an ordered list's first marker; absent on parsed unordered lists",
      })
    ),
    spread: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("List.spread", {
        description:
          "Whether blank lines separate items or blocks within items, making the list loose; absent means unknown",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<ListContent, ListContentEncoded> => ListContent)).pipe(
      $I.annoteKey("List.children", { description: "List items in document order" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("List.position", {
        description: "Source span of the list, constructor-defaulted to the zero-width synthetic position",
      })
    ),
    bulletChar: S.optionalKey(BulletChar).pipe(
      $I.annoteKey("List.bulletChar", {
        description: "Source marker character for an unordered list: `-`, `*`, or `+`",
      })
    ),
    delimiter: S.optionalKey(ListDelimiter).pipe(
      $I.annoteKey("List.delimiter", {
        description: "Source character following an ordered list's marker number: `.` or `)`",
      })
    ),
  }).pipe($I.annoteSchema("List", { description: "List — an ordered or unordered list." }))
) {}

/**
 * The encoded (wire) shape of {@link List}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace List {
  /**
   * The plain encoded fields of {@link List}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly bulletChar?: BulletChar;
    readonly children: ReadonlyArray<ListContentEncoded>;
    readonly delimiter?: ListDelimiter;
    readonly ordered?: boolean;
    readonly position: Position.Encoded;
    readonly spread?: boolean;
    readonly start?: number;
    readonly type: "list";
  }
}

/**
 * Blockquote — a section quoted from somewhere else.
 *
 * **Example** (Construct Blockquote content)
 *
 * ```ts
 * import { Blockquote, Paragraph } from "@beep/markdown/MarkdownNode";
 *
 * const node = Blockquote.make({ children: [Paragraph.make({ children: [] })] });
 * console.log(node.children.length) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Blockquote extends S.Opaque<Blockquote, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("blockquote").pipe(
      $I.annoteKey("Blockquote.type", { description: "The `blockquote` discriminator identifying a quoted section" })
    ),
    children: S.Array(S.suspend((): S.Codec<FlowContent, FlowContentEncoded> => FlowContent)).pipe(
      $I.annoteKey("Blockquote.children", {
        description: "Block content contained in the quoted section, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Blockquote.position", {
        description: "Source span of the blockquote, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe($I.annoteSchema("Blockquote", { description: "Blockquote — a section quoted from somewhere else." }))
) {}

/**
 * The encoded (wire) shape of {@link Blockquote}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Blockquote {
  /**
   * The plain encoded fields of {@link Blockquote}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<FlowContentEncoded>;
    readonly position: Position.Encoded;
    readonly type: "blockquote";
  }
}

/**
 * TableCell — one cell of a {@link TableRow}: a header cell if its
 * grandparent {@link Table}'s first row, a data cell otherwise.
 *
 * **Details**
 *
 * mdast's content model for `TableCell` is phrasing content **excluding**
 * `Break` nodes — GFM tables are single-line source, so a hard break cannot
 * occur inside one. This schema does not carve that exclusion out of
 * `PhrasingContent`: a second phrasing union just for table cells would
 * duplicate the whole recursive-suspend machinery above for one excluded
 * member, and a parser that never emits `Break` inside a cell satisfies the
 * exclusion in practice without it.
 *
 * **Example** (Construct TableCell content)
 *
 * ```ts
 * import { TableCell, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = TableCell.make({ children: [Text.make({ value: "Name" })] });
 * console.log(node.children.length) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TableCell extends S.Opaque<TableCell, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("tableCell").pipe(
      $I.annoteKey("TableCell.type", {
        description: "The `tableCell` discriminator identifying a header or data cell in a GFM table",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("TableCell.children", { description: "Inline content forming the table cell, in document order" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("TableCell.position", {
        description:
          "Source span of the trimmed cell content, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("TableCell", {
      description:
        "TableCell — one cell of a TableRow: a header cell if its grandparent Table's first row, a data cell otherwise.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link TableCell}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TableCell {
  /**
   * The plain encoded fields of {@link TableCell}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly position: Position.Encoded;
    readonly type: "tableCell";
  }
}

/**
 * The union of every node that may appear where mdast expects **row**
 * content — the cells in a {@link TableRow}. A one-member union, kept because
 * mdast names the category.
 *
 * **Details**
 *
 * A REAL `Schema.Union`, not a bare suspended member reference. `make`
 * validates and copies nested nodes whether the field names the member
 * schema directly or — as here — wraps it in a `Schema.Union`, so the
 * wrapper changes no construction cost. It is kept because mdast names the
 * category: the `children` fields of `TableRow`,
 * `Table` and `List` point at these category unions to mirror mdast's
 * content-model vocabulary, not for a performance reason.
 *
 * **Example** (Admit TableCell content)
 *
 * ```ts
 * import { RowContent, TableCell } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * const node = TableCell.make({ children: [] });
 * console.log(S.is(RowContent)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const RowContent: S.Codec<RowContent, RowContentEncoded> = S.suspend(() => S.Union([TableCell])).pipe(
  $I.annoteSchema("RowContent", { description: "Table-cell nodes admitted as children of a table row." })
);

/**
 * The union of all row-content node types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RowContent = TableCell;

/**
 * TableRow — one row of a {@link Table}: the labels of the columns if it is
 * the table's first row, a data row otherwise.
 *
 * **Example** (Construct TableRow content)
 *
 * ```ts
 * import { TableCell, TableRow } from "@beep/markdown/MarkdownNode";
 *
 * const node = TableRow.make({ children: [TableCell.make({ children: [] })] });
 * console.log(node.children.length) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TableRow extends S.Opaque<TableRow, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("tableRow").pipe(
      $I.annoteKey("TableRow.type", {
        description: "The `tableRow` discriminator identifying a header or data row in a GFM table",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<RowContent, RowContentEncoded> => RowContent)).pipe(
      $I.annoteKey("TableRow.children", { description: "Table cells in column order" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("TableRow.position", {
        description: "Source span of the table row, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("TableRow", {
      description:
        "TableRow — one row of a Table: the labels of the columns if it is the table's first row, a data row otherwise.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link TableRow}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TableRow {
  /**
   * The plain encoded fields of {@link TableRow}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<RowContentEncoded>;
    readonly position: Position.Encoded;
    readonly type: "tableRow";
  }
}

/**
 * The union of every node that may appear where mdast expects **table**
 * content — the rows in a {@link Table}. A one-member union, kept because
 * mdast names the category — and a real `Schema.Union`, as documented on
 * `RowContent`.
 *
 * **Example** (Admit TableRow content)
 *
 * ```ts
 * import { TableContent, TableRow } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * const node = TableRow.make({ children: [] });
 * console.log(S.is(TableContent)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TableContent: S.Codec<TableContent, TableContentEncoded> = S.suspend(() => S.Union([TableRow])).pipe(
  $I.annoteSchema("TableContent", { description: "Table-row nodes admitted as children of a table." })
);

/**
 * The union of all table-content node types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TableContent = TableRow;

/**
 * Table — GFM two-dimensional data.
 *
 * **Details**
 *
 * `align` is optional per mdast: absent means "not known" — which the parser
 * never produces, since a GFM table's delimiter row always yields one
 * `TableAlign | null` entry per column, but a hand-built tree may omit it.
 * When present, each entry is `null` for a column with no declared alignment.
 *
 * **Example** (Construct Table content)
 *
 * ```ts
 * import { Table } from "@beep/markdown/MarkdownNode";
 *
 * const node = Table.make({ align: ["left", null], children: [] });
 * console.log(node.align?.length) // 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Table extends S.Opaque<Table, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("table").pipe(
      $I.annoteKey("Table.type", { description: "The `table` discriminator identifying a GFM table" })
    ),
    align: TableAlign.pipe(
      S.NullOr,
      S.Array,
      S.optionalKey,
      $I.annoteKey("Table.align", {
        description:
          "Declared alignment per column; `null` means no declared alignment, while an absent array means unknown",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<TableContent, TableContentEncoded> => TableContent)).pipe(
      $I.annoteKey("Table.children", {
        description: "Table rows in document order, with the first row supplying column labels",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Table.position", {
        description: "Source span of the table, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe($I.annoteSchema("Table", { description: "Table — GFM two-dimensional data." }))
) {}

/**
 * The encoded (wire) shape of {@link Table}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Table {
  /**
   * The plain encoded fields of {@link Table}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly align?: ReadonlyArray<TableAlign | null>;
    readonly children: ReadonlyArray<TableContentEncoded>;
    readonly position: Position.Encoded;
    readonly type: "table";
  }
}

/**
 * The union of every node that may appear where mdast expects **flow**
 * content — the sections of a document.
 *
 * **Details**
 *
 * Defined lazily via `Schema.suspend` to break the recursive reference chain
 * `FlowContent -> Blockquote/List -> FlowContent`. Widened for GFM with
 * {@link FootnoteDefinition} and {@link Table}, per mdast's `FlowContent`
 * (GFM) category.
 *
 * **Example** (Admit Paragraph content)
 *
 * ```ts
 * import { FlowContent, Paragraph } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * const node = Paragraph.make({ children: [] });
 * console.log(S.is(FlowContent)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FlowContent: S.Codec<FlowContent, FlowContentEncoded> = S.suspend(() =>
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
  ])
).pipe(
  $I.annoteSchema("FlowContent", {
    description:
      "Nodes admitted as block content, including GFM tables and footnotes and constructed MDX flow content.",
  })
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
 * @category type-level
 * @since 0.0.0
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
 * later dialects widen it — and a real `Schema.Union`, as documented on
 * `RowContent`.
 *
 * **Example** (Admit ListItem content)
 *
 * ```ts
 * import { ListContent, ListItem } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * const node = ListItem.make({ children: [] });
 * console.log(S.is(ListContent)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ListContent: S.Codec<ListContent, ListContentEncoded> = S.suspend(() => S.Union([ListItem])).pipe(
  $I.annoteSchema("ListContent", { description: "List-item nodes admitted as children of a list." })
);

/**
 * The union of all list-content node types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
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
 * **Details**
 *
 * The primary construction path is a JSON-encoded prop:
 * `MdxJsxAttributeValueExpression.make({ value: JSON.stringify(props) })`.
 *
 * **Example** (Construct MdxJsxAttributeValueExpression content)
 *
 * ```ts
 * import { MdxJsxAttributeValueExpression } from "@beep/markdown/MarkdownMdx";
 *
 * const node = MdxJsxAttributeValueExpression.make({ value: JSON.stringify({ enabled: true }) });
 * console.log(node.value) // {"enabled":true}
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxJsxAttributeValueExpression extends S.Opaque<
  MdxJsxAttributeValueExpression,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    type: S.tag("mdxJsxAttributeValueExpression").pipe(
      $I.annoteKey("MdxJsxAttributeValueExpression.type", {
        description:
          "The `mdxJsxAttributeValueExpression` discriminator identifying an expression used as a JSX attribute value",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("MdxJsxAttributeValueExpression.value", {
        description: "Unevaluated expression source between the braces of a JSX attribute value",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxJsxAttributeValueExpression.position", {
        description:
          "Source span of the attribute value expression, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("MdxJsxAttributeValueExpression", {
      description:
        "MdxJsxAttributeValueExpression — a JSX attribute value written as an expression (`<a b={c} />`); `value` holds the expression source text between the braces, never evaluated or parsed.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxJsxAttributeValueExpression}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxJsxAttributeValueExpression {
  /**
   * The plain encoded fields of {@link MdxJsxAttributeValueExpression}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly position: Position.Encoded;
    readonly type: "mdxJsxAttributeValueExpression";
    readonly value: string;
  }
}

const MdxJsxName = S.NonEmptyString.pipe(
  $I.annoteSchema("MdxJsxName", {
    description: "A non-empty JSX element or attribute name, including namespace spelling.",
  })
);

/**
 * MdxJsxAttribute — a named JSX attribute (`<a b="c" />`). `value` is a
 * string literal, a {@link MdxJsxAttributeValueExpression}, or — for a
 * boolean attribute (`<a b />`) — absent or `null`, both of which the
 * mdast-util-mdx-jsx contract spells (its parser writes `null`; absence is
 * the constructed-tree spelling). The serializer treats the two identically.
 *
 * **Details**
 *
 * `name` must be non-empty — an attribute without a name has no MDX spelling,
 * so the schema refuses it at construction and decode (the oracle's
 * serialize-time crash, moved to the admission boundary).
 *
 * **Example** (Construct MdxJsxAttribute content)
 *
 * ```ts
 * import { MdxJsxAttribute } from "@beep/markdown/MarkdownMdx";
 *
 * const node = MdxJsxAttribute.make({ name: "disabled", value: null });
 * console.log(node.value) // null
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxJsxAttribute extends S.Opaque<MdxJsxAttribute, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mdxJsxAttribute").pipe(
      $I.annoteKey("MdxJsxAttribute.type", {
        description: "The `mdxJsxAttribute` discriminator identifying a named JSX attribute",
      })
    ),
    name: MdxJsxName.pipe(
      $I.annoteKey("MdxJsxAttribute.name", {
        description: "Non-empty JSX attribute name, including namespace spelling when present",
      })
    ),
    value: S.Union([MdxJsxAttributeValueExpression, S.String]).pipe(
      S.NullOr,
      S.optionalKey,
      $I.annoteKey("MdxJsxAttribute.value", {
        description: "Attribute string literal or unevaluated expression; absent or null denotes a boolean attribute",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxJsxAttribute.position", {
        description: "Source span of the named attribute, constructor-defaulted to the synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("MdxJsxAttribute", {
      description:
        'MdxJsxAttribute — a named JSX attribute (`<a b="c" />`). `value` is a string literal, a MdxJsxAttributeValueExpression, or — for a boolean attribute (`<a b />`) — absent or `null`, both of which the mdast-util-mdx-jsx contract spells (its parser writes `null`; absence is the constructed-tree spelling). The serializer treats the two identically.',
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxJsxAttribute}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxJsxAttribute {
  /**
   * The plain encoded fields of {@link MdxJsxAttribute}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly name: string;
    readonly position: Position.Encoded;
    readonly type: "mdxJsxAttribute";
    readonly value?: MdxJsxAttributeValueExpression.Encoded | string | null;
  }
}

/**
 * MdxJsxExpressionAttribute — a JSX attribute written whole as an expression
 * (`<a {...b} />`); `value` holds the expression source text between the
 * braces.
 *
 * **Example** (Construct MdxJsxExpressionAttribute content)
 *
 * ```ts
 * import { MdxJsxExpressionAttribute } from "@beep/markdown/MarkdownMdx";
 *
 * const node = MdxJsxExpressionAttribute.make({ value: "...props" });
 * console.log(node.value) // ...props
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxJsxExpressionAttribute extends S.Opaque<MdxJsxExpressionAttribute, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mdxJsxExpressionAttribute").pipe(
      $I.annoteKey("MdxJsxExpressionAttribute.type", {
        description:
          "The `mdxJsxExpressionAttribute` discriminator identifying a JSX attribute written wholly as an expression",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("MdxJsxExpressionAttribute.value", {
        description:
          "Expression source between the braces of a JSX expression attribute, including spread syntax when present",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxJsxExpressionAttribute.position", {
        description:
          "Source span of the expression attribute, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("MdxJsxExpressionAttribute", {
      description:
        "MdxJsxExpressionAttribute — a JSX attribute written whole as an expression (`<a {...b} />`); `value` holds the expression source text between the braces.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxJsxExpressionAttribute}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxJsxExpressionAttribute {
  /**
   * The plain encoded fields of {@link MdxJsxExpressionAttribute}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly position: Position.Encoded;
    readonly type: "mdxJsxExpressionAttribute";
    readonly value: string;
  }
}

/**
 * The union of every node that may appear in a JSX element's `attributes`
 * array. A real `Schema.Union`, as documented on `RowContent`.
 *
 * **Details**
 *
 * Attribute carriers are node-shaped values — they carry `type` and
 * `position` per the mdast-util-mdx-jsx contract — but they are **not tree
 * content**: they never appear in a `children` array, so they are excluded
 * from `MarkdownNode` and invisible to the visitor and to
 * `MarkdownDocument.find`.
 *
 * **Example** (Admit MdxJsxAttribute content)
 *
 * ```ts
 * import { MdxJsxAttribute, MdxJsxAttributeContent } from "@beep/markdown/MarkdownMdx";
 * import * as S from "effect/Schema";
 *
 * const node = MdxJsxAttribute.make({ name: "disabled" });
 * console.log(S.is(MdxJsxAttributeContent)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MdxJsxAttributeContent: S.Codec<MdxJsxAttributeContent, MdxJsxAttributeContentEncoded> = S.Union([
  MdxJsxAttribute,
  MdxJsxExpressionAttribute,
]).pipe(
  $I.annoteSchema("MdxJsxAttributeContent", {
    description:
      "The union of every node that may appear in a JSX element's `attributes` array. A real `Schema.Union`, as documented on `RowContent`.",
  })
);

/**
 * The union of all JSX attribute node types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MdxJsxAttributeContent = MdxJsxAttribute | MdxJsxExpressionAttribute;

const mdxFragmentAttributes = S.makeFilter(
  (element: { readonly name: string | null; readonly attributes: ReadonlyArray<MdxJsxAttributeContent> }) =>
    element.name !== null || element.attributes.length === 0,
  $I.annote("MdxFragmentAttributes", {
    message: "an MDX JSX fragment cannot carry attributes",
    description: "An MDX JSX fragment has no attribute spelling and must carry an empty attributes array.",
  })
);

/**
 * MdxJsxFlowElement — a JSX element in flow (block) position (`<Component />`
 * on its own lines). `name` is `null` for a fragment (`<></>`); children are
 * flow content, per the oracle's `BlockContent | DefinitionContent` model.
 *
 * **Details**
 *
 * A fragment cannot carry attributes — that shape has no MDX spelling — so
 * the schema refuses it at construction and decode. A **named** element's
 * name must be non-empty on the same terms: `""` has no MDX spelling either
 * (the oracle's parser only ever produces a real name or `null`, and its
 * serializer treats a falsy name as the fragment), so `null` is the one
 * fragment spelling and the empty string fails typed.
 *
 * **Example** (Construct MdxJsxFlowElement content)
 *
 * ```ts
 * import { MdxJsxFlowElement } from "@beep/markdown/MarkdownMdx";
 *
 * const node = MdxJsxFlowElement.make({ name: "Card", attributes: [], children: [] });
 * console.log(node.name) // Card
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxJsxFlowElement extends S.Opaque<MdxJsxFlowElement, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mdxJsxFlowElement").pipe(
      $I.annoteKey("MdxJsxFlowElement.type", {
        description: "The `mdxJsxFlowElement` discriminator identifying a JSX element in block position",
      })
    ),
    name: S.NullOr(MdxJsxName).pipe(
      $I.annoteKey("MdxJsxFlowElement.name", {
        description: "Non-empty JSX element name, or null for a fragment that cannot carry attributes",
      })
    ),
    attributes: S.Array(MdxJsxAttributeContent).pipe(
      $I.annoteKey("MdxJsxFlowElement.attributes", {
        description: "Named and expression attributes in source order; empty for a fragment",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<FlowContent, FlowContentEncoded> => FlowContent)).pipe(
      $I.annoteKey("MdxJsxFlowElement.children", {
        description: "Block content enclosed by the JSX element, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxJsxFlowElement.position", {
        description: "Source span of the block JSX element, constructor-defaulted to the synthetic position",
      })
    ),
  }).pipe(
    S.check(mdxFragmentAttributes),
    $I.annoteSchema("MdxJsxFlowElement", {
      description:
        "MdxJsxFlowElement — a JSX element in flow (block) position (`<Component />` on its own lines). `name` is `null` for a fragment (`<></>`); children are flow content, per the oracle's `BlockContent | DefinitionContent` model.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxJsxFlowElement}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxJsxFlowElement {
  /**
   * The plain encoded fields of {@link MdxJsxFlowElement}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly attributes: ReadonlyArray<MdxJsxAttributeContentEncoded>;
    readonly children: ReadonlyArray<FlowContentEncoded>;
    readonly name: string | null;
    readonly position: Position.Encoded;
    readonly type: "mdxJsxFlowElement";
  }
}

/**
 * MdxJsxTextElement — a JSX element in text (phrasing) position
 * (`a <b>c</b> d`). `name` is `null` for a fragment; children are phrasing
 * content. Refuses attributes on a fragment and an empty-string name, on the
 * same terms as {@link MdxJsxFlowElement}.
 *
 * **Example** (Construct MdxJsxTextElement content)
 *
 * ```ts
 * import { MdxJsxTextElement } from "@beep/markdown/MarkdownMdx";
 * import { Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = MdxJsxTextElement.make({ name: null, attributes: [], children: [Text.make({ value: "Hello" })] });
 * console.log(node.name) // null
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxJsxTextElement extends S.Opaque<MdxJsxTextElement, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mdxJsxTextElement").pipe(
      $I.annoteKey("MdxJsxTextElement.type", {
        description: "The `mdxJsxTextElement` discriminator identifying a JSX element in inline position",
      })
    ),
    name: S.NullOr(MdxJsxName).pipe(
      $I.annoteKey("MdxJsxTextElement.name", {
        description: "Non-empty JSX element name, or null for a fragment that cannot carry attributes",
      })
    ),
    attributes: S.Array(MdxJsxAttributeContent).pipe(
      $I.annoteKey("MdxJsxTextElement.attributes", {
        description: "Named and expression attributes in source order; empty for a fragment",
      })
    ),
    children: S.Array(S.suspend((): S.Codec<PhrasingContent, PhrasingContentEncoded> => PhrasingContent)).pipe(
      $I.annoteKey("MdxJsxTextElement.children", {
        description: "Inline content enclosed by the JSX element, in document order",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxJsxTextElement.position", {
        description: "Source span of the inline JSX element, constructor-defaulted to the synthetic position",
      })
    ),
  }).pipe(
    S.check(mdxFragmentAttributes),
    $I.annoteSchema("MdxJsxTextElement", {
      description:
        "MdxJsxTextElement — a JSX element in text (phrasing) position (`a <b>c</b> d`). `name` is `null` for a fragment; children are phrasing content. Refuses attributes on a fragment and an empty-string name, on the same terms as MdxJsxFlowElement.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxJsxTextElement}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxJsxTextElement {
  /**
   * The plain encoded fields of {@link MdxJsxTextElement}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly attributes: ReadonlyArray<MdxJsxAttributeContentEncoded>;
    readonly children: ReadonlyArray<PhrasingContentEncoded>;
    readonly name: string | null;
    readonly position: Position.Encoded;
    readonly type: "mdxJsxTextElement";
  }
}

/**
 * MdxFlowExpression — an expression in flow (block) position (`{a + b}` on
 * its own lines); `value` holds the expression source text between the
 * braces.
 *
 * **Example** (Construct MdxFlowExpression content)
 *
 * ```ts
 * import { MdxFlowExpression } from "@beep/markdown/MarkdownMdx";
 *
 * const node = MdxFlowExpression.make({ value: "a + b" });
 * console.log(node.value) // a + b
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxFlowExpression extends S.Opaque<MdxFlowExpression, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mdxFlowExpression").pipe(
      $I.annoteKey("MdxFlowExpression.type", {
        description: "The `mdxFlowExpression` discriminator identifying an MDX expression in block position",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("MdxFlowExpression.value", {
        description: "Expression source between braces in an MDX block expression",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxFlowExpression.position", {
        description: "Source span of the block expression, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("MdxFlowExpression", {
      description:
        "MdxFlowExpression — an expression in flow (block) position (`{a + b}` on its own lines); `value` holds the expression source text between the braces.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxFlowExpression}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxFlowExpression {
  /**
   * The plain encoded fields of {@link MdxFlowExpression}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly position: Position.Encoded;
    readonly type: "mdxFlowExpression";
    readonly value: string;
  }
}

/**
 * MdxTextExpression — an expression in text (phrasing) position
 * (`a {b} c`); `value` holds the expression source text between the braces.
 *
 * **Example** (Construct MdxTextExpression content)
 *
 * ```ts
 * import { MdxTextExpression } from "@beep/markdown/MarkdownMdx";
 *
 * const node = MdxTextExpression.make({ value: "name" });
 * console.log(node.value) // name
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxTextExpression extends S.Opaque<MdxTextExpression, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mdxTextExpression").pipe(
      $I.annoteKey("MdxTextExpression.type", {
        description: "The `mdxTextExpression` discriminator identifying an MDX expression within inline content",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("MdxTextExpression.value", {
        description: "Expression source between braces in an inline MDX expression",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxTextExpression.position", {
        description: "Source span of the inline expression, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("MdxTextExpression", {
      description:
        "MdxTextExpression — an expression in text (phrasing) position (`a {b} c`); `value` holds the expression source text between the braces.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxTextExpression}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxTextExpression {
  /**
   * The plain encoded fields of {@link MdxTextExpression}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly position: Position.Encoded;
    readonly type: "mdxTextExpression";
    readonly value: string;
  }
}

/**
 * MdxjsEsm — an MDX ESM block (`import`/`export` statements); `value` holds
 * the statement source verbatim.
 *
 * **Details**
 *
 * Only ever a child of {@link Root}, per the mdast-util-mdxjs-esm content
 * registration — ESM cannot nest inside a JSX element or any other
 * container. As with the frontmatter head node, the constraint is structural
 * (the `Root` children union admits it, no other union does), not validated.
 *
 * **Example** (Construct MdxjsEsm content)
 *
 * ```ts
 * import { MdxjsEsm } from "@beep/markdown/MarkdownMdx";
 *
 * const node = MdxjsEsm.make({ value: "export const answer = 42" });
 * console.log(node.value) // export const answer = 42
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MdxjsEsm extends S.Opaque<MdxjsEsm, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("mdxjsEsm").pipe(
      $I.annoteKey("MdxjsEsm.type", {
        description: "The `mdxjsEsm` discriminator identifying an MDX import or export block",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("MdxjsEsm.value", { description: "Import or export statement source preserved verbatim" })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("MdxjsEsm.position", {
        description: "Source span of the ESM block, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("MdxjsEsm", {
      description:
        "MdxjsEsm — an MDX ESM block (`import`/`export` statements); `value` holds the statement source verbatim.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link MdxjsEsm}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MdxjsEsm {
  /**
   * The plain encoded fields of {@link MdxjsEsm}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly position: Position.Encoded;
    readonly type: "mdxjsEsm";
    readonly value: string;
  }
}

// --- Frontmatter ------------------------------------------------------------

/**
 * The frontmatter formats the capture recognizes, keyed by their opening
 * fence: `---` is yaml, `+++` is toml and `---json` is json.
 *
 * **Example** (Validate FrontmatterFormat syntax)
 *
 * ```ts
 * import { FrontmatterFormat } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FrontmatterFormat)("yaml")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FrontmatterFormat = InternalFrontmatterFormat.pipe(
  $I.annoteSchema("FrontmatterFormat", {
    description:
      "The frontmatter formats the capture recognizes, keyed by their opening fence: `---` is yaml, `+++` is toml and `---json` is json.",
  })
);

/**
 * The union of all frontmatter format string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterFormat = typeof FrontmatterFormat.Type;

/**
 * Frontmatter — the raw, fidelity-preserving capture of a document's metadata
 * block. `value` is the source text between the fences, exactly as written
 * (never inline-parsed, never decoded); `format` records which fence captured
 * it. The position spans the whole block including both fence lines.
 *
 * **Details**
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
 * **Example** (Construct Frontmatter content)
 *
 * ```ts
 * import { Frontmatter } from "@beep/markdown/MarkdownNode";
 *
 * const node = Frontmatter.make({ format: "yaml", value: "title: Hello" });
 * console.log(node.format) // yaml
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Frontmatter extends S.Opaque<Frontmatter, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("frontmatter").pipe(
      $I.annoteKey("Frontmatter.type", {
        description: "The `frontmatter` discriminator identifying a captured document metadata block",
      })
    ),
    format: FrontmatterFormat.pipe(
      $I.annoteKey("Frontmatter.format", {
        description: "Metadata format selected by the opening fence: `yaml`, `toml`, or `json`",
      })
    ),
    value: S.String.pipe(
      $I.annoteKey("Frontmatter.value", {
        description: "Raw metadata source between the fence lines, preserved without parsing or decoding",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Frontmatter.position", {
        description:
          "Source span including both frontmatter fence lines, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe(
    $I.annoteSchema("Frontmatter", {
      description:
        "Frontmatter — the raw, fidelity-preserving capture of a document's metadata block. `value` is the source text between the fences, exactly as written (never inline-parsed, never decoded); `format` records which fence captured it. The position spans the whole block including both fence lines.",
    })
  )
) {}

/**
 * The encoded (wire) shape of {@link Frontmatter}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Frontmatter {
  /**
   * The plain encoded fields of {@link Frontmatter}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly format: FrontmatterFormat;
    readonly position: Position.Encoded;
    readonly type: "frontmatter";
    readonly value: string;
  }
}

/**
 * The union of every node that may appear where mdast expects
 * **frontmatter** content — a one-member union, kept because mdast names the
 * category (its member there is `Yaml`; ours is the format-agnostic capture).
 *
 * **Example** (Admit Frontmatter content)
 *
 * ```ts
 * import { Frontmatter, FrontmatterContent } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * const node = Frontmatter.make({ format: "yaml", value: "title: Hello" });
 * console.log(S.is(FrontmatterContent)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FrontmatterContent: S.Codec<FrontmatterContent, FrontmatterContentEncoded> = S.suspend(
  () => Frontmatter
).pipe(
  $I.annoteSchema("FrontmatterContent", { description: "Captured frontmatter metadata admitted at the document root." })
);

/**
 * The union of all frontmatter-content node types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterContent = Frontmatter;

// --- Root -------------------------------------------------------------------

/**
 * Root — a whole document, and the only node that is never a child.
 *
 * **Details**
 *
 * mdast leaves a root's content model open; a parsed markdown document is
 * flow content, optionally headed by one {@link Frontmatter} node — mdast's
 * `FlowContentFrontmatter` merge, which admits frontmatter at the root and
 * nowhere else. {@link MdxjsEsm} is likewise admitted at the root and nowhere
 * else, per mdast-util-mdxjs-esm's `RootContentMap` registration.
 *
 * **Example** (Construct Root content)
 *
 * ```ts
 * import { Paragraph, Root, Text } from "@beep/markdown/MarkdownNode";
 *
 * const node = Root.make({ children: [Paragraph.make({ children: [Text.make({ value: "Hello" })] })] });
 * console.log(node.children.length) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Root extends S.Opaque<Root, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("root").pipe(
      $I.annoteKey("Root.type", { description: "The `root` discriminator identifying the whole document" })
    ),
    children: S.Array(
      S.suspend(
        (): S.Codec<
          Frontmatter | MdxjsEsm | FlowContent,
          Frontmatter.Encoded | MdxjsEsm.Encoded | FlowContentEncoded
        > => S.Union([Frontmatter, MdxjsEsm, FlowContent])
      )
    ).pipe(
      $I.annoteKey("Root.children", {
        description: "Top-level document content in order, admitting frontmatter, MDX ESM blocks, and flow content",
      })
    ),
    position: NodePosition.pipe(
      $I.annoteKey("Root.position", {
        description: "Source span of the whole document, constructor-defaulted to the zero-width synthetic position",
      })
    ),
  }).pipe($I.annoteSchema("Root", { description: "Root — a whole document, and the only node that is never a child." }))
) {}

/**
 * The encoded (wire) shape of {@link Root}: the same fields as plain data.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Root {
  /**
   * The plain encoded fields of {@link Root}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children: ReadonlyArray<Frontmatter.Encoded | MdxjsEsm.Encoded | FlowContentEncoded>;
    readonly position: Position.Encoded;
    readonly type: "root";
  }
}

/**
 * The union of every mdast node type this package produces — the content
 * categories plus {@link Root}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Admit Root content)
 *
 * ```ts
 * import { MarkdownNode, Root } from "@beep/markdown/MarkdownNode";
 * import * as S from "effect/Schema";
 *
 * const node = Root.make({ children: [] });
 * console.log(S.is(MarkdownNode)(node)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownNode: S.Codec<MarkdownNode, MarkdownNodeEncoded> = S.suspend(() =>
  S.Union([Root, FrontmatterContent, FlowContent, ListContent, MdxjsEsm, PhrasingContent, RowContent, TableContent])
).pipe(
  $I.annoteSchema("MarkdownNode", {
    description: "Every node admitted in a markdown tree, including the root and all content categories.",
  })
);

/**
 * The union of every node `type` tag this package produces — the selector
 * vocabulary of `MarkdownDocument.find`/`findAll`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownNodeType = MarkdownNode["type"];

/**
 * The node whose `type` tag is `T` — how a type-string selector narrows
 * its result (`MarkdownNodeOfType<"heading">` is {@link Heading}).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownNodeOfType<T extends MarkdownNodeType> = Extract<MarkdownNode, { readonly type: T }>;

/**
 * The encoded (wire) shape of {@link PhrasingContent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PhrasingContentEncoded =
  | Break.Encoded
  | Delete.Encoded
  | Emphasis.Encoded
  | FootnoteReference.Encoded
  | Html.Encoded
  | Image.Encoded
  | ImageReference.Encoded
  | InlineCode.Encoded
  | Link.Encoded
  | LinkReference.Encoded
  | MdxJsxTextElement.Encoded
  | MdxTextExpression.Encoded
  | Strong.Encoded
  | Text.Encoded;

/**
 * The encoded (wire) shape of {@link FlowContent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FlowContentEncoded =
  | Blockquote.Encoded
  | Code.Encoded
  | Definition.Encoded
  | FootnoteDefinition.Encoded
  | Heading.Encoded
  | Html.Encoded
  | List.Encoded
  | MdxFlowExpression.Encoded
  | MdxJsxFlowElement.Encoded
  | Paragraph.Encoded
  | Table.Encoded
  | ThematicBreak.Encoded;

/**
 * The encoded (wire) shape of {@link ListContent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ListContentEncoded = ListItem.Encoded;

/**
 * The encoded (wire) shape of {@link RowContent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RowContentEncoded = TableCell.Encoded;

/**
 * The encoded (wire) shape of {@link TableContent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TableContentEncoded = TableRow.Encoded;

/**
 * The encoded (wire) shape of {@link MdxJsxAttributeContent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MdxJsxAttributeContentEncoded = MdxJsxAttribute.Encoded | MdxJsxExpressionAttribute.Encoded;

/**
 * The encoded (wire) shape of {@link FrontmatterContent}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FrontmatterContentEncoded = Frontmatter.Encoded;

/**
 * The encoded (wire) shape of {@link MarkdownNode}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownNodeEncoded =
  | Root.Encoded
  | FrontmatterContentEncoded
  | FlowContentEncoded
  | ListContentEncoded
  | MdxjsEsm.Encoded
  | PhrasingContentEncoded
  | RowContentEncoded
  | TableContentEncoded;

/**
 * Every `type` discriminator the node vocabulary defines: the 26 core tags
 * (root and frontmatter included) and the 8 MDX tags, three of which are the
 * JSX attribute carriers that never appear in a `children` array.
 *
 * **Details**
 *
 * Derived from the node schemas' own `type: S.tag(...)` literals rather than
 * spelled out again, and pinned against the node unions by a type-level test,
 * so a new node schema cannot land without joining the domain. It is wider
 * than {@link MarkdownNodeType}, which covers tree content only and omits the
 * three attribute carriers.
 *
 * **Example** (Check a node kind)
 *
 * ```ts
 * import { MarkdownNodeKind } from "@beep/markdown/MarkdownNode";
 *
 * console.log(MarkdownNodeKind.is.mdxJsxAttribute("mdxJsxAttribute")) // true
 * console.log(MarkdownNodeKind.literals.length) // 34
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownNodeKind = LiteralKit([
  Root.fields.type.schema.literal,
  Frontmatter.fields.type.schema.literal,
  Blockquote.fields.type.schema.literal,
  Code.fields.type.schema.literal,
  Definition.fields.type.schema.literal,
  FootnoteDefinition.fields.type.schema.literal,
  Heading.fields.type.schema.literal,
  Html.fields.type.schema.literal,
  List.fields.type.schema.literal,
  ListItem.fields.type.schema.literal,
  Paragraph.fields.type.schema.literal,
  Table.fields.type.schema.literal,
  TableRow.fields.type.schema.literal,
  TableCell.fields.type.schema.literal,
  ThematicBreak.fields.type.schema.literal,
  Break.fields.type.schema.literal,
  Delete.fields.type.schema.literal,
  Emphasis.fields.type.schema.literal,
  FootnoteReference.fields.type.schema.literal,
  Image.fields.type.schema.literal,
  ImageReference.fields.type.schema.literal,
  InlineCode.fields.type.schema.literal,
  Link.fields.type.schema.literal,
  LinkReference.fields.type.schema.literal,
  Strong.fields.type.schema.literal,
  Text.fields.type.schema.literal,
  MdxjsEsm.fields.type.schema.literal,
  MdxFlowExpression.fields.type.schema.literal,
  MdxTextExpression.fields.type.schema.literal,
  MdxJsxFlowElement.fields.type.schema.literal,
  MdxJsxTextElement.fields.type.schema.literal,
  MdxJsxAttribute.fields.type.schema.literal,
  MdxJsxExpressionAttribute.fields.type.schema.literal,
  MdxJsxAttributeValueExpression.fields.type.schema.literal,
]).pipe(
  $I.annoteSchema("MarkdownNodeKind", {
    description:
      "Every node `type` discriminator: the 26 core tags and the 8 MDX tags, including the three JSX attribute carriers.",
  })
);

/**
 * The union of every node `type` discriminator, tree content and JSX
 * attribute carriers alike.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownNodeKind = typeof MarkdownNodeKind.Type;

/**
 * Any value of the node vocabulary: a tree node, a JSX attribute carrier, a
 * {@link Position} or a {@link Point}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NodeValue = MarkdownNode | MdxJsxAttributeContent | MdxJsxAttributeValueExpression | Position | Point;

/**
 * The plain shape of a node value: the same fields without the nominal
 * brand, distributed over unions.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TrustedFields<N extends NodeValue> = N extends unknown
  ? { readonly [K in keyof N as K extends "brand" ? never : K]: N[K] }
  : never;

/**
 * Stamp the node brand on a plain value the parser built, without walking or
 * copying it.
 *
 * **Details**
 *
 * The parser's single checked admission (D-39): materialization builds every
 * node, position and point as a plain typed value through this constructor,
 * and the public entry point admits the finished tree once (`Root.make` in
 * `Markdown.parseResult`). A per-node `make` would re-walk every descendant
 * (struct `make` copies its input), which costs O(n·depth). Internal only:
 * public callers construct with `X.make`.
 *
 * **Gotchas**
 *
 * Nothing is checked here. A value built through this constructor is only
 * trustworthy once the tree that contains it has been admitted; never hand
 * one to a caller before that.
 *
 * **Example** (Build a plain text node)
 *
 * ```ts
 * import { Position, Text } from "@beep/markdown/MarkdownNode";
 * import { trustedNode } from "@beep/markdown/internal/nodes";
 *
 * const text = trustedNode<Text>({ type: "text", value: "hi", position: Position.synthetic });
 * console.log(Text.make(text).value) // hi
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const trustedNode = <N extends NodeValue>(fields: TrustedFields<N>): N =>
  // The one brand cast in the package (D-39): the brand is phantom, so the
  // runtime value is already the node; `Root.make` checks it at admission.
  fields as unknown as N;

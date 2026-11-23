/**
 * The document IR (headings, paragraphs, lists, tables, trees, counts, callouts, code, diffs, annotations), its
 * builders, and `Doc.print`, which renders a document for the audience on the right stream.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { GithubAnnotationProperties } from "./GithubAnnotation.ts";
import { autoFormat } from "./internal/autoFormat.ts";
import { totalOf, visibleCountersOf } from "./internal/counts.ts";
import { AnyNumber, DisplayPath } from "./internal/declared.ts";
import { admitLinkTarget, LinkTarget } from "./LinkTarget.ts";
import { Render } from "./Render.ts";
import { StatusDef } from "./Status.ts";
import { Style, TokenName } from "./Token.ts";
import type { Audience, TerminalEnv } from "@beep/runtime-env";
import type { CliLinks } from "./CliLinks.ts";
import type { CliTheme } from "./CliTheme.ts";
import type { LinkTargetInput } from "./LinkTarget.ts";
import type { Status } from "./Status.ts";

const $I = $CliKitId.create("Doc");

const OverflowOptionsOverflow = S.declare<(hidden: number) => InlineInput>(
  (value): value is (hidden: number) => InlineInput => P.isFunction(value)
).pipe(
  $I.annoteSchema("OverflowOptionsOverflow", {
    description: "Content shown in place of the hidden items, given their count.",
  })
);
const CountsOptionsTotal = S.declare<(counters: ReadonlyArray<Counter.Encoded>) => number>(
  (value): value is (counters: ReadonlyArray<Counter.Encoded>) => number => P.isFunction(value)
).pipe($I.annoteSchema("CountsOptionsTotal", { description: "Computes the total a counts block shows." }));

/**
 * A status as a document stores it: its name and its resolved definition.
 *
 * **Details**
 *
 * The definition is stored, not the vocabulary, so a node stays plain data.
 *
 * **Example** (Validate a resolved status)
 *
 * ```ts
 * import { StatusRef } from "@beep/cli-kit/Doc"
 * import { Status } from "@beep/cli-kit/Status"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(StatusRef)({ name: "success", def: Status.core.resolve("success") })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class StatusRef extends S.Opaque<StatusRef, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The name in the vocabulary it was resolved from. */
    name: S.String.pipe($I.annoteKey("StatusRef.name", { description: "The name field of StatusRef." })),
    /** The resolved definition. */
    def: StatusDef.pipe($I.annoteKey("StatusRef.def", { description: "The def field of StatusRef." })),
  }).pipe($I.annoteSchema("StatusRef", { description: "A status name and its resolved definition." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { StatusRef } from "@beep/cli-kit/Doc"
 *
 * const accepts = (_value: StatusRef.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StatusRef {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StatusRef.Encoded;
}

const inlineShape = <Children extends S.Constraint>(children: Children) =>
  S.Union([
    S.TaggedStruct("Text", {
      value: S.String.pipe($I.annoteKey("Inline.Text.value", { description: "The value field of Inline.Text." })),
      token: S.optionalKey(S.Union([TokenName, Style])).pipe(
        $I.annoteKey("Inline.Text.token", { description: "The token field of Inline.Text." })
      ),
    }).pipe($I.annoteSchema("Inline.Text", { description: "The Inline.Text document variant." })),
    S.TaggedStruct("Code", {
      value: S.String.pipe($I.annoteKey("Inline.Code.value", { description: "The value field of Inline.Code." })),
    }).pipe($I.annoteSchema("Inline.Code", { description: "The Inline.Code document variant." })),
    S.TaggedStruct("Link", {
      target: LinkTarget.pipe($I.annoteKey("Inline.Link.target", { description: "The target field of Inline.Link." })),
      label: S.suspend(() => children).pipe(
        $I.annoteKey("Inline.Link.label", { description: "The ordered link label." })
      ),
      /**
       * Whether plain text (and ANSI with links off, and markdown with no URL) follows the label with the target in
       * parentheses. Unset, it does so only when the label does not already show the target's display form.
       */
      suffix: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("Inline.Link.suffix", { description: "The suffix field of Inline.Link." })
      ),
    }).pipe($I.annoteSchema("Inline.Link", { description: "The Inline.Link document variant." })),
    S.TaggedStruct("StatusMark", { ...StatusRef.fields }).pipe(
      $I.annoteSchema("Inline.StatusMark", { description: "The Inline.StatusMark document variant." })
    ),
    S.TaggedStruct("Path", {
      segments: S.Array(S.String).pipe(
        $I.annoteKey("Inline.Path.segments", { description: "The segments field of Inline.Path." })
      ),
    }).pipe($I.annoteSchema("Inline.Path", { description: "The Inline.Path document variant." })),
    S.TaggedStruct("Strong", {
      content: S.suspend(() => children).pipe(
        $I.annoteKey("Inline.content", { description: "The ordered nested inline content." })
      ),
    }).pipe($I.annoteSchema("Inline.Strong", { description: "The Inline.Strong document variant." })),
    S.TaggedStruct("Emphasis", {
      content: S.suspend(() => children).pipe(
        $I.annoteKey("Inline.content", { description: "The ordered nested inline content." })
      ),
    }).pipe($I.annoteSchema("Inline.Emphasis", { description: "The Inline.Emphasis document variant." })),
    S.TaggedStruct("File", {
      path: S.String.pipe($I.annoteKey("Inline.File.path", { description: "The path field of Inline.File." })),
    }).pipe($I.annoteSchema("Inline.File", { description: "The Inline.File document variant." })),
  ]).pipe($I.annoteSchema("Inline", { description: "Plain tagged content flowing inside a document line." }));

// Array interfaces break recursive inference without duplicating any variant's fields.
interface InlineChildren extends ReadonlyArray<Inline> {}
interface InlineEncodedChildren extends ReadonlyArray<InlineEncoded> {}
type InlineEncoded = ReturnType<typeof inlineShape<S.Codec<InlineEncodedChildren>>>["Encoded"];
/**
 * The decoded inline content flowing inside a document line.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Inline = ReturnType<typeof inlineShape<S.Codec<InlineChildren, InlineEncodedChildren>>>["Type"];
/**
 * Content that flows inside a line.
 *
 * **Details**
 *
 * - `Text`: a run of text, optionally painted with a token or style.
 * - `Code`: code in a monospace span.
 * - `Link`: a labelled link to a URL or a file position.
 * - `StatusMark`: a status glyph, carrying its resolved definition.
 * - `Path`: a path or breadcrumb, joined with the audience's path separator.
 * - `Strong` and `Emphasis`: content in bold or italic; markdown `**` and `_`.
 * - `File`: a path shown through the context's `displayPath`, never linked.
 *
 * **Example** (Validate inline text)
 *
 * ```ts
 * import { Doc, Inline } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Inline)(Doc.text("Ready"))) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Inline = S.suspend((): S.Codec<Inline, InlineEncoded> => Inline).pipe(S.Array, inlineShape);

const treeNodeShape = <Children extends S.Constraint>(children: Children) =>
  S.Struct({
    /** What the node says. */
    label: S.Array(Inline).pipe(
      $I.annoteKey("treeNodeShape.label", { description: "The label field of treeNodeShape." })
    ),
    /** Its children, in order. */
    children: S.suspend(() => children).pipe(
      $I.annoteKey("TreeNode.children", { description: "The ordered child tree nodes." })
    ),
  }).pipe($I.annoteSchema("TreeNode", { description: "A tree label and its ordered children." }));
interface TreeChildren extends ReadonlyArray<TreeNode> {}
interface TreeNodeEncodedChildren extends ReadonlyArray<TreeNodeEncoded> {}
type TreeNodeEncoded = ReturnType<typeof treeNodeShape<S.Codec<TreeNodeEncodedChildren>>>["Encoded"];
/**
 * The decoded tree label and its ordered child nodes.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TreeNode = ReturnType<typeof treeNodeShape<S.Codec<TreeChildren, TreeNodeEncodedChildren>>>["Type"];
/**
 * A node of a {@link TreeNode} tree: a label and its children.
 *
 * **Example** (Validate a tree root)
 *
 * ```ts
 * import { Doc, TreeNode } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TreeNode)(Doc.tree({ label: "src" }).root)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TreeNode = S.suspend((): S.Codec<TreeNode, TreeNodeEncoded> => TreeNode).pipe(S.Array, treeNodeShape);

/**
 * A table column: its header cell and optional alignment. A tagged node, so a renderer that builds a table from
 * another block (a counts table) makes one with a plain object and no import of this module.
 *
 * **Example** (Validate an aligned column)
 *
 * ```ts
 * import { Column, Doc } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Column)({ _tag: "Column", header: [Doc.text("Time")], align: "right" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Column = S.TaggedStruct("Column", {
  /** The header cell. */
  header: S.Array(Inline).pipe($I.annoteKey("Column.header", { description: "The header cell of the column." })),
  /** How the column's cells align; left when unset. */
  align: S.optionalKey(S.Literals(["left", "right", "center"])).pipe(
    $I.annoteKey("Column.align", { description: "How the column's cells align; left when unset." })
  ),
}).pipe($I.annoteSchema("Column", { description: "A table header and optional alignment." }));

/**
 * @category type-level
 * @since 0.0.0
 */
export type Column = typeof Column.Type;

/**
 * Describes a labelled count and its resolved status for a `Counts` block.
 *
 * **Example** (Validate a resolved counter)
 *
 * ```ts
 * import { Counter, Doc } from "@beep/cli-kit/Doc"
 * import { Status } from "@beep/cli-kit/Status"
 * import * as S from "effect/Schema"
 *
 * const counter = Doc.counter(Status.core, "success", { key: "passed", label: "passed", n: 3 })
 * console.log(S.is(Counter)(counter)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class Counter extends S.Opaque<Counter, { readonly brand: unique symbol }>()(
  S.Struct({
    /** A stable identifier, for a caller's total rule. */
    key: S.String.pipe($I.annoteKey("Counter.key", { description: "The key field of Counter." })),
    /**
     * What the counter is called when shown: one label, or a singular and a plural form, `one` for a count of exactly 1
     * and `other` for every other, 0 included. The count is the counter's own `n`, except in a share headline
     * (`1/3 repos`), which reads by the total. A `CountsTable` heads its column with `other`, since the column holds
     * every row's count.
     */
    label: S.Union([
      S.String,
      S.Struct({
        one: S.String.pipe($I.annoteKey("Counter.one", { description: "The one field of Counter." })),
        other: S.String.pipe($I.annoteKey("Counter.other", { description: "The other field of Counter." })),
      }),
    ]).pipe($I.annoteKey("Counter.label", { description: "The label field of Counter." })),
    /** The count. */
    n: S.Finite.pipe($I.annoteKey("Counter.n", { description: "The n field of Counter." })),
    /** The status the count is painted with. */
    status: StatusRef.pipe($I.annoteKey("Counter.status", { description: "The status field of Counter." })),
    /** Show the counter when `n` is zero; by default a zero counter is hidden. */
    showZero: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Counter.showZero", { description: "The showZero field of Counter." })
    ),
  }).pipe(
    $I.annoteSchema("Counter", { description: "A labeled count with its resolved status and zero-display policy." })
  )
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { Doc } from "@beep/cli-kit/Doc"
 * import type { Counter } from "@beep/cli-kit/Doc"
 * import { Status } from "@beep/cli-kit/Status"
 *
 * const plain: Counter.Encoded = Doc.counter(Status.core, "success", { key: "passed", label: "passed", n: 3 })
 * console.log(plain.n) // 3
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Counter {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Counter.Encoded;
}

const Overflow = S.declare<(hidden: number) => ReadonlyArray<Inline>>(
  (value): value is (hidden: number) => ReadonlyArray<Inline> => P.isFunction(value)
).pipe(
  $I.annoteSchema("Overflow", {
    description: "An opaque callback producing normalized overflow content.",
    toCodecArbitrary: () =>
      new SchemaAST.Link(
        S.Array(Inline).ast,
        SchemaTransformation.makeTransformation({
          decode: SchemaGetter.transform((content: ReadonlyArray<Inline>) => () => content),
          encode: SchemaGetter.forbiddenEncoding,
        })
      ),
  })
);
const Total = S.declare<(counters: ReadonlyArray<Counter.Encoded>) => number>(
  (value): value is (counters: ReadonlyArray<Counter.Encoded>) => number => P.isFunction(value)
).pipe(
  $I.annoteSchema("Total", {
    description: "An opaque callback computing a counter total.",
    toCodecArbitrary: () =>
      new SchemaAST.Link(
        S.Finite.ast,
        SchemaTransformation.makeTransformation({
          decode: SchemaGetter.transform((total: number) => () => total),
          encode: SchemaGetter.forbiddenEncoding,
        })
      ),
  })
);
const blockShape = <Children extends S.Constraint>(children: Children) =>
  S.Union([
    S.TaggedStruct("Heading", {
      level: S.Literals([1, 2, 3, 4]).pipe(
        $I.annoteKey("Block.Heading.level", { description: "The level field of Block.Heading." })
      ),
      content: S.Array(Inline).pipe(
        $I.annoteKey("Block.Heading.content", { description: "The content field of Block.Heading." })
      ),
    }).pipe($I.annoteSchema("Block.Heading", { description: "The Block.Heading document variant." })),
    S.TaggedStruct("Paragraph", {
      content: S.Array(Inline).pipe(
        $I.annoteKey("Block.Paragraph.content", { description: "The content field of Block.Paragraph." })
      ),
    }).pipe($I.annoteSchema("Block.Paragraph", { description: "The Block.Paragraph document variant." })),
    S.TaggedStruct("List", {
      items: S.suspend(() => children).pipe(
        $I.annoteKey("Block.List.items", { description: "The ordered list blocks." })
      ),
      cap: S.optionalKey(S.Finite).pipe(
        $I.annoteKey("Block.List.cap", { description: "The cap field of Block.List." })
      ),
      overflow: S.optionalKey(Overflow).pipe(
        $I.annoteKey("Block.List.overflow", { description: "The overflow field of Block.List." })
      ),
      compact: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("Block.List.compact", { description: "The compact field of Block.List." })
      ),
    }).pipe($I.annoteSchema("Block.List", { description: "The Block.List document variant." })),
    S.TaggedStruct("Table", {
      columns: S.Array(Column).pipe(
        $I.annoteKey("Block.Table.columns", { description: "The columns field of Block.Table." })
      ),
      rows: Inline.pipe(
        S.Array,
        S.Array,
        S.Array,
        $I.annoteKey("Block.Table.rows", { description: "The rows field of Block.Table." })
      ),
      cap: S.optionalKey(S.Finite).pipe(
        $I.annoteKey("Block.Table.cap", { description: "The cap field of Block.Table." })
      ),
      overflow: S.optionalKey(Overflow).pipe(
        $I.annoteKey("Block.Table.overflow", { description: "The overflow field of Block.Table." })
      ),
      style: S.optionalKey(S.Literal("pipe")).pipe(
        $I.annoteKey("Block.Table.style", { description: "The style field of Block.Table." })
      ),
    }).pipe($I.annoteSchema("Block.Table", { description: "The Block.Table document variant." })),
    S.TaggedStruct("Tree", {
      root: TreeNode.pipe($I.annoteKey("Block.Tree.root", { description: "The root field of Block.Tree." })),
    }).pipe($I.annoteSchema("Block.Tree", { description: "The Block.Tree document variant." })),
    S.TaggedStruct("Collapsible", {
      title: S.Array(Inline).pipe(
        $I.annoteKey("Block.Collapsible.title", { description: "The title field of Block.Collapsible." })
      ),
      body: S.suspend(() => children).pipe(
        $I.annoteKey("Block.Collapsible.body", { description: "The collapsible body blocks." })
      ),
      open: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("Block.Collapsible.open", { description: "The open field of Block.Collapsible." })
      ),
    }).pipe($I.annoteSchema("Block.Collapsible", { description: "The Block.Collapsible document variant." })),
    S.TaggedStruct("Callout", {
      kind: S.Literals(["note", "tip", "important", "warning", "caution"]).pipe(
        $I.annoteKey("Block.Callout.kind", { description: "The kind field of Block.Callout." })
      ),
      body: S.suspend(() => children).pipe(
        $I.annoteKey("Block.Callout.body", { description: "The callout body blocks." })
      ),
    }).pipe($I.annoteSchema("Block.Callout", { description: "The Block.Callout document variant." })),
    S.TaggedStruct("CodeBlock", {
      lang: S.optionalKey(S.String).pipe(
        $I.annoteKey("Block.CodeBlock.lang", { description: "The lang field of Block.CodeBlock." })
      ),
      text: S.String.pipe($I.annoteKey("Block.CodeBlock.text", { description: "The text field of Block.CodeBlock." })),
    }).pipe($I.annoteSchema("Block.CodeBlock", { description: "The Block.CodeBlock document variant." })),
    S.TaggedStruct("Diff", {
      expected: S.String.pipe(
        $I.annoteKey("Block.Diff.expected", { description: "The expected field of Block.Diff." })
      ),
      received: S.String.pipe(
        $I.annoteKey("Block.Diff.received", { description: "The received field of Block.Diff." })
      ),
      cap: S.optionalKey(S.Finite).pipe(
        $I.annoteKey("Block.Diff.cap", { description: "The cap field of Block.Diff." })
      ),
    }).pipe($I.annoteSchema("Block.Diff", { description: "The Block.Diff document variant." })),
    S.TaggedStruct("Section", {
      title: Inline.pipe(
        S.Array,
        S.optionalKey,
        $I.annoteKey("Block.Section.title", { description: "The title field of Block.Section." })
      ),
      children: S.suspend(() => children).pipe(
        $I.annoteKey("Block.Section.children", { description: "The ordered section blocks." })
      ),
    }).pipe($I.annoteSchema("Block.Section", { description: "The Block.Section document variant." })),
    S.TaggedStruct("Counts", {
      label: Inline.pipe(
        S.Array,
        S.optionalKey,
        $I.annoteKey("Block.Counts.label", { description: "The label field of Block.Counts." })
      ),
      counters: S.Array(Counter).pipe(
        $I.annoteKey("Block.Counts.counters", { description: "The counters field of Block.Counts." })
      ),
      total: S.optionalKey(Total).pipe(
        $I.annoteKey("Block.Counts.total", { description: "The total field of Block.Counts." })
      ),
      qualifier: Inline.pipe(
        S.Array,
        S.optionalKey,
        $I.annoteKey("Block.Counts.qualifier", { description: "The qualifier field of Block.Counts." })
      ),
      durationMs: S.optionalKey(S.Finite).pipe(
        $I.annoteKey("Block.Counts.durationMs", { description: "The durationMs field of Block.Counts." })
      ),
      layout: S.Literals(["inline", "columns", "row"]).pipe(
        $I.annoteKey("Block.Counts.layout", { description: "The layout field of Block.Counts." })
      ),
      share: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("Block.Counts.share", { description: "The share field of Block.Counts." })
      ),
      paint: S.optionalKey(S.Literals(["all", "glyph", "none"])).pipe(
        $I.annoteKey("Block.Counts.paint", { description: "The paint field of Block.Counts." })
      ),
      suffix: Inline.pipe(
        S.Array,
        S.optionalKey,
        $I.annoteKey("Block.Counts.suffix", { description: "The suffix field of Block.Counts." })
      ),
    }).pipe($I.annoteSchema("Block.Counts", { description: "The Block.Counts document variant." })),
    S.TaggedStruct("CountsTable", {
      rows: S.Array(CountsRow).pipe(
        $I.annoteKey("Block.CountsTable.rows", { description: "The rows field of Block.CountsTable." })
      ),
      totalRow: S.optionalKey(S.Union([S.Boolean, S.Array(Inline)])).pipe(
        $I.annoteKey("Block.CountsTable.totalRow", { description: "The totalRow field of Block.CountsTable." })
      ),
      labelHeader: Inline.pipe(
        S.Array,
        S.optionalKey,
        $I.annoteKey("Block.CountsTable.labelHeader", { description: "The labelHeader field of Block.CountsTable." })
      ),
      durationHeader: Inline.pipe(
        S.Array,
        S.optionalKey,
        $I.annoteKey("Block.CountsTable.durationHeader", {
          description: "The durationHeader field of Block.CountsTable.",
        })
      ),
    }).pipe($I.annoteSchema("Block.CountsTable", { description: "The Block.CountsTable document variant." })),
    S.TaggedStruct("Lines", {
      lines: Inline.pipe(
        S.Array,
        S.Array,
        $I.annoteKey("Block.Lines.lines", { description: "The lines field of Block.Lines." })
      ),
    }).pipe($I.annoteSchema("Block.Lines", { description: "The Block.Lines document variant." })),
    S.TaggedStruct("Line", {
      content: S.Array(Inline).pipe(
        $I.annoteKey("Block.Line.content", { description: "The content field of Block.Line." })
      ),
      truncate: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("Block.Line.truncate", { description: "The truncate field of Block.Line." })
      ),
      wrap: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("Block.Line.wrap", { description: "The wrap field of Block.Line." })
      ),
    }).pipe($I.annoteSchema("Block.Line", { description: "The Block.Line document variant." })),
    S.TaggedStruct("DiffText", {
      text: S.String.pipe($I.annoteKey("Block.DiffText.text", { description: "The text field of Block.DiffText." })),
      cap: S.optionalKey(S.Finite).pipe(
        $I.annoteKey("Block.DiffText.cap", { description: "The cap field of Block.DiffText." })
      ),
      truncate: S.optionalKey(S.Boolean).pipe(
        $I.annoteKey("Block.DiffText.truncate", { description: "The truncate field of Block.DiffText." })
      ),
    }).pipe($I.annoteSchema("Block.DiffText", { description: "The Block.DiffText document variant." })),
    S.TaggedStruct("Verbatim", {
      text: S.String.pipe($I.annoteKey("Block.Verbatim.text", { description: "The text field of Block.Verbatim." })),
      indent: S.optionalKey(S.Finite).pipe(
        $I.annoteKey("Block.Verbatim.indent", { description: "The indent field of Block.Verbatim." })
      ),
    }).pipe($I.annoteSchema("Block.Verbatim", { description: "The Block.Verbatim document variant." })),
    S.TaggedStruct("Annotation", {
      message: S.String.pipe(
        $I.annoteKey("Block.Annotation.message", { description: "The message field of Block.Annotation." })
      ),
      ...AnnotationOptions.fields,
    }).pipe($I.annoteSchema("Block.Annotation", { description: "The Block.Annotation document variant." })),
  ]).pipe(
    $I.annoteSchema("Block", {
      description: "Plain tagged document blocks, including recursive containers and callbacks.",
    })
  );
interface BlockChildren extends ReadonlyArray<Block> {}
interface BlockEncodedChildren extends ReadonlyArray<BlockEncoded> {}
type BlockEncoded = ReturnType<typeof blockShape<S.Codec<BlockEncodedChildren>>>["Encoded"];
/**
 * The decoded document block, including recursive containers.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Block = ReturnType<typeof blockShape<S.Codec<BlockChildren, BlockEncodedChildren>>>["Type"];
/**
 * **Details**
 *
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
 * **Example** (Validate a paragraph block)
 *
 * ```ts
 * import { Block, Doc } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Block)(Doc.paragraph("Ready"))) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Block: S.Codec<Block, BlockEncoded> = S.suspend(() =>
  S.suspend((): S.Codec<Block, BlockEncoded> => Block).pipe(S.Array, blockShape)
).pipe(
  $I.annoteSchema("Block", { description: "Plain tagged document blocks with recursive containers and callbacks." })
);

/**
 * Where and how a GitHub Actions annotation is shown: its level, and an optional position and title.
 *
 * **Example** (Validate annotation metadata)
 *
 * ```ts
 * import { AnnotationOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AnnotationOptions)({ level: "warning", file: "src/main.ts", line: 12 })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const AnnotationOptions = S.Struct(GithubAnnotationProperties.fields).pipe(
  $I.annoteSchema("AnnotationOptions", {
    description: "A GitHub Actions annotation level and optional position and title.",
  })
);
/**
 * The decoded level and optional source position of a workflow annotation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnnotationOptions = typeof AnnotationOptions.Type;

/**
 * One row of a `CountsTable`: its label, its counters and how long it took.
 *
 * **Example** (Validate a timing row)
 *
 * ```ts
 * import { CountsRow, Doc } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CountsRow)({ label: [Doc.text("lint")], counters: [], durationMs: 1200 })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class CountsRow extends S.Opaque<CountsRow, { readonly brand: unique symbol }>()(
  S.Struct({
    /** What the row is, such as a project name. */
    label: S.Array(Inline).pipe($I.annoteKey("CountsRow.label", { description: "The label field of CountsRow." })),
    /** Its counters; their keys pick the column each lands in. */
    counters: S.Array(Counter).pipe(
      $I.annoteKey("CountsRow.counters", { description: "The counters field of CountsRow." })
    ),
    /** How long it took, in milliseconds, shown with `Fmt.duration` in the duration column. */
    durationMs: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("CountsRow.durationMs", { description: "The durationMs field of CountsRow." })
    ),
  }).pipe(
    $I.annoteSchema("CountsRow", { description: "A counts-table row with label, counters and optional duration." })
  )
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { CountsRow } from "@beep/cli-kit/Doc"
 *
 * const accepts = (_value: CountsRow.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CountsRow {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CountsRow.Encoded;
}

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { CountsTableOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CountsTableOptions)({ totalRow: true })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class CountsTableOptions extends S.Opaque<CountsTableOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The header of the duration column, shown only when some row has a `durationMs`; `duration` when unset. */
    durationHeader: S.optionalKey(
      S.Union([S.String, S.toType(Inline), S.Array(S.Union([S.String, S.toType(Inline)]))])
    ).pipe(
      $I.annoteKey("CountsTableOptions.durationHeader", {
        description: "The durationHeader field of CountsTableOptions.",
      })
    ),
    /** The header of the label column, such as `Project`; empty when unset. */
    labelHeader: S.optionalKey(
      S.Union([S.String, S.toType(Inline), S.Array(S.Union([S.String, S.toType(Inline)]))])
    ).pipe(
      $I.annoteKey("CountsTableOptions.labelHeader", { description: "The labelHeader field of CountsTableOptions." })
    ),
    /** A last row summing each column: labelled with a plain `Total` when `true`, or with the content given (`Doc.strong("Total")` for a bold one). */
    totalRow: S.optionalKey(
      S.Union([S.Boolean, S.Union([S.String, S.toType(Inline), S.Array(S.Union([S.String, S.toType(Inline)]))])])
    ).pipe($I.annoteKey("CountsTableOptions.totalRow", { description: "The totalRow field of CountsTableOptions." })),
  }).pipe($I.annoteSchema("CountsTableOptions", { description: "Plain CountsTableOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CountsTableOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: CountsTableOptions.Encoded = { totalRow: true }
 * console.log(S.is(CountsTableOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CountsTableOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CountsTableOptions.Encoded;
}

/**
 * The cap and overflow options of a list or table.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { OverflowOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(OverflowOptions)({ cap: 5 })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class OverflowOptions extends S.Opaque<OverflowOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The most rows to show; the renderer hides the rest. */
    cap: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("OverflowOptions.cap", { description: "The cap field of OverflowOptions." })
    ),
    /** Says what the hidden rows amount to, given how many there are; it is a function and is never serialised. */
    overflow: S.optionalKey(OverflowOptionsOverflow).pipe(
      $I.annoteKey("OverflowOptions.overflow", { description: "The overflow field of OverflowOptions." })
    ),
  }).pipe($I.annoteSchema("OverflowOptions", { description: "Plain OverflowOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { OverflowOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: OverflowOptions.Encoded = { cap: 5 }
 * console.log(S.is(OverflowOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OverflowOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof OverflowOptions.Encoded;
}

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { ListOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ListOptions)({ compact: true })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class ListOptions extends S.Opaque<ListOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...OverflowOptions.fields,
    /** No blank lines between the children of an item, such as a section's title and body. */
    compact: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ListOptions.compact", { description: "The compact field of ListOptions." })
    ),
  }).pipe($I.annoteSchema("ListOptions", { description: "Plain ListOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { ListOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: ListOptions.Encoded = { compact: true }
 * console.log(S.is(ListOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ListOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ListOptions.Encoded;
}

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { TableOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TableOptions)({ style: "pipe" })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class TableOptions extends S.Opaque<TableOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...OverflowOptions.fields,
    /**
     * `pipe` gives plain and `ansi` istanbul's shape: rules above and below the header and at the end, cells joined
     * with ` | `. Markdown's table is a pipe table either way. Unset, the columns are space-aligned.
     */
    style: S.optionalKey(S.Literal("pipe")).pipe(
      $I.annoteKey("TableOptions.style", { description: "The style field of TableOptions." })
    ),
  }).pipe($I.annoteSchema("TableOptions", { description: "Plain TableOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { TableOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: TableOptions.Encoded = { style: "pipe" }
 * console.log(S.is(TableOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TableOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TableOptions.Encoded;
}

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { LinkOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LinkOptions)({ suffix: false })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class LinkOptions extends S.Opaque<LinkOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Whether the target follows the label in parentheses where a link cannot be followed: plain text, `ansi` with
     * links off, markdown with no URL. `true` always, `false` never; unset, only when the label does not already show
     * the target's display form (`displayPath(file)`, then `:line` and `:col` when present).
     */
    suffix: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("LinkOptions.suffix", { description: "The suffix field of LinkOptions." })
    ),
  }).pipe($I.annoteSchema("LinkOptions", { description: "Plain LinkOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { LinkOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: LinkOptions.Encoded = { suffix: false }
 * console.log(S.is(LinkOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LinkOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LinkOptions.Encoded;
}

/**
 * A whole document: its blocks, in order.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type Document = ReadonlyArray<Block>;

/**
 * What a constructor accepts for content: a string, one `Inline`, or an array of either.
 *
 * **Details**
 *
 * A string becomes a `Text` node with no token.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type InlineInput = string | Inline | ReadonlyArray<string | Inline>;

/**
 * A tree node as a constructor accepts it: the label may be a string and `children` may be left out.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { TreeInput } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TreeInput)({ label: "src", children: [{ label: "index.ts" }] })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class TreeInput extends S.Opaque<TreeInput, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Its children; none when omitted. */
    children: S.optionalKey(S.suspend((): S.Codec<TreeInput.Encoded> => S.toEncoded(TreeInput)).pipe(S.Array)).pipe(
      $I.annoteKey("TreeInput.children", { description: "The children field of TreeInput." })
    ),
    /** What the node says. */
    label: S.Union([S.String, S.toType(Inline), S.Array(S.Union([S.String, S.toType(Inline)]))]).pipe(
      $I.annoteKey("TreeInput.label", { description: "The label field of TreeInput." })
    ),
  }).pipe($I.annoteSchema("TreeInput", { description: "Plain TreeInput data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { TreeInput } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: TreeInput.Encoded = { label: "src", children: [{ label: "index.ts" }] }
 * console.log(S.is(TreeInput)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TreeInput {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children?: ReadonlyArray<Encoded>;
    readonly label: InlineInput;
  }
}

/**
 * The inline node with a given `_tag`, so a constructor can return its precise type.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type InlineOf<Tag extends Inline["_tag"]> = Extract<Inline, { readonly _tag: Tag }>;

/**
 * The block node with a given `_tag`, so a constructor can return its precise type.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type BlockOf<Tag extends Block["_tag"]> = Extract<Block, { readonly _tag: Tag }>;

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { CountsOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CountsOptions)({ counters: [], layout: "inline" })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class CountsOptions extends S.Opaque<CountsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The counters, in the order they are shown. */
    counters: S.Array(Counter).pipe(
      $I.annoteKey("CountsOptions.counters", { description: "The counters field of CountsOptions." })
    ),
    /** How long it took, in milliseconds. */
    durationMs: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("CountsOptions.durationMs", { description: "The durationMs field of CountsOptions." })
    ),
    /** A leading label. */
    label: S.optionalKey(S.Union([S.String, S.toType(Inline), S.Array(S.Union([S.String, S.toType(Inline)]))])).pipe(
      $I.annoteKey("CountsOptions.label", { description: "The label field of CountsOptions." })
    ),
    /** How the counters are laid out. */
    layout: S.Union([S.Literal("inline"), S.Literal("columns"), S.Literal("row")]).pipe(
      $I.annoteKey("CountsOptions.layout", { description: "The layout field of CountsOptions." })
    ),
    /**
     * What is painted: `all` (the default) paints the counters, the label, the qualifier and the duration; `glyph`
     * paints only a status glyph, if one is shown; `none` paints nothing.
     */
    paint: S.optionalKey(S.Union([S.Literal("all"), S.Literal("glyph"), S.Literal("none")])).pipe(
      $I.annoteKey("CountsOptions.paint", { description: "The paint field of CountsOptions." })
    ),
    /** Text after the counters, such as `(1 flaky)`. */
    qualifier: S.optionalKey(
      S.Union([S.String, S.toType(Inline), S.Array(S.Union([S.String, S.toType(Inline)]))])
    ).pipe($I.annoteKey("CountsOptions.qualifier", { description: "The qualifier field of CountsOptions." })),
    /** Whether the first counter shows its share of the total, `n/total`; `true` by default. `false` shows `n label`. */
    share: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("CountsOptions.share", { description: "The share field of CountsOptions." })
    ),
    /** Text after the duration, such as `across 3 files`. */
    suffix: S.optionalKey(S.Union([S.String, S.toType(Inline), S.Array(S.Union([S.String, S.toType(Inline)]))])).pipe(
      $I.annoteKey("CountsOptions.suffix", { description: "The suffix field of CountsOptions." })
    ),
    /** Replaces the default total, the sum of `n` over every counter, for example to fold timed-out runs in. */
    total: S.optionalKey(CountsOptionsTotal).pipe(
      $I.annoteKey("CountsOptions.total", { description: "The total field of CountsOptions." })
    ),
  }).pipe($I.annoteSchema("CountsOptions", { description: "Plain CountsOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { CountsOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: CountsOptions.Encoded = { counters: [], layout: "inline" }
 * console.log(S.is(CountsOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CountsOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CountsOptions.Encoded;
}

/** What {@link Doc.counter} counts: the counter's key, label, number and zero policy. */
type CounterOptions = {
  readonly key: string;
  readonly label: string | { readonly one: string; readonly other: string };
  readonly n: number;
  readonly showZero?: boolean;
};

/** One row of a {@link Doc.countsTable}: its label, its counters and an optional duration. */
type CountsTableRowInput = {
  readonly label: InlineInput;
  readonly counters: ReadonlyArray<Counter.Encoded>;
  readonly durationMs?: number;
};

/** One column of a {@link Doc.table}: its header and alignment. */
type TableColumnInput = { readonly header: InlineInput; readonly align?: "left" | "right" | "center" };

/** How a {@link Doc.line} is laid out: cut to the width, or kept on one line. */
type LineOptions = { readonly truncate?: boolean; readonly wrap?: boolean };

const isList = (input: InlineInput): input is ReadonlyArray<string | Inline> => A.isArray(input);

/** Write a rendered document only when it has content. */
const writeRendered = (text: string, stream: "stdout" | "stderr") =>
  text === "" ? Effect.void : stream === "stderr" ? Console.error(text) : Console.log(text);

const text = (value: string, token?: TokenName | Style.Encoded): InlineOf<"Text"> => ({
  _tag: "Text",
  value,
  ...O.getSomesStruct({
    token: O.map(O.fromUndefinedOr(token), (value) => (P.isString(value) ? value : Style.make(value))),
  }),
});

const inlineOne = (part: string | Inline): Inline => (P.isString(part) ? text(part) : part);

const inlines = (input: InlineInput): ReadonlyArray<Inline> =>
  A.copy(isList(input) ? A.map(input, inlineOne) : [inlineOne(input)]);

const overflowOf =
  (overflow: (hidden: number) => InlineInput): ((hidden: number) => ReadonlyArray<Inline>) =>
  (hidden) =>
    inlines(overflow(hidden));

const overflowFields = (options: OverflowOptions.Encoded | undefined) => ({
  ...O.getSomesStruct({ cap: O.fromUndefinedOr(options?.cap) }),
  ...O.getSomesStruct({ overflow: O.map(O.fromUndefinedOr(options?.overflow), overflowOf) }),
});

const treeNode = (input: TreeInput.Encoded): TreeNode => ({
  label: inlines(input.label),
  children: A.copy(A.map(input.children ?? [], treeNode)),
});

const statusDef = (def: StatusDef.Encoded): StatusDef =>
  StatusDef.make({
    ...def,
    token: P.isString(def.token) ? def.token : Style.make(def.token),
  });

const counterOf = (counter: Counter.Encoded): Counter =>
  Counter.make({
    ...counter,
    label: P.isString(counter.label) ? counter.label : { one: counter.label.one, other: counter.label.other },
    status: StatusRef.make({ name: counter.status.name, def: statusDef(counter.status.def) }),
  });

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { DocPrintOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DocPrintOptions)({ format: "plain", width: 80 })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class DocPrintOptions extends S.Opaque<DocPrintOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Turns an absolute path into its display form, for example relative to the workspace; see `Render.context`. */
    displayPath: S.optionalKey(DisplayPath).pipe(
      $I.annoteKey("DocPrintOptions.displayPath", { description: "The displayPath field of DocPrintOptions." })
    ),
    /**
     * The renderer. `auto`, the default, is chosen from the audience: `plain` for an agent, `githubLog` for a CI
     * that `CurrentRuntimeEnv` says is GitHub Actions and `plain` for every other, and `ansi` for a human.
     */
    format: S.optionalKey(
      S.Union([S.Literal("auto"), S.Literal("plain"), S.Literal("ansi"), S.Literal("markdown"), S.Literal("githubLog")])
    ).pipe($I.annoteKey("DocPrintOptions.format", { description: "The format field of DocPrintOptions." })),
    /** The stream to write to; `stdout` by default. */
    stream: S.optionalKey(S.Union([S.Literal("stdout"), S.Literal("stderr")])).pipe(
      $I.annoteKey("DocPrintOptions.stream", { description: "The stream field of DocPrintOptions." })
    ),
    /** The display columns to lay out at, replacing the audience's default; see `Render.context`. */
    width: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("DocPrintOptions.width", { description: "The width field of DocPrintOptions." })
    ),
  }).pipe($I.annoteSchema("DocPrintOptions", { description: "Plain DocPrintOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { DocPrintOptions } from "@beep/cli-kit/Doc"
 * import * as S from "effect/Schema"
 *
 * const plain: DocPrintOptions.Encoded = { format: "plain", width: 80 }
 * console.log(S.is(DocPrintOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocPrintOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DocPrintOptions.Encoded;
}

/**
 * Builds the document intermediate representation and provides two helpers shared by renderers.
 *
 * **Details**
 *
 * Every constructor returns a readonly plain node and copies the arrays it is given, so editing an input afterwards
 * cannot change a document. An optional field that is not given is absent from the node, not `undefined`.
 * Content arguments accept a string, an `Inline` or an array of either.
 *
 * A node is plain data: nothing decodes or encodes one, so a function field such as `overflow` or `total` is fine
 * and a document is not meant to be serialised.
 *
 * Readonly types describe constructor results. A `Style` object given as a token is shared by reference;
 * copied status definitions are shallow for the same reason.
 *
 * **Example** (Build a results report with a status and timing table)
 *
 * ```ts
 * import { Doc } from "@beep/cli-kit/Doc"
 * import { Status } from "@beep/cli-kit/Status"
 *
 * const report = [
 * 	Doc.heading(2, "Results"),
 * 	Doc.paragraph(Doc.status(Status.core, "success"), " ", "3 checks passed"),
 * 	Doc.table([{ header: "Check" }, { header: "Time", align: "right" }], [["lint", "1.2s"]]),
 * ]
 * // Written for whoever is reading: `yield* Doc.print(report)`
 * console.log(report.length) // 3
 * ```
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export abstract class Doc {
  /**
   * Creates inline text that can carry a semantic token or style.
   *
   * **Example** (Preserve text content)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.text("Ready").value) // Ready
   * ```
   *
   * @param value - the text
   * @param token - a semantic token or a style to paint it with
   * @category constructors
   * @since 0.0.0
   */
  static text(value: string, token?: TokenName | Style.Encoded): InlineOf<"Text"> {
    return text(value, token);
  }

  /**
   * Marks inline code for monospace rendering.
   *
   * **Example** (Preserve inline code)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.code("bun check").value) // bun check
   * ```
   *
   * @param value - the code
   * @category constructors
   * @since 0.0.0
   */
  static code(value: string): InlineOf<"Code"> {
    return { _tag: "Code", value };
  }

  /**
   * A link to a URL or a file position.
   *
   * **Example** (Build a labelled URL)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.link({ url: "https://example.com" }, "Docs")._tag) // Link
   * ```
   *
   * @param target - `{ url }` or `{ file, line?, col? }`
   * @param label - what the link says; when omitted, the bare URL or file path, which leaves out `line` and `col`
   * @param options - `suffix`, whether the target follows the label where the link cannot be followed
   * @category constructors
   * @since 0.0.0
   */
  static link(target: LinkTargetInput, label?: InlineInput, options?: LinkOptions.Encoded): InlineOf<"Link">;
  /**
   * A link when there is a target, and its label alone when there is none: a string label as a `Text`, every other
   * inline as itself.
   *
   * **Example** (Keep an unlinked label)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.link(undefined, "Offline")._tag) // Text
   * ```
   *
   * @param target - `{ url }`, `{ file, line?, col? }`, or `undefined` for no link
   * @param label - what the link says
   * @param options - `suffix`, whether the target follows the label where the link cannot be followed
   * @category constructors
   * @since 0.0.0
   */
  static link(target: LinkTargetInput | undefined, label: string | Inline, options?: LinkOptions.Encoded): Inline;
  static link(
    target: LinkTargetInput | undefined,
    label?: InlineInput,
    options?: LinkOptions.Encoded
  ): InlineInput | undefined {
    if (target === undefined) return P.isString(label) ? text(label) : label;
    const admitted = admitLinkTarget(target);
    const fallback = "url" in admitted ? admitted.url : admitted.file;
    return {
      _tag: "Link",
      target: admitted,
      label: inlines(label ?? fallback),
      ...O.getSomesStruct({ suffix: O.fromUndefinedOr(options?.suffix) }),
    };
  }

  /**
   * A status glyph, holding the resolved definition.
   *
   * **Gotchas**
   *
   * A name the vocabulary does not have is a compile error.
   *
   * **Example** (Resolve a success glyph)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Status } from "@beep/cli-kit/Status"
   *
   * console.log(Doc.status(Status.core, "success").name) // success
   * ```
   *
   * @param vocab - the vocabulary the name belongs to
   * @param name - a status name in it
   * @category constructors
   * @since 0.0.0
   */
  static readonly status: {
    <N extends string>(vocab: Status<N>, name: NoInfer<N>): InlineOf<"StatusMark">;
    <N extends string>(name: N): (vocab: Status<N>) => InlineOf<"StatusMark">;
  } = dual(
    2,
    <N extends string>(vocab: Status<N>, name: NoInfer<N>): InlineOf<"StatusMark"> => ({
      _tag: "StatusMark",
      name,
      def: statusDef(vocab.resolve(name)),
    })
  );

  /**
   * Content in bold: markdown `**…**`, bold in `ansi`, and the content as is in plain and `githubLog`.
   *
   * **Example** (Group bold content)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.strong("3", " passed").content.length) // 2
   * ```
   *
   * @param content - an arbitrary number of strings, inlines or arrays of them, in order
   * @category constructors
   * @since 0.0.0
   */
  static strong(...content: Array<InlineInput>): InlineOf<"Strong"> {
    return { _tag: "Strong", content: inlines(A.flatMap(content, (part) => (isList(part) ? part : [part]))) };
  }

  /**
   * Content in italic: markdown `*…*` (which GFM reads inside a word too), italic in `ansi`, and the content as is in
   * plain and `githubLog`.
   *
   * **Example** (Group italic content)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.em("Retry", " later").content.length) // 2
   * ```
   *
   * @param content - an arbitrary number of strings, inlines or arrays of them, in order
   * @category constructors
   * @since 0.0.0
   */
  static em(...content: Array<InlineInput>): InlineOf<"Emphasis"> {
    return { _tag: "Emphasis", content: inlines(A.flatMap(content, (part) => (isList(part) ? part : [part]))) };
  }

  /**
   * A file path, shown through the context's `displayPath` and never linked.
   *
   * **Example** (Preserve a display path)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.file("/workspace/src/main.ts").path) // /workspace/src/main.ts
   * ```
   *
   * @param path - the path, usually absolute
   * @category constructors
   * @since 0.0.0
   */
  static file(path: string): InlineOf<"File"> {
    return { _tag: "File", path };
  }

  /**
   * A path or breadcrumb; a renderer joins the segments with the audience's separator.
   *
   * **Example** (Build breadcrumb segments)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.path("src", "main.ts").segments.join("/")) // src/main.ts
   * ```
   *
   * @param segments - the segments, in order
   * @category constructors
   * @since 0.0.0
   */
  static path(...segments: Array<string>): InlineOf<"Path"> {
    return { _tag: "Path", segments: A.copy(segments) };
  }

  /**
   * Introduces a document heading at the requested level.
   *
   * **Example** (Build a report heading)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.heading(2, "Results").level) // 2
   * ```
   *
   * @param level - 1 to 4
   * @param content - the heading text
   * @category constructors
   * @since 0.0.0
   */
  static readonly heading: {
    (level: 1 | 2 | 3 | 4, content: InlineInput): BlockOf<"Heading">;
    (content: InlineInput): (level: 1 | 2 | 3 | 4) => BlockOf<"Heading">;
  } = dual(
    2,
    (level: 1 | 2 | 3 | 4, content: InlineInput): BlockOf<"Heading"> => ({
      _tag: "Heading",
      level,
      content: inlines(content),
    })
  );

  /**
   * One logical line of content.
   *
   * **Example** (Normalize paragraph content)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.paragraph("Ready", Doc.code("bun check")).content.length) // 2
   * ```
   *
   * @param content - an arbitrary number of strings, inlines or arrays of them, in order
   * @category constructors
   * @since 0.0.0
   */
  static paragraph(...content: Array<InlineInput>): BlockOf<"Paragraph"> {
    return { _tag: "Paragraph", content: inlines(A.flatMap(content, (part) => (isList(part) ? part : [part]))) };
  }

  /**
   * Groups blocks into a list with optional row limits and overflow content.
   *
   * **Example** (Cap a list)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.list([Doc.paragraph("first"), Doc.paragraph("second")], { cap: 1 }).cap) // 1
   * ```
   *
   * @param items - the items
   * @param options - `cap`, `overflow`, and `compact` for no blank lines inside an item
   * @category constructors
   * @since 0.0.0
   */
  static readonly list: {
    (items: ReadonlyArray<Block>, options?: ListOptions.Encoded): BlockOf<"List">;
    (options?: ListOptions.Encoded): (items: ReadonlyArray<Block>) => BlockOf<"List">;
  } = dual(
    (args) => A.isArray(args[0]),
    (items: ReadonlyArray<Block>, options?: ListOptions.Encoded): BlockOf<"List"> => ({
      _tag: "List",
      items: A.copy(items),
      ...overflowFields(options),
      ...O.getSomesStruct({ compact: O.fromUndefinedOr(options?.compact) }),
    })
  );

  /**
   * Arranges inline content into columns and rows for tabular rendering.
   *
   * **Example** (Build an aligned table)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * const table = Doc.table([{ header: "Time", align: "right" }], [["1.2s"]])
   * console.log(table.rows.length) // 1
   * ```
   *
   * @param columns - the columns: a header and an optional alignment each
   * @param rows - the rows; each cell takes a string, an inline or an array of either
   * @param options - `cap`, `overflow`, and `style: "pipe"` for istanbul's shape in plain and `ansi`
   * @category constructors
   * @since 0.0.0
   */
  static readonly table: {
    (
      columns: ReadonlyArray<TableColumnInput>,
      rows: ReadonlyArray<ReadonlyArray<InlineInput>>,
      options?: TableOptions.Encoded
    ): BlockOf<"Table">;
    (
      rows: ReadonlyArray<ReadonlyArray<InlineInput>>,
      options?: TableOptions.Encoded
    ): (columns: ReadonlyArray<TableColumnInput>) => BlockOf<"Table">;
  } = dual(
    // The data-first form always has the rows, an array, second; the data-last form has the options there, or nothing.
    (args) => A.isArray(args[1]),
    (
      columns: ReadonlyArray<TableColumnInput>,
      rows: ReadonlyArray<ReadonlyArray<InlineInput>>,
      options?: TableOptions.Encoded
    ): BlockOf<"Table"> => ({
      _tag: "Table",
      columns: A.copy(
        A.map(columns, (column) => ({
          _tag: "Column" as const,
          header: inlines(column.header),
          ...O.getSomesStruct({ align: O.fromUndefinedOr(column.align) }),
        }))
      ),
      rows: A.copy(A.map(rows, (row) => A.copy(A.map(row, inlines)))),
      ...overflowFields(options),
      ...O.getSomesStruct({ style: O.fromUndefinedOr(options?.style) }),
    })
  );

  /**
   * Builds nested labels for tree rendering.
   *
   * **Example** (Normalize a child tree)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.tree({ label: "src", children: [{ label: "main.ts" }] }).root.children.length) // 1
   * ```
   *
   * @param root - the root; a node's `children` may be left out
   * @category constructors
   * @since 0.0.0
   */
  static tree(root: TreeInput.Encoded): BlockOf<"Tree"> {
    return { _tag: "Tree", root: treeNode(root) };
  }

  /**
   * A titled body a renderer may fold.
   *
   * **Example** (Start a body unfolded)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.collapsible("Details", [Doc.paragraph("Ready")], { open: true }).open) // true
   * ```
   *
   * @param title - the title
   * @param body - the body
   * @param options - `open` asks for it to start unfolded
   * @category constructors
   * @since 0.0.0
   */
  static readonly collapsible: {
    (title: InlineInput, body: ReadonlyArray<Block>, options?: { readonly open?: boolean }): BlockOf<"Collapsible">;
    (body: ReadonlyArray<Block>, options?: { readonly open?: boolean }): (title: InlineInput) => BlockOf<"Collapsible">;
  } = dual(
    // The data-first form always has the body, an array, second; the data-last form has the options there, or nothing.
    (args) => A.isArray(args[1]),
    (
      title: InlineInput,
      body: ReadonlyArray<Block>,
      options?: { readonly open?: boolean }
    ): BlockOf<"Collapsible"> => ({
      _tag: "Collapsible",
      title: inlines(title),
      body: A.copy(body),
      ...O.getSomesStruct({ open: O.fromUndefinedOr(options?.open) }),
    })
  );

  /**
   * Highlights a body of blocks with a callout kind.
   *
   * **Example** (Build a warning body)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.callout("warning", [Doc.paragraph("Retry later")]).kind) // warning
   * ```
   *
   * @param kind - `note`, `tip`, `important`, `warning` or `caution`
   * @param body - the body
   * @category constructors
   * @since 0.0.0
   */
  static readonly callout: {
    (kind: "note" | "tip" | "important" | "warning" | "caution", body: ReadonlyArray<Block>): BlockOf<"Callout">;
    (body: ReadonlyArray<Block>): (kind: "note" | "tip" | "important" | "warning" | "caution") => BlockOf<"Callout">;
  } = dual(
    2,
    (kind: "note" | "tip" | "important" | "warning" | "caution", body: ReadonlyArray<Block>): BlockOf<"Callout"> => ({
      _tag: "Callout",
      kind,
      body: A.copy(body),
    })
  );

  /**
   * Preserves code text with an optional language for fenced rendering.
   *
   * **Example** (Select a code language)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.codeBlock("const ready = true", "ts").lang) // ts
   * ```
   *
   * @param text - the text
   * @param lang - its language, for a renderer that fences it
   * @category constructors
   * @since 0.0.0
   */
  static codeBlock(text: string, lang?: string): BlockOf<"CodeBlock"> {
    return { _tag: "CodeBlock", ...O.getSomesStruct({ lang: O.fromUndefinedOr(lang) }), text };
  }

  /**
   * Builds a comparison of expected and received text for diff rendering.
   *
   * **Example** (Cap an expected versus received diff)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.diff("expected", "received", { cap: 5 }).cap) // 5
   * ```
   *
   * @param expected - the expected text
   * @param received - the received text
   * @param options - `cap` limits the lines shown
   * @category constructors
   * @since 0.0.0
   */
  static readonly diff: {
    (expected: string, received: string, options?: { readonly cap?: number }): BlockOf<"Diff">;
    (received: string, options?: { readonly cap?: number }): (expected: string) => BlockOf<"Diff">;
  } = dual(
    // The data-first form always has `received`, a string, second; the data-last form has the options there, or nothing.
    (args) => P.isString(args[1]),
    (expected: string, received: string, options?: { readonly cap?: number }): BlockOf<"Diff"> => ({
      _tag: "Diff",
      expected,
      received,
      ...O.getSomesStruct({ cap: O.fromUndefinedOr(options?.cap) }),
    })
  );

  /**
   * Children under an optional title.
   *
   * **Details**
   *
   * The children are separated by blank lines (unless the document is compact); a title sits directly above the first.
   * `Doc.section(undefined, blocks)` is the way to space a document's top-level blocks, which are otherwise joined with
   * no blank line.
   *
   * **Example** (Group spaced top-level blocks)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.section(undefined, [Doc.paragraph("first"), Doc.paragraph("second")]).children.length) // 2
   * ```
   *
   * @param title - the title, or `undefined` for none
   * @param children - the blocks
   * @category constructors
   * @since 0.0.0
   */
  static readonly section: {
    (title: InlineInput | undefined, children: ReadonlyArray<Block>): BlockOf<"Section">;
    (children: ReadonlyArray<Block>): (title: InlineInput | undefined) => BlockOf<"Section">;
  } = dual(
    2,
    (title: InlineInput | undefined, children: ReadonlyArray<Block>): BlockOf<"Section"> => ({
      _tag: "Section",
      ...O.getSomesStruct({ title: O.map(O.fromUndefinedOr(title), inlines) }),
      children: A.copy(children),
    })
  );

  /**
   * One counter of a `Counts` block, with its status definition resolved.
   *
   * **Details**
   *
   * A name the vocabulary does not have is a compile error.
   *
   * The label is one string, or `{ one, other }` to pluralise by count: `one` when the count is exactly 1 and `other`
   * for every other count, 0 included. A count standing alone reads by its own `n` (`1 change`, `2 changes`); a
   * headline shown as a share of the total reads by that total, the noun it counts (`1/1 repo`, `1/3 repos`,
   * `2/3 repos`).
   *
   * **Example** (Resolve a named count)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Status } from "@beep/cli-kit/Status"
   *
   * const counter = Doc.counter(Status.core, "success", { key: "passed", label: { one: "check", other: "checks" }, n: 3 })
   * console.log(counter.n) // 3
   * ```
   *
   * @param vocab - the vocabulary the status belongs to
   * @param name - a status name in it
   * @param options - the counter's `key`, its `label` (one string, or `{ one, other }`), its count `n`, and `showZero`
   * to keep it when `n` is zero
   * @category constructors
   * @since 0.0.0
   */
  static readonly counter: {
    <N extends string>(vocab: Status<N>, name: NoInfer<N>, options: CounterOptions): Counter;
    <N extends string>(name: N, options: CounterOptions): (vocab: Status<N>) => Counter;
  } = dual(
    3,
    <N extends string>(vocab: Status<N>, name: NoInfer<N>, options: CounterOptions): Counter =>
      counterOf({
        key: options.key,
        label: options.label,
        n: options.n,
        // Plain fields: `counterOf` admits the status, its definition and the counter once each.
        status: { name, def: vocab.resolve(name) },
        ...O.getSomesStruct({ showZero: O.fromUndefinedOr(options.showZero) }),
      })
  );

  /**
   * Builds a counter summary in the requested layout.
   *
   * **Example** (Choose a counter layout)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.counts({ counters: [], layout: "inline" }).layout) // inline
   * ```
   *
   * @param options - the counters, the layout and the optional label, total rule, qualifier and duration
   * @category constructors
   * @since 0.0.0
   */
  static counts(options: CountsOptions.Encoded): BlockOf<"Counts"> {
    return {
      _tag: "Counts",
      ...O.getSomesStruct({ label: O.map(O.fromUndefinedOr(options.label), inlines) }),
      counters: A.copy(A.map(options.counters, counterOf)),
      ...O.getSomesStruct({ total: O.fromUndefinedOr(options.total) }),
      ...O.getSomesStruct({ qualifier: O.map(O.fromUndefinedOr(options.qualifier), inlines) }),
      ...O.getSomesStruct({ durationMs: O.fromUndefinedOr(options.durationMs) }),
      layout: options.layout,
      ...O.getSomesStruct({ share: O.fromUndefinedOr(options.share) }),
      ...O.getSomesStruct({ paint: O.fromUndefinedOr(options.paint) }),
      ...O.getSomesStruct({ suffix: O.map(O.fromUndefinedOr(options.suffix), inlines) }),
    };
  }

  /**
   * Counters as a table: a row per entry, a column per counter key (in the order the keys first appear, headed by
   * the counter's label), and an optional total row summing each column.
   *
   * **Details**
   *
   * A row without a counter for some key leaves that cell empty, and it counts as zero in the total. A counter whose
   * `n` is zero shows `0`, as a `Doc.table` cell would: a counter's `showZero` has no effect in a table, only in a
   * `Counts` block, so there is no need to set it. `totalRow`
   * labels the total row with a plain `Total` when `true`, or with the content given: for a bold one, pass
   * `totalRow: Doc.strong("Total")`. A column is headed by its counter's `label`; a counter's status paints its cells
   * in `ansi` and is ignored in markdown, so a plain numbers table may pass a status of its choice. `labelHeader` heads the label column, which
   * is otherwise empty. When some row has a `durationMs`, a last column shows it with `Fmt.duration`, headed
   * `durationHeader` (`duration` by default); a row without one has an empty cell there and counts as zero in the
   * total row's summed duration.
   *
   * **Example** (Request a summed table row)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.countsTable([{ label: "lint", counters: [] }], { totalRow: true }).totalRow) // true
   * ```
   *
   * @param rows - each row's label, counters and optional duration
   * @param options - `totalRow`, to add the summed row; the label and duration column headers
   * @category constructors
   * @since 0.0.0
   */
  static readonly countsTable: {
    (rows: ReadonlyArray<CountsTableRowInput>, options?: CountsTableOptions.Encoded): BlockOf<"CountsTable">;
    (options?: CountsTableOptions.Encoded): (rows: ReadonlyArray<CountsTableRowInput>) => BlockOf<"CountsTable">;
  } = dual(
    (args) => A.isArray(args[0]),
    (rows: ReadonlyArray<CountsTableRowInput>, options?: CountsTableOptions.Encoded): BlockOf<"CountsTable"> => {
      const totalRow = options?.totalRow;
      return {
        _tag: "CountsTable",
        rows: A.copy(
          A.map(rows, (row) =>
            CountsRow.make({
              label: inlines(row.label),
              counters: A.copy(A.map(row.counters, counterOf)),
              ...O.getSomesStruct({ durationMs: O.fromUndefinedOr(row.durationMs) }),
            })
          )
        ),
        ...O.getSomesStruct({
          totalRow: O.map(O.fromUndefinedOr(totalRow), (row) => (P.isBoolean(row) ? row : inlines(row))),
        }),
        ...O.getSomesStruct({ labelHeader: O.map(O.fromUndefinedOr(options?.labelHeader), inlines) }),
        ...O.getSomesStruct({ durationHeader: O.map(O.fromUndefinedOr(options?.durationHeader), inlines) }),
      };
    }
  );

  /**
   * Lines, one per entry, in every renderer: markdown joins them with hard breaks so they never collapse into one.
   *
   * **Example** (Keep two separate lines)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.lines(["first", "second"]).lines.length) // 2
   * ```
   *
   * @param lines - the entries; each takes a string, an inline or an array of either
   * @category constructors
   * @since 0.0.0
   */
  static lines(lines: ReadonlyArray<InlineInput>): BlockOf<"Lines"> {
    return { _tag: "Lines", lines: A.copy(A.map(lines, inlines)) };
  }

  /**
   * One line of content; with `truncate`, it is cut to the width with the glyph set's ellipsis instead of wrapping,
   * and with `wrap: false` it is kept whole on one line whatever the width.
   *
   * **Details**
   *
   * By default a line longer than the width wraps. `wrap: false` keeps it atomic in every audience and renderer, still
   * carrying its status glyphs, theme tokens and links, which {@link Doc.verbatim} (a plain string) cannot: the tool for
   * a finding such as `✗ path:line:col  rule  message` that a reader greps or reads line by line, while the prose around
   * it still wraps. A line break inside it is still a space. With both `truncate` and `wrap: false`, `truncate` wins:
   * the line is cut to the width.
   *
   * **Example** (Keep a finding on one line)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.line("src/main.ts:12 rule message", { wrap: false }).wrap) // false
   * ```
   *
   * @param content - the line
   * @param options - `truncate`, to cut it to the width; `wrap: false`, to keep it whole
   * @category constructors
   * @since 0.0.0
   */
  static readonly line: {
    (content: InlineInput, options?: LineOptions): BlockOf<"Line">;
    (options?: LineOptions): (content: InlineInput) => BlockOf<"Line">;
  } = dual(
    (args) => P.isString(args[0]) || A.isArray(args[0]) || P.hasProperty(args[0], "_tag"),
    (content: InlineInput, options?: { readonly truncate?: boolean; readonly wrap?: boolean }): BlockOf<"Line"> => ({
      _tag: "Line",
      content: inlines(content),
      ...O.getSomesStruct({ truncate: O.fromUndefinedOr(options?.truncate) }),
      ...O.getSomesStruct({ wrap: O.fromUndefinedOr(options?.wrap) }),
    })
  );

  /**
   * A unified diff as given, such as a test runner's: sanitized, its `+` and `-` lines painted `success` and
   * `failure` in `ansi`, and a `diff` fence in markdown.
   *
   * **Details**
   *
   * With `truncate`, plain and `ansi` cut each line to the width with the glyph set's ellipsis instead of wrapping
   * it; an agent's or a CI's width is unbounded, so nothing is cut for them unless the context gives a finite width.
   * Markdown keeps every line whole. Inside a compact list item a blank line of the diff keeps the item's indent.
   *
   * A trailing line break ends the last line, as in a unified diff file, and adds no blank line after it: `"a\n"` is
   * one line. To end on a blank line, end the text with two line breaks.
   *
   * **Example** (Keep a unified diff whole)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.diffText("-old\n+new\n", { truncate: true }).truncate) // true
   * ```
   *
   * @param unified - the diff
   * @param options - `cap`, the most lines shown; `truncate`, to cut each line to the width
   * @category constructors
   * @since 0.0.0
   */
  static readonly diffText: {
    (unified: string, options?: { readonly cap?: number; readonly truncate?: boolean }): BlockOf<"DiffText">;
    (options?: { readonly cap?: number; readonly truncate?: boolean }): (unified: string) => BlockOf<"DiffText">;
  } = dual(
    (args) => P.isString(args[0]),
    (unified: string, options?: { readonly cap?: number; readonly truncate?: boolean }): BlockOf<"DiffText"> => ({
      _tag: "DiffText",
      text: unified,
      ...O.getSomesStruct({ cap: O.fromUndefinedOr(options?.cap) }),
      ...O.getSomesStruct({ truncate: O.fromUndefinedOr(options?.truncate) }),
    })
  );

  /**
   * Lines kept exactly: each indented by `indent` spaces, sanitized, and never wrapped.
   *
   * **Details**
   *
   * Plain, `ansi` and `githubLog` write the lines as they are; markdown fences them, so the indentation survives.
   *
   * It is the tool for a single line that must never wrap nor be cut, whatever the width: {@link Doc.line} wraps at
   * the width, or cuts with `truncate`, and `verbatim` does neither.
   *
   * **Example** (Indent preformatted output)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.verbatim("fixed output", { indent: 2 }).indent) // 2
   * ```
   *
   * @param text - the lines
   * @param options - `indent`, the spaces in front of every line; none by default
   * @category constructors
   * @since 0.0.0
   */
  static readonly verbatim: {
    (text: string, options?: { readonly indent?: number }): BlockOf<"Verbatim">;
    (options?: { readonly indent?: number }): (text: string) => BlockOf<"Verbatim">;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, options?: { readonly indent?: number }): BlockOf<"Verbatim"> => ({
      _tag: "Verbatim",
      text,
      ...O.getSomesStruct({ indent: O.fromUndefinedOr(options?.indent) }),
    })
  );

  /**
   * A GitHub Actions annotation: `Render.githubLog` writes it as one workflow command (`::error file=…::message`),
   * and every other renderer writes nothing.
   *
   * **Details**
   *
   * It is the kit's own command, so `githubLog` does not neutralize it; its message and properties are escaped, so
   * no text in them can end the command or start another. It is a command where a line starts: at the top level, as a
   * top-level section's child, or as a direct child of a group's body. Nested deeper, it is dropped.
   *
   * **Example** (Build a workflow error)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   *
   * console.log(Doc.annotation({ level: "error", file: "src/main.ts", line: 12 }, "Invalid input").message) // Invalid input
   * ```
   *
   * @param options - the level, and the optional file, position and title
   * @param message - what it says
   * @category constructors
   * @since 0.0.0
   */
  static readonly annotation: {
    (options: AnnotationOptions, message: string): BlockOf<"Annotation">;
    (message: string): (options: AnnotationOptions) => BlockOf<"Annotation">;
  } = dual(
    2,
    (options: AnnotationOptions, message: string): BlockOf<"Annotation"> => ({
      _tag: "Annotation",
      level: options.level,
      ...O.getSomesStruct({ file: O.fromUndefinedOr(options.file) }),
      ...O.getSomesStruct({ line: O.fromUndefinedOr(options.line) }),
      ...O.getSomesStruct({ col: O.fromUndefinedOr(options.col) }),
      ...O.getSomesStruct({ endLine: O.fromUndefinedOr(options.endLine) }),
      ...O.getSomesStruct({ endColumn: O.fromUndefinedOr(options.endColumn) }),
      ...O.getSomesStruct({ title: O.fromUndefinedOr(options.title) }),
      message,
    })
  );

  /**
   * The total of a `Counts` block: the caller's rule when it has one, otherwise the sum of `n` over every counter.
   *
   * **Details**
   *
   * The rule sees every counter, including the ones a renderer hides, so hiding never changes the total.
   *
   * **Example** (Sum counter values)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Status } from "@beep/cli-kit/Status"
   *
   * const block = Doc.counts({ counters: [Doc.counter(Status.core, "success", { key: "passed", label: "passed", n: 3 })], layout: "inline" })
   * console.log(Doc.total(block)) // 3
   * ```
   *
   * @param block - the `Counts` block
   * @category getters
   * @since 0.0.0
   */
  static total(block: BlockOf<"Counts">): number {
    return totalOf(block);
  }

  /**
   * The counters a renderer shows: every one except a zero counter that does not ask for `showZero`.
   *
   * **Example** (Hide a zero counter)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Status } from "@beep/cli-kit/Status"
   *
   * const block = Doc.counts({ counters: [Doc.counter(Status.core, "success", { key: "passed", label: "passed", n: 0 })], layout: "inline" })
   * console.log(Doc.visibleCounters(block).length) // 0
   * ```
   *
   * @param block - the `Counts` block
   * @category getters
   * @since 0.0.0
   */
  static visibleCounters(block: BlockOf<"Counts">): ReadonlyArray<Counter.Encoded> {
    return visibleCountersOf(block);
  }

  /**
   * Render a document for whoever is running the program and write it to a stream.
   *
   * **Details**
   *
   * The context is {@link Render.context} for the stream, so the width, the colour, the links and the audience
   * come from the services the program already has, and the text is written with `Console.log` or
   * `Console.error`: a test captures it by swapping the `Console`. With `format: "auto"` the renderer follows
   * the audience, and the width is unbounded for an agent, a CI, and a human whose stream is not a terminal.
   *
   * No escape sequence is ever written to an agent, even with an explicit `format: "ansi"`: its context is
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
   * **Example** (Construct a report printing effect)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import * as Effect from "effect/Effect"
   *
   * const program = Doc.print([Doc.paragraph("Ready")], { format: "plain" })
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param doc - the document
   * @param options - the stream and the format
   * @category formatting
   * @since 0.0.0
   */
  static readonly print: {
    (
      doc: Document,
      options?: DocPrintOptions.Encoded
    ): Effect.Effect<void, never, CliTheme | TerminalEnv | Audience | CliLinks>;
    (
      options?: DocPrintOptions.Encoded
    ): (doc: Document) => Effect.Effect<void, never, CliTheme | TerminalEnv | Audience | CliLinks>;
  } = dual(
    (args) => A.isArray(args[0]),
    Effect.fn("Doc.print")(function* (doc: Document, options?: DocPrintOptions.Encoded) {
      const stream = options?.stream ?? "stdout";
      const ctx = yield* Render.context(stream, {
        ...O.getSomesStruct({ displayPath: O.fromUndefinedOr(options?.displayPath) }),
        ...O.getSomesStruct({ width: O.fromUndefinedOr(options?.width) }),
      });
      const requested = options?.format ?? "auto";
      const format = requested === "auto" ? yield* autoFormat(ctx.audience) : requested;
      const text = Render[format](doc, ctx);
      // An empty document prints nothing, not a blank line.
      yield* writeRendered(text, stream);
    })
  );
}

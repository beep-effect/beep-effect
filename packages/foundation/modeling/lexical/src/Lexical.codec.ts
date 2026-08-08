/**
 * Md ↔ Lexical codecs over the canonical `@beep/md` AST.
 *
 * The supported round-trip profile and its documented degradations live in
 * the package README ("Lossiness profile"). In short: md-core blocks
 * (paragraph, heading, code, list, quote with a single paragraph, inline
 * strong/em/del/code/link/br) and `artifact-ref` round-trip; Lexical-only
 * presentation state (alignment, indent, direction, underline and other
 * non-md format bits, inline styles, NodeState) is dropped on the way to Md.
 *
 * @packageDocumentation \@beep/lexical-schema/Lexical.codec
 * @since 0.0.0
 */

import { $LexicalSchemaId } from "@beep/identity/packages";
import { segmentInlineRuns } from "@beep/md/Md.behavior";
import * as Md from "@beep/md/Md.model";
import { MappedLiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import { A, dual, O, P, Str } from "@beep/utils";
import { Effect, flow, Match, pipe } from "effect";
import * as S from "effect/Schema";
import { nodeToPlainText } from "./Lexical.behavior.ts";
import {
  ArtifactRefId,
  ArtifactRefNode,
  CodeNode,
  HeadingNode,
  hasTextFormat,
  LexicalNode,
  LineBreakNode,
  LinkNode,
  ListItemNode,
  ListNode,
  ListType,
  ParagraphNode,
  QuoteNode,
  RootNode,
  SafeUrl,
  SerializedEditorState,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextDetailMask,
  TextFormatBits,
  TextFormatMask,
  TextNode,
  withTextFormat,
  YouTubeNode,
} from "./Lexical.model.ts";
import type { TableCellHeaderState, TextFormatBit } from "./Lexical.model.ts";

const $I = $LexicalSchemaId.create("Lexical.codec");

/**
 * URI scheme that round-trips {@link ArtifactRefNode} through the Md AST as a
 * paragraph wrapping a single link.
 *
 * **Example** (Construct artifact URI)
 *
 * ```ts
 * import { ARTIFACT_URI_PREFIX } from "@beep/lexical-schema/Lexical.codec"
 *
 * console.log(`${ARTIFACT_URI_PREFIX}artifact-123`) // "artifact://artifact-123"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ARTIFACT_URI_PREFIX = "artifact://";

/**
 * Artifact URI form used when the Md projection carries an
 * {@link ArtifactRefNode} as a link.
 *
 * **Example** (Decode artifact URI)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ArtifactUri } from "@beep/lexical-schema/Lexical.codec"
 *
 * const result = S.decodeUnknownResult(ArtifactUri)("artifact://artifact-123")
 * console.log(Result.isSuccess(result) && result.success === "artifact://artifact-123") // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const ArtifactUri = S.TemplateLiteral([ARTIFACT_URI_PREFIX, ArtifactRefId]).pipe(
  $I.annoteSchema("ArtifactUri", {
    description: "artifact:// URI carrying a package-owned artifact reference id through the Md link projection.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link ArtifactUri}.
 *
 * **Example** (Accept ArtifactUri type)
 *
 * ```ts
 * import type { ArtifactUri } from "@beep/lexical-schema/Lexical.codec"
 *
 * const accept = (uri: ArtifactUri) => uri
 * console.log(accept)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export type ArtifactUri = typeof ArtifactUri.Type;

const ArtifactUriParts = S.TemplateLiteralParser([ARTIFACT_URI_PREFIX, ArtifactRefId]).pipe(
  SchemaUtils.withCodecStatics
);

const emptyTextFormat = TextFormatMask.make(0);
const emptyTextDetail = TextDetailMask.make(0);
const firstOrdinal = PosInt.make(1);
const noTableCellHeader = 0 satisfies TableCellHeaderState;
const rowTableCellHeader = 1 satisfies TableCellHeaderState;
const decodeSafeUrl = S.decodeUnknownEffect(SafeUrl);

// Reversible map between the Lexical heading `tag` ("h1".."h6") and the Md
// `Heading.level` (1..6): `From.Enum` resolves a tag to its level, `To.Enum`
// resolves a level (via its `number{n}` helper key) back to its tag.
const HeadingLevelTag = MappedLiteralKit([
  ["h1", 1],
  ["h2", 2],
  ["h3", 3],
  ["h4", 4],
  ["h5", 5],
  ["h6", 6],
] as const);

const textLeaf: {
  (text: string, format: TextFormatMask): Effect.Effect<TextNode, S.SchemaError>;
  (format: TextFormatMask): (text: string) => Effect.Effect<TextNode, S.SchemaError>;
} = dual(
  2,
  (text: string, format: TextFormatMask): Effect.Effect<TextNode, S.SchemaError> =>
    TextNode.makeEffect({ detail: emptyTextDetail, format, mode: "normal", style: "", text })
);

const lineBreak = () => LineBreakNode.makeEffect({});

const mdInlineText = Match.type<Md.Inline>().pipe(
  Match.tagsExhaustive({
    text: (node) => node.value,
    rawMarkdown: (node) => node.value,
    rawHtml: (node) => node.value,
    strong: (node) => mdInlinesText(node.children),
    em: (node) => mdInlinesText(node.children),
    del: (node) => mdInlinesText(node.children),
    code: (node) => node.value,
    a: (node) => mdInlinesText(node.children),
    img: (node) => node.alt,
    br: () => "\n",
    inlineMath: (node) => node.value,
    footnoteReference: (node) => node.identifier,
  })
);

const mdInlinesText: (inlines: ReadonlyArray<Md.Inline>) => string = flow(A.map(mdInlineText), A.join(""));

const mdListItemChildrenText = (children: ReadonlyArray<Md.ListItemChild>): string =>
  pipe(
    segmentInlineRuns(children, {
      isInline: Md.Inline.is,
      renderInlineRun: mdInlinesText,
      renderBlock: mdBlockText,
    }),
    A.join("\n")
  );

const mdListItemsText: (items: ReadonlyArray<{ readonly children: ReadonlyArray<Md.ListItemChild> }>) => string = flow(
  A.map((item: { readonly children: ReadonlyArray<Md.ListItemChild> }) => mdListItemChildrenText(item.children)),
  A.join("\n")
);

const mdBlockText = (block: Md.Block): string =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      heading: (node) => mdInlinesText(node.children),
      p: (node) => mdInlinesText(node.children),
      blockquote: (node) => A.join(A.map(node.children, mdBlockText), "\n"),
      pre: (node) => node.value,
      ul: (node) => mdListItemsText(node.children),
      ol: (node) => mdListItemsText(node.children),
      taskList: (node) => mdListItemsText(node.children),
      table: (node) =>
        A.join(
          A.map(node.children, (row) =>
            A.join(
              A.map(row.children, (cell) => mdInlinesText(cell.children)),
              "\t"
            )
          ),
          "\n"
        ),
      youtube: (node) => `https://www.youtube.com/watch?v=${node.videoId}`,
      mathBlock: (node) => node.value,
      footnoteDefinition: (node) => `[^${node.identifier}]: ${A.join(A.map(node.children, mdBlockText), "\n")}`,
      admonition: (node) => A.join(A.map(node.children, mdBlockText), "\n"),
      embed: (node) =>
        pipe(
          node.title,
          O.getOrElse(() => node.src)
        ),
      hr: () => "---",
    })
  );

const inlinesToLexical = (
  inlines: ReadonlyArray<Md.Inline>,
  format: TextFormatMask,
  insideLink = false
): Effect.Effect<ReadonlyArray<LexicalNode>, S.SchemaError> =>
  Effect.map(
    Effect.forEach(inlines, (inline) => inlineToLexical(inline, format, insideLink)),
    A.flatten
  );

const inlineToLexical = (
  inline: Md.Inline,
  format: TextFormatMask,
  insideLink = false
): Effect.Effect<ReadonlyArray<LexicalNode>, S.SchemaError> =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      // Trusted raw runs have no Lexical equivalent; they degrade to plain text
      // runs (README "Lossiness profile").
      text: (node) => Effect.map(textLeaf(node.value, format), A.of<LexicalNode>),
      rawMarkdown: (node) => Effect.map(textLeaf(node.value, format), A.of<LexicalNode>),
      rawHtml: (node) => Effect.map(textLeaf(node.value, format), A.of<LexicalNode>),
      strong: (node) => inlinesToLexical(node.children, withTextFormat(format, TextFormatBits.bold), insideLink),
      em: (node) => inlinesToLexical(node.children, withTextFormat(format, TextFormatBits.italic), insideLink),
      del: (node) => inlinesToLexical(node.children, withTextFormat(format, TextFormatBits.strikethrough), insideLink),
      code: (node) => Effect.map(textLeaf(node.value, withTextFormat(format, TextFormatBits.code)), A.of<LexicalNode>),
      a: (node) =>
        insideLink
          ? inlinesToLexical(node.children, format, true)
          : Effect.flatMap(inlinesToLexical(node.children, format, true), (children) =>
              Effect.flatMap(decodeSafeUrl(node.href), (url) =>
                Effect.map(LinkNode.makeEffect({ url, children, title: node.title }), A.of<LexicalNode>)
              )
            ),
      // Images normally degrade to links so the destination survives. Inside
      // an outer link, only the alt-text run is representable (README).
      img: (node) =>
        insideLink
          ? Effect.map(textLeaf(node.alt, format), A.of<LexicalNode>)
          : Effect.flatMap(textLeaf(node.alt, format), (alt) =>
              Effect.flatMap(decodeSafeUrl(node.src), (url) =>
                Effect.map(LinkNode.makeEffect({ url, children: [alt], title: node.title }), A.of<LexicalNode>)
              )
            ),
      br: () => Effect.map(lineBreak(), A.of<LexicalNode>),
      inlineMath: (node) => Effect.map(textLeaf(node.value, format), A.of<LexicalNode>),
      footnoteReference: (node) => Effect.map(textLeaf(`[^${node.identifier}]`, format), A.of<LexicalNode>),
    })
  );

const listItemsToLexical = (
  items: ReadonlyArray<{
    readonly children: ReadonlyArray<Md.ListItemChild>;
    readonly checked?: boolean;
  }>,
  start: PosInt = firstOrdinal
): Effect.Effect<ReadonlyArray<LexicalNode>, S.SchemaError> =>
  Effect.forEach(items, (item, index) =>
    Effect.flatMap(listItemChildrenToLexical(item.children), (children) =>
      ListItemNode.makeEffect({
        checked: O.fromUndefinedOr(item.checked),
        value: PosInt.make(index + start),
        children,
      })
    )
  );

const listItemChildrenToLexical = (
  children: ReadonlyArray<Md.ListItemChild>
): Effect.Effect<ReadonlyArray<LexicalNode>, S.SchemaError> =>
  Effect.map(
    Effect.forEach(children, (child) =>
      Md.Inline.is(child)
        ? inlineToLexical(child, emptyTextFormat)
        : P.isTagged("ul")(child) || P.isTagged("ol")(child) || P.isTagged("taskList")(child)
          ? Effect.map(blockToLexical(child), A.of<LexicalNode>)
          : Effect.map(textLeaf(mdBlockText(child), emptyTextFormat), A.of<LexicalNode>)
    ),
    A.flatten
  );

const quoteChildToInlines = (block: Md.Block): Effect.Effect<ReadonlyArray<LexicalNode>, S.SchemaError> =>
  P.isTagged("p")(block)
    ? inlinesToLexical(block.children, emptyTextFormat)
    : Effect.map(textLeaf(mdBlockText(block), emptyTextFormat), A.of<LexicalNode>);

const blockTextParagraph = (block: Md.Block): Effect.Effect<ParagraphNode, S.SchemaError> =>
  Effect.flatMap(textLeaf(mdBlockText(block), emptyTextFormat), (text) =>
    ParagraphNode.makeEffect({ children: [text] })
  );

type ArtifactRef = {
  readonly artifactId: ArtifactRefId;
  readonly label: O.Option<string>;
};

const artifactRefFromLink = (child: Md.A): O.Option<ArtifactRef> =>
  pipe(
    A.length(child.children) === 1 ? A.head(child.children) : O.none<Md.Inline>(),
    O.filter(S.is(Md.Text)),
    O.filter(({ value }) => Str.isNonEmpty(value) && O.isNone(child.title)),
    O.flatMap(({ value: label }) =>
      pipe(
        ArtifactUriParts.decodeOption(child.href),
        O.map(([, artifactId]) => ({
          artifactId,
          label: label === artifactId ? O.none<string>() : O.some(label),
        }))
      )
    )
  );

// A single inline child that is an `a` node whose href is an artifact:// URI.
const isArtifactLink: P.Refinement<Md.Inline, Md.A> = P.chainRefinements([
  (child: Md.Inline): child is Md.A => P.isTagged("a")(child),
  (child: Md.A): child is Md.A => ArtifactUri.is(child.href),
]);

const paragraphArtifactRef = (block: Md.P): O.Option<ArtifactRef> =>
  pipe(
    A.length(block.children) === 1 ? A.head(block.children) : O.none<Md.Inline>(),
    O.filter(isArtifactLink),
    O.flatMap(artifactRefFromLink)
  );

/**
 * Lift one Md block into its serialized Lexical node.
 *
 * **Example** (Convert paragraph to Lexical)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { P, Text } from "@beep/md/Md.model"
 * import { blockToLexical } from "@beep/lexical-schema/Lexical.codec"
 *
 * const node = Effect.runSync(blockToLexical(P.make({ children: [Text.make({ value: "Hello" })] })))
 * console.log(node.type) // "paragraph"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const blockToLexical = Match.type<Md.Block>().pipe(
  Match.tagsExhaustive({
    heading: (node) =>
      Effect.flatMap(inlinesToLexical(node.children, emptyTextFormat), (children) =>
        HeadingNode.makeEffect({ tag: HeadingLevelTag.To.Enum[`number${node.level}`], children })
      ),
    p: (node) =>
      O.match(paragraphArtifactRef(node), {
        onNone: () =>
          Effect.flatMap(inlinesToLexical(node.children, emptyTextFormat), (children) =>
            ParagraphNode.makeEffect({ children })
          ),
        onSome: (ref) => ArtifactRefNode.makeEffect({ artifactId: ref.artifactId, label: ref.label }),
      }),
    blockquote: Effect.fn(function* (node: Md.BlockQuote) {
      const runs = yield* Effect.forEach(node.children, quoteChildToInlines);
      const brk = yield* lineBreak();
      return yield* QuoteNode.makeEffect({ children: A.flatten(A.intersperse(runs, [brk])) });
    }),
    pre: Effect.fn(function* (node: Md.Pre) {
      const texts = yield* Effect.forEach(Str.split(node.value, "\n"), (line) => textLeaf(line, emptyTextFormat));
      const brk = yield* lineBreak();
      return yield* CodeNode.makeEffect({
        language: O.flatMap(node.language, Md.CodeFenceLanguage.decodeOption),
        children: A.intersperse(texts, brk),
      });
    }),
    table: Effect.fn("Lexical.codec.blockToLexical.table")(function* (node: Md.Table) {
      const rows = yield* Effect.forEach(
        node.children,
        Effect.fnUntraced(function* (row: Md.TableRow, rowIndex) {
          const cells = yield* Effect.forEach(
            row.children,
            Effect.fnUntraced(function* (cell: Md.TableCell) {
              const inlines = yield* inlinesToLexical(cell.children, emptyTextFormat);
              const paragraph = yield* ParagraphNode.makeEffect({ children: inlines });
              return yield* TableCellNode.makeEffect({
                headerState: node.headerRow && rowIndex === 0 ? rowTableCellHeader : noTableCellHeader,
                children: [paragraph],
              });
            })
          );

          return yield* TableRowNode.makeEffect({ children: cells });
        })
      );

      return yield* TableNode.makeEffect({ children: rows });
    }),
    youtube: (node) => YouTubeNode.makeEffect({ videoID: node.videoId }),
    ul: (node) =>
      Effect.flatMap(listItemsToLexical(node.children), (children) =>
        ListNode.makeEffect({ listType: "bullet", start: firstOrdinal, tag: "ul", children })
      ),
    ol: (node) =>
      Effect.flatMap(listItemsToLexical(node.children, node.start), (children) =>
        ListNode.makeEffect({ listType: "number", start: node.start, tag: "ol", children })
      ),
    taskList: (node) =>
      Effect.flatMap(
        listItemsToLexical(A.map(node.children, (item) => ({ children: item.children, checked: item.checked }))),
        (children) => ListNode.makeEffect({ listType: "check", start: firstOrdinal, tag: "ul", children })
      ),
    // Thematic breaks are outside the v1 node scope; they degrade to a literal
    // "---" paragraph (README "Lossiness profile").
    hr: () =>
      Effect.flatMap(textLeaf("---", emptyTextFormat), (text) => ParagraphNode.makeEffect({ children: [text] })),
    mathBlock: blockTextParagraph,
    footnoteDefinition: blockTextParagraph,
    admonition: blockTextParagraph,
    embed: blockTextParagraph,
  })
);

/**
 * Lift a full Md document into a serialized Lexical editor state.
 *
 * **Gotchas**
 *
 * An empty Md document canonicalizes to one blank paragraph because Lexical
 * cannot apply an editor state whose root has no children.
 *
 * **Example** (Lift document to state)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Document, P, Text } from "@beep/md/Md.model"
 * import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec"
 *
 * const document = Document.make({ children: [P.make({ children: [Text.make({ value: "Hello" })] })] })
 * const state = Effect.runSync(documentToEditorState(document))
 * console.log(state.root.children.length) // 1
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const documentToEditorState = Effect.fn("Lexical.codec.documentToEditorState")(function* (
  document: Md.Document
) {
  const children = yield* Effect.forEach(document.children, blockToLexical);
  const runtimeChildren = A.isReadonlyArrayNonEmpty(children)
    ? children
    : [yield* ParagraphNode.makeEffect({ children: [] })];
  const root = yield* RootNode.makeEffect({ children: runtimeChildren });
  return yield* SerializedEditorState.makeEffect({ root });
});

const markConstructors: ReadonlyArray<readonly [TextFormatBit, (children: ReadonlyArray<Md.Inline>) => Md.Inline]> = [
  [TextFormatBits.strikethrough, (children) => Md.Del.make({ children })],
  [TextFormatBits.italic, (children) => Md.Em.make({ children })],
  [TextFormatBits.bold, (children) => Md.Strong.make({ children })],
];

const wrapMarks = (base: Md.Inline, format: TextFormatMask): Md.Inline =>
  A.reduce(markConstructors, base, (inline, [bit, wrap]) => (hasTextFormat(format, bit) ? wrap([inline]) : inline));

const textRunToInlines = (children: ReadonlyArray<LexicalNode>): ReadonlyArray<Md.Inline> =>
  A.map(children, inlineNodeToMd);

const inlineNodeToMd: (node: LexicalNode) => Md.Inline = LexicalNode.match({
  text: (node) =>
    wrapMarks(
      hasTextFormat(node.format, TextFormatBits.code)
        ? Md.Code.make({ value: node.text })
        : Md.Text.make({ value: node.text }),
      node.format
    ),
  tab: () => Md.Text.make({ value: "\t" }),
  linebreak: () => Md.Br.make(),
  link: (node) => Md.A.make({ href: node.url, children: textRunToInlines(node.children), title: node.title }),
  "artifact-ref": (node) =>
    Md.A.make({
      href: ArtifactUri.fromUnknown(`${ARTIFACT_URI_PREFIX}${node.artifactId}`),
      children: [Md.Text.make({ value: O.getOrElse(node.label, () => node.artifactId) })],
    }),
  // Element nodes have no inline Md equivalent; they degrade to their plain text
  // (README "Lossiness profile").
  root: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  paragraph: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  heading: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  quote: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  list: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  listitem: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  code: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  youtube: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  table: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  tablerow: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
  tablecell: (node) => Md.Text.make({ value: nodeToPlainText(node) }),
});

const codeChildText: (node: LexicalNode) => string = LexicalNode.match({
  text: (node) => node.text,
  tab: () => "\t",
  linebreak: () => "\n",
  "artifact-ref": nodeToPlainText,
  root: nodeToPlainText,
  paragraph: nodeToPlainText,
  heading: nodeToPlainText,
  quote: nodeToPlainText,
  list: nodeToPlainText,
  listitem: nodeToPlainText,
  link: nodeToPlainText,
  code: nodeToPlainText,
  youtube: nodeToPlainText,
  table: nodeToPlainText,
  tablerow: nodeToPlainText,
  tablecell: nodeToPlainText,
});

const listItemChildrenToMd = (children: ReadonlyArray<LexicalNode>): ReadonlyArray<Md.ListItemChild> =>
  A.map(children, (child) => (ListNode.is(child) ? listToBlock(child) : inlineNodeToMd(child)));

function listToBlock(node: ListNode): Md.Block {
  const items = A.filter(node.children, ListItemNode.is);
  return ListType.$match(node.listType, {
    check: () =>
      Md.TaskList.make({
        children: A.map(items, (item) =>
          Md.TaskItem.make({
            ...O.getSomesStruct({ checked: item.checked }),
            children: listItemChildrenToMd(item.children),
          })
        ),
      }),
    number: () =>
      Md.Ol.make({
        children: A.map(items, (item) => Md.Li.make({ children: listItemChildrenToMd(item.children) })),
        start: node.start,
      }),
    bullet: () =>
      Md.Ul.make({
        children: A.map(items, (item) => Md.Li.make({ children: listItemChildrenToMd(item.children) })),
      }),
  });
}

const tableChildToInlines = (node: LexicalNode): ReadonlyArray<Md.Inline> =>
  node.type === "paragraph" ? textRunToInlines(node.children) : [Md.Text.make({ value: nodeToPlainText(node) })];

const tableCellToMd = (node: TableCellNode): Md.TableCell =>
  Md.TableCell.make({ children: A.flatMap(node.children, tableChildToInlines) });

const tableRowToMd = (node: TableRowNode): Md.TableRow =>
  Md.TableRow.make({
    children: A.map(node.children, (child) =>
      TableCellNode.is(child)
        ? tableCellToMd(child)
        : Md.TableCell.make({ children: [Md.Text.make({ value: nodeToPlainText(child) })] })
    ),
  });

const tableHasHeaderRow = (node: TableNode): boolean =>
  pipe(
    node.children,
    A.findFirst(TableRowNode.is),
    O.map((row) =>
      A.some(
        row.children,
        (child) => TableCellNode.is(child) && (child.headerState & rowTableCellHeader) !== noTableCellHeader
      )
    ),
    O.getOrElse(() => false)
  );

const tableToBlock = (node: TableNode): Md.Table =>
  Md.Table.make({
    headerRow: tableHasHeaderRow(node),
    children: A.map(A.filter(node.children, TableRowNode.is), tableRowToMd),
  });

// The lexical `YouTubeNode.videoID` is an unconstrained string, while the Md
// `YouTube` embed enforces the CSF-026 guard (a bare 11-character video id) so
// that downstream percent-encoders cannot be crashed by a malformed id. Project
// the embed only when the id satisfies that schema; otherwise drop it (the embed
// is presentation-only, so omitting it keeps the document valid) so the
// Lexical -> Md projection stays total on arbitrary/untrusted input.
const youtubeToBlocks = (node: YouTubeNode): ReadonlyArray<Md.Block> =>
  Md.YouTubeVideoId.is(node.videoID) ? [Md.YouTube.make({ videoId: node.videoID })] : A.empty<Md.Block>();

/**
 * Project one serialized Lexical node onto Md blocks.
 *
 * **Example** (Project artifact-ref node)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNode } from "@beep/lexical-schema/Lexical.model"
 * import { nodeToBlocks } from "@beep/lexical-schema/Lexical.codec"
 *
 * const result = S.decodeUnknownResult(LexicalNode)({
 *   type: "artifact-ref", version: 1, artifactId: "artifact-123"
 * })
 * console.log(Result.isSuccess(result) && nodeToBlocks(result.success)[0]?._tag === "p") // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const nodeToBlocks: (node: LexicalNode) => ReadonlyArray<Md.Block> = LexicalNode.match({
  root: (node) => A.flatMap(node.children, nodeToBlocks),
  paragraph: (node) => [Md.P.make({ children: textRunToInlines(node.children) })],
  heading: (node) => [
    Md.Heading.make({ level: HeadingLevelTag.From.Enum[node.tag], children: textRunToInlines(node.children) }),
  ],
  quote: (node) => [Md.BlockQuote.make({ children: [Md.P.make({ children: textRunToInlines(node.children) })] })],
  code: (node) => [Md.Pre.make({ value: A.join(A.map(node.children, codeChildText), ""), language: node.language })],
  table: (node) => [tableToBlock(node)],
  tablerow: (node) => [Md.Table.make({ headerRow: false, children: [tableRowToMd(node)] })],
  tablecell: (node) => [Md.P.make({ children: tableCellToMd(node).children })],
  youtube: (node) => youtubeToBlocks(node),
  list: (node) => [listToBlock(node)],
  listitem: (node) => [Md.P.make({ children: textRunToInlines(node.children) })],
  "artifact-ref": (node) => [Md.P.make({ children: [inlineNodeToMd(node)] })], // Loose leaves outside an element wrap into a paragraph.
  text: (node) => [Md.P.make({ children: [inlineNodeToMd(node)] })],
  tab: (node) => [Md.P.make({ children: [inlineNodeToMd(node)] })],
  linebreak: (node) => [Md.P.make({ children: [inlineNodeToMd(node)] })],
  link: (node) => [Md.P.make({ children: [inlineNodeToMd(node)] })],
});

/**
 * Project a serialized Lexical editor state onto the canonical Md document
 * AST, applying the documented lossiness profile.
 *
 * **Example** (Round-trip editor state)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Document, P, Text } from "@beep/md/Md.model"
 * import { documentToEditorState, editorStateToDocument } from "@beep/lexical-schema/Lexical.codec"
 *
 * const document = Document.make({ children: [P.make({ children: [Text.make({ value: "Hello" })] })] })
 * const state = Effect.runSync(documentToEditorState(document))
 * console.log(editorStateToDocument(state).children[0]?._tag) // "p"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const editorStateToDocument = (state: SerializedEditorState): Md.Document =>
  Md.Document.make({ children: A.flatMap(state.root.children, nodeToBlocks) });

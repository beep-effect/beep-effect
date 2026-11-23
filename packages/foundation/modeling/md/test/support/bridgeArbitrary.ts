import {
  Admonition,
  A as Anchor,
  BlockQuote,
  Block as BlockSchema,
  Br,
  Code,
  Del,
  Document,
  Em,
  FootnoteDefinition,
  FootnoteReference,
  Heading,
  Hr,
  Img,
  Inline,
  InlineMath,
  Li,
  MathBlock,
  Ol,
  P,
  Pre,
  RawHtml,
  Strong,
  Table,
  TableCell,
  TableRow,
  TaskItem,
  TaskList,
  Text,
  Ul,
  YouTube,
} from "@beep/md/Md.model";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Block } from "@beep/md/Md.model";

/** One construct the round-trip generator leaves out, and who owns the fix. */
export class RoundTripGap extends S.Opaque<RoundTripGap, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    owner: S.String,
    description: S.String,
  })
) {}

/** The named exclusions of {@link BridgeDocumentArbitrary}. */
export const ROUND_TRIP_GAPS: ReadonlyArray<RoundTripGap> = [
  RoundTripGap.make({
    id: "kitNestedTaskList",
    owner: "@beep/markdown",
    description:
      "The kit does not recognize a GFM task-list item inside a blockquote or a nested list, so task lists are top-level only.",
  }),
  RoundTripGap.make({
    id: "mathValueSyntax",
    owner: "@beep/md bridge",
    description:
      "The kit parses inline syntax before the math recognizer runs, so a math value holding emphasis, code, link or HTML markers, edge whitespace or a trailing lone backslash does not read back; generated math values hold none of them.",
  }),
];

const PlainWords = ["alpha", "beta", "gamma", "delta", "omega", "kappa", "zeta", "Note"] as const;

const PlainWordForIdentifierSlots = Arbitrary.schema(S.Literals(PlainWords));
const WordWithWriterEscapeShapesAndAlphanumericEdges = Arbitrary.schema(
  S.Literals([...PlainWords, "a$b$c", "x$y", "p&amp;q", "q&#38;r", "AT&T"])
);

const MathValue = Arbitrary.schema(
  S.Literals(["x", "y^2", "a+b", "e=mc^2", "a\\$b", "\\\\$x", "a\\_b", "$x", "x$", "\\$y$"])
);

const Words = pipe(
  Arbitrary.array(WordWithWriterEscapeShapesAndAlphanumericEdges, { minLength: 1, maxLength: 3 }),
  Arbitrary.map((words) => A.join(words, " "))
);

const OptionalWord = pipe(
  Arbitrary.all([Arbitrary.schema(S.Boolean), PlainWordForIdentifierSlots]),
  Arbitrary.map(([present, word]) => (present ? O.some(word) : O.none()))
);

const InlineKinds = S.Literals(["text", "strong", "em", "del", "code", "a", "img", "rawHtml", "inlineMath"]);
type InlineKind = typeof InlineKinds.Type;

const InlineSeed = Arbitrary.all({
  words: Words,
  word: WordWithWriterEscapeShapesAndAlphanumericEdges,
  title: OptionalWord,
  math: MathValue,
});

type InlineSeed = typeof InlineSeed extends Arbitrary.Arbitrary<infer Seed> ? Seed : never;

const inlineBuilders: { readonly [Kind in InlineKind]: (seed: InlineSeed) => Inline } = {
  text: ({ words }) => Text.make({ value: words }),
  strong: ({ words }) => Strong.make({ children: [Text.make({ value: words })] }),
  em: ({ words }) => Em.make({ children: [Text.make({ value: words })] }),
  del: ({ words }) => Del.make({ children: [Text.make({ value: words })] }),
  code: ({ word }) => Code.make({ value: word }),
  a: ({ title, word, words }) =>
    Anchor.make({ href: `https://example.com/${word}`, title, children: [Text.make({ value: words })] }),
  img: ({ title, word, words }) => Img.make({ src: `https://example.com/${word}.png`, alt: words, title }),
  rawHtml: ({ word }) => RawHtml.make({ value: `<b>${word}</b>` }),
  inlineMath: ({ math }) => InlineMath.make({ value: math }),
};

const InlineAtom: Arbitrary.Arbitrary<Inline> = pipe(
  Arbitrary.all([Arbitrary.schema(InlineKinds), InlineSeed]),
  Arbitrary.map(([kind, seed]) => inlineBuilders[kind](seed))
);

const Separator = pipe(
  Arbitrary.schema(S.Literals(["space", "space", "break"])),
  Arbitrary.map((kind): Inline => (kind === "space" ? Text.make({ value: " " }) : Br.make({})))
);

const InlineRun: Arbitrary.Arbitrary<ReadonlyArray<Inline>> = pipe(
  Arbitrary.all([Arbitrary.array(InlineAtom, { minLength: 1, maxLength: 3 }), Separator]),
  Arbitrary.map(([atoms, separator]) => A.intersperse(atoms, separator))
);

const TextRun = pipe(
  Words,
  Arbitrary.map((value): ReadonlyArray<Inline> => [Text.make({ value })])
);

const LeafKinds = S.Literals(["p", "heading", "hr", "pre", "ul", "ol", "taskList", "table", "youtube", "mathBlock"]);
type LeafKind = typeof LeafKinds.Type;
const LeafKind = Arbitrary.schema(LeafKinds);
const ContainedLeafKindWithoutColumnOneDisplayMath = Arbitrary.schema(
  LeafKinds.pick(["p", "heading", "hr", "pre", "ul", "ol", "table", "youtube"])
);

const HeadingLevel = Arbitrary.schema(S.Literals([1, 2, 3, 4, 5, 6]));
const Alignment = Arbitrary.schema(S.Literals(["none", "left", "center", "right"]));
const Start = Arbitrary.schema(S.Literals([1, 2, 7]));
const VideoId = Arbitrary.schema(S.Literals(["dQw4w9WgXcQ", "M7lc1UVf-VE"]));

const LeafSeed = Arbitrary.all({
  run: InlineRun,
  items: Arbitrary.array(InlineRun, { minLength: 1, maxLength: 3 }),
  checks: Arbitrary.array(Arbitrary.schema(S.Boolean), { minLength: 3, maxLength: 3 }),
  level: HeadingLevel,
  language: OptionalWord,
  lines: Arbitrary.array(Words, { minLength: 1, maxLength: 3 }),
  start: Start,
  align: Arbitrary.array(Alignment, { minLength: 1, maxLength: 3 }),
  cells: Arbitrary.array(TextRun, { minLength: 3, maxLength: 3 }),
  rows: Arbitrary.array(Arbitrary.array(TextRun, { minLength: 3, maxLength: 3 }), { minLength: 0, maxLength: 2 }),
  videoId: VideoId,
  loose: Arbitrary.schema(S.Boolean),
  math: MathValue,
});

type LeafSeed = typeof LeafSeed extends Arbitrary.Arbitrary<infer Seed> ? Seed : never;

const tightRunOrLooseParagraphsExercisingBlankLinesBetweenItemsAndBlocks = (
  seed: LeafSeed,
  run: ReadonlyArray<Inline>,
  index: number
): Li["children"] =>
  seed.loose ? [P.make({ children: run }), ...(index === 0 ? [P.make({ children: seed.run })] : [])] : run;

const listItems = (seed: LeafSeed): ReadonlyArray<Li> =>
  A.map(seed.items, (run, index) =>
    Li.make({ children: tightRunOrLooseParagraphsExercisingBlankLinesBetweenItemsAndBlocks(seed, run, index) })
  );

const tableRow =
  (width: number) =>
  (cells: ReadonlyArray<ReadonlyArray<Inline>>): TableRow =>
    TableRow.make({ children: A.map(A.take(cells, width), (children) => TableCell.make({ children })) });

const leafBuilders: { readonly [Kind in LeafKind]: (seed: LeafSeed) => Block } = {
  p: (seed) => P.make({ children: seed.run }),
  heading: (seed) => Heading.make({ level: seed.level, children: seed.run }),
  hr: () => Hr.make({}),
  pre: (seed) => Pre.make({ language: seed.language, value: A.join(seed.lines, "\n") }),
  ul: (seed) => Ul.make({ children: listItems(seed) }),
  ol: (seed) => Ol.make({ start: seed.start, children: listItems(seed) }),
  taskList: (seed) =>
    TaskList.make({
      children: A.map(seed.items, (children, index) =>
        TaskItem.make({
          checked: seed.checks[index] ?? false,
          children: tightRunOrLooseParagraphsExercisingBlankLinesBetweenItemsAndBlocks(seed, children, index),
        })
      ),
    }),
  table: (seed) =>
    Table.make({
      align: seed.align,
      headerRow: true,
      children: A.map([seed.cells, ...seed.rows], tableRow(seed.align.length)),
    }),
  youtube: (seed) => YouTube.make({ videoId: seed.videoId }),
  mathBlock: (seed) => MathBlock.make({ value: seed.math }),
};

const leafBlockOf = (kinds: Arbitrary.Arbitrary<LeafKind>): Arbitrary.Arbitrary<Block> =>
  pipe(
    Arbitrary.all([kinds, LeafSeed]),
    Arbitrary.map(([kind, seed]) => leafBuilders[kind](seed))
  );

const topLeafBlock = leafBlockOf(LeafKind);
const containedLeafBlock = leafBlockOf(ContainedLeafKindWithoutColumnOneDisplayMath);

const ContainerKind = Arbitrary.schema(S.Literals(["leaf", "leaf", "blockquote", "admonition"]));

const AdmonitionKindArbitrary = Arbitrary.schema(S.Literals(["note", "tip", "important", "warning", "caution"]));

const blocksOf = (block: Arbitrary.Arbitrary<Block>): Arbitrary.Arbitrary<ReadonlyArray<Block>> =>
  Arbitrary.array(block, { minLength: 1, maxLength: 3 });

const nestedBlock = (leaf: Arbitrary.Arbitrary<Block>, inner: Arbitrary.Arbitrary<Block>): Arbitrary.Arbitrary<Block> =>
  pipe(
    Arbitrary.all({
      kind: ContainerKind,
      leaf,
      children: blocksOf(inner),
      admonition: AdmonitionKindArbitrary,
      title: OptionalWord,
    }),
    Arbitrary.map((g): Block => {
      switch (g.kind) {
        case "leaf":
          return g.leaf;
        case "blockquote":
          return BlockQuote.make({ children: g.children });
        case "admonition":
          return Admonition.make({ kind: g.admonition, title: g.title, children: g.children });
      }
    })
  );

const Frontmatter = pipe(
  Arbitrary.all([
    Arbitrary.schema(S.Boolean),
    Words,
    Arbitrary.schema(S.Literals([0, 3, -12])),
    Arbitrary.array(WordWithWriterEscapeShapesAndAlphanumericEdges),
  ]),
  Arbitrary.map(([present, title, count, tags]) =>
    present ? O.some<S.JsonObject>({ count, draft: false, tags, title }) : O.none()
  )
);

const footnoteBlocks = (identifier: string, body: string): ReadonlyArray<Block> => [
  P.make({ children: [Text.make({ value: "See" }), FootnoteReference.make({ identifier })] }),
  FootnoteDefinition.make({ identifier, children: [P.make({ children: [Text.make({ value: body })] })] }),
];

// decision: round-trip-generator-inside-writer-contract
export const BridgeDocumentArbitrary: Arbitrary.Arbitrary<Document> = pipe(
  Arbitrary.all({
    children: blocksOf(nestedBlock(topLeafBlock, nestedBlock(containedLeafBlock, containedLeafBlock))),
    frontmatter: Frontmatter,
    footnote: OptionalWord,
    body: Words,
  }),
  Arbitrary.map(({ body, children, footnote, frontmatter }) =>
    Document.make({
      frontmatter,
      children: O.match(footnote, {
        onNone: () => children,
        onSome: (identifier) => A.appendAll(children, footnoteBlocks(identifier, body)),
      }),
    })
  )
);

const canonicalMathValue = Str.replace(/(?<!\\)((?:\\\\)*)\$/g, "$1\\$");

const mergeText = (inlines: ReadonlyArray<Inline>): ReadonlyArray<Inline> =>
  A.reduce(A.map(inlines, normalizeInline), A.empty<Inline>(), (merged, inline) => {
    const last = A.last(merged);
    return O.isSome(last) && last.value._tag === "text" && inline._tag === "text"
      ? A.append(A.dropRight(merged, 1), Text.make({ value: `${last.value.value}${inline.value}` }))
      : A.append(merged, inline);
  });

const normalizeInline = (inline: Inline): Inline => {
  switch (inline._tag) {
    case "strong":
      return Strong.make({ children: mergeText(inline.children) });
    case "em":
      return Em.make({ children: mergeText(inline.children) });
    case "del":
      return Del.make({ children: mergeText(inline.children) });
    case "a":
      return Anchor.make({ href: inline.href, title: inline.title, children: mergeText(inline.children) });
    case "rawHtml":
      return Text.make({ value: inline.value });
    case "footnoteReference":
      return FootnoteReference.make({ identifier: Str.toLowerCase(inline.identifier) });
    case "inlineMath":
      return InlineMath.make({ value: canonicalMathValue(inline.value) });
    default:
      return inline;
  }
};

const normalizeBlock = (block: Block): Block => {
  switch (block._tag) {
    case "p":
      return P.make({ children: mergeText(block.children) });
    case "heading":
      return Heading.make({ level: block.level, children: mergeText(block.children) });
    case "ul":
      return Ul.make({ children: A.map(block.children, (li) => Li.make({ children: normalizeItem(li.children) })) });
    case "ol":
      return Ol.make({
        start: block.start,
        children: A.map(block.children, (li) => Li.make({ children: normalizeItem(li.children) })),
      });
    case "taskList":
      return TaskList.make({
        children: A.map(block.children, (item) =>
          TaskItem.make({ checked: item.checked, children: normalizeItem(item.children) })
        ),
      });
    case "blockquote":
      return BlockQuote.make({ children: A.map(block.children, normalizeBlock) });
    case "admonition":
      return Admonition.make({ kind: block.kind, title: block.title, children: A.map(block.children, normalizeBlock) });
    case "footnoteDefinition":
      return FootnoteDefinition.make({
        identifier: Str.toLowerCase(block.identifier),
        children: A.map(block.children, normalizeBlock),
      });
    default:
      return block;
  }
};

const isInline = S.is(Inline);

const isBlock = S.is(BlockSchema);

const normalizeItem = (children: Li["children"]): Li["children"] =>
  A.every(children, isInline) ? mergeText(children) : A.map(A.filter(children, isBlock), normalizeBlock);

/**
 * Erase the writer-contract canonicalization a render and re-parse applies
 * to a generated document, and nothing else.
 */
export const normalizeBridgeDocument = (document: Document): Document =>
  Document.make({ frontmatter: document.frontmatter, children: A.map(document.children, normalizeBlock) });

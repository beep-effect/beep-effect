/**
 * Compatibility mapping between Pandoc JSON AST and the canonical `@beep/md`
 * document AST.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.mapping
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import * as Md from "@beep/md/Md.model";
import { PosInt } from "@beep/schema";
import { A, O, R } from "@beep/utils";
import { Effect, Match } from "effect";
import * as S from "effect/Schema";
import {
  BlockQuote,
  BulletList,
  Code,
  CodeBlock,
  DEFAULT_PANDOC_API_VERSION,
  Div,
  Emph,
  Header,
  HorizontalRule,
  Image,
  LineBreak,
  Link,
  Note,
  OrderedList,
  PandocAttr,
  PandocDocument,
  Math as PandocMath,
  PandocTarget,
  Para,
  Plain,
  Str,
  Strikeout,
  Strong,
} from "./Pandoc.model.ts";
import { PandocCompatibilityReport, PandocMappingIssue } from "./Pandoc.report.ts";
import type { PandocBlock, PandocInline } from "./Pandoc.model.ts";
import type { JsonPath, PandocMappingDirection, PandocMappingSeverity } from "./Pandoc.report.ts";

const $I = $PandocAstId.create("Pandoc.mapping");
const PandocMappingErrorFields = {
  message: S.String,
  cause: S.Defect({ includeStack: true }),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const PandocMappingErrorComparableFields = {
  message: PandocMappingErrorFields.message,
} satisfies S.Struct.Fields;
const samePandocMappingErrorFields = S.toEquivalence(
  S.TaggedStruct("PandocMappingError", PandocMappingErrorComparableFields)
);
const samePandocMappingError = (self: PandocMappingError, that: PandocMappingError): boolean =>
  samePandocMappingErrorFields(self, that);

/**
 * Typed failure raised when a Pandoc-to-Md projection cannot be completed.
 *
 * **Example** (Catch tagged mapping error)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PandocMappingError } from "@beep/pandoc-ast/Pandoc.mapping"
 *
 * const handled = Effect.fail("projection failed").pipe(
 *   Effect.mapError((cause) => PandocMappingError.make({ cause, message: "Pandoc mapping failed." })),
 *   Effect.catchTag("PandocMappingError", (error) => Effect.succeed(error.message))
 * )
 * Effect.runPromise(handled).then(console.log)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PandocMappingError extends S.TaggedError<PandocMappingError>($I`PandocMappingError`)(
  "PandocMappingError",
  PandocMappingErrorFields,
  $I.annoteClass<
    S.declare<PandocMappingError>,
    readonly [S.TaggedStruct<"PandocMappingError", typeof PandocMappingErrorFields>]
  >("PandocMappingError", {
    description: "Typed failure raised when a Pandoc and Md compatibility projection cannot be completed.",
    toEquivalence: () => samePandocMappingError,
  })
) {}

type Projection<Value> = {
  readonly issues: ReadonlyArray<PandocMappingIssue.Type>;
  readonly value: Value;
};

const emptyProjection = <Value>(value: Value): Projection<Value> => ({ issues: [], value });

const mergeIssues = <Value>(values: ReadonlyArray<Projection<Value>>): ReadonlyArray<PandocMappingIssue.Type> =>
  A.flatten(A.map(values, (value) => value.issues));

const issue = (input: {
  readonly construct: string;
  readonly direction: PandocMappingDirection;
  readonly message: string;
  readonly path: JsonPath;
  readonly severity?: PandocMappingSeverity;
}): PandocMappingIssue => PandocMappingIssue.fromPath(input);

const hasCodeBlockDroppedAttr = (attr: PandocAttr.Type): boolean =>
  attr.id.length > 0 ||
  attr.classes.length > 1 ||
  attr.keyValues.length > 0 ||
  O.exists(O.fromUndefinedOr(attr.classes[0]), (language) => O.isNone(Md.CodeFenceLanguage.decodeOption(language)));

const hasOrderedListMarkerLoss = (node: OrderedList.Type): boolean =>
  node.style !== "DefaultStyle" || node.delimiter !== "DefaultDelim";

const optionalNonEmpty = (value: string): O.Option<string> => (value.length === 0 ? O.none() : O.some(value));

const appendIndex = (path: JsonPath, key: string, index: number): JsonPath => [...path, key, index];

const projectChildValues = <Input, Output>(
  values: ReadonlyArray<Input>,
  path: JsonPath,
  project: (value: Input, path: JsonPath) => Effect.Effect<Projection<ReadonlyArray<Output>>, S.SchemaError>
): Effect.Effect<Projection<ReadonlyArray<Output>>, S.SchemaError> =>
  Effect.map(
    Effect.forEach(values, (value, index) => project(value, appendIndex(path, "children", index))),
    (projected) => ({
      issues: mergeIssues(projected),
      value: A.flatten(A.map(projected, (item) => item.value)),
    })
  );

const mdText = (value: string): Md.Text => Md.Text.make({ value });

const mdInlinesText = (inlines: ReadonlyArray<Md.Inline>): string => A.join(A.map(inlines, mdInlineText), "");

const mdInlineText: (inline: Md.Inline) => string = Match.type<Md.Inline>().pipe(
  Match.tagsExhaustive({
    text: (inline) => inline.value,
    rawMarkdown: (inline) => inline.value,
    rawHtml: (inline) => inline.value,
    strong: (inline) => mdInlinesText(inline.children),
    em: (inline) => mdInlinesText(inline.children),
    del: (inline) => mdInlinesText(inline.children),
    code: (inline) => inline.value,
    a: (inline) => mdInlinesText(inline.children),
    img: (inline) => inline.alt,
    br: () => "\n",
    inlineMath: (inline) => inline.value,
    footnoteReference: (inline) => inline.identifier,
  })
);

const pandocInlineText: (inline: PandocInline.Type) => string = Match.type<PandocInline.Type>().pipe(
  Match.tagsExhaustive({
    str: (inline) => inline.text,
    space: () => " ",
    softbreak: () => " ",
    linebreak: () => "\n",
    emph: (inline) => A.join(A.map(inline.children, pandocInlineText), ""),
    strong: (inline) => A.join(A.map(inline.children, pandocInlineText), ""),
    strikeout: (inline) => A.join(A.map(inline.children, pandocInlineText), ""),
    code: (inline) => inline.text,
    link: (inline) => A.join(A.map(inline.children, pandocInlineText), ""),
    image: (inline) => A.join(A.map(inline.children, pandocInlineText), ""),
    span: (inline) => A.join(A.map(inline.children, pandocInlineText), ""),
    note: (inline) => A.join(A.map(inline.blocks, pandocBlockText), "\n"),
    math: (inline) => inline.text,
    unknownInline: () => "",
  })
);

const pandocBlockText: (block: PandocBlock.Type) => string = Match.type<PandocBlock.Type>().pipe(
  Match.tagsExhaustive({
    plain: (block) => A.join(A.map(block.children, pandocInlineText), ""),
    para: (block) => A.join(A.map(block.children, pandocInlineText), ""),
    header: (block) => A.join(A.map(block.children, pandocInlineText), ""),
    blockquote: (block) => A.join(A.map(block.children, pandocBlockText), "\n"),
    codeblock: (block) => block.text,
    bulletlist: (block) =>
      A.join(
        A.map(block.items, (item) => A.join(A.map(item, pandocBlockText), "\n")),
        "\n"
      ),
    orderedlist: (block) =>
      A.join(
        A.map(block.items, (item) => A.join(A.map(item, pandocBlockText), "\n")),
        "\n"
      ),
    horizontalrule: () => "",
    div: (block) => A.join(A.map(block.children, pandocBlockText), "\n"),
    table: (block) => A.join(A.map(block.caption, pandocInlineText), ""),
    unknownBlock: () => "",
  })
);

const imageDescriptionLossPath = (children: ReadonlyArray<PandocInline.Type>, path: JsonPath): O.Option<JsonPath> => {
  const first = children[0];
  if (first === undefined) {
    return O.some([...path, "children"]);
  }
  if (children.length === 1 && first._tag === "str") {
    return O.none();
  }
  return O.some(appendIndex(path, "children", first._tag === "str" ? 1 : 0));
};

const imageDescriptionLossIssues = (
  children: ReadonlyArray<PandocInline.Type>,
  path: JsonPath
): ReadonlyArray<PandocMappingIssue.Type> =>
  O.match({
    onNone: () => [],
    onSome: (lossPath: JsonPath) => [
      issue({
        construct: "Image",
        direction: "pandoc-to-md",
        message: "Pandoc image descriptions other than one Str are flattened to one plain-text alt value in Md.",
        path: lossPath,
        severity: "lossy",
      }),
    ],
  })(imageDescriptionLossPath(children, path));

const pandocInlineToMd = (
  inline: PandocInline.Type,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<Md.Inline>>, S.SchemaError> =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      str: (node) => Effect.succeed(emptyProjection([mdText(node.text)])),
      space: () => Effect.succeed(emptyProjection([mdText(" ")])),
      softbreak: () =>
        Effect.succeed({
          issues: [
            issue({
              construct: "SoftBreak",
              direction: "pandoc-to-md",
              message: "Pandoc soft breaks are normalized to spaces in Md-core.",
              path,
              severity: "lossy",
            }),
          ],
          value: [mdText(" ")],
        }),
      linebreak: () => Effect.succeed(emptyProjection([Md.Br.make({})])),
      emph: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues,
          value: [Md.Em.make({ children: value })],
        })),
      strong: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues,
          value: [Md.Strong.make({ children: value })],
        })),
      strikeout: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues,
          value: [Md.Del.make({ children: value })],
        })),
      code: (node) =>
        Effect.succeed({
          issues: PandocAttr.isNonEmpty(node.attr)
            ? [
                issue({
                  construct: "Code",
                  direction: "pandoc-to-md",
                  message: "Inline code attributes have no Md-core equivalent.",
                  path,
                  severity: "lossy",
                }),
              ]
            : [],
          value: [Md.Code.make({ value: node.text })],
        }),
      link: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues: [
            ...issues,
            ...(PandocAttr.isNonEmpty(node.attr)
              ? [
                  issue({
                    construct: "Link",
                    direction: "pandoc-to-md",
                    message: "Pandoc link attributes are outside the Md link shape.",
                    path,
                    severity: "lossy",
                  }),
                ]
              : []),
          ],
          value: [Md.A.make({ children: value, href: node.target.url, title: optionalNonEmpty(node.target.title) })],
        })),
      image: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues: [
            ...issues,
            ...imageDescriptionLossIssues(node.children, path),
            ...(PandocAttr.isNonEmpty(node.attr)
              ? [
                  issue({
                    construct: "Image",
                    direction: "pandoc-to-md",
                    message: "Pandoc image attributes are outside the Md image shape.",
                    path,
                    severity: "lossy",
                  }),
                ]
              : []),
          ],
          value: [
            Md.Img.make({
              alt: mdInlinesText(value),
              src: node.target.url,
              title: optionalNonEmpty(node.target.title),
            }),
          ],
        })),
      span: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues: [
            ...issues,
            ...(PandocAttr.isNonEmpty(node.attr)
              ? [
                  issue({
                    construct: "Span",
                    direction: "pandoc-to-md",
                    message: "Pandoc span attributes, including DOCX custom styles, are recorded as a gap.",
                    path,
                  }),
                ]
              : []),
          ],
          value,
        })),
      note: (node) =>
        Effect.succeed({
          issues: [
            issue({
              construct: "Note",
              direction: "pandoc-to-md",
              message: "Pandoc notes are outside Md-core and are degraded to plain text.",
              path,
            }),
          ],
          value: [mdText(pandocInlineText(node))],
        }),
      math: (node) =>
        Effect.succeed({
          issues:
            node.mathType === "DisplayMath"
              ? [
                  issue({
                    construct: "Math",
                    direction: "pandoc-to-md",
                    message: "Pandoc display math appeared in inline position and is kept as Md inline math.",
                    path,
                    severity: "lossy",
                  }),
                ]
              : [],
          value: [Md.InlineMath.make({ value: node.text })],
        }),
      unknownInline: (node) =>
        Effect.succeed({
          issues: [
            issue({
              construct: node.constructorName,
              direction: "pandoc-to-md",
              message: "Pandoc inline constructor is outside the v1 supported surface.",
              path,
            }),
          ],
          value: [],
        }),
    })
  );

const pandocInlinesToMd = (
  inlines: ReadonlyArray<PandocInline.Type>,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<Md.Inline>>, S.SchemaError> =>
  projectChildValues(inlines, path, pandocInlineToMd);

const mdHeadingLevelFromPandoc = (level: number): Md.HeadingLevel => {
  if (level <= 1) {
    return 1;
  }
  if (level === 2) {
    return 2;
  }
  if (level === 3) {
    return 3;
  }
  if (level === 4) {
    return 4;
  }
  if (level === 5) {
    return 5;
  }
  return 6;
};

const pandocHeadingLevelProjection = (level: number, path: JsonPath): Projection<Md.HeadingLevel> => ({
  issues:
    level < 1 || level > 6
      ? [
          issue({
            construct: "Header",
            direction: "pandoc-to-md",
            message: "Header level outside 1..6 is clamped to the nearest Md heading.",
            path,
            severity: "lossy",
          }),
        ]
      : [],
  value: mdHeadingLevelFromPandoc(level),
});

const headingToMd = (level: Md.HeadingLevel, children: ReadonlyArray<Md.Inline>): Md.Block =>
  Md.Heading.make({ level, children });

const isPlainOrPara = (block: PandocBlock.Type): block is Plain.Type | Para.Type =>
  block._tag === "plain" || block._tag === "para";

const pandocListItemBlockToMdInlines = (
  block: PandocBlock.Type,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<Md.ListItemChild>>, S.SchemaError> =>
  Match.value(block).pipe(
    Match.tags({
      plain: (node) => pandocInlinesToMd(node.children, path),
      para: (node) => pandocInlinesToMd(node.children, path),
    }),
    Match.orElse((node) =>
      Effect.map(pandocBlockToMd(node, path), ({ issues, value }) => ({
        issues,
        value: [value],
      }))
    )
  );

const pandocListItemBlockToMdChildBlocks = (
  block: PandocBlock.Type,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<Md.ListItemChild>>, S.SchemaError> =>
  Effect.map(pandocBlockToMd(block, path), ({ issues, value }) => ({
    issues,
    value: [value],
  }));

const pandocListItemBlocksToMdChildren = (
  item: ReadonlyArray<PandocBlock.Type>,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<Md.ListItemChild>>, S.SchemaError> => {
  const first = item[0];

  return item.length === 1 && first !== undefined && isPlainOrPara(first)
    ? Effect.map(pandocListItemBlockToMdInlines(first, appendIndex(path, "blocks", 0)), ({ issues, value }) => ({
        issues: [
          ...issues,
          ...(first._tag === "para"
            ? [
                issue({
                  construct: "Para",
                  direction: "pandoc-to-md",
                  message: "A sole Pandoc Para list item is normalized to Plain when mapped back from Md.",
                  path: appendIndex(path, "blocks", 0),
                  severity: "lossy",
                }),
              ]
            : []),
        ],
        value,
      }))
    : Effect.map(
        Effect.forEach(item, (block, index) =>
          pandocListItemBlockToMdChildBlocks(block, appendIndex(path, "blocks", index))
        ),
        (blocks) => ({
          issues: mergeIssues(blocks),
          value: A.flatten(A.map(blocks, (block) => block.value)),
        })
      );
};

const mdListItemChildrenText = (children: ReadonlyArray<Md.ListItemChild>): string => {
  const chunks: Array<string> = [];
  let pendingInlines: Array<Md.Inline> = [];
  const flushInlines = (): void => {
    if (pendingInlines.length > 0) {
      A.appendInPlace(chunks, mdInlinesText(pendingInlines));
      pendingInlines = [];
    }
  };

  for (const child of children) {
    if (Md.Inline.is(child)) {
      A.appendInPlace(pendingInlines, child);
    } else {
      flushInlines();
      A.appendInPlace(chunks, mdBlockText(child));
    }
  }

  flushInlines();

  return A.join(chunks, "\n");
};

const mdInlinesToPandocPlain = (
  inlines: ReadonlyArray<Md.Inline>,
  path: JsonPath
): Effect.Effect<Projection<PandocBlock.Type>, S.SchemaError> =>
  Effect.map(mdInlinesToPandoc(inlines, path), ({ issues, value }) => ({
    issues,
    value: Plain.make({ children: value }),
  }));

const mdListItemChildrenToPandocBlocks = Effect.fn("mdListItemChildrenToPandocBlocks")(function* (
  children: ReadonlyArray<Md.ListItemChild>,
  path: JsonPath
): Effect.fn.Return<Projection<ReadonlyArray<PandocBlock.Type>>, S.SchemaError> {
  const blocks: Array<Projection<PandocBlock.Type>> = [];
  let pendingInlines: Array<Md.Inline> = [];
  let pendingStartIndex = 0;
  const flushInlines = Effect.fnUntraced(function* () {
    if (pendingInlines.length > 0) {
      A.appendInPlace(
        blocks,
        yield* mdInlinesToPandocPlain(pendingInlines, appendIndex(path, "children", pendingStartIndex))
      );
      pendingInlines = [];
    }
  });
  for (const [index, child] of children.entries()) {
    if (Md.Inline.is(child)) {
      if (pendingInlines.length === 0) {
        pendingStartIndex = index;
      }
      A.appendInPlace(pendingInlines, child);
    } else {
      yield* flushInlines();
      A.appendInPlace(blocks, yield* mdBlockToPandoc(child, appendIndex(path, "children", index)));
    }
  }

  yield* flushInlines();

  return {
    issues: mergeIssues(blocks),
    value: A.map(blocks, (block) => block.value),
  };
});

const pandocListItemToMd = (
  item: ReadonlyArray<PandocBlock.Type>,
  path: JsonPath
): Effect.Effect<Projection<Md.Li>, S.SchemaError> =>
  Effect.map(pandocListItemBlocksToMdChildren(item, path), ({ issues, value }) => ({
    issues,
    value: Md.Li.make({
      children: value,
    }),
  }));

const mdListText = (items: ReadonlyArray<Md.Li | Md.TaskItem>): string =>
  A.join(
    A.map(items, (item) => mdListItemChildrenText(item.children)),
    "\n"
  );

const youtubeWatchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

const mdTableText = (block: Md.Table): string =>
  A.join(
    A.map(block.children, (row) =>
      A.join(
        A.map(row.children, (cell) => mdInlinesText(cell.children)),
        " | "
      )
    ),
    "\n"
  );

const mdEmbedText = (block: Md.Embed): string =>
  O.match({ onNone: () => block.src, onSome: (title: string) => title })(block.title);

const mdBlockText: (block: Md.Block) => string = Match.type<Md.Block>().pipe(
  Match.tagsExhaustive({
    heading: (block) => mdInlinesText(block.children),
    p: (block) => mdInlinesText(block.children),
    blockquote: (block) => A.join(A.map(block.children, mdBlockText), "\n"),
    pre: (block) => block.value,
    ul: (block) => mdListText(block.children),
    ol: (block) => mdListText(block.children),
    taskList: (block) => mdListText(block.children),
    table: (block) => mdTableText(block),
    youtube: (block) => youtubeWatchUrl(block.videoId),
    mathBlock: (block) => block.value,
    footnoteDefinition: (block) => A.join(A.map(block.children, mdBlockText), "\n"),
    admonition: (block) => A.join(A.map(block.children, mdBlockText), "\n"),
    embed: mdEmbedText,
    hr: () => "",
  })
);

const pandocChildBlocksToMd = (
  children: ReadonlyArray<PandocBlock.Type>,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<Md.Block>>, S.SchemaError> =>
  Effect.map(
    Effect.forEach(children, (child, index) => pandocBlockToMd(child, appendIndex(path, "children", index))),
    (values) => ({
      issues: mergeIssues(values),
      value: A.map(values, (child) => child.value),
    })
  );

const pandocListItemsToMd = (
  items: ReadonlyArray<ReadonlyArray<PandocBlock.Type>>,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<Md.Li>>, S.SchemaError> =>
  Effect.map(
    Effect.forEach(items, (item, index) => pandocListItemToMd(item, appendIndex(path, "items", index))),
    (values) => ({
      issues: mergeIssues(values),
      value: A.map(values, (item) => item.value),
    })
  );

const pandocBlockToMd = (block: PandocBlock.Type, path: JsonPath): Effect.Effect<Projection<Md.Block>, S.SchemaError> =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      plain: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues,
          value: Md.P.make({ children: value }),
        })),
      para: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => ({
          issues,
          value: Md.P.make({ children: value }),
        })),
      header: (node) =>
        Effect.map(pandocInlinesToMd(node.children, path), ({ issues, value }) => {
          const headingLevel = pandocHeadingLevelProjection(node.level, path);

          return {
            issues: [
              ...issues,
              ...(PandocAttr.isNonEmpty(node.attr)
                ? [
                    issue({
                      construct: "Header",
                      direction: "pandoc-to-md",
                      message: "Pandoc header attributes have no Md-core heading equivalent.",
                      path,
                      severity: "lossy",
                    }),
                  ]
                : []),
              ...headingLevel.issues,
            ],
            value: headingToMd(headingLevel.value, value),
          };
        }),
      blockquote: (node) =>
        Effect.map(pandocChildBlocksToMd(node.children, path), ({ issues, value }) => ({
          issues,
          value: Md.BlockQuote.make({ children: value }),
        })),
      codeblock: (node) =>
        Effect.succeed({
          issues: hasCodeBlockDroppedAttr(node.attr)
            ? [
                issue({
                  construct: "CodeBlock",
                  direction: "pandoc-to-md",
                  message:
                    "Pandoc code block id, key/value pairs, extra classes, or an invalid language class have no Md-core pre equivalent.",
                  path,
                  severity: "lossy",
                }),
              ]
            : [],
          value: Md.Pre.make({
            // Pandoc code-block classes are arbitrary external tokens; fold the
            // first class through CodeFenceLanguage so non-conforming hints drop
            // to None (matching the Pre codec) instead of throwing on construction.
            language: O.flatMap(O.fromUndefinedOr(node.attr.classes[0]), Md.CodeFenceLanguage.decodeOption),
            value: node.text,
          }),
        }),
      bulletlist: (node) =>
        Effect.map(pandocListItemsToMd(node.items, path), ({ issues, value }) => ({
          issues,
          value: Md.Ul.make({ children: value }),
        })),
      orderedlist: (node) =>
        Effect.map(pandocListItemsToMd(node.items, path), ({ issues, value }) => ({
          issues: [
            ...issues,
            ...(hasOrderedListMarkerLoss(node)
              ? [
                  issue({
                    construct: "OrderedList",
                    direction: "pandoc-to-md",
                    message: "Pandoc ordered-list style or delimiter metadata has no Md equivalent.",
                    path,
                    severity: "lossy",
                  }),
                ]
              : []),
            ...(node.start < 1
              ? [
                  issue({
                    construct: "OrderedList",
                    direction: "pandoc-to-md",
                    message: "Pandoc ordered-list start below one is clamped to the first ordinal.",
                    path,
                    severity: "lossy",
                  }),
                ]
              : []),
          ],
          value: Md.Ol.make({ children: value, start: PosInt.make(node.start < 1 ? 1 : node.start) }),
        })),
      horizontalrule: () => Effect.succeed(emptyProjection(Md.Hr.make({}))),
      div: (node) =>
        Effect.map(pandocChildBlocksToMd(node.children, path), ({ issues, value }) => ({
          issues: [
            ...issues,
            issue({
              construct: "Div",
              direction: "pandoc-to-md",
              message: PandocAttr.isNonEmpty(node.attr)
                ? "Pandoc div attributes, including DOCX custom styles, are recorded as a gap."
                : "Pandoc div wrappers have no Md-core block equivalent and are rendered as blockquotes.",
              path,
              severity: PandocAttr.isNonEmpty(node.attr) ? "unsupported" : "lossy",
            }),
          ],
          value: Md.BlockQuote.make({ children: value }),
        })),
      table: (node) => {
        const caption = A.join(A.map(node.caption, pandocInlineText), "");
        return Effect.succeed({
          issues: [
            issue({
              construct: "Table",
              direction: "pandoc-to-md",
              message: "Pandoc tables are outside the v1 Md-core profile.",
              path,
            }),
          ],
          value: Md.P.make({ children: [mdText(caption.length === 0 ? "[table]" : caption)] }),
        });
      },
      unknownBlock: (node) =>
        Effect.succeed({
          issues: [
            issue({
              construct: node.constructorName,
              direction: "pandoc-to-md",
              message: "Pandoc block constructor is outside the v1 supported surface.",
              path,
            }),
          ],
          value: Md.P.make({ children: [mdText(`[${node.constructorName}]`)] }),
        }),
    })
  );

const mdInlineToPandoc = (
  inline: Md.Inline,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<PandocInline.Type>>, S.SchemaError> =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      text: (node) => Effect.succeed(emptyProjection([Str.make({ text: node.value })])),
      rawMarkdown: (node) =>
        Effect.succeed({
          issues: [
            issue({
              construct: node._tag,
              direction: "md-to-pandoc",
              message: "Trusted raw Markdown or HTML is degraded to Pandoc plain text.",
              path,
              severity: "lossy",
            }),
          ],
          value: [Str.make({ text: node.value })],
        }),
      rawHtml: (node) =>
        Effect.succeed({
          issues: [
            issue({
              construct: node._tag,
              direction: "md-to-pandoc",
              message: "Trusted raw Markdown or HTML is degraded to Pandoc plain text.",
              path,
              severity: "lossy",
            }),
          ],
          value: [Str.make({ text: node.value })],
        }),
      strong: (node) =>
        Effect.map(mdInlinesToPandoc(node.children, path), ({ issues, value }) => ({
          issues,
          value: [Strong.make({ children: value })],
        })),
      em: (node) =>
        Effect.map(mdInlinesToPandoc(node.children, path), ({ issues, value }) => ({
          issues,
          value: [Emph.make({ children: value })],
        })),
      del: (node) =>
        Effect.map(mdInlinesToPandoc(node.children, path), ({ issues, value }) => ({
          issues,
          value: [Strikeout.make({ children: value })],
        })),
      code: (node) => Effect.succeed(emptyProjection([Code.make({ attr: PandocAttr.empty, text: node.value })])),
      a: (node) =>
        Effect.map(mdInlinesToPandoc(node.children, path), ({ issues, value }) => ({
          issues,
          value: [
            Link.make({
              attr: PandocAttr.empty,
              children: value,
              target: PandocTarget.make({
                title: O.match({ onNone: () => "", onSome: (title: string) => title })(node.title),
                url: node.href,
              }),
            }),
          ],
        })),
      img: (node) =>
        Effect.succeed(
          emptyProjection([
            Image.make({
              attr: PandocAttr.empty,
              children: [Str.make({ text: node.alt })],
              target: PandocTarget.make({
                title: O.match({ onNone: () => "", onSome: (title: string) => title })(node.title),
                url: node.src,
              }),
            }),
          ])
        ),
      br: () => Effect.succeed(emptyProjection([LineBreak.make({})])),
      inlineMath: (node) =>
        Effect.succeed(emptyProjection([PandocMath.make({ mathType: "InlineMath", text: node.value })])),
      footnoteReference: (node) =>
        Effect.succeed({
          issues: [
            issue({
              construct: "FootnoteReference",
              direction: "md-to-pandoc",
              message:
                "Named Md footnote references have no standalone Pandoc-core equivalent and are emitted as text.",
              path,
              severity: "lossy",
            }),
          ],
          value: [Str.make({ text: `[^${node.identifier}]` })],
        }),
    })
  );

const mdInlinesToPandoc = (
  inlines: ReadonlyArray<Md.Inline>,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<PandocInline.Type>>, S.SchemaError> =>
  projectChildValues(inlines, path, mdInlineToPandoc);

type MdHeading = Extract<Md.Block, { readonly _tag: "heading" }>;

const mdHeadingToPandoc = (
  node: MdHeading,
  path: JsonPath
): Effect.Effect<Projection<PandocBlock.Type>, S.SchemaError> =>
  Effect.map(mdInlinesToPandoc(node.children, path), ({ issues, value }) => ({
    issues,
    value: Header.make({ attr: PandocAttr.empty, children: value, level: node.level }),
  }));

const mdListItemToPandocBlocks = (
  item: Md.Li | Md.TaskItem,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<PandocBlock.Type>>, S.SchemaError> =>
  mdListItemChildrenToPandocBlocks(item.children, path);

const mdListItemsToPandocBlocks = (
  items: ReadonlyArray<Md.Li | Md.TaskItem>,
  path: JsonPath
): Effect.Effect<Projection<ReadonlyArray<ReadonlyArray<PandocBlock.Type>>>, S.SchemaError> =>
  Effect.map(
    Effect.forEach(items, (item, index) => mdListItemToPandocBlocks(item, appendIndex(path, "children", index))),
    (values) => ({
      issues: mergeIssues(values),
      value: A.map(values, (item) => item.value),
    })
  );

const mdBlockToPandoc = (block: Md.Block, path: JsonPath): Effect.Effect<Projection<PandocBlock.Type>, S.SchemaError> =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      heading: (node) => mdHeadingToPandoc(node, path),
      p: (node) =>
        Effect.map(mdInlinesToPandoc(node.children, path), ({ issues, value }) => ({
          issues,
          value: Para.make({ children: value }),
        })),
      blockquote: (node) =>
        Effect.map(
          Effect.forEach(node.children, (child, index) => mdBlockToPandoc(child, appendIndex(path, "children", index))),
          (children) => ({
            issues: mergeIssues(children),
            value: BlockQuote.make({ children: A.map(children, (child) => child.value) }),
          })
        ),
      pre: (node) =>
        Effect.succeed(
          emptyProjection(
            CodeBlock.make({
              attr: PandocAttr.make({
                classes: O.match({ onNone: () => [], onSome: (language: string) => [language] })(node.language),
                id: "",
                keyValues: [],
              }),
              text: node.value,
            })
          )
        ),
      ul: (node) =>
        Effect.map(mdListItemsToPandocBlocks(node.children, path), ({ issues, value }) => ({
          issues,
          value: BulletList.make({
            items: value,
          }),
        })),
      ol: (node) =>
        Effect.map(mdListItemsToPandocBlocks(node.children, path), ({ issues, value }) => ({
          issues,
          value: OrderedList.make({
            delimiter: "DefaultDelim",
            items: value,
            start: node.start,
            style: "DefaultStyle",
          }),
        })),
      taskList: (node) =>
        Effect.map(mdListItemsToPandocBlocks(node.children, path), ({ issues, value }) => ({
          issues: [
            issue({
              construct: "TaskList",
              direction: "md-to-pandoc",
              message: "Md task list checked state has no v1 Pandoc-core mapping and is emitted as a bullet list.",
              path,
              severity: "lossy",
            }),
            ...issues,
          ],
          value: BulletList.make({
            items: value,
          }),
        })),
      table: (node) => {
        const text = mdTableText(node);
        return Effect.succeed({
          issues: [
            issue({
              construct: "Table",
              direction: "md-to-pandoc",
              message: "Md tables are outside the v1 Pandoc-core profile and are emitted as plain paragraph text.",
              path,
              severity: "lossy",
            }),
          ],
          value: Para.make({ children: [Str.make({ text: text.length === 0 ? "[table]" : text })] }),
        });
      },
      youtube: (node) => {
        const url = youtubeWatchUrl(node.videoId);
        return Effect.succeed({
          issues: [
            issue({
              construct: "YouTube",
              direction: "md-to-pandoc",
              message: "Md YouTube embeds have no Pandoc-core equivalent and are emitted as a plain link.",
              path,
              severity: "lossy",
            }),
          ],
          value: Para.make({
            children: [
              Link.make({
                attr: PandocAttr.empty,
                children: [Str.make({ text: url })],
                target: PandocTarget.make({ title: "", url }),
              }),
            ],
          }),
        });
      },
      mathBlock: (node) =>
        Effect.succeed(
          emptyProjection(Para.make({ children: [PandocMath.make({ mathType: "DisplayMath", text: node.value })] }))
        ),
      footnoteDefinition: (node) =>
        Effect.map(
          Effect.forEach(node.children, (child, index) => mdBlockToPandoc(child, appendIndex(path, "children", index))),
          (children) => ({
            issues: [
              issue({
                construct: "FootnoteDefinition",
                direction: "md-to-pandoc",
                message: "Named Md footnote definitions are emitted as anonymous Pandoc notes.",
                path,
                severity: "lossy",
              }),
              ...mergeIssues(children),
            ],
            value: Para.make({ children: [Note.make({ blocks: A.map(children, (child) => child.value) })] }),
          })
        ),
      admonition: (node) =>
        Effect.map(
          Effect.forEach(node.children, (child, index) => mdBlockToPandoc(child, appendIndex(path, "children", index))),
          (children) => ({
            issues: [
              issue({
                construct: "Admonition",
                direction: "md-to-pandoc",
                message: "Md admonitions are emitted as attributed Pandoc divs.",
                path,
                severity: "lossy",
              }),
              ...mergeIssues(children),
            ],
            value: Div.make({
              attr: PandocAttr.make({
                classes: ["admonition", node.kind],
                id: "",
                keyValues: O.match({
                  onNone: () => [],
                  onSome: (title: string) => [["title", title] as const],
                })(node.title),
              }),
              children: A.map(children, (child) => child.value),
            }),
          })
        ),
      embed: (node) => {
        const title = O.match({ onNone: () => "", onSome: (value: string) => value })(node.title);
        const label = title.length === 0 ? node.src : title;
        const target = PandocTarget.make({ title, url: node.src });
        const child = Match.value(node.kind).pipe(
          Match.when("image", () =>
            Image.make({ attr: PandocAttr.empty, children: [Str.make({ text: label })], target })
          ),
          Match.orElse(() => Link.make({ attr: PandocAttr.empty, children: [Str.make({ text: label })], target }))
        );

        return Effect.succeed({
          issues: [
            issue({
              construct: "Embed",
              direction: "md-to-pandoc",
              message: "Generic Md embeds are emitted as inert Pandoc image or link nodes.",
              path,
              severity: "lossy",
            }),
          ],
          value: Para.make({ children: [child] }),
        });
      },
      hr: () => Effect.succeed(emptyProjection(HorizontalRule.make({}))),
    })
  );

/**
 * Result of mapping a Pandoc document to `@beep/md`.
 *
 * **Example** (Make document mapping result)
 *
 * ```ts
 * import * as Md from "@beep/md/Md.model"
 * import { PandocToDocumentResult } from "@beep/pandoc-ast/Pandoc.mapping"
 * import { PandocCompatibilityReport } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const result = PandocToDocumentResult.make({
 *   document: Md.Document.make({ children: [] }),
 *   report: PandocCompatibilityReport.fromIssues([]),
 * })
 * console.log(result.report.profile) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PandocToDocumentResult extends S.Class<PandocToDocumentResult>($I`PandocToDocumentResult`)(
  {
    document: Md.Document.annotateKey({
      description: "Mapped Md document.",
    }),
    report: PandocCompatibilityReport.annotateKey({
      description: "Compatibility report for the mapping.",
    }),
  },
  $I.annote("PandocToDocumentResult", {
    description: "Result of mapping a Pandoc document to @beep/md.",
  })
) {}

/**
 * Companion namespace for {@link PandocToDocumentResult}.
 *
 * **Example** (Annotate companion result type)
 *
 * ```ts
 * import * as Md from "@beep/md/Md.model"
 * import { PandocToDocumentResult } from "@beep/pandoc-ast/Pandoc.mapping"
 * import { PandocCompatibilityReport } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const result: PandocToDocumentResult.Type = PandocToDocumentResult.make({
 *   document: Md.Document.make({ children: [] }),
 *   report: PandocCompatibilityReport.fromIssues([]),
 * })
 * console.log(result.report.profile) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocToDocumentResult {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly document: Md.Document.Type;
    readonly report: PandocCompatibilityReport.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly document: Md.Document.Encoded;
    readonly report: PandocCompatibilityReport.Encoded;
  }
}

/**
 * Result of mapping an `@beep/md` document to Pandoc.
 *
 * **Example** (Make pandoc mapping result)
 *
 * ```ts
 * import { DocumentToPandocResult } from "@beep/pandoc-ast/Pandoc.mapping"
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 * import { PandocCompatibilityReport } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const result = DocumentToPandocResult.make({
 *   pandoc: PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} }),
 *   report: PandocCompatibilityReport.fromIssues([]),
 * })
 * console.log(result.pandoc.apiVersion[0]) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentToPandocResult extends S.Class<DocumentToPandocResult>($I`DocumentToPandocResult`)(
  {
    pandoc: PandocDocument.annotateKey({
      description: "Mapped Pandoc document.",
    }),
    report: PandocCompatibilityReport.annotateKey({
      description: "Compatibility report for the mapping.",
    }),
  },
  $I.annote("DocumentToPandocResult", {
    description: "Result of mapping an @beep/md document to Pandoc.",
  })
) {}

/**
 * Companion namespace for {@link DocumentToPandocResult}.
 *
 * **Example** (Annotate companion result type)
 *
 * ```ts
 * import { DocumentToPandocResult } from "@beep/pandoc-ast/Pandoc.mapping"
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 * import { PandocCompatibilityReport } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const result: DocumentToPandocResult.Type = DocumentToPandocResult.make({
 *   pandoc: PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} }),
 *   report: PandocCompatibilityReport.fromIssues([]),
 * })
 * console.log(result.pandoc.apiVersion[0]) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace DocumentToPandocResult {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly pandoc: PandocDocument.Type;
    readonly report: PandocCompatibilityReport.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly pandoc: PandocDocument.Encoded;
    readonly report: PandocCompatibilityReport.Encoded;
  }
}

/**
 * Maps a Pandoc document into the canonical `@beep/md` AST with a structured
 * compatibility report.
 *
 * **Example** (Map empty pandoc document)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { pandocToDocument } from "@beep/pandoc-ast/Pandoc.mapping"
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const result = Effect.runSync(pandocToDocument(PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })))
 * console.log(result.report.profile)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const pandocToDocument = (
  pandoc: PandocDocument.Type
): Effect.Effect<PandocToDocumentResult, PandocMappingError> =>
  S.encodeEffect(PandocDocument)(pandoc).pipe(
    Effect.as(pandoc),
    Effect.flatMap((decoded) =>
      Effect.map(
        Effect.forEach(decoded.blocks, (block, index) => pandocBlockToMd(block, ["blocks", index])),
        (blocks) =>
          PandocToDocumentResult.make({
            document: Md.Document.make({ children: A.map(blocks, (block) => block.value) }),
            report: PandocCompatibilityReport.fromIssues([
              ...mergeIssues(blocks),
              ...(!R.isEmptyReadonlyRecord(decoded.meta)
                ? [
                    issue({
                      construct: "Meta",
                      direction: "pandoc-to-md",
                      message: "Pandoc document metadata is outside the Md document model.",
                      path: ["meta"],
                      severity: "lossy",
                    }),
                  ]
                : []),
            ]),
          })
      )
    ),
    Effect.mapError((cause) => PandocMappingError.make({ cause, message: "Pandoc to Md mapping failed." }))
  );

/**
 * Maps the canonical `@beep/md` AST into a Pandoc document with a structured
 * compatibility report.
 *
 * **Example** (Map empty md document)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Md from "@beep/md/Md.model"
 * import { documentToPandoc } from "@beep/pandoc-ast/Pandoc.mapping"
 *
 * const result = Effect.runSync(documentToPandoc(Md.Document.make({ children: [] })))
 * console.log(result.pandoc.blocks.length)
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const documentToPandoc = (
  document: Md.Document.Type
): Effect.Effect<DocumentToPandocResult, PandocMappingError> =>
  S.encodeEffect(Md.Document)(document).pipe(
    Effect.as(document),
    Effect.flatMap((decoded) =>
      Effect.map(
        Effect.forEach(decoded.children, (block, index) => mdBlockToPandoc(block, ["children", index])),
        (blocks) =>
          DocumentToPandocResult.make({
            pandoc: PandocDocument.make({
              apiVersion: DEFAULT_PANDOC_API_VERSION,
              blocks: A.map(blocks, (block) => block.value),
              meta: {},
            }),
            report: PandocCompatibilityReport.fromIssues(mergeIssues(blocks)),
          })
      )
    ),
    Effect.mapError((cause) => PandocMappingError.make({ cause, message: "Md to Pandoc mapping failed." }))
  );

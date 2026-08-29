/**
 * Safe HTML projection for schema-first Markdown documents.
 *
 * This module maps the Markdown AST directly into `@beep/html` nodes. It never
 * parses or sanitizes an intermediate HTML string: conformance, policy, and
 * opaque `SafeHtml` provenance are all issued by `@beep/html`.
 *
 * @packageDocumentation \@beep/md/Md.html
 * @since 0.0.0
 */

import { conform, enforceSafeHtml, serializeSafe } from "@beep/html";
import * as HtmlModel from "@beep/html/Html.model";
import { Text as HtmlText } from "@beep/html/Html.nodes";
import { A } from "@beep/utils";
import { Effect, Match, pipe } from "effect";
import * as O from "effect/Option";
import { Inline as InlineSchema } from "./Md.model.ts";
import type { HtmlChildNode, SafeHtml } from "@beep/html";
import type { Block, Document, Embed, Inline, Li, ListItemChild, Table, TableCell, TableRow } from "./Md.model.ts";
import type { SafeDocument } from "./Md.safe.ts";

const text = (value: string): HtmlText => HtmlText.make({ value });

type InlineContext = {
  readonly insideAnchor: boolean;
};

const rootInlineContext: InlineContext = { insideAnchor: false };
const anchorInlineContext: InlineContext = { insideAnchor: true };

const inlineChildrenToHtml = (children: ReadonlyArray<Inline>, context: InlineContext): ReadonlyArray<HtmlChildNode> =>
  A.map(children, (child) => inlineToHtml(child, context));

const inlineToHtml = (inline: Inline, context: InlineContext): HtmlChildNode =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      text: ({ value }) => text(value),
      rawMarkdown: ({ value }) => text(value),
      rawHtml: ({ value }) => text(value),
      strong: ({ children }) => HtmlModel.Strong.make({ children: inlineChildrenToHtml(children, context) }),
      em: ({ children }) => HtmlModel.Em.make({ children: inlineChildrenToHtml(children, context) }),
      del: ({ children }) => HtmlModel.Del.make({ children: inlineChildrenToHtml(children, context) }),
      code: ({ value }) => HtmlModel.Code.make({ children: [text(value)] }),
      a: ({ children, href, title }) => {
        const renderedChildren = inlineChildrenToHtml(children, context.insideAnchor ? context : anchorInlineContext);

        return context.insideAnchor
          ? HtmlModel.Span.make({ children: renderedChildren, title })
          : HtmlModel.A.make({
              children: renderedChildren,
              href: O.some(href),
              title,
            });
      },
      img: ({ alt, src, title }) =>
        HtmlModel.Img.make({
          alt: O.some(alt),
          src: O.some(src),
          title,
        }),
      br: () => HtmlModel.Br.make({}),
      inlineMath: ({ value }) => HtmlModel.Code.make({ children: [text(value)] }),
      footnoteReference: ({ identifier }) =>
        HtmlModel.Sup.make({
          children: [
            HtmlModel.A.make({
              children: [text(identifier)],
              href: O.some(`#fn-${identifier}`),
            }),
          ],
        }),
    })
  );

const listItemChildrenToHtml = (children: ReadonlyArray<ListItemChild>): ReadonlyArray<HtmlChildNode> =>
  A.map(children, (child) => (InlineSchema.is(child) ? inlineToHtml(child, rootInlineContext) : blockToHtml(child)));

const listItemToHtml = (item: Li): HtmlModel.Li =>
  HtmlModel.Li.make({ children: listItemChildrenToHtml(item.children) });

const tableCellToHtml = (cell: TableCell, header: boolean): HtmlChildNode =>
  header
    ? HtmlModel.Th.make({ children: inlineChildrenToHtml(cell.children, rootInlineContext) })
    : HtmlModel.Td.make({ children: inlineChildrenToHtml(cell.children, rootInlineContext) });

const tableRowToHtml = (row: TableRow, header: boolean): HtmlModel.Tr =>
  HtmlModel.Tr.make({
    children: A.map(row.children, (cell) => tableCellToHtml(cell, header)),
  });

const tableToHtml = (table: Table): HtmlModel.Table => {
  const [first, ...rest] = table.children;
  const children: ReadonlyArray<HtmlChildNode> =
    table.headerRow && first !== undefined
      ? [
          HtmlModel.Thead.make({ children: [tableRowToHtml(first, true)] }),
          HtmlModel.Tbody.make({
            children: A.map(rest, (row) => tableRowToHtml(row, false)),
          }),
        ]
      : [
          HtmlModel.Tbody.make({
            children: A.map(table.children, (row) => tableRowToHtml(row, false)),
          }),
        ];

  return HtmlModel.Table.make({ children });
};

const figureCaption = (description: O.Option<string>): ReadonlyArray<HtmlChildNode> =>
  O.match(description, {
    onNone: A.emptyReadonly,
    onSome: (value) => [HtmlModel.Figcaption.make({ children: [text(value)] })],
  });

const embedToHtml = (embed: Embed): HtmlModel.Figure => {
  const label = pipe(
    embed.title,
    O.getOrElse(() => embed.src)
  );
  const content: HtmlChildNode =
    embed.kind === "image"
      ? HtmlModel.Img.make({
          alt: O.some(label),
          src: O.some(embed.src),
          title: embed.title,
        })
      : HtmlModel.A.make({
          children: [text(label)],
          href: O.some(embed.src),
          title: embed.title,
        });

  return HtmlModel.Figure.make({
    children: [content, ...figureCaption(embed.description)],
  });
};

const blockToHtml = (block: Block): HtmlChildNode =>
  Match.value(block).pipe(
    Match.tagsExhaustive({
      heading: ({ children, level }) => {
        const rendered = inlineChildrenToHtml(children, rootInlineContext);
        return Match.value(level).pipe(
          Match.when(1, () => HtmlModel.H1.make({ children: rendered })),
          Match.when(2, () => HtmlModel.H2.make({ children: rendered })),
          Match.when(3, () => HtmlModel.H3.make({ children: rendered })),
          Match.when(4, () => HtmlModel.H4.make({ children: rendered })),
          Match.when(5, () => HtmlModel.H5.make({ children: rendered })),
          Match.when(6, () => HtmlModel.H6.make({ children: rendered })),
          Match.exhaustive
        );
      },
      p: ({ children }) => HtmlModel.P.make({ children: inlineChildrenToHtml(children, rootInlineContext) }),
      blockquote: ({ children }) => HtmlModel.Blockquote.make({ children: A.map(children, blockToHtml) }),
      pre: ({ value }) =>
        HtmlModel.Pre.make({
          children: [HtmlModel.Code.make({ children: [text(value)] })],
        }),
      ul: ({ children }) => HtmlModel.Ul.make({ children: A.map(children, listItemToHtml) }),
      ol: ({ children, start }) =>
        HtmlModel.Ol.make({
          children: A.map(children, listItemToHtml),
          start: O.some(start),
        }),
      taskList: ({ children }) =>
        HtmlModel.Ul.make({
          children: A.map(children, (item) =>
            HtmlModel.Li.make({
              children: [text(item.checked ? "☒ " : "☐ "), ...listItemChildrenToHtml(item.children)],
            })
          ),
        }),
      table: tableToHtml,
      youtube: ({ videoId }) =>
        HtmlModel.P.make({
          children: [
            HtmlModel.A.make({
              children: [text("Watch on YouTube")],
              href: O.some(`https://www.youtube.com/watch?v=${videoId}`),
            }),
          ],
        }),
      mathBlock: ({ value }) =>
        HtmlModel.Pre.make({
          children: [HtmlModel.Code.make({ children: [text(value)] })],
        }),
      footnoteDefinition: ({ children, identifier }) =>
        HtmlModel.Section.make({
          children: [HtmlModel.Sup.make({ children: [text(identifier)] }), ...A.map(children, blockToHtml)],
          id: O.some(`fn-${identifier}`),
        }),
      admonition: ({ children, title }) =>
        HtmlModel.Aside.make({
          children: [
            ...O.match(title, {
              onNone: A.emptyReadonly,
              onSome: (value) => [HtmlModel.P.make({ children: [text(value)] })],
            }),
            ...A.map(children, blockToHtml),
          ],
        }),
      embed: embedToHtml,
      hr: () => HtmlModel.Hr.make({}),
    })
  );

const safeDocumentToHtmlFragment = (document: Document): HtmlModel.Fragment =>
  HtmlModel.Fragment.make({ children: A.map(document.children, blockToHtml) });

/**
 * Renders a user-boundary Markdown document as opaque, policy-proven HTML.
 *
 * **Details**
 *
 * The renderer performs a direct AST projection and executes the canonical
 * `conform -> enforceSafeHtml -> serializeSafe` pipeline. Raw nodes cannot
 * enter through {@link SafeDocument}; the defensive raw-node branches render
 * their source as text if a structurally forged value reaches this module.
 *
 * **Example** (Render simple paragraph document)
 *
 * ```ts
 * import { Md, safeHtmlValue } from "@beep/md"
 * import { Result } from "effect"
 *
 * const document = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Hello")])))
 * console.log(safeHtmlValue(Md.renderSafeHtml(document))) // "<p>Hello</p>"
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderSafeHtml = (document: SafeDocument): SafeHtml =>
  Effect.runSync(
    conform(safeDocumentToHtmlFragment(document)).pipe(Effect.flatMap(enforceSafeHtml), Effect.flatMap(serializeSafe))
  );

/**
 * Unwraps opaque safe HTML at a final browser or framework sink.
 *
 * Re-exporting the HTML-owned getter keeps trust provenance explicit for
 * Markdown consumers without creating a second marker or issuer.
 *
 * @category getters
 * @since 0.0.0
 */
export { safeHtmlValue } from "@beep/html";

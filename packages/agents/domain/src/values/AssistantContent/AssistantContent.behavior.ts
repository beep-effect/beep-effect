/**
 * Pure lifts from the stratified assistant-turn block schema into the
 * `@beep/md` `Md.model` AST, so assistant turns render through the exact same
 * Markdown pipeline as authored content. Class construction is synchronous, so
 * every lift is a plain function.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Md from "@beep/md/Md.model";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { AssistantBlock, AssistantHeadingTag, AssistantListType, InlineNode } from "./AssistantContent.model.js";

/**
 * Lift a single {@link InlineNode} into a `@beep/md` inline node.
 *
 * Inline-code text becomes a `Code` span. Otherwise a `Text` run is wrapped in
 * `Em` (italic) then `Strong` (bold) as the flags are set, leaving bold as the
 * outermost wrapper. Links become an `A` node wrapping the visible text.
 *
 * @example
 * ```ts
 * import { inlineToMd } from "@beep/agents-domain/values/AssistantContent"
 *
 * const node = inlineToMd({ type: "text", text: "Hello", bold: true })
 * console.log(node._tag) // "strong"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const inlineToMd = (node: InlineNode): Md.Inline.Type =>
  InlineNode.match(node, {
    text: (t): Md.Inline.Type => {
      if (t.code === true) {
        return Md.Code.make({ value: t.text });
      }
      let current: Md.Inline.Type = Md.Text.make({ value: t.text });
      if (t.italic === true) {
        current = Md.Em.make({ children: [current] });
      }
      if (t.bold === true) {
        current = Md.Strong.make({ children: [current] });
      }
      return current;
    },
    link: (l): Md.Inline.Type =>
      Md.A.make({
        href: l.url,
        children: [Md.Text.make({ value: l.text })],
      }),
  });

const inlinesToMd = (inlines: ReadonlyArray<InlineNode>): ReadonlyArray<Md.Inline.Type> => A.map(inlines, inlineToMd);

/**
 * Lift a single {@link AssistantBlock} into a `@beep/md` block node.
 *
 * Paragraphs map to `P`; headings map to a `Heading` block carrying their
 * numeric `level`; quotes wrap their inlines in a single paragraph inside a
 * `BlockQuote`; lists become `Ul` (bullet) or `Ol` (number) with one `Li` per
 * item; code blocks become `Pre` with an optional language hint.
 *
 * @example
 * ```ts
 * import { blockToMd } from "@beep/agents-domain/values/AssistantContent"
 *
 * const node = blockToMd({ type: "heading", level: "h2", children: [{ type: "text", text: "Install" }] })
 * console.log(node._tag) // "heading"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const blockToMd = (block: AssistantBlock): Md.Block.Type =>
  AssistantBlock.match(block, {
    paragraph: (b): Md.Block.Type => Md.P.make({ children: inlinesToMd(b.children) }),
    heading: (b): Md.Block.Type => {
      const children = inlinesToMd(b.children);
      const level = AssistantHeadingTag.$match(b.level, {
        h1: () => 1 as const,
        h2: () => 2 as const,
        h3: () => 3 as const,
      });
      return Md.Heading.make({ level, children });
    },
    quote: (b): Md.Block.Type =>
      Md.BlockQuote.make({
        children: [Md.P.make({ children: inlinesToMd(b.children) })],
      }),
    list: (b): Md.Block.Type => {
      const children = A.map(b.items, (item) => Md.Li.make({ children: inlinesToMd(item.children) }));
      return AssistantListType.$match(b.listType, {
        bullet: () => Md.Ul.make({ children }),
        number: () => Md.Ol.make({ children }),
      });
    },
    code: (b): Md.Block.Type =>
      Md.Pre.make({
        // Assistant-supplied language hints are untrusted free-form info strings;
        // fold them through CodeFenceLanguage so non-conforming tokens drop to
        // None (matching the Pre codec) instead of throwing on construction.
        language: O.flatMap(O.fromNullishOr(b.language), Md.CodeFenceLanguage.decodeOption),
        value: b.code,
      }),
    table: (b): Md.Block.Type =>
      Md.Table.make({
        headerRow: b.headerRow === true,
        children: A.map(b.rows, (row) =>
          Md.TableRow.make({
            children: A.map(row.cells, (cell) => Md.TableCell.make({ children: inlinesToMd(cell.children) })),
          })
        ),
      }),
    youtube: (b): Md.Block.Type => Md.YouTube.make({ videoId: b.videoId }),
  });

/**
 * Lift an ordered list of assistant blocks into a complete `@beep/md`
 * `Document`.
 *
 * @example
 * ```ts
 * import { assistantContentToDocument } from "@beep/agents-domain/values/AssistantContent"
 *
 * const document = assistantContentToDocument([
 *   { type: "paragraph", children: [{ type: "text", text: "Hello" }] },
 * ])
 * console.log(document._tag) // "document"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const assistantContentToDocument = (blocks: ReadonlyArray<AssistantBlock>): Md.Document.Type =>
  Md.Document.make({ children: A.map(blocks, blockToMd) });

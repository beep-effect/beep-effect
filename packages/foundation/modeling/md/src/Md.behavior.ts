/**
 * Pure, escaping-free node behavior for the Markdown AST.
 *
 * This module owns the plain-text projection of a document (the "signal" read
 * off a node, distinct from the escaping render adapters) plus the shared
 * inline/block run segmentation used by every list-item renderer.
 *
 * @packageDocumentation \@beep/md/Md.behavior
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Match } from "effect";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import { Inline as InlineSchema } from "./Md.model.ts";
import type { Block, Inline, Li, ListItemChild, Table, TaskItem } from "./Md.model.ts";

const joinEmpty = A.join("");
const youtubeWatchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`;
const embedTitle = (embed: { readonly src: string; readonly title: O.Option<string> }): string =>
  pipe(
    embed.title,
    O.getOrElse(() => embed.src)
  );

/**
 * The strategy consumed by {@link segmentInlineRuns}: the inline guard plus the
 * per-run and per-block renderers.
 *
 * **Example** (SegmentStrategy type shape)
 *
 * ```ts
 * import type { SegmentStrategy } from "@beep/md/Md.behavior"
 *
 * const strategy: SegmentStrategy<string, number> = {
 *   isInline: (item): item is string => typeof item === "string",
 *   renderBlock: (block) => `block:${block}`,
 *   renderInlineRun: (run) => `inline:${run.join(",")}`,
 * }
 * console.log(strategy.renderBlock(1)) // "block:1"
 * ```
 *
 * @typeParam I - Inline child element type.
 * @typeParam B - Block child element type.
 * @category models
 * @since 0.0.0
 */
export interface SegmentStrategy<I, B> {
  /**
   * Type guard selecting inline children.
   *
   * @since 0.0.0
   */
  readonly isInline: (item: I | B) => item is I;
  /**
   * Renders a single block child.
   *
   * @since 0.0.0
   */
  readonly renderBlock: (block: B) => string;
  /**
   * Renders a contiguous run of inline children.
   *
   * @since 0.0.0
   */
  readonly renderInlineRun: (run: ReadonlyArray<I>) => string;
}

/**
 * Renders a list-item child sequence into per-segment strings: each maximal run
 * of inline children collapses to one inline render, while every block child
 * renders on its own.
 *
 * **Details**
 *
 * The runs are grouped with {@link A.groupWith} keyed by the inline guard, then
 * each run is rendered by the matching handler — inline runs through
 * `renderInlineRun`, block children individually through `renderBlock`.
 *
 * Dual-arity: call data-first as `segmentInlineRuns(items, strategy)` or
 * data-last as `segmentInlineRuns(strategy)(items)`.
 *
 * **Example** (Segment inline and block runs)
 *
 * ```ts import.meta.vitest name="Segment inline and block runs"
 * import { Inline } from "@beep/md/Md.model"
 * import { segmentInlineRuns } from "@beep/md/Md.behavior"
 * import { Md } from "@beep/md"
 *
 * const segments = segmentInlineRuns([Md.text("a"), Md.text("b"), Md.p("para")], {
 *   isInline: Inline.is,
 *   renderInlineRun: (run) => `inline:${run.length}`,
 *   renderBlock: (block) => `block:${block._tag}`,
 * })
 * segments // => ["inline:2", "block:p"]
 * ```
 *
 * @typeParam I - Inline child element type.
 * @typeParam B - Block child element type.
 * @param items - The list-item children to segment.
 * @param render - The segmentation {@link SegmentStrategy}.
 * @returns One rendered string per inline run and per block child, in order.
 * @category utilities
 * @since 0.0.0
 */
export const segmentInlineRuns: {
  <I, B>(items: ReadonlyArray<I | B>, render: SegmentStrategy<I, B>): ReadonlyArray<string>;
  <I, B>(render: SegmentStrategy<I, B>): (items: ReadonlyArray<I | B>) => ReadonlyArray<string>;
} = dual(
  2,
  <I, B>(items: ReadonlyArray<I | B>, render: SegmentStrategy<I, B>): ReadonlyArray<string> =>
    A.match(items, {
      onEmpty: A.empty<string>,
      onNonEmpty: flow(
        A.groupWith((left, right) => render.isInline(left) === render.isInline(right)),
        A.flatMap((run) =>
          render.isInline(A.headNonEmpty(run))
            ? [render.renderInlineRun(A.filter(run, render.isInline))]
            : A.getSomes(
                A.map(run, (item) => (render.isInline(item) ? O.none<string>() : O.some(render.renderBlock(item))))
              )
        )
      ),
    })
);

const renderPlainTextInlines: (children: ReadonlyArray<Inline>) => string = flow(
  A.map(renderPlainTextInline),
  joinEmpty
);

const renderPlainTextListItemChildren = (children: ReadonlyArray<ListItemChild>): string =>
  pipe(
    segmentInlineRuns(children, {
      isInline: InlineSchema.is,
      renderInlineRun: renderPlainTextInlines,
      renderBlock: renderPlainTextBlock,
    }),
    A.join("\n")
  );

const renderPlainTextListItem = (item: Li): string => renderPlainTextListItemChildren(item.children);

const renderPlainTextTaskItem = (item: TaskItem): string => renderPlainTextListItemChildren(item.children);

const renderPlainTextTable = (block: Table): string =>
  pipe(
    block.children,
    A.map((row) =>
      pipe(
        row.children,
        A.map((cell) => renderPlainTextInlines(cell.children)),
        A.join("\t")
      )
    ),
    A.join("\n")
  );

const renderPlainTextInlineMatcher = Match.type<Inline>().pipe(
  Match.tagsExhaustive({
    text: ({ value }) => value,
    rawMarkdown: ({ value }) => value,
    rawHtml: ({ value }) => value,
    strong: ({ children }) => renderPlainTextInlines(children),
    em: ({ children }) => renderPlainTextInlines(children),
    del: ({ children }) => renderPlainTextInlines(children),
    code: ({ value }) => value,
    a: ({ children }) => renderPlainTextInlines(children),
    img: ({ alt }) => alt,
    br: () => "\n",
    inlineMath: ({ value }) => value,
    footnoteReference: ({ identifier }) => identifier,
  })
);

/**
 * Projects an inline node to its escaping-free plain-text content.
 *
 * **Example** (Plain text from inline)
 *
 * ```ts import.meta.vitest name="Plain text from inline"
 * import { Md } from "@beep/md"
 * import { renderPlainTextInline } from "@beep/md/Md.behavior"
 *
 * renderPlainTextInline(Md.strong("beep")) // => "beep"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function renderPlainTextInline(inline: Inline): string {
  return renderPlainTextInlineMatcher(inline);
}

/**
 * Projects a block node to its escaping-free plain-text content.
 *
 * **Example** (Plain text from block)
 *
 * ```ts import.meta.vitest name="Plain text from block"
 * import { Md } from "@beep/md"
 * import { renderPlainTextBlock } from "@beep/md/Md.behavior"
 *
 * renderPlainTextBlock(Md.h1("Hello")) // => "Hello"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderPlainTextBlock: (block: Block) => string = Match.type<Block>().pipe(
  Match.tagsExhaustive({
    heading: (block) => renderPlainTextInlines(block.children),
    p: (block) => renderPlainTextInlines(block.children),
    blockquote: (block) => renderPlainTextBlocks(block.children),
    pre: (block) => block.value,
    ul: (block) => pipe(block.children, A.map(renderPlainTextListItem), A.join("\n")),
    ol: (block) => pipe(block.children, A.map(renderPlainTextListItem), A.join("\n")),
    taskList: (block) => pipe(block.children, A.map(renderPlainTextTaskItem), A.join("\n")),
    table: renderPlainTextTable,
    youtube: (block) => youtubeWatchUrl(block.videoId),
    mathBlock: (block) => block.value,
    footnoteDefinition: (block) => renderPlainTextBlocks(block.children),
    admonition: (block) => renderPlainTextBlocks(block.children),
    embed: embedTitle,
    hr: () => "",
  })
);

/**
 * Projects block nodes to plain text, one block per line.
 *
 * **Example** (Plain text blocks per line)
 *
 * ```ts import.meta.vitest name="Plain text blocks per line"
 * import { Md } from "@beep/md"
 * import { renderPlainTextBlocks } from "@beep/md/Md.behavior"
 *
 * renderPlainTextBlocks([Md.h1("Hello"), Md.p("World")]) // => "Hello\nWorld"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderPlainTextBlocks: (blocks: ReadonlyArray<Block>) => string = flow(
  A.map(renderPlainTextBlock),
  A.join("\n")
);

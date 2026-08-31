/**
 * Shared list-item segmentation and compatibility aliases for Markdown AST behavior.
 *
 * The schema unions own their plain-text projections; this module retains the
 * established function exports and the renderer-facing run segmentation.
 *
 * @packageDocumentation \@beep/md/Md.behavior
 * @since 0.0.0
 */

import * as Arr from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { dual, flow } from "effect/Function";
import { Block, Inline } from "./Md.model.ts";

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
 * The runs are grouped with {@link Arr.groupWith} keyed by the inline guard, then
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
    Arr.match(items, {
      onEmpty: Arr.empty<string>,
      onNonEmpty: flow(
        Arr.groupWith((left, right) => render.isInline(left) === render.isInline(right)),
        Arr.flatMap((run) =>
          render.isInline(Arr.headNonEmpty(run))
            ? [render.renderInlineRun(Arr.filter(run, render.isInline))]
            : Arr.getSomes(
                Arr.map(run, (item) => (render.isInline(item) ? O.none<string>() : O.some(render.renderBlock(item))))
              )
        )
      ),
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
export const renderPlainTextInline: (inline: Inline) => string = Inline.toPlainText;

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
export const renderPlainTextBlock: (block: Block) => string = Block.toPlainText;

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
export const renderPlainTextBlocks: (blocks: ReadonlyArray<Block>) => string = Block.toPlainTextAll;

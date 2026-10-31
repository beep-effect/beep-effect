/**
 * Fenced code blocks with their source spans: the opening fence, the raw info
 * string, the body exactly as written, and whether a closing fence ended the
 * block.
 *
 * **Details**
 *
 * The fences are the `code` nodes a CommonMark/GFM parse produced that carry
 * a `fenceChar` (indented code blocks are not fences), in document order,
 * including fences nested in blockquotes and list items. Offsets are 0-based
 * UTF-16 indexes into `MarkdownDocument.source` and every span is half-open.
 * `body` is the source text between the opening line and the closing line, so
 * it keeps container prefixes (`> `) and fence indentation; `value` is the
 * code CommonMark reads (the node's `value`), with both removed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FenceChar } from "./MarkdownNode.ts";
import type { MarkdownDocument } from "./MarkdownDocument.ts";
import type { Code } from "./MarkdownNode.ts";

const $I = $MarkdownId.create("MarkdownFence");

/**
 * One fenced code block of a parsed document and its source spans.
 *
 * **Details**
 *
 * `infoString` is the opening line after the marker run, untrimmed and
 * unescaped as written (`source.slice(infoStart, infoEnd)`). `body` is
 * `source.slice(bodyStart, bodyEnd)`: it starts after the opening line's
 * terminator and ends at the start of the closing fence's line, or at the end
 * of the block when `unterminated` is `true`. `value` is the content as
 * CommonMark reads it (container prefixes and the fence's indentation removed,
 * every line ending in `\n`), so it equals `body` for a closed, unindented,
 * top-level fence with `\n` line ends: splice through the spans, analyze
 * `value`. `fenceStart` is the first marker character and `fenceEnd` the end
 * of the block (the end of the closing marker run when the fence closed).
 * `line` is the 0-based line of the opening fence.
 *
 * **Example** (Describe a fence)
 *
 * ```ts
 * import { CodeFence } from "@beep/markdown/MarkdownFence";
 *
 * const fence = CodeFence.make({
 *   fenceChar: "`", fenceLength: 3, infoString: "ts", body: "1\n", value: "1\n", line: 0, unterminated: false,
 *   fenceStart: 0, fenceEnd: 11, infoStart: 3, infoEnd: 5, bodyStart: 6, bodyEnd: 8,
 * });
 * console.log(fence.body) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeFence extends S.Opaque<CodeFence, { readonly brand: unique symbol }>()(
  S.Struct({
    fenceChar: FenceChar,
    fenceLength: S.Natural,
    infoString: S.String,
    body: S.String,
    value: S.String,
    line: S.Natural,
    unterminated: S.Boolean,
    fenceStart: S.Natural,
    fenceEnd: S.Natural,
    infoStart: S.Natural,
    infoEnd: S.Natural,
    bodyStart: S.Natural,
    bodyEnd: S.Natural,
  }).pipe(
    $I.annoteSchema("CodeFence", {
      description:
        "A fenced code block's raw info string, raw body, CommonMark value, opening line, unterminated verdict and half-open source offsets.",
    })
  )
) {}

const lineBreakAt = (source: string, from: number, to: number): number => {
  for (let index = from; index < to; index += 1) {
    const unit = source[index];
    if (unit === "\n" || unit === "\r") {
      return index;
    }
  }
  return to;
};

const lastLineStart = (source: string, from: number, to: number): number => {
  for (let index = to - 1; index >= from; index -= 1) {
    const unit = source[index];
    if (unit === "\n" || unit === "\r") {
      return index + 1;
    }
  }
  return from;
};

const toFence = (source: string, node: Code): CodeFence => {
  const fenceStart = node.position.start.offset;
  const fenceEnd = node.position.end.offset;
  const fenceLength = node.fenceLength ?? 3;
  const unterminated = node.unterminated === true;
  const infoStart = Math.min(fenceStart + fenceLength, fenceEnd);
  const infoEnd = lineBreakAt(source, infoStart, fenceEnd);
  const afterBreak = Str.startsWith("\r\n")(Str.slice(infoEnd)(source)) ? infoEnd + 2 : infoEnd + 1;
  const bodyStart = Math.min(infoEnd === fenceEnd ? fenceEnd : afterBreak, fenceEnd);
  const bodyEnd = unterminated ? fenceEnd : Math.max(bodyStart, lastLineStart(source, bodyStart, fenceEnd));
  return CodeFence.make({
    fenceChar: node.fenceChar ?? "`",
    fenceLength,
    infoString: Str.slice(infoStart, infoEnd)(source),
    body: Str.slice(bodyStart, bodyEnd)(source),
    value: node.value,
    line: node.position.start.line - 1,
    unterminated,
    fenceStart,
    fenceEnd,
    infoStart,
    infoEnd,
    bodyStart,
    bodyEnd,
  });
};

/**
 * The fenced-code queries over a parsed {@link MarkdownDocument}.
 *
 * **Example** (Slice a fence's body out of the source)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
 * import { MarkdownFence } from "@beep/markdown/MarkdownFence";
 * import * as Effect from "effect/Effect";
 *
 * const fence = "~".repeat(3);
 * const doc = Effect.runSync(MarkdownDocument.parse(`Intro\n\n${fence}ts\nconst a = 1\n${fence}\n`));
 * const [first] = MarkdownFence.fences(doc);
 * console.log(first === undefined ? "" : doc.source.slice(first.bodyStart, first.bodyEnd)) // const a = 1
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export abstract class MarkdownFence {
  /**
   * Every fenced code block of a document with its spans, in document order.
   *
   * **Details**
   *
   * A fence the document (or the blockquote or list item holding it) ends
   * before any closing fence is reported with `unterminated: true` and a body
   * running to the end of the block. Indented code blocks are skipped.
   *
   * **Example** (Read a body and an unterminated verdict)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import { MarkdownFence } from "@beep/markdown/MarkdownFence";
   * import * as Effect from "effect/Effect";
   *
   * const fence = "`".repeat(3);
   * const doc = Effect.runSync(MarkdownDocument.parse(`${fence}ts\nconst a = 1\n${fence}\n\n${fence}sh\nls`));
   * console.log(MarkdownFence.fences(doc).map((item) => `${item.infoString}:${item.unterminated}`).join(" ")) // ts:false sh:true
   * ```
   *
   * @param document - A parsed document.
   * @returns The fences, in document order.
   * @category utilities
   * @since 0.0.0
   */
  static readonly fences = (document: MarkdownDocument): ReadonlyArray<CodeFence> =>
    A.map(
      document.findAll((node): node is Code => node.type === "code" && node.fenceChar !== undefined),
      (node) => toFence(document.source, node)
    );
}

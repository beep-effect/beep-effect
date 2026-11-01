// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `blocks.code_block`: the construct both code-block spellings share, exactly
// as upstream shares one table entry between them. The two block starts live
// in `indentedCode.ts` and `fencedCode.ts`; which one opened the block is
// recorded as `data.isFenced`, and every method below branches on it.
//
// The absence of `fenceChar`/`fenceLength` on the materialized node is what
// tells an indented block from a fenced one on the way back out, so the
// indented branch must never set them (the `Code` schema contract).

import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Str from "effect/String";
import { BlockConstruct, containsNothing, leafMaterializer } from "../blockTypes.ts";
import { trustedNode } from "../nodes.ts";
import { unitAt } from "../patterns.ts";
import { CODE_INDENT, isSpaceOrTab } from "../preprocess.ts";
import { unescapeString } from "../unescape.ts";
import type { BlockContinueResult, BlockNode, BlockScanner } from "../blockTypes.ts";
import type { Code } from "../nodes.ts";

const reBlankLine = /^[ \t]*$/;
/** A closing fence, sticky at the scan position. */
const reClosingCodeFence = /(?:`{3,}|~{3,})(?=[ \t]*$)/y;
const reInfoSeparator = /[ \t]/;

const splitLines = Str.split("\n");
const isContentLine = (line: string): boolean => !reBlankLine.test(line);

/**
 * Drop the trailing blank lines an indented code block accumulates, and pull
 * the block's end back to the last line that survived.
 */
const finalizeIndented = (block: BlockNode): void => {
  const lines = splitLines(block.stringContent);
  const kept = O.getOrElse(A.findLastIndex(lines, isContentLine), () => -1) + 1;

  block.stringContent = kept === 0 ? "" : `${A.join(A.take(lines, kept), "\n")}\n`;

  const lastSegment = block.segments[kept - 1];
  if (lastSegment !== undefined) {
    block.endOffset = lastSegment.sourceOffset + lastSegment.length;
    block.endLine = block.startLine + kept - 1;
  }
};

/** Record the trimmed info string as mdast's `lang` (first word) and `meta` (the rest). */
const recordInfo = (block: BlockNode, info: string): void => {
  O.match(Str.search(reInfoSeparator)(info), {
    onNone: () => {
      block.data.lang = unescapeString(info);
    },
    onSome: (wordEnd) => {
      block.data.lang = unescapeString(Str.slice(0, wordEnd)(info));
      // Trimming the info string makes the suffix after an internal
      // separator nonempty.
      block.data.meta = unescapeString(Str.trim(Str.slice(wordEnd)(info)));
    },
  });
};

/**
 * Split a fenced block's first line off as the info string, and the rest as
 * the literal content.
 *
 * **Details**
 *
 * mdast splits the info string into `lang` (the first word) and `meta` (the
 * rest); upstream keeps it whole as `info`. Each half is unescaped
 * separately, so a backslash-escaped space inside the language word does not
 * become a split point.
 */
const finalizeFenced = (block: BlockNode): void => {
  const content = block.stringContent;
  const firstLine = O.match(Str.indexOf("\n")(content), {
    onNone: () => {
      block.stringContent = "";
      return content;
    },
    onSome: (newlineAt) => {
      block.stringContent = Str.slice(newlineAt + 1)(content);
      return Str.slice(0, newlineAt)(content);
    },
  });
  const info = Str.trim(firstLine);
  if (info.length > 0) {
    recordInfo(block, info);
  }
};

/**
 * The length of the closing fence at the scan position, or `0` when the line
 * does not close `block`: at most three columns of indent, the opening
 * fence's character, and at least as long as the opening fence.
 */
const closingFenceLength = (scanner: BlockScanner, block: BlockNode): number => {
  const line = scanner.currentLine;
  if (scanner.indent > 3 || unitAt(line, scanner.nextNonspace) !== block.data.fenceChar) {
    return 0;
  }
  reClosingCodeFence.lastIndex = scanner.nextNonspace;
  const closing = reClosingCodeFence.exec(line);
  return closing === null || closing[0].length < (block.data.fenceLength ?? 3) ? 0 : closing[0].length;
};

/**
 * A fenced block continues until its closing fence; inside it, up to as many
 * leading spaces as the opening fence was indented by are skipped.
 */
const continueFenced = (scanner: BlockScanner, block: BlockNode): BlockContinueResult => {
  const closing = closingFenceLength(scanner, block);
  if (closing > 0) {
    // A closing fence ends the block and the line together.
    block.data.fenceClosed = true;
    scanner.setLastLineLength(scanner.offset + scanner.indent + closing);
    scanner.finalizeBlock(block, scanner.lineNumber);
    return 2;
  }

  let remaining = block.data.fenceOffset ?? 0;
  while (remaining > 0 && isSpaceOrTab(unitAt(scanner.currentLine, scanner.offset))) {
    scanner.advanceOffset(1, true);
    remaining -= 1;
  }
  return 0;
};

/** An indented block continues on an indented or blank line. */
const continueIndented = (scanner: BlockScanner): BlockContinueResult => {
  if (scanner.indent >= CODE_INDENT) {
    scanner.advanceOffset(CODE_INDENT, true);
    return 0;
  }
  if (scanner.blank) {
    scanner.advanceNextNonspace();
    return 0;
  }
  return 1;
};

/**
 * Collects code block lines verbatim without accepting child blocks.
 *
 * **Example** (Inspect code block containment)
 *
 * ```ts
 * import { codeConstruct } from "@beep/markdown/internal/blocks/code";
 *
 * console.log(codeConstruct.acceptsLines); // true
 * console.log(codeConstruct.canContain("paragraph")); // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const codeConstruct = new BlockConstruct("code", true, {
  canContain: containsNothing,
  continue: dual(
    2,
    (scanner: BlockScanner, block: BlockNode): BlockContinueResult =>
      block.data.isFenced === true ? continueFenced(scanner, block) : continueIndented(scanner)
  ),
  finalize: dual(2, (_scanner: BlockScanner, block: BlockNode): void => {
    if (block.data.isFenced === true) {
      finalizeFenced(block);
    } else {
      finalizeIndented(block);
    }
  }),
  materialize: leafMaterializer((block, context) => {
    const { isFenced, fenceChar, fenceClosed, fenceLength, lang, meta } = block.data;
    return trustedNode<Code>({
      type: "code",
      value: block.stringContent,
      position: context.position(block.startOffset, block.endOffset),
      ...O.getSomesStruct({ lang: O.fromUndefinedOr(lang) }),
      ...O.getSomesStruct({ meta: O.fromUndefinedOr(meta) }),
      ...(isFenced === true && fenceChar !== undefined ? { fenceChar } : {}),
      ...(isFenced === true && fenceLength !== undefined ? { fenceLength } : {}),
      ...(isFenced === true && fenceClosed !== true ? { unterminated: true } : {}),
    });
  }),
});

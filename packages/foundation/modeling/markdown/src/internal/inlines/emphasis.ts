// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `scanDelims` and `handleDelim`: the opening half of the emphasis algorithm.
// The closing half — `processEmphasis`, which walks the delimiter stack and
// builds the nodes — lives on the parser (`inlineParser.ts`), because a link
// closing runs it too, over its own span of the stack.
//
// Upstream's smart-punctuation arms (`'` and `"` becoming curly quotes) are
// deliberately not ported: the `smart` option is not offered, so those
// two characters never reach the delimiter stack at all.

import { $MarkdownId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Delimiter, InlineConstruct } from "../inlineTypes.ts";
import { unitAt } from "../patterns.ts";
import type { InlineNode } from "../inlineNode.ts";
import type { InlineScanner } from "../inlineTypes.ts";
import type { EmphasisChar } from "../nodes.ts";

const $I = $MarkdownId.create("internal/inlines/emphasis");

const C_ASTERISK = "*";
const C_UNDERSCORE = "_";

// The spec's punctuation class: ASCII punctuation plus the Unicode P and S
// categories.
const rePunctuation = /^[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~\p{P}\p{S}]/u;
const reUnicodeWhitespaceChar = /^\s/;
// Surrogate halves, tested one UTF-16 unit at a time (no `u` flag).
const reHighSurrogate = /^[\uD800-\uDBFF]$/;
const reLowSurrogate = /^[\uDC00-\uDFFF]$/;

/**
 * What a run of delimiters at the cursor can do.
 *
 * **Details**
 *
 * Exported because GFM strikethrough reuses this measurement verbatim:
 * cmark-gfm's `strikethrough.c` calls the same `scan_delimiters` the emphasis
 * algorithm does and reads the same two flanking flags out of it.
 *
 * **Example** (Build an opening delimiter run)
 *
 * ```ts
 * import { DelimiterRun } from "@beep/markdown/internal/inlines/emphasis"
 *
 * const run = DelimiterRun.make({ numdelims: 2, canOpen: true, canClose: false })
 * console.log(run.numdelims, run.canOpen, run.canClose) // 2 true false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DelimiterRun extends S.Opaque<DelimiterRun, { readonly brand: unique symbol }>()(
  S.Struct({
    numdelims: S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
      $I.annoteKey("DelimiterRun.numdelims", {
        description: "Positive integer length of the delimiter run in UTF-16 code units.",
      })
    ),
    canOpen: S.Boolean.pipe(
      $I.annoteKey("DelimiterRun.canOpen", { description: "Whether the run satisfies the opening flanking rule." })
    ),
    canClose: S.Boolean.pipe(
      $I.annoteKey("DelimiterRun.canClose", { description: "Whether the run satisfies the closing flanking rule." })
    ),
  }).pipe(
    $I.annoteSchema("DelimiterRun", {
      description: "The length and flanking capabilities shared by emphasis and strikethrough.",
    })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export declare namespace DelimiterRun {
  /**
   * The plain encoded fields of {@link DelimiterRun}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly canClose: boolean;
    readonly canOpen: boolean;
    readonly numdelims: number;
  }
}

/**
 * The code point that ends just before `index`, or `"\n"` at the start of the
 * subject — the spec treats the start of a line as whitespace.
 */
const charBefore = (subject: string, index: number): string => {
  if (index === 0) {
    return "\n";
  }
  const unit = unitAt(subject, index - 1);
  return index > 1 && reLowSurrogate.test(unit) && reHighSurrogate.test(unitAt(subject, index - 2))
    ? Str.slice(index - 2, index)(subject)
    : unit;
};

/**
 * The code point that starts at `index`, or `"\n"` at the end of the subject
 * — the end of a line is whitespace too.
 */
const charAfter = (subject: string, index: number): string => {
  const unit = unitAt(subject, index);
  if (unit === "") {
    return "\n";
  }
  return reHighSurrogate.test(unit) && reLowSurrogate.test(unitAt(subject, index + 1))
    ? Str.slice(index, index + 2)(subject)
    : unit;
};

/** How many `cc` units run from `start`. */
const runLength = (subject: string, start: number, cc: string): number => {
  let length = 0;
  while (unitAt(subject, start + length) === cc) {
    length += 1;
  }
  return length;
};

/** The spec's left- and right-flanking tests for a run between `before` and `after`. */
const flankingOf = (before: string, after: string) => {
  const afterIsWhitespace = reUnicodeWhitespaceChar.test(after);
  const afterIsPunctuation = rePunctuation.test(after);
  const beforeIsWhitespace = reUnicodeWhitespaceChar.test(before);
  const beforeIsPunctuation = rePunctuation.test(before);
  return {
    left: !afterIsWhitespace && (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation),
    right: !beforeIsWhitespace && (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation),
    beforeIsPunctuation,
    afterIsPunctuation,
  };
};

/** Whether a run of `cc` with these flanks can open and close. */
const capabilitiesOf = (
  cc: string,
  flanks: ReturnType<typeof flankingOf>
): { readonly canOpen: boolean; readonly canClose: boolean } => {
  if (cc !== C_UNDERSCORE) {
    return { canOpen: flanks.left, canClose: flanks.right };
  }
  // `_` is stricter than `*`: intraword emphasis is not allowed.
  return {
    canOpen: flanks.left && (!flanks.right || flanks.beforeIsPunctuation),
    canClose: flanks.right && (!flanks.left || flanks.afterIsPunctuation),
  };
};

/**
 * Measure the delimiter run at the cursor and decide whether it can open or
 * close emphasis, per the spec's left- and right-flanking rules. Leaves the
 * cursor where it found it.
 *
 * **Details**
 *
 * The `_` arm is the only character-specific rule here, so `~` (which follows
 * `*`'s rules) reuses this as it stands.
 *
 * **Example** (Prepare an asterisk run scanner)
 *
 * ```ts
 * import { scanDelims } from "@beep/markdown/internal/inlines/emphasis"
 *
 * const scanAsterisks = scanDelims("*")
 * console.log(typeof scanAsterisks) // function
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanDelims: {
  (scanner: InlineScanner, cc: string): O.Option<DelimiterRun>;
  (cc: string): (scanner: InlineScanner) => O.Option<DelimiterRun>;
} = dual(2, (scanner: InlineScanner, cc: string): O.Option<DelimiterRun> => {
  const numdelims = runLength(scanner.subject, scanner.pos, cc);
  if (numdelims === 0) {
    return O.none();
  }
  // The scanner counts UTF-16 units; flanking classifies Unicode code points.
  const flanks = flankingOf(
    charBefore(scanner.subject, scanner.pos),
    charAfter(scanner.subject, scanner.pos + numdelims)
  );
  return DelimiterRun.makeOption({ numdelims, ...capabilitiesOf(cc, flanks) });
});

/**
 * Consume the measured run at the cursor as literal text and, when `admit`
 * accepts it, push it onto the delimiter stack.
 *
 * **Details**
 *
 * The shared half of emphasis's `handleDelim` and strikethrough's `match`:
 * the run becomes a text node either way, because a run that never pairs has
 * to survive as the characters it is.
 *
 * **Example** (Push an asterisk run)
 *
 * ```ts
 * import { pushDelimiterRun } from "@beep/markdown/internal/inlines/emphasis"
 *
 * console.log(typeof pushDelimiterRun) // function
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const pushDelimiterRun: {
  (scanner: InlineScanner, cc: string, run: DelimiterRun, admit: boolean): InlineNode;
  (cc: string, run: DelimiterRun, admit: boolean): (scanner: InlineScanner) => InlineNode;
} = dual(4, (scanner: InlineScanner, cc: string, run: DelimiterRun, admit: boolean): InlineNode => {
  const startpos = scanner.pos;
  scanner.pos += run.numdelims;
  const node = scanner.appendText(Str.slice(startpos, scanner.pos)(scanner.subject), startpos, scanner.pos);
  if (admit) {
    const delimiter = new Delimiter(cc, node, run.numdelims, run.canOpen, run.canClose, scanner.delimiters);
    if (delimiter.previous !== undefined) {
      delimiter.previous.next = delimiter;
    }
    scanner.delimiters = delimiter;
  }
  return node;
});

const markerCharOf = (cc: string): EmphasisChar => (cc === C_UNDERSCORE ? "_" : "*");

/**
 * Consume a delimiter run as literal text and, when it could open or close
 * emphasis, push it onto the delimiter stack for `processEmphasis` to pair up.
 */
const handleDelim: {
  (scanner: InlineScanner, cc: string): boolean;
  (cc: string): (scanner: InlineScanner) => boolean;
} = dual(2, (scanner: InlineScanner, cc: string): boolean => {
  // The construct passes the current peek character, so at least one delimiter matches.
  const run = O.getOrThrow(scanDelims(scanner, cc));
  const node = pushDelimiterRun(scanner, cc, run, run.canOpen || run.canClose);
  node.data.markerChar = markerCharOf(cc);
  return true;
});

/**
 * Consumes `*` and `_` runs for emphasis and strong emphasis pairing.
 *
 * **Example** (Register both emphasis markers)
 *
 * ```ts
 * import { emphasisConstruct } from "@beep/markdown/internal/inlines/emphasis"
 *
 * console.log(emphasisConstruct.triggers.join("")) // *_
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const emphasisConstruct = new InlineConstruct("emphasis", [C_ASTERISK, C_UNDERSCORE], (scanner) =>
  handleDelim(scanner, scanner.peek())
);

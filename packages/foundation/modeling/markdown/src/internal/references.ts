// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// The reference-parsing primitives from `lib/inlines.js`: the subject scanner
// (`match`/`peek`/`spnl`), `parseLinkLabel`, `parseLinkDestination`,
// `parseLinkTitle`, `normalizeReference` and `parseReference`.
//
// They live in their own leaf rather than inside the block construct that
// needs them first, because the inline pass (Tasks 8 and 9) parses inline
// links and images with exactly these functions — a link destination is the
// same grammar wherever it appears.
//
// Port notes, two changes from upstream:
//
// 1. `parseLinkDestination` returns the UNESCAPED, un-percent-encoded
//    destination. Upstream applies `normalizeURI` here so its renderer can
//    emit the value verbatim; mdast defines `url` as the decoded destination,
//    so the encoding moves to the renderer (the test writer does it, and any
//    consumer rendering HTML must too).
// 2. `parseReference` returns the parsed data instead of mutating a refmap
//    object. Definitions become nodes in this port, so the caller decides
//    what to do with the result, and the map is keyed through a real `Map`.
//
// `ReferenceScanner` is mutable engine state, a concrete class (D-42); the
// parsed definition that leaves this module is a schema.

import { $MarkdownId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { matchFrom, stickyOf, unitAt } from "./patterns.ts";
import { unescapeString } from "./unescape.ts";

const $I = $MarkdownId.create("internal/references");

const ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]";
const ESCAPED_CHAR = `\\\\${ESCAPABLE}`;

const reLinkTitle = stickyOf(
  new RegExp(
    `^(?:"(${ESCAPED_CHAR}|\\\\[^\\\\]|[^\\\\"\\x00])*"` +
      `|'(${ESCAPED_CHAR}|\\\\[^\\\\]|[^\\\\'\\x00])*'` +
      `|\\((${ESCAPED_CHAR}|\\\\[^\\\\]|[^\\\\()\\x00])*\\))`
  )
);

// Upstream spells the control characters in these two classes as `\x00` and
// `\x0b\x0c\x0d`; the equivalent standard escapes are the same characters
// written the way the linter accepts.
const reLinkDestinationBraces = stickyOf(/^(?:<(?:[^<>\n\\\0]|\\.)*>)/);
const reEscapable = new RegExp(`^${ESCAPABLE}`);
const reSpnl = stickyOf(/^ *(?:\n *)?/);
const reSpaceAtEndOfLine = stickyOf(/^ *(?:\n|$)/);
const reLinkLabel = stickyOf(/^\[(?:[^\\[\]]|\\.){0,1000}\]/s);
const reLabelWhitespace = /[ \t\r\n]+/g;

/**
 * The characters that end a bare link destination: whitespace, and `""` for
 * the end of the subject.
 *
 * **Details**
 *
 * The walk tests every character it passes. Upstream spells the whitespace
 * test `reWhitespaceChar.exec(fromCodePoint(c))`, which allocates a string and
 * runs a regex per character — in a scan that is already O(n) per attempt on
 * an unterminated destination, that constant is the difference between
 * seconds and minutes. Here it is one property read on a read-only table.
 */
const DESTINATION_STOPS: Readonly<Record<string, true>> = {
  "": true,
  " ": true,
  "\t": true,
  "\n": true,
  "\v": true,
  "\f": true,
  "\r": true,
};

/**
 * The most `(` a bare link destination may hold open at once.
 *
 * **Details**
 *
 * cmark's `MAX_LINK_DEST_PARENS` bound in `manual_scan_link_url`, and the
 * limit the spec explicitly sanctions ("Implementations may impose limits on
 * parentheses nesting to avoid performance issues, but at least three levels
 * of nesting should be supported"). Without it the bare-destination walk is
 * the engine's one quadratic: on `"[a](b".repeat(n)` there is no whitespace
 * and no unbalanced `)` to stop at, so every failed inline-link attempt
 * scanned to the end of the subject — O(n) per `]`, O(n^2) overall. With the
 * cap a failed attempt stops at the 33rd `(`, a constant distance, and the
 * pathological suite's "unclosed links B" runs linear. commonmark.js 0.31.2
 * has no such cap and shares the quadratic; the C reference is the authority
 * here.
 */
const MAX_LINK_DESTINATION_PARENS = 32;

/**
 * A run of bare-destination characters the walk has nothing to decide about:
 * no whitespace, no paren, no backslash.
 *
 * **Details**
 *
 * Sticky and matched at the cursor, so the walk jumps over ordinary text in
 * one native scan and only steps character by character at the characters
 * that change its state. On `"[a](b".repeat(n)` every failed attempt still
 * stops at the 33rd `(`, but each step between parens is one regex call
 * instead of a read per character.
 */
const reDestinationRun = /[^ \t\n\v\f\r()\\]+/y;

const C_BACKSLASH = "\\";

const C_COLON = ":";
const C_LESSTHAN = "<";
const C_OPEN_PAREN = "(";
const C_CLOSE_PAREN = ")";

/** The `(` nesting after `char` — `-1` for a `)` that closes nothing. */
const nestingAfter = (char: string, openParens: number): number => {
  if (char === C_OPEN_PAREN) {
    return openParens + 1;
  }
  return char === C_CLOSE_PAREN ? openParens - 1 : openParens;
};

/**
 * A cursor over a subject string, with the handful of primitives upstream's
 * inline parser is built from.
 *
 * **Example** (Inspect a fresh cursor)
 *
 * ```ts
 * import { ReferenceScanner } from "@beep/markdown/internal/references";
 *
 * const scanner = new ReferenceScanner("[label]");
 * console.log(scanner.pos, scanner.peek()) // 0 [
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export class ReferenceScanner {
  /**
   * Tracks the next character to scan, starting at the beginning of the subject.
   *
   * **Example** (Inspect the cursor after consuming a label)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner("[x]");
   * scanner.parseLinkLabel();
   * console.log(scanner.pos) // 3
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  pos = 0;

  /**
   * Retains the complete input while the cursor advances through it.
   *
   * **Example** (Read the unchanged subject)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner("[x]");
   * scanner.parseLinkLabel();
   * console.log(scanner.subject) // [x]
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  readonly subject: string;
  constructor(subject: string) {
    this.subject = subject;
  }

  /**
   * The UTF-16 unit at the cursor as a one-character string, or `""` at the
   * end of the subject.
   *
   * **Example** (Read past the subject)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner("a");
   * scanner.pos = 1;
   * console.log(scanner.peek() === "") // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  peek(): string {
    return unitAt(this.subject, this.pos);
  }

  /**
   * Match `pattern` at the cursor, advancing past it on success.
   *
   * **Details**
   *
   * Sticky rather than upstream's slice-then-match: every pattern here is
   * anchored, and slicing the subject per attempt is quadratic on a large
   * one (`patterns.ts`).
   *
   * **Example** (Advance after a successful match)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner("abc:");
   * console.log(scanner.match(/^[a-z]+/), scanner.pos) // abc 3
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  match(pattern: RegExp): string | undefined {
    return matchFrom(this, pattern);
  }

  /**
   * Consume optional spaces and up to one line ending.
   *
   * **Example** (Consume spaces and one line ending)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner("  \n label");
   * scanner.spnl();
   * console.log(scanner.pos) // 4
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  spnl(): void {
    this.match(reSpnl);
  }

  /**
   * The length of the link label at the cursor, or `0` if there is none.
   *
   * **Example** (Measure a bracketed label)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner("[label]: /guide");
   * console.log(scanner.parseLinkLabel(), scanner.pos) // 7 7
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  parseLinkLabel(): number {
    const found = this.match(reLinkLabel);
    return found === undefined || found.length > 1001 ? 0 : found.length;
  }

  /**
   * The link destination at the cursor, unescaped, or `undefined` if there
   * is none. Never percent-encoded (see the port notes).
   *
   * **Example** (Read a braced destination)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner("<guide page>");
   * console.log(scanner.parseLinkDestination()) // guide page
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  parseLinkDestination(): string | undefined {
    const braced = this.match(reLinkDestinationBraces);
    if (braced !== undefined) {
      return unescapeString(Str.slice(1, -1)(braced));
    }

    if (this.peek() === C_LESSTHAN) {
      return undefined;
    }

    const start = this.pos;
    const openParens = this.walkBareDestination();
    if (openParens !== 0 || (this.pos === start && this.peek() !== C_CLOSE_PAREN)) {
      return undefined;
    }
    return unescapeString(Str.slice(start, this.pos)(this.subject));
  }

  /**
   * Advance over a bare destination, stopping at whitespace, the end, or a
   * `)` that closes nothing; return how many `(` are still open, or `-1`
   * once more than {@link MAX_LINK_DESTINATION_PARENS} are.
   *
   * @since 0.0.0
   */
  private walkBareDestination(): number {
    let openParens = 0;
    for (let char = this.skipDestinationRun(); DESTINATION_STOPS[char] !== true; char = this.skipDestinationRun()) {
      const nesting = nestingAfter(char, openParens);
      if (nesting < 0) {
        // A `)` that closes nothing ends the destination.
        return 0;
      }
      if (nesting > MAX_LINK_DESTINATION_PARENS) {
        return -1;
      }
      openParens = nesting;
      this.pos += char === C_BACKSLASH && reEscapable.test(unitAt(this.subject, this.pos + 1)) ? 2 : 1;
    }
    return openParens;
  }

  /**
   * Advance over ordinary destination text and return its stopping character.
   *
   * **Details**
   * Internal metering seam: wrapping this step counts both skipped UTF-16 units and
   * delimiter visits without retaining subjects or changing the destination grammar.
   *
   * **Example** (Skip ordinary destination text)
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   * const scanner = new ReferenceScanner("path(nested)");
   * scanner.skipDestinationRun() // => "("
   * scanner.pos // => 4
   * ```
   * @category parsing
   * @since 0.0.0
   */
  skipDestinationRun(): string {
    reDestinationRun.lastIndex = this.pos;
    if (reDestinationRun.test(this.subject)) {
      this.pos = reDestinationRun.lastIndex;
    }
    return this.peek();
  }

  /**
   * The link title at the cursor, quotes stripped and unescaped.
   *
   * **Example** (Strip title quotes)
   *
   * ```ts
   * import { ReferenceScanner } from "@beep/markdown/internal/references";
   *
   * const scanner = new ReferenceScanner('"Guide title"');
   * console.log(scanner.parseLinkTitle()) // Guide title
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  parseLinkTitle(): string | undefined {
    const title = this.match(reLinkTitle);
    return title === undefined ? undefined : unescapeString(Str.slice(1, -1)(title));
  }
}

/**
 * Case-fold a bare label: trim, collapse internal whitespace, fold case.
 *
 * **Details**
 *
 * The `toLowerCase().toUpperCase()` pair is upstream's Unicode case-folding
 * trick, not redundancy — it is what makes `ẞ` and `ß` the same label.
 *
 * Split out of {@link normalizeReference} because GFM footnote labels are the
 * same fold applied to a label that never carried brackets to strip: this is
 * cmark-gfm's `normalize_map_label`, which its footnote map and its link
 * refmap both call.
 *
 * **Example** (Fold a bare Unicode label)
 *
 * ```ts
 * import { normalizeLabelText } from "@beep/markdown/internal/references";
 *
 * console.log(normalizeLabelText("  Straße \t guide  ")) // STRASSE GUIDE
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeLabelText = (label: string): string =>
  Str.toUpperCase(Str.toLowerCase(Str.replace(reLabelWhitespace, " ")(Str.trim(label))));

/**
 * commonmark.js `normalizeReference`: strip the brackets, then case-fold what
 * is left.
 *
 * **Example** (Normalize a bracketed reference)
 *
 * ```ts
 * import { normalizeReference } from "@beep/markdown/internal/references";
 *
 * console.log(normalizeReference("[  Guide  Page  ]")) // GUIDE PAGE
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeReference = (rawLabel: string): string =>
  normalizeLabelText(Str.slice(1, rawLabel.length - 1)(rawLabel));

/**
 * A link reference definition, parsed but not yet placed in the tree.
 *
 * **Example** (Validate ParsedReference data)
 *
 * ```ts
 * import { ParsedReference } from "@beep/markdown/internal/references";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ParsedReference)({ key: "GUIDE", identifier: "guide", label: "Guide", url: "/guide", length: 15 })); // true
 * console.log(ParsedReference.make({ key: "GUIDE", identifier: "guide", label: "Guide", url: "/guide", length: 15 }).url); // /guide
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParsedReference extends S.Opaque<ParsedReference, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String.pipe(
      $I.annoteKey("ParsedReference.key", {
        description: "Case-folded lookup key obtained by normalizing the raw label.",
      })
    ),
    identifier: S.String.pipe(
      $I.annoteKey("ParsedReference.identifier", {
        description: "Normalized label in lowercase for mdast's identifier.",
      })
    ),
    label: S.String.pipe(
      $I.annoteKey("ParsedReference.label", { description: "Raw label text with its enclosing brackets stripped." })
    ),
    url: S.String.pipe(
      $I.annoteKey("ParsedReference.url", { description: "Decoded link destination before renderer URI encoding." })
    ),
    title: S.optionalKey(S.String).pipe(
      $I.annoteKey("ParsedReference.title", {
        description: "Decoded link title, omitted when the definition carries none.",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("ParsedReference.length", {
        description: "Number of UTF-16 code units consumed from the definition source.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ParsedReference", {
      description: "A parsed link reference definition before its placement in the markdown tree.",
    })
  )
) {}

/**
 * The encoded (plain) shape of {@link ParsedReference}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ParsedReference {
  /**
   * The plain encoded fields of {@link ParsedReference}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly identifier: string;
    readonly key: string;
    readonly label: string;
    readonly length: number;
    readonly title?: string;
    readonly url: string;
  }
}

/**
 * The optional title after a definition's destination, provided the
 * definition then ends its line; `undefined` when it does not.
 *
 * **Details**
 *
 * A title that does not end the line is discarded and the destination alone
 * is retried — that is still a legal definition.
 */
const definitionTail = (scanner: ReferenceScanner): { readonly title: string | undefined } | undefined => {
  const beforeTitle = scanner.pos;
  scanner.spnl();
  const title = scanner.pos === beforeTitle ? undefined : scanner.parseLinkTitle();
  if (title !== undefined && scanner.match(reSpaceAtEndOfLine) !== undefined) {
    return { title };
  }
  scanner.pos = beforeTitle;
  return scanner.match(reSpaceAtEndOfLine) === undefined ? undefined : { title: undefined };
};

/**
 * Parse a link reference definition at the start of `text`.
 *
 * **Details**
 *
 * `None` when `text` does not begin with one — which is not an error: the
 * text is simply paragraph content.
 *
 * **Example** (Distinguish a definition from paragraph content)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { parseReference } from "@beep/markdown/internal/references";
 *
 * console.log(O.getOrUndefined(parseReference('[Guide]: /guide "Read me"'))?.title) // Read me
 * console.log(O.isNone(parseReference("paragraph text"))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseReference = (text: string): O.Option<ParsedReference> => {
  const scanner = new ReferenceScanner(text);

  const labelLength = scanner.parseLinkLabel();
  if (labelLength === 0 || scanner.peek() !== C_COLON) {
    return O.none();
  }
  scanner.pos += 1;

  scanner.spnl();
  const url = scanner.parseLinkDestination();
  const tail = url === undefined ? undefined : definitionTail(scanner);
  if (url === undefined || tail === undefined) {
    return O.none();
  }

  const rawLabel = Str.slice(0, labelLength)(text);
  const key = normalizeReference(rawLabel);
  if (key === "") {
    // A label must hold at least one non-whitespace character.
    return O.none();
  }

  return ParsedReference.makeOption({
    key,
    identifier: Str.toLowerCase(key),
    label: Str.slice(1, -1)(rawLabel),
    url,
    ...O.getSomesStruct({ title: O.fromUndefinedOr(tail.title) }),
    length: scanner.pos,
  });
};

import { $YamlId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as Str from "effect/String";

// Comment-fidelity helpers shared by the block and flow composers: blank-line
// detection between source spans, and immutable node rebuilds that merge the
// comment field triple (`commentBefore` / `comment` / `spaceBefore`) onto an
// already-composed node.
//
// Attribution semantics (the NODE-LEVEL model, prior art: the `yaml` npm
// package). Comments live on NODES; `YamlPair` carries none. An own-line
// comment attaches FORWARD to the following entry's KEY node as
// `commentBefore`; a comment on the same line as the end of an entry attaches
// to that entry's VALUE node as the trailing `comment`; own-line comments
// after a collection's last entry become the collection's own `comment` when
// at (or beyond) the collection's content column and escape to the outer
// scope when shallower; `spaceBefore` is set on the key node when a blank
// line precedes the entry (and its `commentBefore` block); blank lines
// within/after a comment run embed as extra `\n`s in the joined string;
// comment text is the RAW post-`#` slice (see `rawCommentText`).
//
// Two node slots per entry rather than one pair slot is the whole point: a
// key-line comment (`a: # kc`) and a value's trailing comment are different
// fields, so neither has to relocate onto the other's line.
//
// ── Recorded divergences from the reference `yaml` npm package ─────────────
//
// The one place the divergences live; each is deliberate, and the emitted
// bytes remain reparse-stable in every case. The list used to have six
// entries. Four of them — pair-level placement, the alias drop, the
// multi-line complex-key drop, and the document field naming — were all
// symptoms of storing comments on the pair, and went away with the move to
// node-level fields rather than being patched one at a time.
//
// 1. ABSENT-value placement. A trailing comment on an entry with no value
//    (`a: # kc`) lands on the KEY node; the reference materializes `a:` as
//    `Scalar(null)` and puts it on that. Our `value` is `null` for an absent
//    value, and making it always-a-node for parity would silently break every
//    consumer's `pair.value === null` check at RUNTIME rather than at compile
//    time. The emitted bytes are identical, so this is invisible to a
//    formatter and visible only to a consumer reading the field.
// 2. PRE-`#` spacing normalizes to one space on trailing comments
//    (`a: 1   # t` → `a: 1 # t`) — the post-`#` storage form cannot carry
//    it. The reference behaves identically.
// 3. MULTI-document `...` trailers. A comment after a `...` marker in a
//    multi-document stream may attach to the following document's header
//    rather than the preceding document's trailer, depending on CST document
//    splitting.

import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import type { YamlNode } from "../../YamlNode.ts";

const isYamlMap = S.is(YamlMap);
const isYamlScalar = S.is(YamlScalar);
const isYamlSeq = S.is(YamlSeq);
const $I = $YamlId.create("internal/composer/comments");

/**
 * The comment field triple accepted by {@link withCommentFields}.
 *
 * **Example** (Decode optional node comments)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CommentFields } from "@beep/yaml/internal/composer/comments"
 *
 * const fields = S.decodeUnknownSync(CommentFields)({ commentBefore: " heading", spaceBefore: true })
 * console.log(fields.commentBefore, fields.spaceBefore) //  heading true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CommentFields extends S.Opaque<CommentFields, { readonly brand: unique symbol }>()(
  S.Struct({
    commentBefore: S.String.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("CommentFields.commentBefore", { description: "Own-line comments leading the node." })
    ),
    comment: S.String.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("CommentFields.comment", { description: "Comments trailing the node." })
    ),
    spaceBefore: S.Boolean.pipe(
      S.optionalKey,
      S.mutableKey,
      $I.annoteKey("CommentFields.spaceBefore", { description: "A stylistic blank line preceding the node." })
    ),
  }).pipe($I.annoteSchema("CommentFields", { description: "Optional node comment fields merged during composition." }))
) {}

/**
 * The leading comment fields for an item: its joined `commentBefore` (when
 * any) and `spaceBefore` (only when set).
 *
 * **Example** (Build leading fields)
 *
 * ```ts
 * import { leadingCommentFields } from "@beep/yaml/internal/composer/comments"
 *
 * const fields = leadingCommentFields(" head", false)
 * console.log(fields.commentBefore, Object.hasOwn(fields, "spaceBefore")) //  head false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const leadingCommentFields = (
  commentBefore: string | undefined,
  ...[spaceBefore]: [spaceBefore: boolean]
): CommentFields =>
  CommentFields.make({
    ...O.getSomesStruct({ commentBefore: O.fromUndefinedOr(commentBefore) }),
    ...(spaceBefore ? { spaceBefore: true } : {}),
  });

/**
 * An own-line comment awaiting attribution to the item that follows it.
 *
 * **Example** (Hold a pending comment)
 *
 * ```ts
 * import { PendingComment } from "@beep/yaml/internal/composer/comments"
 *
 * const pending = PendingComment.make({ text: " note", offset: 4, blankAbove: false })
 * console.log(pending.text) //  note
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PendingComment extends S.Opaque<PendingComment, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.mutableKey(S.String).pipe(
      $I.annoteKey("PendingComment.text", { description: "Raw comment text awaiting attribution." })
    ),
    offset: S.mutableKey(S.Finite).pipe(
      $I.annoteKey("PendingComment.offset", { description: "Source offset of the pending comment." })
    ),
    blankAbove: S.mutableKey(S.Boolean).pipe(
      $I.annoteKey("PendingComment.blankAbove", { description: "Whether a blank line precedes this comment." })
    ),
  }).pipe(
    $I.annoteSchema("PendingComment", {
      description: "Own-line comment awaiting attribution, shared by block and flow composition.",
    })
  )
) {}

/**
 * Joins a run of pending comments: `\n` between lines, and an extra `\n` for
 * each comment with a blank line above it. `None` for an empty run.
 *
 * **Example** (Join a comment run with an embedded blank)
 *
 * ```ts
 * import { joinPendingComments, PendingComment } from "@beep/yaml/internal/composer/comments"
 * import * as O from "effect/Option"
 *
 * const joined = joinPendingComments([
 *   PendingComment.make({ text: " a", offset: 0, blankAbove: false }),
 *   PendingComment.make({ text: " b", offset: 5, blankAbove: true }),
 * ])
 * console.log(JSON.stringify(O.getOrNull(joined))) // " a\n\n b"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const joinPendingComments = (parts: ReadonlyArray<PendingComment>): O.Option<string> => {
  const [first, ...rest] = parts;
  if (first === undefined) return O.none();
  let out = first.text;
  for (const part of rest) {
    out += part.blankAbove ? `\n\n${part.text}` : `\n${part.text}`;
  }
  return O.some(out);
};

/**
 * True when the source text between `start` (exclusive of its line) and `end`
 * contains at least one blank line (a newline followed, after optional
 * horizontal whitespace, by another newline).
 *
 * **Example** (Detect a blank line between source spans)
 *
 * ```ts
 * import { hasBlankLineBetween } from "@beep/yaml/internal/composer/comments"
 *
 * const text = "a: 1\n \n b: 2"
 * console.log(hasBlankLineBetween(text, 4, 8)) // true
 * console.log(hasBlankLineBetween(text, 0, 4)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasBlankLineBetween: {
  (start: number, end: number): (text: string) => boolean;
  (text: string, start: number, end: number): boolean;
} = dual(3, (text: string, start: number, end: number): boolean => {
  if (start < 0) return false;
  const gap = Str.slice(Math.max(0, start), Math.max(0, end))(text);
  return /(?:\r\n|\r(?!\n)|\n)[ \t]*(?:\r\n|\r|\n)/.test(gap);
});

/**
 * True when there is no line break between `start` and `end` in `text`.
 *
 * **Example** (Compare spans across a line break)
 *
 * ```ts
 * import { sameLineSpan } from "@beep/yaml/internal/composer/comments"
 *
 * const text = "a: 1\nb: 2"
 * console.log(sameLineSpan(text, 0, 4)) // true
 * console.log(sameLineSpan(text, 0, 6)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const sameLineSpan: {
  (start: number, end: number): (text: string) => boolean;
  (text: string, start: number, end: number): boolean;
} = dual(3, (text: string, start: number, end: number): boolean => {
  if (start < 0) return false;
  return !/[\r\n]/.test(Str.slice(Math.max(0, start), Math.max(0, end))(text));
});

/**
 * The index of the last character before `offset` that is not a space or
 * tab — nor, when `acrossLines` holds, a line break. `-1` when the scan runs
 * off the start of the text.
 *
 * **Example** (Scan back past blanks)
 *
 * ```ts
 * import { lastNonBlankBefore } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(lastNonBlankBefore("a:\n  b", 5, false), lastNonBlankBefore("a:\n  b", 5, true)) // 2 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lastNonBlankBefore = (
  text: string,
  ...[offset, acrossLines]: [offset: number, acrossLines: boolean]
): number => {
  let i = offset - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || (acrossLines && (ch === "\n" || ch === "\r"))) {
      i--;
      continue;
    }
    return i;
  }
  return -1;
};

/**
 * True when only horizontal whitespace precedes `offset` on its line — i.e.
 * the token at `offset` starts its own line.
 *
 * **Details**
 *
 * Purely local, so it stays
 * correct even when a preceding node's span over-extends past line ends.
 *
 * **Example** (Distinguish leading and trailing comments)
 *
 * ```ts
 * import { isOwnLineAt } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(isOwnLineAt("  # heading", 2)) // true
 * console.log(isOwnLineAt("a: 1 # tail", 5)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isOwnLineAt: {
  (offset: number): (text: string) => boolean;
  (text: string, offset: number): boolean;
} = dual(2, (text: string, offset: number): boolean => {
  const i = lastNonBlankBefore(text, offset, false);
  return i < 0 || text[i] === "\n" || text[i] === "\r";
});

/**
 * True when the only thing before `offset` on its line is a block indicator —
 * `?`, `:` or `-` — plus whitespace.
 *
 * **Details**
 *
 * Such a comment sits on an indicator line
 * with its node BELOW, so it leads that node rather than trailing whatever
 * came before (`? # c` / ` - seq1`). Without this, the `? ` prefix makes the
 * comment look like a trailing comment on the previous entry.
 *
 * **Example** (Recognize a comment following an indicator)
 *
 * ```ts
 * import { isAfterIndicatorOnly } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(isAfterIndicatorOnly("? # key comment", 2)) // true
 * console.log(isAfterIndicatorOnly("a: # value comment", 3)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isAfterIndicatorOnly: {
  (offset: number): (text: string) => boolean;
  (text: string, offset: number): boolean;
} = dual(2, (text: string, offset: number): boolean => {
  const indicatorAt = skipHorizontalSpaceBackward(text, offset - 1);
  if (indicatorAt < 0 || !isBlockIndicatorChar(text[indicatorAt])) return false;
  const beforeIndicator = skipHorizontalSpaceBackward(text, indicatorAt - 1);
  return beforeIndicator < 0 || isLineBreakChar(text[beforeIndicator]);
});

/** Index of the last non-space/tab character at or before `from` (or `-1`). */
const skipHorizontalSpaceBackward = (text: string, from: number): number => {
  let i = from;
  while (i >= 0 && (text[i] === " " || text[i] === "\t")) i--;
  return i;
};

const isBlockIndicatorChar = (ch: string | undefined): boolean => ch === "?" || ch === "-" || ch === ":";

const isLineBreakChar = (ch: string | undefined): boolean => ch === "\n" || ch === "\r";

/**
 * True when the line immediately above the line containing `offset` is blank
 * (empty or horizontal whitespace only).
 *
 * **Details**
 *
 * Purely local — see
 * {@link isOwnLineAt} for why span-based gap checks are not used.
 *
 * **Example** (Inspect the line preceding a comment)
 *
 * ```ts
 * import { hasBlankLineAbove } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(hasBlankLineAbove("a: 1\n \n# next", 8)) // true
 * console.log(hasBlankLineAbove("a: 1\n# next", 5)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasBlankLineAbove: {
  (offset: number): (text: string) => boolean;
  (text: string, offset: number): boolean;
} = dual(2, (text: string, offset: number): boolean => blankLineAboveStart(text, offset) >= 0);

/**
 * Start offset of the blank line immediately above the line containing
 * `offset`, or `-1` when that line is not blank. The offset form of
 * {@link hasBlankLineAbove}, for callers that must locate the blank line
 * (e.g. to test whether it falls inside a preceding scalar token's span).
 *
 * **Example** (Locate a preceding stylistic blank line)
 *
 * ```ts
 * import { blankLineAboveStart } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(blankLineAboveStart("a: 1\n \n# next", 8)) // 5
 * console.log(blankLineAboveStart("a: 1\n# next", 5)) // -1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const blankLineAboveStart: {
  (offset: number): (text: string) => number;
  (text: string, offset: number): number;
} = dual(2, (text: string, offset: number): number => {
  const before = Math.max(0, offset - 1);
  const lineBreak = lineBreakBefore(text, before);
  if (lineBreak < 0) return -1;
  const prevEnd = text[lineBreak] === "\n" && text[lineBreak - 1] === "\r" ? lineBreak - 1 : lineBreak;
  const prevBreak = prevEnd > 0 ? lineBreakBefore(text, prevEnd - 1) : -1;
  const prevLine = Str.slice(prevBreak + 1, prevEnd)(text);
  return Str.isEmpty(Str.trim(prevLine)) ? prevBreak + 1 : -1;
});

/**
 * The deepest trailing scalar reached by descending last-child edges from
 * `node` (a map's last pair's value, a seq's last item) — the node whose
 * token span a textually-following blank line could fall inside.
 */
function deepestTrailingScalar(node: YamlNode): YamlScalar | undefined {
  let current: YamlNode | undefined = node;
  while (current !== undefined) {
    if (isYamlScalar(current)) return current;
    if (!isYamlMap(current) && !isYamlSeq(current)) return undefined; // alias — carries no chomp
    current = lastCollectionChild(current);
  }
  return undefined;
}

/** A map's last pair's value (or key when value-less), or a seq's last item. */
function lastCollectionChild(node: YamlMap | YamlSeq): YamlNode | undefined {
  if (isYamlSeq(node)) return node.items[node.items.length - 1];
  const last = node.items[node.items.length - 1];
  return last === undefined ? undefined : (last.value ?? last.key);
}

/**
 * True when the blank line immediately above `offset` is CONTENT of the
 * preceding keep-chomp block scalar, not a stylistic blank.
 *
 * **Details**
 *
 * Under `+`
 * chomping the trailing line breaks are part of the scalar's VALUE (the
 * composer already stores them there), so recording the same blank line as
 * `spaceBefore` (or a leading-blank embed on a terminal comment run) would
 * double-count it: emission renders both the kept newline and the stylistic
 * blank, growing the document on every format pass. Clip/strip scalars are
 * deliberately NOT excluded — their emission drops the trailing blank from
 * the value, so the `spaceBefore` capture is exactly what re-creates it.
 *
 * `prev` is the last composed node before `offset` (a pair's value, a seq
 * item); the check descends to its deepest trailing scalar and requires the
 * blank line to start inside that scalar's token span.
 *
 * **Example** (Identify a blank line owned by a keep-chomp scalar)
 *
 * ```ts
 * import { blankAboveIsKeepChompContent } from "@beep/yaml/internal/composer/comments"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const text = "a: |+\n  value\n\nb: 2"
 * const scalar = YamlScalar.make({
 *   value: "value\n\n", style: "block-literal", chomp: "keep", offset: 3, length: 12
 * })
 * console.log(blankAboveIsKeepChompContent(text, 15, scalar)) // true
 * console.log(blankAboveIsKeepChompContent(text, 15, undefined)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const blankAboveIsKeepChompContent: {
  (offset: number, prev: YamlNode | undefined): (text: string) => boolean;
  (text: string, offset: number, prev: YamlNode | undefined): boolean;
} = dual(3, (text: string, offset: number, prev: YamlNode | undefined): boolean => {
  if (prev === undefined) return false;
  const scalar = deepestTrailingScalar(prev);
  if (scalar === undefined || scalar.chomp !== "keep") return false;
  if (scalar.style !== "block-literal" && scalar.style !== "block-folded") return false;
  const start = blankLineAboveStart(text, offset);
  return start >= scalar.offset && start < scalar.offset + scalar.length;
});

/**
 * True when the line immediately below the line containing `offset` is blank
 * (empty or horizontal whitespace only) AND is itself followed by another
 * line.
 *
 * **Details**
 *
 * Purely local, the mirror of {@link hasBlankLineAbove} — used to embed
 * a blank line AFTER a comment run as a trailing empty line in the stored
 * comment string.
 *
 * **Example** (Require a line after the blank below a comment)
 *
 * ```ts
 * import { hasBlankLineBelow } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(hasBlankLineBelow("# heading\n\na: 1", 0)) // true
 * console.log(hasBlankLineBelow("# heading\n", 0)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasBlankLineBelow: {
  (offset: number): (text: string) => boolean;
  (text: string, offset: number): boolean;
} = dual(2, (text: string, offset: number): boolean => {
  let lineEnd = Math.max(0, offset);
  while (lineEnd < text.length && text[lineEnd] !== "\n" && text[lineEnd] !== "\r") lineEnd++;
  if (lineEnd >= text.length) return false;
  const nextStart = lineEnd + (text[lineEnd] === "\r" && text[lineEnd + 1] === "\n" ? 2 : 1);
  let nextEnd = nextStart;
  while (nextEnd < text.length && text[nextEnd] !== "\n" && text[nextEnd] !== "\r") nextEnd++;
  return nextEnd < text.length && Str.trim(Str.slice(nextStart, nextEnd)(text)) === "";
});

/**
 * The stored text of a comment token: the RAW post-`#` slice, reference
 * parity with the `yaml` npm package — `# section` stores `" section"`,
 * `#no-space` stores `"no-space"`, `#   aligned` keeps its alignment.
 *
 * **Details**
 *
 * The one reserved string is `""`, which encodes an embedded blank line
 * inside a joined comment run — so a spaces-only raw slice stores with ONE
 * extra trailing space and the renderers strip it back off. A bare `#`
 * (raw `""`) stores `" "`, `# ` (raw `" "`) stores `"  "`, and so on; the
 * escape is injective, so every comment spelling roundtrips byte-intact.
 * Raw storage is what makes byte-intact roundtrip possible; trimming would
 * canonicalize every comment to `# text`.
 *
 * **Example** (Preserve comment spacing and escape a bare marker)
 *
 * ```ts
 * import { rawCommentText } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(JSON.stringify(rawCommentText("# section"))) // " section"
 * console.log(JSON.stringify(rawCommentText("#"))) // " "
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export function rawCommentText(source: string): string {
  const raw = Str.startsWith("#")(source) ? Str.slice(1)(source) : source;
  return /^ *$/.test(raw) ? `${raw} ` : raw;
}

/**
 * Join two optional comment blocks with a newline.
 *
 * **Example** (Join a leading comment run)
 *
 * ```ts
 * import { joinComments } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(JSON.stringify(joinComments(" first", " second"))) // " first\n second"
 * console.log(joinComments(undefined, " heading")) //  heading
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const joinComments: {
  (b: string): (a: string | undefined) => string;
  (a: string | undefined, b: string): string;
} = dual(2, (a: string | undefined, b: string): string => (a === undefined ? b : `${a}\n${b}`));

/**
 * Zero-based column of `offset` within its line.
 *
 * **Details**
 *
 * A byte-order mark at the
 * line start occupies no column — the lexer's convention — so a
 * BOM-prefixed root mapping's content column is `0`, not `1`, and its
 * terminal own-line comment is not mistaken for one escaping a nested map.
 *
 * **Example** (Ignore a byte-order mark at the line start)
 *
 * ```ts
 * import { columnAt } from "@beep/yaml/internal/composer/comments"
 *
 * console.log(columnAt("\uFEFFa: 1", 1)) // 0
 * console.log(columnAt("a: 1\n  b: 2", 7)) // 2
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const columnAt: {
  (offset: number): (text: string) => number;
  (text: string, offset: number): number;
} = dual(2, (text: string, offset: number): number => {
  if (offset <= 0) return 0;
  const lineStart = lineBreakBefore(text, offset - 1) + 1;
  const bom = text[lineStart] === "\uFEFF" && offset > lineStart ? 1 : 0;
  return offset - lineStart - bom;
});

/**
 * A comment that outlived its collection: it sat after the collection's last
 * entry at a column SHALLOWER than the collection's content, so it belongs
 * to an outer scope (reference parity — a column-0 `# tail` between a nested
 * block and the next root key documents the next root key, not the nested
 * block).
 *
 * **Details**
 *
 * Escaped comments ride `ComposerState` up one level, where the
 * enclosing composer re-injects them into its own item stream.
 *
 * **Example** (Decode a comment escaping to an outer scope)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { EscapedComment } from "@beep/yaml/internal/composer/comments"
 *
 * const comment = S.decodeUnknownSync(EscapedComment)({ text: " tail", offset: 24 })
 * console.log(JSON.stringify(comment.text), comment.offset) // " tail" 24
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EscapedComment extends S.Opaque<EscapedComment, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.pipe($I.annoteKey("EscapedComment.text", { description: "Raw post-indicator comment text." })),
    offset: S.Finite.pipe(
      $I.annoteKey("EscapedComment.offset", { description: "Source offset of the disowned comment." })
    ),
  }).pipe(
    $I.annoteSchema("EscapedComment", { description: "Comment disowned by a collection for its enclosing scope." })
  )
) {}

/**
 * Rebuild `node` with the given comment fields merged in (existing fields are
 * kept unless overridden; `commentBefore`/`comment` join with a newline when
 * both sides are present). Every node class carries the triple, aliases
 * included.
 *
 * **Example** (Merge trailing comments without mutating the scalar)
 *
 * ```ts
 * import { CommentFields, withCommentFields } from "@beep/yaml/internal/composer/comments"
 * import { YamlScalar } from "@beep/yaml/YamlNode"
 *
 * const scalar = YamlScalar.make({
 *   value: "value", style: "plain", comment: " first", offset: 0, length: 5
 * })
 * const rebuilt = withCommentFields(scalar, CommentFields.make({ comment: " second", spaceBefore: true }))
 * console.log(JSON.stringify(rebuilt.comment), rebuilt.spaceBefore) // " first\n second" true
 * console.log(scalar.comment) //  first
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const withCommentFields: {
  (fields: CommentFields): (node: YamlNode) => YamlNode;
  (node: YamlNode, fields: CommentFields): YamlNode;
} = dual(2, (node: YamlNode, fields: CommentFields): YamlNode => {
  if (isYamlScalar(node)) {
    return YamlScalar.make({
      value: node.value,
      style: node.style,
      ...O.getSomesStruct({
        tag: O.fromUndefinedOr(node.tag),
        anchor: O.fromUndefinedOr(node.anchor),
        ...mergedCommentFields(node, fields),
        chomp: O.fromUndefinedOr(node.chomp),
        blockIndent: O.fromUndefinedOr(node.blockIndent),
        raw: O.fromUndefinedOr(node.raw),
        sourceMultiline: O.fromUndefinedOr(node.sourceMultiline),
      }),

      offset: node.offset,
      length: node.length,
    });
  }
  if (isYamlMap(node)) {
    return YamlMap.make({ items: node.items, ...collectionFieldsWithComments(node, fields) });
  }
  if (isYamlSeq(node)) {
    return YamlSeq.make({ items: node.items, ...collectionFieldsWithComments(node, fields) });
  }
  return YamlAlias.make({
    name: node.name,
    ...O.getSomesStruct(mergedCommentFields(node, fields)),
    offset: node.offset,
    length: node.length,
  });
});

/** The structural comment-field view every YAML node satisfies. */
type CommentFieldsView = S.Struct.Type<typeof CommentFields.fields>;

/** A collection's non-item fields with `fields` merged into its comment triple. */
const collectionFieldsWithComments = (node: YamlMap | YamlSeq, fields: CommentFields) => ({
  style: node.style,
  ...O.getSomesStruct({
    tag: O.fromUndefinedOr(node.tag),
    anchor: O.fromUndefinedOr(node.anchor),
    ...mergedCommentFields(node, fields),
    sourceMultiline: O.fromUndefinedOr(node.sourceMultiline),
  }),
  offset: node.offset,
  length: node.length,
});

const mergedCommentFields: {
  (
    existing: CommentFieldsView,
    incoming: CommentFields
  ): { commentBefore: O.Option<string>; comment: O.Option<string>; spaceBefore: O.Option<boolean> };
  (
    incoming: CommentFields
  ): (existing: CommentFieldsView) => {
    commentBefore: O.Option<string>;
    comment: O.Option<string>;
    spaceBefore: O.Option<boolean>;
  };
} = dual(
  2,
  (
    existing: CommentFieldsView,
    incoming: CommentFields
  ): { commentBefore: O.Option<string>; comment: O.Option<string>; spaceBefore: O.Option<boolean> } => {
    const commentBefore =
      incoming.commentBefore !== undefined
        ? existing.commentBefore !== undefined
          ? `${existing.commentBefore}\n${incoming.commentBefore}`
          : incoming.commentBefore
        : existing.commentBefore;
    const comment =
      incoming.comment !== undefined
        ? existing.comment !== undefined
          ? `${existing.comment}\n${incoming.comment}`
          : incoming.comment
        : existing.comment;
    const spaceBefore = incoming.spaceBefore ?? existing.spaceBefore;
    return {
      commentBefore: O.fromUndefinedOr(commentBefore),
      comment: O.fromUndefinedOr(comment),
      spaceBefore: O.fromUndefinedOr(spaceBefore),
    };
  }
);

/**
 * Last CR or LF at or before the clamped UTF-16 offset.
 *
 * **Example** (Locate a preceding line break)
 *
 * ```ts
 * import { lineBreakBefore } from "@beep/yaml/internal/composer/comments"
 * console.log(lineBreakBefore("a\nb", 2)) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const lineBreakBefore: {
  (text: string, from: number): number;
  (from: number): (text: string) => number;
} = dual(2, (text: string, from: number): number => {
  let at = Math.min(Math.max(0, from), text.length - 1);
  while (at >= 0 && text[at] !== "\n" && text[at] !== "\r") at--;
  return at;
});

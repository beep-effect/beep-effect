/**
 * The formatting/modification concept: non-mutating text splices
 * (MarkdownEdit) that normalize concrete-syntax markers or surgically replace
 * one node, both computed against the original source so everything outside
 * the spliced spans survives byte-for-byte — the offset-splice editing model
 * chosen over a lossless CST.
 *
 * **Details**
 *
 * `format` is conservative by construction: an edit is emitted only when the
 * rewrite is provably safe against re-parse hazards, and every hazard is
 * guarded by SKIPPING the rewrite, never by attempting a cleverer one. The
 * guarded hazards, each pinned by a test: a `-` thematic break under a
 * non-blank line reads as a setext underline; normalizing bullets can merge
 * two adjacent sibling lists into one; `_` emphasis cannot open or close at
 * an intraword boundary; abutting same-marker emphasis runs change the
 * delimiter algebra; a backtick fence's info string cannot hold a backtick;
 * an atx-to-setext conversion is only safe flush-left with single-line,
 * paragraph-shaped content.
 *
 * `modify` is toml-strict: a replacement is a node fragment or plain text —
 * both rendered through the canonical stringifier — so a modified document
 * re-parses cleanly by construction. Raw markdown replacement is deliberately
 * not offered; it would delegate the structure-escape problem to the
 * caller. Target scope: flow nodes, phrasing nodes and table cells;
 * container-slot nodes (list items, table rows, the root, frontmatter)
 * refuse with a typed error, as does any multi-line replacement whose target
 * sits inside a container whose continuation lines carry a prefix the splice
 * cannot reproduce.
 *
 * Cycle firewall: this module composes the public facades
 * (`Markdown.parseResult`/`Markdown.stringifyResult`) and the node classes;
 * it never imports the engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { trustedNode } from "./internal/nodes.ts";
import { Markdown, MarkdownDialect, MarkdownParseOptions } from "./Markdown.ts";
import { MarkdownEdit } from "./MarkdownEdit.ts";
import {
  BulletChar,
  EmphasisChar,
  FenceChar,
  HeadingStyle,
  Position,
  Text,
  ThematicBreakChar,
} from "./MarkdownNode.ts";
import type { MarkdownDocument } from "./MarkdownDocument.ts";
import type { MarkdownRange } from "./MarkdownEdit.ts";
import type {
  Code,
  Emphasis,
  FlowContent,
  Heading,
  HeadingDepth,
  List,
  MarkdownNode,
  Paragraph,
  PhrasingContent,
  Root,
  Strong,
  ThematicBreak,
} from "./MarkdownNode.ts";

const $I = $MarkdownId.create("MarkdownFormat");

/**
 * A range accepted at the `format`/`formatToString` call sites: either a
 * {@link MarkdownRange} instance or a plain `{ offset, length }` literal (the
 * two are structurally interchangeable — only `offset`/`length` are read).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownRangeLike = MarkdownRange | { readonly offset: number; readonly length: number };

/**
 * **Details**
 *
 * A formatting target for {@link MarkdownFormattingOptions}, not a node
 * fidelity field: on a {@link Code} node the two spellings are told apart by
 * the presence or absence of `fenceChar`/`fenceLength`, and a language-less
 * node with neither serializes as an **indented** block by default.
 *
 * **Example** (Validate a code block spelling)
 *
 * ```ts
 * import { CodeBlockStyle } from "@beep/markdown/MarkdownFormat";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CodeBlockStyle)("fenced")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CodeBlockStyle = LiteralKit(["fenced", "indented"]).pipe(
  $I.annoteSchema("CodeBlockStyle", {
    description:
      "The two ways CommonMark spells a code block: `fenced` (a backtick or tilde fence) and `indented` (four-space indentation).",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CodeBlockStyle = typeof CodeBlockStyle.Type;

/**
 * **Details**
 *
 * Scope is marker normalization only — heading style, bullet
 * character, emphasis/strong marker, fence character, thematic-break
 * character, code-block style. Content is never rewritten, rewrapped or
 * reflowed.
 *
 * **Gotchas**
 *
 * `codeBlockStyle` is the opt-in that converts between the two code-block
 * spellings for **language-less** blocks (a block with a `lang` has no
 * indented spelling and is never touched). It exists because the default
 * surprises: absent this option, a language-less code block keeps its
 * spelling — and a language-less {@link Code} node with no explicit
 * `fenceChar` **serializes as an indented block** through
 * `Markdown.stringify`. `"fenced"` rewrites indented blocks to fences (the
 * fence character follows `fenceChar` when also set, backtick otherwise);
 * `"indented"` rewrites language-less fences to indented form where provably
 * safe. Like every other option, hazardous conversions are skipped, never
 * attempted: both directions apply to root-level, flush-left blocks only,
 * and the `"indented"` direction additionally skips blocks whose indented
 * spelling would lazily continue a paragraph, be absorbed into a preceding
 * list or footnote definition, merge with an adjacent code block, or fail
 * representability (empty, or blank first/last lines).
 *
 * **Example** (Request bullet marker normalization)
 *
 * ```ts
 * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
 *
 * const options = MarkdownFormattingOptions.make({ bulletChar: "-" });
 * console.log(JSON.stringify(MarkdownFormat.formatToString("* one\n", undefined, options))) // "- one\n"
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class MarkdownFormattingOptions extends S.Opaque<MarkdownFormattingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    dialect: S.optionalKey(MarkdownDialect).pipe(
      $I.annoteKey("MarkdownFormattingOptions.dialect", {
        description: "Markdown syntax used to parse the source before formatting; defaults to `gfm`",
      })
    ),
    frontmatter: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("MarkdownFormattingOptions.frontmatter", {
        description:
          "Whether to capture an opening frontmatter block while parsing for formatting; disabled by default",
      })
    ),
    headingStyle: S.optionalKey(HeadingStyle).pipe(
      $I.annoteKey("MarkdownFormattingOptions.headingStyle", {
        description:
          "Requested `atx` or `setext` heading spelling, applied only where conversion is safe; omission preserves existing spelling",
      })
    ),
    bulletChar: S.optionalKey(BulletChar).pipe(
      $I.annoteKey("MarkdownFormattingOptions.bulletChar", {
        description:
          "Requested unordered-list marker, applied only where normalization is safe; omission preserves existing markers",
      })
    ),
    emphasisChar: S.optionalKey(EmphasisChar).pipe(
      $I.annoteKey("MarkdownFormattingOptions.emphasisChar", {
        description:
          "Requested delimiter character for emphasis and strong emphasis, applied only where normalization is safe; omission preserves existing delimiters",
      })
    ),
    fenceChar: S.optionalKey(FenceChar).pipe(
      $I.annoteKey("MarkdownFormattingOptions.fenceChar", {
        description:
          "Requested code-fence character for safe fence normalization and conversion to fenced blocks; omission preserves existing fences",
      })
    ),
    thematicBreakChar: S.optionalKey(ThematicBreakChar).pipe(
      $I.annoteKey("MarkdownFormattingOptions.thematicBreakChar", {
        description:
          "Requested thematic-break marker character, applied only where normalization is safe; omission preserves existing markers",
      })
    ),
    codeBlockStyle: S.optionalKey(CodeBlockStyle).pipe(
      $I.annoteKey("MarkdownFormattingOptions.codeBlockStyle", {
        description:
          "Requested fenced or indented spelling for safe conversion of root-level, flush-left code blocks without language or metadata",
      })
    ),
  }).pipe(
    $I.annoteSchema("MarkdownFormattingOptions", {
      description:
        "Options controlling formatting: which concrete-syntax markers to normalize, plus the parse knobs (`dialect`, `frontmatter`) the formatter parses the source with (same defaults as `Markdown.parse`). Every marker option is optional and independent; an absent option normalizes nothing.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarkdownFormattingOptions {
  /**
   * The plain options object `format` and `formatToString` accept: a
   * constructed {@link MarkdownFormattingOptions} or an object literal with
   * the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MarkdownFormattingOptions.Encoded;
}

/**
 * **Example** (Validate a replacement failure code)
 *
 * ```ts
 * import { MarkdownModificationErrorCode } from "@beep/markdown/MarkdownFormat";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(MarkdownModificationErrorCode)("UnsupportedTarget")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownModificationErrorCode = LiteralKit([
  "NodeNotInDocument",
  "UnsupportedTarget",
  "FragmentCategoryMismatch",
  "FragmentUnrenderable",
]).pipe(
  $I.annoteSchema("MarkdownModificationErrorCode", {
    description: "Error codes `MarkdownFormat.modify` can fail with.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownModificationErrorCode = typeof MarkdownModificationErrorCode.Type;

/**
 * **Example** (Inspect a typed replacement failure)
 *
 * ```ts
 * import { MarkdownModificationError } from "@beep/markdown/MarkdownFormat";
 *
 * const error = MarkdownModificationError.make({
 *   code: "UnsupportedTarget", detail: "root cannot be replaced", offset: 0, length: 6,
 * });
 * console.log(error.code) // UnsupportedTarget
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class MarkdownModificationError extends S.TaggedError<
  MarkdownModificationError,
  { readonly brand: unique symbol }
>($I`MarkdownModificationError`)(
  "MarkdownModificationError",
  {
    code: MarkdownModificationErrorCode.pipe(
      $I.annoteKey("MarkdownModificationError.code", {
        description:
          "Reason replacement failed: target absent, unsupported target or context, incompatible fragment category, or unrenderable fragment",
      })
    ),
    detail: S.String.pipe(
      $I.annoteKey("MarkdownModificationError.detail", {
        description: "Explanation of the replacement failure, included in the error message",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("MarkdownModificationError.offset", {
        description: "Zero-based source position reported by the target node, measured in UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("MarkdownModificationError.length", {
        description: "Extent of the target node's reported source span, measured in UTF-16 code units",
      })
    ),
  },
  $I.annoteError<MarkdownModificationError>("MarkdownModificationError", {
    description:
      "Raised when `MarkdownFormat.modify` cannot perform the requested replacement: the target node is not in the document (`NodeNotInDocument`), the target kind or splice context is outside the supported scope (`UnsupportedTarget`), the fragment's content category does not fit the target's slot (`FragmentCategoryMismatch`), or the fragment trips the stringifier's hardening guard (`FragmentUnrenderable`). Carries the typed `code` plus the target's `offset`/`length` where known — never a collapsed reason string alone.",
  })
) {
  /**
   * Explains the modification failure using its typed code and detail.
   *
   * **Example** (Read a replacement failure message)
   *
   * ```ts
   * import { MarkdownModificationError } from "@beep/markdown/MarkdownFormat";
   *
   * const error = MarkdownModificationError.make({
   *   code: "UnsupportedTarget", detail: "root cannot be replaced", offset: 0, length: 6,
   * });
   * console.log(error.message) // Markdown modification failed: UnsupportedTarget root cannot be replaced
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Markdown modification failed: ${this.code} ${this.detail}`;
  }
}

const childrenOf = (node: MarkdownNode): ReadonlyArray<MarkdownNode> => ("children" in node ? node.children : []);

type VisitChildren = boolean;

type WalkVisitor = (
  node: MarkdownNode,
  parent: MarkdownNode | undefined,
  siblings: ReadonlyArray<MarkdownNode>,
  index: number
) => void | VisitChildren;

const walk: {
  (
    node: MarkdownNode,
    parent: MarkdownNode | undefined,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    visit: WalkVisitor
  ): void;
  (
    parent: MarkdownNode | undefined,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    visit: WalkVisitor
  ): (node: MarkdownNode) => void;
} = dual(
  5,
  (
    node: MarkdownNode,
    parent: MarkdownNode | undefined,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    visit: WalkVisitor
  ): void => {
    if (visit(node, parent, siblings, index) === false) {
      return;
    }
    const children = childrenOf(node);
    for (const [child, index] of A.map(children, (child, index) => [child, index] as const)) {
      walk(child, node, children, index, visit);
    }
  }
);

const containsNode: {
  (root: MarkdownNode, predicate: (node: MarkdownNode) => boolean): boolean;
  (predicate: (node: MarkdownNode) => boolean): (root: MarkdownNode) => boolean;
} = dual(2, (root: MarkdownNode, predicate: (node: MarkdownNode) => boolean): boolean => {
  let found = false;
  walk(root, undefined, [], 0, (node) => {
    found = found || predicate(node);
  });
  return found;
});

const spanOf = (node: MarkdownNode): { readonly start: number; readonly end: number } => ({
  start: node.position.start.offset,
  end: node.position.end.offset,
});

const SCAN_DELIMS_PUNCTUATION = /^[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~\p{P}\p{S}]/u;
const SCAN_DELIMS_WHITESPACE = /^\s/;

const underscoreCanOpen: {
  (before: string, after: string): boolean;
  (after: string): (before: string) => boolean;
} = dual(2, (before: string, after: string): boolean => {
  const beforeWhitespace = SCAN_DELIMS_WHITESPACE.test(before);
  const afterWhitespace = SCAN_DELIMS_WHITESPACE.test(after);
  const beforePunctuation = SCAN_DELIMS_PUNCTUATION.test(before);
  const afterPunctuation = SCAN_DELIMS_PUNCTUATION.test(after);
  const left = !afterWhitespace && (!afterPunctuation || beforeWhitespace || beforePunctuation);
  const right = !beforeWhitespace && (!beforePunctuation || afterWhitespace || afterPunctuation);
  return left && (!right || beforePunctuation);
});

const isLineBreakAt: {
  (source: string, index: number): boolean;
  (index: number): (source: string) => boolean;
} = dual(2, (source: string, index: number): boolean => {
  const char = source[index];
  return char === "\n" || char === "\r";
});

const isSpaceOrTabAt: {
  (source: string, index: number): boolean;
  (index: number): (source: string) => boolean;
} = dual(2, (source: string, index: number): boolean => {
  const char = source[index];
  return char === " " || char === "\t";
});

const lineStartOf: {
  (source: string, offset: number): number;
  (offset: number): (source: string) => number;
} = dual(2, (source: string, offset: number): number => {
  let index = offset;
  while (index > 0 && !isLineBreakAt(source, index - 1)) {
    index -= 1;
  }
  return index;
});

const BLANK_RUN = /[ \t]*/y;

const WHITESPACE_RUN = /[ \t\r\n]*/y;

const runEnd: {
  (source: string, alwaysMatchingStickyRun: RegExp, from: number): number;
  (alwaysMatchingStickyRun: RegExp, from: number): (source: string) => number;
} = dual(3, (source: string, alwaysMatchingStickyRun: RegExp, from: number): number => {
  alwaysMatchingStickyRun.lastIndex = from;
  alwaysMatchingStickyRun.test(source);
  return alwaysMatchingStickyRun.lastIndex;
});

const previousLineBlank: {
  (source: string, offset: number): boolean;
  (offset: number): (source: string) => boolean;
} = dual(2, (source: string, offset: number): boolean => {
  const lineStart = lineStartOf(source, offset);
  if (lineStart === 0) {
    return true;
  }
  const lineEnd = source[lineStart - 1] === "\n" && source[lineStart - 2] === "\r" ? lineStart - 2 : lineStart - 1;
  return runEnd(source, BLANK_RUN, lineStartOf(source, lineEnd)) >= lineEnd;
});

const SETEXT_CONTENT_HAZARD = /^(?:[-+*>#=]|\d{1,9}[.)](?:\s|$)|`{3}|~{3}|\s)/;

const LINE_TERMINATOR = /[\r\n]/;

const longestRun: {
  (value: string, char: string): number;
  (char: string): (value: string) => number;
} = dual(2, (value: string, char: string): number => {
  let longest = 0;
  let current = 0;
  for (const ch of value) {
    current = ch === char ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
});

const isUnorderedList = (node: MarkdownNode): node is List => node.type === "list" && node.ordered !== true;

const adjacentSpans: {
  (source: string, endOfFirst: number, startOfSecond: number): boolean;
  (endOfFirst: number, startOfSecond: number): (source: string) => boolean;
} = dual(
  3,
  (source: string, endOfFirst: number, startOfSecond: number): boolean =>
    runEnd(source, WHITESPACE_RUN, endOfFirst) >= startOfSecond
);

const TaggedEdit = S.Struct({
  ...MarkdownEdit.fields,
  nodeStart: MarkdownEdit.fields.offset.pipe(
    $I.annoteKey("TaggedEdit.nodeStart", { description: "Start offset of the owning node" })
  ),
  nodeEnd: MarkdownEdit.fields.offset.pipe(
    $I.annoteKey("TaggedEdit.nodeEnd", { description: "End offset of the owning node" })
  ),
  bullet: S.Boolean.pipe(
    $I.annoteKey("TaggedEdit.bullet", { description: "Whether this edit normalizes a list bullet" })
  ),
}).pipe(
  $I.annoteSchema("TaggedEdit", { description: "A source edit with its owning node span and bullet classification." })
);
type TaggedEdit = typeof TaggedEdit.Type;

const toMarkdownEdit = (edit: TaggedEdit): MarkdownEdit =>
  MarkdownEdit.make({ offset: edit.offset, length: edit.length, content: edit.content });

class FormatEmitter {
  readonly edits: Array<TaggedEdit> = [];
  push(node: MarkdownNode, offset: number, length: number, content: string, bullet = false): void {
    const { start, end } = spanOf(node);
    this.edits.push({ offset, length, content, nodeStart: start, nodeEnd: end, bullet });
  }
}

const replaceWhole: {
  (emit: FormatEmitter, node: MarkdownNode, content: string): true;
  (node: MarkdownNode, content: string): (emit: FormatEmitter) => true;
} = dual(3, (emit: FormatEmitter, node: MarkdownNode, content: string): true => {
  const { start, end } = spanOf(node);
  emit.push(node, start, end - start, content);
  return true;
});

const formatThematicBreak: {
  (source: string, emit: FormatEmitter, node: ThematicBreak, target: ThematicBreakChar): void;
  (emit: FormatEmitter, node: ThematicBreak, target: ThematicBreakChar): (source: string) => void;
} = dual(4, (source: string, emit: FormatEmitter, node: ThematicBreak, target: ThematicBreakChar): void => {
  const readsAsSetextUnderline = target === "-" && !previousLineBlank(source, spanOf(node).start);
  if (node.markerChar !== target && !readsAsSetextUnderline) {
    replaceWhole(emit, node, Str.repeat(3)(target));
  }
});

interface HeadingContent {
  readonly original: string;
  readonly start: number;
}

const singleLineHeadingContent: {
  (source: string, node: Heading): O.Option<HeadingContent>;
  (node: Heading): (source: string) => O.Option<HeadingContent>;
} = dual(
  2,
  (source: string, node: Heading): O.Option<HeadingContent> =>
    pipe(
      A.match(node.children, {
        onEmpty: (): O.Option<HeadingContent> => O.none(),
        onNonEmpty: (children): O.Option<HeadingContent> => {
          const start = A.headNonEmpty(children).position.start.offset;
          return O.some({ start, original: Str.slice(start, A.lastNonEmpty(children).position.end.offset)(source) });
        },
      }),
      O.filter((content) => !LINE_TERMINATOR.test(content.original))
    )
);

const setextBlocked: {
  (source: string, node: Heading, original: string): boolean;
  (node: Heading, original: string): (source: string) => boolean;
} = dual(3, (source: string, node: Heading, original: string): boolean => {
  const start = spanOf(node).start;
  return (
    node.depth > 2 ||
    SETEXT_CONTENT_HAZARD.test(original) ||
    lineStartOf(source, start) !== start ||
    !previousLineBlank(source, start)
  );
});

const normalizedHeadingContent: {
  (source: string, node: Heading, content: HeadingContent, emphasisChar: EmphasisChar | undefined): string;
  (node: Heading, content: HeadingContent, emphasisChar: EmphasisChar | undefined): (source: string) => string;
} = dual(
  4,
  (source: string, node: Heading, content: HeadingContent, emphasisChar: EmphasisChar | undefined): string => {
    const descendants = new FormatEmitter();
    if (emphasisChar !== undefined) {
      walk(node, undefined, [], 0, (child, _parent, siblings, index) => {
        if (isEmphasisLike(child)) {
          formatEmphasis(source, descendants, child, siblings, index, emphasisChar);
        }
      });
    }
    return MarkdownEdit.applyAll(
      content.original,
      A.map(descendants.edits, (edit) =>
        MarkdownEdit.make({ offset: edit.offset - content.start, length: edit.length, content: edit.content })
      )
    );
  }
);

const ATX_CLOSING_SEQUENCE = /(?:^|[ \t])#+[ \t]*$/;

const atxSpelling: {
  (node: Heading, content: string): O.Option<string>;
  (content: string): (node: Heading) => O.Option<string>;
} = dual(
  2,
  (node: Heading, content: string): O.Option<string> =>
    ATX_CLOSING_SEQUENCE.test(content) ? O.none() : O.some(`${Str.repeat(node.depth)("#")} ${content}`)
);

const reparsesAsSetext: {
  (proposed: string, depth: HeadingDepth, content: string, parseOptions: MarkdownParseOptions.Encoded): boolean;
  (depth: HeadingDepth, content: string, parseOptions: MarkdownParseOptions.Encoded): (proposed: string) => boolean;
} = dual(
  4,
  (proposed: string, depth: HeadingDepth, content: string, parseOptions: MarkdownParseOptions.Encoded): boolean =>
    pipe(
      Result.getSuccess(Markdown.parseResult(proposed, parseOptions)),
      O.filter((root) => root.children.length === 1),
      O.flatMap((root) => A.head(root.children)),
      O.filter(
        (block): block is Heading =>
          block.type === "heading" && block.headingStyle === "setext" && block.depth === depth
      ),
      O.flatMap((heading) => singleLineHeadingContent(proposed, heading)),
      O.exists((parsed) => parsed.original === content)
    )
);

const setextSpelling: {
  (node: Heading, content: string, parseOptions: MarkdownParseOptions.Encoded): O.Option<string>;
  (content: string, parseOptions: MarkdownParseOptions.Encoded): (node: Heading) => O.Option<string>;
} = dual(3, (node: Heading, content: string, parseOptions: MarkdownParseOptions.Encoded): O.Option<string> => {
  const underline = Str.repeat(Math.max(3, content.length))(node.depth === 1 ? "=" : "-");
  const safe =
    !SETEXT_CONTENT_HAZARD.test(content) &&
    reparsesAsSetext(`${content}\n${underline}\n`, node.depth, content, parseOptions);
  return safe ? O.some(`${content}\n${underline}`) : O.none();
});

const formatHeading: {
  (
    source: string,
    emit: FormatEmitter,
    node: Heading,
    target: HeadingStyle,
    emphasisChar: EmphasisChar | undefined,
    parseOptions: MarkdownParseOptions.Encoded
  ): boolean;
  (
    emit: FormatEmitter,
    node: Heading,
    target: HeadingStyle,
    emphasisChar: EmphasisChar | undefined,
    parseOptions: MarkdownParseOptions.Encoded
  ): (source: string) => boolean;
} = dual(
  6,
  (
    source: string,
    emit: FormatEmitter,
    node: Heading,
    target: HeadingStyle,
    emphasisChar: EmphasisChar | undefined,
    parseOptions: MarkdownParseOptions.Encoded
  ): boolean =>
    node.headingStyle !== target &&
    pipe(
      singleLineHeadingContent(source, node),
      O.filter((content) => target === "atx" || !setextBlocked(source, node, content.original)),
      O.flatMap((content) => {
        const normalized = normalizedHeadingContent(source, node, content, emphasisChar);
        return target === "atx" ? atxSpelling(node, normalized) : setextSpelling(node, normalized, parseOptions);
      }),
      O.exists((replacement) => replaceWhole(emit, node, replacement))
    )
);

const mergesWithUnorderedSibling: {
  (source: string, node: List, siblings: ReadonlyArray<MarkdownNode>, index: number): boolean;
  (node: List, siblings: ReadonlyArray<MarkdownNode>, index: number): (source: string) => boolean;
} = dual(4, (source: string, node: List, siblings: ReadonlyArray<MarkdownNode>, index: number): boolean => {
  const { start, end } = spanOf(node);
  return (
    O.exists(
      A.get(siblings, index - 1),
      (previous) => isUnorderedList(previous) && adjacentSpans(source, spanOf(previous).end, start)
    ) ||
    O.exists(
      A.get(siblings, index + 1),
      (next) => isUnorderedList(next) && adjacentSpans(source, end, spanOf(next).start)
    )
  );
});

const formatList: {
  (
    source: string,
    emit: FormatEmitter,
    node: List,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: BulletChar
  ): void;
  (
    emit: FormatEmitter,
    node: List,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: BulletChar
  ): (source: string) => void;
} = dual(
  6,
  (
    source: string,
    emit: FormatEmitter,
    node: List,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: BulletChar
  ): void => {
    if (
      !isUnorderedList(node) ||
      node.bulletChar === target ||
      mergesWithUnorderedSibling(source, node, siblings, index)
    ) {
      return;
    }
    for (const item of node.children) {
      emit.push(node, item.position.start.offset, 1, target, true);
    }
  }
);

const codePointBefore: {
  (source: string, offset: number): string;
  (offset: number): (source: string) => string;
} = dual(2, (source: string, offset: number): string => {
  let start = offset - 1;
  const low = O.exists(Str.charCodeAt(source, start), (code) => code >= 0xdc00 && code <= 0xdfff);
  const high = O.exists(Str.charCodeAt(source, start - 1), (code) => code >= 0xd800 && code <= 0xdbff);
  if (low && high) start--;
  return Str.slice(Math.max(0, start), offset)(source);
});

const codePointAfter: {
  (source: string, offset: number): string;
  (offset: number): (source: string) => string;
} = dual(2, (source: string, offset: number): string =>
  Str.slice(offset, offset + (O.exists(Str.codePointAt(source, offset), (code) => code > 0xffff) ? 2 : 1))(source)
);

const edgeAsLineEnding = (char: string): string => (char === "" ? "\n" : char);

const isEmphasisLike = (node: MarkdownNode): node is Emphasis | Strong =>
  node.type === "emphasis" || node.type === "strong";

const underscoreBlocked: {
  (source: string, start: number, end: number, markerLength: number): boolean;
  (start: number, end: number, markerLength: number): (source: string) => boolean;
} = dual(
  4,
  (source: string, start: number, end: number, markerLength: number): boolean =>
    !underscoreCanOpen(
      edgeAsLineEnding(codePointBefore(source, start)),
      edgeAsLineEnding(codePointAfter(source, start + markerLength))
    ) ||
    !underscoreCanOpen(
      edgeAsLineEnding(codePointAfter(source, end)),
      edgeAsLineEnding(codePointBefore(source, end - markerLength))
    )
);

const hasEdgeEmphasisChild: {
  (node: Emphasis | Strong, start: number, end: number, markerLength: number): boolean;
  (start: number, end: number, markerLength: number): (node: Emphasis | Strong) => boolean;
} = dual(4, (node: Emphasis | Strong, start: number, end: number, markerLength: number): boolean =>
  A.some(
    childrenOf(node),
    (child) =>
      isEmphasisLike(child) &&
      (spanOf(child).start === start + markerLength || spanOf(child).end === end - markerLength)
  )
);

const abutsEmphasisSibling: {
  (siblings: ReadonlyArray<MarkdownNode>, index: number, start: number, end: number): boolean;
  (index: number, start: number, end: number): (siblings: ReadonlyArray<MarkdownNode>) => boolean;
} = dual(
  4,
  (siblings: ReadonlyArray<MarkdownNode>, index: number, start: number, end: number): boolean =>
    O.exists(A.get(siblings, index - 1), (previous) => isEmphasisLike(previous) && spanOf(previous).end === start) ||
    O.exists(A.get(siblings, index + 1), (next) => isEmphasisLike(next) && spanOf(next).start === end)
);

const formatEmphasis: {
  (
    source: string,
    emit: FormatEmitter,
    node: Emphasis | Strong,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: EmphasisChar
  ): void;
  (
    emit: FormatEmitter,
    node: Emphasis | Strong,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: EmphasisChar
  ): (source: string) => void;
} = dual(
  6,
  (
    source: string,
    emit: FormatEmitter,
    node: Emphasis | Strong,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: EmphasisChar
  ): void => {
    const markerLength = node.type === "strong" ? 2 : 1;
    const { start, end } = spanOf(node);
    const blocked =
      node.markerChar === target ||
      (target === "_" && underscoreBlocked(source, start, end, markerLength)) ||
      hasEdgeEmphasisChild(node, start, end, markerLength) ||
      abutsEmphasisSibling(siblings, index, start, end);
    if (!blocked) {
      const marker = Str.repeat(markerLength)(target);
      emit.push(node, start, markerLength, marker);
      emit.push(node, end - markerLength, markerLength, marker);
    }
  }
);

const openingFenceLength: {
  (source: string, start: number, end: number, fenceChar: FenceChar): number;
  (start: number, end: number, fenceChar: FenceChar): (source: string) => number;
} = dual(4, (source: string, start: number, end: number, fenceChar: FenceChar): number => {
  let length = 0;
  while (start + length < end && source[start + length] === fenceChar) {
    length += 1;
  }
  return length;
});

/**
 * The closing fence's span, when the block has a genuine closing line: the
 * one source line after all content lines. The parsed value already accounts
 * for actual container prefixes — every unclosed content line contributes a
 * newline, including a literal run of fence characters — so counting lines
 * locally keeps normalizing many fences linear.
 */
const closingFence: {
  (source: string, node: Code, fenceChar: FenceChar, openLength: number): O.Option<{ start: number; end: number }>;
  (node: Code, fenceChar: FenceChar, openLength: number): (source: string) => O.Option<{ start: number; end: number }>;
} = dual(
  4,
  (source: string, node: Code, fenceChar: FenceChar, openLength: number): O.Option<{ start: number; end: number }> => {
    const { start, end } = spanOf(node);
    let lineEnd = end;
    while (lineEnd > start && isSpaceOrTabAt(source, lineEnd - 1)) lineEnd -= 1;
    const closeLineStart = lineStartOf(source, lineEnd);
    let closeStart = lineEnd;
    while (closeStart > closeLineStart && source[closeStart - 1] === fenceChar) closeStart -= 1;
    const genuine =
      closeLineStart > start &&
      lineEnd - closeStart >= openLength &&
      A.length(Str.split(Str.slice(start, lineEnd)(source), /\r\n|[\r\n]/)) ===
        A.length(Str.split(node.value, "\n")) + 1;
    return genuine ? O.some({ start: closeStart, end: lineEnd }) : O.none();
  }
);

const infoForbidsBacktickFence = (node: Code): boolean => Str.includes("`")(`${node.lang ?? ""}${node.meta ?? ""}`);

const formatFence: {
  (source: string, emit: FormatEmitter, node: Code, target: FenceChar): void;
  (emit: FormatEmitter, node: Code, target: FenceChar): (source: string) => void;
} = dual(4, (source: string, emit: FormatEmitter, node: Code, target: FenceChar): void => {
  const fidelity = node.fenceChar;
  if (fidelity === undefined || fidelity === target || (target === "`" && infoForbidsBacktickFence(node))) {
    return;
  }
  const { start, end } = spanOf(node);
  const openLength = openingFenceLength(source, start, end, fidelity);
  const fence = Str.repeat(Math.max(3, openLength, longestRun(node.value, target) + 1))(target);
  emit.push(node, start, openLength, fence);
  const close = closingFence(source, node, fidelity, openLength);
  if (O.isSome(close)) {
    emit.push(node, close.value.start, close.value.end - close.value.start, fence);
  }
});

const BLANK_LINE = /^[ \t]*$/;

const isLanguagelessCode = (node: MarkdownNode): boolean =>
  node.type === "code" && node.lang === undefined && node.meta === undefined;

const withoutFinalNewline = (value: string): string => (Str.endsWith("\n")(value) ? Str.slice(0, -1)(value) : value);

const indentCodeLines = (lines: ReadonlyArray<string>): string =>
  A.join(
    A.map(lines, (line) => (line === "" ? line : `    ${line}`)),
    "\n"
  );

const indentedLines = (value: string): O.Option<ReadonlyArray<string>> => {
  const lines = Str.split(value, "\n");
  const representable =
    !BLANK_LINE.test(A.headNonEmpty(lines)) &&
    !BLANK_LINE.test(A.lastNonEmpty(lines)) &&
    !A.some(lines, (line) => line !== "" && BLANK_LINE.test(line));
  return representable ? O.some(lines) : O.none();
};

const indentedAbsorbed: {
  (source: string, node: Code, siblings: ReadonlyArray<MarkdownNode>, index: number): boolean;
  (node: Code, siblings: ReadonlyArray<MarkdownNode>, index: number): (source: string) => boolean;
} = dual(
  4,
  (source: string, node: Code, siblings: ReadonlyArray<MarkdownNode>, index: number): boolean =>
    !previousLineBlank(source, spanOf(node).start) ||
    O.exists(
      A.get(siblings, index - 1),
      (previous) => previous.type === "list" || previous.type === "footnoteDefinition" || isLanguagelessCode(previous)
    ) ||
    O.exists(A.get(siblings, index + 1), isLanguagelessCode)
);

const fencedSpelling: {
  (node: Code, value: string, fenceChar: FenceChar | undefined): O.Option<string>;
  (value: string, fenceChar: FenceChar | undefined): (node: Code) => O.Option<string>;
} = dual(3, (node: Code, value: string, fenceChar: FenceChar | undefined): O.Option<string> => {
  if (node.fenceChar !== undefined) {
    return O.none();
  }
  const char = fenceChar ?? "`";
  const fence = Str.repeat(Math.max(3, longestRun(value, char) + 1))(char);
  return O.some(`${fence}\n${value}\n${fence}`);
});

const indentedSpelling: {
  (source: string, node: Code, value: string, siblings: ReadonlyArray<MarkdownNode>, index: number): O.Option<string>;
  (
    node: Code,
    value: string,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number
  ): (source: string) => O.Option<string>;
} = dual(
  5,
  (
    source: string,
    node: Code,
    value: string,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number
  ): O.Option<string> =>
    node.fenceChar === undefined || indentedAbsorbed(source, node, siblings, index)
      ? O.none()
      : O.map(indentedLines(value), indentCodeLines)
);

const formatCodeBlockStyle: {
  (
    source: string,
    emit: FormatEmitter,
    node: Code,
    parent: MarkdownNode | undefined,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: CodeBlockStyle,
    fenceChar: FenceChar | undefined
  ): boolean;
  (
    emit: FormatEmitter,
    node: Code,
    parent: MarkdownNode | undefined,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: CodeBlockStyle,
    fenceChar: FenceChar | undefined
  ): (source: string) => boolean;
} = dual(
  8,
  (
    source: string,
    emit: FormatEmitter,
    node: Code,
    parent: MarkdownNode | undefined,
    siblings: ReadonlyArray<MarkdownNode>,
    index: number,
    target: CodeBlockStyle,
    fenceChar: FenceChar | undefined
  ): boolean => {
    const start = spanOf(node).start;
    if (!isLanguagelessCode(node) || parent?.type !== "root" || lineStartOf(source, start) !== start) {
      return false;
    }
    const value = withoutFinalNewline(node.value);
    return pipe(
      target === "fenced"
        ? fencedSpelling(node, value, fenceChar)
        : indentedSpelling(source, node, value, siblings, index),
      O.exists((content) => replaceWhole(emit, node, content))
    );
  }
);

interface FormatContext {
  readonly emit: FormatEmitter;
  readonly index: number;
  readonly options: MarkdownFormattingOptions.Encoded;
  readonly parent: MarkdownNode | undefined;
  readonly parseOptions: MarkdownParseOptions.Encoded;
  readonly siblings: ReadonlyArray<MarkdownNode>;
  readonly text: string;
}

const formatCode = (node: Code, context: FormatContext): void => {
  const { codeBlockStyle, fenceChar } = context.options;
  const converted =
    codeBlockStyle !== undefined &&
    formatCodeBlockStyle(
      context.text,
      context.emit,
      node,
      context.parent,
      context.siblings,
      context.index,
      codeBlockStyle,
      fenceChar
    );
  if (!converted && fenceChar !== undefined) {
    formatFence(context.text, context.emit, node, fenceChar);
  }
};

const formatNode = Match.type<MarkdownNode>().pipe(
  Match.discriminator("type")("thematicBreak", (node) => (context: FormatContext): VisitChildren => {
    const target = context.options.thematicBreakChar;
    if (target !== undefined) formatThematicBreak(context.text, context.emit, node, target);
    return true;
  }),
  Match.discriminator("type")("heading", (node) => (context: FormatContext): VisitChildren => {
    const { emphasisChar, headingStyle } = context.options;
    return (
      headingStyle === undefined ||
      !formatHeading(context.text, context.emit, node, headingStyle, emphasisChar, context.parseOptions)
    );
  }),
  Match.discriminator("type")("list", (node) => (context: FormatContext): VisitChildren => {
    const target = context.options.bulletChar;
    if (target !== undefined) formatList(context.text, context.emit, node, context.siblings, context.index, target);
    return true;
  }),
  Match.discriminator("type")("emphasis", "strong", (node) => (context: FormatContext): VisitChildren => {
    const target = context.options.emphasisChar;
    if (target !== undefined) formatEmphasis(context.text, context.emit, node, context.siblings, context.index, target);
    return true;
  }),
  Match.discriminator("type")("code", (node) => (context: FormatContext): VisitChildren => {
    formatCode(node, context);
    return true;
  }),
  Match.orElse(
    () =>
      (_context: FormatContext): VisitChildren =>
        true
  )
);

const collectFormatEdits: {
  (
    text: string,
    root: Root,
    options: MarkdownFormattingOptions.Encoded,
    parseOptions: MarkdownParseOptions.Encoded
  ): ReadonlyArray<TaggedEdit>;
  (
    root: Root,
    options: MarkdownFormattingOptions.Encoded,
    parseOptions: MarkdownParseOptions.Encoded
  ): (text: string) => ReadonlyArray<TaggedEdit>;
} = dual(
  4,
  (
    text: string,
    root: Root,
    options: MarkdownFormattingOptions.Encoded,
    parseOptions: MarkdownParseOptions.Encoded
  ): ReadonlyArray<TaggedEdit> => {
    const emit = new FormatEmitter();
    walk(root, undefined, [], 0, (node, parent, siblings, index) =>
      formatNode(node)({ emit, index, options, parent, parseOptions, siblings, text })
    );
    return emit.edits;
  }
);

const editsInRange: {
  (edits: ReadonlyArray<TaggedEdit>, range: MarkdownRangeLike | undefined): ReadonlyArray<TaggedEdit>;
  (range: MarkdownRangeLike | undefined): (edits: ReadonlyArray<TaggedEdit>) => ReadonlyArray<TaggedEdit>;
} = dual(
  2,
  (edits: ReadonlyArray<TaggedEdit>, range: MarkdownRangeLike | undefined): ReadonlyArray<TaggedEdit> =>
    range === undefined
      ? edits
      : A.filter(
          edits,
          (edit) => Math.max(edit.nodeStart, range.offset) <= Math.min(edit.nodeEnd, range.offset + range.length)
        )
);

const thematicBreakStarts = (root: Root): ReadonlyArray<number> => {
  const starts: Array<number> = [];
  walk(root, undefined, [], 0, (node) => {
    if (node.type === "thematicBreak") starts.push(spanOf(node).start);
  });
  return starts;
};

const bulletHazards: {
  (
    text: string,
    root: Root,
    edits: ReadonlyArray<TaggedEdit>,
    parseOptions: MarkdownParseOptions.Encoded
  ): HashSet.HashSet<number>;
  (
    root: Root,
    edits: ReadonlyArray<TaggedEdit>,
    parseOptions: MarkdownParseOptions.Encoded
  ): (text: string) => HashSet.HashSet<number>;
} = dual(
  4,
  (
    text: string,
    root: Root,
    edits: ReadonlyArray<TaggedEdit>,
    parseOptions: MarkdownParseOptions.Encoded
  ): HashSet.HashSet<number> => {
    const bulletEdits = A.filter(edits, (edit) => edit.bullet);
    if (!A.isReadonlyArrayNonEmpty(bulletEdits)) {
      return HashSet.empty();
    }
    const existingBreaks = HashSet.fromIterable(thematicBreakStarts(root));
    const wholeWaveProjection = MarkdownEdit.applyAll(text, A.map(bulletEdits, toMarkdownEdit));
    const hazardLines = Result.match(Markdown.parseResult(wholeWaveProjection, parseOptions), {
      onFailure: () => A.map(bulletEdits, (edit) => lineStartOf(text, edit.offset)),
      onSuccess: (reparsed) =>
        A.map(
          A.filter(thematicBreakStarts(reparsed), (start) => !HashSet.has(existingBreaks, start)),
          (start) => lineStartOf(wholeWaveProjection, start)
        ),
    });
    return HashSet.fromIterable(hazardLines);
  }
);

const FLOW_TYPES = LiteralKit([
  "blockquote",
  "code",
  "definition",
  "footnoteDefinition",
  "heading",
  "html",
  "list",
  "paragraph",
  "table",
  "thematicBreak",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const PHRASING_TYPES = LiteralKit([
  "break",
  "delete",
  "emphasis",
  "footnoteReference",
  "html",
  "image",
  "imageReference",
  "inlineCode",
  "link",
  "linkReference",
  "strong",
  "text",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const hasFlowTypeTag = S.is(S.Struct({ type: FLOW_TYPES }));

const hasPhrasingTypeTag = S.is(S.Struct({ type: PHRASING_TYPES }));

const FLOW_PARENTS = LiteralKit([
  "root",
  "blockquote",
  "listItem",
  "footnoteDefinition",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const PHRASING_PARENTS = LiteralKit([
  "paragraph",
  "heading",
  "emphasis",
  "strong",
  "delete",
  "link",
  "linkReference",
  "tableCell",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const NO_MULTILINE_ANCESTORS = LiteralKit([
  "blockquote",
  "list",
  "listItem",
  "footnoteDefinition",
  "table",
  "tableRow",
  "tableCell",
  "heading",
] satisfies A.NonEmptyReadonlyArray<MarkdownNode["type"]>);

const isFlowParent = S.is(FLOW_PARENTS);
const isPhrasingParent = S.is(PHRASING_PARENTS);
const isNoMultilineAncestor = S.is(NO_MULTILINE_ANCESTORS);

const ReplacementSlot = LiteralKit(["flow", "phrasing", "cell"]);
type ReplacementSlot = typeof ReplacementSlot.Type;

const UNESCAPED_CELL_PIPE = /(?<!\\)((?:\\\\)*)\|/g;

const escapeCellPipes = Str.replaceAll(UNESCAPED_CELL_PIPE, "$1\\|");

const isSameNode = (node: MarkdownNode, target: MarkdownNode): boolean =>
  node === target ||
  (node.type === target.type &&
    node.position.start.offset === target.position.start.offset &&
    node.position.end.offset === target.position.end.offset &&
    Equal.equals(node, target));

interface TreeMatch {
  readonly ancestry: ReadonlyArray<MarkdownNode>;
  readonly node: MarkdownNode;
}

const matchTarget: {
  (root: Root, target: MarkdownNode): O.Option<TreeMatch>;
  (target: MarkdownNode): (root: Root) => O.Option<TreeMatch>;
} = dual(2, (root: Root, target: MarkdownNode): O.Option<TreeMatch> => {
  const search = (node: MarkdownNode, ancestry: ReadonlyArray<MarkdownNode>): O.Option<TreeMatch> =>
    isSameNode(node, target)
      ? O.some({ ancestry, node })
      : A.findFirst(childrenOf(node), (child) => search(child, A.prepend(ancestry, node)));
  return search(root, []);
});

type FailModification = (code: MarkdownModificationErrorCode, detail: string) => MarkdownModificationError;

interface ModifySite {
  readonly ancestry: ReadonlyArray<MarkdownNode>;
  readonly end: number;
  readonly node: MarkdownNode;
  readonly parent: MarkdownNode;
  readonly slot: ReplacementSlot;
  readonly start: number;
}

const slotOf: {
  (target: MarkdownNode, parent: MarkdownNode): O.Option<ReplacementSlot>;
  (parent: MarkdownNode): (target: MarkdownNode) => O.Option<ReplacementSlot>;
} = dual(2, (target: MarkdownNode, parent: MarkdownNode): O.Option<ReplacementSlot> => {
  if (target.type === "tableCell" && parent.type === "tableRow") {
    return O.some("cell");
  }
  if (isFlowParent(parent.type)) {
    return O.some("flow");
  }
  return isPhrasingParent(parent.type) ? O.some("phrasing") : O.none();
});

const locateTarget: {
  (root: Root, target: MarkdownNode, fail: FailModification): Result.Result<ModifySite, MarkdownModificationError>;
  (target: MarkdownNode, fail: FailModification): (root: Root) => Result.Result<ModifySite, MarkdownModificationError>;
} = dual(
  3,
  (root: Root, target: MarkdownNode, fail: FailModification): Result.Result<ModifySite, MarkdownModificationError> => {
    const match = matchTarget(root, target);
    if (O.isNone(match)) {
      return Result.fail(fail("NodeNotInDocument", "the target node is not part of the document's tree"));
    }
    const { ancestry, node } = match.value;
    const parent = A.head(ancestry);
    if (O.isNone(parent) || node.type === "frontmatter") {
      return Result.fail(fail("UnsupportedTarget", `a ${node.type} node cannot be replaced`));
    }
    return O.match(slotOf(node, parent.value), {
      onNone: () =>
        Result.fail(fail("UnsupportedTarget", `a ${node.type} node inside a ${parent.value.type} cannot be replaced`)),
      onSome: (slot) => Result.succeed({ ancestry, node, parent: parent.value, slot, ...spanOf(node) }),
    });
  }
);

const paragraphOf = (children: ReadonlyArray<PhrasingContent>): Paragraph =>
  trustedNode<Paragraph>({ type: "paragraph", children, position: Position.synthetic });

const rootOf = (children: ReadonlyArray<FlowContent>): Root =>
  trustedNode<Root>({ type: "root", children, position: Position.synthetic });

const fragmentRoot: {
  (
    replacement: MarkdownNode | string,
    slot: ReplacementSlot,
    fail: FailModification
  ): Result.Result<Root, MarkdownModificationError>;
  (
    slot: ReplacementSlot,
    fail: FailModification
  ): (replacement: MarkdownNode | string) => Result.Result<Root, MarkdownModificationError>;
} = dual(
  3,
  (
    replacement: MarkdownNode | string,
    slot: ReplacementSlot,
    fail: FailModification
  ): Result.Result<Root, MarkdownModificationError> => {
    if (P.isString(replacement)) {
      return Result.succeed(rootOf([paragraphOf([Text.make({ value: replacement })])]));
    }
    if (slot === "flow") {
      return hasFlowTypeTag(replacement)
        ? Result.succeed(rootOf([replacement]))
        : Result.fail(
            fail(
              "FragmentCategoryMismatch",
              `a ${replacement.type} fragment does not fit a flow slot — pass flow content or a plain string`
            )
          );
    }
    return hasPhrasingTypeTag(replacement)
      ? Result.succeed(rootOf([paragraphOf([replacement])]))
      : Result.fail(
          fail(
            "FragmentCategoryMismatch",
            `a ${replacement.type} fragment does not fit a phrasing slot — pass phrasing content or a plain string`
          )
        );
  }
);

const isLinkLike = (node: MarkdownNode): boolean => node.type === "link" || node.type === "linkReference";

const isCarriageReturnText = (node: MarkdownNode): boolean => node.type === "text" && Str.includes("\r")(node.value);

const closingDelimiterWidth: {
  (ancestor: MarkdownNode, source: string, start: number): number;
  (source: string, start: number): (ancestor: MarkdownNode) => number;
} = dual(3, (ancestor: MarkdownNode, source: string, start: number): number => {
  if (ancestor.type === "emphasis") {
    return 1;
  }
  if (ancestor.type === "strong") {
    return 2;
  }
  return ancestor.type === "delete" ? longestRun(Str.slice(spanOf(ancestor).start, start)(source), "~") : 0;
});

const endsAtClosingDelimiter: {
  (site: ModifySite, source: string): boolean;
  (source: string): (site: ModifySite) => boolean;
} = dual(2, (site: ModifySite, source: string): boolean =>
  A.some(site.ancestry, (ancestor) => {
    const width = closingDelimiterWidth(ancestor, source, site.start);
    return width > 0 && site.end === spanOf(ancestor).end - width;
  })
);

const encodeTrailingWhitespace = (content: string): string => {
  let whitespaceStart = content.length;
  while (whitespaceStart > 0 && SCAN_DELIMS_WHITESPACE.test(Str.slice(whitespaceStart - 1, whitespaceStart)(content))) {
    whitespaceStart -= 1;
  }
  if (whitespaceStart === content.length) {
    return content;
  }
  const references = A.map(
    Str.split(Str.slice(whitespaceStart)(content), ""),
    (char) => `&#${O.getOrThrow(Str.charCodeAt(char, 0))};`
  );
  return Str.slice(0, whitespaceStart)(content) + A.join(references, "");
};

const closingHashRunStart = (projected: string): O.Option<number> => {
  let hashEnd = projected.length;
  while (isSpaceOrTabAt(projected, hashEnd - 1)) hashEnd -= 1;
  let hashStart = hashEnd;
  while (projected[hashStart - 1] === "#") hashStart -= 1;
  return hashStart < hashEnd && (hashStart === 0 || isSpaceOrTabAt(projected, hashStart - 1))
    ? O.some(hashStart)
    : O.none();
};

const isAtxHeading = (node: MarkdownNode): node is Heading => node.type === "heading" && node.headingStyle === "atx";

const escapeAtxClosingRun: {
  (content: string, site: ModifySite, source: string): string;
  (site: ModifySite, source: string): (content: string) => string;
} = dual(3, (content: string, site: ModifySite, source: string): string =>
  pipe(
    A.findFirst(site.ancestry, isAtxHeading),
    O.flatMap((heading) => {
      const prefix = Str.slice(spanOf(heading).start, site.start)(source);
      const projected = prefix + content + Str.slice(site.end, spanOf(heading).end)(source);
      return O.map(closingHashRunStart(projected), (hashStart) => hashStart - prefix.length);
    }),
    O.filter((at) => at >= 0 && at < content.length),
    O.match({
      onNone: () => content,
      onSome: (at) => `${Str.slice(0, at)(content)}\\${Str.slice(at)(content)}`,
    })
  )
);

const contextualContent: {
  (rendered: string, site: ModifySite, source: string): string;
  (site: ModifySite, source: string): (rendered: string) => string;
} = dual(3, (rendered: string, site: ModifySite, source: string): string => {
  const inCell = site.slot === "cell" || A.some(site.ancestry, (ancestor) => ancestor.type === "tableCell");
  const cellSafe = inCell ? escapeCellPipes(rendered) : rendered;
  const flankSafe =
    site.slot === "phrasing" && endsAtClosingDelimiter(site, source) ? encodeTrailingWhitespace(cellSafe) : cellSafe;
  return escapeAtxClosingRun(flankSafe, site, source);
});

const spliceContent: {
  (
    rendered: string,
    site: ModifySite,
    replacement: MarkdownNode | string,
    renderRoot: Root,
    source: string,
    fail: FailModification
  ): Result.Result<string, MarkdownModificationError>;
  (
    site: ModifySite,
    replacement: MarkdownNode | string,
    renderRoot: Root,
    source: string,
    fail: FailModification
  ): (rendered: string) => Result.Result<string, MarkdownModificationError>;
} = dual(
  6,
  (
    rendered: string,
    site: ModifySite,
    replacement: MarkdownNode | string,
    renderRoot: Root,
    source: string,
    fail: FailModification
  ): Result.Result<string, MarkdownModificationError> => {
    if (!P.isString(replacement) && A.some(site.ancestry, isLinkLike) && containsNode(replacement, isLinkLike)) {
      return Result.fail(fail("UnsupportedTarget", "a link replacement cannot be nested inside another link"));
    }
    const noMultiline = A.some(site.ancestry, (ancestor) => isNoMultilineAncestor(ancestor.type));
    if (noMultiline && containsNode(renderRoot, isCarriageReturnText)) {
      return Result.fail(
        fail(
          "UnsupportedTarget",
          "a carriage-return replacement cannot be spliced inside a prefixed or single-line container"
        )
      );
    }
    const content = contextualContent(Str.replace(/\n+$/, "")(rendered), site, source);
    return noMultiline && LINE_TERMINATOR.test(content)
      ? Result.fail(
          fail(
            "UnsupportedTarget",
            "a multi-line replacement cannot be spliced inside a container whose continuation lines carry a prefix"
          )
        )
      : Result.succeed(content);
  }
);

const contextualBlocks: {
  (projected: Root, parent: MarkdownNode): ReadonlyArray<MarkdownNode>;
  (parent: MarkdownNode): (projected: Root) => ReadonlyArray<MarkdownNode>;
} = dual(2, (projected: Root, parent: MarkdownNode): ReadonlyArray<MarkdownNode> => {
  const blocks: Array<MarkdownNode> = [];
  walk(projected, undefined, [], 0, (node, candidateParent) => {
    if (candidateParent?.type === parent.type && spanOf(candidateParent).start === spanOf(parent).start) {
      blocks.push(node);
    }
  });
  return blocks;
});

const hasBlockAt: {
  (blocks: ReadonlyArray<MarkdownNode>, type: MarkdownNode["type"], start: number, end: number): boolean;
  (type: MarkdownNode["type"], start: number, end: number): (blocks: ReadonlyArray<MarkdownNode>) => boolean;
} = dual(4, (blocks: ReadonlyArray<MarkdownNode>, type: MarkdownNode["type"], start: number, end: number): boolean =>
  A.some(
    blocks,
    (candidate) => candidate.type === type && spanOf(candidate).start === start && spanOf(candidate).end === end
  )
);

const followingSibling = (site: ModifySite): O.Option<MarkdownNode> => {
  const siblings = childrenOf(site.parent);
  return O.flatMap(
    A.findFirstIndex(siblings, (node) => node === site.node),
    (index) => A.get(siblings, index + 1)
  );
};

const flowContextFailure: {
  (content: string, document: MarkdownDocument, site: ModifySite): O.Option<string>;
  (document: MarkdownDocument, site: ModifySite): (content: string) => O.Option<string>;
} = dual(3, (content: string, document: MarkdownDocument, site: ModifySite): O.Option<string> => {
  const parseOptions = { dialect: document.dialect, frontmatter: document.frontmatter !== undefined };
  const standalone = Markdown.parseResult(content, parseOptions);
  const projected = Markdown.parseResult(
    Str.slice(0, site.start)(document.source) + content + Str.slice(site.end)(document.source),
    parseOptions
  );
  if (Result.isFailure(standalone) || Result.isFailure(projected)) {
    return O.some("the flow replacement cannot be parsed in its source context");
  }
  const blocks = contextualBlocks(projected.success, site.parent);
  const keepsBlocks = A.every(standalone.success.children, (node) =>
    hasBlockAt(blocks, node.type, site.start + spanOf(node).start, site.start + spanOf(node).end)
  );
  if (!keepsBlocks) {
    return O.some("the block context would absorb the flow replacement or its following sibling");
  }
  const delta = content.length - (site.end - site.start);
  const changesFollowing = O.exists(
    followingSibling(site),
    (following) => !hasBlockAt(blocks, following.type, spanOf(following).start + delta, spanOf(following).end + delta)
  );
  return changesFollowing ? O.some("the flow replacement would absorb or change its following sibling") : O.none();
});

const formatParseOptions = (options: MarkdownFormattingOptions.Encoded | undefined): MarkdownParseOptions =>
  MarkdownParseOptions.make({
    ...O.getSomesStruct({
      dialect: O.fromUndefinedOr(options?.dialect),
      frontmatter: O.fromUndefinedOr(options?.frontmatter),
    }),
  });

/**
 * Normalizes markdown markers and replaces a single node, as byte-minimal
 * edits that leave the rest of the source untouched. Not instantiable.
 *
 * **Details**
 *
 * `format`/`formatToString` are pure and total: input that trips a parse
 * hardening guard yields no edits rather than corrupting the document, and
 * every emitted edit is guarded against the re-parse hazards listed in the
 * module documentation — a hazardous conversion is skipped, never attempted.
 * `modify`/`modifyToString` carry a real error channel
 * ({@link MarkdownModificationError}) and render every replacement through
 * the canonical stringifier, so a modified document re-parses cleanly by
 * construction.
 *
 * **Example** (Normalize markdown markers and replace a paragraph)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
 * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
 * import * as Effect from "effect/Effect";
 *
 * const options = MarkdownFormattingOptions.make({ bulletChar: "-", headingStyle: "atx" });
 * const normalized = MarkdownFormat.formatToString("* a\n* b\n\nSetext\n======\n", undefined, options);
 * console.log(JSON.stringify(normalized)) // "- a\n- b\n\n# Setext\n"
 *
 * const program = Effect.gen(function* () {
 *   const doc = yield* MarkdownDocument.parse("# Title\n\nHello world\n");
 *   const paragraph = doc.root.children[1];
 *   if (paragraph === undefined) return doc.source;
 *   return yield* MarkdownFormat.modifyToString(doc, paragraph, "Goodbye");
 * });
 * console.log(JSON.stringify(Effect.runSync(program))) // "# Title\n\nGoodbye\n"
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export abstract class MarkdownFormat {
  /**
   * Compute marker-normalization edits per the requested
   * {@link MarkdownFormattingOptions}: heading style, bullet character,
   * emphasis/strong marker, fence character, thematic-break character and
   * code-block style, each only where the node's concrete syntax differs
   * from the target and the rewrite is provably safe. Content is never
   * touched. `range` restricts edits to the nodes intersecting it (the
   * owning-node intersection posture, matching toml). Non-mutating — apply
   * with `MarkdownEdit.applyAll` (or use
   * {@link MarkdownFormat.formatToString}).
   *
   * **Gotchas**
   *
   * Note the code-block default: absent `codeBlockStyle`, a language-less
   * code block keeps whichever spelling it has — `fenceChar` alone
   * normalizes existing fences and deliberately leaves indented blocks
   * indented.
   *
   * **Example** (Compute bullet marker edits)
   *
   * ```ts
   * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
   *
   * const options = MarkdownFormattingOptions.make({ bulletChar: "-" });
   * const edits = MarkdownFormat.format("* one\n", undefined, options);
   * console.log(edits.length) // 1
   * ```
   *
   * @param text - The markdown source to format.
   * @param range - Optional sub-range; only edits whose node intersects it are
   *   returned.
   * @param options - Optional {@link MarkdownFormattingOptions}; an absent
   *   marker option normalizes nothing.
   * @returns The edits that normalize the requested markers; apply them with
   *   `MarkdownEdit.applyAll`. Empty when the input trips a parse hardening
   *   guard.
   * @category formatting
   * @since 0.0.0
   */
  static readonly format: {
    (text: string, range?: MarkdownRangeLike, options?: MarkdownFormattingOptions.Encoded): ReadonlyArray<MarkdownEdit>;
    (
      range?: MarkdownRangeLike,
      options?: MarkdownFormattingOptions.Encoded
    ): (text: string) => ReadonlyArray<MarkdownEdit>;
  } = dual(
    (args) => P.isString(args[0]),
    (
      text: string,
      range?: MarkdownRangeLike,
      options?: MarkdownFormattingOptions.Encoded
    ): ReadonlyArray<MarkdownEdit> => {
      const parseOptions = formatParseOptions(options);
      return Result.match(Markdown.parseResult(text, parseOptions), {
        onFailure: () => [],
        onSuccess: (root) => {
          const edits = editsInRange(collectFormatEdits(text, root, options ?? {}, parseOptions), range);
          const hazards = bulletHazards(text, root, edits, parseOptions);
          return A.map(
            A.filter(edits, (edit) => !edit.bullet || !HashSet.has(hazards, lineStartOf(text, edit.offset))),
            toMarkdownEdit
          );
        },
      });
    }
  );

  /**
   * Format `text` and apply the resulting edits in one step
   * (`MarkdownEdit.applyAll ∘ format`). Pure and total.
   *
   * **Example** (Normalize a list in one step)
   *
   * ```ts
   * import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
   *
   * const options = MarkdownFormattingOptions.make({ bulletChar: "-" });
   * console.log(JSON.stringify(MarkdownFormat.formatToString("* one\n", undefined, options))) // "- one\n"
   * ```
   *
   * @param text - The markdown source to format.
   * @param range - Optional sub-range; only edits whose node intersects it are
   *   applied.
   * @param options - Optional {@link MarkdownFormattingOptions}.
   * @returns The formatted text.
   * @category formatting
   * @since 0.0.0
   */
  static readonly formatToString: {
    (text: string, range?: MarkdownRangeLike, options?: MarkdownFormattingOptions.Encoded): string;
    (range?: MarkdownRangeLike, options?: MarkdownFormattingOptions.Encoded): (text: string) => string;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, range?: MarkdownRangeLike, options?: MarkdownFormattingOptions.Encoded): string =>
      MarkdownEdit.applyAll(text, MarkdownFormat.format(text, range, options))
  );

  /**
   * Compute the edit that replaces `target` — a node from `document`'s own
   * tree, matched by reference or by equal value at the same span — with
   * `replacement`: a plain string (treated as literal text and escaped;
   * block-wrapped when the target is a flow node) or a node fragment whose
   * content category must fit the target's slot (flow for flow targets,
   * phrasing for phrasing targets and table cells). Every replacement renders through the canonical stringifier, so
   * the modified document re-parses cleanly by construction. List
   * items, table rows, frontmatter and the root refuse with
   * `UnsupportedTarget`, as does a multi-line replacement whose target sits
   * inside a container (a blockquote, list, table or heading) whose
   * continuation lines the splice cannot prefix.
   *
   * **Gotchas**
   *
   * The fragment's category check reads its `type` tag only — it is a
   * shallow check, not a structural `S.is(FlowContent)` walk (D-39). A
   * fragment is already a typed node (built with `make` or admitted by a
   * parse), and a recursive re-validation would overflow the stack on the
   * over-deep fragments `FragmentUnrenderable` exists to report. A fragment
   * smuggled in through an unchecked cast is the caller's responsibility.
   *
   * **Example** (Compute a paragraph replacement edit)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import { MarkdownFormat } from "@beep/markdown/MarkdownFormat";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const document = yield* MarkdownDocument.parse("Hello\n");
   *   const target = document.root.children[0];
   *   if (target === undefined) return 0;
   *   const edits = yield* MarkdownFormat.modify(document, target, "Goodbye");
   *   return edits.length;
   * });
   * console.log(Effect.runSync(program)) // 1
   * ```
   *
   * @param document - The parsed {@link MarkdownDocument} the target belongs to.
   * @param target - The node to replace; it must be a node of
   *   `document.root`, matched by reference or by equal value at the same
   *   source span.
   * @param replacement - A plain string (literal text) or a node fragment of
   *   the target's content category.
   * @returns An `Effect` that succeeds with the edit to apply (via
   *   `MarkdownEdit.applyAll`), or fails with {@link MarkdownModificationError}.
   * @category formatting
   * @since 0.0.0
   */
  static readonly modify: {
    (
      document: MarkdownDocument,
      target: MarkdownNode,
      replacement: MarkdownNode | string
    ): Effect.Effect<ReadonlyArray<MarkdownEdit>, MarkdownModificationError, never>;
    (
      target: MarkdownNode,
      replacement: MarkdownNode | string
    ): (document: MarkdownDocument) => Effect.Effect<ReadonlyArray<MarkdownEdit>, MarkdownModificationError, never>;
  } = dual(
    3,
    Effect.fn("MarkdownFormat.modify")(function* (
      document: MarkdownDocument,
      target: MarkdownNode,
      replacement: MarkdownNode | string
    ) {
      const { start, end } = spanOf(target);
      const fail: FailModification = (code, detail) =>
        MarkdownModificationError.make({ code, detail, offset: start, length: end - start });
      const site = yield* Effect.fromResult(locateTarget(document.root, target, fail));
      const renderRoot = yield* Effect.fromResult(fragmentRoot(replacement, site.slot, fail));
      const rendered = Markdown.stringifyResult(renderRoot);
      if (Result.isFailure(rendered)) {
        return yield* fail("FragmentUnrenderable", rendered.failure.message);
      }
      const content = yield* Effect.fromResult(
        spliceContent(rendered.success, site, replacement, renderRoot, document.source, fail)
      );
      const flowFailure = site.slot === "flow" ? flowContextFailure(content, document, site) : O.none();
      if (O.isSome(flowFailure)) {
        return yield* fail("UnsupportedTarget", flowFailure.value);
      }
      const edits: ReadonlyArray<MarkdownEdit> = [
        MarkdownEdit.make({ offset: site.start, length: site.end - site.start, content }),
      ];
      return edits;
    })
  );

  /**
   * Modify `document` and apply the resulting edit in one step
   * (`MarkdownEdit.applyAll ∘ modify`).
   *
   * **Example** (Replace a paragraph and apply its edit)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import { MarkdownFormat } from "@beep/markdown/MarkdownFormat";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const document = yield* MarkdownDocument.parse("Hello\n");
   *   const target = document.root.children[0];
   *   if (target === undefined) return document.source;
   *   return yield* MarkdownFormat.modifyToString(document, target, "Goodbye");
   * });
   * console.log(JSON.stringify(Effect.runSync(program))) // "Goodbye\n"
   * ```
   *
   * @param document - The parsed {@link MarkdownDocument} the target belongs to.
   * @param target - The node to replace; it must be a node of
   *   `document.root`, matched by reference or by equal value at the same
   *   source span.
   * @param replacement - A plain string (literal text) or a node fragment of
   *   the target's content category.
   * @returns An `Effect` that succeeds with the modified source, or fails with
   *   {@link MarkdownModificationError}.
   * @category formatting
   * @since 0.0.0
   */
  static readonly modifyToString: {
    (
      document: MarkdownDocument,
      target: MarkdownNode,
      replacement: MarkdownNode | string
    ): Effect.Effect<string, MarkdownModificationError, never>;
    (
      target: MarkdownNode,
      replacement: MarkdownNode | string
    ): (document: MarkdownDocument) => Effect.Effect<string, MarkdownModificationError, never>;
  } = dual(
    3,
    Effect.fn("MarkdownFormat.modifyToString")(function* (
      document: MarkdownDocument,
      target: MarkdownNode,
      replacement: MarkdownNode | string
    ) {
      const edits = yield* MarkdownFormat.modify(document, target, replacement);
      return MarkdownEdit.applyAll(document.source, edits);
    })
  );
}

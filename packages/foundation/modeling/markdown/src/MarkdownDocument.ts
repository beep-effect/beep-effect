/**
 * The lossless unit: source text plus the parsed tree, the materialized
 * diagnostics and the link-reference definition index, in one Schema class.
 *
 * **Details**
 *
 * Cycle firewall: this module never touches raw carriers directly — it shares
 * `Markdown.ts`'s single carrier-catching helper, so the document and the
 * bare-tree entry points agree exactly on what is a typed failure and what is
 * a defect.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { scanFrontmatter } from "./internal/blocks/frontmatter.ts";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { preprocessLines } from "./internal/preprocess.ts";
import { normalizeLabelText } from "./internal/references.ts";
import { MarkdownDialect, parsePassResult } from "./Markdown.ts";
import { MarkdownDiagnostic } from "./MarkdownDiagnostic.ts";
import { MarkdownRange } from "./MarkdownEdit.ts";
import {
  Definition,
  FlowContent,
  Heading,
  HeadingDepth,
  Image,
  ImageReference,
  Link,
  LinkReference,
  Root,
} from "./MarkdownNode.ts";
import type { MarkdownParseError, MarkdownParseOptions } from "./Markdown.ts";
import type {
  Frontmatter,
  MarkdownNode,
  MarkdownNodeOfType,
  MarkdownNodeType,
  PhrasingContent,
} from "./MarkdownNode.ts";

const $I = $MarkdownId.create("MarkdownDocument");

/** The document navigation depth guard was exceeded. */
class DocumentNavigationError extends S.TaggedError<DocumentNavigationError, { readonly brand: unique symbol }>(
  $I`DocumentNavigationError`
)(
  "DocumentNavigationError",
  {
    message: S.String,
  },
  $I.annoteError<DocumentNavigationError>("DocumentNavigationError", {
    description: "The document navigation depth guard was exceeded.",
  })
) {}

/**
 * A heading entry from {@link MarkdownDocument.headings}: the {@link Heading}
 * node plus the derivations navigation wants — its `depth` and its plain-text
 * content.
 *
 * **Details**
 *
 * `text` concatenates the values of text and inline-code descendants, uses
 * image `alt` text where present, renders a hard break as a single space and
 * contributes nothing for raw HTML or footnote references. For the heading
 * exactly as written — inline HTML and code-span backticks included — use
 * {@link MarkdownDocument.headingSource}.
 *
 * **Example** (Validate a derived heading entry)
 *
 * ```ts
 * import { DocumentHeading, MarkdownDocument } from "@beep/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("# Title"));
 * console.log(S.is(DocumentHeading)(doc.headings[0])) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DocumentHeading extends S.Opaque<DocumentHeading, { readonly brand: unique symbol }>()(
  S.Struct({
    node: S.suspend(() => Heading).pipe(
      $I.annoteKey("DocumentHeading.node", { description: "The heading node as it appears in the document tree" })
    ),
    depth: HeadingDepth.pipe(
      $I.annoteKey("DocumentHeading.depth", { description: "Heading level used for outline navigation" })
    ),
    text: S.String.pipe(
      $I.annoteKey("DocumentHeading.text", { description: "Plain-text projection of the heading's phrasing content" })
    ),
  }).pipe(
    $I.annoteSchema("DocumentHeading", {
      description: "Heading navigation entry carrying the heading node, its depth and its derived plain text.",
    })
  )
) {}

/**
 * A heading-delimited span from {@link MarkdownDocument.sections}: the
 * heading, its depth, the source `range` the section occupies, the root-level
 * blocks that follow the heading inside it, and the section's source text.
 *
 * **Details**
 *
 * A section runs from its heading's start offset to the start of the next
 * root-level heading of equal or shallower depth, or to the end of the
 * source. Deeper headings nest inside, so a parent section's `range` and
 * `children` include its subsections — the list is flat, in document order,
 * with `depth` carrying the hierarchy.
 *
 * `source` and `body` are exactly the bytes `range` and `bodyRange` describe,
 * **untrimmed, deliberately**: the strings and the offsets can never
 * disagree. Callers that want the tidy form write `.body.trim()`, visibly.
 *
 * Instances come from {@link MarkdownDocument.sections} and the two finders;
 * there is no reason to construct one directly.
 *
 * **Example** (Read a heading-delimited section)
 *
 * ```ts
 * import { DocumentSection, MarkdownDocument } from "@beep/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
 * const section = doc.firstSection();
 * console.log(S.is(DocumentSection)(section)) // true
 * console.log(section?.heading.type) // heading
 * console.log(section?.depth) // 1
 * console.log(section?.range.offset) // 0
 * console.log(section?.children.length) // 1
 * console.log(section?.bodyRange.offset) // 7
 * console.log(section?.source === doc.source) // true
 * console.log(JSON.stringify(section?.body)) // "\n\nBody."
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DocumentSection extends S.Opaque<DocumentSection, { readonly brand: unique symbol }>()(
  S.Struct({
    heading: S.suspend(() => Heading).pipe(
      $I.annoteKey("DocumentSection.heading", { description: "The root-level heading that opens the section" })
    ),
    depth: HeadingDepth.pipe(
      $I.annoteKey("DocumentSection.depth", { description: "The opening heading's depth, and the section's" })
    ),
    range: MarkdownRange.pipe(
      $I.annoteKey("DocumentSection.range", {
        description: "The whole section including its heading, as a span spliceable by MarkdownEdit",
      })
    ),
    children: S.Array(FlowContent).pipe(
      $I.annoteKey("DocumentSection.children", {
        description: "The root-level blocks after the heading inside the section, subsections included",
      })
    ),
    text: S.String.pipe(
      $I.annoteKey("DocumentSection.text", {
        description:
          "Plain-text projection of the heading's content, derived exactly as DocumentHeading.text, so `## **1.2.3**` reads `1.2.3`",
      })
    ),
    bodyRange: MarkdownRange.pipe(
      $I.annoteKey("DocumentSection.bodyRange", {
        description: "The section without its heading: from the heading node's end offset to the section's end",
      })
    ),
    source: S.String.pipe(
      $I.annoteKey("DocumentSection.source", {
        description: "The section's source text, heading included: exactly the bytes `range` describes",
      })
    ),
    body: S.String.pipe(
      $I.annoteKey("DocumentSection.body", {
        description:
          "The section's source text without its heading, untrimmed: exactly the bytes `bodyRange` describes",
      })
    ),
  }).pipe(
    $I.annoteSchema("DocumentSection", {
      description:
        "A heading-delimited span of a markdown document: the heading, its depth, the section's source range and root-level blocks, and its source text with and without the heading.",
    })
  )
) {}

/**
 * Narrowing options for {@link MarkdownDocument.firstSection} and
 * {@link MarkdownDocument.sectionByHeading}.
 *
 * **Details**
 *
 * `depth` is equality, not a maximum: `{ depth: 2 }` is "the H2 sections",
 * which is the changelog idiom. A depth *range* is a different question and
 * belongs in a predicate.
 *
 * **Example** (Validate an exact-depth query)
 *
 * ```ts
 * import { SectionQueryOptions } from "@beep/markdown/MarkdownDocument";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(SectionQueryOptions)(SectionQueryOptions.make({ depth: 2 }))) // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class SectionQueryOptions extends S.Opaque<SectionQueryOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    depth: S.optionalKey(HeadingDepth).pipe(
      $I.annoteKey("SectionQueryOptions.depth", {
        description: "Exact heading depth to select; omission admits every heading depth",
      })
    ),
  }).pipe(
    $I.annoteSchema("SectionQueryOptions", {
      description: "Optional exact-depth restriction for document section navigation.",
    })
  )
) {}

/**
 * Companion types for {@link SectionQueryOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SectionQueryOptions {
  /**
   * The plain options object the section finders accept: a constructed
   * {@link SectionQueryOptions} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SectionQueryOptions.Encoded;
}

/**
 * How {@link MarkdownDocument.sectionByHeading} decides a section matches: an
 * exact trimmed-text string, a `RegExp`, or a predicate over the text and the
 * section.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SectionHeadingMatch = string | RegExp | ((text: string, section: DocumentSection) => boolean);

/**
 * The node types {@link MarkdownDocument.links} collects: the nodes that
 * carry an outbound URL themselves ({@link Link}, {@link Image},
 * {@link Definition}) and the reference nodes that reach one through the
 * definition index ({@link LinkReference}, {@link ImageReference}).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type LinkBearingNode = Link | Image | Definition | LinkReference | ImageReference;

/**
 * A link entry from {@link MarkdownDocument.links}: the link-bearing node and
 * the URL it points at.
 *
 * **Details**
 *
 * `url` is the node's own `url` field, unmodified — bundle-relative and
 * otherwise non-normalized hrefs pass through exactly as written. For
 * reference nodes it is the matching definition's `url`; when no definition
 * matches (possible only on trees decoded from foreign mdast — the parser
 * never forms an unmatched reference), the field is genuinely absent.
 *
 * **Example** (Validate a resolved link entry)
 *
 * ```ts
 * import { DocumentLink, MarkdownDocument } from "@beep/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("[docs](./docs.md)"));
 * console.log(S.is(DocumentLink)(doc.links[0])) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DocumentLink extends S.Opaque<DocumentLink, { readonly brand: unique symbol }>()(
  S.Struct({
    node: S.Union([Link, Image, Definition, LinkReference, ImageReference]).pipe(
      $I.annoteKey("DocumentLink.node", { description: "Outbound-link or reference node as it appears in the tree" })
    ),
    url: S.optionalKey(S.String).pipe(
      $I.annoteKey("DocumentLink.url", {
        description: "Unmodified outbound URL; absent for unresolved foreign references",
      })
    ),
  }).pipe(
    $I.annoteSchema("DocumentLink", {
      description: "Link navigation entry with the link-bearing node and an optional resolved URL.",
    })
  )
) {}

// The accessor walks recurse over the tree, so they share the engine's depth
// cap. A getter has no typed error channel, so — like `applyAll`'s overlap
// guard — an over-deep tree (reachable only via a hand-built or foreign
// decoded tree; the parser refuses deeper input) is a thrown defect.
type NavigationNode = Frontmatter | MarkdownNode;

const walkTree: {
  (node: NavigationNode, depth: number, visit: (node: NavigationNode) => void): void;
  (depth: number, visit: (node: NavigationNode) => void): (node: NavigationNode) => void;
} = dual(3, (node: NavigationNode, depth: number, visit: (node: NavigationNode) => void): void => {
  if (depth > MAX_NESTING_DEPTH) {
    throw DocumentNavigationError.make({
      message: `NestingDepthExceeded: limit ${MAX_NESTING_DEPTH} exceeded while walking the document tree`,
    });
  }
  visit(node);
  if ("children" in node) {
    for (const child of node.children) {
      walkTree(child, depth + 1, visit);
    }
  }
});

// The inline text the block pass handed to the inline parser for each heading, keyed by the
// heading's start offset. The block pass strips every continuation line's container prefix
// (indentation, blockquote markers, list-item indentation) before inline parsing, so this is the
// heading content exactly as the parser read it, still in source syntax. The document keeps only
// the tree, so the pass runs again with the same dialect and frontmatter capture.
const headingInlineTexts = (source: string, dialect: MarkdownDialect, root: Root): HashMap.HashMap<number, string> =>
  Result.match(
    parsePassResult(source, {
      dialect,
      frontmatter: A.some(root.children, (child) => child.type === "frontmatter"),
    }),
    {
      onFailure: () => HashMap.empty<number, string>(),
      onSuccess: (pass) =>
        HashMap.fromIterable(
          A.flatMap(pass.rawInlines, (slice) =>
            slice.parent.type === "heading" ? [[slice.parent.position.start.offset, slice.text] as const] : []
          )
        ),
    }
  );

// Depth-guarded pre-order search with early exit — `walkTree`'s visit callback
// cannot stop the walk, and `find` should not pay for the rest of the tree
// once it has its match.
const findInTree: {
  (node: NavigationNode, depth: number, predicate: (node: MarkdownNode) => boolean): MarkdownNode | undefined;
  (depth: number, predicate: (node: MarkdownNode) => boolean): (node: NavigationNode) => MarkdownNode | undefined;
} = dual(
  3,
  (node: NavigationNode, depth: number, predicate: (node: MarkdownNode) => boolean): MarkdownNode | undefined => {
    if (depth > MAX_NESTING_DEPTH) {
      throw DocumentNavigationError.make({
        message: `NestingDepthExceeded: limit ${MAX_NESTING_DEPTH} exceeded while walking the document tree`,
      });
    }
    if (predicate(node)) {
      return node;
    }
    if ("children" in node) {
      for (const child of node.children) {
        const found = findInTree(child, depth + 1, predicate);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  }
);

/** Normalize a find/findAll selector — a `type` tag or a predicate — to a predicate. */
const selectorPredicate = (
  selector: MarkdownNodeType | ((node: MarkdownNode) => boolean)
): ((node: MarkdownNode) => boolean) =>
  P.isString(selector) ? (node: MarkdownNode): boolean => node.type === selector : selector;

// The plain-text projection of phrasing content, for DocumentHeading.text and
// DocumentSection.text. MDX policy: a JSX text wrapper is transparent — its
// children's text comes through, so `<span>Title</span>` reads "Title" — while
// a text EXPRESSION contributes nothing: its value is code, not prose, and no
// rendering of it is faithful plain text.
const phrasingText = (nodes: ReadonlyArray<PhrasingContent>): string => {
  let out = "";
  for (const node of nodes) {
    Match.value(node).pipe(
      Match.discriminator("type")("text", "inlineCode", (node) => {
        out += node.value;
      }),
      Match.discriminator("type")("break", () => {
        out += " ";
      }),
      Match.discriminator("type")("image", "imageReference", (node) => {
        out += node.alt ?? "";
      }),
      Match.discriminator("type")(
        "emphasis",
        "strong",
        "delete",
        "link",
        "linkReference",
        "mdxJsxTextElement",
        (node) => {
          out += phrasingText(node.children);
        }
      ),
      Match.discriminator("type")("mdxTextExpression", () => {}),
      Match.orElse(() => {})
    );
  }
  return out;
};

// One root-level heading and its index among the root's blocks: the unit the
// section boundary pass works over, so it scans heading to heading instead of
// re-walking every block for each section.
interface RootHeading {
  readonly index: number;
  readonly node: Heading;
}

const rootHeadings = (blocks: Root["children"]): ReadonlyArray<RootHeading> =>
  A.flatMap(
    blocks,
    (block, index): ReadonlyArray<RootHeading> => (block.type === "heading" ? [{ index, node: block }] : [])
  );

// The nearest later heading (an index into `headings`) recorded at any depth
// from 1 through `depth`: the first heading of equal or shallower depth.
const nearestBoundary: {
  (nextByDepth: ReadonlyArray<number | undefined>, depth: HeadingDepth): number | undefined;
  (depth: HeadingDepth): (nextByDepth: ReadonlyArray<number | undefined>) => number | undefined;
} = dual(2, (nextByDepth: ReadonlyArray<number | undefined>, depth: HeadingDepth): number | undefined =>
  A.reduce(A.take(A.drop(nextByDepth, 1), depth), undefined, (boundary: number | undefined, candidate) =>
    candidate !== undefined && (boundary === undefined || candidate < boundary) ? candidate : boundary
  )
);

// For each root heading, the index of the heading that closes its section, by
// one reverse pass that remembers the nearest later heading at each depth.
const sectionBoundaries = (headings: ReadonlyArray<RootHeading>): ReadonlyArray<number | undefined> => {
  const nextByDepth = A.makeBy(7, (): number | undefined => undefined);
  const boundaries = A.makeBy(headings.length, (): number | undefined => undefined);
  for (let index = headings.length - 1; index >= 0; index -= 1) {
    const depth = A.getUnsafe(headings, index).node.depth;
    boundaries[index] = nearestBoundary(nextByDepth, depth);
    nextByDepth[depth] = index;
  }
  return boundaries;
};

const isSectionChild = (child: Root["children"][number]): child is FlowContent =>
  child.type !== "frontmatter" && child.type !== "mdxjsEsm";

const makeSection = (
  source: string,
  blocks: Root["children"],
  current: RootHeading,
  boundary: { readonly offset: number; readonly index: number }
): DocumentSection => {
  const block = current.node;
  const start = block.position.start.offset;
  // The body starts where the heading NODE ends, which is what makes this
  // correct for setext headings too: their node span covers the underline,
  // so the body never begins mid-`---`.
  const bodyStart = block.position.end.offset;
  const bodyLength = Math.max(0, boundary.offset - bodyStart);
  return DocumentSection.make({
    heading: block,
    depth: block.depth,
    range: MarkdownRange.make({ offset: start, length: boundary.offset - start }),
    children: A.filter(A.take(A.drop(blocks, current.index + 1), boundary.index - current.index - 1), isSectionChild),
    text: phrasingText(block.children),
    bodyRange: MarkdownRange.make({ offset: bodyStart, length: bodyLength }),
    source: Str.slice(start, boundary.offset)(source),
    body: Str.slice(bodyStart, bodyStart + bodyLength)(source),
  });
};

const atDepth =
  (depth: HeadingDepth | undefined) =>
  (section: DocumentSection): boolean =>
    depth === undefined || section.depth === depth;

const headingMatcher = (match: SectionHeadingMatch): ((section: DocumentSection) => boolean) => {
  if (P.isString(match)) {
    return (section) => Str.trim(section.text) === match;
  }
  if (P.isRegExp(match)) {
    return (section) => {
      // A `/g/` or `/y/` regex carries `lastIndex` between calls, so reusing
      // one across sections would test from the wrong offset and skip
      // matches.
      match.lastIndex = 0;
      return match.test(Str.trim(section.text));
    };
  }
  return (section) => match(section.text, section);
};

/**
 * A parsed markdown document: the original `source`, the mdast-shaped
 * {@link Root} tree, the non-fatal {@link MarkdownDiagnostic}s the parse
 * produced, and the link-reference `definitions` index.
 *
 * **Details**
 *
 * The document is the lossless unit — `source` is retained so offsets on the
 * tree stay meaningful and so the edit and format layer can splice against
 * the exact bytes that were parsed.
 *
 * `definitions` is an index over the {@link Definition} nodes that remain in
 * the tree, keyed by case-folded label with the first definition winning; it
 * is not a place they were moved to. References are emitted unresolved, so
 * resolution happens against this map.
 *
 * `diagnostics` is empty for every input the parser currently accepts: the
 * plumbing from the engine through to this field exists, but no construct
 * emits a non-fatal diagnostic yet. Read an empty array as "nothing to
 * report", and do not code against it staying empty — fatal conditions fail
 * through `MarkdownParseError` instead.
 *
 * The navigation accessors (`headings`, `sections`, `links`) are derived
 * getters over the tree — no stored state, no parse-time cost, and they can
 * never disagree with the tree they read.
 *
 * **Example** (Read document headings and link URLs)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nSee [docs](./docs.md).\n\n## Usage\n"));
 * console.log(doc.headings.map((heading) => heading.text).join(", ")) // Title, Usage
 * console.log(doc.links.map((link) => link.url).join(", ")) // ./docs.md
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MarkdownDocument extends S.Class<MarkdownDocument, { readonly brand: unique symbol }>(
  $I`MarkdownDocument`
)(
  {
    source: S.String.pipe(
      $I.annoteKey("MarkdownDocument.source", {
        description:
          "Original markdown text retained so tree positions and surgical edits refer to the exact parsed source",
      })
    ),
    dialect: MarkdownDialect.pipe(
      S.withDecodingDefaultKey(Effect.succeed<MarkdownDialect>("gfm")),
      S.withConstructorDefault(Effect.succeed<MarkdownDialect>("gfm")),
      $I.annoteKey("MarkdownDocument.dialect", {
        description: "Resolved grammar used for parsing and contextual modification checks; defaults to gfm",
      })
    ),
    root: S.suspend(() => Root).pipe(
      $I.annoteKey("MarkdownDocument.root", {
        description: "Parsed mdast-shaped document tree carrying source positions and fidelity details",
      })
    ),
    diagnostics: S.Array(MarkdownDiagnostic).pipe(
      $I.annoteKey("MarkdownDocument.diagnostics", {
        description: "Non-fatal conditions reported during parsing; currently empty for every accepted document",
      })
    ),
    definitions: S.HashMap(S.String, Definition).pipe(
      $I.annoteKey("MarkdownDocument.definitions", {
        description:
          "Link-reference definitions indexed by normalized, case-folded label, with the first definition winning; each node equals the tree's definition node at its span",
      })
    ),
    definitionOrder: S.Array(S.Tuple([S.String, Definition])).pipe(
      $I.annoteKey("MarkdownDocument.definitionOrder", {
        description:
          "Winning normalized labels and their definition nodes (equal to the tree's) in document order; HashMap iteration order is unspecified",
      })
    ),
  },
  $I.annote("MarkdownDocument", {
    description:
      "A parsed markdown document: the original `source`, the mdast-shaped Root tree, the non-fatal MarkdownDiagnostics the parse produced, and the link-reference `definitions` index.",
  })
) {
  /**
   * The document's frontmatter capture, or `undefined` when there is none.
   *
   * **Details**
   *
   * Derived from the tree rather than stored: a {@link Frontmatter} node can
   * only ever sit at the head of `root.children` (the capture fires at most
   * once, at offset 0), so the tree is the single source of truth and the
   * accessor can never disagree with it. `undefined` covers both a document
   * with no frontmatter block and one parsed with the capture toggle off —
   * {@link MarkdownDocument.hasFrontmatterBlock} tells the two apart.
   *
   * **Example** (Read an opted-in frontmatter capture)
   *
   * ```ts
   * import { MarkdownParseOptions } from "@beep/markdown/Markdown";
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(
   *   MarkdownDocument.parse("---\ntitle: Notes\n---\nBody", MarkdownParseOptions.make({ frontmatter: true })),
   * );
   * console.log(doc.frontmatter?.type) // frontmatter
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get frontmatter(): Frontmatter | undefined {
    const head = this.root.children[0];
    return head !== undefined && head.type === "frontmatter" ? head : undefined;
  }

  /**
   * Whether the source opens with a well-formed frontmatter block —
   * regardless of how the document was parsed.
   *
   * **Details**
   *
   * The structural signal that disambiguates the `frontmatter` accessor's
   * `undefined`: capture is opt-in (`MarkdownParseOptions.frontmatter`
   * defaults off), so a document whose source visibly starts with `---` can
   * still carry no capture node — spec-correct CommonMark reads the fences as
   * a thematic break plus content. `frontmatter === undefined` with
   * `hasFrontmatterBlock === true` means exactly "parsed with capture off";
   * with `false` it means the source genuinely has no block.
   *
   * Derived, not stored: the getter runs the **same** pre-scan the parser
   * runs when capture is enabled (the closed fence grammar — `---` yaml,
   * `+++` toml, `---json` json; an unclosed fence is not frontmatter), so it
   * is `true` exactly when parsing this source with `frontmatter: true`
   * would produce a capture node, and the two can never drift. Like the
   * other navigation accessors it recomputes per access — bind it once when
   * checking repeatedly.
   *
   * **Example** (Detect frontmatter with capture disabled)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("---\ntitle: Notes\n---\nBody"));
   * console.log(doc.frontmatter) // undefined
   * console.log(doc.hasFrontmatterBlock) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  get hasFrontmatterBlock(): boolean {
    return scanFrontmatter(preprocessLines(this.source), this.source) !== null;
  }

  /**
   * Every heading in the document, in document order, wherever it sits —
   * including headings nested inside blockquotes and list items.
   *
   * **Details**
   *
   * Each {@link DocumentHeading} carries the node, its depth and its
   * plain-text content. For an outline restricted to section boundaries, use
   * {@link MarkdownDocument.sections}, which considers root-level headings
   * only.
   *
   * **Example** (Include headings nested in blockquotes)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\n> ## Quoted"));
   * console.log(doc.headings.map((heading) => heading.text).join(", ")) // Title, Quoted
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get headings(): ReadonlyArray<DocumentHeading> {
    const entries: Array<DocumentHeading> = [];
    for (const child of this.root.children) {
      walkTree(child, 1, (node) => {
        if (node.type === "heading") {
          entries.push(DocumentHeading.make({ node, depth: node.depth, text: phrasingText(node.children) }));
        }
      });
    }
    return entries;
  }

  /**
   * The source text of a heading's content, exactly as written: from its
   * first child's start to its last child's end.
   *
   * **Details**
   *
   * {@link DocumentHeading.text} is a plain-text projection, so it drops
   * inline HTML and code-span backticks; this is the lossless reading. The
   * ATX markers, the optional closing `#` sequence and a setext underline lie
   * outside the content span and never appear. A heading with no content
   * reads `""`. The heading must come from this document's tree (its
   * positions index into {@link MarkdownDocument.source}).
   *
   * **Example** (Read a heading as written)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Use `Effect.gen` <b>now</b> #\n"));
   * const [heading] = doc.headings;
   * console.log(heading?.text) // Use Effect.gen now
   * console.log(heading === undefined ? "" : doc.headingSource(heading.node)) // Use `Effect.gen` <b>now</b>
   * ```
   *
   * @param heading - A heading node from this document's tree.
   * @returns The heading content's source slice.
   * @category getters
   * @since 0.0.0
   */
  headingSource(heading: Heading): string {
    return A.match(heading.children, {
      onEmpty: () => "",
      onNonEmpty: (children) =>
        Str.slice(
          A.headNonEmpty(children).position.start.offset,
          A.lastNonEmpty(children).position.end.offset
        )(this.source),
    });
  }

  /**
   * The source text of a heading's content with each continuation line's
   * container prefix removed: what the parser read as the heading's inline
   * content, still in source syntax.
   *
   * **Details**
   *
   * A multi-line setext heading inside a blockquote or list item repeats
   * the container's prefix (indentation, `>` markers) on each continuation
   * line. {@link MarkdownDocument.headingSource} keeps those characters;
   * this reading is the text the block pass handed to the inline parser,
   * which has them stripped, so a `>` that is literal text (indented four or
   * more columns past its containers) or escaped stays. Line breaks are kept,
   * and a one-line heading reads the same as `headingSource`. Each call runs
   * the parse pass again; read {@link MarkdownDocument.headingContents} for
   * every heading at once.
   *
   * **Example** (A quoted multi-line heading)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("> Foo\n> *bar*\n> ===\n"));
   * const [heading] = doc.headings;
   * console.log(heading === undefined ? "" : doc.headingContent(heading.node)) // Foo\n*bar*
   * ```
   *
   * @param heading - A heading node from this document's tree.
   * @returns The heading content's source with container prefixes removed.
   * @category getters
   * @since 0.0.0
   */
  headingContent(heading: Heading): string {
    return O.getOrElse(
      HashMap.get(headingInlineTexts(this.source, this.dialect, this.root), heading.position.start.offset),
      () => this.headingSource(heading)
    );
  }

  /**
   * {@link MarkdownDocument.headingContent} for every heading, in the order
   * of {@link MarkdownDocument.headings}, from one parse pass.
   *
   * **Example** (Every heading's content)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# One\n\n> Two\n> lines\n> ===\n"));
   * console.log(doc.headingContents) // ["One", "Two\nlines"]
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get headingContents(): ReadonlyArray<string> {
    const texts = headingInlineTexts(this.source, this.dialect, this.root);
    return A.map(this.headings, ({ node }) =>
      O.getOrElse(HashMap.get(texts, node.position.start.offset), () => this.headingSource(node))
    );
  }

  /**
   * The document's heading-delimited sections, flat and in document order.
   *
   * **Details**
   *
   * Only root-level headings delimit sections — a heading inside a
   * blockquote or list cannot mark a span of root-level source. Content
   * before the first heading (the preamble) and the frontmatter block belong
   * to no section. Each {@link DocumentSection.range} is spliceable by the
   * edit layer: it runs from the heading's start offset to the next
   * boundary heading's start, or to the end of the source.
   *
   * **Example** (Restrict section boundaries to root headings)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\n> ## Quoted"));
   * console.log(doc.sections.map((section) => section.text).join(", ")) // Title
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get sections(): ReadonlyArray<DocumentSection> {
    const blocks = this.root.children;
    const headings = rootHeadings(blocks);
    const boundaries = sectionBoundaries(headings);
    return A.map(headings, (current, index) => {
      const boundaryHeading = O.flatMap(O.fromUndefinedOr(A.getUnsafe(boundaries, index)), (next) =>
        A.get(headings, next)
      );
      return makeSection(this.source, blocks, current, {
        offset: O.match(boundaryHeading, {
          onNone: () => this.source.length,
          onSome: (next) => next.node.position.start.offset,
        }),
        index: O.match(boundaryHeading, { onNone: () => blocks.length, onSome: (next) => next.index }),
      });
    });
  }

  /**
   * The first section in document order, optionally restricted by heading
   * depth.
   *
   * **Details**
   *
   * `firstSection({ depth: 2 })` is "the newest entry" for a changelog whose
   * releases are H2s under an H1 title. Like the other navigation accessors
   * this recomputes {@link MarkdownDocument.sections}; a caller scanning one
   * document repeatedly should bind `document.sections` once instead.
   *
   * **Example** (Find the newest H2 release)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Changelog\n\n## 1.2.30\n\nLatest\n\n## 1.2.3\n\nOlder"));
   * console.log(doc.firstSection({ depth: 2 })?.text) // 1.2.30
   * ```
   *
   * @param options - Depth restriction.
   * @returns The first matching section, or `undefined`.
   * @category queries
   * @since 0.0.0
   */
  firstSection(options?: SectionQueryOptions.Encoded): DocumentSection | undefined {
    return pipe(this.sections, A.findFirst(atDepth(options?.depth)), O.getOrUndefined);
  }

  /**
   * The first section whose heading matches, in document order.
   *
   * **Gotchas**
   *
   * A **string matches the trimmed heading text exactly** — never a substring.
   * That is a deliberate refusal of the obvious convenience: `"1.2.3"` would
   * otherwise match a `## 1.2.30` heading, and in a changelog (where `1.2.30`
   * sorts newer and therefore sits *earlier*) that silently publishes the
   * wrong release. A `RegExp` is tested against the same trimmed text, and its
   * `lastIndex` is reset first so a `/g/` pattern cannot skip sections. A
   * predicate receives the raw {@link DocumentSection.text} plus the section
   * itself and decides freely.
   *
   * **Example** (Match a release heading exactly)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Changelog\n\n## 1.2.30\n\nLatest\n\n## 1.2.3\n\nOlder"));
   * console.log(doc.sectionByHeading("1.2.3", { depth: 2 })?.text) // 1.2.3
   * ```
   *
   * @param match - A string, a RegExp, or a predicate.
   * @param options - Depth restriction, applied before matching.
   * @returns The first matching section, or `undefined`.
   * @category queries
   * @since 0.0.0
   */
  sectionByHeading(match: SectionHeadingMatch, options?: SectionQueryOptions.Encoded): DocumentSection | undefined {
    const depthMatches = atDepth(options?.depth);
    const headingMatches = headingMatcher(match);
    return pipe(
      this.sections,
      A.findFirst((section) => depthMatches(section) && headingMatches(section)),
      O.getOrUndefined
    );
  }

  /**
   * Every link-bearing node in the document, in document order: links,
   * images, definitions, and the reference forms resolved through the
   * definition index.
   *
   * **Details**
   *
   * See {@link DocumentLink} for the url semantics — the raw `url` string
   * passes through unmodified, and an unresolvable foreign reference leaves
   * the field genuinely absent. Autolinks and GFM autolink literals are
   * {@link Link} nodes, so they appear with no special casing. Footnote
   * references carry no URL and are not link entries.
   *
   * **Example** (Resolve a reference without normalizing its URL)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("[docs][guide]\n\n[guide]: ./docs.md"));
   * console.log(doc.links.map((link) => link.url).join(", ")) // ./docs.md, ./docs.md
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get links(): ReadonlyArray<DocumentLink> {
    const entries: Array<DocumentLink> = [];
    for (const child of this.root.children) {
      walkTree(child, 1, (node) => {
        Match.value(node).pipe(
          Match.discriminator("type")("link", "image", "definition", (node) => {
            entries.push(DocumentLink.make({ node, url: node.url }));
          }),
          Match.discriminator("type")("linkReference", "imageReference", (node) => {
            const definition = HashMap.get(this.definitions, normalizeLabelText(node.identifier));
            entries.push(
              DocumentLink.make({
                node,
                ...O.getSomesStruct({ url: O.map(definition, (resolved) => resolved.url) }),
              })
            );
          }),
          Match.orElse(() => {})
        );
      });
    }
    return entries;
  }

  /**
   * Find the first node matching a selector, in document pre-order — the
   * same order {@link MarkdownVisitor} enters nodes, starting at the root
   * itself.
   *
   * **Details**
   *
   * A string selector matches on the node's `type` tag and narrows the
   * result (`find("heading")` is `Heading | undefined`); a type-guard
   * predicate narrows the same way, and a plain predicate returns the wide
   * `MarkdownNode` union. The returned node is the document's own — matched
   * and returnable by identity, so it feeds `MarkdownFormat.modify`
   * directly. Like the navigation getters, the walk is synchronous with no
   * error channel: a tree nested past the depth cap (reachable only via a
   * hand-built or foreign decoded tree) is a thrown defect.
   *
   * **Example** (Find a heading and retain node identity)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Title"));
   * console.log(doc.find("heading")?.depth) // 1
   * console.log(doc.find("heading") === doc.root.children[0]) // true
   * ```
   *
   * @param selector - A node `type` tag or a predicate over nodes.
   * @returns The first matching node in document order, or `undefined`.
   * @category queries
   * @since 0.0.0
   */
  find<T extends MarkdownNodeType>(selector: T): MarkdownNodeOfType<T> | undefined;
  find<T extends MarkdownNode>(selector: (node: MarkdownNode) => node is T): T | undefined;
  find(selector: (node: MarkdownNode) => boolean): MarkdownNode | undefined;
  find(selector: MarkdownNodeType | ((node: MarkdownNode) => boolean)): MarkdownNode | undefined {
    return findInTree(this.root, 0, selectorPredicate(selector));
  }

  /**
   * Find every node matching a selector, in document pre-order — the same
   * order {@link MarkdownVisitor} enters nodes, starting at the root itself.
   *
   * **Details**
   *
   * Selector and narrowing semantics are `MarkdownDocument.find`'s; so is
   * the guard posture — an over-deep hand-built or foreign tree is a
   * thrown defect. Nodes are the document's own, matched by identity, so
   * `findAll("heading")[1]` addresses the second heading for
   * `MarkdownFormat.modify` without raw child indexing.
   *
   * **Example** (Collect all headings in pre-order)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\n## Usage"));
   * console.log(doc.findAll("heading").map((heading) => heading.depth).join(", ")) // 1, 2
   * ```
   *
   * @param selector - A node `type` tag or a predicate over nodes.
   * @returns Every matching node, in document order; empty when none match.
   * @category queries
   * @since 0.0.0
   */
  findAll<T extends MarkdownNodeType>(selector: T): ReadonlyArray<MarkdownNodeOfType<T>>;
  findAll<T extends MarkdownNode>(selector: (node: MarkdownNode) => node is T): ReadonlyArray<T>;
  findAll(selector: (node: MarkdownNode) => boolean): ReadonlyArray<MarkdownNode>;
  findAll(selector: MarkdownNodeType | ((node: MarkdownNode) => boolean)): ReadonlyArray<MarkdownNode> {
    const predicate = selectorPredicate(selector);
    const matches: Array<MarkdownNode> = [];
    walkTree(this.root, 0, (node) => {
      if (predicate(node)) {
        matches.push(node);
      }
    });
    return matches;
  }

  /**
   * Parse markdown into a {@link MarkdownDocument}, synchronously, as a
   * `Result`. The pure primitive; {@link MarkdownDocument.parse} is defined
   * in terms of it, so the two never diverge.
   *
   * **Details**
   *
   * Carries no span: it is not an `Effect`. Effect callers should reach for
   * {@link MarkdownDocument.parse}, which carries the
   * `MarkdownDocument.parse` tracing span.
   *
   * **Example** (Inspect a synchronous parse result)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Result from "effect/Result";
   *
   * const result = MarkdownDocument.parseResult("# Title");
   * console.log(Result.isSuccess(result)) // true
   * ```
   *
   * @param text - The markdown source to parse.
   * @param options - Optional {@link MarkdownParseOptions}; the dialect
   *   defaults to `"gfm"`.
   * @returns A `Result` succeeding with the document, or failing with
   *   `MarkdownParseError`.
   * @category parsing
   * @since 0.0.0
   */
  static readonly parseResult: {
    (text: string, options?: MarkdownParseOptions.Encoded): Result.Result<MarkdownDocument, MarkdownParseError>;
    (options?: MarkdownParseOptions.Encoded): (text: string) => Result.Result<MarkdownDocument, MarkdownParseError>;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, options?: MarkdownParseOptions.Encoded): Result.Result<MarkdownDocument, MarkdownParseError> =>
      Result.map(parsePassResult(text, options), (pass) =>
        MarkdownDocument.make({
          source: text,
          dialect: options?.dialect ?? "gfm",
          root: pass.root,
          diagnostics: [],
          definitions: pass.refmap,
          definitionOrder: pass.definitionOrder,
        })
      )
  );

  /**
   * Parse markdown into a {@link MarkdownDocument}. Defined in terms of
   * {@link MarkdownDocument.parseResult} — synchronous callers can use that
   * variant directly.
   *
   * **Example** (Run a document parse without services)
   *
   * ```ts
   * import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
   * import * as Effect from "effect/Effect";
   *
   * const doc = Effect.runSync(MarkdownDocument.parse("# Title"));
   * console.log(doc.headings[0]?.text) // Title
   * ```
   *
   * @param text - The markdown source to parse.
   * @param options - Optional {@link MarkdownParseOptions}; the dialect
   *   defaults to `"gfm"`.
   * @returns An `Effect` that succeeds with the document, or fails with
   *   `MarkdownParseError`.
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse: {
    (text: string, options?: MarkdownParseOptions.Encoded): Effect.Effect<MarkdownDocument, MarkdownParseError, never>;
    (
      options?: MarkdownParseOptions.Encoded
    ): (text: string) => Effect.Effect<MarkdownDocument, MarkdownParseError, never>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("MarkdownDocument.parse")((text: string, options?: MarkdownParseOptions.Encoded) =>
      Effect.fromResult(MarkdownDocument.parseResult(text, options))
    )
  );
}

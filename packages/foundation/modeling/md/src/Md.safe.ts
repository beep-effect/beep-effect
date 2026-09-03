/**
 * Trust-boundary refinements for user-authored Markdown documents.
 *
 * The general {@link Document} schema remains lossless persistence truth.
 * `SafeDocument` is the narrower RPC/editor boundary: it rejects trusted raw
 * nodes, URL destinations outside the canonical user-content policies,
 * duplicate footnote definitions, strings that cannot reach the safe HTML
 * serializer, and structures whose direct HTML projection is non-conforming,
 * while retaining the exact same encoded JSON representation.
 *
 * @packageDocumentation \@beep/md/Md.safe
 * @since 0.0.0
 */

import { Html } from "@beep/html";
import { HtmlConformanceIssue } from "@beep/html/Html.conformance";
import { SafeImageUrlAttribute, SafeUrlAttribute } from "@beep/html/Html.policy";
import { $MdId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "@beep/utils/Array";
import { Number as N, Result, Struct } from "effect";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  isUrlDestinationAllowedWithPolicy,
  UserContentImageUrlPolicySpec,
  UserContentLinkUrlPolicySpec,
} from "./Md.escape.ts";
import { Block, Document, FootnoteIdentifier, Inline } from "./Md.model.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";
import type { FootnoteIdentifier as FootnoteIdentifierValue, ListItemChild } from "./Md.model.ts";

const $I = $MdId.create("Md.safe");

/**
 * Maximum Markdown AST nodes admitted by the user-content document boundary.
 *
 * **Example** (Inspect the document complexity ceiling)
 *
 * ```ts import.meta.vitest name="Inspect the document complexity ceiling"
 * import { MAX_SAFE_DOCUMENT_NODES } from "@beep/md/Md.safe"
 *
 * MAX_SAFE_DOCUMENT_NODES // => 10000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_SAFE_DOCUMENT_NODES = 10_000;

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * A stable path segment locating a safety violation in the Markdown AST.
 *
 * **Example** (Use DocumentSafetyPathSegment)
 *
 * ```ts import.meta.vitest name="Use DocumentSafetyPathSegment"
 * import { DocumentSafetyPathSegment } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(DocumentSafetyPathSegment)(2)
 * if (Result.isSuccess(decoded)) {
 *   decoded.success // => 2
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentSafetyPathSegment = S.Union([S.String, S.Int.check(S.isGreaterThanOrEqualTo(0))]).pipe(
  $I.annoteSchema("DocumentSafetyPathSegment", {
    description: "String property name or numeric array index in a Markdown AST path.",
  })
);

/**
 * Type for {@link DocumentSafetyPathSegment}.
 *
 * **Example** (Use DocumentSafetyPathSegment)
 *
 * ```ts import.meta.vitest name="Use DocumentSafetyPathSegment"
 * import type { DocumentSafetyPathSegment } from "@beep/md/Md.safe"
 *
 * const segment: DocumentSafetyPathSegment = "children"
 * segment // => "children"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentSafetyPathSegment = typeof DocumentSafetyPathSegment.Type;

/**
 * A trusted raw Markdown or HTML node found at a user-content boundary.
 *
 * **Example** (Use RawNodeSafetyViolation)
 *
 * ```ts import.meta.vitest name="Use RawNodeSafetyViolation"
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = RawNodeSafetyViolation.make({ path: ["children", 0], nodeTag: "rawHtml" })
 * issue._tag // => "RawNode"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RawNodeSafetyViolation extends S.TaggedClass<RawNodeSafetyViolation>($I`RawNodeSafetyViolation`)(
  "RawNode",
  {
    path: S.Array(DocumentSafetyPathSegment),
    nodeTag: S.Literals(["rawMarkdown", "rawHtml"]),
  },
  $I.annote("RawNodeSafetyViolation", {
    description: "Path-located trusted raw node rejected by the user-content boundary.",
  })
) {}

/**
 * Destination family for a URL-bearing Markdown node.
 *
 * **Example** (Check a link destination kind)
 *
 * ```ts
 * import { DestinationKind } from "@beep/md/Md.safe"
 *
 * console.log(DestinationKind.is.link("link"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DestinationKind = LiteralKit(["link", "image"]).pipe(
  $I.annoteSchema("DestinationKind", {
    description: "Whether a URL-bearing Markdown node is a link or an image.",
  })
);

/**
 * Runtime type for {@link DestinationKind}.
 *
 * **Example** (Type a destination kind)
 *
 * ```ts
 * import type { DestinationKind } from "@beep/md/Md.safe"
 *
 * const kind: DestinationKind = "link"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DestinationKind = typeof DestinationKind.Type;

/**
 * HTML tag names that can carry a URL destination.
 *
 * **Example** (Check an anchor tag)
 *
 * ```ts
 * import { UrlNodeTag } from "@beep/md/Md.safe"
 *
 * console.log(UrlNodeTag.is.a("a"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UrlNodeTag = LiteralKit(["a", "img", "embed"]).pipe(
  $I.annoteSchema("UrlNodeTag", {
    description: "HTML tag that may carry a user-content URL destination.",
  })
);

/**
 * Runtime type for {@link UrlNodeTag}.
 *
 * **Example** (Type a URL node tag)
 *
 * ```ts
 * import type { UrlNodeTag } from "@beep/md/Md.safe"
 *
 * const tag: UrlNodeTag = "a"
 * console.log(tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UrlNodeTag = typeof UrlNodeTag.Type;

/**
 * A URL-bearing Markdown node whose destination is outside its user-content
 * allow list.
 *
 * **Example** (Use UrlSafetyViolation)
 *
 * ```ts import.meta.vitest name="Use UrlSafetyViolation"
 * import { UrlSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = UrlSafetyViolation.make({
 *   path: ["children", 0, "href"],
 *   nodeTag: "a",
 *   destination: "http://example.com",
 *   destinationKind: "link",
 * })
 * issue.destinationKind // => "link"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UrlSafetyViolation extends S.TaggedClass<UrlSafetyViolation>($I`UrlSafetyViolation`)(
  "UnsafeUrl",
  {
    path: DocumentSafetyPathSegment.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults),
    nodeTag: UrlNodeTag,
    destination: S.String,
    destinationKind: DestinationKind,
  },
  $I.annote("UrlSafetyViolation", {
    description: "Path-located URL rejected by the canonical user-content policy.",
  })
) {}

/**
 * A string containing a code point that cannot be represented by the canonical
 * HTML serializer.
 *
 * **Example** (Use ScalarSafetyViolation)
 *
 * ```ts import.meta.vitest name="Use ScalarSafetyViolation"
 * import { ScalarSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = ScalarSafetyViolation.make({ path: ["children", 0, "value"] })
 * issue._tag // => "InvalidScalar"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ScalarSafetyViolation extends S.TaggedError<ScalarSafetyViolation>($I`ScalarSafetyViolation`)(
  "InvalidScalar",
  {
    path: S.Array(DocumentSafetyPathSegment),
  },
  $I.annoteError<ScalarSafetyViolation>("ScalarSafetyViolation", {
    description: "Path-located NUL code point or lone UTF-16 surrogate rejected before safe HTML projection.",
  })
) {}

/**
 * A repeated footnote-definition identifier that would produce duplicate HTML
 * ids during safe projection.
 *
 * **Example** (Use DuplicateFootnoteDefinitionSafetyViolation)
 *
 * ```ts import.meta.vitest name="Use DuplicateFootnoteDefinitionSafetyViolation"
 * import { DuplicateFootnoteDefinitionSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = DuplicateFootnoteDefinitionSafetyViolation.make({
 *   identifier: "note",
 *   path: ["children", 1, "identifier"],
 * })
 * issue._tag // => "DuplicateFootnoteDefinition"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuplicateFootnoteDefinitionSafetyViolation extends S.TaggedError<DuplicateFootnoteDefinitionSafetyViolation>(
  $I`DuplicateFootnoteDefinitionSafetyViolation`
)(
  "DuplicateFootnoteDefinition",
  {
    identifier: FootnoteIdentifier,
    path: S.Array(DocumentSafetyPathSegment),
  },
  $I.annoteError<DuplicateFootnoteDefinitionSafetyViolation>("DuplicateFootnoteDefinitionSafetyViolation", {
    description: "Path-located repeated footnote definition rejected before safe HTML projection.",
  })
) {}

/**
 * An HTML conformance issue produced by the canonical Markdown projection.
 *
 * **Details**
 *
 * `path` addresses the projected `@beep/html` tree using the HTML
 * conformance inspector's path syntax. Other safety variants address the
 * source Markdown AST.
 *
 * **Example** (Use HtmlProjectionSafetyViolation)
 *
 * ```ts import.meta.vitest name="Use HtmlProjectionSafetyViolation"
 * import { HtmlProjectionSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = HtmlProjectionSafetyViolation.make({
 *   path: ["children.1"],
 *   rule: "headingOutline",
 *   message: "The projected heading skips an outline level",
 * })
 * issue._tag // => "HtmlProjection"
 * ```
 *
 * @invariant Every instance describes a hard author-conformance failure returned by the canonical `Document.toHtml` projection.
 * @see {@link https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines | WHATWG HTML headings and outlines} for the mandatory heading-level progression rule.
 * @category errors
 * @since 0.0.0
 */
export class HtmlProjectionSafetyViolation extends S.TaggedError<HtmlProjectionSafetyViolation>(
  $I`HtmlProjectionSafetyViolation`
)(
  "HtmlProjection",
  HtmlConformanceIssue.fields,
  $I.annoteError<HtmlProjectionSafetyViolation>("HtmlProjectionSafetyViolation", {
    description: "Path-located HTML conformance issue produced by the canonical Markdown projection.",
  })
) {}

/**
 * A Markdown tree whose node count exceeds the RPC/editor safety budget.
 *
 * **Example** (Construct a complexity violation)
 *
 * ```ts import.meta.vitest name="Construct a complexity violation"
 * import { DocumentComplexitySafetyViolation, MAX_SAFE_DOCUMENT_NODES } from "@beep/md/Md.safe"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const issue = DocumentComplexitySafetyViolation.make({
 *   maxNodes: NonNegativeInt.make(MAX_SAFE_DOCUMENT_NODES),
 *   observedNodes: NonNegativeInt.make(MAX_SAFE_DOCUMENT_NODES + 1),
 * })
 * issue._tag // => "DocumentComplexity"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocumentComplexitySafetyViolation extends S.TaggedError<DocumentComplexitySafetyViolation>(
  $I`DocumentComplexitySafetyViolation`
)(
  "DocumentComplexity",
  {
    maxNodes: NonNegativeInt,
    observedNodes: NonNegativeInt,
  },
  $I.annoteError<DocumentComplexitySafetyViolation>("DocumentComplexitySafetyViolation", {
    description: "A Markdown AST whose bounded node count exceeds the user-content safety budget.",
  })
) {}

/**
 * Structured safety issue returned before a document crosses an editor or RPC
 * trust boundary.
 *
 * **Example** (Use DocumentSafetyViolation)
 *
 * ```ts import.meta.vitest name="Use DocumentSafetyViolation"
 * import { DocumentSafetyViolation, RawNodeSafetyViolation } from "@beep/md/Md.safe"
 * import * as S from "effect/Schema"
 *
 * const issue = RawNodeSafetyViolation.make({ path: [], nodeTag: "rawMarkdown" })
 * S.is(DocumentSafetyViolation)(issue) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DocumentSafetyViolation = S.Union([
  DocumentComplexitySafetyViolation,
  DuplicateFootnoteDefinitionSafetyViolation,
  HtmlProjectionSafetyViolation,
  RawNodeSafetyViolation,
  ScalarSafetyViolation,
  UrlSafetyViolation,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DocumentSafetyViolation", {
    description: "Path-located Markdown user-content safety violation.",
  })
);

/**
 * Type for {@link DocumentSafetyViolation}.
 *
 * **Example** (Use DocumentSafetyViolation)
 *
 * ```ts import.meta.vitest name="Use DocumentSafetyViolation"
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 * import type { DocumentSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue: DocumentSafetyViolation = RawNodeSafetyViolation.make({ path: [], nodeTag: "rawHtml" })
 * issue._tag // => "RawNode"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DocumentSafetyViolation = typeof DocumentSafetyViolation.Type;

type SafetyPath = ReadonlyArray<string | number>;

const invalidScalarPattern = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

const appendCandidateChildren = (
  pending: Array<object>,
  nextIndex: number,
  count: number,
  candidate: object
): boolean => {
  const children = Reflect.get(candidate, "children");
  if (!A.isArray(children)) return true;

  for (const child of A.filter(children, P.isObject)) {
    if (count + pending.length - nextIndex >= MAX_SAFE_DOCUMENT_NODES) return false;
    pending.push(child);
  }
  return true;
};

const boundedDocumentNodeCount = (document: Document): number => {
  const pending: Array<object> = [document];
  let index = 0;
  let count = 0;
  while (index < pending.length && count <= MAX_SAFE_DOCUMENT_NODES) {
    const candidate = pipe(A.get(pending, index), O.getOrThrow);
    index = N.increment(index);
    count = N.increment(count);
    if (!appendCandidateChildren(pending, index, count, candidate)) {
      return N.increment(MAX_SAFE_DOCUMENT_NODES);
    }
  }
  return count;
};

const documentComplexitySafetyIssues = (document: Document): ReadonlyArray<DocumentSafetyViolation> => {
  const observedNodes = boundedDocumentNodeCount(document);
  return observedNodes > MAX_SAFE_DOCUMENT_NODES
    ? [
        DocumentComplexitySafetyViolation.make({
          maxNodes: NonNegativeInt.make(MAX_SAFE_DOCUMENT_NODES),
          observedNodes: NonNegativeInt.make(observedNodes),
        }),
      ]
    : A.emptyReadonly();
};

const appendPath = (path: SafetyPath, ...segments: ReadonlyArray<string | number>): SafetyPath => [
  ...path,
  ...segments,
];

const scalarSafetyIssues: {
  (value: string, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation>;
  (path: SafetyPath): (value: string) => ReadonlyArray<DocumentSafetyViolation>;
} = dual(
  2,
  (value: string, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
    invalidScalarPattern.test(value) ? A.of(ScalarSafetyViolation.make({ path })) : A.empty()
);

const optionalScalarSafetyIssues: {
  (value: O.Option<string>, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation>;
  (path: SafetyPath): (value: O.Option<string>) => ReadonlyArray<DocumentSafetyViolation>;
} = dual(
  2,
  (value: O.Option<string>, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
    O.match(value, {
      onNone: A.emptyReadonly,
      onSome: scalarSafetyIssues(path),
    })
);

const childrenSafetyIssues: {
  (children: ReadonlyArray<Inline>, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation>;
  (path: SafetyPath): (children: ReadonlyArray<Inline>) => ReadonlyArray<DocumentSafetyViolation>;
} = dual(
  2,
  (children: ReadonlyArray<Inline>, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
    pipeChildren(children, (inline, index) => inlineSafetyIssues(inline, appendPath(path, index)))
);

const pipeChildren: {
  <Value, Output>(
    values: ReadonlyArray<Value>,
    inspect: (value: Value, index: number) => ReadonlyArray<Output>
  ): ReadonlyArray<Output>;
  <Value, Output>(
    inspect: (value: Value, index: number) => ReadonlyArray<Output>
  ): (values: ReadonlyArray<Value>) => ReadonlyArray<Output>;
} = dual(
  2,
  <Value, Output>(
    values: ReadonlyArray<Value>,
    inspect: (value: Value, index: number) => ReadonlyArray<Output>
  ): ReadonlyArray<Output> => A.flatMap(values, inspect)
);

const unsafeUrlIssue: {
  (
    destination: string,
    destinationKind: DestinationKind,
    nodeTag: UrlNodeTag,
    path: SafetyPath
  ): ReadonlyArray<DocumentSafetyViolation>;
  (
    destinationKind: DestinationKind,
    nodeTag: UrlNodeTag,
    path: SafetyPath
  ): (destination: string) => ReadonlyArray<DocumentSafetyViolation>;
} = dual(
  4,
  (
    destination: string,
    destinationKind: DestinationKind,
    nodeTag: UrlNodeTag,
    path: SafetyPath
  ): ReadonlyArray<DocumentSafetyViolation> => {
    const policy = destinationKind === "image" ? UserContentImageUrlPolicySpec : UserContentLinkUrlPolicySpec;
    const isSafeHtmlUrl = destinationKind === "image" ? SafeImageUrlAttribute.is : SafeUrlAttribute.is;

    return isUrlDestinationAllowedWithPolicy(destination, policy) && isSafeHtmlUrl(destination)
      ? []
      : [
          UrlSafetyViolation.make({
            path,
            nodeTag,
            destination,
            destinationKind,
          }),
        ];
  }
);

const matchSafetyIssueWithPath = (path: SafetyPath) =>
  Inline.match({
    text: ({ value }) => scalarSafetyIssues(value, appendPath(path, "value")),
    rawMarkdown: () =>
      A.of(
        RawNodeSafetyViolation.make({
          path,
          nodeTag: "rawMarkdown",
        })
      ),
    rawHtml: () =>
      A.of(
        RawNodeSafetyViolation.make({
          path,
          nodeTag: "rawHtml",
        })
      ),
    strong: ({ children }) => childrenSafetyIssues(children, appendPath(path, "children")),
    em: ({ children }) => childrenSafetyIssues(children, appendPath(path, "children")),
    del: ({ children }) => childrenSafetyIssues(children, appendPath(path, "children")),
    code: ({ value }) => scalarSafetyIssues(value, appendPath(path, "value")),
    a: ({ children, href, title }) => [
      ...scalarSafetyIssues(href, appendPath(path, "href")),
      ...optionalScalarSafetyIssues(title, appendPath(path, "title")),
      ...unsafeUrlIssue(href, "link", "a", appendPath(path, "href")),
      ...childrenSafetyIssues(children, appendPath(path, "children")),
    ],
    img: ({ alt, src, title }) => [
      ...scalarSafetyIssues(alt, appendPath(path, "alt")),
      ...scalarSafetyIssues(src, appendPath(path, "src")),
      ...optionalScalarSafetyIssues(title, appendPath(path, "title")),
      ...unsafeUrlIssue(src, "image", "img", appendPath(path, "src")),
    ],
    br: A.empty<never>,
    inlineMath: ({ value }) => scalarSafetyIssues(value, appendPath(path, "value")),
    footnoteReference: A.empty<never>,
  });

const inlineSafetyIssues: {
  (inline: Inline, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation>;
  (path: SafetyPath): (inline: Inline) => ReadonlyArray<DocumentSafetyViolation>;
} = dual(
  2,
  (inline: Inline, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> => matchSafetyIssueWithPath(path)(inline)
);

const listItemChildSafetyIssues = (child: ListItemChild, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
  Inline.is(child) ? inlineSafetyIssues(child, path) : blockSafetyIssues(child, path);

const listChildrenSafetyIssues = (
  children: ReadonlyArray<{ readonly children: ReadonlyArray<ListItemChild> }>,
  path: SafetyPath
): ReadonlyArray<DocumentSafetyViolation> =>
  pipeChildren(children, (item, itemIndex) =>
    pipeChildren(item.children, (child, childIndex) =>
      listItemChildSafetyIssues(child, appendPath(path, itemIndex, "children", childIndex))
    )
  );

const blockSafetyIssues = (block: Block, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
  Block.match(block, {
    heading: ({ children }) => childrenSafetyIssues(children, appendPath(path, "children")),
    p: ({ children }) => childrenSafetyIssues(children, appendPath(path, "children")),
    blockquote: ({ children }) =>
      pipeChildren(children, (child, index) => blockSafetyIssues(child, appendPath(path, "children", index))),
    pre: ({ value }) => scalarSafetyIssues(value, appendPath(path, "value")),
    ul: ({ children }) => listChildrenSafetyIssues(children, appendPath(path, "children")),
    ol: ({ children }) => listChildrenSafetyIssues(children, appendPath(path, "children")),
    taskList: ({ children }) => listChildrenSafetyIssues(children, appendPath(path, "children")),
    table: ({ children }) =>
      pipeChildren(children, (row, rowIndex) =>
        pipeChildren(row.children, (cell, cellIndex) =>
          childrenSafetyIssues(cell.children, appendPath(path, "children", rowIndex, "children", cellIndex, "children"))
        )
      ),
    youtube: A.empty<never>,
    mathBlock: ({ value }) => scalarSafetyIssues(value, appendPath(path, "value")),
    footnoteDefinition: ({ children }) =>
      pipeChildren(children, (child, index) => blockSafetyIssues(child, appendPath(path, "children", index))),
    admonition: ({ children, title }) => [
      ...optionalScalarSafetyIssues(title, appendPath(path, "title")),
      ...pipeChildren(children, (child, index) => blockSafetyIssues(child, appendPath(path, "children", index))),
    ],
    embed: ({ description, kind, src, title }) => [
      ...scalarSafetyIssues(src, appendPath(path, "src")),
      ...optionalScalarSafetyIssues(title, appendPath(path, "title")),
      ...optionalScalarSafetyIssues(description, appendPath(path, "description")),
      ...unsafeUrlIssue(src, kind === "image" ? "image" : "link", "embed", appendPath(path, "src")),
    ],
    hr: () => [],
  });

type FootnoteDefinitionOccurrence = {
  readonly identifier: FootnoteIdentifierValue;
  readonly path: SafetyPath;
};

const listItemChildFootnoteDefinitionOccurrences = (
  child: ListItemChild,
  path: SafetyPath
): ReadonlyArray<FootnoteDefinitionOccurrence> =>
  Inline.is(child) ? A.emptyReadonly() : blockFootnoteDefinitionOccurrences(child, path);

const listFootnoteDefinitionOccurrences = (
  children: ReadonlyArray<{ readonly children: ReadonlyArray<ListItemChild> }>,
  path: SafetyPath
): ReadonlyArray<FootnoteDefinitionOccurrence> =>
  pipeChildren(children, (item, itemIndex) =>
    pipeChildren(item.children, (child, childIndex) =>
      listItemChildFootnoteDefinitionOccurrences(child, appendPath(path, itemIndex, "children", childIndex))
    )
  );

const blockFootnoteDefinitionOccurrences = (
  block: Block,
  path: SafetyPath
): ReadonlyArray<FootnoteDefinitionOccurrence> =>
  Block.match(block, {
    heading: () => A.emptyReadonly(),
    p: () => A.emptyReadonly(),
    blockquote: ({ children }) =>
      pipeChildren(children, (child, index) =>
        blockFootnoteDefinitionOccurrences(child, appendPath(path, "children", index))
      ),
    pre: () => A.emptyReadonly(),
    ul: ({ children }) => listFootnoteDefinitionOccurrences(children, appendPath(path, "children")),
    ol: ({ children }) => listFootnoteDefinitionOccurrences(children, appendPath(path, "children")),
    taskList: ({ children }) => listFootnoteDefinitionOccurrences(children, appendPath(path, "children")),
    table: () => A.emptyReadonly(),
    youtube: () => A.emptyReadonly(),
    mathBlock: () => A.emptyReadonly(),
    footnoteDefinition: ({ children, identifier }) => [
      { identifier, path: appendPath(path, "identifier") },
      ...pipeChildren(children, (child, index) =>
        blockFootnoteDefinitionOccurrences(child, appendPath(path, "children", index))
      ),
    ],
    admonition: ({ children }) =>
      pipeChildren(children, (child, index) =>
        blockFootnoteDefinitionOccurrences(child, appendPath(path, "children", index))
      ),
    embed: () => A.emptyReadonly(),
    hr: () => A.emptyReadonly(),
  });

const duplicateFootnoteDefinitionIssues = (document: Document): ReadonlyArray<DocumentSafetyViolation> =>
  pipe(
    pipeChildren(document.children, (block, index) => blockFootnoteDefinitionOccurrences(block, ["children", index])),
    A.groupBy((occurrence) => occurrence.identifier),
    R.values,
    A.filter(
      P.Struct({
        length: N.isGreaterThan(1),
      })
    ),
    // `make` on a class schema calls `new this(...)`, so it cannot be passed as
    // a detached reference — the lambda is what keeps the receiver bound.
    A.flatMap(
      A.map(
        flow(Struct.pick(["identifier", "path"]), (fields) => DuplicateFootnoteDefinitionSafetyViolation.make(fields))
      )
    )
  );

const htmlProjectionSafetyIssues = flow(
  Document.toHtml,
  Html.Conformant.issues,
  A.map((issue) =>
    HtmlProjectionSafetyViolation.make({
      path: issue.path,
      rule: issue.rule,
      message: issue.message,
    })
  )
);

/**
 * Returns every path-located user-content safety or hard HTML-projection
 * violation.
 *
 * **Example** (Use documentSafetyIssues)
 *
 * ```ts
 * import { Md } from "@beep/md"
 * import { documentSafetyIssues } from "@beep/md/Md.safe"
 *
 * console.log(documentSafetyIssues(Md.make([Md.p(Md.rawHtml("<b>trusted</b>"))])).length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const documentSafetyIssues = (document: Document): ReadonlyArray<DocumentSafetyViolation> => {
  const complexityIssues = documentComplexitySafetyIssues(document);
  return A.isReadonlyArrayNonEmpty(complexityIssues)
    ? complexityIssues
    : [
        ...pipeChildren(document.children, (block, index) => blockSafetyIssues(block, ["children", index])),
        ...duplicateFootnoteDefinitionIssues(document),
        ...htmlProjectionSafetyIssues(document),
      ];
};

/**
 * Returns every user-content safety violation below an inline node.
 *
 * **Example** (Use inlineSafetyIssuesAtRoot)
 *
 * ```ts import.meta.vitest name="Use inlineSafetyIssuesAtRoot"
 * import { Md } from "@beep/md"
 * import { inlineSafetyIssuesAtRoot } from "@beep/md/Md.safe"
 *
 * inlineSafetyIssuesAtRoot(Md.a("http://example.com", "link")).length // => 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const inlineSafetyIssuesAtRoot = (inline: Inline): ReadonlyArray<DocumentSafetyViolation> => [
  ...inlineSafetyIssues(inline, []),
];

const SafeInlineCheck = S.makeFilter<Inline>((inline) => !A.isReadonlyArrayNonEmpty(inlineSafetyIssuesAtRoot(inline)), {
  identifier: $I`SafeInlineCheck`,
  title: "Safe Markdown Inline",
  description: "An inline node without trusted raw content, unsafe URLs, or invalid scalar strings.",
  message: "Inline content contains trusted raw content, an unsafe URL, or an invalid scalar string.",
});

const SafeDocumentCheck = S.makeFilter<Document>(
  (document) => !A.isReadonlyArrayNonEmpty(documentSafetyIssues(document)),
  {
    identifier: $I`SafeDocumentCheck`,
    title: "Safe Markdown Document",
    description:
      "A bounded document without trusted raw content, unsafe URLs, duplicate footnotes, invalid scalars, or HTML projection issues.",
    message:
      "Document exceeds the complexity budget or contains trusted raw content, an unsafe URL, duplicate footnotes, an invalid scalar string, or an HTML projection issue.",
  }
);

/**
 * Branded user-content inline refinement with the same wire representation as
 * {@link Inline}.
 *
 * **Example** (Use SafeInline)
 *
 * ```ts import.meta.vitest name="Use SafeInline"
 * import { SafeInline } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(SafeInline)({ _tag: "text", value: "Hello" })
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SafeInline = Inline.pipe(
  S.check(SafeInlineCheck),
  S.brand("SafeInline"),
  $I.annoteSchema("SafeInline", {
    description: "User-authored inline content approved for editor and RPC boundaries.",
  })
);

/**
 * Type for {@link SafeInline}.
 *
 * **Example** (Use SafeInline)
 *
 * ```ts import.meta.vitest name="Use SafeInline"
 * import { SafeInline } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value: SafeInline = Result.getOrThrow(
 *   S.decodeUnknownResult(SafeInline)({ _tag: "text", value: "Hello" })
 * )
 * value._tag // => "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeInline = typeof SafeInline.Type;

/**
 * Branded user-content document refinement with the same wire representation
 * as {@link Document}.
 *
 * **Example** (Use SafeDocument)
 *
 * ```ts import.meta.vitest name="Use SafeDocument"
 * import { SafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(SafeDocument)({ _tag: "document", children: [] })
 * Result.isSuccess(result) // => true
 * ```
 *
 * @invariant Every admitted document projects through {@link Document.toHtml} to an HTML fragment with no hard author-conformance issues.
 * @see {@link https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines | WHATWG HTML headings and outlines} for one cross-block structural invariant enforced by the projection check.
 * @category validation
 * @since 0.0.0
 */
export const SafeDocument = Document.pipe(
  S.check(SafeDocumentCheck),
  S.brand("SafeDocument"),
  $I.annoteSchema("SafeDocument", {
    description: "User-authored Markdown document approved for editor and RPC boundaries.",
  })
);

/**
 * Type for {@link SafeDocument}.
 *
 * **Example** (Use SafeDocument)
 *
 * ```ts import.meta.vitest name="Use SafeDocument"
 * import { SafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value: SafeDocument = Result.getOrThrow(
 *   S.decodeUnknownResult(SafeDocument)({ _tag: "document", children: [] })
 * )
 * value.children.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeDocument = typeof SafeDocument.Type;

/**
 * Decodes unknown input into a safe document without throwing.
 *
 * **Example** (Use decodeSafeDocument)
 *
 * ```ts import.meta.vitest name="Use decodeSafeDocument"
 * import { decodeSafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 *
 * const result = decodeSafeDocument({ _tag: "document", children: [] })
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const decodeSafeDocument: {
  (options?: AST.ParseOptions): (input: unknown) => Result.Result<SafeDocument, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Result.Result<SafeDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownResult(SafeDocument));

/**
 * Decodes unknown input into a safe document as an Effect.
 *
 * **Example** (Use decodeSafeDocumentEffect)
 *
 * ```ts import.meta.vitest name="Use decodeSafeDocumentEffect"
 * import { decodeSafeDocumentEffect } from "@beep/md/Md.safe"
 * import { Effect } from "effect"
 *
 * const document = Effect.runSync(decodeSafeDocumentEffect({ _tag: "document", children: [] }))
 * document.children.length // => 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const decodeSafeDocumentEffect: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<SafeDocument, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<SafeDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(SafeDocument));

/**
 * Decodes unknown input into a safe document and throws on failure.
 *
 * **Example** (Use decodeSafeDocumentUnsafe)
 *
 * ```ts import.meta.vitest name="Use decodeSafeDocumentUnsafe"
 * import { decodeSafeDocumentUnsafe } from "@beep/md/Md.safe"
 *
 * decodeSafeDocumentUnsafe({ _tag: "document", children: [] })._tag // => "document"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeSafeDocumentUnsafe = (input: unknown): SafeDocument =>
  Result.getOrThrowWith(decodeSafeDocument(input), schemaIssueToError);

/**
 * Narrows an already-decoded document after reporting structured issues.
 *
 * **Example** (Use refineSafeDocument)
 *
 * ```ts import.meta.vitest name="Use refineSafeDocument"
 * import { Md } from "@beep/md"
 * import { refineSafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 *
 * Result.isSuccess(refineSafeDocument(Md.make([Md.p("Hello")]))) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const refineSafeDocument = (
  document: Document
): Result.Result<SafeDocument, ReadonlyArray<DocumentSafetyViolation>> => {
  const issues = documentSafetyIssues(document);
  return A.isReadonlyArrayNonEmpty(issues) ? Result.fail(issues) : Result.succeed(SafeDocument.make(document));
};

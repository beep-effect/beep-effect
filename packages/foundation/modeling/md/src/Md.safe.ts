/**
 * Trust-boundary refinements for user-authored Markdown documents.
 *
 * The general {@link Document} schema remains lossless persistence truth.
 * `SafeDocument` is the narrower RPC/editor boundary: it rejects trusted raw
 * nodes, URL destinations outside the canonical user-content policies, and
 * strings that cannot reach the safe HTML serializer while retaining the exact
 * same encoded JSON representation.
 *
 * @packageDocumentation \@beep/md/Md.safe
 * @since 0.0.0
 */

import { SafeImageUrlAttribute, SafeUrlAttribute } from "@beep/html";
import { $MdId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Match, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  isUrlDestinationAllowedWithPolicy,
  UserContentImageUrlPolicySpec,
  UserContentLinkUrlPolicySpec,
} from "./Md.escape.ts";
import { Document, Inline, Inline as InlineSchema } from "./Md.model.ts";
import type { Block, ListItemChild } from "./Md.model.ts";

const $I = $MdId.create("Md.safe");

/**
 * A stable path segment locating a safety violation in the Markdown AST.
 *
 * @example
 * ```ts
 * import { DocumentSafetyPathSegment } from "@beep/md/Md.safe"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(DocumentSafetyPathSegment)(2)) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentSafetyPathSegment = S.Union([S.String, S.Int.check(S.isGreaterThanOrEqualTo(0))]).pipe(
  $I.annoteSchema("DocumentSafetyPathSegment", {
    description: "String property name or numeric array index in a Markdown AST path.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link DocumentSafetyPathSegment}.
 *
 * @example
 * ```ts
 * import type { DocumentSafetyPathSegment } from "@beep/md/Md.safe"
 *
 * const segment: DocumentSafetyPathSegment = "children"
 * console.log(segment) // "children"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentSafetyPathSegment = typeof DocumentSafetyPathSegment.Type;

/**
 * A trusted raw Markdown or HTML node found at a user-content boundary.
 *
 * @example
 * ```ts
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = RawNodeSafetyViolation.make({ path: ["children", 0], nodeTag: "rawHtml" })
 * console.log(issue._tag) // "RawNode"
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
 * A URL-bearing Markdown node whose destination is outside its user-content
 * allow list.
 *
 * @example
 * ```ts
 * import { UrlSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = UrlSafetyViolation.make({
 *   path: ["children", 0, "href"],
 *   nodeTag: "a",
 *   destination: "http://example.com",
 *   destinationKind: "link",
 * })
 * console.log(issue.destinationKind) // "link"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UrlSafetyViolation extends S.TaggedClass<UrlSafetyViolation>($I`UrlSafetyViolation`)(
  "UnsafeUrl",
  {
    path: S.Array(DocumentSafetyPathSegment),
    nodeTag: S.Literals(["a", "img", "embed"]),
    destination: S.String,
    destinationKind: S.Literals(["link", "image"]),
  },
  $I.annote("UrlSafetyViolation", {
    description: "Path-located URL rejected by the canonical user-content policy.",
  })
) {}

/**
 * A string containing a code point that cannot be represented by the canonical
 * HTML serializer.
 *
 * @example
 * ```ts
 * import { ScalarSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = ScalarSafetyViolation.make({ path: ["children", 0, "value"] })
 * console.log(issue._tag) // "InvalidScalar"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ScalarSafetyViolation extends S.TaggedClass<ScalarSafetyViolation>($I`ScalarSafetyViolation`)(
  "InvalidScalar",
  {
    path: S.Array(DocumentSafetyPathSegment),
  },
  $I.annote("ScalarSafetyViolation", {
    description: "Path-located NUL code point or lone UTF-16 surrogate rejected before safe HTML projection.",
  })
) {}

/**
 * Structured safety issue returned before a document crosses an editor or RPC
 * trust boundary.
 *
 * @example
 * ```ts
 * import { DocumentSafetyViolation, RawNodeSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue = RawNodeSafetyViolation.make({ path: [], nodeTag: "rawMarkdown" })
 * console.log(DocumentSafetyViolation.is(issue)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const DocumentSafetyViolation = S.Union([
  RawNodeSafetyViolation,
  ScalarSafetyViolation,
  UrlSafetyViolation,
]).pipe(
  $I.annoteSchema("DocumentSafetyViolation", {
    description: "Path-located Markdown user-content safety violation.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link DocumentSafetyViolation}.
 *
 * @example
 * ```ts
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 * import type { DocumentSafetyViolation } from "@beep/md/Md.safe"
 *
 * const issue: DocumentSafetyViolation = RawNodeSafetyViolation.make({ path: [], nodeTag: "rawHtml" })
 * console.log(issue._tag) // "RawNode"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type DocumentSafetyViolation = typeof DocumentSafetyViolation.Type;

type SafetyPath = ReadonlyArray<string | number>;

const invalidScalarPattern = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const isSafeLinkUrl = S.is(SafeUrlAttribute);
const isSafeImageUrl = S.is(SafeImageUrlAttribute);

const appendPath = (path: SafetyPath, ...segments: ReadonlyArray<string | number>): SafetyPath => [
  ...path,
  ...segments,
];

const scalarSafetyIssues = (value: string, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
  invalidScalarPattern.test(value) ? [ScalarSafetyViolation.make({ path })] : [];

const optionalScalarSafetyIssues = (
  value: O.Option<string>,
  path: SafetyPath
): ReadonlyArray<DocumentSafetyViolation> =>
  O.match(value, {
    onNone: A.emptyReadonly,
    onSome: (text) => scalarSafetyIssues(text, path),
  });

const childrenSafetyIssues = (
  children: ReadonlyArray<Inline>,
  path: SafetyPath
): ReadonlyArray<DocumentSafetyViolation> =>
  pipeChildren(children, (inline, index) => inlineSafetyIssues(inline, appendPath(path, index)));

const pipeChildren = <Value>(
  values: ReadonlyArray<Value>,
  inspect: (value: Value, index: number) => ReadonlyArray<DocumentSafetyViolation>
): ReadonlyArray<DocumentSafetyViolation> => A.flatMap(values, inspect);

const unsafeUrlIssue = (
  destination: string,
  destinationKind: "image" | "link",
  nodeTag: "a" | "embed" | "img",
  path: SafetyPath
): ReadonlyArray<DocumentSafetyViolation> => {
  const policy = destinationKind === "image" ? UserContentImageUrlPolicySpec : UserContentLinkUrlPolicySpec;
  const isSafeHtmlUrl = destinationKind === "image" ? isSafeImageUrl : isSafeLinkUrl;

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
};

const inlineSafetyIssues = (inline: Inline, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      text: ({ value }) => scalarSafetyIssues(value, appendPath(path, "value")),
      rawMarkdown: () => [RawNodeSafetyViolation.make({ path, nodeTag: "rawMarkdown" })],
      rawHtml: () => [RawNodeSafetyViolation.make({ path, nodeTag: "rawHtml" })],
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
      br: () => [],
      inlineMath: ({ value }) => scalarSafetyIssues(value, appendPath(path, "value")),
      footnoteReference: () => [],
    })
  );

const listItemChildSafetyIssues = (child: ListItemChild, path: SafetyPath): ReadonlyArray<DocumentSafetyViolation> =>
  InlineSchema.is(child) ? inlineSafetyIssues(child, path) : blockSafetyIssues(child, path);

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
  Match.value(block).pipe(
    Match.tagsExhaustive({
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
            childrenSafetyIssues(
              cell.children,
              appendPath(path, "children", rowIndex, "children", cellIndex, "children")
            )
          )
        ),
      youtube: () => [],
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
    })
  );

/**
 * Returns every user-content safety violation in document order.
 *
 * @example
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
export const documentSafetyIssues = (document: Document): ReadonlyArray<DocumentSafetyViolation> => [
  ...pipeChildren(document.children, (block, index) => blockSafetyIssues(block, ["children", index])),
];

/**
 * Returns every user-content safety violation below an inline node.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { inlineSafetyIssuesAtRoot } from "@beep/md/Md.safe"
 *
 * console.log(inlineSafetyIssuesAtRoot(Md.a("http://example.com", "link")).length) // 1
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
    description: "A document without trusted raw content, unsafe URLs, or invalid scalar strings.",
    message: "Document contains trusted raw content, an unsafe URL, or an invalid scalar string.",
  }
);

/**
 * Branded user-content inline refinement with the same wire representation as
 * {@link Inline}.
 *
 * @example
 * ```ts
 * import { SafeInline } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(SafeInline)({ _tag: "text", value: "Hello" })
 * console.log(Result.isSuccess(result)) // true
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
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link SafeInline}.
 *
 * @example
 * ```ts
 * import { SafeInline } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value: SafeInline = Result.getOrThrow(
 *   S.decodeUnknownResult(SafeInline)({ _tag: "text", value: "Hello" })
 * )
 * console.log(value._tag) // "text"
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
 * @example
 * ```ts
 * import { SafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(SafeDocument)({ _tag: "document", children: [] })
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SafeDocument = Document.pipe(
  S.check(SafeDocumentCheck),
  S.brand("SafeDocument"),
  $I.annoteSchema("SafeDocument", {
    description: "User-authored Markdown document approved for editor and RPC boundaries.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link SafeDocument}.
 *
 * @example
 * ```ts
 * import { SafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value: SafeDocument = Result.getOrThrow(
 *   S.decodeUnknownResult(SafeDocument)({ _tag: "document", children: [] })
 * )
 * console.log(value.children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SafeDocument = typeof SafeDocument.Type;

/**
 * Decodes unknown input into a safe document without throwing.
 *
 * @example
 * ```ts
 * import { decodeSafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 *
 * const result = decodeSafeDocument({ _tag: "document", children: [] })
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const decodeSafeDocument = S.decodeUnknownResult(SafeDocument);

/**
 * Decodes unknown input into a safe document as an Effect.
 *
 * @example
 * ```ts
 * import { decodeSafeDocumentEffect } from "@beep/md/Md.safe"
 * import { Effect } from "effect"
 *
 * const document = Effect.runSync(decodeSafeDocumentEffect({ _tag: "document", children: [] }))
 * console.log(document.children.length) // 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const decodeSafeDocumentEffect = S.decodeUnknownEffect(SafeDocument);

/**
 * Decodes unknown input into a safe document and throws on failure.
 *
 * @example
 * ```ts
 * import { decodeSafeDocumentUnsafe } from "@beep/md/Md.safe"
 *
 * console.log(decodeSafeDocumentUnsafe({ _tag: "document", children: [] })._tag) // "document"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeSafeDocumentUnsafe = S.decodeUnknownSync(SafeDocument);

/**
 * Narrows an already-decoded document after reporting structured issues.
 *
 * @example
 * ```ts
 * import { Md } from "@beep/md"
 * import { refineSafeDocument } from "@beep/md/Md.safe"
 * import { Result } from "effect"
 *
 * console.log(Result.isSuccess(refineSafeDocument(Md.make([Md.p("Hello")])))) // true
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

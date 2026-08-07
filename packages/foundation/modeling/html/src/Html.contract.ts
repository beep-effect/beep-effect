/**
 * Canonical role names for the public HTML AST contract.
 *
 * The generated model retains its historical short names for compatibility;
 * these aliases make container and child roles explicit at API boundaries.
 *
 * @packageDocumentation \@beep/html/Html.contract
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Fragment, HtmlChild, Html as HtmlElement } from "./Html.model.ts";
import { Comment, Doctype } from "./Html.nodes.ts";

const $I = $HtmlId.create("Html.contract");
const DocumentChild = S.Union([HtmlElement, Comment]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("HtmlDocumentChild", {
    description: "Comment or html document-element node.",
  })
);

/**
 * Any node permitted as an element or fragment child.
 *
 * **Example** (Validate text child node)
 *
 * ```ts
 * import { HtmlChildNode } from "@beep/html/Html.contract"
 * import { Text } from "@beep/html/Html.nodes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlChildNode)(Text.make({ value: "Hello" }))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlChildNode = HtmlChild;

/**
 * Decoded type of {@link HtmlChildNode}.
 *
 * **Example** (Access child node tag)
 *
 * ```ts
 * import type { HtmlChildNode } from "@beep/html/Html.contract"
 *
 * const nodeTag = (node: HtmlChildNode) => node._tag
 * console.log(typeof nodeTag) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlChildNode = HtmlChild.Type;

/**
 * Node kind structurally permitted directly beneath an HTML document.
 *
 * **Details**
 *
 * Full cardinality and ordering are proven by `conform`; this schema captures
 * the narrower child domain of comments plus the document element.
 *
 * **Example** (Validate comment document child)
 *
 * ```ts
 * import { HtmlDocumentChild } from "@beep/html/Html.contract"
 * import { Comment } from "@beep/html/Html.nodes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlDocumentChild)(Comment.make({ value: "note" }))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlDocumentChild = DocumentChild.pipe(S.revealCodec);

/**
 * Decoded type of {@link HtmlDocumentChild}.
 *
 * **Example** (Decode comment as document child)
 *
 * ```ts
 * import { HtmlDocumentChild } from "@beep/html/Html.contract"
 * import { Comment } from "@beep/html/Html.nodes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlDocumentChild)(Comment.make({ value: "note" }))
 * if (Result.isSuccess(decoded)) {
 *   const child: HtmlDocumentChild = decoded.success
 *   console.log(child._tag) // "#comment"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlDocumentChild = typeof HtmlDocumentChild.Type;

/**
 * Canonical HTML document root schema.
 *
 * **Details**
 *
 * Unlike the broad generated `Document` model used for lossless decoding and
 * diagnostics, this boundary admits only comments and the `html` document
 * element as direct children. Cardinality and ordering remain the responsibility
 * of `conform`.
 *
 * **Example** (Make document with html child)
 *
 * ```ts
 * import { HtmlDocument } from "@beep/html/Html.contract"
 * import { Html } from "@beep/html/Html.model"
 *
 * const document = HtmlDocument.make({ children: [Html.make({ children: [] })] })
 * console.log(document._tag) // "#document"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlDocument extends S.TaggedClass<HtmlDocument>($I`HtmlDocument`)(
  "#document",
  {
    doctype: S.OptionFromOptionalKey(Doctype).pipe(SchemaUtils.withNoneDefault),
    children: S.Array(DocumentChild),
  },
  $I.annote("HtmlDocument", {
    description: "Canonical HTML document root with document-only direct children.",
  })
) {}

/**
 * Canonical public name for the HTML fragment root schema.
 *
 * **Example** (Make empty HTML fragment)
 *
 * ```ts
 * import { HtmlFragment } from "@beep/html/Html.contract"
 *
 * const fragment = HtmlFragment.make({ children: [] })
 * console.log(fragment._tag) // "#fragment"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlFragment = Fragment;

/**
 * Decoded type of {@link HtmlFragment}.
 *
 * **Example** (Count fragment children)
 *
 * ```ts
 * import type { HtmlFragment } from "@beep/html/Html.contract"
 *
 * const childCount = (fragment: HtmlFragment) => fragment.children.length
 * console.log(typeof childCount) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlFragment = Fragment.Type;

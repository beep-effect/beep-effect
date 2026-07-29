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
import * as S from "effect/Schema";
import { Document, Fragment, HtmlChild, Html as HtmlElement } from "./Html.model.ts";
import { Comment } from "./Html.nodes.ts";

const $I = $HtmlId.create("Html.contract");

/**
 * Any node permitted as an element or fragment child.
 *
 * @example
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
 * @example
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
 * Full cardinality and ordering are proven by `conform`; this schema captures
 * the narrower child domain of comments plus the document element.
 *
 * @example
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
export const HtmlDocumentChild = S.Union([HtmlElement, Comment]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("HtmlDocumentChild", {
    description: "Comment or html document-element node.",
  }),
  S.revealCodec
);

/**
 * Decoded type of {@link HtmlDocumentChild}.
 *
 * @example
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
 * Canonical public name for the HTML document root schema.
 *
 * @example
 * ```ts
 * import { HtmlDocument } from "@beep/html/Html.contract"
 *
 * const document = HtmlDocument.make({ children: [] })
 * console.log(document._tag) // "#document"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlDocument = Document;

/**
 * Decoded type of {@link HtmlDocument}.
 *
 * @example
 * ```ts
 * import type { HtmlDocument } from "@beep/html/Html.contract"
 *
 * const childCount = (document: HtmlDocument) => document.children.length
 * console.log(typeof childCount) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlDocument = Document.Type;

/**
 * Canonical public name for the HTML fragment root schema.
 *
 * @example
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
 * @example
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

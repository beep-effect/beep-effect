/**
 * Hand-authored non-element AST node classes.
 *
 * These are the leaf DOM node kinds that sit alongside element classes in the
 * {@link HtmlNode} union. Their `_tag` values use the DOM `nodeName` convention
 * (`#text`, `#comment`, `#doctype`) so they can never collide with element tag
 * names. Recursive container nodes (`#document`, `#fragment`) are emitted into
 * the generated `Html.model.ts` because they reference the recursive child list.
 *
 * @packageDocumentation \@beep/html/Html.nodes
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $HtmlId.create("Html.nodes");

/**
 * A character-data text node.
 *
 * @example
 * ```ts
 * import { Text } from "@beep/html/Html.nodes"
 *
 * const node = Text.make({ value: "Hello" })
 * console.log(node._tag) // "#text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Text extends S.TaggedClass<Text>($I`Text`)(
  "#text",
  {
    value: S.String.annotateKey({ description: "Character data of the text node." }),
  },
  $I.annote("Text", { description: "A character-data text node." })
) {
  static readonly fromValue = (value: string): Text => Text.make({ value });
}

/**
 * Companion namespace for {@link Text}.
 *
 * @example
 * ```ts
 * import { Text } from "@beep/html/Html.nodes"
 *
 * const encoded: Text.Encoded = { _tag: "#text", value: "Hello" }
 * console.log(encoded._tag) // "#text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Text {
  /** @since 0.0.0 */
  export interface Type {
    readonly _tag: "#text";
    readonly value: string;
  }
  /** @since 0.0.0 */
  export interface Encoded extends Type {}
}

/**
 * Comment data that can be represented without changing its parsed value.
 *
 * @example
 * ```ts
 * import { HtmlCommentData } from "@beep/html/Html.nodes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlCommentData)("note")) // true
 * console.log(S.is(HtmlCommentData)("-->")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlCommentData = S.String.check(
  S.makeFilterGroup(
    [
      S.makeFilter(P.not(Str.startsWith(">")), {
        identifier: $I`HtmlCommentDataLeadingCloseCheck`,
        title: "HTML Comment Leading Close",
        description: "Rejects comment data beginning with `>`.",
        message: "Comment data must not begin with >",
      }),
      S.makeFilter(P.not(Str.startsWith("->")), {
        identifier: $I`HtmlCommentDataLeadingArrowCheck`,
        title: "HTML Comment Leading Arrow",
        description: "Rejects comment data beginning with `->`.",
        message: "Comment data must not begin with ->",
      }),
      S.makeFilter(P.not(Str.includes("<!--")), {
        identifier: $I`HtmlCommentDataOpenDelimiterCheck`,
        title: "HTML Comment Open Delimiter",
        description: "Rejects nested HTML comment opening delimiters.",
        message: "Comment data must not contain <!--",
      }),
      S.makeFilter(P.not(Str.includes("-->")), {
        identifier: $I`HtmlCommentDataCloseDelimiterCheck`,
        title: "HTML Comment Close Delimiter",
        description: "Rejects HTML comment closing delimiters.",
        message: "Comment data must not contain -->",
      }),
      S.makeFilter(P.not(Str.includes("--!>")), {
        identifier: $I`HtmlCommentDataBangCloseDelimiterCheck`,
        title: "HTML Comment Bang Close Delimiter",
        description: "Rejects HTML comment bang-closing delimiters.",
        message: "Comment data must not contain --!>",
      }),
      S.makeFilter(P.not(Str.endsWith("<!-")), {
        identifier: $I`HtmlCommentDataTrailingOpenCheck`,
        title: "HTML Comment Trailing Open",
        description: "Rejects comment data ending with `<!-`.",
        message: "Comment data must not end with <!-",
      }),
    ],
    {
      identifier: $I`HtmlCommentDataChecks`,
      title: "HTML Comment Data",
      description: "Checks the HTML comment-data grammar needed for lossless serialization.",
    }
  )
).pipe(
  $I.annoteSchema("HtmlCommentData", {
    description: "HTML comment text that serializes without delimiter ambiguity.",
  })
);

/**
 * Decoded type of {@link HtmlCommentData}.
 *
 * @example
 * ```ts
 * import type { HtmlCommentData } from "@beep/html/Html.nodes"
 *
 * const value: HtmlCommentData = "note"
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type HtmlCommentData = typeof HtmlCommentData.Type;

/**
 * An HTML comment node (`<!-- ... -->`).
 *
 * @example
 * ```ts
 * import { Comment } from "@beep/html/Html.nodes"
 *
 * const node = Comment.make({ value: "note" })
 * console.log(node._tag) // "#comment"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Comment extends S.TaggedClass<Comment>($I`Comment`)(
  "#comment",
  {
    value: HtmlCommentData.annotateKey({ description: "Comment text (without the delimiters)." }),
  },
  $I.annote("Comment", { description: "An HTML comment node." })
) {
  static readonly fromValue = (value: string): Comment => Comment.make({ value });
}

/**
 * Companion namespace for {@link Comment}.
 *
 * @example
 * ```ts
 * import { Comment } from "@beep/html/Html.nodes"
 *
 * const encoded: Comment.Encoded = { _tag: "#comment", value: "note" }
 * console.log(encoded._tag) // "#comment"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Comment {
  /** @since 0.0.0 */
  export interface Type {
    readonly _tag: "#comment";
    readonly value: string;
  }
  /** @since 0.0.0 */
  export interface Encoded extends Type {}
}

/**
 * A document type declaration (`<!DOCTYPE html>`).
 *
 * @example
 * ```ts
 * import { Doctype } from "@beep/html/Html.nodes"
 *
 * const node = Doctype.html()
 * console.log(node._tag) // "#doctype"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Doctype extends S.TaggedClass<Doctype>($I`Doctype`)(
  "#doctype",
  {
    name: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: 'Document type name (e.g. "html").' }),
    publicId: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Legacy public identifier." }),
    systemId: S.OptionFromOptionalKey(S.String)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Legacy system identifier." }),
  },
  $I.annote("Doctype", { description: "A document type declaration." })
) {
  static readonly html = (): Doctype => Doctype.make({ name: O.some("html") });
}

/**
 * Companion namespace for {@link Doctype}.
 *
 * @example
 * ```ts
 * import { Doctype } from "@beep/html/Html.nodes"
 *
 * const encoded: Doctype.Encoded = { _tag: "#doctype", name: "html" }
 * console.log(encoded._tag) // "#doctype"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Doctype {
  /** @since 0.0.0 */
  export interface Type {
    readonly _tag: "#doctype";
    readonly name: O.Option<string>;
    readonly publicId: O.Option<string>;
    readonly systemId: O.Option<string>;
  }
  /** @since 0.0.0 */
  export interface Encoded {
    readonly _tag: "#doctype";
    readonly name?: string;
    readonly publicId?: string;
    readonly systemId?: string;
  }
}

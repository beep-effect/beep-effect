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
import * as S from "effect/Schema";

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
    value: S.String.annotateKey({ description: "Comment text (without the delimiters)." }),
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

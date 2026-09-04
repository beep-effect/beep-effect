/**
 * Schema-first Markdown document AST models with schema-owned pure projections.
 *
 * @packageDocumentation \@beep/md/Md.model
 * @since 0.0.0
 */

import * as HtmlModel from "@beep/html/Html.model";
import { Text as HtmlText } from "@beep/html/Html.nodes";
import { $MdId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema/Int";
import { JsonObject } from "@beep/schema/Json";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as Arr from "@beep/utils/Array";
import { SchemaGetter, Tuple } from "effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { HtmlChildNode } from "@beep/html";

const $I = $MdId.create("Md.model");

const codeFenceLanguagePattern = /^[A-Za-z0-9][A-Za-z0-9_+.-]*$/u;
const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const footnoteIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u;
// This check never rejects a document. Effect's arbitrary compiler alone reads
// the maxLength hint, keeping recursive child-list breadth bounded.
const MarkdownArbitraryArraySizeHint = S.makeFilter<ReadonlyArray<unknown>>(() => true, {
  identifier: $I`MarkdownArbitraryArraySizeHint`,
  title: "Markdown arbitrary array size hint",
  description: "Caps derived arbitrary child arrays at two elements without constraining decoded Markdown documents.",
  arbitrary: {
    constraint: {
      maxLength: 2,
    },
  },
});

/**
 * Single safe Markdown fenced-code info-string token.
 *
 * **Example** (Decode language token)
 *
 * ```ts import.meta.vitest name="Decode language token"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { CodeFenceLanguage } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(CodeFenceLanguage)("ts")
 * Result.isSuccess(result) && result.success === "ts" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodeFenceLanguage = S.NonEmptyString.check(
  S.isPattern(codeFenceLanguagePattern, {
    identifier: $I`CodeFenceLanguageCheck`,
    title: "Code Fence Language",
    description: "A single safe Markdown fenced-code info-string token.",
    message: "Code fence language must be a single alphanumeric token with _, +, ., or - separators",
  })
).pipe(
  $I.annoteSchema("CodeFenceLanguage", {
    description: "Single safe Markdown fenced-code info-string token.",
  }),
  SchemaUtils.withCodecStatics(["decodeOption", "decodeUnknownOption"])
);

/**
 * Type for {@link CodeFenceLanguage}.
 *
 * **Example** (Type decoded language)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { CodeFenceLanguage } from "@beep/md/Md.model"
 *
 * const result: Result.Result<CodeFenceLanguage, S.SchemaError> = S.decodeUnknownResult(CodeFenceLanguage)("tsx")
 * console.log(Result.isSuccess(result) && result.success === "tsx") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CodeFenceLanguage = typeof CodeFenceLanguage.Type;

/**
 * Bare 11-character YouTube video id used by {@link YouTube} embeds.
 *
 * **Details**
 *
 * Constraining the id to the safe character class rejects malformed UTF-16
 * (e.g. lone surrogates) at the schema boundary, so downstream consumers that
 * percent-encode the id cannot be crashed by a `URIError`.
 *
 * **Example** (Decode video id)
 *
 * ```ts import.meta.vitest name="Decode video id"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { YouTubeVideoId } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(YouTubeVideoId)("M7lc1UVf-VE")
 * Result.isSuccess(result) && result.success === "M7lc1UVf-VE" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YouTubeVideoId = S.String.check(
  S.isPattern(youtubeVideoIdPattern, {
    identifier: $I`YouTubeVideoIdPatternCheck`,
    title: "YouTube Video ID",
    description: "Checks that a YouTube embed references only the bare 11-character video id.",
    message: "YouTube video id must be the bare 11-character id, not a URL or arbitrary string.",
  })
).pipe(
  $I.annoteSchema("YouTubeVideoId", {
    description: "Bare 11-character YouTube video id accepted by Md YouTube embeds.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Safe Markdown footnote identifier.
 *
 * **Example** (Parse footnote identifier)
 *
 * ```ts
 * import { FootnoteIdentifier } from "@beep/md/Md.model"
 *
 * const identifier = FootnoteIdentifier.decodeUnknownSync("note-1")
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FootnoteIdentifier = S.NonEmptyString.check(
  S.isPattern(footnoteIdentifierPattern, {
    identifier: $I`FootnoteIdentifierPatternCheck`,
    title: "Footnote Identifier",
    description: "Checks that a footnote identifier can be rendered inside Markdown footnote brackets.",
    message:
      "Footnote identifier must start with an alphanumeric character and contain only letters, digits, _, ., :, or -.",
  })
).pipe(
  $I.annoteSchema("FootnoteIdentifier", {
    description: "Safe Markdown footnote identifier.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
);

/**
 * Type for {@link FootnoteIdentifier}.
 *
 * **Example** (Type footnote identifier)
 *
 * ```ts
 * import type { FootnoteIdentifier as FootnoteIdentifierValue } from "@beep/md/Md.model"
 * import { FootnoteIdentifier } from "@beep/md/Md.model"
 *
 * const identifier: FootnoteIdentifierValue = FootnoteIdentifier.decodeUnknownSync("note-1")
 * console.log(identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FootnoteIdentifier = typeof FootnoteIdentifier.Type;

/**
 * Markdown table column alignment.
 *
 * **Example** (Decode center alignment)
 *
 * ```ts import.meta.vitest name="Decode center alignment"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TableAlignment } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(TableAlignment)("center")
 * Result.isSuccess(result) && result.success === "center" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TableAlignment = LiteralKit(["none", "left", "center", "right"]).pipe(
  $I.annoteSchema("TableAlignment", {
    description: "Markdown table column alignment.",
  })
);

/**
 * Type for {@link TableAlignment}.
 *
 * **Example** (Assign right alignment)
 *
 * ```ts
 * import type { TableAlignment } from "@beep/md/Md.model"
 *
 * const alignment: TableAlignment = "right"
 * console.log(alignment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableAlignment = typeof TableAlignment.Type;

/**
 * Common typed admonition kinds.
 *
 * **Example** (Decode warning kind)
 *
 * ```ts import.meta.vitest name="Decode warning kind"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { AdmonitionKind } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(AdmonitionKind)("warning")
 * Result.isSuccess(result) && result.success === "warning" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmonitionKind = LiteralKit(["note", "tip", "important", "warning", "caution"]).pipe(
  $I.annoteSchema("AdmonitionKind", {
    description: "Common typed Markdown admonition kind.",
  })
);

/**
 * Type for {@link AdmonitionKind}.
 *
 * **Example** (Assign tip kind)
 *
 * ```ts
 * import type { AdmonitionKind } from "@beep/md/Md.model"
 *
 * const kind: AdmonitionKind = "tip"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AdmonitionKind = typeof AdmonitionKind.Type;

/**
 * Generic block embed kind.
 *
 * **Example** (Decode video kind)
 *
 * ```ts import.meta.vitest name="Decode video kind"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { EmbedKind } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(EmbedKind)("video")
 * Result.isSuccess(result) && result.success === "video" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmbedKind = LiteralKit(["link", "image", "video", "audio", "unknown"]).pipe(
  $I.annoteSchema("EmbedKind", {
    description: "Generic Markdown block embed kind.",
  })
);

/**
 * Type for {@link EmbedKind}.
 *
 * **Example** (Assign image kind)
 *
 * ```ts
 * import type { EmbedKind } from "@beep/md/Md.model"
 *
 * const kind: EmbedKind = "image"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EmbedKind = typeof EmbedKind.Type;

/**
 * Recursive inline child list used by inline containers and text-bearing block
 * nodes.
 *
 * **Example** (Decode text children)
 *
 * ```ts import.meta.vitest name="Decode text children"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { InlineChildren, Text } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(InlineChildren)([Text.make({ value: "Hello" })])
 * Result.isSuccess(result) && result.success.length === 1 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InlineChildren = S.Array(S.suspend((): S.Codec<Inline.Type, Inline.Encoded> => Inline))
  .check(MarkdownArbitraryArraySizeHint)
  .pipe(
    $I.annoteSchema("InlineChildren", {
      description: "Recursive inline children used by Markdown inline container nodes.",
    })
  );

/**
 * Type for {@link InlineChildren}.
 *
 * **Example** (Type text children)
 *
 * ```ts import.meta.vitest name="Type text children"
 * import { Text } from "@beep/md/Md.model"
 * import type { InlineChildren } from "@beep/md/Md.model"
 *
 * const children: InlineChildren = [Text.make({ value: "Hello" })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InlineChildren = typeof InlineChildren.Type;

/**
 * Companion namespace for {@link InlineChildren}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { Text } from "@beep/md/Md.model"
 * import type { InlineChildren } from "@beep/md/Md.model"
 *
 * const children: InlineChildren.Type = [Text.make({ value: "Hello" })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace InlineChildren {
  /**
   * @since 0.0.0
   */
  export type Type = ReadonlyArray<Inline.Type>;

  /**
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<Inline.Encoded>;
}

/**
 * Plain escaped inline text.
 *
 * **Example** (Make text node)
 *
 * ```ts import.meta.vitest name="Make text node"
 * import { Text } from "@beep/md/Md.model"
 *
 * const node = Text.make({ value: "Hello" })
 * node._tag // => "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Text extends S.TaggedClass<Text>($I`Text`)(
  "text",
  {
    value: S.String.annotateKey({
      description: "Escaped plain text payload.",
    }),
  },
  $I.annote("Text", {
    description: "Plain escaped inline text.",
  })
) {
  static readonly toPlainText = (inline: Text): string => inline.value;

  static readonly toHtml = (inline: Text): HtmlText => HtmlText.fromValue(inline.value);
}

/**
 * Companion namespace for {@link Text}.
 *
 * **Example** (Type text node)
 *
 * ```ts import.meta.vitest name="Type text node"
 * import { Text } from "@beep/md/Md.model"
 *
 * const node: Text.Type = Text.make({ value: "Hello" })
 * node.value // => "Hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Text {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "text";
    readonly value: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Trusted raw Markdown inline content.
 *
 * **Example** (Make raw markdown)
 *
 * ```ts import.meta.vitest name="Make raw markdown"
 * import { RawMarkdown } from "@beep/md/Md.model"
 *
 * const node = RawMarkdown.make({ value: "**trusted**" })
 * node._tag // => "rawMarkdown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawMarkdown extends S.TaggedClass<RawMarkdown>($I`RawMarkdown`)(
  "rawMarkdown",
  {
    value: S.String.annotateKey({
      description: "Trusted Markdown source preserved without escaping.",
    }),
  },
  $I.annote("RawMarkdown", {
    description: "Trusted raw Markdown inline content.",
  })
) {
  static readonly toPlainText = (inline: RawMarkdown): string => inline.value;

  static readonly toHtml = (inline: RawMarkdown): HtmlText => HtmlText.fromValue(inline.value);
}

/**
 * Companion namespace for {@link RawMarkdown}.
 *
 * **Example** (Type raw markdown)
 *
 * ```ts import.meta.vitest name="Type raw markdown"
 * import { RawMarkdown } from "@beep/md/Md.model"
 *
 * const node: RawMarkdown.Type = RawMarkdown.make({ value: "**trusted**" })
 * node.value // => "**trusted**"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RawMarkdown {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "rawMarkdown";
    readonly value: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Raw HTML inline content for adapters that opt into trusted HTML rendering.
 *
 * **Details**
 *
 * The built-in HTML adapter escapes this value by default.
 *
 * **Example** (Make raw HTML)
 *
 * ```ts
 * import { RawHtml } from "@beep/md/Md.model"
 *
 * const node = RawHtml.make({ value: "<span>trusted</span>" })
 * console.log(node._tag) // "rawHtml"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawHtml extends S.TaggedClass<RawHtml>($I`RawHtml`)(
  "rawHtml",
  {
    value: S.String.annotateKey({
      description: "Trusted HTML source preserved for adapters that opt into raw HTML.",
    }),
  },
  $I.annote("RawHtml", {
    description:
      "Raw HTML inline content for adapters that opt into trusted HTML rendering. The built-in HTML adapter escapes this value by default.",
  })
) {
  static readonly toPlainText = (inline: RawHtml): string => inline.value;

  static readonly toHtml = (inline: RawHtml): HtmlText => HtmlText.fromValue(inline.value);
}

/**
 * Companion namespace for {@link RawHtml}.
 *
 * **Example** (Type raw HTML)
 *
 * ```ts
 * import { RawHtml } from "@beep/md/Md.model"
 *
 * const node: RawHtml.Type = RawHtml.make({ value: "<span>trusted</span>" })
 * console.log(node.value) // "<span>trusted</span>"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RawHtml {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "rawHtml";
    readonly value: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Strong inline content.
 *
 * **Example** (Make strong node)
 *
 * ```ts import.meta.vitest name="Make strong node"
 * import { Strong, Text } from "@beep/md/Md.model"
 *
 * const node = Strong.make({ children: [Text.make({ value: "important" })] })
 * node._tag // => "strong"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Strong extends S.TaggedClass<Strong>($I`Strong`)(
  "strong",
  {
    children: InlineChildren.annotateKey({
      description: "Inline nodes rendered with strong emphasis.",
    }),
  },
  $I.annote("Strong", {
    description: "Strong inline content.",
  })
) {
  static toPlainText(inline: Strong): string {
    return Inline.toPlainTextAll(inline.children);
  }

  static toHtml(inline: Strong, insideAnchor = false): HtmlModel.Strong {
    return HtmlModel.Strong.make({ children: Inline.toHtmlAll(inline.children, insideAnchor) });
  }
}

/**
 * Companion namespace for {@link Strong}.
 *
 * **Example** (Type strong node)
 *
 * ```ts import.meta.vitest name="Type strong node"
 * import { Strong, Text } from "@beep/md/Md.model"
 *
 * const node: Strong.Type = Strong.make({ children: [Text.make({ value: "important" })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Strong {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "strong";
    readonly children: InlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "strong";
    readonly children: InlineChildren.Encoded;
  }
}

/**
 * Emphasized inline content.
 *
 * **Example** (Make emphasis node)
 *
 * ```ts import.meta.vitest name="Make emphasis node"
 * import { Em, Text } from "@beep/md/Md.model"
 *
 * const node = Em.make({ children: [Text.make({ value: "note" })] })
 * node._tag // => "em"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Em extends S.TaggedClass<Em>($I`Em`)(
  "em",
  {
    children: InlineChildren.annotateKey({
      description: "Inline nodes rendered with emphasis.",
    }),
  },
  $I.annote("Em", {
    description: "Emphasized inline content.",
  })
) {
  static toPlainText(inline: Em): string {
    return Inline.toPlainTextAll(inline.children);
  }

  static toHtml(inline: Em, insideAnchor = false): HtmlModel.Em {
    return HtmlModel.Em.make({ children: Inline.toHtmlAll(inline.children, insideAnchor) });
  }
}

/**
 * Companion namespace for {@link Em}.
 *
 * **Example** (Type emphasis node)
 *
 * ```ts import.meta.vitest name="Type emphasis node"
 * import { Em, Text } from "@beep/md/Md.model"
 *
 * const node: Em.Type = Em.make({ children: [Text.make({ value: "note" })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Em {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "em";
    readonly children: InlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "em";
    readonly children: InlineChildren.Encoded;
  }
}

/**
 * Deleted inline content.
 *
 * **Example** (Make deleted node)
 *
 * ```ts import.meta.vitest name="Make deleted node"
 * import { Del, Text } from "@beep/md/Md.model"
 *
 * const node = Del.make({ children: [Text.make({ value: "removed" })] })
 * node._tag // => "del"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Del extends S.TaggedClass<Del>($I`Del`)(
  "del",
  {
    children: InlineChildren.annotateKey({
      description: "Inline nodes rendered as deleted content.",
    }),
  },
  $I.annote("Del", {
    description: "Deleted inline content.",
  })
) {
  static toPlainText(inline: Del): string {
    return Inline.toPlainTextAll(inline.children);
  }

  static toHtml(inline: Del, insideAnchor = false): HtmlModel.Del {
    return HtmlModel.Del.make({ children: Inline.toHtmlAll(inline.children, insideAnchor) });
  }
}

/**
 * Companion namespace for {@link Del}.
 *
 * **Example** (Type deleted node)
 *
 * ```ts import.meta.vitest name="Type deleted node"
 * import { Del, Text } from "@beep/md/Md.model"
 *
 * const node: Del.Type = Del.make({ children: [Text.make({ value: "removed" })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Del {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "del";
    readonly children: InlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "del";
    readonly children: InlineChildren.Encoded;
  }
}

/**
 * Inline code span.
 *
 * **Example** (Make inline code)
 *
 * ```ts import.meta.vitest name="Make inline code"
 * import { Code } from "@beep/md/Md.model"
 *
 * const node = Code.make({ value: "console.log()" })
 * node._tag // => "code"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Code extends S.TaggedClass<Code>($I`Code`)(
  "code",
  {
    value: S.String.annotateKey({
      description: "Code span text rendered between inline code delimiters.",
    }),
  },
  $I.annote("Code", {
    description: "Inline code span.",
  })
) {
  static readonly toPlainText = (inline: Code): string => inline.value;

  static readonly toHtml = (inline: Code): HtmlModel.Code =>
    HtmlModel.Code.make({ children: [HtmlText.fromValue(inline.value)] });
}

/**
 * Companion namespace for {@link Code}.
 *
 * **Example** (Type inline code)
 *
 * ```ts import.meta.vitest name="Type inline code"
 * import { Code } from "@beep/md/Md.model"
 *
 * const node: Code.Type = Code.make({ value: "console.log()" })
 * node.value // => "console.log()"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Code {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "code";
    readonly value: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Inline hyperlink.
 *
 * **Example** (Make hyperlink node)
 *
 * ```ts import.meta.vitest name="Make hyperlink node"
 * import { A, Text } from "@beep/md/Md.model"
 *
 * const node = A.make({ href: "https://example.com", children: [Text.make({ value: "Example" })] })
 * node._tag // => "a"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class A extends S.TaggedClass<A>($I`A`)(
  "a",
  {
    children: InlineChildren.annotateKey({
      description: "Inline nodes rendered as the link label.",
    }),
    href: S.String.annotateKey({
      description: "Markdown link destination or URL.",
    }),
    title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional link title rendered when present.",
    }),
  },
  $I.annote("A", {
    description: "Inline hyperlink.",
  })
) {
  static toPlainText(inline: A): string {
    return Inline.toPlainTextAll(inline.children);
  }

  static toHtml(inline: A, insideAnchor = false): HtmlModel.A | HtmlModel.Span {
    const children = Inline.toHtmlAll(inline.children, true);

    return insideAnchor
      ? HtmlModel.Span.make({ children, title: inline.title })
      : HtmlModel.A.make({ children, href: O.some(inline.href), title: inline.title });
  }
}

/**
 * Companion namespace for {@link A}.
 *
 * **Example** (Type hyperlink node)
 *
 * ```ts import.meta.vitest name="Type hyperlink node"
 * import { A, Text } from "@beep/md/Md.model"
 *
 * const node: A.Type = A.make({ href: "https://example.com", children: [Text.make({ value: "Example" })] })
 * node.href // => "https://example.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace A {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "a";
    readonly children: InlineChildren.Type;
    readonly href: string;
    readonly title: O.Option<string>;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "a";
    readonly children: InlineChildren.Encoded;
    readonly href: string;
    readonly title?: string;
  }
}

/**
 * Inline image.
 *
 * **Example** (Make image node)
 *
 * ```ts import.meta.vitest name="Make image node"
 * import { Img } from "@beep/md/Md.model"
 *
 * const node = Img.make({ src: "/logo.png", alt: "Logo" })
 * node._tag // => "img"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Img extends S.TaggedClass<Img>($I`Img`)(
  "img",
  {
    alt: S.String.annotateKey({
      description: "Image alternate text.",
    }),
    src: S.String.annotateKey({
      description: "Image source URL or path.",
    }),
    title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional image title rendered when present.",
    }),
  },
  $I.annote("Img", {
    description: "Inline image.",
  })
) {
  static readonly toPlainText = (inline: Img): string => inline.alt;

  static readonly toHtml = (inline: Img): HtmlModel.Img =>
    HtmlModel.Img.make({
      alt: O.some(inline.alt),
      src: O.some(inline.src),
      title: inline.title,
    });
}

/**
 * Companion namespace for {@link Img}.
 *
 * **Example** (Type image node)
 *
 * ```ts import.meta.vitest name="Type image node"
 * import { Img } from "@beep/md/Md.model"
 *
 * const node: Img.Type = Img.make({ src: "/logo.png", alt: "Logo" })
 * node.src // => "/logo.png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Img {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "img";
    readonly alt: string;
    readonly src: string;
    readonly title: O.Option<string>;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "img";
    readonly alt: string;
    readonly src: string;
    readonly title?: string;
  }
}

/**
 * Inline line break.
 *
 * **Example** (Make line break)
 *
 * ```ts import.meta.vitest name="Make line break"
 * import { Br } from "@beep/md/Md.model"
 *
 * const node = Br.make({})
 * node._tag // => "br"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Br extends S.TaggedClass<Br>($I`Br`)(
  "br",
  {},
  $I.annote("Br", {
    description: "Inline line break.",
  })
) {
  static readonly toPlainText = (): string => "\n";

  static readonly toHtml = (): HtmlModel.Br => HtmlModel.Br.make({});
}

/**
 * Companion namespace for {@link Br}.
 *
 * **Example** (Type line break)
 *
 * ```ts import.meta.vitest name="Type line break"
 * import { Br } from "@beep/md/Md.model"
 *
 * const node: Br.Type = Br.make({})
 * node._tag // => "br"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Br {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "br";
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Inline TeX math content.
 *
 * **Example** (Make inline math)
 *
 * ```ts import.meta.vitest name="Make inline math"
 * import { InlineMath } from "@beep/md/Md.model"
 *
 * const node = InlineMath.make({ value: "a^2 + b^2" })
 * node._tag // => "inlineMath"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InlineMath extends S.TaggedClass<InlineMath>($I`InlineMath`)(
  "inlineMath",
  {
    value: S.String.annotateKey({
      description: "TeX math source rendered as inert inline math content.",
    }),
  },
  $I.annote("InlineMath", {
    description: "Inline TeX math content.",
  })
) {
  static readonly toPlainText = (inline: InlineMath): string => inline.value;

  static readonly toHtml = (inline: InlineMath): HtmlModel.Code =>
    HtmlModel.Code.make({ children: [HtmlText.fromValue(inline.value)] });
}

/**
 * Companion namespace for {@link InlineMath}.
 *
 * **Example** (Encode inline math)
 *
 * ```ts
 * import type { InlineMath } from "@beep/md/Md.model"
 *
 * const encoded: InlineMath.Encoded = { _tag: "inlineMath", value: "a+b" }
 * console.log(encoded._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace InlineMath {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "inlineMath";
    readonly value: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Inline footnote reference.
 *
 * **Example** (Make footnote reference)
 *
 * ```ts import.meta.vitest name="Make footnote reference"
 * import { FootnoteReference } from "@beep/md/Md.model"
 *
 * const node = FootnoteReference.make({ identifier: "note-1" })
 * node._tag // => "footnoteReference"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FootnoteReference extends S.TaggedClass<FootnoteReference>($I`FootnoteReference`)(
  "footnoteReference",
  {
    identifier: FootnoteIdentifier.annotateKey({
      description: "Footnote identifier referenced from inline content.",
    }),
  },
  $I.annote("FootnoteReference", {
    description: "Inline footnote reference.",
  })
) {
  static readonly toPlainText = (inline: FootnoteReference): string => inline.identifier;

  static readonly toHtml = (inline: FootnoteReference): HtmlModel.Sup =>
    HtmlModel.Sup.make({
      children: [
        HtmlModel.A.make({
          children: [HtmlText.fromValue(inline.identifier)],
          href: O.some(`#fn-${inline.identifier}`),
        }),
      ],
    });
}

/**
 * Companion namespace for {@link FootnoteReference}.
 *
 * **Example** (Encode footnote reference)
 *
 * ```ts
 * import type { FootnoteReference } from "@beep/md/Md.model"
 *
 * const encoded: FootnoteReference.Encoded = { _tag: "footnoteReference", identifier: "note-1" }
 * console.log(encoded.identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FootnoteReference {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "footnoteReference";
    readonly identifier: FootnoteIdentifier;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "footnoteReference";
    readonly identifier: string;
  }
}

/**
 * Discriminated union of inline Markdown AST nodes.
 *
 * **Example** (Decode and project inline union)
 *
 * ```ts import.meta.vitest name="Decode and project inline union"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Inline, Text } from "@beep/md/Md.model"
 *
 * const decode = S.decodeUnknownResult(Inline)
 * const node = Result.getOrThrow(decode(Text.make({ value: "Hello" })))
 * node._tag // => "text"
 * Inline.toPlainText(node) // => "Hello"
 * Inline.toHtml(node)._tag // => "#text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Inline = S.Union([
  Text,
  RawMarkdown,
  RawHtml,
  Strong,
  Em,
  Del,
  Code,
  A,
  Img,
  Br,
  InlineMath,
  FootnoteReference,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Inline", {
    description: "Discriminated union of inline Markdown AST nodes.",
  }),
  SchemaUtils.withStatics((schema) => {
    const toPlainText = schema.match({
      text: Text.toPlainText,
      rawMarkdown: RawMarkdown.toPlainText,
      rawHtml: RawHtml.toPlainText,
      strong: Strong.toPlainText,
      em: Em.toPlainText,
      del: Del.toPlainText,
      code: Code.toPlainText,
      a: A.toPlainText,
      img: Img.toPlainText,
      br: Br.toPlainText,
      inlineMath: InlineMath.toPlainText,
      footnoteReference: FootnoteReference.toPlainText,
    });
    const toHtmlWithContext = schema.match({
      text: (inline) => (_insideAnchor: boolean) => Text.toHtml(inline),
      rawMarkdown: (inline) => (_insideAnchor: boolean) => RawMarkdown.toHtml(inline),
      rawHtml: (inline) => (_insideAnchor: boolean) => RawHtml.toHtml(inline),
      strong: (inline) => (insideAnchor: boolean) => Strong.toHtml(inline, insideAnchor),
      em: (inline) => (insideAnchor: boolean) => Em.toHtml(inline, insideAnchor),
      del: (inline) => (insideAnchor: boolean) => Del.toHtml(inline, insideAnchor),
      code: (inline) => (_insideAnchor: boolean) => Code.toHtml(inline),
      a: (inline) => (insideAnchor: boolean) => A.toHtml(inline, insideAnchor),
      img: (inline) => (_insideAnchor: boolean) => Img.toHtml(inline),
      br: () => (_insideAnchor: boolean) => Br.toHtml(),
      inlineMath: (inline) => (_insideAnchor: boolean) => InlineMath.toHtml(inline),
      footnoteReference: (inline) => (_insideAnchor: boolean) => FootnoteReference.toHtml(inline),
    });
    const toHtml = (inline: Inline.Type, insideAnchor = false): HtmlChildNode =>
      toHtmlWithContext(inline)(insideAnchor);

    return {
      is: S.is(schema),
      toHtml,
      toHtmlAll: (inlines: ReadonlyArray<Inline.Type>, insideAnchor = false): ReadonlyArray<HtmlChildNode> =>
        Arr.map(inlines, (inline) => toHtml(inline, insideAnchor)),
      toPlainText,
      toPlainTextAll: (inlines: ReadonlyArray<Inline.Type>): string => Arr.join(Arr.map(inlines, toPlainText), ""),
    };
  })
);

/**
 * Runtime type for {@link Inline}.
 *
 * **Example** (Type inline node)
 *
 * ```ts import.meta.vitest name="Type inline node"
 * import { Text } from "@beep/md/Md.model"
 * import type { Inline } from "@beep/md/Md.model"
 *
 * const node: Inline = Text.make({ value: "Hello" })
 * node._tag // => "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Inline = typeof Inline.Type;

/**
 * Companion namespace for {@link Inline}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { Text } from "@beep/md/Md.model"
 * import type { Inline } from "@beep/md/Md.model"
 *
 * const node: Inline.Type = Text.make({ value: "Hello" })
 * node._tag // => "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Inline {
  /**
   * @since 0.0.0
   */
  export type Type =
    | Text.Type
    | RawMarkdown.Type
    | RawHtml.Type
    | Strong.Type
    | Em.Type
    | Del.Type
    | Code.Type
    | A.Type
    | Img.Type
    | Br.Type
    | InlineMath.Type
    | FootnoteReference.Type;

  /**
   * @since 0.0.0
   */
  export type Encoded =
    | Text.Encoded
    | RawMarkdown.Encoded
    | RawHtml.Encoded
    | Strong.Encoded
    | Em.Encoded
    | Del.Encoded
    | Code.Encoded
    | A.Encoded
    | Img.Encoded
    | Br.Encoded
    | InlineMath.Encoded
    | FootnoteReference.Encoded;
}

/**
 * Recursive block child list used by document and block quote containers.
 *
 * **Example** (Decode block children)
 *
 * ```ts import.meta.vitest name="Decode block children"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { BlockChildren, P, Text } from "@beep/md/Md.model"
 *
 * const children = Result.getOrThrow(
 *   S.decodeUnknownResult(BlockChildren)([P.make({ children: [Text.make({ value: "Hello" })] })])
 * )
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BlockChildren = S.Array(S.suspend((): S.Codec<Block.Type, Block.Encoded> => Block))
  .check(MarkdownArbitraryArraySizeHint)
  .pipe(
    $I.annoteSchema("BlockChildren", {
      description: "Recursive block children used by Markdown block container nodes.",
    })
  );

/**
 * Type for {@link BlockChildren}.
 *
 * **Example** (Type block children)
 *
 * ```ts import.meta.vitest name="Type block children"
 * import { P, Text } from "@beep/md/Md.model"
 * import type { BlockChildren } from "@beep/md/Md.model"
 *
 * const children: BlockChildren = [P.make({ children: [Text.make({ value: "Hello" })] })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BlockChildren = typeof BlockChildren.Type;

/**
 * Companion namespace for {@link BlockChildren}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { P, Text } from "@beep/md/Md.model"
 * import type { BlockChildren } from "@beep/md/Md.model"
 *
 * const children: BlockChildren.Type = [P.make({ children: [Text.make({ value: "Hello" })] })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace BlockChildren {
  /**
   * @since 0.0.0
   */
  export type Type = ReadonlyArray<Block.Type>;

  /**
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<Block.Encoded>;
}

/**
 * List item child content. Inline children render directly after the list marker;
 * block children preserve nested document structure such as paragraphs, code
 * blocks, and nested lists.
 *
 * **Example** (Decode and project list item child)
 *
 * ```ts import.meta.vitest name="Decode and project list item child"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ListItemChild, Text } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(ListItemChild)(Text.make({ value: "Hello" }))
 * Result.isSuccess(result) && result.success._tag === "text" // => true
 * Result.isSuccess(result) && ListItemChild.toPlainText(result.success) === "Hello" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ListItemChild = S.suspend(
  (): S.Codec<Inline.Type | Block.Type, Inline.Encoded | Block.Encoded> => S.Union([Inline, Block])
).pipe(
  $I.annoteSchema("ListItemChild", {
    description: "Inline or block Markdown AST node rendered inside a list item.",
  }),
  SchemaUtils.withStatics(() => {
    const toHtml = (child: ListItemChild.Type): HtmlChildNode =>
      Inline.is(child) ? Inline.toHtml(child) : Block.toHtml(child);
    const toPlainText = (child: ListItemChild.Type): string =>
      Inline.is(child) ? Inline.toPlainText(child) : Block.toPlainText(child);
    const toPlainTextSegments = (children: ReadonlyArray<ListItemChild.Type>): ReadonlyArray<string> =>
      Arr.match(children, {
        onEmpty: Arr.empty<string>,
        onNonEmpty: (items) =>
          Arr.flatMap(
            Arr.groupWith(items, (left, right) => Inline.is(left) === Inline.is(right)),
            (run) =>
              Inline.is(Arr.headNonEmpty(run))
                ? [Inline.toPlainTextAll(Arr.filter(run, Inline.is))]
                : Arr.map(Arr.filter(run, Block.is), Block.toPlainText)
          ),
      });

    return {
      toHtml,
      toHtmlAll: (children: ReadonlyArray<ListItemChild.Type>): ReadonlyArray<HtmlChildNode> =>
        Arr.map(children, toHtml),
      toPlainText,
      toPlainTextAll: (children: ReadonlyArray<ListItemChild.Type>): string =>
        Arr.join(toPlainTextSegments(children), "\n"),
    };
  })
);

/**
 * Runtime type for {@link ListItemChild}.
 *
 * **Example** (Type list item child)
 *
 * ```ts import.meta.vitest name="Type list item child"
 * import { Text } from "@beep/md/Md.model"
 * import type { ListItemChild } from "@beep/md/Md.model"
 *
 * const child: ListItemChild = Text.make({ value: "Hello" })
 * child._tag // => "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListItemChild = typeof ListItemChild.Type;

/**
 * Companion namespace for {@link ListItemChild}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { Text } from "@beep/md/Md.model"
 * import type { ListItemChild } from "@beep/md/Md.model"
 *
 * const child: ListItemChild.Type = Text.make({ value: "Hello" })
 * child._tag // => "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ListItemChild {
  /**
   * @since 0.0.0
   */
  export type Type = Inline.Type | Block.Type;

  /**
   * @since 0.0.0
   */
  export type Encoded = Inline.Encoded | Block.Encoded;
}

/**
 * List item children used by ordered, unordered, and task list items.
 *
 * **Example** (Decode list item children)
 *
 * ```ts import.meta.vitest name="Decode list item children"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { ListItemChildren, Text } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(ListItemChildren)([Text.make({ value: "Hello" })])
 * Result.isSuccess(result) && result.success.length === 1 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ListItemChildren = S.Array(ListItemChild)
  .check(MarkdownArbitraryArraySizeHint)
  .pipe(
    $I.annoteSchema("ListItemChildren", {
      description: "Inline and block children rendered inside a Markdown list item.",
    })
  );

/**
 * Type for {@link ListItemChildren}.
 *
 * **Example** (Type list item children)
 *
 * ```ts import.meta.vitest name="Type list item children"
 * import { Text } from "@beep/md/Md.model"
 * import type { ListItemChildren } from "@beep/md/Md.model"
 *
 * const children: ListItemChildren = [Text.make({ value: "Hello" })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListItemChildren = typeof ListItemChildren.Type;

/**
 * Companion namespace for {@link ListItemChildren}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { Text } from "@beep/md/Md.model"
 * import type { ListItemChildren } from "@beep/md/Md.model"
 *
 * const children: ListItemChildren.Type = [Text.make({ value: "Hello" })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ListItemChildren {
  /**
   * @since 0.0.0
   */
  export type Type = ReadonlyArray<ListItemChild.Type>;

  /**
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<ListItemChild.Encoded>;
}

/**
 * Paragraph block.
 *
 * **Example** (Make paragraph node)
 *
 * ```ts import.meta.vitest name="Make paragraph node"
 * import { P, Text } from "@beep/md/Md.model"
 *
 * const node = P.make({ children: [Text.make({ value: "Hello" })] })
 * node._tag // => "p"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class P extends S.TaggedClass<P>($I`P`)(
  "p",
  {
    children: InlineChildren.annotateKey({
      description: "Inline children rendered as paragraph content.",
    }),
  },
  $I.annote("P", {
    description: "Paragraph block.",
  })
) {
  static readonly toPlainText = (block: P): string => Inline.toPlainTextAll(block.children);

  static readonly toHtml = (block: P): HtmlModel.P => HtmlModel.P.make({ children: Inline.toHtmlAll(block.children) });
}

/**
 * Companion namespace for {@link P}.
 *
 * **Example** (Type paragraph node)
 *
 * ```ts import.meta.vitest name="Type paragraph node"
 * import { P, Text } from "@beep/md/Md.model"
 *
 * const node: P.Type = P.make({ children: [Text.make({ value: "Hello" })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace P {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "p";
    readonly children: InlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "p";
    readonly children: InlineChildren.Encoded;
  }
}

/**
 * Heading level from one (largest) to six (smallest).
 *
 * **Example** (Decode heading level)
 *
 * ```ts import.meta.vitest name="Decode heading level"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { HeadingLevel } from "@beep/md/Md.model"
 *
 * const result = S.decodeUnknownResult(HeadingLevel)(2)
 * Result.isSuccess(result) && result.success === 2 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeadingLevel = S.Literals([1, 2, 3, 4, 5, 6]).pipe(
  $I.annoteSchema("HeadingLevel", {
    description: "Markdown heading level from one (largest) to six (smallest).",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Type for {@link HeadingLevel}.
 *
 * **Example** (Type heading level)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { HeadingLevel } from "@beep/md/Md.model"
 *
 * const result: Result.Result<HeadingLevel, S.SchemaError> = S.decodeUnknownResult(HeadingLevel)(3)
 * console.log(Result.isSuccess(result) && result.success === 3) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HeadingLevel = typeof HeadingLevel.Type;

const makeHeadingValueMember = <Level extends HeadingLevel>({ literal }: S.Literal<Level>) =>
  S.Struct({
    level: S.tag(literal),
    children: InlineChildren.annotateKey({
      description: "Inline children rendered as heading content.",
    }),
  });

/**
 * Flat discriminated union of heading payloads keyed by their semantic level.
 *
 * **Details**
 *
 * The union retains the public `{ level, children }` shape while exposing
 * schema-derived `cases`, `guards`, `isAnyOf`, and exhaustive `match` helpers.
 * Heading content remains inline-only for every level.
 *
 * **Example** (Match a heading payload exhaustively)
 *
 * ```ts import.meta.vitest name="Match a heading payload exhaustively"
 * import { HeadingValue, Text } from "@beep/md/Md.model"
 *
 * const value = HeadingValue.cases[2].make({ children: [Text.make({ value: "Overview" })] })
 * const label = HeadingValue.match(value, {
 *   1: () => "h1",
 *   2: () => "h2",
 *   3: () => "h3",
 *   4: () => "h4",
 *   5: () => "h5",
 *   6: () => "h6",
 * })
 *
 * label // => "h2"
 * ```
 *
 * @invariant `level` is exactly one of the six CommonMark heading levels and `children` contains only inline nodes.
 * @see {@link https://spec.commonmark.org/0.31.2/#atx-headings} for the normative ATX heading level rules.
 * @see {@link https://spec.commonmark.org/0.31.2/#setext-headings} for the normative setext heading level rules.
 * @category models
 * @since 0.0.0
 */
export const HeadingValue = HeadingLevel.mapMembers(
  Tuple.evolve([
    makeHeadingValueMember,
    makeHeadingValueMember,
    makeHeadingValueMember,
    makeHeadingValueMember,
    makeHeadingValueMember,
    makeHeadingValueMember,
  ])
).pipe(
  S.toTaggedUnion("level"),
  $I.annoteSchema("HeadingValue", {
    description: "Flat discriminated union of Markdown heading payloads keyed by semantic level.",
  })
);

/**
 * Runtime heading payload represented by {@link HeadingValue}.
 *
 * @see {@link HeadingValue} for case constructors, guards, and exhaustive matching.
 * @category models
 * @since 0.0.0
 */
export type HeadingValue = typeof HeadingValue.Type;

/**
 * Encoded heading payload variants accepted by {@link HeadingValue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HeadingValue {
  /**
   * Encoded flat heading payload, discriminated by `level`.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = S.Codec.Encoded<typeof HeadingValue>;
}

/**
 * Heading block carrying its level alongside inline content.
 *
 * **Example** (Make heading node)
 *
 * ```ts import.meta.vitest name="Make heading node"
 * import { Heading, HeadingValue, Text } from "@beep/md/Md.model"
 *
 * const payload = HeadingValue.cases[1].make({ children: [Text.make({ value: "Title" })] })
 * const node = Heading.make(payload)
 * node._tag // => "heading"
 * node.level // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Heading extends S.TaggedClass<Heading>($I`Heading`)(
  "heading",
  {
    level: HeadingLevel.annotateKey({
      description: "Heading level from one (largest) to six (smallest).",
    }),
    children: InlineChildren.annotateKey({
      description: "Inline children rendered as heading content.",
    }),
  },
  $I.annote("Heading", {
    description: "Heading block carrying its level alongside inline content.",
  })
) {
  static readonly is = S.is(Heading);

  static readonly toPlainText = (block: Heading): string => Inline.toPlainTextAll(block.children);

  static readonly toHtml = (
    block: Heading
  ): HtmlModel.H1 | HtmlModel.H2 | HtmlModel.H3 | HtmlModel.H4 | HtmlModel.H5 | HtmlModel.H6 => {
    const children = Inline.toHtmlAll(block.children);

    return HeadingValue.match(block, {
      1: () => HtmlModel.H1.make({ children }),
      2: () => HtmlModel.H2.make({ children }),
      3: () => HtmlModel.H3.make({ children }),
      4: () => HtmlModel.H4.make({ children }),
      5: () => HtmlModel.H5.make({ children }),
      6: () => HtmlModel.H6.make({ children }),
    });
  };
}

/**
 * Companion namespace for {@link Heading}.
 *
 * **Example** (Type heading node)
 *
 * ```ts import.meta.vitest name="Type heading node"
 * import { Heading, Text } from "@beep/md/Md.model"
 *
 * const node: Heading.Type = Heading.make({ level: 1, children: [Text.make({ value: "Title" })] })
 * node.level // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Heading {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "heading";
    readonly children: InlineChildren.Type;
    readonly level: HeadingLevel;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "heading";
    readonly children: InlineChildren.Encoded;
    readonly level: HeadingLevel;
  }
}

/**
 * List item node used by ordered, unordered, and task lists.
 *
 * **Example** (Make list item)
 *
 * ```ts import.meta.vitest name="Make list item"
 * import { Li, Text } from "@beep/md/Md.model"
 *
 * const node = Li.make({ children: [Text.make({ value: "Item" })] })
 * node._tag // => "li"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Li extends S.TaggedClass<Li>($I`Li`)(
  "li",
  {
    children: ListItemChildren.annotateKey({
      description: "Inline and block children rendered inside the list item.",
    }),
  },
  $I.annote("Li", {
    description: "List item node used by ordered, unordered, and task lists.",
  })
) {
  static readonly is = S.is(Li);

  static readonly toPlainText = (item: Li): string => ListItemChild.toPlainTextAll(item.children);

  static readonly toHtml = (item: Li): HtmlModel.Li =>
    HtmlModel.Li.make({ children: ListItemChild.toHtmlAll(item.children) });
}

/**
 * Companion namespace for {@link Li}.
 *
 * **Example** (Type list item)
 *
 * ```ts import.meta.vitest name="Type list item"
 * import { Li, Text } from "@beep/md/Md.model"
 *
 * const node: Li.Type = Li.make({ children: [Text.make({ value: "Item" })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Li {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "li";
    readonly children: ListItemChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "li";
    readonly children: ListItemChildren.Encoded;
  }
}

/**
 * List children used by ordered and unordered list blocks.
 *
 * **Example** (Decode list children)
 *
 * ```ts import.meta.vitest name="Decode list children"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Li, ListChildren, Text } from "@beep/md/Md.model"
 *
 * const children = Result.getOrThrow(
 *   S.decodeUnknownResult(ListChildren)([Li.make({ children: [Text.make({ value: "Item" })] })])
 * )
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ListChildren = S.Array(Li)
  .check(MarkdownArbitraryArraySizeHint)
  .pipe(
    $I.annoteSchema("ListChildren", {
      description: "List item nodes used by ordered and unordered list blocks.",
    })
  );

/**
 * Type for {@link ListChildren}.
 *
 * **Example** (Type list children)
 *
 * ```ts import.meta.vitest name="Type list children"
 * import { Li, Text } from "@beep/md/Md.model"
 * import type { ListChildren } from "@beep/md/Md.model"
 *
 * const children: ListChildren = [Li.make({ children: [Text.make({ value: "Item" })] })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListChildren = typeof ListChildren.Type;

/**
 * Companion namespace for {@link ListChildren}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { Li, Text } from "@beep/md/Md.model"
 * import type { ListChildren } from "@beep/md/Md.model"
 *
 * const children: ListChildren.Type = [Li.make({ children: [Text.make({ value: "Item" })] })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ListChildren {
  /**
   * @since 0.0.0
   */
  export type Type = ReadonlyArray<Li.Type>;

  /**
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<Li.Encoded>;
}

/**
 * Unordered list block.
 *
 * **Example** (Make unordered list)
 *
 * ```ts import.meta.vitest name="Make unordered list"
 * import { Li, Text, Ul } from "@beep/md/Md.model"
 *
 * const node = Ul.make({ children: [Li.make({ children: [Text.make({ value: "Item" })] })] })
 * node._tag // => "ul"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Ul extends S.TaggedClass<Ul>($I`Ul`)(
  "ul",
  {
    children: ListChildren.annotateKey({
      description: "List items rendered as an unordered list.",
    }),
  },
  $I.annote("Ul", {
    description: "Unordered list block.",
  })
) {
  static readonly toPlainText = (block: Ul): string => Arr.join(Arr.map(block.children, Li.toPlainText), "\n");

  static readonly toHtml = (block: Ul): HtmlModel.Ul =>
    HtmlModel.Ul.make({ children: Arr.map(block.children, Li.toHtml) });
}

/**
 * Companion namespace for {@link Ul}.
 *
 * **Example** (Type unordered list)
 *
 * ```ts import.meta.vitest name="Type unordered list"
 * import { Li, Text, Ul } from "@beep/md/Md.model"
 *
 * const node: Ul.Type = Ul.make({ children: [Li.make({ children: [Text.make({ value: "Item" })] })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Ul {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "ul";
    readonly children: ListChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "ul";
    readonly children: ListChildren.Encoded;
  }
}

/**
 * Ordered-list start value retained by the broad Markdown AST.
 *
 * **Details**
 *
 * Zero is representable because CommonMark ordered-list markers may begin at
 * zero. Positive values retain the existing {@link PosInt} representation;
 * profile validation applies CommonMark's nine-digit upper bound without
 * narrowing the lossless AST.
 *
 * **Example** (Decode a zero start)
 *
 * ```ts import.meta.vitest name="Decode a zero start"
 * import { OrderedListStart } from "@beep/md/Md.model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(OrderedListStart)(0)
 * Result.isSuccess(result) && result.success === 0 // => true
 * ```
 *
 * @invariant Values are non-negative integers; strict CommonMark and GFM validation additionally caps them at 999999999.
 * @see {@link https://spec.commonmark.org/0.31.2/#list-items} for the normative ordered-list marker range.
 * @category models
 * @since 0.0.0
 */
export const OrderedListStart = S.Union([S.Literal(0), PosInt]).pipe(
  $I.annoteSchema("OrderedListStart", {
    description: "Non-negative ordered-list start retained by the broad Markdown AST.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "is"])
);

/**
 * Runtime ordered-list start represented by {@link OrderedListStart}.
 *
 * @see {@link OrderedListStart} for decoding and validation helpers.
 * @category models
 * @since 0.0.0
 */
export type OrderedListStart = typeof OrderedListStart.Type;

/**
 * Ordered list block.
 *
 * **Example** (Make ordered list)
 *
 * ```ts import.meta.vitest name="Make ordered list"
 * import { Li, Ol, Text } from "@beep/md/Md.model"
 *
 * const node = Ol.make({ children: [Li.make({ children: [Text.make({ value: "First" })] })] })
 * node._tag // => "ol"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Ol extends S.TaggedClass<Ol>($I`Ol`)(
  "ol",
  {
    children: ListChildren.annotateKey({
      description: "List items rendered as an ordered list.",
    }),
    start: OrderedListStart.pipe(SchemaUtils.withKeyDefaults(PosInt.make(1))).annotateKey({
      description: "First ordinal used by the ordered list. Defaults to one.",
    }),
  },
  $I.annote("Ol", {
    description: "Ordered list block.",
  })
) {
  static readonly toPlainText = (block: Ol): string => Arr.join(Arr.map(block.children, Li.toPlainText), "\n");

  static readonly toHtml = (block: Ol): HtmlModel.Ol =>
    HtmlModel.Ol.make({ children: Arr.map(block.children, Li.toHtml), start: O.some(block.start) });
}

/**
 * Companion namespace for {@link Ol}.
 *
 * **Example** (Type ordered list)
 *
 * ```ts import.meta.vitest name="Type ordered list"
 * import { Li, Ol, Text } from "@beep/md/Md.model"
 *
 * const node: Ol.Type = Ol.make({ children: [Li.make({ children: [Text.make({ value: "First" })] })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Ol {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "ol";
    readonly children: ListChildren.Type;
    readonly start: OrderedListStart;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "ol";
    readonly children: ListChildren.Encoded;
    readonly start?: number;
  }
}

/**
 * GFM task list item.
 *
 * **Example** (Make task item)
 *
 * ```ts import.meta.vitest name="Make task item"
 * import { TaskItem, Text } from "@beep/md/Md.model"
 *
 * const node = TaskItem.make({ checked: true, children: [Text.make({ value: "Done" })] })
 * node._tag // => "taskItem"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskItem extends S.TaggedClass<TaskItem>($I`TaskItem`)(
  "taskItem",
  {
    checked: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Whether the task list item is checked. Defaults to unchecked on construction and decode.",
    }),
    children: ListItemChildren.annotateKey({
      description: "Inline and block children rendered as the task item label.",
    }),
  },
  $I.annote("TaskItem", {
    description: "GFM task list item.",
  })
) {
  static readonly is = S.is(TaskItem);

  static readonly toPlainText = (item: TaskItem): string => ListItemChild.toPlainTextAll(item.children);

  static readonly toHtml = (item: TaskItem): HtmlModel.Li =>
    HtmlModel.Li.make({
      children: [HtmlText.fromValue(item.checked ? "☒ " : "☐ "), ...ListItemChild.toHtmlAll(item.children)],
    });
}

/**
 * Companion namespace for {@link TaskItem}.
 *
 * **Example** (Type task item)
 *
 * ```ts import.meta.vitest name="Type task item"
 * import { TaskItem, Text } from "@beep/md/Md.model"
 *
 * const node: TaskItem.Type = TaskItem.make({ checked: true, children: [Text.make({ value: "Done" })] })
 * node.checked // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TaskItem {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "taskItem";
    readonly checked: boolean;
    readonly children: ListItemChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "taskItem";
    readonly checked?: boolean;
    readonly children: ListItemChildren.Encoded;
  }
}

/**
 * Canonical schema-derived task-list constructor input.
 *
 * **Details**
 *
 * Every value carries the `taskItem` discriminator and fully normalized child
 * nodes, keeping constructor input aligned with the persisted model.
 *
 * **Example** (Check task item spec)
 *
 * ```ts import.meta.vitest name="Check task item spec"
 * import { TaskItem, TaskListItemSpec, Text } from "@beep/md/Md.model"
 *
 * const item = TaskItem.make({ children: [Text.make({ value: "Todo" })] })
 * TaskListItemSpec.is(item) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TaskListItemSpec = TaskItem.pipe(
  $I.annoteSchema("TaskListItemSpec", {
    description: "Canonical tagged task-list item accepted by unambiguous builders.",
  })
);

/**
 * Type for {@link TaskListItemSpec}.
 *
 * **Example** (Type task item spec)
 *
 * ```ts import.meta.vitest name="Type task item spec"
 * import { TaskItem, Text } from "@beep/md/Md.model"
 * import type { TaskListItemSpec } from "@beep/md/Md.model"
 *
 * const item: TaskListItemSpec = TaskItem.make({ children: [Text.make({ value: "Todo" })] })
 * item._tag // => "taskItem"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TaskListItemSpec = typeof TaskListItemSpec.Type;

/**
 * Task item children used by GFM task list blocks.
 *
 * **Example** (Decode task item children)
 *
 * ```ts import.meta.vitest name="Decode task item children"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { TaskItem, TaskItemChildren, Text } from "@beep/md/Md.model"
 *
 * const children = Result.getOrThrow(
 *   S.decodeUnknownResult(TaskItemChildren)([TaskItem.make({ checked: false, children: [Text.make({ value: "Todo" })] })])
 * )
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TaskItemChildren = S.Array(TaskItem)
  .check(MarkdownArbitraryArraySizeHint)
  .pipe(
    $I.annoteSchema("TaskItemChildren", {
      description: "Task item children used by GFM task list blocks.",
    })
  );

/**
 * Type for {@link TaskItemChildren}.
 *
 * **Example** (Type task item children)
 *
 * ```ts import.meta.vitest name="Type task item children"
 * import { TaskItem, Text } from "@beep/md/Md.model"
 * import type { TaskItemChildren } from "@beep/md/Md.model"
 *
 * const children: TaskItemChildren = [TaskItem.make({ checked: false, children: [Text.make({ value: "Todo" })] })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TaskItemChildren = typeof TaskItemChildren.Type;

/**
 * Companion namespace for {@link TaskItemChildren}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { TaskItem, Text } from "@beep/md/Md.model"
 * import type { TaskItemChildren } from "@beep/md/Md.model"
 *
 * const children: TaskItemChildren.Type = [TaskItem.make({ checked: false, children: [Text.make({ value: "Todo" })] })]
 * children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TaskItemChildren {
  /**
   * @since 0.0.0
   */
  export type Type = ReadonlyArray<TaskItem.Type>;

  /**
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<TaskItem.Encoded>;
}

/**
 * GFM task list block.
 *
 * **Example** (Make task list)
 *
 * ```ts import.meta.vitest name="Make task list"
 * import { TaskItem, TaskList, Text } from "@beep/md/Md.model"
 *
 * const node = TaskList.make({ children: [TaskItem.make({ checked: false, children: [Text.make({ value: "Todo" })] })] })
 * node._tag // => "taskList"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskList extends S.TaggedClass<TaskList>($I`TaskList`)(
  "taskList",
  {
    children: TaskItemChildren.annotateKey({
      description: "Task items rendered as a GitHub Flavored Markdown task list.",
    }),
  },
  $I.annote("TaskList", {
    description: "GFM task list block.",
  })
) {
  static readonly toPlainText = (block: TaskList): string =>
    Arr.join(Arr.map(block.children, TaskItem.toPlainText), "\n");

  static readonly toHtml = (block: TaskList): HtmlModel.Ul =>
    HtmlModel.Ul.make({ children: Arr.map(block.children, TaskItem.toHtml) });
}

/**
 * Companion namespace for {@link TaskList}.
 *
 * **Example** (Type task list)
 *
 * ```ts import.meta.vitest name="Type task list"
 * import { TaskItem, TaskList, Text } from "@beep/md/Md.model"
 *
 * const node: TaskList.Type = TaskList.make({
 *   children: [TaskItem.make({ checked: false, children: [Text.make({ value: "Todo" })] })],
 * })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TaskList {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "taskList";
    readonly children: TaskItemChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "taskList";
    readonly children: TaskItemChildren.Encoded;
  }
}

/**
 * Block quote container.
 *
 * **Example** (Make block quote)
 *
 * ```ts import.meta.vitest name="Make block quote"
 * import { BlockQuote, P, Text } from "@beep/md/Md.model"
 *
 * const node = BlockQuote.make({ children: [P.make({ children: [Text.make({ value: "Quote" })] })] })
 * node._tag // => "blockquote"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockQuote extends S.TaggedClass<BlockQuote>($I`BlockQuote`)(
  "blockquote",
  {
    children: BlockChildren.annotateKey({
      description: "Block children rendered inside the block quote.",
    }),
  },
  $I.annote("BlockQuote", {
    description: "Block quote container.",
  })
) {
  static toPlainText(block: BlockQuote): string {
    return Block.toPlainTextAll(block.children);
  }

  static toHtml(block: BlockQuote): HtmlModel.Blockquote {
    return HtmlModel.Blockquote.make({ children: Block.toHtmlAll(block.children) });
  }
}

/**
 * Companion namespace for {@link BlockQuote}.
 *
 * **Example** (Type block quote)
 *
 * ```ts import.meta.vitest name="Type block quote"
 * import { BlockQuote, P, Text } from "@beep/md/Md.model"
 *
 * const node: BlockQuote.Type = BlockQuote.make({ children: [P.make({ children: [Text.make({ value: "Quote" })] })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace BlockQuote {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "blockquote";
    readonly children: BlockChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "blockquote";
    readonly children: BlockChildren.Encoded;
  }
}

/**
 * Fenced code block.
 *
 * **Example** (Make fenced code)
 *
 * ```ts import.meta.vitest name="Make fenced code"
 * import * as O from "effect/Option"
 * import { Pre } from "@beep/md/Md.model"
 *
 * const node = Pre.make({ language: O.some("ts"), value: "console.log('beep')" })
 * node._tag // => "pre"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Pre extends S.TaggedClass<Pre>($I`Pre`)(
  "pre",
  {
    // Encoded form must survive a JSON boundary (jsonb columns, rpc/ndjson
    // wire): S.Option(S.String) encodes to a real Option instance that does not
    // round-trip through JSON, so persisted/transported documents stay
    // `string | null` on the wire. Decoding folds legacy free-form info strings
    // through CodeFenceLanguage, dropping non-conforming tokens to None so the
    // rendered language is always a single safe token.
    language: S.OptionFromNullOr(S.String)
      .pipe(
        S.decodeTo(S.Option(CodeFenceLanguage), {
          decode: SchemaGetter.transform(O.flatMap(CodeFenceLanguage.decodeUnknownOption)),
          encode: SchemaGetter.transform(identity),
        })
      )
      .annotateKey({
        description: "Optional safe language hint for fenced code rendering.",
      }),
    value: S.String.annotateKey({
      description: "Literal code block contents.",
    }),
  },
  $I.annote("Pre", {
    description: "Fenced code block.",
  })
) {
  static readonly toPlainText = (block: Pre): string => block.value;

  static readonly toHtml = (block: Pre): HtmlModel.Pre =>
    HtmlModel.Pre.make({
      children: [HtmlModel.Code.make({ children: [HtmlText.fromValue(block.value)] })],
    });
}

/**
 * Companion namespace for {@link Pre}.
 *
 * **Example** (Type fenced code)
 *
 * ```ts import.meta.vitest name="Type fenced code"
 * import * as O from "effect/Option"
 * import { Pre } from "@beep/md/Md.model"
 *
 * const node: Pre.Type = Pre.make({ language: O.some("ts"), value: "console.log('beep')" })
 * node.value // => "console.log('beep')"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Pre {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "pre";
    readonly language: O.Option<CodeFenceLanguage>;
    readonly value: string;
  }

  /**
   * The encoded form keeps `language` JSON-safe (`string | null`) so a Pre
   * survives a JSON boundary (jsonb columns, rpc/ndjson wire); see the
   * `OptionFromNullOr` codec on {@link Pre}.
   *
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "pre";
    readonly language: string | null;
    readonly value: string;
  }
}

/**
 * Table cell containing inline Markdown content.
 *
 * **Example** (Make table cell)
 *
 * ```ts import.meta.vitest name="Make table cell"
 * import { TableCell, Text } from "@beep/md/Md.model"
 *
 * const node = TableCell.make({ children: [Text.make({ value: "Name" })] })
 * node._tag // => "tableCell"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TableCell extends S.TaggedClass<TableCell>($I`TableCell`)(
  "tableCell",
  {
    children: InlineChildren.annotateKey({
      description: "Inline nodes rendered inside this table cell.",
    }),
  },
  $I.annote("TableCell", {
    description: "Table cell containing inline Markdown content.",
  })
) {
  static readonly is = S.is(TableCell);

  static readonly toPlainText = (cell: TableCell): string => Inline.toPlainTextAll(cell.children);

  static readonly toHtml = (cell: TableCell, header = false): HtmlModel.Td | HtmlModel.Th => {
    const children = Inline.toHtmlAll(cell.children);
    return header ? HtmlModel.Th.make({ children }) : HtmlModel.Td.make({ children });
  };
}

/**
 * Companion namespace for {@link TableCell}.
 *
 * **Example** (Type table cell)
 *
 * ```ts import.meta.vitest name="Type table cell"
 * import { TableCell, Text } from "@beep/md/Md.model"
 *
 * const node: TableCell.Type = TableCell.make({ children: [Text.make({ value: "Name" })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TableCell {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "tableCell";
    readonly children: InlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "tableCell";
    readonly children: InlineChildren.Encoded;
  }
}

/**
 * Table row containing cells in column order.
 *
 * **Example** (Make table row)
 *
 * ```ts import.meta.vitest name="Make table row"
 * import { TableCell, TableRow, Text } from "@beep/md/Md.model"
 *
 * const node = TableRow.make({ children: [TableCell.make({ children: [Text.make({ value: "Name" })] })] })
 * node._tag // => "tableRow"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TableRow extends S.TaggedClass<TableRow>($I`TableRow`)(
  "tableRow",
  {
    children: S.Array(TableCell).annotateKey({
      description: "Table cells in column order.",
    }),
  },
  $I.annote("TableRow", {
    description: "Table row containing cells in column order.",
  })
) {
  static readonly is = S.is(TableRow);

  static readonly toPlainText = (row: TableRow): string => Arr.join(Arr.map(row.children, TableCell.toPlainText), "\t");

  static readonly toHtml = (row: TableRow, header = false): HtmlModel.Tr =>
    HtmlModel.Tr.make({ children: Arr.map(row.children, (cell) => TableCell.toHtml(cell, header)) });
}

/**
 * Companion namespace for {@link TableRow}.
 *
 * **Example** (Type table row)
 *
 * ```ts import.meta.vitest name="Type table row"
 * import { TableCell, TableRow, Text } from "@beep/md/Md.model"
 *
 * const node: TableRow.Type = TableRow.make({ children: [TableCell.make({ children: [Text.make({ value: "Name" })] })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TableRow {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "tableRow";
    readonly children: ReadonlyArray<TableCell.Type>;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "tableRow";
    readonly children: ReadonlyArray<TableCell.Encoded>;
  }
}

/**
 * Markdown table block.
 *
 * **Example** (Make table block)
 *
 * ```ts import.meta.vitest name="Make table block"
 * import { Table, TableCell, TableRow, Text } from "@beep/md/Md.model"
 *
 * const node = Table.make({
 *   headerRow: true,
 *   children: [TableRow.make({ children: [TableCell.make({ children: [Text.make({ value: "Name" })] })] })]
 * })
 * node._tag // => "table"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Table extends S.TaggedClass<Table>($I`Table`)(
  "table",
  {
    align: S.Array(TableAlignment).pipe(SchemaUtils.withEmptyArrayDefaults<TableAlignment>()).annotateKey({
      description: "Column alignment values in display order. Missing entries render as unaligned columns.",
    }),
    headerRow: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Whether the first row renders as a table header. Defaults to false on construction and decode.",
    }),
    children: S.Array(TableRow).annotateKey({
      description: "Table rows in display order.",
    }),
  },
  $I.annote("Table", {
    description: "Markdown table block with inline cell content.",
  })
) {
  static readonly toPlainText = (block: Table): string => Arr.join(Arr.map(block.children, TableRow.toPlainText), "\n");

  static readonly toHtml = (block: Table): HtmlModel.Table => {
    const [first, ...rest] = block.children;
    const children: ReadonlyArray<HtmlChildNode> =
      block.headerRow && first !== undefined
        ? [
            HtmlModel.Thead.make({ children: [TableRow.toHtml(first, true)] }),
            HtmlModel.Tbody.make({ children: Arr.map(rest, (row) => TableRow.toHtml(row)) }),
          ]
        : [HtmlModel.Tbody.make({ children: Arr.map(block.children, (row) => TableRow.toHtml(row)) })];

    return HtmlModel.Table.make({ children });
  };
}

/**
 * Companion namespace for {@link Table}.
 *
 * **Example** (Type table block)
 *
 * ```ts import.meta.vitest name="Type table block"
 * import { Table, TableCell, TableRow, Text } from "@beep/md/Md.model"
 *
 * const node: Table.Type = Table.make({
 *   headerRow: true,
 *   children: [TableRow.make({ children: [TableCell.make({ children: [Text.make({ value: "Name" })] })] })],
 * })
 * node.headerRow // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Table {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "table";
    readonly align: ReadonlyArray<TableAlignment>;
    readonly children: ReadonlyArray<TableRow.Type>;
    readonly headerRow: boolean;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "table";
    readonly align?: ReadonlyArray<TableAlignment> | undefined;
    readonly children: ReadonlyArray<TableRow.Encoded>;
    readonly headerRow?: boolean;
  }
}

/**
 * YouTube video embed block.
 *
 * **Example** (Make YouTube embed)
 *
 * ```ts import.meta.vitest name="Make YouTube embed"
 * import { YouTube } from "@beep/md/Md.model"
 *
 * const node = YouTube.make({ videoId: "M7lc1UVf-VE" })
 * node._tag // => "youtube"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YouTube extends S.TaggedClass<YouTube>($I`YouTube`)(
  "youtube",
  {
    videoId: YouTubeVideoId.annotateKey({
      description: "Bare YouTube video id rendered as an embedded video.",
    }),
  },
  $I.annote("YouTube", {
    description: "YouTube video embed block.",
  })
) {
  static readonly toPlainText = (block: YouTube): string => `https://www.youtube.com/watch?v=${block.videoId}`;

  static readonly toHtml = (block: YouTube): HtmlModel.P =>
    HtmlModel.P.make({
      children: [
        HtmlModel.A.make({
          children: [HtmlText.fromValue("Watch on YouTube")],
          href: O.some(`https://www.youtube.com/watch?v=${block.videoId}`),
        }),
      ],
    });
}

/**
 * Companion namespace for {@link YouTube}.
 *
 * **Example** (Type YouTube embed)
 *
 * ```ts import.meta.vitest name="Type YouTube embed"
 * import { YouTube } from "@beep/md/Md.model"
 *
 * const node: YouTube.Type = YouTube.make({ videoId: "M7lc1UVf-VE" })
 * node.videoId // => "M7lc1UVf-VE"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace YouTube {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "youtube";
    readonly videoId: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Display TeX math block.
 *
 * **Example** (Make math block)
 *
 * ```ts import.meta.vitest name="Make math block"
 * import { MathBlock } from "@beep/md/Md.model"
 *
 * const node = MathBlock.make({ value: "a^2 + b^2 = c^2" })
 * node._tag // => "mathBlock"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MathBlock extends S.TaggedClass<MathBlock>($I`MathBlock`)(
  "mathBlock",
  {
    value: S.String.annotateKey({
      description: "TeX math source rendered as inert display math content.",
    }),
  },
  $I.annote("MathBlock", {
    description: "Display TeX math block.",
  })
) {
  static readonly toPlainText = (block: MathBlock): string => block.value;

  static readonly toHtml = (block: MathBlock): HtmlModel.Pre =>
    HtmlModel.Pre.make({
      children: [HtmlModel.Code.make({ children: [HtmlText.fromValue(block.value)] })],
    });
}

/**
 * Companion namespace for {@link MathBlock}.
 *
 * **Example** (Encode math block)
 *
 * ```ts
 * import type { MathBlock } from "@beep/md/Md.model"
 *
 * const encoded: MathBlock.Encoded = { _tag: "mathBlock", value: "a=b" }
 * console.log(encoded._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace MathBlock {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "mathBlock";
    readonly value: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Footnote definition block.
 *
 * **Example** (Make footnote definition)
 *
 * ```ts import.meta.vitest name="Make footnote definition"
 * import { FootnoteDefinition, P, Text } from "@beep/md/Md.model"
 *
 * const node = FootnoteDefinition.make({
 *   identifier: "note-1",
 *   children: [P.make({ children: [Text.make({ value: "Body" })] })],
 * })
 * node._tag // => "footnoteDefinition"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FootnoteDefinition extends S.TaggedClass<FootnoteDefinition>($I`FootnoteDefinition`)(
  "footnoteDefinition",
  {
    identifier: FootnoteIdentifier.annotateKey({
      description: "Footnote identifier defined by this block.",
    }),
    children: BlockChildren.annotateKey({
      description: "Footnote body blocks.",
    }),
  },
  $I.annote("FootnoteDefinition", {
    description: "Footnote definition block.",
  })
) {
  static toPlainText(block: FootnoteDefinition): string {
    return Block.toPlainTextAll(block.children);
  }

  static toHtml(block: FootnoteDefinition): HtmlModel.Section {
    return HtmlModel.Section.make({
      children: [
        HtmlModel.Sup.make({ children: [HtmlText.fromValue(block.identifier)] }),
        ...Block.toHtmlAll(block.children),
      ],
      id: O.some(`fn-${block.identifier}`),
    });
  }
}

/**
 * Companion namespace for {@link FootnoteDefinition}.
 *
 * **Example** (Encode footnote definition)
 *
 * ```ts
 * import type { FootnoteDefinition } from "@beep/md/Md.model"
 *
 * const encoded: FootnoteDefinition.Encoded = {
 *   _tag: "footnoteDefinition",
 *   identifier: "note-1",
 *   children: [],
 * }
 * console.log(encoded.identifier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FootnoteDefinition {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "footnoteDefinition";
    readonly children: BlockChildren.Type;
    readonly identifier: FootnoteIdentifier;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "footnoteDefinition";
    readonly children: BlockChildren.Encoded;
    readonly identifier: string;
  }
}

/**
 * Typed admonition block.
 *
 * **Example** (Make admonition block)
 *
 * ```ts import.meta.vitest name="Make admonition block"
 * import * as O from "effect/Option"
 * import { Admonition, P, Text } from "@beep/md/Md.model"
 *
 * const node = Admonition.make({
 *   kind: "note",
 *   title: O.none(),
 *   children: [P.make({ children: [Text.make({ value: "Body" })] })],
 * })
 * node._tag // => "admonition"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Admonition extends S.TaggedClass<Admonition>($I`Admonition`)(
  "admonition",
  {
    kind: AdmonitionKind.annotateKey({
      description: "Admonition kind.",
    }),
    title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional admonition title.",
    }),
    children: BlockChildren.annotateKey({
      description: "Admonition body blocks.",
    }),
  },
  $I.annote("Admonition", {
    description: "Typed admonition block.",
  })
) {
  static toPlainText(block: Admonition): string {
    return Block.toPlainTextAll(block.children);
  }

  static toHtml(block: Admonition): HtmlModel.Aside {
    return HtmlModel.Aside.make({
      children: [
        ...O.match(block.title, {
          onNone: Arr.emptyReadonly,
          onSome: (value) => [HtmlModel.P.make({ children: [HtmlText.fromValue(value)] })],
        }),
        ...Block.toHtmlAll(block.children),
      ],
    });
  }
}

/**
 * Companion namespace for {@link Admonition}.
 *
 * **Example** (Encode admonition block)
 *
 * ```ts
 * import type { Admonition } from "@beep/md/Md.model"
 *
 * const encoded: Admonition.Encoded = { _tag: "admonition", kind: "tip", children: [] }
 * console.log(encoded.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Admonition {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "admonition";
    readonly children: BlockChildren.Type;
    readonly kind: AdmonitionKind;
    readonly title: O.Option<string>;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "admonition";
    readonly children: BlockChildren.Encoded;
    readonly kind: AdmonitionKind;
    readonly title?: string;
  }
}

/**
 * Safe generalized block embed.
 *
 * **Example** (Make embed block)
 *
 * ```ts import.meta.vitest name="Make embed block"
 * import { Embed } from "@beep/md/Md.model"
 *
 * const node = Embed.make({ kind: "video", src: "https://example.com/video" })
 * node._tag // => "embed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Embed extends S.TaggedClass<Embed>($I`Embed`)(
  "embed",
  {
    kind: EmbedKind.annotateKey({
      description: "Generic embed kind.",
    }),
    src: S.String.annotateKey({
      description: "Embed source URL or identifier.",
    }),
    title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional embed title.",
    }),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional embed description.",
    }),
  },
  $I.annote("Embed", {
    description: "Safe generalized block embed rendered by built-in adapters as inert link or figure content.",
  })
) {
  static readonly toPlainText = (block: Embed): string => O.getOrElse(block.title, () => block.src);

  static readonly toHtml = (block: Embed): HtmlModel.Figure => {
    const label = O.getOrElse(block.title, () => block.src);
    const content: HtmlChildNode =
      block.kind === "image"
        ? HtmlModel.Img.make({
            alt: O.some(label),
            src: O.some(block.src),
            title: block.title,
          })
        : HtmlModel.A.make({
            children: [HtmlText.fromValue(label)],
            href: O.some(block.src),
            title: block.title,
          });

    return HtmlModel.Figure.make({
      children: [
        content,
        ...O.match(block.description, {
          onNone: Arr.emptyReadonly,
          onSome: (value) => [HtmlModel.Figcaption.make({ children: [HtmlText.fromValue(value)] })],
        }),
      ],
    });
  };
}

/**
 * Companion namespace for {@link Embed}.
 *
 * **Example** (Encode embed block)
 *
 * ```ts
 * import type { Embed } from "@beep/md/Md.model"
 *
 * const encoded: Embed.Encoded = { _tag: "embed", kind: "video", src: "https://example.com/demo" }
 * console.log(encoded.src)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Embed {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "embed";
    readonly description: O.Option<string>;
    readonly kind: EmbedKind;
    readonly src: string;
    readonly title: O.Option<string>;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "embed";
    readonly description?: string;
    readonly kind: EmbedKind;
    readonly src: string;
    readonly title?: string;
  }
}

/**
 * Horizontal rule block.
 *
 * **Example** (Make horizontal rule)
 *
 * ```ts import.meta.vitest name="Make horizontal rule"
 * import { Hr } from "@beep/md/Md.model"
 *
 * const node = Hr.make({})
 * node._tag // => "hr"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Hr extends S.TaggedClass<Hr>($I`Hr`)(
  "hr",
  {},
  $I.annote("Hr", {
    description: "Horizontal rule block.",
  })
) {
  static readonly toPlainText = (): string => "";

  static readonly toHtml = (): HtmlModel.Hr => HtmlModel.Hr.make({});
}

/**
 * Companion namespace for {@link Hr}.
 *
 * **Example** (Type horizontal rule)
 *
 * ```ts import.meta.vitest name="Type horizontal rule"
 * import { Hr } from "@beep/md/Md.model"
 *
 * const node: Hr.Type = Hr.make({})
 * node._tag // => "hr"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Hr {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "hr";
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Discriminated union of block Markdown AST nodes.
 *
 * **Example** (Decode and project block union)
 *
 * ```ts import.meta.vitest name="Decode and project block union"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Block, P, Text } from "@beep/md/Md.model"
 *
 * const decode = S.decodeUnknownResult(Block)
 * const node = Result.getOrThrow(decode(P.make({ children: [Text.make({ value: "Hello" })] })))
 * node._tag // => "p"
 * Block.toPlainText(node) // => "Hello"
 * Block.toHtml(node)._tag // => "p"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Block = S.Union([
  Heading,
  P,
  BlockQuote,
  Pre,
  Ul,
  Ol,
  TaskList,
  Table,
  YouTube,
  MathBlock,
  FootnoteDefinition,
  Admonition,
  Embed,
  Hr,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Block", {
    description: "Discriminated union of block Markdown AST nodes.",
  }),
  SchemaUtils.withStatics((schema) => {
    const toHtml = schema.match({
      heading: Heading.toHtml,
      p: P.toHtml,
      blockquote: BlockQuote.toHtml,
      pre: Pre.toHtml,
      ul: Ul.toHtml,
      ol: Ol.toHtml,
      taskList: TaskList.toHtml,
      table: Table.toHtml,
      youtube: YouTube.toHtml,
      mathBlock: MathBlock.toHtml,
      footnoteDefinition: FootnoteDefinition.toHtml,
      admonition: Admonition.toHtml,
      embed: Embed.toHtml,
      hr: Hr.toHtml,
    });
    const toPlainText = schema.match({
      heading: Heading.toPlainText,
      p: P.toPlainText,
      blockquote: BlockQuote.toPlainText,
      pre: Pre.toPlainText,
      ul: Ul.toPlainText,
      ol: Ol.toPlainText,
      taskList: TaskList.toPlainText,
      table: Table.toPlainText,
      youtube: YouTube.toPlainText,
      mathBlock: MathBlock.toPlainText,
      footnoteDefinition: FootnoteDefinition.toPlainText,
      admonition: Admonition.toPlainText,
      embed: Embed.toPlainText,
      hr: Hr.toPlainText,
    });

    return {
      is: S.is(schema),
      toHtml,
      toHtmlAll: (blocks: ReadonlyArray<Block.Type>): ReadonlyArray<HtmlChildNode> => Arr.map(blocks, toHtml),
      toPlainText,
      toPlainTextAll: (blocks: ReadonlyArray<Block.Type>): string => Arr.join(Arr.map(blocks, toPlainText), "\n"),
    };
  })
);

/**
 * Runtime type for {@link Block}.
 *
 * **Example** (Type block node)
 *
 * ```ts import.meta.vitest name="Type block node"
 * import { P, Text } from "@beep/md/Md.model"
 * import type { Block } from "@beep/md/Md.model"
 *
 * const node: Block = P.make({ children: [Text.make({ value: "Hello" })] })
 * node._tag // => "p"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Block = typeof Block.Type;

/**
 * Companion namespace for {@link Block}.
 *
 * **Example** (Use namespace Type)
 *
 * ```ts import.meta.vitest name="Use namespace Type"
 * import { P, Text } from "@beep/md/Md.model"
 * import type { Block } from "@beep/md/Md.model"
 *
 * const node: Block.Type = P.make({ children: [Text.make({ value: "Hello" })] })
 * node._tag // => "p"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Block {
  /**
   * @since 0.0.0
   */
  export type Type =
    | Heading.Type
    | P.Type
    | BlockQuote.Type
    | Pre.Type
    | Ul.Type
    | Ol.Type
    | TaskList.Type
    | Table.Type
    | YouTube.Type
    | MathBlock.Type
    | FootnoteDefinition.Type
    | Admonition.Type
    | Embed.Type
    | Hr.Type;

  /**
   * @since 0.0.0
   */
  export type Encoded =
    | Heading.Encoded
    | P.Encoded
    | BlockQuote.Encoded
    | Pre.Encoded
    | Ul.Encoded
    | Ol.Encoded
    | TaskList.Encoded
    | Table.Encoded
    | YouTube.Encoded
    | MathBlock.Encoded
    | FootnoteDefinition.Encoded
    | Admonition.Encoded
    | Embed.Encoded
    | Hr.Encoded;
}

/**
 * Root Markdown document AST.
 *
 * **Example** (Make document root)
 *
 * ```ts import.meta.vitest name="Make document root"
 * import { Document, P, Text } from "@beep/md/Md.model"
 *
 * const document = Document.make({ children: [P.make({ children: [Text.make({ value: "Hello" })] })] })
 * document._tag // => "document"
 * Document.toHtml(document)._tag // => "#fragment"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Document extends S.TaggedClass<Document>($I`Document`)(
  "document",
  {
    frontmatter: S.OptionFromOptionalKey(JsonObject).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional JSON-compatible document metadata rendered as deterministic frontmatter.",
    }),
    children: BlockChildren.annotateKey({
      description: "Top-level block children in document order.",
    }),
  },
  $I.annote("Document", {
    description: "Root Markdown document AST.",
  })
) {
  static readonly encodeSync = S.encodeSync(Document);

  static readonly toPlainText = (document: Document): string => Block.toPlainTextAll(document.children);

  static readonly toHtml = (document: Document): HtmlModel.Fragment =>
    HtmlModel.Fragment.make({ children: Block.toHtmlAll(document.children) });

  static readonly encodeResult = S.encodeResult(Document);
}

/**
 * Companion namespace for {@link Document}.
 *
 * **Example** (Type document root)
 *
 * ```ts import.meta.vitest name="Type document root"
 * import { Document, P, Text } from "@beep/md/Md.model"
 *
 * const node: Document.Type = Document.make({ children: [P.make({ children: [Text.make({ value: "Hello" })] })] })
 * node.children.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Document {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "document";
    readonly children: BlockChildren.Type;
    readonly frontmatter: O.Option<JsonObject>;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "document";
    readonly children: BlockChildren.Encoded;
    readonly frontmatter?: JsonObject;
  }
}

/**
 * Schema-first Pandoc JSON AST mirror for the md-core compatibility slice.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.model
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PandocAstId.create("Pandoc.model");

const withPandocCodecStatics = <Sch extends S.Top & S.ConstraintDecoder<unknown, unknown>>(self: Sch) =>
  SchemaUtils.withStatics((schema: Sch) => {
    const decoder = schema as Sch & S.ConstraintDecoder<unknown>;

    return {
      decodeOption: S.decodeUnknownOption(decoder),
      fromUnknown: S.decodeUnknownSync(decoder),
      is: S.is(schema),
    };
  })(self);

/**
 * Pandoc API version tuple carried by Pandoc JSON.
 *
 * @example
 * ```ts
 * import { PandocApiVersion } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(PandocApiVersion.make([1, 23, 1]))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocApiVersion = S.NonEmptyArray(S.Int.check(S.isGreaterThanOrEqualTo(0))).pipe(
  $I.annoteSchema("PandocApiVersion", {
    description: "Pandoc API version tuple carried by Pandoc JSON.",
  })
);

/**
 * Runtime type for {@link PandocApiVersion}.
 *
 * @example
 * ```ts
 * import type { PandocApiVersion } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const version: PandocApiVersion = [1, 23, 1]
 * console.log(version.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocApiVersion = typeof PandocApiVersion.Type;

/**
 * Pandoc attribute key/value pair.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocKeyValue } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const decode = S.decodeUnknownSync(PandocKeyValue)
 * console.log(decode(["data-foo", "bar"]))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocKeyValue = S.Tuple([S.String, S.String]).pipe(
  $I.annoteSchema("PandocKeyValue", {
    description: "Pandoc attribute key/value pair.",
  })
);

/**
 * Runtime type for {@link PandocKeyValue}.
 *
 * @example
 * ```ts
 * import type { PandocKeyValue } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const pair: PandocKeyValue = ["data-foo", "bar"]
 * console.log(pair[0]) // "data-foo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocKeyValue = typeof PandocKeyValue.Type;

/**
 * Pandoc attribute triple represented with named fields.
 *
 * @example
 * ```ts
 * import { PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const attr = PandocAttr.empty
 * console.log(attr.id) // ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PandocAttr extends S.Class<PandocAttr>($I`PandocAttr`)(
  {
    classes: S.Array(S.String).annotateKey({
      description: "Pandoc attribute classes.",
    }),
    id: S.String.annotateKey({
      description: "Pandoc attribute identifier.",
    }),
    keyValues: S.Array(PandocKeyValue).annotateKey({
      description: "Pandoc attribute key/value pairs.",
    }),
  },
  $I.annote("PandocAttr", {
    description: "Pandoc attribute triple represented with named fields.",
  })
) {
  static readonly empty: PandocAttr = PandocAttr.make({ classes: [], id: "", keyValues: [] });
  static readonly isNonEmpty = (self: PandocAttr.Type): boolean =>
    self.id.length > 0 || self.classes.length > 0 || self.keyValues.length > 0;
}

/**
 * Companion namespace for {@link PandocAttr}.
 *
 * @example
 * ```ts
 * import { PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const attr: PandocAttr.Type = PandocAttr.make({ classes: ["note"], id: "n1", keyValues: [] })
 * console.log(attr.classes[0]) // "note"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocAttr {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly classes: ReadonlyArray<string>;
    readonly id: string;
    readonly keyValues: ReadonlyArray<PandocKeyValue>;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc link or image target.
 *
 * @example
 * ```ts
 * import { PandocTarget } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const target = PandocTarget.make({ title: "", url: "https://example.com" })
 * console.log(target.url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PandocTarget extends S.Class<PandocTarget>($I`PandocTarget`)(
  {
    title: S.String.annotateKey({
      description: "Pandoc target title.",
    }),
    url: S.String.annotateKey({
      description: "Pandoc target URL.",
    }),
  },
  $I.annote("PandocTarget", {
    description: "Pandoc link or image target.",
  })
) {}

/**
 * Companion namespace for {@link PandocTarget}.
 *
 * @example
 * ```ts
 * import { PandocTarget } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const target: PandocTarget.Type = PandocTarget.make({ title: "Example", url: "https://example.com" })
 * console.log(target.title) // "Example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocTarget {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly title: string;
    readonly url: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc math mode marker.
 *
 * @example
 * ```ts
 * import { PandocMathType } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(PandocMathType.is.InlineMath("InlineMath")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocMathType = LiteralKit(["InlineMath", "DisplayMath"]).pipe(
  $I.annoteSchema("PandocMathType", {
    description: "Pandoc math mode marker.",
  })
);

/**
 * Runtime type for {@link PandocMathType}.
 *
 * @example
 * ```ts
 * import type { PandocMathType } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const mathType: PandocMathType = "InlineMath"
 * console.log(mathType) // "InlineMath"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMathType = typeof PandocMathType.Type;

/**
 * Pandoc ordered-list numbering style constructor.
 *
 * @example
 * ```ts
 * import { PandocListNumberStyle } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(PandocListNumberStyle.is.DefaultStyle("DefaultStyle")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocListNumberStyle = LiteralKit([
  "DefaultStyle",
  "Example",
  "Decimal",
  "LowerRoman",
  "UpperRoman",
  "LowerAlpha",
  "UpperAlpha",
]).pipe(
  $I.annoteSchema("PandocListNumberStyle", {
    description: "Pandoc ordered-list numbering style constructor.",
  })
);

/**
 * Runtime type for {@link PandocListNumberStyle}.
 *
 * @example
 * ```ts
 * import type { PandocListNumberStyle } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const style: PandocListNumberStyle = "Decimal"
 * console.log(style) // "Decimal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListNumberStyle = typeof PandocListNumberStyle.Type;

/**
 * Pandoc ordered-list numbering delimiter constructor.
 *
 * @example
 * ```ts
 * import { PandocListNumberDelimiter } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(PandocListNumberDelimiter.is.DefaultDelim("DefaultDelim")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocListNumberDelimiter = LiteralKit(["DefaultDelim", "Period", "OneParen", "TwoParens"]).pipe(
  $I.annoteSchema("PandocListNumberDelimiter", {
    description: "Pandoc ordered-list numbering delimiter constructor.",
  })
);

/**
 * Runtime type for {@link PandocListNumberDelimiter}.
 *
 * @example
 * ```ts
 * import type { PandocListNumberDelimiter } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const delimiter: PandocListNumberDelimiter = "Period"
 * console.log(delimiter) // "Period"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListNumberDelimiter = typeof PandocListNumberDelimiter.Type;

/**
 * Recursive Pandoc inline child list.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocInlineChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isInlineChildren = S.is(PandocInlineChildren)
 * console.log(isInlineChildren([])) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocInlineChildren = S.Array(
  S.suspend((): S.Codec<PandocInline.Type, PandocInline.Encoded, unknown, unknown> => PandocInline)
).pipe(
  $I.annoteSchema("PandocInlineChildren", {
    description: "Recursive Pandoc inline child list.",
  })
);

/**
 * Runtime type for {@link PandocInlineChildren}.
 *
 * @example
 * ```ts
 * import type { PandocInlineChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocInlineChildren = []
 * console.log(children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocInlineChildren = typeof PandocInlineChildren.Type;

/**
 * Companion namespace for {@link PandocInlineChildren}.
 *
 * @example
 * ```ts
 * import { PandocInlineChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocInlineChildren.Type = []
 * console.log(children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocInlineChildren {
  /**
   * @since 0.0.0
   */
  export type Type = ReadonlyArray<PandocInline.Type>;

  /**
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<PandocInline.Encoded>;
}

/**
 * Recursive Pandoc block child list.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocBlockChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isBlockChildren = S.is(PandocBlockChildren)
 * console.log(isBlockChildren([])) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocBlockChildren = S.Array(
  S.suspend((): S.Codec<PandocBlock.Type, PandocBlock.Encoded, unknown, unknown> => PandocBlock)
).pipe(
  $I.annoteSchema("PandocBlockChildren", {
    description: "Recursive Pandoc block child list.",
  })
);

/**
 * Runtime type for {@link PandocBlockChildren}.
 *
 * @example
 * ```ts
 * import type { PandocBlockChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocBlockChildren = []
 * console.log(children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocBlockChildren = typeof PandocBlockChildren.Type;

/**
 * Companion namespace for {@link PandocBlockChildren}.
 *
 * @example
 * ```ts
 * import { PandocBlockChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocBlockChildren.Type = []
 * console.log(children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocBlockChildren {
  /**
   * @since 0.0.0
   */
  export type Type = ReadonlyArray<PandocBlock.Type>;

  /**
   * @since 0.0.0
   */
  export type Encoded = ReadonlyArray<PandocBlock.Encoded>;
}

/**
 * One Pandoc list item as a list of blocks.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocListItem } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isListItem = S.is(PandocListItem)
 * console.log(isListItem([])) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocListItem = S.Array(
  S.suspend((): S.Codec<PandocBlock.Type, PandocBlock.Encoded, unknown, unknown> => PandocBlock)
).pipe(
  $I.annoteSchema("PandocListItem", {
    description: "One Pandoc list item as a list of blocks.",
  })
);

/**
 * Runtime type for {@link PandocListItem}.
 *
 * @example
 * ```ts
 * import type { PandocListItem } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const item: PandocListItem = []
 * console.log(item.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListItem = typeof PandocListItem.Type;

/**
 * Pandoc list items.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocListItems } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isListItems = S.is(PandocListItems)
 * console.log(isListItems([])) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocListItems = S.Array(PandocListItem).pipe(
  $I.annoteSchema("PandocListItems", {
    description: "Pandoc list items.",
  })
);

/**
 * Runtime type for {@link PandocListItems}.
 *
 * @example
 * ```ts
 * import type { PandocListItems } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const items: PandocListItems = []
 * console.log(items.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListItems = typeof PandocListItems.Type;

/**
 * Plain text inline.
 *
 * @example
 * ```ts
 * import { Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Str.make({ text: "hello" })
 * console.log(node._tag) // "str"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Str extends S.TaggedClass<Str>($I`Str`)(
  "str",
  {
    text: S.String.annotateKey({
      description: "Pandoc string text.",
    }),
  },
  $I.annote("Str", {
    description: "Plain text inline.",
  })
) {}

/**
 * Companion namespace for {@link Str}.
 *
 * @example
 * ```ts
 * import { Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Str.Type = Str.make({ text: "hello" })
 * console.log(node.text) // "hello"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Str {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "str";
    readonly text: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc space inline.
 *
 * @example
 * ```ts
 * import { Space } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Space.make()
 * console.log(node._tag) // "space"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Space extends S.TaggedClass<Space>($I`Space`)(
  "space",
  {},
  $I.annote("Space", {
    description: "Pandoc space inline.",
  })
) {}

/**
 * Companion namespace for {@link Space}.
 *
 * @example
 * ```ts
 * import { Space } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Space.Type = Space.make()
 * console.log(node._tag) // "space"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Space {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "space";
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc soft line break inline.
 *
 * @example
 * ```ts
 * import { SoftBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = SoftBreak.make()
 * console.log(node._tag) // "softbreak"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SoftBreak extends S.TaggedClass<SoftBreak>($I`SoftBreak`)(
  "softbreak",
  {},
  $I.annote("SoftBreak", {
    description: "Pandoc soft line break inline.",
  })
) {}

/**
 * Companion namespace for {@link SoftBreak}.
 *
 * @example
 * ```ts
 * import { SoftBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: SoftBreak.Type = SoftBreak.make()
 * console.log(node._tag) // "softbreak"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SoftBreak {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "softbreak";
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc hard line break inline.
 *
 * @example
 * ```ts
 * import { LineBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = LineBreak.make()
 * console.log(node._tag) // "linebreak"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineBreak extends S.TaggedClass<LineBreak>($I`LineBreak`)(
  "linebreak",
  {},
  $I.annote("LineBreak", {
    description: "Pandoc hard line break inline.",
  })
) {}

/**
 * Companion namespace for {@link LineBreak}.
 *
 * @example
 * ```ts
 * import { LineBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: LineBreak.Type = LineBreak.make()
 * console.log(node._tag) // "linebreak"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LineBreak {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "linebreak";
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc emphasis inline.
 *
 * @example
 * ```ts
 * import { Emph, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Emph.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Emph extends S.TaggedClass<Emph>($I`Emph`)(
  "emph",
  {
    children: PandocInlineChildren.annotateKey({
      description: "Emphasized inline children.",
    }),
  },
  $I.annote("Emph", {
    description: "Pandoc emphasis inline.",
  })
) {}

/**
 * Companion namespace for {@link Emph}.
 *
 * @example
 * ```ts
 * import { Emph, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Emph.Type = Emph.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Emph {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "emph";
    readonly children: PandocInlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "emph";
    readonly children: PandocInlineChildren.Encoded;
  }
}

/**
 * Pandoc strong inline.
 *
 * @example
 * ```ts
 * import { Strong, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Strong.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Strong extends S.TaggedClass<Strong>($I`Strong`)(
  "strong",
  {
    children: PandocInlineChildren.annotateKey({
      description: "Strong inline children.",
    }),
  },
  $I.annote("Strong", {
    description: "Pandoc strong inline.",
  })
) {}

/**
 * Companion namespace for {@link Strong}.
 *
 * @example
 * ```ts
 * import { Strong, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Strong.Type = Strong.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
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
    readonly children: PandocInlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "strong";
    readonly children: PandocInlineChildren.Encoded;
  }
}

/**
 * Pandoc strikeout inline.
 *
 * @example
 * ```ts
 * import { Strikeout, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Strikeout.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Strikeout extends S.TaggedClass<Strikeout>($I`Strikeout`)(
  "strikeout",
  {
    children: PandocInlineChildren.annotateKey({
      description: "Strikeout inline children.",
    }),
  },
  $I.annote("Strikeout", {
    description: "Pandoc strikeout inline.",
  })
) {}

/**
 * Companion namespace for {@link Strikeout}.
 *
 * @example
 * ```ts
 * import { Strikeout, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Strikeout.Type = Strikeout.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Strikeout {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "strikeout";
    readonly children: PandocInlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "strikeout";
    readonly children: PandocInlineChildren.Encoded;
  }
}

/**
 * Pandoc code inline.
 *
 * @example
 * ```ts
 * import { Code, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Code.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * console.log(node.text) // "const x = 1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Code extends S.TaggedClass<Code>($I`Code`)(
  "code",
  {
    attr: PandocAttr.annotateKey({
      description: "Pandoc code attributes.",
    }),
    text: S.String.annotateKey({
      description: "Inline code text.",
    }),
  },
  $I.annote("Code", {
    description: "Pandoc code inline.",
  })
) {}

/**
 * Companion namespace for {@link Code}.
 *
 * @example
 * ```ts
 * import { Code, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Code.Type = Code.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * console.log(node.text) // "const x = 1"
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
    readonly attr: PandocAttr.Type;
    readonly text: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "code";
    readonly attr: PandocAttr.Encoded;
    readonly text: string;
  }
}

/**
 * Pandoc link inline.
 *
 * @example
 * ```ts
 * import { Link, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Link.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "example" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com" }),
 * })
 * console.log(node.target.url) // "https://example.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Link extends S.TaggedClass<Link>($I`Link`)(
  "link",
  {
    attr: PandocAttr.annotateKey({
      description: "Pandoc link attributes.",
    }),
    children: PandocInlineChildren.annotateKey({
      description: "Link label children.",
    }),
    target: PandocTarget.annotateKey({
      description: "Link target.",
    }),
  },
  $I.annote("Link", {
    description: "Pandoc link inline.",
  })
) {}

/**
 * Companion namespace for {@link Link}.
 *
 * @example
 * ```ts
 * import { Link, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Link.Type = Link.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "example" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com" }),
 * })
 * console.log(node.target.url) // "https://example.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Link {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "link";
    readonly attr: PandocAttr.Type;
    readonly children: PandocInlineChildren.Type;
    readonly target: PandocTarget.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "link";
    readonly attr: PandocAttr.Encoded;
    readonly children: PandocInlineChildren.Encoded;
    readonly target: PandocTarget.Encoded;
  }
}

/**
 * Pandoc image inline.
 *
 * @example
 * ```ts
 * import { Image, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Image.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "alt text" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com/logo.png" }),
 * })
 * console.log(node.target.url) // "https://example.com/logo.png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Image extends S.TaggedClass<Image>($I`Image`)(
  "image",
  {
    attr: PandocAttr.annotateKey({
      description: "Pandoc image attributes.",
    }),
    children: PandocInlineChildren.annotateKey({
      description: "Image alt-text children.",
    }),
    target: PandocTarget.annotateKey({
      description: "Image target.",
    }),
  },
  $I.annote("Image", {
    description: "Pandoc image inline.",
  })
) {}

/**
 * Companion namespace for {@link Image}.
 *
 * @example
 * ```ts
 * import { Image, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Image.Type = Image.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "alt text" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com/logo.png" }),
 * })
 * console.log(node.target.url) // "https://example.com/logo.png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Image {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "image";
    readonly attr: PandocAttr.Type;
    readonly children: PandocInlineChildren.Type;
    readonly target: PandocTarget.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "image";
    readonly attr: PandocAttr.Encoded;
    readonly children: PandocInlineChildren.Encoded;
    readonly target: PandocTarget.Encoded;
  }
}

/**
 * Pandoc span inline.
 *
 * @example
 * ```ts
 * import { Span, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Span.make({ attr: PandocAttr.empty, children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Span extends S.TaggedClass<Span>($I`Span`)(
  "span",
  {
    attr: PandocAttr.annotateKey({
      description: "Pandoc span attributes.",
    }),
    children: PandocInlineChildren.annotateKey({
      description: "Span children.",
    }),
  },
  $I.annote("Span", {
    description: "Pandoc span inline.",
  })
) {}

/**
 * Companion namespace for {@link Span}.
 *
 * @example
 * ```ts
 * import { Span, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Span.Type = Span.make({ attr: PandocAttr.empty, children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Span {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "span";
    readonly attr: PandocAttr.Type;
    readonly children: PandocInlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "span";
    readonly attr: PandocAttr.Encoded;
    readonly children: PandocInlineChildren.Encoded;
  }
}

/**
 * Pandoc footnote or endnote inline.
 *
 * @example
 * ```ts
 * import { Note, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Note.make({ blocks: [Para.make({ children: [Str.make({ text: "note" })] })] })
 * console.log(node.blocks.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Note extends S.TaggedClass<Note>($I`Note`)(
  "note",
  {
    blocks: PandocBlockChildren.annotateKey({
      description: "Note block contents.",
    }),
  },
  $I.annote("Note", {
    description: "Pandoc footnote or endnote inline.",
  })
) {}

/**
 * Companion namespace for {@link Note}.
 *
 * @example
 * ```ts
 * import { Note, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Note.Type = Note.make({ blocks: [Para.make({ children: [Str.make({ text: "note" })] })] })
 * console.log(node.blocks.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Note {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "note";
    readonly blocks: PandocBlockChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "note";
    readonly blocks: PandocBlockChildren.Encoded;
  }
}

/**
 * Pandoc math inline.
 *
 * @example
 * ```ts
 * import { Math } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Math.make({ mathType: "InlineMath", text: "x^2" })
 * console.log(node.text) // "x^2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Math extends S.TaggedClass<Math>($I`Math`)(
  "math",
  {
    mathType: PandocMathType.annotateKey({
      description: "Math display mode.",
    }),
    text: S.String.annotateKey({
      description: "Math source text.",
    }),
  },
  $I.annote("Math", {
    description: "Pandoc math inline.",
  })
) {}

/**
 * Companion namespace for {@link Math}.
 *
 * @example
 * ```ts
 * import { Math } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Math.Type = Math.make({ mathType: "InlineMath", text: "x^2" })
 * console.log(node.mathType) // "InlineMath"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Math {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "math";
    readonly mathType: PandocMathType;
    readonly text: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc inline constructor outside the supported v1 surface.
 *
 * @example
 * ```ts
 * import { UnknownInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = UnknownInline.make({ constructor: "Cite", payload: { citations: [] } })
 * console.log(node.constructor) // "Cite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownInline extends S.TaggedClass<UnknownInline>($I`UnknownInline`)(
  "unknownInline",
  {
    constructor: S.String.annotateKey({
      description: "Original Pandoc constructor name.",
    }),
    payload: S.Unknown.annotateKey({
      description: "Original Pandoc constructor payload.",
    }),
  },
  $I.annote("UnknownInline", {
    description: "Pandoc inline constructor outside the supported v1 surface.",
  })
) {}

/**
 * Companion namespace for {@link UnknownInline}.
 *
 * @example
 * ```ts
 * import { UnknownInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: UnknownInline.Type = UnknownInline.make({ constructor: "Cite", payload: { citations: [] } })
 * console.log(node.constructor) // "Cite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace UnknownInline {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "unknownInline";
    readonly constructor: string;
    readonly payload: unknown;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc inline union for the v1 compatibility slice.
 *
 * @example
 * ```ts
 * import { PandocInline, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const inline = Str.make({ text: "hi" })
 * console.log(PandocInline.is(inline)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocInline = S.Union([
  Str,
  Space,
  SoftBreak,
  LineBreak,
  Emph,
  Strong,
  Strikeout,
  Code,
  Link,
  Image,
  Span,
  Note,
  Math,
  UnknownInline,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("PandocInline", {
    description: "Pandoc inline union for the v1 compatibility slice.",
  }),
  withPandocCodecStatics
);

/**
 * Runtime type for {@link PandocInline}.
 *
 * @example
 * ```ts
 * import { Str, type PandocInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const inline: PandocInline = Str.make({ text: "hi" })
 * console.log(inline._tag) // "str"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocInline = typeof PandocInline.Type;

/**
 * Companion namespace for {@link PandocInline}.
 *
 * @example
 * ```ts
 * import { PandocInline, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const inline: PandocInline.Type = Str.make({ text: "hi" })
 * console.log(inline._tag) // "str"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocInline {
  /**
   * @since 0.0.0
   */
  export type Type =
    | Str.Type
    | Space.Type
    | SoftBreak.Type
    | LineBreak.Type
    | Emph.Type
    | Strong.Type
    | Strikeout.Type
    | Code.Type
    | Link.Type
    | Image.Type
    | Span.Type
    | Note.Type
    | Math.Type
    | UnknownInline.Type;

  /**
   * @since 0.0.0
   */
  export type Encoded =
    | Str.Encoded
    | Space.Encoded
    | SoftBreak.Encoded
    | LineBreak.Encoded
    | Emph.Encoded
    | Strong.Encoded
    | Strikeout.Encoded
    | Code.Encoded
    | Link.Encoded
    | Image.Encoded
    | Span.Encoded
    | Note.Encoded
    | Math.Encoded
    | UnknownInline.Encoded;
}

/**
 * Pandoc plain block.
 *
 * @example
 * ```ts
 * import { Plain, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Plain.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Plain extends S.TaggedClass<Plain>($I`Plain`)(
  "plain",
  {
    children: PandocInlineChildren.annotateKey({
      description: "Plain inline children.",
    }),
  },
  $I.annote("Plain", {
    description: "Pandoc plain block.",
  })
) {}

/**
 * Companion namespace for {@link Plain}.
 *
 * @example
 * ```ts
 * import { Plain, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Plain.Type = Plain.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Plain {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "plain";
    readonly children: PandocInlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "plain";
    readonly children: PandocInlineChildren.Encoded;
  }
}

/**
 * Pandoc paragraph block.
 *
 * @example
 * ```ts
 * import { Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Para.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Para extends S.TaggedClass<Para>($I`Para`)(
  "para",
  {
    children: PandocInlineChildren.annotateKey({
      description: "Paragraph inline children.",
    }),
  },
  $I.annote("Para", {
    description: "Pandoc paragraph block.",
  })
) {}

/**
 * Companion namespace for {@link Para}.
 *
 * @example
 * ```ts
 * import { Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Para.Type = Para.make({ children: [Str.make({ text: "hi" })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Para {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "para";
    readonly children: PandocInlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "para";
    readonly children: PandocInlineChildren.Encoded;
  }
}

/**
 * Pandoc header block.
 *
 * @example
 * ```ts
 * import { Header, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Header.make({ attr: PandocAttr.empty, children: [Str.make({ text: "Title" })], level: 1 })
 * console.log(node.level) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Header extends S.TaggedClass<Header>($I`Header`)(
  "header",
  {
    attr: PandocAttr.annotateKey({
      description: "Header attributes.",
    }),
    children: PandocInlineChildren.annotateKey({
      description: "Header inline children.",
    }),
    level: S.Int.annotateKey({
      description: "Header level.",
    }),
  },
  $I.annote("Header", {
    description: "Pandoc header block.",
  })
) {}

/**
 * Companion namespace for {@link Header}.
 *
 * @example
 * ```ts
 * import { Header, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Header.Type = Header.make({ attr: PandocAttr.empty, children: [Str.make({ text: "Title" })], level: 1 })
 * console.log(node.level) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Header {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "header";
    readonly attr: PandocAttr.Type;
    readonly children: PandocInlineChildren.Type;
    readonly level: number;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "header";
    readonly attr: PandocAttr.Encoded;
    readonly children: PandocInlineChildren.Encoded;
    readonly level: number;
  }
}

/**
 * Pandoc block quote.
 *
 * @example
 * ```ts
 * import { BlockQuote, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = BlockQuote.make({ children: [Para.make({ children: [Str.make({ text: "quoted" })] })] })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlockQuote extends S.TaggedClass<BlockQuote>($I`BlockQuote`)(
  "blockquote",
  {
    children: PandocBlockChildren.annotateKey({
      description: "Quoted block children.",
    }),
  },
  $I.annote("BlockQuote", {
    description: "Pandoc block quote.",
  })
) {}

/**
 * Companion namespace for {@link BlockQuote}.
 *
 * @example
 * ```ts
 * import { BlockQuote, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: BlockQuote.Type = BlockQuote.make({ children: [Para.make({ children: [Str.make({ text: "quoted" })] })] })
 * console.log(node.children.length) // 1
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
    readonly children: PandocBlockChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "blockquote";
    readonly children: PandocBlockChildren.Encoded;
  }
}

/**
 * Pandoc fenced code block.
 *
 * @example
 * ```ts
 * import { CodeBlock, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = CodeBlock.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * console.log(node.text) // "const x = 1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeBlock extends S.TaggedClass<CodeBlock>($I`CodeBlock`)(
  "codeblock",
  {
    attr: PandocAttr.annotateKey({
      description: "Code block attributes.",
    }),
    text: S.String.annotateKey({
      description: "Code block text.",
    }),
  },
  $I.annote("CodeBlock", {
    description: "Pandoc fenced code block.",
  })
) {}

/**
 * Companion namespace for {@link CodeBlock}.
 *
 * @example
 * ```ts
 * import { CodeBlock, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: CodeBlock.Type = CodeBlock.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * console.log(node.text) // "const x = 1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CodeBlock {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "codeblock";
    readonly attr: PandocAttr.Type;
    readonly text: string;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "codeblock";
    readonly attr: PandocAttr.Encoded;
    readonly text: string;
  }
}

/**
 * Pandoc bullet list block.
 *
 * @example
 * ```ts
 * import { BulletList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = BulletList.make({ items: [[Para.make({ children: [Str.make({ text: "item" })] })]] })
 * console.log(node.items.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BulletList extends S.TaggedClass<BulletList>($I`BulletList`)(
  "bulletlist",
  {
    items: PandocListItems.annotateKey({
      description: "Bullet list items.",
    }),
  },
  $I.annote("BulletList", {
    description: "Pandoc bullet list block.",
  })
) {}

/**
 * Companion namespace for {@link BulletList}.
 *
 * @example
 * ```ts
 * import { BulletList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: BulletList.Type = BulletList.make({ items: [[Para.make({ children: [Str.make({ text: "item" })] })]] })
 * console.log(node.items.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace BulletList {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "bulletlist";
    readonly items: PandocListItems;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc ordered list block.
 *
 * @example
 * ```ts
 * import { OrderedList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = OrderedList.make({
 *   delimiter: "Period",
 *   items: [[Para.make({ children: [Str.make({ text: "item" })] })]],
 *   start: 1,
 *   style: "Decimal",
 * })
 * console.log(node.start) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OrderedList extends S.TaggedClass<OrderedList>($I`OrderedList`)(
  "orderedlist",
  {
    delimiter: PandocListNumberDelimiter.annotateKey({
      description: "Pandoc ordered-list delimiter token.",
    }),
    items: PandocListItems.annotateKey({
      description: "Ordered list items.",
    }),
    start: S.Int.annotateKey({
      description: "Starting ordinal.",
    }),
    style: PandocListNumberStyle.annotateKey({
      description: "Pandoc ordered-list style token.",
    }),
  },
  $I.annote("OrderedList", {
    description: "Pandoc ordered list block.",
  })
) {}

/**
 * Companion namespace for {@link OrderedList}.
 *
 * @example
 * ```ts
 * import { OrderedList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: OrderedList.Type = OrderedList.make({
 *   delimiter: "Period",
 *   items: [[Para.make({ children: [Str.make({ text: "item" })] })]],
 *   start: 1,
 *   style: "Decimal",
 * })
 * console.log(node.start) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace OrderedList {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "orderedlist";
    readonly delimiter: PandocListNumberDelimiter;
    readonly items: PandocListItems;
    readonly start: number;
    readonly style: PandocListNumberStyle;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc horizontal rule block.
 *
 * @example
 * ```ts
 * import { HorizontalRule } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = HorizontalRule.make({})
 * console.log(node._tag) // "horizontalrule"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HorizontalRule extends S.TaggedClass<HorizontalRule>($I`HorizontalRule`)(
  "horizontalrule",
  {},
  $I.annote("HorizontalRule", {
    description: "Pandoc horizontal rule block.",
  })
) {}

/**
 * Companion namespace for {@link HorizontalRule}.
 *
 * @example
 * ```ts
 * import { HorizontalRule } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: HorizontalRule.Type = HorizontalRule.make({})
 * console.log(node._tag) // "horizontalrule"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HorizontalRule {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "horizontalrule";
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc div block, including DOCX custom-style wrappers.
 *
 * @example
 * ```ts
 * import { Div, Para, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Div.make({
 *   attr: PandocAttr.empty,
 *   children: [Para.make({ children: [Str.make({ text: "hi" })] })],
 * })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Div extends S.TaggedClass<Div>($I`Div`)(
  "div",
  {
    attr: PandocAttr.annotateKey({
      description: "Div attributes.",
    }),
    children: PandocBlockChildren.annotateKey({
      description: "Div block children.",
    }),
  },
  $I.annote("Div", {
    description: "Pandoc div block, including DOCX custom-style wrappers.",
  })
) {}

/**
 * Companion namespace for {@link Div}.
 *
 * @example
 * ```ts
 * import { Div, Para, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Div.Type = Div.make({
 *   attr: PandocAttr.empty,
 *   children: [Para.make({ children: [Str.make({ text: "hi" })] })],
 * })
 * console.log(node.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Div {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "div";
    readonly attr: PandocAttr.Type;
    readonly children: PandocBlockChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "div";
    readonly attr: PandocAttr.Encoded;
    readonly children: PandocBlockChildren.Encoded;
  }
}

/**
 * Pandoc table block captured as an explicit gap node.
 *
 * @example
 * ```ts
 * import { Table, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Table.make({ attr: PandocAttr.empty, caption: [], payload: {} })
 * console.log(node._tag) // "table"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Table extends S.TaggedClass<Table>($I`Table`)(
  "table",
  {
    attr: PandocAttr.annotateKey({
      description: "Table attributes.",
    }),
    caption: PandocInlineChildren.annotateKey({
      description: "Best-effort table caption inline children.",
    }),
    payload: S.Unknown.annotateKey({
      description: "Original Pandoc table payload.",
    }),
  },
  $I.annote("Table", {
    description: "Pandoc table block captured as an explicit gap node.",
  })
) {}

/**
 * Companion namespace for {@link Table}.
 *
 * @example
 * ```ts
 * import { Table, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Table.Type = Table.make({ attr: PandocAttr.empty, caption: [], payload: {} })
 * console.log(node._tag) // "table"
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
    readonly attr: PandocAttr.Type;
    readonly caption: PandocInlineChildren.Type;
    readonly payload: unknown;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "table";
    readonly attr: PandocAttr.Encoded;
    readonly caption: PandocInlineChildren.Encoded;
    readonly payload: unknown;
  }
}

/**
 * Pandoc block constructor outside the supported v1 surface.
 *
 * @example
 * ```ts
 * import { UnknownBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = UnknownBlock.make({ constructor: "Figure", payload: {} })
 * console.log(node.constructor) // "Figure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownBlock extends S.TaggedClass<UnknownBlock>($I`UnknownBlock`)(
  "unknownBlock",
  {
    constructor: S.String.annotateKey({
      description: "Original Pandoc constructor name.",
    }),
    payload: S.Unknown.annotateKey({
      description: "Original Pandoc constructor payload.",
    }),
  },
  $I.annote("UnknownBlock", {
    description: "Pandoc block constructor outside the supported v1 surface.",
  })
) {}

/**
 * Companion namespace for {@link UnknownBlock}.
 *
 * @example
 * ```ts
 * import { UnknownBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: UnknownBlock.Type = UnknownBlock.make({ constructor: "Figure", payload: {} })
 * console.log(node.constructor) // "Figure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace UnknownBlock {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "unknownBlock";
    readonly constructor: string;
    readonly payload: unknown;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded extends Type {}
}

/**
 * Pandoc block union for the v1 compatibility slice.
 *
 * @example
 * ```ts
 * import { PandocBlock, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const block = Para.make({ children: [Str.make({ text: "hi" })] })
 * console.log(PandocBlock.is(block)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocBlock = S.Union([
  Plain,
  Para,
  Header,
  BlockQuote,
  CodeBlock,
  BulletList,
  OrderedList,
  HorizontalRule,
  Div,
  Table,
  UnknownBlock,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("PandocBlock", {
    description: "Pandoc block union for the v1 compatibility slice.",
  }),
  withPandocCodecStatics
);

/**
 * Runtime type for {@link PandocBlock}.
 *
 * @example
 * ```ts
 * import { Para, Str, type PandocBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const block: PandocBlock = Para.make({ children: [Str.make({ text: "hi" })] })
 * console.log(block._tag) // "para"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocBlock = typeof PandocBlock.Type;

/**
 * Companion namespace for {@link PandocBlock}.
 *
 * @example
 * ```ts
 * import { PandocBlock, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const block: PandocBlock.Type = Para.make({ children: [Str.make({ text: "hi" })] })
 * console.log(block._tag) // "para"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocBlock {
  /**
   * @since 0.0.0
   */
  export type Type =
    | Plain.Type
    | Para.Type
    | Header.Type
    | BlockQuote.Type
    | CodeBlock.Type
    | BulletList.Type
    | OrderedList.Type
    | HorizontalRule.Type
    | Div.Type
    | Table.Type
    | UnknownBlock.Type;

  /**
   * @since 0.0.0
   */
  export type Encoded =
    | Plain.Encoded
    | Para.Encoded
    | Header.Encoded
    | BlockQuote.Encoded
    | CodeBlock.Encoded
    | BulletList.Encoded
    | OrderedList.Encoded
    | HorizontalRule.Encoded
    | Div.Encoded
    | Table.Encoded
    | UnknownBlock.Encoded;
}

/**
 * Pandoc document metadata.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PandocMeta } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const decode = S.decodeUnknownSync(PandocMeta)
 * console.log(decode({ title: "Doc" }).title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocMeta = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("PandocMeta", {
    description: "Pandoc document metadata.",
  })
);

/**
 * Runtime type for {@link PandocMeta}.
 *
 * @example
 * ```ts
 * import type { PandocMeta } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const meta: PandocMeta = { title: "Doc" }
 * console.log(meta.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMeta = typeof PandocMeta.Type;

/**
 * Root Pandoc JSON document.
 *
 * @example
 * ```ts
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const document = PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })
 * console.log(document._tag) // "pandocDocument"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PandocDocument extends S.TaggedClass<PandocDocument>($I`PandocDocument`)(
  "pandocDocument",
  {
    apiVersion: PandocApiVersion.annotateKey({
      description: "Pandoc API version tuple.",
    }),
    blocks: PandocBlockChildren.annotateKey({
      description: "Top-level Pandoc block children.",
    }),
    meta: PandocMeta.annotateKey({
      description: "Pandoc metadata object.",
    }),
  },
  $I.annote("PandocDocument", {
    description: "Root Pandoc JSON document.",
  })
) {}

/**
 * Companion namespace for {@link PandocDocument}.
 *
 * @example
 * ```ts
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const document: PandocDocument.Type = PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })
 * console.log(document._tag) // "pandocDocument"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocDocument {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly _tag: "pandocDocument";
    readonly apiVersion: PandocApiVersion;
    readonly blocks: PandocBlockChildren.Type;
    readonly meta: PandocMeta;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "pandocDocument";
    readonly apiVersion: PandocApiVersion;
    readonly blocks: PandocBlockChildren.Encoded;
    readonly meta: PandocMeta;
  }
}

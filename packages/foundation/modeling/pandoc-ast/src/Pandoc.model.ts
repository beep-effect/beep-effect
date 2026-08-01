/**
 * Schema-first Pandoc JSON AST mirror for the md-core compatibility slice.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.model
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import * as S from "effect/Schema";
import {
  isPandocKnownConstructorName,
  PandocListNumberDelimiter,
  PandocListNumberStyle,
  PandocMathType,
  PandocTableAlignmentConstructorName,
} from "./internal/Pandoc.registry.ts";

const $I = $PandocAstId.create("Pandoc.model");
type ArbitraryFastCheck = Parameters<S.Annotations.ToArbitrary.Candidate["make"]>[0];

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
 * Default Pandoc JSON API version emitted by Md-to-Pandoc projections.
 *
 * @example
 * ```ts
 * import { DEFAULT_PANDOC_API_VERSION } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(DEFAULT_PANDOC_API_VERSION.join(".")) // "1.23.1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_PANDOC_API_VERSION: PandocApiVersion = PandocApiVersion.make([1, 23, 1]);

/**
 * Exact JSON object retained for a future Pandoc constructor.
 *
 * The `c` payload is genuinely optional because Pandoc nullary constructors
 * omit it. Rest fields remain part of the semantic opaque node so a future
 * constructor can round-trip without guessing which fields matter.
 *
 * @example
 * ```ts
 * import { PandocUnknownConstructorWire } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const wire = PandocUnknownConstructorWire.make({ t: "Future", extension: true })
 * console.log(wire.extension) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocUnknownConstructorWire = S.StructWithRest(
  S.Struct({
    c: S.optionalKey(S.Json),
    t: S.String,
  }),
  [S.Record(S.String, S.Json)]
).pipe(
  $I.annoteSchema("PandocUnknownConstructorWire", {
    description: "Exact opaque JSON object for an unknown future Pandoc constructor.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PandocUnknownConstructorWire}.
 *
 * @example
 * ```ts
 * import type { PandocUnknownConstructorWire } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const wire: PandocUnknownConstructorWire = { t: "Future" }
 * console.log(wire.t) // "Future"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocUnknownConstructorWire = typeof PandocUnknownConstructorWire.Type;

const makePandocFutureConstructorArbitrary = (fc: ArbitraryFastCheck) =>
  fc.string().map((suffix) => PandocUnknownConstructorWire.make({ t: `Future${suffix}` }));
const PandocFutureConstructorWire = PandocUnknownConstructorWire.pipe(
  S.check(
    S.makeFilter((wire) => !isPandocKnownConstructorName(wire.t), {
      identifier: $I`PandocFutureConstructorWireCheck`,
      title: "Future Pandoc constructor",
      description: "An opaque Pandoc constructor whose name is absent from every known constructor registry.",
      message: "Expected a future Pandoc constructor name that is not already known.",
      arbitrary: {
        candidate: {
          weight: 32,
          make: makePandocFutureConstructorArbitrary,
        },
      },
    })
  ),
  $I.annoteSchema("PandocFutureConstructorWire", {
    description: "Exact opaque JSON object whose constructor name is absent from every known registry.",
    toArbitrary: () => makePandocFutureConstructorArbitrary,
  })
);

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
    classes: S.Array(S.String).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<string>>([])).annotateKey({
      description: "Pandoc attribute classes.",
    }),
    id: S.String.pipe(SchemaUtils.withConstantDefault<string>("")).annotateKey({
      description: "Pandoc attribute identifier.",
    }),
    keyValues: S.Array(PandocKeyValue)
      .pipe(SchemaUtils.withConstantDefault<ReadonlyArray<PandocKeyValue>>([]))
      .annotateKey({
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
    title: S.String.pipe(SchemaUtils.withConstantDefault<string>("")).annotateKey({
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
export { PandocMathType };

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
export { PandocListNumberStyle };

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
export { PandocListNumberDelimiter };

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
  S.suspend((): S.Codec<PandocInline.Type, PandocInline.Encoded> => PandocInline)
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
  S.suspend((): S.Codec<PandocBlock.Type, PandocBlock.Encoded> => PandocBlock)
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
  S.suspend((): S.Codec<PandocBlock.Type, PandocBlock.Encoded> => PandocBlock)
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
 * Future Pandoc inline constructor outside the pinned 1.23.1 registry.
 *
 * @example
 * ```ts
 * import { UnknownInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = UnknownInline.make({ wire: { c: { extension: true }, t: "FutureInline" } })
 * console.log(node.constructorName) // "FutureInline"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownInline extends S.TaggedClass<UnknownInline>($I`UnknownInline`)(
  "unknownInline",
  {
    wire: PandocFutureConstructorWire.annotateKey({
      description: "Exact original future Pandoc constructor object.",
    }),
  },
  $I.annote("UnknownInline", {
    description: "Future Pandoc inline constructor outside the pinned 1.23.1 registry.",
  })
) {
  /**
   * Original Pandoc constructor name derived from {@link wire}.
   *
   * @category getters
   * @since 0.0.0
   */
  get constructorName(): string {
    return this.wire.t;
  }

  /**
   * Optional Pandoc constructor payload derived from {@link wire}.
   *
   * @category getters
   * @since 0.0.0
   */
  get payload(): S.Json | undefined {
    return this.wire.c;
  }
}

/**
 * Companion namespace for {@link UnknownInline}.
 *
 * @example
 * ```ts
 * import { UnknownInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: UnknownInline.Type = UnknownInline.make({ wire: { c: { extension: true }, t: "FutureInline" } })
 * console.log(node.constructorName) // "FutureInline"
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
    readonly constructorName: string;
    readonly payload: S.Json | undefined;
    readonly wire: PandocUnknownConstructorWire;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "unknownInline";
    readonly wire: PandocUnknownConstructorWire;
  }
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
  SchemaUtils.withCodecStatics
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
  export interface Encoded {
    readonly _tag: "bulletlist";
    readonly items: ReadonlyArray<ReadonlyArray<PandocBlock.Encoded>>;
  }
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
  export interface Encoded {
    readonly _tag: "orderedlist";
    readonly delimiter: PandocListNumberDelimiter;
    readonly items: ReadonlyArray<ReadonlyArray<PandocBlock.Encoded>>;
    readonly start: number;
    readonly style: PandocListNumberStyle;
  }
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

const PandocAttrPayload = S.Tuple([S.String, S.Array(S.String), S.Array(PandocKeyValue)]);
const PandocTablePayloadShape = S.Tuple([PandocAttrPayload, S.Json, S.Array(S.Json), S.Json, S.Array(S.Json), S.Json]);
const PandocTargetPayload = S.Tuple([S.String, S.String]);
const pandocConstructorWithPayload = <const Name extends string, Payload extends S.Top>(t: Name, c: Payload) =>
  S.Struct({ c, t: S.Literal(t) });
const pandocNullaryConstructor = <const Name extends string>(t: Name) =>
  S.Struct({ c: S.optionalKey(S.Undefined), t: S.Literal(t) });
const PandocMathTypeWire = S.Struct({
  c: S.optionalKey(S.Undefined),
  t: PandocMathType,
});
const PandocListNumberStyleWire = S.Struct({
  c: S.optionalKey(S.Undefined),
  t: PandocListNumberStyle,
});
const PandocListNumberDelimiterWire = S.Struct({
  c: S.optionalKey(S.Undefined),
  t: PandocListNumberDelimiter,
});
const PandocTableAlignmentWire = S.Union([
  S.Struct({
    c: S.optionalKey(S.Undefined),
    t: PandocTableAlignmentConstructorName,
  }),
  PandocFutureConstructorWire,
]);
const PandocTableColumnWidthWire = S.Union([
  pandocConstructorWithPayload("ColWidth", S.Finite),
  pandocNullaryConstructor("ColWidthDefault"),
  PandocFutureConstructorWire,
]);
const DeferredPandocBlockWire: S.Codec<unknown, unknown> = S.suspend(() => PandocBlockWire);
const DeferredPandocTablePayloadWire: S.Codec<unknown, unknown> = S.suspend(() => PandocSemanticTablePayloadWire);

const PandocInlineWire: S.Codec<unknown, unknown> = S.suspend(() =>
  S.Union([
    pandocConstructorWithPayload("Str", S.String),
    pandocNullaryConstructor("Space"),
    pandocNullaryConstructor("SoftBreak"),
    pandocNullaryConstructor("LineBreak"),
    pandocConstructorWithPayload("Emph", S.Array(PandocInlineWire)),
    pandocConstructorWithPayload("Strong", S.Array(PandocInlineWire)),
    pandocConstructorWithPayload("Strikeout", S.Array(PandocInlineWire)),
    pandocConstructorWithPayload("Code", S.Tuple([PandocAttrPayload, S.String])),
    pandocConstructorWithPayload("Link", S.Tuple([PandocAttrPayload, S.Array(PandocInlineWire), PandocTargetPayload])),
    pandocConstructorWithPayload("Image", S.Tuple([PandocAttrPayload, S.Array(PandocInlineWire), PandocTargetPayload])),
    pandocConstructorWithPayload("Span", S.Tuple([PandocAttrPayload, S.Array(PandocInlineWire)])),
    pandocConstructorWithPayload("Note", S.Array(DeferredPandocBlockWire)),
    pandocConstructorWithPayload("Math", S.Tuple([PandocMathTypeWire, S.String])),
    PandocFutureConstructorWire,
  ])
);

const PandocTableCaptionPairWire = S.Tuple([
  PandocInlineWire.pipe(S.Array, S.NullOr),
  S.Array(DeferredPandocBlockWire),
]);
const PandocTableCaptionWire = S.Union([
  pandocConstructorWithPayload("TableCaption", PandocTableCaptionPairWire),
  PandocTableCaptionPairWire,
  S.Array(DeferredPandocBlockWire),
  PandocFutureConstructorWire,
]);
const PandocTableColumnSpecWire = S.Union([
  S.Tuple([PandocTableAlignmentWire, PandocTableColumnWidthWire]),
  PandocFutureConstructorWire,
]);
const PandocTableCellWire = S.Union([
  S.Tuple([PandocAttrPayload, PandocTableAlignmentWire, S.Int, S.Int, S.Array(DeferredPandocBlockWire)]),
  PandocFutureConstructorWire,
]);
const PandocTableRowWire = S.Union([
  S.Tuple([PandocAttrPayload, S.Array(PandocTableCellWire)]),
  PandocFutureConstructorWire,
]);
const PandocTableHeadOrFootWire = S.Union([
  S.Tuple([PandocAttrPayload, S.Array(PandocTableRowWire)]),
  S.Tuple([]),
  PandocFutureConstructorWire,
]);
const PandocTableBodyWire = S.Union([
  S.Tuple([PandocAttrPayload, S.Int, S.Array(PandocTableRowWire), S.Array(PandocTableRowWire)]),
  PandocFutureConstructorWire,
]);
const PandocSemanticTablePayloadWire: S.Codec<unknown, unknown> = S.suspend(() =>
  S.Tuple([
    PandocAttrPayload,
    PandocTableCaptionWire,
    S.Array(PandocTableColumnSpecWire),
    PandocTableHeadOrFootWire,
    S.Array(PandocTableBodyWire),
    PandocTableHeadOrFootWire,
  ])
);

const PandocBlockWire: S.Codec<unknown, unknown> = S.suspend(() =>
  S.Union([
    pandocConstructorWithPayload("Plain", S.Array(PandocInlineWire)),
    pandocConstructorWithPayload("Para", S.Array(PandocInlineWire)),
    pandocConstructorWithPayload("Header", S.Tuple([S.Int, PandocAttrPayload, S.Array(PandocInlineWire)])),
    pandocConstructorWithPayload("BlockQuote", S.Array(PandocBlockWire)),
    pandocConstructorWithPayload("CodeBlock", S.Tuple([PandocAttrPayload, S.String])),
    pandocConstructorWithPayload("BulletList", PandocBlockWire.pipe(S.Array, S.Array)),
    pandocConstructorWithPayload(
      "OrderedList",
      S.Tuple([
        S.Tuple([S.Int, PandocListNumberStyleWire, PandocListNumberDelimiterWire]),
        PandocBlockWire.pipe(S.Array, S.Array),
      ])
    ),
    pandocNullaryConstructor("HorizontalRule"),
    pandocConstructorWithPayload("Div", S.Tuple([PandocAttrPayload, S.Array(PandocBlockWire)])),
    pandocConstructorWithPayload("Table", DeferredPandocTablePayloadWire),
    PandocFutureConstructorWire,
  ])
);
const isPandocSemanticTablePayload = S.is(PandocSemanticTablePayloadWire);
const makePandocTablePayloadArbitrary = (fc: ArbitraryFastCheck) => {
  const futureConstructor = makePandocFutureConstructorArbitrary(fc);
  const attr = fc.tuple(fc.string(), fc.array(fc.string()), fc.array(fc.tuple(fc.string(), fc.string())));
  const inline = fc.oneof(
    fc.string().map((c) => S.Json.make({ c, t: "Str" })),
    fc.constant(S.Json.make({ t: "Space" })),
    futureConstructor
  );
  const block = fc.oneof(
    fc.array(inline).map((c) => S.Json.make({ c, t: "Para" })),
    fc.constant(S.Json.make({ t: "HorizontalRule" })),
    futureConstructor
  );
  const captionPair = fc.tuple(fc.option(fc.array(inline), { nil: null }), fc.array(block));
  const caption = fc.oneof(
    fc.array(block),
    captionPair,
    captionPair.map((c) => S.Json.make({ c, t: "TableCaption" })),
    futureConstructor
  );
  const alignment = fc.oneof(
    fc.constantFrom("AlignLeft", "AlignRight", "AlignCenter", "AlignDefault").map((t) => S.Json.make({ t })),
    futureConstructor
  );
  const columnWidth = fc.oneof(
    fc.integer().map((c) => S.Json.make({ c, t: "ColWidth" })),
    fc.constant(S.Json.make({ t: "ColWidthDefault" })),
    futureConstructor
  );
  const columnSpec = fc.oneof(fc.tuple(alignment, columnWidth), futureConstructor);
  const cell = fc.oneof(fc.tuple(attr, alignment, fc.integer(), fc.integer(), fc.array(block)), futureConstructor);
  const row = fc.oneof(fc.tuple(attr, fc.array(cell)), futureConstructor);
  const headOrFoot = fc.oneof(fc.constant([]), fc.tuple(attr, fc.array(row)), futureConstructor);
  const body = fc.oneof(fc.tuple(attr, fc.integer(), fc.array(row), fc.array(row)), futureConstructor);

  return fc
    .tuple(attr, caption, fc.array(columnSpec), headOrFoot, fc.array(body), headOrFoot)
    .map(PandocTablePayloadShape.make);
};
class PandocConstructorJson extends S.Class<PandocConstructorJson>($I`PandocConstructorJson`)(
  {
    c: S.optionalKey(S.Json),
    t: S.String,
  },
  $I.annote("PandocConstructorJson", {
    description: "Internal structural view of a Pandoc JSON constructor.",
  })
) {}
const PandocJsonArray = S.Array(S.Json);
const PandocTableCaptionPair = S.Tuple([S.NullOr(PandocJsonArray), PandocJsonArray]);
const decodePandocConstructorOption = S.decodeUnknownOption(PandocConstructorJson);
const decodePandocJsonArrayOption = S.decodeUnknownOption(PandocJsonArray);
const decodePandocStringOption = S.decodeUnknownOption(S.String);
const decodePandocTableCaptionPairOption = S.decodeUnknownOption(PandocTableCaptionPair);

/**
 * Canonical validated Pandoc table payload.
 *
 * @remarks
 * Tables remain an explicit compatibility gap, so the complete six-field JSON
 * tuple is retained as the sole stored truth. Attribute and caption inspection
 * are derived from this payload by {@link Table}.
 *
 * @example
 * ```ts
 * import { PandocTablePayload } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const payload = PandocTablePayload.make([["", [], []], [], [], [], [], []])
 * console.log(payload.length) // 6
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const PandocTablePayload = PandocTablePayloadShape.pipe(
  S.check(
    S.makeFilter(isPandocSemanticTablePayload, {
      identifier: $I`PandocTablePayloadSemanticCheck`,
      title: "Semantically valid Pandoc table payload",
      description: "A six-field Pandoc table payload accepted by the strict recursive constructor grammar.",
      message: "Expected a Pandoc table payload whose nested constructors are valid in their semantic contexts.",
      arbitrary: {
        candidate: {
          weight: 32,
          make: makePandocTablePayloadArbitrary,
        },
      },
    })
  ),
  $I.annoteSchema("PandocTablePayload", {
    description: "Canonical validated six-field Pandoc table payload retained without duplicate semantic fields.",
    toArbitrary: () => makePandocTablePayloadArbitrary,
  })
);

/**
 * Runtime type for {@link PandocTablePayload}.
 *
 * @example
 * ```ts
 * import { PandocTablePayload } from "@beep/pandoc-ast/Pandoc.model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(PandocTablePayload)([["", [], []], [], [], [], [], []])
 * if (Result.isSuccess(decoded)) {
 *   const payload: PandocTablePayload = decoded.success
 *   console.log(payload.length) // 6
 * }
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type PandocTablePayload = typeof PandocTablePayload.Type;

const tableCaptionInlineFromWire = (input: S.Json): O.Option<PandocInline.Type> =>
  O.flatMap(decodePandocConstructorOption(input), (wire) => {
    if (wire.t === "Str") {
      return O.map(decodePandocStringOption(wire.c), (text) => Str.make({ text }));
    }
    if (wire.t === "Space") {
      return O.some(Space.make());
    }
    if (wire.t === "SoftBreak") {
      return O.some(SoftBreak.make());
    }
    if (wire.t === "LineBreak") {
      return O.some(LineBreak.make());
    }
    return O.none();
  });

const tableCaptionInlinesFromBlockWire = (input: S.Json): ReadonlyArray<PandocInline.Type> =>
  O.getOrElse(
    O.map(
      O.flatMap(
        O.filter(decodePandocConstructorOption(input), (wire) => wire.t === "Plain" || wire.t === "Para"),
        (wire) => decodePandocJsonArrayOption(wire.c)
      ),
      (values) => A.getSomes(A.map(values, tableCaptionInlineFromWire))
    ),
    A.emptyReadonly
  );

const tableCaptionInlinesFromBlocksWire = (input: S.Json): ReadonlyArray<PandocInline.Type> =>
  O.match(decodePandocJsonArrayOption(input), {
    onNone: A.emptyReadonly,
    onSome: (blocks) => A.flatMap(blocks, tableCaptionInlinesFromBlockWire),
  });

const tableCaptionFromPayload = (input: S.Json): ReadonlyArray<PandocInline.Type> => {
  const unwrapped = O.match(decodePandocConstructorOption(input), {
    onNone: () => input,
    onSome: (wire) => (wire.t === "TableCaption" ? (wire.c ?? null) : input),
  });
  return O.match(decodePandocTableCaptionPairOption(unwrapped), {
    onNone: () => tableCaptionInlinesFromBlocksWire(unwrapped),
    onSome: ([shortCaption, longCaption]) => {
      const short = shortCaption === null ? [] : A.getSomes(A.map(shortCaption, tableCaptionInlineFromWire));
      return A.isReadonlyArrayNonEmpty(short) ? short : A.flatMap(longCaption, tableCaptionInlinesFromBlockWire);
    },
  });
};

/**
 * Pandoc table block captured as an explicit gap node.
 *
 * @example
 * ```ts
 * import { Table } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Table.make({ payload: [["", [], []], [], [], [], [], []] })
 * console.log(node._tag) // "table"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Table extends S.TaggedClass<Table>($I`Table`)(
  "table",
  {
    payload: PandocTablePayload.annotateKey({
      description: "Original Pandoc table payload.",
    }),
  },
  $I.annote("Table", {
    description: "Pandoc table block captured as an explicit gap node.",
  })
) {
  /**
   * Table attributes derived from the canonical payload.
   *
   * @category getters
   * @since 0.0.0
   */
  get attr(): PandocAttr {
    const [id, classes, keyValues] = this.payload[0];
    return PandocAttr.make({ classes, id, keyValues });
  }

  /**
   * Best-effort caption derived from the canonical payload.
   *
   * @category getters
   * @since 0.0.0
   */
  get caption(): ReadonlyArray<PandocInline.Type> {
    return tableCaptionFromPayload(this.payload[1]);
  }
}

/**
 * Companion namespace for {@link Table}.
 *
 * @example
 * ```ts
 * import { Table } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Table.Type = Table.make({ payload: [["", [], []], [], [], [], [], []] })
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
    readonly payload: PandocTablePayload;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "table";
    readonly payload: PandocTablePayload;
  }
}

/**
 * Future Pandoc block constructor outside the pinned 1.23.1 registry.
 *
 * @example
 * ```ts
 * import { UnknownBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = UnknownBlock.make({ wire: { c: { extension: true }, t: "FutureBlock" } })
 * console.log(node.constructorName) // "FutureBlock"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownBlock extends S.TaggedClass<UnknownBlock>($I`UnknownBlock`)(
  "unknownBlock",
  {
    wire: PandocFutureConstructorWire.annotateKey({
      description: "Exact original future Pandoc constructor object.",
    }),
  },
  $I.annote("UnknownBlock", {
    description: "Future Pandoc block constructor outside the pinned 1.23.1 registry.",
  })
) {
  /**
   * Original Pandoc constructor name derived from {@link wire}.
   *
   * @category getters
   * @since 0.0.0
   */
  get constructorName(): string {
    return this.wire.t;
  }

  /**
   * Optional Pandoc constructor payload derived from {@link wire}.
   *
   * @category getters
   * @since 0.0.0
   */
  get payload(): S.Json | undefined {
    return this.wire.c;
  }
}

/**
 * Companion namespace for {@link UnknownBlock}.
 *
 * @example
 * ```ts
 * import { UnknownBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: UnknownBlock.Type = UnknownBlock.make({ wire: { c: { extension: true }, t: "FutureBlock" } })
 * console.log(node.constructorName) // "FutureBlock"
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
    readonly constructorName: string;
    readonly payload: S.Json | undefined;
    readonly wire: PandocUnknownConstructorWire;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "unknownBlock";
    readonly wire: PandocUnknownConstructorWire;
  }
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
  SchemaUtils.withCodecStatics
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
 * Companion recursive type knot for {@link PandocMetaValue}.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { PandocMetaValue } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const decoded = S.decodeUnknownResult(PandocMetaValue)({
 *   _tag: "metaList",
 *   values: [{ _tag: "metaString", value: "Document" }],
 * })
 * if (Result.isSuccess(decoded)) {
 *   const value: PandocMetaValue.Type = decoded.success
 *   console.log(value._tag) // "metaList"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocMetaValue {
  /**
   * @since 0.0.0
   */
  export interface MetaBoolShape {
    readonly _tag: "metaBool";
    readonly value: boolean;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaStringShape {
    readonly _tag: "metaString";
    readonly value: string;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaInlinesShape {
    readonly _tag: "metaInlines";
    readonly children: PandocInlineChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaInlinesEncodedShape {
    readonly _tag: "metaInlines";
    readonly children: PandocInlineChildren.Encoded;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaBlocksShape {
    readonly _tag: "metaBlocks";
    readonly children: PandocBlockChildren.Type;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaBlocksEncodedShape {
    readonly _tag: "metaBlocks";
    readonly children: PandocBlockChildren.Encoded;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaListShape {
    readonly _tag: "metaList";
    readonly values: ReadonlyArray<Type>;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaListEncodedShape {
    readonly _tag: "metaList";
    readonly values: ReadonlyArray<Encoded>;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaMapShape {
    readonly _tag: "metaMap";
    readonly entries: Readonly<Record<string, Type>>;
  }

  /**
   * @since 0.0.0
   */
  export interface MetaMapEncodedShape {
    readonly _tag: "metaMap";
    readonly entries: Readonly<Record<string, Encoded>>;
  }

  /**
   * @since 0.0.0
   */
  export interface UnknownMetaShape {
    readonly _tag: "unknownMeta";
    readonly constructorName: string;
    readonly payload: S.Json | undefined;
    readonly wire: PandocUnknownConstructorWire;
  }

  /**
   * @since 0.0.0
   */
  export interface UnknownMetaEncodedShape {
    readonly _tag: "unknownMeta";
    readonly wire: PandocUnknownConstructorWire;
  }

  /**
   * @since 0.0.0
   */
  export type Type =
    | MetaBoolShape
    | MetaStringShape
    | MetaInlinesShape
    | MetaBlocksShape
    | MetaListShape
    | MetaMapShape
    | UnknownMetaShape;

  /**
   * @since 0.0.0
   */
  export type Encoded =
    | MetaBoolShape
    | MetaStringShape
    | MetaInlinesEncodedShape
    | MetaBlocksEncodedShape
    | MetaListEncodedShape
    | MetaMapEncodedShape
    | UnknownMetaEncodedShape;
}

const DeferredPandocMetaValue: S.Codec<PandocMetaValue.Type, PandocMetaValue.Encoded> = S.suspend(
  () => PandocMetaValue
);

/**
 * Boolean Pandoc metadata value.
 *
 * @example
 * ```ts
 * import { MetaBool } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(MetaBool.make({ value: true }).value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetaBool = S.TaggedStruct("metaBool", { value: S.Boolean }).pipe(
  $I.annoteSchema("MetaBool", { description: "Boolean Pandoc metadata value." })
);

/**
 * String Pandoc metadata value.
 *
 * @example
 * ```ts
 * import { MetaString } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(MetaString.make({ value: "Document" }).value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetaString = S.TaggedStruct("metaString", { value: S.String }).pipe(
  $I.annoteSchema("MetaString", { description: "String Pandoc metadata value." })
);

/**
 * Inline-list Pandoc metadata value.
 *
 * @example
 * ```ts
 * import { MetaInlines } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(MetaInlines.make({ children: [] }).children.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetaInlines = S.TaggedStruct("metaInlines", { children: PandocInlineChildren }).pipe(
  $I.annoteSchema("MetaInlines", { description: "Inline-list Pandoc metadata value." })
);

/**
 * Block-list Pandoc metadata value.
 *
 * @example
 * ```ts
 * import { MetaBlocks } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(MetaBlocks.make({ children: [] }).children.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetaBlocks = S.TaggedStruct("metaBlocks", { children: PandocBlockChildren }).pipe(
  $I.annoteSchema("MetaBlocks", { description: "Block-list Pandoc metadata value." })
);

/**
 * Recursive list Pandoc metadata value.
 *
 * @example
 * ```ts
 * import { MetaList, MetaString } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(MetaList.make({ values: [MetaString.make({ value: "one" })] }).values.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetaList = S.TaggedStruct("metaList", { values: DeferredPandocMetaValue.pipe(S.Array) }).pipe(
  $I.annoteSchema("MetaList", { description: "Recursive list Pandoc metadata value." })
);

/**
 * Recursive mapping Pandoc metadata value.
 *
 * @example
 * ```ts
 * import { MetaMap, MetaString } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(MetaMap.make({ entries: { title: MetaString.make({ value: "Doc" }) } }).entries.title)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetaMap = S.TaggedStruct("metaMap", {
  entries: S.Record(S.String, DeferredPandocMetaValue),
}).pipe($I.annoteSchema("MetaMap", { description: "Recursive mapping Pandoc metadata value." }));

/**
 * Future Pandoc metadata constructor outside the supported surface.
 *
 * @example
 * ```ts
 * import { UnknownMeta } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(UnknownMeta.make({ wire: { t: "MetaFuture" } }).constructorName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnknownMeta extends S.TaggedClass<UnknownMeta>($I`UnknownMeta`)(
  "unknownMeta",
  {
    wire: PandocFutureConstructorWire.annotateKey({
      description: "Exact original future Pandoc metadata constructor object.",
    }),
  },
  $I.annote("UnknownMeta", {
    description: "Future Pandoc metadata constructor outside the supported surface.",
  })
) {
  /**
   * Original Pandoc constructor name derived from {@link wire}.
   *
   * @category getters
   * @since 0.0.0
   */
  get constructorName(): string {
    return this.wire.t;
  }

  /**
   * Optional Pandoc constructor payload derived from {@link wire}.
   *
   * @category getters
   * @since 0.0.0
   */
  get payload(): S.Json | undefined {
    return this.wire.c;
  }
}

/**
 * Recursive semantic Pandoc metadata-value union.
 *
 * @example
 * ```ts
 * import { MetaString, PandocMetaValue } from "@beep/pandoc-ast/Pandoc.model"
 *
 * console.log(PandocMetaValue.is(MetaString.make({ value: "Doc" })))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PandocMetaValue = S.Union([
  MetaBool,
  MetaString,
  MetaInlines,
  MetaBlocks,
  MetaList,
  MetaMap,
  UnknownMeta,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("PandocMetaValue", {
    description: "Recursive semantic Pandoc metadata-value union.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded boolean metadata payload.
 *
 * @example
 * ```ts
 * import { MetaBool } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaBool = MetaBool.make({ value: true })
 * console.log(value.value) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaBool = typeof MetaBool.Type;

/**
 * Decoded string metadata payload.
 *
 * @example
 * ```ts
 * import { MetaString } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaString = MetaString.make({ value: "Document" })
 * console.log(value.value) // "Document"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaString = typeof MetaString.Type;

/**
 * Decoded inline-list metadata payload.
 *
 * @example
 * ```ts
 * import { MetaInlines } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaInlines = MetaInlines.make({ children: [] })
 * console.log(value.children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaInlines = typeof MetaInlines.Type;

/**
 * Encoded inline-list metadata payload.
 *
 * @example
 * ```ts
 * import type { MetaInlinesEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaInlinesEncoded = { _tag: "metaInlines", children: [] }
 * console.log(value.children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaInlinesEncoded = typeof MetaInlines.Encoded;

/**
 * Decoded block-list metadata payload.
 *
 * @example
 * ```ts
 * import { MetaBlocks } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaBlocks = MetaBlocks.make({ children: [] })
 * console.log(value.children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaBlocks = typeof MetaBlocks.Type;

/**
 * Encoded block-list metadata payload.
 *
 * @example
 * ```ts
 * import type { MetaBlocksEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaBlocksEncoded = { _tag: "metaBlocks", children: [] }
 * console.log(value.children.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaBlocksEncoded = typeof MetaBlocks.Encoded;

/**
 * Decoded recursive metadata-list payload.
 *
 * @example
 * ```ts
 * import { MetaList } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaList = MetaList.make({ values: [] })
 * console.log(value.values.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaList = typeof MetaList.Type;

/**
 * Encoded recursive metadata-list payload.
 *
 * @example
 * ```ts
 * import type { MetaListEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaListEncoded = { _tag: "metaList", values: [] }
 * console.log(value.values.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaListEncoded = typeof MetaList.Encoded;

/**
 * Decoded recursive metadata-map payload.
 *
 * @example
 * ```ts
 * import { MetaMap } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaMap = MetaMap.make({ entries: {} })
 * console.log(Object.keys(value.entries).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaMap = typeof MetaMap.Type;

/**
 * Encoded recursive metadata-map payload.
 *
 * @example
 * ```ts
 * import type { MetaMapEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaMapEncoded = { _tag: "metaMap", entries: {} }
 * console.log(Object.keys(value.entries).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaMapEncoded = typeof MetaMap.Encoded;

/**
 * Encoded exact future metadata constructor.
 *
 * @example
 * ```ts
 * import type { UnknownMetaEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: UnknownMetaEncoded = { _tag: "unknownMeta", wire: { t: "MetaFuture" } }
 * console.log(value.wire.t) // "MetaFuture"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnknownMetaEncoded = typeof UnknownMeta.Encoded;

/**
 * Recursive decoded Pandoc metadata value.
 *
 * @example
 * ```ts
 * import { MetaString } from "@beep/pandoc-ast/Pandoc.model"
 * import type { PandocMetaValue } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: PandocMetaValue = MetaString.make({ value: "Document" })
 * console.log(value._tag) // "metaString"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMetaValue = typeof PandocMetaValue.Type;

/**
 * Recursive encoded Pandoc metadata value.
 *
 * @example
 * ```ts
 * import type { PandocMetaValueEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: PandocMetaValueEncoded = { _tag: "metaString", value: "Document" }
 * console.log(value._tag) // "metaString"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMetaValueEncoded = typeof PandocMetaValue.Encoded;

/**
 * Pandoc document metadata map.
 *
 * @example
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { MetaString, PandocMeta } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const result = S.decodeUnknownResult(PandocMeta)({
 *   title: MetaString.make({ value: "Doc" }),
 * })
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PandocMeta = S.Record(S.String, DeferredPandocMetaValue).pipe(
  $I.annoteSchema("PandocMeta", {
    description: "Recursive semantic Pandoc document metadata map.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PandocMeta}.
 *
 * @example
 * ```ts
 * import { MetaString } from "@beep/pandoc-ast/Pandoc.model"
 * import type { PandocMeta } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const meta: PandocMeta = { title: MetaString.make({ value: "Document" }) }
 * console.log(meta.title?._tag) // "metaString"
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
    apiVersion: PandocApiVersion.pipe(
      SchemaUtils.withConstantDefault<PandocApiVersion>(DEFAULT_PANDOC_API_VERSION)
    ).annotateKey({
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

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
 * **Example** (Making API version tuple)
 *
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
 * **Example** (Typing version tuple)
 *
 * ```ts import.meta.vitest name="Typing version tuple"
 * import type { PandocApiVersion } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const version: PandocApiVersion = [1, 23, 1]
 * version.length // => 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocApiVersion = typeof PandocApiVersion.Type;

/**
 * Default Pandoc JSON API version emitted by Md-to-Pandoc projections.
 *
 * **Example** (Joining default version)
 *
 * ```ts import.meta.vitest name="Joining default version"
 * import { DEFAULT_PANDOC_API_VERSION } from "@beep/pandoc-ast/Pandoc.model"
 *
 * DEFAULT_PANDOC_API_VERSION.join(".") // => "1.23.1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_PANDOC_API_VERSION: PandocApiVersion = PandocApiVersion.make([1, 23, 1]);

/**
 * Exact JSON object retained for a future Pandoc constructor.
 *
 * **Details**
 *
 * The `c` payload is genuinely optional because Pandoc nullary constructors
 * omit it. Rest fields remain part of the semantic opaque node so a future
 * constructor can round-trip without guessing which fields matter.
 *
 * **Example** (Making unknown constructor wire)
 *
 * ```ts import.meta.vitest name="Making unknown constructor wire"
 * import { PandocUnknownConstructorWire } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const wire = PandocUnknownConstructorWire.make({ t: "Future", extension: true })
 * wire.extension // => true
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
  })
);

/**
 * Runtime type for {@link PandocUnknownConstructorWire}.
 *
 * **Example** (Typing unknown constructor wire)
 *
 * ```ts import.meta.vitest name="Typing unknown constructor wire"
 * import type { PandocUnknownConstructorWire } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const wire: PandocUnknownConstructorWire = { t: "Future" }
 * wire.t // => "Future"
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
 * **Example** (Decoding key-value pair)
 *
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
 * **Example** (Typing key-value pair)
 *
 * ```ts import.meta.vitest name="Typing key-value pair"
 * import type { PandocKeyValue } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const pair: PandocKeyValue = ["data-foo", "bar"]
 * pair[0] // => "data-foo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocKeyValue = typeof PandocKeyValue.Type;

/**
 * Pandoc attribute triple represented with named fields.
 *
 * **Example** (Using empty attributes)
 *
 * ```ts import.meta.vitest name="Using empty attributes"
 * import { PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const attr = PandocAttr.empty
 * attr.id // => ""
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
 * **Example** (Making named attributes)
 *
 * ```ts import.meta.vitest name="Making named attributes"
 * import { PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const attr: PandocAttr.Type = PandocAttr.make({ classes: ["note"], id: "n1", keyValues: [] })
 * attr.classes[0] // => "note"
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
 * **Example** (Making link target)
 *
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
 * **Example** (Typing link target)
 *
 * ```ts import.meta.vitest name="Typing link target"
 * import { PandocTarget } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const target: PandocTarget.Type = PandocTarget.make({ title: "Example", url: "https://example.com" })
 * target.title // => "Example"
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
 * **Example** (Checking InlineMath marker)
 *
 * ```ts import.meta.vitest name="Checking InlineMath marker"
 * import { PandocMathType } from "@beep/pandoc-ast/Pandoc.model"
 *
 * PandocMathType.is.InlineMath("InlineMath") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export { PandocMathType };

/**
 * Runtime type for {@link PandocMathType}.
 *
 * **Example** (Typing math type)
 *
 * ```ts import.meta.vitest name="Typing math type"
 * import type { PandocMathType } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const mathType: PandocMathType = "InlineMath"
 * mathType // => "InlineMath"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMathType = typeof PandocMathType.Type;

/**
 * Pandoc ordered-list numbering style constructor.
 *
 * **Example** (Checking DefaultStyle marker)
 *
 * ```ts import.meta.vitest name="Checking DefaultStyle marker"
 * import { PandocListNumberStyle } from "@beep/pandoc-ast/Pandoc.model"
 *
 * PandocListNumberStyle.is.DefaultStyle("DefaultStyle") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export { PandocListNumberStyle };

/**
 * Runtime type for {@link PandocListNumberStyle}.
 *
 * **Example** (Typing list number style)
 *
 * ```ts import.meta.vitest name="Typing list number style"
 * import type { PandocListNumberStyle } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const style: PandocListNumberStyle = "Decimal"
 * style // => "Decimal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListNumberStyle = typeof PandocListNumberStyle.Type;

/**
 * Pandoc ordered-list numbering delimiter constructor.
 *
 * **Example** (Checking DefaultDelim marker)
 *
 * ```ts import.meta.vitest name="Checking DefaultDelim marker"
 * import { PandocListNumberDelimiter } from "@beep/pandoc-ast/Pandoc.model"
 *
 * PandocListNumberDelimiter.is.DefaultDelim("DefaultDelim") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export { PandocListNumberDelimiter };

/**
 * Runtime type for {@link PandocListNumberDelimiter}.
 *
 * **Example** (Typing list delimiter)
 *
 * ```ts import.meta.vitest name="Typing list delimiter"
 * import type { PandocListNumberDelimiter } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const delimiter: PandocListNumberDelimiter = "Period"
 * delimiter // => "Period"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListNumberDelimiter = typeof PandocListNumberDelimiter.Type;

/**
 * Recursive Pandoc inline child list.
 *
 * **Example** (Checking empty inline children)
 *
 * ```ts import.meta.vitest name="Checking empty inline children"
 * import * as S from "effect/Schema"
 * import { PandocInlineChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isInlineChildren = S.is(PandocInlineChildren)
 * isInlineChildren([]) // => true
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
 * **Example** (Typing empty inline children)
 *
 * ```ts import.meta.vitest name="Typing empty inline children"
 * import type { PandocInlineChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocInlineChildren = []
 * children.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocInlineChildren = typeof PandocInlineChildren.Type;

/**
 * Companion namespace for {@link PandocInlineChildren}.
 *
 * **Example** (Using inline children Type)
 *
 * ```ts import.meta.vitest name="Using inline children Type"
 * import { PandocInlineChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocInlineChildren.Type = []
 * children.length // => 0
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
 * **Example** (Checking empty block children)
 *
 * ```ts import.meta.vitest name="Checking empty block children"
 * import * as S from "effect/Schema"
 * import { PandocBlockChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isBlockChildren = S.is(PandocBlockChildren)
 * isBlockChildren([]) // => true
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
 * **Example** (Typing empty block children)
 *
 * ```ts import.meta.vitest name="Typing empty block children"
 * import type { PandocBlockChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocBlockChildren = []
 * children.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocBlockChildren = typeof PandocBlockChildren.Type;

/**
 * Companion namespace for {@link PandocBlockChildren}.
 *
 * **Example** (Using block children Type)
 *
 * ```ts import.meta.vitest name="Using block children Type"
 * import { PandocBlockChildren } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const children: PandocBlockChildren.Type = []
 * children.length // => 0
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
 * **Example** (Checking empty list item)
 *
 * ```ts import.meta.vitest name="Checking empty list item"
 * import * as S from "effect/Schema"
 * import { PandocListItem } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isListItem = S.is(PandocListItem)
 * isListItem([]) // => true
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
 * **Example** (Typing empty list item)
 *
 * ```ts import.meta.vitest name="Typing empty list item"
 * import type { PandocListItem } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const item: PandocListItem = []
 * item.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListItem = typeof PandocListItem.Type;

/**
 * Pandoc list items.
 *
 * **Example** (Checking empty list items)
 *
 * ```ts import.meta.vitest name="Checking empty list items"
 * import * as S from "effect/Schema"
 * import { PandocListItems } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const isListItems = S.is(PandocListItems)
 * isListItems([]) // => true
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
 * **Example** (Typing empty list items)
 *
 * ```ts import.meta.vitest name="Typing empty list items"
 * import type { PandocListItems } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const items: PandocListItems = []
 * items.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocListItems = typeof PandocListItems.Type;

/**
 * Plain text inline.
 *
 * **Example** (Making plain text inline)
 *
 * ```ts import.meta.vitest name="Making plain text inline"
 * import { Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Str.make({ text: "hello" })
 * node._tag // => "str"
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
 * **Example** (Typing Str node)
 *
 * ```ts import.meta.vitest name="Typing Str node"
 * import { Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Str.Type = Str.make({ text: "hello" })
 * node.text // => "hello"
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
 * **Example** (Making space inline)
 *
 * ```ts import.meta.vitest name="Making space inline"
 * import { Space } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Space.make()
 * node._tag // => "space"
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
 * **Example** (Typing Space node)
 *
 * ```ts import.meta.vitest name="Typing Space node"
 * import { Space } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Space.Type = Space.make()
 * node._tag // => "space"
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
 * **Example** (Making soft break inline)
 *
 * ```ts import.meta.vitest name="Making soft break inline"
 * import { SoftBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = SoftBreak.make()
 * node._tag // => "softbreak"
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
 * **Example** (Typing SoftBreak node)
 *
 * ```ts import.meta.vitest name="Typing SoftBreak node"
 * import { SoftBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: SoftBreak.Type = SoftBreak.make()
 * node._tag // => "softbreak"
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
 * **Example** (Making hard line break)
 *
 * ```ts import.meta.vitest name="Making hard line break"
 * import { LineBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = LineBreak.make()
 * node._tag // => "linebreak"
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
 * **Example** (Typing LineBreak node)
 *
 * ```ts import.meta.vitest name="Typing LineBreak node"
 * import { LineBreak } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: LineBreak.Type = LineBreak.make()
 * node._tag // => "linebreak"
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
 * **Example** (Making emphasis inline)
 *
 * ```ts import.meta.vitest name="Making emphasis inline"
 * import { Emph, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Emph.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Typing Emph node)
 *
 * ```ts import.meta.vitest name="Typing Emph node"
 * import { Emph, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Emph.Type = Emph.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Making strong inline)
 *
 * ```ts import.meta.vitest name="Making strong inline"
 * import { Strong, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Strong.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Typing Strong node)
 *
 * ```ts import.meta.vitest name="Typing Strong node"
 * import { Strong, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Strong.Type = Strong.make({ children: [Str.make({ text: "hi" })] })
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
 * **Example** (Making strikeout inline)
 *
 * ```ts import.meta.vitest name="Making strikeout inline"
 * import { Strikeout, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Strikeout.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Typing Strikeout node)
 *
 * ```ts import.meta.vitest name="Typing Strikeout node"
 * import { Strikeout, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Strikeout.Type = Strikeout.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Making code inline)
 *
 * ```ts import.meta.vitest name="Making code inline"
 * import { Code, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Code.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * node.text // => "const x = 1"
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
 * **Example** (Typing Code node)
 *
 * ```ts import.meta.vitest name="Typing Code node"
 * import { Code, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Code.Type = Code.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * node.text // => "const x = 1"
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
 * **Example** (Making link inline)
 *
 * ```ts import.meta.vitest name="Making link inline"
 * import { Link, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Link.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "example" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com" }),
 * })
 * node.target.url // => "https://example.com"
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
 * **Example** (Typing Link node)
 *
 * ```ts import.meta.vitest name="Typing Link node"
 * import { Link, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Link.Type = Link.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "example" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com" }),
 * })
 * node.target.url // => "https://example.com"
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
 * **Example** (Making image inline)
 *
 * ```ts import.meta.vitest name="Making image inline"
 * import { Image, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Image.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "alt text" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com/logo.png" }),
 * })
 * node.target.url // => "https://example.com/logo.png"
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
 * **Example** (Typing Image node)
 *
 * ```ts import.meta.vitest name="Typing Image node"
 * import { Image, PandocAttr, PandocTarget, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Image.Type = Image.make({
 *   attr: PandocAttr.empty,
 *   children: [Str.make({ text: "alt text" })],
 *   target: PandocTarget.make({ title: "", url: "https://example.com/logo.png" }),
 * })
 * node.target.url // => "https://example.com/logo.png"
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
 * **Example** (Making span inline)
 *
 * ```ts import.meta.vitest name="Making span inline"
 * import { Span, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Span.make({ attr: PandocAttr.empty, children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Typing Span node)
 *
 * ```ts import.meta.vitest name="Typing Span node"
 * import { Span, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Span.Type = Span.make({ attr: PandocAttr.empty, children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Making footnote inline)
 *
 * ```ts import.meta.vitest name="Making footnote inline"
 * import { Note, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Note.make({ blocks: [Para.make({ children: [Str.make({ text: "note" })] })] })
 * node.blocks.length // => 1
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
 * **Example** (Typing Note node)
 *
 * ```ts import.meta.vitest name="Typing Note node"
 * import { Note, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Note.Type = Note.make({ blocks: [Para.make({ children: [Str.make({ text: "note" })] })] })
 * node.blocks.length // => 1
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
 * **Example** (Making math inline)
 *
 * ```ts import.meta.vitest name="Making math inline"
 * import { Math } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Math.make({ mathType: "InlineMath", text: "x^2" })
 * node.text // => "x^2"
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
 * **Example** (Typing Math node)
 *
 * ```ts import.meta.vitest name="Typing Math node"
 * import { Math } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Math.Type = Math.make({ mathType: "InlineMath", text: "x^2" })
 * node.mathType // => "InlineMath"
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
 * **Example** (Making unknown inline)
 *
 * ```ts import.meta.vitest name="Making unknown inline"
 * import { UnknownInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = UnknownInline.make({ wire: { c: { extension: true }, t: "FutureInline" } })
 * node.constructorName // => "FutureInline"
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
 * **Example** (Typing UnknownInline node)
 *
 * ```ts import.meta.vitest name="Typing UnknownInline node"
 * import { UnknownInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: UnknownInline.Type = UnknownInline.make({ wire: { c: { extension: true }, t: "FutureInline" } })
 * node.constructorName // => "FutureInline"
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
 * **Example** (Checking inline union)
 *
 * ```ts import.meta.vitest name="Checking inline union"
 * import { PandocInline, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const inline = Str.make({ text: "hi" })
 * PandocInline.is(inline) // => true
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
  // fallow-ignore-next-line code-duplication -- preserve the selected guard through Effect's tagged-union rebuild
  $I.annoteSchema("PandocInline", {
    description: "Pandoc inline union for the v1 compatibility slice.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("_tag"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 * Runtime type for {@link PandocInline}.
 *
 * **Example** (Typing inline union)
 *
 * ```ts import.meta.vitest name="Typing inline union"
 * import { Str, type PandocInline } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const inline: PandocInline = Str.make({ text: "hi" })
 * inline._tag // => "str"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocInline = typeof PandocInline.Type;

/**
 * Companion namespace for {@link PandocInline}.
 *
 * **Example** (Using inline Type alias)
 *
 * ```ts import.meta.vitest name="Using inline Type alias"
 * import { PandocInline, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const inline: PandocInline.Type = Str.make({ text: "hi" })
 * inline._tag // => "str"
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
 * **Example** (Making plain block)
 *
 * ```ts import.meta.vitest name="Making plain block"
 * import { Plain, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Plain.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Typing Plain node)
 *
 * ```ts import.meta.vitest name="Typing Plain node"
 * import { Plain, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Plain.Type = Plain.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Making paragraph block)
 *
 * ```ts import.meta.vitest name="Making paragraph block"
 * import { Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Para.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Typing Para node)
 *
 * ```ts import.meta.vitest name="Typing Para node"
 * import { Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Para.Type = Para.make({ children: [Str.make({ text: "hi" })] })
 * node.children.length // => 1
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
 * **Example** (Making header block)
 *
 * ```ts import.meta.vitest name="Making header block"
 * import { Header, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Header.make({ attr: PandocAttr.empty, children: [Str.make({ text: "Title" })], level: 1 })
 * node.level // => 1
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
 * **Example** (Typing Header node)
 *
 * ```ts import.meta.vitest name="Typing Header node"
 * import { Header, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Header.Type = Header.make({ attr: PandocAttr.empty, children: [Str.make({ text: "Title" })], level: 1 })
 * node.level // => 1
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
 * **Example** (Making block quote)
 *
 * ```ts import.meta.vitest name="Making block quote"
 * import { BlockQuote, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = BlockQuote.make({ children: [Para.make({ children: [Str.make({ text: "quoted" })] })] })
 * node.children.length // => 1
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
 * **Example** (Typing BlockQuote node)
 *
 * ```ts import.meta.vitest name="Typing BlockQuote node"
 * import { BlockQuote, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: BlockQuote.Type = BlockQuote.make({ children: [Para.make({ children: [Str.make({ text: "quoted" })] })] })
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
 * **Example** (Making fenced code block)
 *
 * ```ts import.meta.vitest name="Making fenced code block"
 * import { CodeBlock, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = CodeBlock.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * node.text // => "const x = 1"
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
 * **Example** (Typing CodeBlock node)
 *
 * ```ts import.meta.vitest name="Typing CodeBlock node"
 * import { CodeBlock, PandocAttr } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: CodeBlock.Type = CodeBlock.make({ attr: PandocAttr.empty, text: "const x = 1" })
 * node.text // => "const x = 1"
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
 * **Example** (Making bullet list)
 *
 * ```ts import.meta.vitest name="Making bullet list"
 * import { BulletList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = BulletList.make({ items: [[Para.make({ children: [Str.make({ text: "item" })] })]] })
 * node.items.length // => 1
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
 * **Example** (Typing BulletList node)
 *
 * ```ts import.meta.vitest name="Typing BulletList node"
 * import { BulletList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: BulletList.Type = BulletList.make({ items: [[Para.make({ children: [Str.make({ text: "item" })] })]] })
 * node.items.length // => 1
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
 * **Example** (Making ordered list)
 *
 * ```ts import.meta.vitest name="Making ordered list"
 * import { OrderedList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = OrderedList.make({
 *   delimiter: "Period",
 *   items: [[Para.make({ children: [Str.make({ text: "item" })] })]],
 *   start: 1,
 *   style: "Decimal",
 * })
 * node.start // => 1
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
 * **Example** (Typing OrderedList node)
 *
 * ```ts import.meta.vitest name="Typing OrderedList node"
 * import { OrderedList, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: OrderedList.Type = OrderedList.make({
 *   delimiter: "Period",
 *   items: [[Para.make({ children: [Str.make({ text: "item" })] })]],
 *   start: 1,
 *   style: "Decimal",
 * })
 * node.start // => 1
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
 * **Example** (Making horizontal rule)
 *
 * ```ts import.meta.vitest name="Making horizontal rule"
 * import { HorizontalRule } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = HorizontalRule.make({})
 * node._tag // => "horizontalrule"
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
 * **Example** (Typing HorizontalRule node)
 *
 * ```ts import.meta.vitest name="Typing HorizontalRule node"
 * import { HorizontalRule } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: HorizontalRule.Type = HorizontalRule.make({})
 * node._tag // => "horizontalrule"
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
 * **Example** (Making div block)
 *
 * ```ts import.meta.vitest name="Making div block"
 * import { Div, Para, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Div.make({
 *   attr: PandocAttr.empty,
 *   children: [Para.make({ children: [Str.make({ text: "hi" })] })],
 * })
 * node.children.length // => 1
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
 * **Example** (Typing Div node)
 *
 * ```ts import.meta.vitest name="Typing Div node"
 * import { Div, Para, PandocAttr, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Div.Type = Div.make({
 *   attr: PandocAttr.empty,
 *   children: [Para.make({ children: [Str.make({ text: "hi" })] })],
 * })
 * node.children.length // => 1
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
const PandocTableCaptionWire = S.Union([PandocTableCaptionPairWire, PandocFutureConstructorWire]);
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
  const caption = fc.oneof(captionPair, futureConstructor);
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
  const headOrFoot = fc.oneof(fc.tuple(attr, fc.array(row)), futureConstructor);
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
 * **Details**
 *
 * Tables remain an explicit compatibility gap, so the complete six-field JSON
 * tuple is retained as the sole stored truth. Attribute and caption inspection
 * are derived from this payload by {@link Table}.
 *
 * **Example** (Making six-field table payload)
 *
 * ```ts import.meta.vitest name="Making six-field table payload"
 * import { PandocTablePayload } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const payload = PandocTablePayload.make([
 *   ["", [], []],
 *   [null, []],
 *   [],
 *   [["", [], []], []],
 *   [],
 *   [["", [], []], []],
 * ])
 * payload.length // => 6
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
 * **Example** (Decoding table payload)
 *
 * ```ts import.meta.vitest name="Decoding table payload"
 * import { PandocTablePayload } from "@beep/pandoc-ast/Pandoc.model"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(PandocTablePayload)([
 *   ["", [], []],
 *   [null, []],
 *   [],
 *   [["", [], []], []],
 *   [],
 *   [["", [], []], []],
 * ])
 * if (Result.isSuccess(decoded)) {
 *   const payload: PandocTablePayload = decoded.success
 *   payload.length // => 6
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

const tableCaptionFromPayload = (input: S.Json): ReadonlyArray<PandocInline.Type> =>
  O.match(decodePandocTableCaptionPairOption(input), {
    onNone: A.emptyReadonly,
    onSome: ([shortCaption, longCaption]) => {
      const short = shortCaption === null ? [] : A.getSomes(A.map(shortCaption, tableCaptionInlineFromWire));
      return A.isReadonlyArrayNonEmpty(short) ? short : A.flatMap(longCaption, tableCaptionInlinesFromBlockWire);
    },
  });

/**
 * Pandoc table block captured as an explicit gap node.
 *
 * **Example** (Making table gap node)
 *
 * ```ts import.meta.vitest name="Making table gap node"
 * import { Table } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = Table.make({
 *   payload: [["", [], []], [null, []], [], [["", [], []], []], [], [["", [], []], []]],
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
 * **Example** (Typing Table node)
 *
 * ```ts import.meta.vitest name="Typing Table node"
 * import { Table } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: Table.Type = Table.make({
 *   payload: [["", [], []], [null, []], [], [["", [], []], []], [], [["", [], []], []]],
 * })
 * node._tag // => "table"
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
 * **Example** (Making unknown block)
 *
 * ```ts import.meta.vitest name="Making unknown block"
 * import { UnknownBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node = UnknownBlock.make({ wire: { c: { extension: true }, t: "FutureBlock" } })
 * node.constructorName // => "FutureBlock"
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
 * **Example** (Typing UnknownBlock node)
 *
 * ```ts import.meta.vitest name="Typing UnknownBlock node"
 * import { UnknownBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const node: UnknownBlock.Type = UnknownBlock.make({ wire: { c: { extension: true }, t: "FutureBlock" } })
 * node.constructorName // => "FutureBlock"
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
 * **Example** (Checking block union)
 *
 * ```ts import.meta.vitest name="Checking block union"
 * import { PandocBlock, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const block = Para.make({ children: [Str.make({ text: "hi" })] })
 * PandocBlock.is(block) // => true
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
  // fallow-ignore-next-line code-duplication -- preserve the selected guard through Effect's tagged-union rebuild
  $I.annoteSchema("PandocBlock", {
    description: "Pandoc block union for the v1 compatibility slice.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("_tag"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 * Runtime type for {@link PandocBlock}.
 *
 * **Example** (Typing block union)
 *
 * ```ts import.meta.vitest name="Typing block union"
 * import { Para, Str, type PandocBlock } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const block: PandocBlock = Para.make({ children: [Str.make({ text: "hi" })] })
 * block._tag // => "para"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocBlock = typeof PandocBlock.Type;

/**
 * Companion namespace for {@link PandocBlock}.
 *
 * **Example** (Using block Type alias)
 *
 * ```ts import.meta.vitest name="Using block Type alias"
 * import { PandocBlock, Para, Str } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const block: PandocBlock.Type = Para.make({ children: [Str.make({ text: "hi" })] })
 * block._tag // => "para"
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
 * **Example** (Decoding meta list value)
 *
 * ```ts import.meta.vitest name="Decoding meta list value"
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
 *   value._tag // => "metaList"
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
 * **Example** (Making boolean meta value)
 *
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
 * **Example** (Making string meta value)
 *
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
 * **Example** (Making inline-list meta)
 *
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
 * **Example** (Making block-list meta)
 *
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
 * **Example** (Making recursive meta list)
 *
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
 * **Example** (Making recursive meta map)
 *
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
 * **Example** (Making unknown meta value)
 *
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
 * **Example** (Checking meta value union)
 *
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
  // fallow-ignore-next-line code-duplication -- preserve the selected guard through Effect's tagged-union rebuild
  $I.annoteSchema("PandocMetaValue", {
    description: "Recursive semantic Pandoc metadata-value union.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("_tag"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 * Decoded boolean metadata payload.
 *
 * **Example** (Typing boolean meta payload)
 *
 * ```ts import.meta.vitest name="Typing boolean meta payload"
 * import { MetaBool } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaBool = MetaBool.make({ value: true })
 * value.value // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaBool = typeof MetaBool.Type;

/**
 * Decoded string metadata payload.
 *
 * **Example** (Typing string meta payload)
 *
 * ```ts import.meta.vitest name="Typing string meta payload"
 * import { MetaString } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaString = MetaString.make({ value: "Document" })
 * value.value // => "Document"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaString = typeof MetaString.Type;

/**
 * Decoded inline-list metadata payload.
 *
 * **Example** (Typing inline-list meta)
 *
 * ```ts import.meta.vitest name="Typing inline-list meta"
 * import { MetaInlines } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaInlines = MetaInlines.make({ children: [] })
 * value.children.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaInlines = typeof MetaInlines.Type;

/**
 * Encoded inline-list metadata payload.
 *
 * **Example** (Typing encoded inline meta)
 *
 * ```ts import.meta.vitest name="Typing encoded inline meta"
 * import type { MetaInlinesEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaInlinesEncoded = { _tag: "metaInlines", children: [] }
 * value.children.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaInlinesEncoded = typeof MetaInlines.Encoded;

/**
 * Decoded block-list metadata payload.
 *
 * **Example** (Typing block-list meta)
 *
 * ```ts import.meta.vitest name="Typing block-list meta"
 * import { MetaBlocks } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaBlocks = MetaBlocks.make({ children: [] })
 * value.children.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaBlocks = typeof MetaBlocks.Type;

/**
 * Encoded block-list metadata payload.
 *
 * **Example** (Typing encoded block meta)
 *
 * ```ts import.meta.vitest name="Typing encoded block meta"
 * import type { MetaBlocksEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaBlocksEncoded = { _tag: "metaBlocks", children: [] }
 * value.children.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaBlocksEncoded = typeof MetaBlocks.Encoded;

/**
 * Decoded recursive metadata-list payload.
 *
 * **Example** (Typing recursive meta list)
 *
 * ```ts import.meta.vitest name="Typing recursive meta list"
 * import { MetaList } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaList = MetaList.make({ values: [] })
 * value.values.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaList = typeof MetaList.Type;

/**
 * Encoded recursive metadata-list payload.
 *
 * **Example** (Typing encoded meta list)
 *
 * ```ts import.meta.vitest name="Typing encoded meta list"
 * import type { MetaListEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaListEncoded = { _tag: "metaList", values: [] }
 * value.values.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaListEncoded = typeof MetaList.Encoded;

/**
 * Decoded recursive metadata-map payload.
 *
 * **Example** (Typing recursive meta map)
 *
 * ```ts import.meta.vitest name="Typing recursive meta map"
 * import { MetaMap } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaMap = MetaMap.make({ entries: {} })
 * Object.keys(value.entries).length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaMap = typeof MetaMap.Type;

/**
 * Encoded recursive metadata-map payload.
 *
 * **Example** (Typing encoded meta map)
 *
 * ```ts import.meta.vitest name="Typing encoded meta map"
 * import type { MetaMapEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: MetaMapEncoded = { _tag: "metaMap", entries: {} }
 * Object.keys(value.entries).length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetaMapEncoded = typeof MetaMap.Encoded;

/**
 * Encoded exact future metadata constructor.
 *
 * **Example** (Typing encoded unknown meta)
 *
 * ```ts import.meta.vitest name="Typing encoded unknown meta"
 * import type { UnknownMetaEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: UnknownMetaEncoded = { _tag: "unknownMeta", wire: { t: "MetaFuture" } }
 * value.wire.t // => "MetaFuture"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnknownMetaEncoded = typeof UnknownMeta.Encoded;

/**
 * Recursive decoded Pandoc metadata value.
 *
 * **Example** (Typing decoded meta value)
 *
 * ```ts import.meta.vitest name="Typing decoded meta value"
 * import { MetaString } from "@beep/pandoc-ast/Pandoc.model"
 * import type { PandocMetaValue } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: PandocMetaValue = MetaString.make({ value: "Document" })
 * value._tag // => "metaString"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMetaValue = typeof PandocMetaValue.Type;

/**
 * Recursive encoded Pandoc metadata value.
 *
 * **Example** (Typing encoded meta value)
 *
 * ```ts import.meta.vitest name="Typing encoded meta value"
 * import type { PandocMetaValueEncoded } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const value: PandocMetaValueEncoded = { _tag: "metaString", value: "Document" }
 * value._tag // => "metaString"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMetaValueEncoded = typeof PandocMetaValue.Encoded;

/**
 * Pandoc document metadata map.
 *
 * **Example** (Decoding document metadata)
 *
 * ```ts import.meta.vitest name="Decoding document metadata"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { MetaString, PandocMeta } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const result = S.decodeUnknownResult(PandocMeta)({
 *   title: MetaString.make({ value: "Doc" }),
 * })
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PandocMeta = S.Record(S.String, DeferredPandocMetaValue).pipe(
  $I.annoteSchema("PandocMeta", {
    description: "Recursive semantic Pandoc document metadata map.",
  })
);

/**
 * Runtime type for {@link PandocMeta}.
 *
 * **Example** (Typing document metadata)
 *
 * ```ts import.meta.vitest name="Typing document metadata"
 * import { MetaString } from "@beep/pandoc-ast/Pandoc.model"
 * import type { PandocMeta } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const meta: PandocMeta = { title: MetaString.make({ value: "Document" }) }
 * meta.title?._tag // => "metaString"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMeta = typeof PandocMeta.Type;

/**
 * Root Pandoc JSON document.
 *
 * **Example** (Making root document)
 *
 * ```ts import.meta.vitest name="Making root document"
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const document = PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })
 * document._tag // => "pandocDocument"
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
 * **Example** (Typing PandocDocument node)
 *
 * ```ts import.meta.vitest name="Typing PandocDocument node"
 * import { PandocDocument } from "@beep/pandoc-ast/Pandoc.model"
 *
 * const document: PandocDocument.Type = PandocDocument.make({ apiVersion: [1, 23, 1], blocks: [], meta: {} })
 * document._tag // => "pandocDocument"
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

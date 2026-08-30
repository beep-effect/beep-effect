import {$ScratchpadId} from "@beep/identity";
import {LiteralKit} from "@beep/schema";
import * as S from "effect/Schema";
import * as HtmlModel from "@beep/html/Html.model";
import {Inline, InlineChildren} from "@beep/md";
import * as Tuple from "effect/Tuple";
import {pipe} from "effect/Function";

const $I = $ScratchpadId.create("exec");

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
export const HeadingLevel = LiteralKit([1, 2, 3, 4, 5, 6]).pipe(
  $I.annoteSchema("HeadingLevel", {
    description: "Markdown heading level from one (largest) to six (smallest).",
  })
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


export const HeadingValue = HeadingLevel.mapMembers((members) => {
  const make = <T extends HeadingLevel>({literal}: S.Literal<T>) => S.Struct({
    level: S.tag(literal),
    children: InlineChildren.annotateKey({
      description: "Inline children rendered as heading content.",
    }),
  });

  return pipe(
    members,
    Tuple.evolve(
      [
        make,
        make,
        make,
        make,
        make,
        make,
      ]
    )
  );
}).pipe(
  S.toTaggedUnion("level"),
  $I.annoteSchema("HeadingValue", {
    description: "Heading value carrying its level alongside inline content.",
  })
);


export type HeadingValue = typeof HeadingValue.Type;

export declare namespace HeadingValue {
  export type Encoded =
    | { level: 1, children: InlineChildren.Encoded }
    | { level: 2, children: InlineChildren.Encoded }
    | { level: 3, children: InlineChildren.Encoded }
    | { level: 4, children: InlineChildren.Encoded }
    | { level: 5, children: InlineChildren.Encoded }
    | { level: 6, children: InlineChildren.Encoded }
}

/**
 * Heading block carrying its level alongside inline content.
 *
 * **Example** (Make heading node)
 *
 * ```ts import.meta.vitest name="Make heading node"
 * import { Heading, Text } from "@beep/md/Md.model"
 *
 * const node = Heading.make({ level: 1, children: [Text.make({ value: "Title" })] })
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
    heading: HeadingValue,
  },
  $I.annote("Heading", {
    description: "Heading block carrying its level alongside inline content.",
  })
) {
  static readonly is = S.is(Heading);

  static readonly toPlainText = (block: Heading): string => Inline.toPlainTextAll(block.heading.children);

  static readonly toHtml = (
    block: Heading
  ): HtmlModel.H1 | HtmlModel.H2 | HtmlModel.H3 | HtmlModel.H4 | HtmlModel.H5 | HtmlModel.H6 => {
    const children = Inline.toHtmlAll(block.heading.children);
    return HeadingValue.match(block.heading, {
      1: () => HtmlModel.H1.make({children}),
      2: () => HtmlModel.H2.make({children}),
      3: () => HtmlModel.H3.make({children}),
      4: () => HtmlModel.H4.make({children}),
      5: () => HtmlModel.H5.make({children}),
      6: () => HtmlModel.H6.make({children}),
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
  export interface Encoded {
    readonly _tag: "heading";
    readonly heading: HeadingValue.Encoded;
  }
}

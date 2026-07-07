/**
 * Dockview data models
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { P } from "@beep/utils";
import * as Thunk from "@beep/schema/Thunk";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("dockview/Dockview.models");

export const FunctionOrValue = <const TSchema extends S.Top>(schema: TSchema) =>
  S.Union([Thunk.make((u: unknown): u is () => S.Schema.Type<TSchema> => P.isFunction(u), schema), schema]);

export type FunctionOrValue<TSchema extends S.Top> =
  | (() => S.Schema.Type<TSchema>)
  | S.Schema.Type<TSchema>;

export declare namespace FunctionOrValue {
  export type Instance<TSchema extends S.Top> = ReturnType<typeof FunctionOrValue<TSchema>>;
}

export class Box extends S.Class<Box>($I`Box`)(
  {
    height: S.Finite,
    left: S.Finite,
    top: S.Finite,
    width: S.Finite,
  },
  $I.annote("Box", {
    description: "A box is a container for a value",
  })
) {}

export class TopLeft extends S.TaggedClass<TopLeft>($I`TopLeft`)(
  "TopLeft",
  {
    left: S.Finite,
    top: S.Finite,
  },
  $I.annote("TopLeft", {
    description: "Top left position",
  })
) {}

export class TopRight extends S.TaggedClass<TopRight>($I`TopRight`)(
  "TopRight",
  {
    right: S.Finite,
    top: S.Finite,
  },
  $I.annote("TopRight", {
    description: "Top right position",
  })
) {}

export class BottomLeft extends S.TaggedClass<BottomLeft>($I`BottomLeft`)(
  "BottomLeft",
  {
    bottom: S.Finite,
    left: S.Finite,
  },
  $I.annote("BottomLeft", {
    description: "Bottom left position",
  })
) {}

export class BottomRight extends S.TaggedClass<BottomRight>($I`BottomRight`)(
  "BottomRight",
  {
    bottom: S.Finite,
    right: S.Finite,
  },
  $I.annote("BottomRight", {
    description: "Bottom right position",
  })
) {}

export const AnchorPosition = S.Union(
  [
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
  ]
).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AnchorPosition", {
    description: "An anchor position",
  })
);

export declare namespace AnchorPosition {
  export type Encoded = typeof AnchorPosition.Encoded;
}

export class Size extends S.Class<Size>($I`Size`)(
  {
    height: S.Finite,
    width: S.Finite,
  },
  $I.annote("Size", {
    description: "A size is a container for a value",
  })
) {}

export const AnchoredBox = S.Union(
  [
    S.Struct({
      _tag: S.tagDefaultOmit("TopLeft"),
      left: TopLeft.fields.left,
      top: TopLeft.fields.top,
      ...Size.fields,
    }),
    S.Struct({
      _tag: S.tagDefaultOmit("TopRight"),
      right: TopRight.fields.right,
      top: TopRight.fields.top,
      ...Size.fields,
    }),
    S.Struct({
      _tag: S.tagDefaultOmit("BottomLeft"),
      bottom: BottomLeft.fields.bottom,
      left: BottomLeft.fields.left,
      ...Size.fields,
    }),
    S.Struct({
      _tag: S.tagDefaultOmit("BottomRight"),
      bottom: BottomRight.fields.bottom,
      right: BottomRight.fields.right,
      ...Size.fields,
    }),
  ]
).pipe(
  $I.annoteSchema("AnchoredBox", {
    description: "An anchored box",
  })
);

export declare namespace AnchoredBox {
  export type Encoded = typeof AnchoredBox.Encoded;
}

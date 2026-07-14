/** Serializable anchored floating-window geometry. */
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("dockview/poc/AnchoredBox");

export class TopLeft extends S.TaggedClass<TopLeft>($I`TopLeft`)(
  "TopLeft",
  { left: S.Finite, top: S.Finite },
  $I.annote("TopLeft", { description: "Top-left anchored position." })
) {}

export class TopRight extends S.TaggedClass<TopRight>($I`TopRight`)(
  "TopRight",
  { right: S.Finite, top: S.Finite },
  $I.annote("TopRight", { description: "Top-right anchored position." })
) {}

export class BottomLeft extends S.TaggedClass<BottomLeft>($I`BottomLeft`)(
  "BottomLeft",
  { bottom: S.Finite, left: S.Finite },
  $I.annote("BottomLeft", { description: "Bottom-left anchored position." })
) {}

export class BottomRight extends S.TaggedClass<BottomRight>($I`BottomRight`)(
  "BottomRight",
  { bottom: S.Finite, right: S.Finite },
  $I.annote("BottomRight", { description: "Bottom-right anchored position." })
) {}

export class AnchoredSize extends S.Class<AnchoredSize>($I`AnchoredSize`)(
  { height: S.Finite, width: S.Finite },
  $I.annote("AnchoredSize", { description: "Floating box extent." })
) {}

export class TopLeftAnchoredBox extends AnchoredSize.extend<TopLeftAnchoredBox>($I`TopLeftAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("TopLeft"),
    left: TopLeft.fields.left,
    top: TopLeft.fields.top,
  },
  $I.annote("TopLeftAnchoredBox", { description: "Top-left anchored position." })
) {}

export class TopRightAnchoredBox extends AnchoredSize.extend<TopRightAnchoredBox>($I`TopRightAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("TopRight"),
    right: TopRight.fields.right,
    top: TopRight.fields.top,
  },
  $I.annote("TopRightAnchoredBox", { description: "Top-left anchored position." })
) {}

export class BottomRightAnchoredBox extends AnchoredSize.extend<BottomRightAnchoredBox>($I`BottomRightAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("BottomRight"),
    bottom: BottomRight.fields.bottom,
    right: BottomRight.fields.right,
  },
  $I.annote("BottomRightAnchoredBox", { description: "Bottom-left anchored position." })
) {}

export class BottomLeftAnchoredBox extends AnchoredSize.extend<BottomLeftAnchoredBox>($I`BottomLeftAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("BottomLeft"),
    bottom: BottomLeft.fields.bottom,
    left: BottomLeft.fields.left,
  },
  $I.annote("BottomLeftAnchoredBox", { description: "Bottom-left anchored position." })
) {}

/** Current tagged codec that also decodes dockview's legacy untagged position shape. */
export const AnchoredBox = S.Union([
  TopLeftAnchoredBox,
  TopRightAnchoredBox,
  BottomLeftAnchoredBox,
  BottomRightAnchoredBox,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AnchoredBox", { description: "A legacy-tolerant anchored floating box." })
);
export type AnchoredBox = typeof AnchoredBox.Type;
export declare namespace AnchoredBox {
  export type Encoded = typeof AnchoredBox.Encoded;
}

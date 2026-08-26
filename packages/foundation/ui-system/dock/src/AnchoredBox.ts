/**
 * Serializable anchored floating-window geometry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DockId.create("AnchoredBox");

/**
 * Coordinates a floating box from the container's top-left corner.
 *
 * **Example** (Make TopLeft coordinates)
 *
 * ```ts import.meta.vitest name="Make TopLeft coordinates"
 * import { TopLeft } from "@beep/dock"
 *
 * const anchor = TopLeft.make({ left: 24, top: 16 })
 * anchor._tag // => "TopLeft"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TopLeft extends S.TaggedClass<TopLeft>($I`TopLeft`)(
  "TopLeft",
  { left: S.Finite, top: S.Finite },
  $I.annote("TopLeft", { description: "Top-left anchored position." })
) {}

/**
 * Coordinates a floating box from the container's top-right corner.
 *
 * **Example** (Make TopRight coordinates)
 *
 * ```ts import.meta.vitest name="Make TopRight coordinates"
 * import { TopRight } from "@beep/dock"
 *
 * const anchor = TopRight.make({ right: 24, top: 16 })
 * anchor.right // => 24
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TopRight extends S.TaggedClass<TopRight>($I`TopRight`)(
  "TopRight",
  { right: S.Finite, top: S.Finite },
  $I.annote("TopRight", { description: "Top-right anchored position." })
) {}

/**
 * Coordinates a floating box from the container's bottom-left corner.
 *
 * **Example** (Make BottomLeft coordinates)
 *
 * ```ts import.meta.vitest name="Make BottomLeft coordinates"
 * import { BottomLeft } from "@beep/dock"
 *
 * const anchor = BottomLeft.make({ bottom: 12, left: 20 })
 * anchor.bottom // => 12
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class BottomLeft extends S.TaggedClass<BottomLeft>($I`BottomLeft`)(
  "BottomLeft",
  { bottom: S.Finite, left: S.Finite },
  $I.annote("BottomLeft", { description: "Bottom-left anchored position." })
) {}

/**
 * Coordinates a floating box from the container's bottom-right corner.
 *
 * **Example** (Make BottomRight coordinates)
 *
 * ```ts import.meta.vitest name="Make BottomRight coordinates"
 * import { BottomRight } from "@beep/dock"
 *
 * const anchor = BottomRight.make({ bottom: 12, right: 20 })
 * anchor._tag // => "BottomRight"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class BottomRight extends S.TaggedClass<BottomRight>($I`BottomRight`)(
  "BottomRight",
  { bottom: S.Finite, right: S.Finite },
  $I.annote("BottomRight", { description: "Bottom-right anchored position." })
) {}

/**
 * Width and height shared by every anchored floating box.
 *
 * **Example** (Make width and height)
 *
 * ```ts import.meta.vitest name="Make width and height"
 * import { AnchoredSize } from "@beep/dock"
 *
 * const size = AnchoredSize.make({ width: 640, height: 480 })
 * size.width // => 640
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class AnchoredSize extends S.Class<AnchoredSize>($I`AnchoredSize`)(
  { height: S.Finite, width: S.Finite },
  $I.annote("AnchoredSize", { description: "Floating box extent." })
) {}

/**
 * A sized floating box anchored from the top-left corner.
 *
 * **Example** (Make top-left sized box)
 *
 * ```ts import.meta.vitest name="Make top-left sized box"
 * import { TopLeftAnchoredBox } from "@beep/dock"
 *
 * const box = TopLeftAnchoredBox.make({ left: 20, top: 12, width: 640, height: 480 })
 * box._tag // => "TopLeft"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TopLeftAnchoredBox extends AnchoredSize.extend<TopLeftAnchoredBox>($I`TopLeftAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("TopLeft"),
    left: TopLeft.fields.left,
    top: TopLeft.fields.top,
  },
  $I.annote("TopLeftAnchoredBox", { description: "Top-left anchored position." })
) {}

/**
 * A sized floating box anchored from the top-right corner.
 *
 * **Example** (Make top-right sized box)
 *
 * ```ts import.meta.vitest name="Make top-right sized box"
 * import { TopRightAnchoredBox } from "@beep/dock"
 *
 * const box = TopRightAnchoredBox.make({ right: 20, top: 12, width: 640, height: 480 })
 * box.right // => 20
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class TopRightAnchoredBox extends AnchoredSize.extend<TopRightAnchoredBox>($I`TopRightAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("TopRight"),
    right: TopRight.fields.right,
    top: TopRight.fields.top,
  },
  $I.annote("TopRightAnchoredBox", { description: "Top-left anchored position." })
) {}

/**
 * A sized floating box anchored from the bottom-right corner.
 *
 * **Example** (Make bottom-right sized box)
 *
 * ```ts import.meta.vitest name="Make bottom-right sized box"
 * import { BottomRightAnchoredBox } from "@beep/dock"
 *
 * const box = BottomRightAnchoredBox.make({ bottom: 12, right: 20, width: 640, height: 480 })
 * box.bottom // => 12
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class BottomRightAnchoredBox extends AnchoredSize.extend<BottomRightAnchoredBox>($I`BottomRightAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("BottomRight"),
    bottom: BottomRight.fields.bottom,
    right: BottomRight.fields.right,
  },
  $I.annote("BottomRightAnchoredBox", { description: "Bottom-left anchored position." })
) {}

/**
 * A sized floating box anchored from the bottom-left corner.
 *
 * **Example** (Make bottom-left sized box)
 *
 * ```ts import.meta.vitest name="Make bottom-left sized box"
 * import { BottomLeftAnchoredBox } from "@beep/dock"
 *
 * const box = BottomLeftAnchoredBox.make({ bottom: 12, left: 20, width: 640, height: 480 })
 * box.left // => 20
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class BottomLeftAnchoredBox extends AnchoredSize.extend<BottomLeftAnchoredBox>($I`BottomLeftAnchoredBox`)(
  {
    _tag: S.tagDefaultOmit("BottomLeft"),
    bottom: BottomLeft.fields.bottom,
    left: BottomLeft.fields.left,
  },
  $I.annote("BottomLeftAnchoredBox", { description: "Bottom-left anchored position." })
) {}

/**
 * Codec for current tagged and legacy untagged anchored-box shapes.
 *
 * **Example** (Decode untagged top-left box)
 *
 * ```ts import.meta.vitest name="Decode untagged top-left box"
 * import { AnchoredBox } from "@beep/dock"
 * import * as S from "effect/Schema"
 *
 * const box = S.decodeUnknownSync(AnchoredBox)({
 *   left: 20,
 *   top: 12,
 *   width: 640,
 *   height: 480
 * })
 * box._tag // => "TopLeft"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const AnchoredBox = S.Union([
  TopLeftAnchoredBox,
  TopRightAnchoredBox,
  BottomLeftAnchoredBox,
  BottomRightAnchoredBox,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AnchoredBox", { description: "A legacy-tolerant anchored floating box." })
);
/**
 * Decoded anchored floating-box value.
 *
 * **Example** (Type a top-left box)
 *
 * ```ts import.meta.vitest name="Type a top-left box"
 * import { AnchoredBox, TopLeftAnchoredBox } from "@beep/dock"
 *
 * const box: AnchoredBox = TopLeftAnchoredBox.make({
 *   left: 20,
 *   top: 12,
 *   width: 640,
 *   height: 480
 * })
 * box._tag // => "TopLeft"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type AnchoredBox = typeof AnchoredBox.Type;
/**
 * Type helpers associated with the anchored-box codec.
 *
 * **Example** (Declare encoded TopLeft shape)
 *
 * ```ts import.meta.vitest name="Declare encoded TopLeft shape"
 * import type { AnchoredBox } from "@beep/dock"
 *
 * const encoded: AnchoredBox.Encoded = {
 *   _tag: "TopLeft",
 *   left: 20,
 *   top: 12,
 *   width: 640,
 *   height: 480
 * }
 * encoded._tag // => "TopLeft"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace AnchoredBox {
  /**
   * Encoded representation accepted and emitted by {@link AnchoredBox}.
   *
   * **Example** (Declare encoded BottomRight shape)
   *
   * ```ts import.meta.vitest name="Declare encoded BottomRight shape"
   * import type { AnchoredBox } from "@beep/dock"
   *
   * const encoded: AnchoredBox.Encoded = {
   *   _tag: "BottomRight",
   *   bottom: 12,
   *   right: 20,
   *   width: 640,
   *   height: 480
   * }
   * encoded.width // => 640
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof AnchoredBox.Encoded;
}

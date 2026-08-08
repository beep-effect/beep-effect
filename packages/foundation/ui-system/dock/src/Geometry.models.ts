/**
 * Pure pixel geometry projections for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Number as N, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { GroupId, SplitId } from "./Dock.ids.ts";
import type { AnchoredBox } from "./AnchoredBox.ts";

const $I = $DockId.create("Dock.geometry");

type Dual2<Self, That, Result> = {
  (self: Self, that: That): Result;
  (that: That): (self: Self) => Result;
};

/**
 * Codec for finite non-negative pixel coordinates and extents.
 *
 * **Example** (Read constructed box width)
 *
 * ```ts
 * import { DockBox } from "@beep/dock"
 *
 * const width = DockBox.make({ width: 640 }).width
 * console.log(width)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const Extent = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("Extent", { description: "A finite non-negative pixel coordinate or extent." })
);

/**
 * Finite non-negative rectangle in host pixel coordinates.
 *
 * **Details**
 *
 * Missing constructor fields default to zero, representing an
 * unmeasured host container before its first resize observation.
 *
 * **Example** (Construct positioned rectangle)
 *
 * ```ts
 * import { DockBox } from "@beep/dock"
 *
 * const box = DockBox.make({ left: 10, top: 20, width: 640, height: 480 })
 * console.log(box.width)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockBox extends S.Class<DockBox>($I`DockBox`)(
  {
    left: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    top: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    width: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    height: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
  },
  $I.annote("DockBox", { description: "A finite non-negative rectangle in host pixel coordinates." })
) {}

/**
 * Projected rectangle for one tab group.
 *
 * **Example** (Create group geometry)
 *
 * ```ts
 * import { DockBox, GroupGeometry, GroupId } from "@beep/dock"
 *
 * const geometry = GroupGeometry.make({ groupId: GroupId.make("group-one"), box: DockBox.make({ width: 640, height: 480 }) })
 * console.log(geometry.groupId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroupGeometry extends S.Class<GroupGeometry>($I`GroupGeometry`)(
  { groupId: S.toType(GroupId), box: DockBox },
  $I.annote("GroupGeometry", { description: "The projected pixel rectangle for one tab group." })
) {}

/**
 * Projected hit rectangle for one binary split sash.
 *
 * **Example** (Create horizontal sash geometry)
 *
 * ```ts
 * import { DockBox, SashGeometry, SplitId } from "@beep/dock"
 *
 * const sash = SashGeometry.make({ splitId: SplitId.make("split-one"), axis: "horizontal", box: DockBox.make({ left: 320, width: 8, height: 480 }) })
 * console.log(sash.axis)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SashGeometry extends S.Class<SashGeometry>($I`SashGeometry`)(
  { splitId: S.toType(SplitId), axis: LiteralKit(["horizontal", "vertical"]), box: DockBox },
  $I.annote("SashGeometry", { description: "A split gap hit rectangle, optionally expanded for grabbing." })
) {}

/**
 * Geometry for one floating subtree in z-order.
 *
 * **Example** (Create empty floating geometry)
 *
 * ```ts
 * import { DockBox, FloatingGeometry } from "@beep/dock"
 *
 * const geometry = FloatingGeometry.make({ box: DockBox.make({ width: 640, height: 480 }), groups: [], sashes: [] })
 * console.log(geometry.groups.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FloatingGeometry extends S.Class<FloatingGeometry>($I`FloatingGeometry`)(
  { box: DockBox, groups: S.Array(GroupGeometry), sashes: S.Array(SashGeometry) },
  $I.annote("FloatingGeometry", { description: "One floating subtree projection in z-order." })
) {}

/**
 * Complete renderer-facing dock geometry projection.
 *
 * **Example** (Use empty dock geometry)
 *
 * ```ts
 * import { DockGeometry } from "@beep/dock"
 *
 * const geometry = DockGeometry.empty
 * console.log(geometry.groups.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockGeometry extends S.Class<DockGeometry>($I`DockGeometry`)(
  {
    groups: S.Array(GroupGeometry),
    sashes: S.Array(SashGeometry),
    floating: S.Array(FloatingGeometry).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<FloatingGeometry>>([])),
  },
  $I.annote("DockGeometry", { description: "Ordered leaf rectangles and split sash hit rectangles." })
) {
  static readonly empty = DockGeometry.make({ groups: [], sashes: [] });

  static readonly forGroup: Dual2<DockGeometry, GroupId, O.Option<DockBox>> = dual(
    2,
    (geometry: DockGeometry, groupId: GroupId): O.Option<DockBox> =>
      pipe(
        geometry.groups,
        A.findFirst((group) => GroupId.equals(group.groupId, groupId)),
        O.map((group) => group.box)
      )
  );
}

const minimumFloatingExtent = 32;

/**
 * Resolves and clamps anchored geometry inside a host container.
 *
 * **Example** (Resolve top-right anchored box)
 *
 * ```ts
 * import { DockBox, TopRightAnchoredBox, resolveAnchoredBox } from "@beep/dock"
 *
 * const box = resolveAnchoredBox(TopRightAnchoredBox.make({ right: 10, top: 20, width: 300, height: 200 }), DockBox.make({ width: 800, height: 600 }))
 * console.log(box.left)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const resolveAnchoredBox: Dual2<AnchoredBox, DockBox, DockBox> = dual(
  2,
  (anchoredBox: AnchoredBox, container: DockBox): DockBox => {
    const width = N.min(container.width, N.max(minimumFloatingExtent, anchoredBox.width));
    const height = N.min(container.height, N.max(minimumFloatingExtent, anchoredBox.height));
    const rawLeft =
      anchoredBox._tag === "TopLeft" || anchoredBox._tag === "BottomLeft"
        ? N.sum(container.left, anchoredBox.left)
        : N.subtract(N.sum(container.left, container.width), N.sum(anchoredBox.right, width));
    const rawTop =
      anchoredBox._tag === "TopLeft" || anchoredBox._tag === "TopRight"
        ? N.sum(container.top, anchoredBox.top)
        : N.subtract(N.sum(container.top, container.height), N.sum(anchoredBox.bottom, height));
    return DockBox.make({
      left: N.clamp(rawLeft, {
        minimum: container.left,
        maximum: N.subtract(N.sum(container.left, container.width), width),
      }),
      top: N.clamp(rawTop, {
        minimum: container.top,
        maximum: N.subtract(N.sum(container.top, container.height), height),
      }),
      width,
      height,
    });
  }
);

/**
 * Options for gaps, sash hit targets, and leaf minima.
 *
 * **Example** (Set gap and sash thickness)
 *
 * ```ts
 * import { GeometryOptions } from "@beep/dock"
 *
 * const options = GeometryOptions.make({ gap: 3, minSashThickness: 9 })
 * console.log(options.gap)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeometryOptions extends S.Class<GeometryOptions>($I`GeometryOptions`)(
  {
    gap: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    minSashThickness: Extent.pipe(SchemaUtils.withConstantDefault<number>(8)),
    minGroupExtent: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
  },
  $I.annote("GeometryOptions", {
    description:
      "Gap, minimum sash hit thickness, and global per-leaf minimum extent for geometry projection. minGroupExtent is the floor under every visible leaf; each split clamps between the requiredExtent of its two subtrees (leaf minimums sum through same-axis splits plus gaps, max across cross-axis splits), and an infeasible split degrades to the unclamped proportional partition.",
  })
) {}

/**
 * Function resolving a pixel minimum for a group.
 *
 * **Example** (Lookup minimum by group)
 *
 * ```ts
 * import { GroupId } from "@beep/dock"
 * import type { GroupMinimumLookup } from "@beep/dock"
 *
 * const minimum: GroupMinimumLookup = (groupId) => groupId === GroupId.make("group-one") ? 120 : 0
 * console.log(minimum(GroupId.make("group-one")))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GroupMinimumLookup = (groupId: GroupId) => number;

/**
 * Serializable group-id to pixel-minimum record.
 *
 * **Example** (Define group minima map)
 *
 * ```ts
 * import type { GroupMinimaRecord } from "@beep/dock"
 *
 * const minima: GroupMinimaRecord = { "group-one": 120 }
 * console.log(minima["group-one"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GroupMinimaRecord = Readonly<Record<string, number>>;

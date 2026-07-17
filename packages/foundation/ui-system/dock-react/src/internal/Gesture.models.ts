import { AnchoredBox, DockBox, GroupId, PanelId, SplitId, SplitRatio } from "@beep/dock";
import { $DockReactId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $DockReactId.create("Gesture.models");

export class PointerPosition extends S.Class<PointerPosition>($I`PointerPosition`)(
  {
    left: S.Finite,
    top: S.Finite,
  },
  $I.annote("PointerPosition", {
    description: "Finite client-space coordinates captured from a pointer event.",
  })
) {}

export class TabDrag extends S.Class<TabDrag>($I`TabDrag`)(
  {
    panelId: PanelId,
    fromGroupId: GroupId,
    pointer: PointerPosition,
  },
  $I.annote("TabDrag", {
    description: "Active tab-drag state, including its source group and latest pointer position.",
  })
) {}

export class SashDragBase extends S.Class<SashDragBase>($I`SashDragBase`)(
  {
    splitId: SplitId,
    start: PointerPosition,
    initialRatio: SplitRatio,
    extent: S.Finite,
    moved: S.Boolean,
  },
  $I.annote("SashDragBase", {
    description: "Shared state captured while resizing a split sash.",
  })
) {}

export class SashDragHorizontal extends SashDragBase.extend<SashDragHorizontal>($I`SashDragHorizontal`)(
  {
    axis: S.tag("horizontal"),
  },
  $I.annote("SashDragHorizontal", {
    description: "Sash-resize gesture whose pointer delta is measured horizontally.",
  })
) {}

export class SashDragVertical extends SashDragBase.extend<SashDragVertical>($I`SashDragVertical`)(
  {
    axis: S.tag("vertical"),
  },
  $I.annote("SashDragVertical", {
    description: "Sash-resize gesture whose pointer delta is measured vertically.",
  })
) {}

export const SashDrag = S.Union([SashDragHorizontal, SashDragVertical]).pipe(
  S.toTaggedUnion("axis"),
  $I.annoteSchema("SashDrag", {
    description: "Axis-discriminated state for an in-progress split-sash resize gesture.",
  })
);
export type SashDrag = typeof SashDrag.Type;

export class RatioOverride extends S.Class<RatioOverride>($I`RatioOverride`)(
  {
    splitId: SplitId,
    ratio: SplitRatio,
  },
  $I.annote("RatioOverride", {
    description: "Transient split-ratio preview applied while a sash is moving.",
  })
) {}

export class FloatingGestureBase extends S.Class<FloatingGestureBase>($I`FloatingGestureBase`)(
  {
    groupId: GroupId,
    start: PointerPosition,
    initial: AnchoredBox,
    initialBox: DockBox,
    moved: S.Boolean,
  },
  $I.annote("FloatingGestureBase", {
    description: "Shared pointer and geometry state for moving or resizing a floating group.",
  })
) {}

export class FloatingGestureMove extends FloatingGestureBase.extend<FloatingGestureMove>($I`FloatingGestureMove`)(
  {
    mode: S.tag("move"),
  },
  $I.annote("FloatingGestureMove", {
    description: "Gesture state for translating a floating group.",
  })
) {}

export class FloatingGestureResize extends FloatingGestureBase.extend<FloatingGestureResize>($I`FloatingGestureResize`)(
  {
    mode: S.tag("resize"),
  },
  $I.annote("FloatingGestureResize", {
    description: "Gesture state for resizing a floating group.",
  })
) {}

export const FloatingGesture = S.Union([FloatingGestureMove, FloatingGestureResize]).pipe(
  S.toTaggedUnion("mode"),
  $I.annoteSchema("FloatingGesture", {
    description: "Mode-discriminated gesture state for a floating dock group.",
  })
);

export type FloatingGesture = typeof FloatingGesture.Type;

export class FloatingOverride extends S.Class<FloatingOverride>($I`FloatingOverride`)(
  {
    groupId: GroupId,
    anchoredBox: AnchoredBox,
  },
  $I.annote("FloatingOverride", {
    description: "Transient anchored-box preview for a floating dock group.",
  })
) {}

import {
  DockBox,
  DockMoveTarget,
  DockNode,
  DockSide,
  DockWorkspace,
  GroupId,
  MovePanelCommand as MovePanelCommandSchema,
  RootSplitPlacement,
  SplitId,
  SplitLayout,
  SplitPlacement,
  SplitRatio,
  TabPlacement,
  TabsNode,
  TopLeftAnchoredBox,
} from "@beep/dock";
import { NonNegativeInt } from "@beep/schema";
import { Match, Number as N, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { commandCounter } from "./AdapterState.ts";
import type { AnchoredBox, DockGeometry, MovePanelCommand, SplitNode } from "@beep/dock";
import type { Dual2, Dual3 } from "@beep/dock/internal/Dual";
import type React from "react";
import type { DockAtomGraph } from "../DockReact.types.ts";
import type { AdapterState } from "./AdapterState.ts";
import type { PointerPosition, TabDrag } from "./Gesture.models.ts";

export const boxStyle = (box: DockBox): React.CSSProperties => ({
  position: "absolute",
  left: box.left,
  top: box.top,
  width: box.width,
  height: box.height,
});

export const positionOf = (event: PointerEvent): PointerPosition => ({
  left: event.clientX,
  top: event.clientY,
});

// Drag pointers must live in the dock root's coordinate space: geometry
// boxes are container-relative (the container box is measured 0-based), so
// hit-testing raw client coordinates mis-targets every group by the root's
// viewport offset — invisibly while nothing sits beyond the offset, then a
// full nav-height off once groups stack vertically (QA finding R1-01).
export const relativePositionOf: Dual2<AdapterState, PointerEvent, PointerPosition> = dual(
  2,
  (state: AdapterState, event: PointerEvent): PointerPosition => {
    const root = state.rootNode.current;
    if (P.isNull(root)) return positionOf(event);
    const rect = root.getBoundingClientRect();
    return { left: event.clientX - rect.left, top: event.clientY - rect.top };
  }
);
// Presses on chrome buttons inside a gesture surface must not start a
// drag/move: native pointer capture would retarget the release and swallow
// the button's click (native capture beats React-level stopPropagation).
export const pressStartsOnButton = (event: PointerEvent): boolean =>
  event.target instanceof Element && P.isNotNull(event.target.closest("button"));

// A press only promotes to a drag once the pointer travels past this radius
// (dockview's PointerDragSource threshold): taps and plain clicks never show
// drag chrome (ghost, drop indicator) or compile a drop.
const DRAG_THRESHOLD = 5;
const ROOT_EDGE_BAND_PX = 8;
export const exceedsDragThreshold: Dual2<PointerPosition, PointerPosition, boolean> = dual(
  2,
  (origin: PointerPosition, pointer: PointerPosition): boolean => {
    const dx = pointer.left - origin.left;
    const dy = pointer.top - origin.top;
    return dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD;
  }
);

const contains = (box: DockBox, point: PointerPosition): boolean =>
  point.left >= box.left &&
  point.left <= box.left + box.width &&
  point.top >= box.top &&
  point.top <= box.top + box.height;
export const clampRatio = (ratio: number): SplitRatio =>
  SplitRatio.make(Math.min(9_000, Math.max(1_000, Math.round(ratio))));
export const freshSplitId = (): SplitId => SplitId.make(`dockview-react-split-${commandCounter + 1}`);
export const freshGroupId = (): GroupId => GroupId.make(`dockview-react-group-${commandCounter + 1}`);
export const freshFloatingSplitId = (): SplitId => SplitId.make(`dockview-react-floating-split-${commandCounter + 1}`);
export const topLeftBox: Dual2<DockBox, DockBox, AnchoredBox> = dual(2, (box: DockBox, container: DockBox) =>
  TopLeftAnchoredBox.make({
    left: box.left - container.left,
    top: box.top - container.top,
    width: box.width,
    height: box.height,
  })
);

const floatingHit = (geometry: DockGeometry, point: PointerPosition) =>
  A.findFirst(A.reverse(geometry.floating), (candidate) => contains(candidate.box, point));

const groupBox = (geometry: DockGeometry, groupId: GroupId): O.Option<DockBox> =>
  pipe(
    A.findFirst(geometry.groups, (candidate) => GroupId.equals(candidate.groupId, groupId)),
    O.map((candidate) => candidate.box),
    O.orElse(() =>
      pipe(
        geometry.floating,
        A.findFirst((member) => A.some(member.groups, (candidate) => GroupId.equals(candidate.groupId, groupId))),
        O.flatMap((member) =>
          pipe(
            member.groups,
            A.findFirst((candidate) => GroupId.equals(candidate.groupId, groupId)),
            O.map((candidate) => candidate.box)
          )
        )
      )
    )
  );

const splitPreviewBox = (box: DockBox, side: DockSide, ratio: SplitRatio): DockBox => {
  const share = N.divideUnsafe(ratio, 10_000);
  return DockSide.$match(side, {
    left: () => DockBox.make({ ...box, width: N.multiply(box.width, share) }),
    right: () => {
      const width = N.multiply(box.width, share);
      return DockBox.make({ ...box, left: N.sum(box.left, N.subtract(box.width, width)), width });
    },
    top: () => DockBox.make({ ...box, height: N.multiply(box.height, share) }),
    bottom: () => {
      const height = N.multiply(box.height, share);
      return DockBox.make({ ...box, top: N.sum(box.top, N.subtract(box.height, height)), height });
    },
  });
};

export const compileDrop: Dual3<AdapterState, DockAtomGraph, TabDrag, O.Option<MovePanelCommand>> = dual(
  3,
  (state: AdapterState, graph: DockAtomGraph, drag: TabDrag): O.Option<MovePanelCommand> => {
    const geometry = graph.registry.get(state.geometry.geometryAtom);
    const container = graph.registry.get(state.containerAtom);
    const point = drag.pointer;
    // A thin strip: any wider and the root band shadows the bottom/right
    // quadrant of every edge-adjacent group, so hovers aimed at a group's
    // own edge compile to a container-spanning root split (QA finding: the
    // bottom drop preview spanned both panels instead of the target group).
    const outer = Math.min(ROOT_EDGE_BAND_PX, Math.min(container.width, container.height) / 6);
    const rootSide: O.Option<DockSide> = Match.value(point).pipe(
      Match.when(
        ({ left }) => left <= container.left + outer,
        () => O.some(DockSide.Enum.left)
      ),
      Match.when(
        ({ left }) => left >= container.left + container.width - outer,
        () => O.some(DockSide.Enum.right)
      ),
      Match.when(
        ({ top }) => top <= container.top + outer,
        () => O.some(DockSide.Enum.top)
      ),
      Match.when(
        ({ top }) => top >= container.top + container.height - outer,
        () => O.some(DockSide.Enum.bottom)
      ),
      Match.orElse(O.none<DockSide>)
    );
    const floating = floatingHit(geometry, point);
    const group = O.match(floating, {
      onNone: () => A.findFirst(geometry.groups, (candidate) => contains(candidate.box, point)),
      onSome: (member) => A.findFirst(member.groups, (candidate) => contains(candidate.box, point)),
    });
    if (O.isSome(group)) {
      const tabs = graph.registry.get(graph.tabsAtom(group.value.groupId));
      const headerHeight = Math.min(32, group.value.box.height);
      if (point.top <= group.value.box.top + headerHeight && O.isSome(tabs)) {
        const count = A.length(TabsNode.panels(tabs.value));
        const rawIndex =
          group.value.box.width <= 0
            ? 0
            : Math.floor(((point.left - group.value.box.left) / group.value.box.width) * count);
        const index = NonNegativeInt.make(Math.min(count, Math.max(0, rawIndex)));
        return O.some(
          MovePanelCommandSchema.make({
            panelId: drag.panelId,
            target: TabPlacement.make({
              groupId: group.value.groupId,
              index: O.some(index),
            }),
          })
        );
      }
    }
    if (O.isNone(floating) && O.isSome(rootSide)) {
      return O.some(
        MovePanelCommandSchema.make({
          panelId: drag.panelId,
          target: RootSplitPlacement.make({
            side: rootSide.value,
            splitId: freshSplitId(),
            newGroupId: freshGroupId(),
          }),
        })
      );
    }
    if (O.isNone(group)) return O.none();
    const { box, groupId } = group.value;
    const headerHeight = Math.min(32, box.height);
    const contentTop = box.top + headerHeight;
    const contentHeight = Math.max(0, box.height - headerHeight);
    const x = point.left - box.left;
    const y = point.top - contentTop;
    const edgeX = box.width * 0.25;
    const edgeY = contentHeight * 0.25;
    const side: O.Option<DockSide> = Match.value({ x, y }).pipe(
      Match.when(
        ({ x }) => x <= edgeX,
        () => O.some(DockSide.Enum.left)
      ),
      Match.when(
        ({ x }) => x >= box.width - edgeX,
        () => O.some(DockSide.Enum.right)
      ),
      Match.when(
        ({ y }) => y <= edgeY,
        () => O.some(DockSide.Enum.top)
      ),
      Match.when(
        ({ y }) => y >= contentHeight - edgeY,
        () => O.some(DockSide.Enum.bottom)
      ),
      Match.orElse(O.none<DockSide>)
    );
    if (O.isSome(side)) {
      return O.some(
        MovePanelCommandSchema.make({
          panelId: drag.panelId,
          target: SplitPlacement.make({
            referenceGroupId: groupId,
            newGroupId: freshGroupId(),
            splitId: freshSplitId(),
            side: side.value,
          }),
        })
      );
    }
    return GroupId.equals(groupId, drag.fromGroupId)
      ? O.none()
      : O.some(
          MovePanelCommandSchema.make({
            panelId: drag.panelId,
            target: TabPlacement.make({ groupId }),
          })
        );
  }
);

export const dropPreviewBox: Dual3<AdapterState, DockAtomGraph, TabDrag, O.Option<DockBox>> = dual(
  3,
  (state: AdapterState, graph: DockAtomGraph, drag: TabDrag): O.Option<DockBox> =>
    pipe(
      compileDrop(state, graph, drag),
      O.flatMap(({ target }) => {
        const geometry = graph.registry.get(state.geometry.geometryAtom);
        return DockMoveTarget.match(target, {
          tab: ({ groupId }) => groupBox(geometry, groupId),
          split: ({ referenceGroupId, side, newGroupRatio }) =>
            O.map(groupBox(geometry, referenceGroupId), (box) => splitPreviewBox(box, side, newGroupRatio)),
          rootSplit: ({ side, newGroupRatio }) =>
            O.some(splitPreviewBox(graph.registry.get(state.containerAtom), side, newGroupRatio)),
        });
      })
    )
);

const isTabsWithId = (node: DockNode, groupId: GroupId): boolean =>
  DockNode.match(node, {
    Tabs: (tabs) => GroupId.equals(tabs.groupId, groupId),
    Split: () => false,
  });

const firstTabsGroupId = (node: DockNode): O.Option<GroupId> =>
  O.map(A.head(DockNode.tabs(node)), (tabs) => tabs.groupId);

const findSplitContext = (node: DockNode, groupId: GroupId): O.Option<PreFloatContext> =>
  DockNode.match(node, {
    Tabs: O.none<PreFloatContext>,
    Split: ({ layout }) => {
      const [first, second] = SplitLayout.children(layout);
      const [firstSide, secondSide, ratio] = SplitLayout.match(layout, {
        horizontal: ({ leftRatio }) => [DockSide.Enum.left, DockSide.Enum.right, leftRatio] as const,
        vertical: ({ topRatio }) => [DockSide.Enum.top, DockSide.Enum.bottom, topRatio] as const,
      });
      if (isTabsWithId(first, groupId)) {
        return O.map(firstTabsGroupId(second), (referenceGroupId) => ({
          referenceGroupId,
          side: firstSide,
          ratio: Number(ratio),
        }));
      }
      if (isTabsWithId(second, groupId)) {
        return O.map(firstTabsGroupId(first), (referenceGroupId) => ({
          referenceGroupId,
          side: secondSide,
          ratio: 10_000 - Number(ratio),
        }));
      }
      return O.orElse(findSplitContext(first, groupId), () => findSplitContext(second, groupId));
    },
  });

/**
 * The split context a group occupied before floating: its neighbor, which
 * side of that neighbor it sat on, and its share of the split. Recorded at
 * Float time so Dock restores the pane where it came from instead of
 * forcing a root-right column (QA finding R1-03).
 */
interface PreFloatContext {
  readonly ratio: number;
  readonly referenceGroupId: GroupId;
  readonly side: DockSide;
}

export const preFloatContextFor: Dual2<DockWorkspace, GroupId, O.Option<PreFloatContext>> = dual(
  2,
  (workspace: DockWorkspace, groupId: GroupId): O.Option<PreFloatContext> =>
    DockWorkspace.match(workspace, {
      empty: O.none<PreFloatContext>,
      populated: ({ root }) => findSplitContext(root, groupId),
    })
);

export const splitExtent: Dual3<DockAtomGraph, AdapterState, SplitNode, number> = dual(
  3,
  (graph: DockAtomGraph, state: AdapterState, split: SplitNode): number => {
    const geometry = graph.registry.get(state.geometry.geometryAtom);
    const boxes = A.flatMap(DockNode.tabs(split), (tabs) =>
      O.match(
        A.findFirst(geometry.groups, (group) => GroupId.equals(group.groupId, tabs.groupId)),
        {
          onNone: A.empty,
          onSome: (group) => A.of(group.box),
        }
      )
    );
    return A.match(boxes, {
      onEmpty: () => 0,
      onNonEmpty: (nonEmpty) => {
        const left = Math.min(...A.map(nonEmpty, (box) => box.left));
        const top = Math.min(...A.map(nonEmpty, (box) => box.top));
        const right = Math.max(...A.map(nonEmpty, (box) => box.left + box.width));
        const bottom = Math.max(...A.map(nonEmpty, (box) => box.top + box.height));
        return SplitLayout.match(split.layout, {
          horizontal: () => right - left,
          vertical: () => bottom - top,
        });
      },
    });
  }
);

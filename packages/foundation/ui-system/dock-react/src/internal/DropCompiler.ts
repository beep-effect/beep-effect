import {
  DockNode,
  DockSide,
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
import { Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { commandCounter } from "./AdapterState.ts";
import type { AnchoredBox, DockBox, DockGeometry, MovePanelCommand, SplitNode } from "@beep/dock";
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
export const contains = (box: DockBox, point: PointerPosition): boolean =>
  point.left >= box.left &&
  point.left <= box.left + box.width &&
  point.top >= box.top &&
  point.top <= box.top + box.height;
export const clampRatio = (ratio: number): SplitRatio =>
  SplitRatio.make(Math.min(9_000, Math.max(1_000, Math.round(ratio))));
export const freshSplitId = (): SplitId => SplitId.make(`dockview-react-split-${commandCounter + 1}`);
export const freshGroupId = (): GroupId => GroupId.make(`dockview-react-group-${commandCounter + 1}`);
export const freshFloatingSplitId = (): SplitId => SplitId.make(`dockview-react-floating-split-${commandCounter + 1}`);
export const topLeftBox = (box: DockBox, container: DockBox): AnchoredBox =>
  TopLeftAnchoredBox.make({
    left: box.left - container.left,
    top: box.top - container.top,
    width: box.width,
    height: box.height,
  });

export const floatingHit = (geometry: DockGeometry, point: PointerPosition) =>
  A.findFirst(A.reverse(geometry.floating), (candidate) => contains(candidate.box, point));

export const compileDrop = (state: AdapterState, graph: DockAtomGraph, drag: TabDrag): O.Option<MovePanelCommand> => {
  const geometry = graph.registry.get(state.geometry.geometryAtom);
  const container = graph.registry.get(state.containerAtom);
  const point = drag.pointer;
  const outer = Math.min(32, Math.min(container.width, container.height) / 6);
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
};

export const splitExtent = (graph: DockAtomGraph, state: AdapterState, split: SplitNode): number => {
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
};

import {
  DockBox,
  DockFloatingGroupCommand,
  DockNode as DockNodeOps,
  GroupId,
  GroupRootSplitPlacement,
  MoveFloatingGroupCommand,
} from "@beep/dock";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { makeOperation } from "./AdapterState.ts";
import { boxStyle, freshFloatingSplitId, positionOf, topLeftBox } from "./DropCompiler.ts";
import { GroupPane } from "./GroupPane.tsx";
import type { AnchoredBox, DockNode } from "@beep/dock";
import type { DockviewReactProps } from "../DockReact.types.ts";
import type { AdapterState } from "./AdapterState.ts";
import type { FloatingGesture } from "./Gesture.models.ts";

// Chrome around the kernel's anchored content box: the pane is taller than
// the stored box by the drag-header, and can never shrink below readable.
const FLOATING_HEADER_HEIGHT = 32;
const FLOATING_MIN_WIDTH = 240;
const FLOATING_MIN_HEIGHT = 160;

export const FloatingPane = (
  props: DockviewReactProps & {
    readonly state: AdapterState;
    readonly index: number;
    readonly anchoredBox: AnchoredBox;
    readonly root: DockNode;
  }
) => {
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const submit = useAtomSet(props.graph.operationAtom);
  const memberOption = A.get(geometry.floating, props.index);
  const groupIdOption = O.map(A.head(DockNodeOps.tabs(props.root)), (tabs) => tabs.groupId);
  if (O.isNone(memberOption) || O.isNone(groupIdOption)) return null;
  const member = memberOption.value;
  const groupId = groupIdOption.value;
  const container = props.graph.registry.get(props.state.containerAtom);
  const finish = (node: HTMLElement, event: PointerEvent): void => {
    const gesture = props.graph.registry.get(props.state.floatingGestureAtom);
    if (O.isNone(gesture) || !GroupId.equals(gesture.value.groupId, groupId)) return;
    const override = props.graph.registry.get(props.state.floatingOverrideAtom);
    props.graph.registry.set(props.state.floatingGestureAtom, O.none());
    props.graph.registry.set(props.state.floatingOverrideAtom, O.none());
    node.releasePointerCapture?.(event.pointerId);
    if (gesture.value.moved && O.isSome(override)) {
      submit(
        makeOperation(
          MoveFloatingGroupCommand.make({
            groupId,
            anchoredBox: override.value.anchoredBox,
          })
        )
      );
    }
  };
  const gestureRef =
    (mode: FloatingGesture["mode"]) =>
    (node: HTMLDivElement | null): (() => void) | undefined => {
      if (P.isNull(node)) return undefined;
      const cancel = (): void => {
        props.graph.registry.set(props.state.floatingGestureAtom, O.none());
        // fallow-ignore-next-line code-duplication
        props.graph.registry.set(props.state.floatingOverrideAtom, O.none());
      };
      const keydown = (event: KeyboardEvent): void => {
        if (Eq.equals(event.key, "Escape")) cancel();
      };
      const move = (event: PointerEvent): void => {
        const gesture = props.graph.registry.get(props.state.floatingGestureAtom);
        if (
          O.isNone(gesture) ||
          !GroupId.equals(gesture.value.groupId, groupId) ||
          P.not(Eq.equals(mode))(gesture.value.mode)
        )
          return;
        const dx = event.clientX - gesture.value.start.left;
        const dy = event.clientY - gesture.value.start.top;
        const next = Eq.equals(mode, "move")
          ? DockBox.make({
              ...gesture.value.initialBox,
              left: gesture.value.initialBox.left + dx,
              top: gesture.value.initialBox.top + dy,
            })
          : DockBox.make({
              ...gesture.value.initialBox,
              width: Math.max(FLOATING_MIN_WIDTH, gesture.value.initialBox.width + dx),
              height: Math.max(FLOATING_MIN_HEIGHT, gesture.value.initialBox.height + dy),
            });
        props.graph.registry.set(
          props.state.floatingGestureAtom,
          O.some({
            ...gesture.value,
            moved: gesture.value.moved || P.not(Eq.equals(0))(dx) || P.not(Eq.equals(0))(dy),
          })
        );
        props.graph.registry.set(
          props.state.floatingOverrideAtom,
          O.some({
            groupId,
            anchoredBox: topLeftBox(next, container),
          })
        );
      };
      const down = (event: PointerEvent): void => {
        if (P.not(Eq.equals(0))(event.button)) return;
        event.stopPropagation();
        node.setPointerCapture?.(event.pointerId);
        props.graph.registry.set(
          props.state.floatingGestureAtom,
          O.some({
            groupId,
            mode,
            start: positionOf(event),
            initial: props.anchoredBox,
            initialBox: member.box,
            moved: false,
          })
        );
      };
      // fallow-ignore-next-line code-duplication
      const up = (event: PointerEvent): void => finish(node, event);
      node.addEventListener("pointerdown", down);
      node.addEventListener("pointermove", move);
      node.addEventListener("pointerup", up);
      document.addEventListener("keydown", keydown);
      return () => {
        node.removeEventListener("pointerdown", down);
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerup", up);
        document.removeEventListener("keydown", keydown);
      };
    };
  return (
    <div
      data-floating-pane={groupId}
      style={{ ...boxStyle(member.box), height: member.box.height + FLOATING_HEADER_HEIGHT, zIndex: props.index + 1 }}
      onPointerDown={() =>
        submit(
          makeOperation(
            MoveFloatingGroupCommand.make({
              groupId,
              anchoredBox: props.anchoredBox,
            })
          )
        )
      }
    >
      <div
        ref={gestureRef("move")}
        data-floating-header={groupId}
        style={{ height: FLOATING_HEADER_HEIGHT, cursor: "move" }}
      >
        <button
          type="button"
          aria-label={`Dock group ${groupId}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() =>
            submit(
              makeOperation(
                DockFloatingGroupCommand.make({
                  groupId,
                  target: GroupRootSplitPlacement.make({
                    side: "right",
                    splitId: freshFloatingSplitId(),
                  }),
                })
              )
            )
          }
        >
          Dock
        </button>
      </div>
      {A.map(member.groups, (group) => (
        <GroupPane
          key={group.groupId}
          {...props}
          groupId={group.groupId}
          floating
          box={DockBox.make({
            left: group.box.left - member.box.left,
            top: group.box.top - member.box.top + FLOATING_HEADER_HEIGHT,
            width: group.box.width,
            height: group.box.height,
          })}
        />
      ))}
      <div
        ref={gestureRef("resize")}
        data-floating-resize={groupId}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: "nwse-resize",
        }}
      />
    </div>
  );
};

import { DockNode, DockWorkspace, ResizeSplitCommand, SplitId, SplitLayout } from "@beep/dock";
import { useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { makeOperation } from "./AdapterState.ts";
import { boxStyle, clampRatio, positionOf, releaseCapture, splitExtent } from "./DropCompiler.ts";
import { SashDrag } from "./Gesture.models.ts";
import type { DockAtomGraph } from "../DockReact.types.ts";
import type { AdapterState } from "./AdapterState.ts";

export const Sash = (props: {
  readonly graph: DockAtomGraph;
  readonly state: AdapterState;
  readonly splitId: SplitId;
}) => {
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const sash = A.findFirst(geometry.sashes, (candidate) => SplitId.equals(candidate.splitId, props.splitId));
  if (O.isNone(sash)) return null;
  const attach = (node: HTMLDivElement | null): (() => void) | undefined => {
    if (P.isNull(node)) return undefined;
    const cancel = (): void => {
      const current = props.graph.registry.get(props.state.resizeAtom);
      props.graph.registry.set(props.state.resizeAtom, O.none());
      props.graph.registry.set(props.state.ratioOverrideAtom, O.none());
      // A synthetic pointercancel neither releases capture implicitly (a
      // real input-source cancel does) nor carries the captured pointerId,
      // so release the identity recorded at the press; without this the
      // sash keeps routing the pointer stream (and its hover state) until
      // the eventual pointerup.
      O.match(current, {
        onNone: () => undefined,
        onSome: (drag) => {
          releaseCapture(node, drag.pointerId);
          return undefined;
        },
      });
    };
    const move = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.resizeAtom);
      if (O.isNone(current) || !SplitId.equals(current.value.splitId, props.splitId) || current.value.extent <= 0)
        return;
      const delta = SashDrag.match(current.value, {
        horizontal: () => event.clientX - current.value.start.left,
        vertical: () => event.clientY - current.value.start.top,
      });
      const ratio = clampRatio(current.value.initialRatio + (delta * 10_000) / current.value.extent);
      props.graph.registry.set(
        props.state.resizeAtom,
        O.some({ ...current.value, moved: current.value.moved || P.not(Eq.equals(0))(delta) })
      );
      props.graph.registry.set(
        props.state.ratioOverrideAtom,
        O.some({
          splitId: props.splitId,
          ratio,
        })
      );
    };
    const up = (event: PointerEvent): void => {
      const current = props.graph.registry.get(props.state.resizeAtom);
      if (O.isNone(current) || !SplitId.equals(current.value.splitId, props.splitId)) return;
      const override = props.graph.registry.get(props.state.ratioOverrideAtom);
      props.graph.registry.set(props.state.resizeAtom, O.none());
      props.graph.registry.set(props.state.ratioOverrideAtom, O.none());
      releaseCapture(node, event.pointerId);
      if (current.value.moved && O.isSome(override)) {
        props.graph.registry.set(
          props.graph.operationAtom,
          makeOperation(
            ResizeSplitCommand.make({
              splitId: props.splitId,
              ratio: override.value.ratio,
            })
          )
        );
      }
    };
    const down = (event: PointerEvent): void => {
      if (P.not(Eq.equals(0))(event.button)) return;
      const workspace = props.graph.registry.get(props.graph.workspaceAtom);
      if (DockWorkspace.guards.empty(workspace)) return;
      const split = DockNode.findSplit(workspace.root, props.splitId);
      if (O.isNone(split)) return;
      const extent = splitExtent(props.graph, props.state, split.value);
      if (extent <= 0) return;
      // Without this the browser anchors a native text selection at the
      // press point and smears it across neighboring panels for the whole
      // drag; over an existing selection it can even escalate to native
      // drag-and-drop, which cancels the pointer stream mid-resize.
      event.preventDefault();
      node.setPointerCapture?.(event.pointerId);
      props.graph.registry.set(
        props.state.resizeAtom,
        O.some({
          splitId: props.splitId,
          axis: split.value.layout.axis,
          start: positionOf(event),
          initialRatio: SplitLayout.ratio(split.value.layout),
          extent,
          moved: false,
          pointerId: event.pointerId,
        })
      );
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
    };
  };
  return (
    <div
      ref={attach}
      data-sash-id={props.splitId}
      data-axis={sash.value.axis}
      style={{
        ...boxStyle(sash.value.box),
        cursor: Eq.equals(sash.value.axis, "horizontal") ? "col-resize" : "row-resize",
        touchAction: "none",
        userSelect: "none",
      }}
    />
  );
};

/**
 * Hook-free React adapter rendering a dock workspace as a pure projection of kernel geometry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DockNode, DockWorkspace, PanelId } from "@beep/dock";
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { adapterState } from "./internal/AdapterState.ts";
import { boxStyle, dropPreviewBox } from "./internal/DropCompiler.ts";
import { FloatingPane } from "./internal/FloatingPane.tsx";
import { GroupPane } from "./internal/GroupPane.tsx";
import { PanelPortal } from "./internal/PanelHost.tsx";
import { Sash } from "./internal/Sash.tsx";
import type { TabsNode } from "@beep/dock";
import type { DockviewReactProps } from "./DockReact.types.ts";
import type { AdapterState } from "./internal/AdapterState.ts";

const DropOverlay = (props: { readonly graph: DockviewReactProps["graph"]; readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  if (O.isNone(drag) || !drag.value.moved) return null;
  return O.match(dropPreviewBox(props.state, props.graph, drag.value), {
    onNone: () => null,
    onSome: (box) => <div data-drop-indicator="true" style={{ ...boxStyle(box), pointerEvents: "none" }} />,
  });
};

// Follow-cursor after-image for a promoted tab drag (dockview's PointerGhost
// pattern): without it, mid-drag there is nothing under the pointer telling
// the user what they are carrying. Functional styles only — the shell themes
// it via [data-drag-ghost]. translate3d keeps per-move updates off layout.
const DragGhost = (props: { readonly graph: DockviewReactProps["graph"]; readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  const panels = useAtomValue(props.graph.panelsAtom);
  if (O.isNone(drag) || !drag.value.moved) return null;
  return O.match(
    A.findFirst(panels, (candidate) => PanelId.equals(candidate.id, drag.value.panelId)),
    {
      onNone: () => null,
      onSome: (panel) => (
        <div
          data-drag-ghost=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate3d(${drag.value.pointer.left + 12}px, ${drag.value.pointer.top + 10}px, 0)`,
            pointerEvents: "none",
            willChange: "transform",
            opacity: 0.85,
            zIndex: 1000,
          }}
        >
          {panel.title}
        </div>
      ),
    }
  );
};

const DockviewRoot = (
  props: DockviewReactProps & {
    readonly state: AdapterState;
  }
) => {
  const workspace = useAtomValue(props.graph.workspaceAtom);
  const panels = useAtomValue(props.graph.panelsAtom);
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  const groups: ReadonlyArray<TabsNode> = DockWorkspace.match(workspace, {
    empty: A.empty<TabsNode>,
    populated: ({ root }): ReadonlyArray<TabsNode> => DockNode.tabs(root),
  });
  const Watermark = props.watermarkComponent;
  props.state.onReadySlot.current = props.onReady;
  return (
    <div
      ref={props.state.rootRef}
      data-testid="dockview-react"
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {A.match(groups, {
        onEmpty: () =>
          O.match(O.fromUndefinedOr(Watermark), {
            onNone: () => <div>Empty workspace</div>,
            onSome: (EmptyRenderer) => <EmptyRenderer />,
          }),
        onNonEmpty: (tabsNodes) =>
          A.map(tabsNodes, (tabs) => <GroupPane key={tabs.groupId} {...props} groupId={tabs.groupId} />),
      })}
      {A.map(workspace.floating, (member, index) => (
        <FloatingPane
          key={O.getOrElse(
            O.map(A.head(DockNode.tabs(member.root)), (tabs) => tabs.groupId),
            () => index
          )}
          {...props}
          index={index}
          anchoredBox={member.anchoredBox}
          root={member.root}
        />
      ))}
      {A.map(panels, (panel) => (
        <PanelPortal
          key={panel.id}
          graph={props.graph}
          panel={panel}
          components={props.components}
          state={props.state}
        />
      ))}
      {A.map(geometry.sashes, (sash) => (
        <Sash key={sash.splitId} graph={props.graph} state={props.state} splitId={sash.splitId} />
      ))}
      <DropOverlay graph={props.graph} state={props.state} />
      <DragGhost graph={props.graph} state={props.state} />
    </div>
  );
};

/**
 * Renders a dock workspace backed by a serialized Atom graph.
 *
 * @remarks
 * Adapter state is cached by graph identity and geometry inputs so portal
 * hosts remain stable across React remounts and dock topology changes.
 *
 * @example
 * ```ts
 * import { GroupId, makeDockAtoms, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView } from "@beep/dock"
 * import { DockviewReact } from "@beep/dock-react"
 * import { Effect } from "effect"
 * import { createElement } from "react"
 *
 * const workspace = PopulatedWorkspace.make({
 *   root: TabsNode.make({
 *     groupId: GroupId.make("main"),
 *     active: Panel.make({ id: PanelId.make("notes"), title: "Notes", view: TextPanelView.make({ text: "hello" }) }),
 *   }),
 * })
 * const element = await Effect.runPromise(
 *   Effect.map(makeDockAtoms(workspace), (graph) =>
 *     createElement(DockviewReact, { graph, components: {}, options: { gap: 8 } })
 *   )
 * )
 * console.log(element.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const DockviewReact = (props: DockviewReactProps) => {
  const gap = O.getOrElse(
    O.flatMap(O.fromUndefinedOr(props.options), ({ gap }) => O.fromUndefinedOr(gap)),
    () => 0
  );
  const minGroupExtent = O.getOrElse(
    O.flatMap(O.fromUndefinedOr(props.options), ({ minGroupExtent }) => O.fromUndefinedOr(minGroupExtent)),
    () => 0
  );
  const titleMinima = O.flatMap(O.fromUndefinedOr(props.options), ({ titleMinima }) => O.fromUndefinedOr(titleMinima));
  const state = adapterState(props.graph, gap, minGroupExtent, titleMinima);
  return (
    <RegistryContext.Provider value={props.graph.registry}>
      <DockviewRoot {...props} state={state} />
    </RegistryContext.Provider>
  );
};

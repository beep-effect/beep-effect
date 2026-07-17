/**
 * Hook-free React adapter rendering a dock workspace as a pure projection of kernel geometry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DockBox, DockNode, DockWorkspace } from "@beep/dock";
import { RegistryContext, useAtomValue } from "@effect/atom-react";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { adapterState } from "./internal/AdapterState.ts";
import { boxStyle, contains, floatingHit } from "./internal/DropCompiler.ts";
import { FloatingPane } from "./internal/FloatingPane.tsx";
import { GroupPane } from "./internal/GroupPane.tsx";
import { PanelPortal } from "./internal/PanelHost.tsx";
import { Sash } from "./internal/Sash.tsx";
import type { TabsNode } from "@beep/dock";
import type { DockviewReactProps } from "./DockReact.types.ts";
import type { AdapterState } from "./internal/AdapterState.ts";

const DropOverlay = (props: { readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  const geometry = useAtomValue(props.state.geometry.geometryAtom);
  if (O.isNone(drag)) return null;
  const group = O.match(floatingHit(geometry, drag.value.pointer), {
    onNone: () => A.findFirst(geometry.groups, (candidate) => contains(candidate.box, drag.value.pointer)),
    onSome: (member) => A.findFirst(member.groups, (candidate) => contains(candidate.box, drag.value.pointer)),
  });
  const box = O.match(group, {
    onNone: () =>
      DockBox.make({
        left: drag.value.pointer.left - 8,
        top: drag.value.pointer.top - 8,
        width: 16,
        height: 16,
      }),
    onSome: (candidate) => candidate.box,
  });
  return <div data-drop-indicator="true" style={{ ...boxStyle(box), pointerEvents: "none" }} />;
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
      <DropOverlay state={props.state} />
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
  const titleMinima = O.flatMap(O.fromUndefinedOr(props.options), ({ titleMinima }) => O.fromUndefinedOr(titleMinima));
  const state = adapterState(props.graph, gap, titleMinima);
  return (
    <RegistryContext.Provider value={props.graph.registry}>
      <DockviewRoot {...props} state={state} />
    </RegistryContext.Provider>
  );
};

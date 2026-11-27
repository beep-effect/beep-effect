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
import * as S from "effect/Schema";
import { adapterState } from "./internal/AdapterState.ts";
import { dropPreview, px } from "./internal/DropCompiler.ts";
import { FloatingPane } from "./internal/FloatingPane.tsx";
import { DropPreview } from "./internal/Gesture.models.ts";
import { GroupPane } from "./internal/GroupPane.tsx";
import { PanelPortal } from "./internal/PanelHost.tsx";
import { Sash } from "./internal/Sash.tsx";
import type { DockBox, TabsNode } from "@beep/dock";
import type React from "react";
import type { DockviewReactProps } from "./DockReact.types.ts";
import type { AdapterState } from "./internal/AdapterState.ts";
import type { PointerPosition } from "./internal/Gesture.models.ts";

const DropOverlay = (props: { readonly graph: DockviewReactProps["graph"]; readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  if (O.isNone(drag) || !drag.value.moved || drag.value.concluded) return null;
  return O.match(dropPreview(props.state, props.graph, drag.value), {
    onNone: () => null,
    onSome: DropPreview.match({
      "tab-insertion": (preview) => (
        <div
          data-drop-caret=""
          style={
            {
              "--dock-left": px(preview.caretBox.left),
              "--dock-top": px(preview.caretBox.top),
              "--dock-width": px(preview.caretBox.width),
              "--dock-height": px(preview.caretBox.height),
            } as React.CSSProperties
          }
        />
      ),
      section: (preview) => (
        <div
          data-drop-indicator="true"
          style={
            {
              "--dock-left": px(preview.box.left),
              "--dock-top": px(preview.box.top),
              "--dock-width": px(preview.box.width),
              "--dock-height": px(preview.box.height),
            } as React.CSSProperties
          }
        />
      ),
    }),
  });
};

const GHOST_MAX_WIDTH_PX = 240;
const GHOST_LINE_HEIGHT_PX = 24;
const GHOST_OFFSET_X_PX = 12;
const GHOST_OFFSET_Y_PX = 10;

type GhostPlacement = {
  readonly anchor: string;
  readonly x: number;
  readonly y: number;
};

const ghostAxis = (
  pointer: number,
  extent: number,
  offset: number,
  maxSpan: number
): { readonly flipped: boolean; readonly position: number } => {
  const spanWithinContainer = Math.min(maxSpan, extent);
  return pointer + offset + spanWithinContainer > extent
    ? { flipped: true, position: Math.min(Math.max(pointer - offset, spanWithinContainer), extent) }
    : { flipped: false, position: pointer + offset };
};

const ghostPlacement = (pointer: PointerPosition, container: DockBox): GhostPlacement => {
  const horizontal = ghostAxis(pointer.left, container.width, GHOST_OFFSET_X_PX, GHOST_MAX_WIDTH_PX);
  const vertical = ghostAxis(pointer.top, container.height, GHOST_OFFSET_Y_PX, GHOST_LINE_HEIGHT_PX);
  return {
    anchor: `${horizontal.flipped ? " translateX(-100%)" : ""}${vertical.flipped ? " translateY(-100%)" : ""}`,
    x: horizontal.position,
    y: vertical.position,
  };
};

const DragGhost = (props: { readonly graph: DockviewReactProps["graph"]; readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  const panels = useAtomValue(props.graph.panelsAtom);
  const container = useAtomValue(props.state.containerAtom);
  if (O.isNone(drag) || !drag.value.moved || drag.value.concluded) return null;
  const placement = ghostPlacement(drag.value.pointer, container);
  return O.match(
    A.findFirst(panels, (candidate) => S.toEquivalence(PanelId)(candidate.id, drag.value.panelId)),
    {
      onNone: () => null,
      onSome: (panel) => (
        <div
          data-drag-ghost=""
          style={
            {
              "--dock-transform": `translate3d(${placement.x}px, ${placement.y}px, 0)${placement.anchor}`,
              "--dock-max-width": px(Math.min(GHOST_MAX_WIDTH_PX, container.width)),
            } as React.CSSProperties
          }
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
    <div ref={props.state.rootRef} data-testid="dockview-react" data-dock-root="">
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
 * **Details**
 *
 * Adapter state is cached by graph identity and geometry inputs so portal
 * hosts remain stable across React remounts and dock topology changes.
 *
 * **Gotchas**
 *
 * The adapter writes geometry as `--dock-*` custom properties and leaves every
 * rule to its stylesheet, so hosts must import it once
 * (`@import "@beep/dock-react/dock.css";`); without it groups, sashes, and
 * floating panes render unpositioned.
 *
 * **Example** (Create DockviewReact from workspace)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { makeDockAtoms } from "@beep/dock/Dock.atoms"
 * import { Panel, TextPanelView } from "@beep/dock/Dock.models"
 * import { PopulatedWorkspace, TabsNode } from "@beep/dock/Dock.tree"
 * import { DockviewReact } from "@beep/dock-react/DockviewReact"
 * import * as Effect from "effect/Effect";
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

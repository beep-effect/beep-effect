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

// FlexLayout's drag-rect pattern: the preview element persists while its
// kind stays active, and the package stylesheet's transitions tween its
// bounds — the section overlay flies between groups/quadrants and the caret
// slides along the strip instead of teleporting.

const DropOverlay = (props: { readonly graph: DockviewReactProps["graph"]; readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  if (O.isNone(drag) || !drag.value.moved || drag.value.concluded) return null;
  return O.match(dropPreview(props.state, props.graph, drag.value), {
    onNone: () => null,
    onSome: DropPreview.match({
      // Joining a tab list renders IN the strip (position = insertion
      // index), never as a layout overlay: adding a tab and creating a
      // section must read as different acts.
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

// The label renders trailing the pointer by default and anchors to the
// pointer's other side once its far edge would cross the container (QA
// finding: the drag label clipped at right and bottom drop zones). The
// ellipsis cap bounds the label's true extent, so the flip threshold and
// the flipped-side clamp are exact rather than a guessed band — long
// titles cannot out-grow the flip, and narrow containers cannot clip the
// flipped label off the left edge.
const GHOST_MAX_WIDTH_PX = 240;
const GHOST_LINE_HEIGHT_PX = 24;
const GHOST_OFFSET_X_PX = 12;
const GHOST_OFFSET_Y_PX = 10;

type GhostPlacement = {
  readonly anchor: string;
  readonly x: number;
  readonly y: number;
};

// Per-axis: trail the pointer while the label's far edge fits, otherwise
// anchor to the pointer's other side (translate -100%) and clamp so the
// flipped label cannot cross the container's near edge either.
const ghostAxis = (
  pointer: number,
  extent: number,
  offset: number,
  maxSpan: number
): { readonly flipped: boolean; readonly position: number } => {
  // The label can never occupy more than the container, so the flip
  // threshold and the flipped-side clamp both bound the span by the extent.
  // Without that bound a container narrower than the cap flips every time and
  // then anchors past its own far edge — the clipping this exists to prevent,
  // mirrored.
  const span = Math.min(maxSpan, extent);
  return pointer + offset + span > extent
    ? { flipped: true, position: Math.min(Math.max(pointer - offset, span), extent) }
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

// Follow-cursor after-image for a promoted tab drag (dockview's PointerGhost
// pattern): without it, mid-drag there is nothing under the pointer telling
// the user what they are carrying. Placement only — the package stylesheet
// owns the mechanics and the shell themes it via [data-drag-ghost].
const DragGhost = (props: { readonly graph: DockviewReactProps["graph"]; readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  const panels = useAtomValue(props.graph.panelsAtom);
  const container = useAtomValue(props.state.containerAtom);
  if (O.isNone(drag) || !drag.value.moved || drag.value.concluded) return null;
  const placement = ghostPlacement(drag.value.pointer, container);
  return O.match(
    A.findFirst(panels, (candidate) => PanelId.equals(candidate.id, drag.value.panelId)),
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

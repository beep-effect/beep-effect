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
import { boxStyle, dropPreview } from "./internal/DropCompiler.ts";
import { FloatingPane } from "./internal/FloatingPane.tsx";
import { DropPreview } from "./internal/Gesture.models.ts";
import { GroupPane } from "./internal/GroupPane.tsx";
import { PanelPortal } from "./internal/PanelHost.tsx";
import { Sash } from "./internal/Sash.tsx";
import type { TabsNode } from "@beep/dock";
import type { DockviewReactProps } from "./DockReact.types.ts";
import type { AdapterState } from "./internal/AdapterState.ts";

// FlexLayout's drag-rect pattern: the preview element persists while its
// kind stays active, and CSS transitions tween its bounds — the section
// overlay flies between groups/quadrants and the caret slides along the
// strip instead of teleporting.
const SECTION_TRANSITION = "left 0.15s ease-out, top 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out";
const CARET_TRANSITION = "left 0.12s ease-out, top 0.12s ease-out, height 0.12s ease-out";

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
          style={{ ...boxStyle(preview.caretBox), transition: CARET_TRANSITION, pointerEvents: "none" }}
        />
      ),
      section: (preview) => (
        <div
          data-drop-indicator="true"
          style={{ ...boxStyle(preview.box), transition: SECTION_TRANSITION, pointerEvents: "none" }}
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

// Follow-cursor after-image for a promoted tab drag (dockview's PointerGhost
// pattern): without it, mid-drag there is nothing under the pointer telling
// the user what they are carrying. Functional styles only — the shell themes
// it via [data-drag-ghost]. translate3d keeps per-move updates off layout.
const DragGhost = (props: { readonly graph: DockviewReactProps["graph"]; readonly state: AdapterState }) => {
  const drag = useAtomValue(props.state.dragAtom);
  const panels = useAtomValue(props.graph.panelsAtom);
  const container = useAtomValue(props.state.containerAtom);
  if (O.isNone(drag) || !drag.value.moved || drag.value.concluded) return null;
  const flipX = drag.value.pointer.left + GHOST_OFFSET_X_PX + GHOST_MAX_WIDTH_PX > container.width;
  const flipY = drag.value.pointer.top + GHOST_OFFSET_Y_PX + GHOST_LINE_HEIGHT_PX > container.height;
  const anchor = `${flipX ? " translateX(-100%)" : ""}${flipY ? " translateY(-100%)" : ""}`;
  const ghostX = flipX
    ? Math.max(drag.value.pointer.left - GHOST_OFFSET_X_PX, GHOST_MAX_WIDTH_PX)
    : drag.value.pointer.left + GHOST_OFFSET_X_PX;
  const ghostY = flipY
    ? Math.max(drag.value.pointer.top - GHOST_OFFSET_Y_PX, GHOST_LINE_HEIGHT_PX)
    : drag.value.pointer.top + GHOST_OFFSET_Y_PX;
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
            transform: `translate3d(${ghostX}px, ${ghostY}px, 0)${anchor}`,
            maxWidth: GHOST_MAX_WIDTH_PX,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
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

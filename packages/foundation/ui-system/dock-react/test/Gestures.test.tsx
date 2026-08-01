import {
  DockNode,
  GroupId,
  HorizontalSplitLayout,
  makeDockAtoms,
  Panel,
  PanelId,
  PopulatedWorkspace,
  SplitId,
  SplitLayout,
  SplitNode,
  TabsNode,
  TextPanelView,
} from "@beep/dock";
import { DockviewReact } from "@beep/dock-react";
import { resize } from "@beep/dock-react/internal/ResizeObserverHarness";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { afterEach, describe, expect } from "vitest";
import type { DockviewAdapterApi } from "@beep/dock-react";

const group1 = GroupId.make("gesture-group-1");
const group2 = GroupId.make("gesture-group-2");
const panel1 = Panel.make({
  id: PanelId.make("gesture-panel-1"),
  title: "One",
  view: TextPanelView.make({ text: "one" }),
});
const panel2 = Panel.make({
  id: PanelId.make("gesture-panel-2"),
  title: "Two",
  view: TextPanelView.make({ text: "two" }),
});
const panel3 = Panel.make({
  id: PanelId.make("gesture-panel-3"),
  title: "Three",
  view: TextPanelView.make({ text: "three" }),
});
const splitId = SplitId.make("gesture-split-1");

const tabs = (groupId: GroupId, panels: readonly [Panel, ...ReadonlyArray<Panel>]): TabsNode =>
  TabsNode.fromPanels(groupId, panels, panels[0].id, TabsNode.make({ groupId, active: panels[0] }).metadata);
const workspace = (twoGroups = false) => {
  const first = tabs(group1, [panel1, panel2]);
  return PopulatedWorkspace.make({
    root: twoGroups
      ? SplitNode.make({ splitId, layout: HorizontalSplitLayout.make({ left: first, right: tabs(group2, [panel3]) }) })
      : first,
  });
};
const mount = Effect.fn("GesturesTest.mount")(function* (twoGroups = false) {
  const graph = yield* makeDockAtoms(workspace(twoGroups));
  let api: DockviewAdapterApi | undefined;
  render(<DockviewReact graph={graph} components={{}} options={{ gap: 8 }} onReady={(event) => (api = event.api)} />);
  resize(screen.getByTestId("dockview-react"), { width: 800, height: 400 });
  return {
    graph,
    get api() {
      return api;
    },
  };
});
const tab = (id: PanelId): HTMLElement => {
  const node = screen.getByTestId("dockview-react").querySelector<HTMLElement>(`[data-panel-id='${id}']`);
  if (node === null) throw new Error(`Missing tab ${id}`);
  return node;
};
const pointer = (node: Element, name: "pointerDown" | "pointerMove" | "pointerUp", x: number, y: number) =>
  fireEvent[name](node, { button: 0, clientX: x, clientY: y, pointerId: 7 });

afterEach(cleanup);

describe("dock pointer gestures", { concurrent: false }, () => {
  it.effect("previews the compiled group quadrant and center placements", () =>
    Effect.gen(function* () {
      const mounted = yield* mount(true);
      const source = tab(panel1.id);
      const indicator = (): HTMLElement => {
        const node = screen.getByTestId("dockview-react").querySelector<HTMLElement>("[data-drop-indicator]");
        if (node === null) throw new Error("Missing drop indicator");
        return node;
      };
      pointer(source, "pointerDown", 100, 16);
      pointer(source, "pointerMove", 410, 200);
      expect(indicator().style.left).toBe("404px");
      expect(indicator().style.width).toBe("198px");
      pointer(source, "pointerMove", 720, 200);
      expect(indicator().style.left).toBe("602px");
      expect(indicator().style.width).toBe("198px");
      pointer(source, "pointerMove", 600, 50);
      expect(indicator().style.top).toBe("0px");
      expect(indicator().style.height).toBe("200px");
      pointer(source, "pointerMove", 600, 350);
      expect(indicator().style.top).toBe("200px");
      expect(indicator().style.height).toBe("200px");
      // Center hover joins the tab list, so the preview moves INTO the
      // strip as an insertion caret (append position) instead of a
      // full-group overlay — adding a tab and creating a section read as
      // different acts.
      pointer(source, "pointerMove", 600, 200);
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-indicator]")).toBeNull();
      const caret = screen.getByTestId("dockview-react").querySelector<HTMLElement>("[data-drop-caret]");
      expect(caret).not.toBeNull();
      expect(caret?.style.left).toBe("797px");
      expect(caret?.style.height).toBe("32px");
      // Strip hover positions the caret at the pointer's insertion index
      // (Chrome tab-strip semantics: the position is visible and draggable).
      pointer(source, "pointerMove", 500, 16);
      const stripCaret = screen.getByTestId("dockview-react").querySelector<HTMLElement>("[data-drop-caret]");
      expect(stripCaret?.style.left).toBe("404px");
      fireEvent.keyDown(document, { key: "Escape" });
      mounted.graph.dispose();
    })
  );

  it.effect("reorders within a group and leaves no overlay", () =>
    Effect.gen(function* () {
      const mounted = yield* mount();
      pointer(tab(panel2.id), "pointerDown", 600, 16);
      // An unpromoted press shows no drag chrome: neither indicator nor ghost.
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-indicator]")).toBeNull();
      expect(screen.getByTestId("dockview-react").querySelector("[data-drag-ghost]")).toBeNull();
      // preventDefault on the press suppresses native focus transfer; the
      // handler restores it so keyboard activation tracks the clicked tab.
      expect(document.activeElement).toBe(tab(panel2.id));
      pointer(tab(panel2.id), "pointerMove", 100, 16);
      // A strip hover previews as the insertion caret, not a section overlay.
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-caret]")).not.toBeNull();
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-indicator]")).toBeNull();
      const ghost = screen.getByTestId("dockview-react").querySelector("[data-drag-ghost]");
      expect(ghost).not.toBeNull();
      expect(ghost?.textContent).toBe(panel2.title);
      pointer(tab(panel2.id), "pointerUp", 100, 16);
      yield* mounted.graph.awaitIdle;
      const result = O.getOrThrow(mounted.graph.registry.get(mounted.graph.tabsAtom(group1)));
      expect(A.map(TabsNode.panels(result), (panel) => panel.id)).toEqual([panel2.id, panel1.id]);
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-indicator]")).toBeNull();
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-caret]")).toBeNull();
      expect(screen.getByTestId("dockview-react").querySelector("[data-drag-ghost]")).toBeNull();
      mounted.graph.dispose();
    })
  );

  it.effect("moves to another tab strip at index zero", () =>
    Effect.gen(function* () {
      const mounted = yield* mount(true);
      pointer(tab(panel2.id), "pointerDown", 200, 16);
      pointer(tab(panel2.id), "pointerUp", 405, 1);
      yield* mounted.graph.awaitIdle;
      const result = O.getOrThrow(mounted.graph.registry.get(mounted.graph.tabsAtom(group2)));
      expect(A.map(TabsNode.panels(result), (panel) => panel.id)).toEqual([panel2.id, panel3.id]);
      mounted.graph.dispose();
    })
  );

  it.effect("docks to a group left edge and the container bottom edge", () =>
    Effect.gen(function* () {
      const left = yield* mount(true);
      pointer(tab(panel1.id), "pointerDown", 100, 16);
      pointer(tab(panel1.id), "pointerUp", 410, 200);
      yield* left.graph.awaitIdle;
      const leftWorkspace = left.graph.registry.get(left.graph.workspaceAtom);
      expect(leftWorkspace.kind).toBe("populated");
      if (leftWorkspace.kind === "populated") {
        expect(
          A.some(
            DockNode.splits(leftWorkspace.root),
            (split) =>
              split.layout.axis === "horizontal" &&
              DockNode.panels(SplitLayout.children(split.layout)[0]).some((panel) => panel.id === panel1.id)
          )
        ).toBe(true);
      }
      left.graph.dispose();

      cleanup();
      const bottom = yield* mount(true);
      pointer(tab(panel1.id), "pointerDown", 100, 16);
      pointer(tab(panel1.id), "pointerUp", 400, 395);
      yield* bottom.graph.awaitIdle;
      const bottomWorkspace = bottom.graph.registry.get(bottom.graph.workspaceAtom);
      expect(bottomWorkspace.kind).toBe("populated");
      if (bottomWorkspace.kind === "populated") {
        expect(bottomWorkspace.root._tag).toBe("Split");
        if (bottomWorkspace.root._tag === "Split") {
          expect(bottomWorkspace.root.layout.axis).toBe("vertical");
          expect(DockNode.panels(SplitLayout.children(bottomWorkspace.root.layout)[1])[0]?.id).toBe(panel1.id);
        }
      }
      bottom.graph.dispose();
    })
  );

  it.effect("cancels with Escape and skips source-center drops", () =>
    Effect.gen(function* () {
      const mounted = yield* mount();
      const initialRevision = mounted.graph.registry.get(mounted.graph.workspaceAtom).revision;
      pointer(tab(panel1.id), "pointerDown", 100, 16);
      fireEvent.keyDown(document, { key: "Escape" });
      if (mounted.api === undefined) throw new Error("Missing adapter API");
      // Escape on an UNPROMOTED press clears outright — no drag chrome was
      // shown, so the release must still read as a plain activation click.
      // (A promoted drag instead concludes and keeps its record; see the
      // activation-leak test.)
      expect(O.isNone(mounted.graph.registry.get(mounted.api.atoms.drag))).toBe(true);
      expect(mounted.graph.registry.get(mounted.graph.workspaceAtom).revision).toBe(initialRevision);
      pointer(tab(panel1.id), "pointerDown", 100, 16);
      pointer(tab(panel1.id), "pointerUp", 400, 220);
      yield* mounted.graph.awaitIdle;
      expect(mounted.graph.registry.get(mounted.graph.workspaceAtom).revision).toBe(initialRevision);
      mounted.graph.dispose();
    })
  );

  it.effect("a cross-group drop concludes the record and the next press heals it", () =>
    Effect.gen(function* () {
      const mounted = yield* mount(true);
      const source = tab(panel1.id);
      // Promote and drop panel1 into group2's center (cross-group move).
      pointer(source, "pointerDown", 100, 16);
      pointer(source, "pointerMove", 600, 200);
      pointer(source, "pointerUp", 600, 200);
      // The record concludes rather than clearing: were the source node
      // still mounted (same-group reorder), the trailing click would be
      // swallowed instead of re-activating via the stale group closure.
      if (mounted.api === undefined) throw new Error("Missing adapter API");
      expect(O.exists(mounted.graph.registry.get(mounted.api.atoms.drag), (drag) => drag.concluded)).toBe(true);
      // Here the move unmounted the source node, so the trailing click
      // lands on a detached element: no activation, and the concluded
      // record lingers (touch and pen releases produce no click at all).
      fireEvent.click(source, { clientX: 600, clientY: 200 });
      yield* mounted.graph.awaitIdle;
      expect(O.exists(mounted.graph.registry.get(mounted.api.atoms.drag), (drag) => drag.concluded)).toBe(true);
      // The next press anywhere on a tab clears the stale record before the
      // button guard can early-return past it.
      pointer(tab(panel3.id), "pointerDown", 600, 16);
      pointer(tab(panel3.id), "pointerUp", 600, 16);
      yield* mounted.graph.awaitIdle;
      expect(O.isNone(mounted.graph.registry.get(mounted.api.atoms.drag))).toBe(true);
      mounted.graph.dispose();
    })
  );

  it.effect("positions the insertion caret by measured tab midpoints", () =>
    Effect.gen(function* () {
      const mounted = yield* mount(true);
      const root = screen.getByTestId("dockview-react");
      const strip = root.querySelector<HTMLElement>(`[data-group-id='${group1}'] [role='tablist']`);
      if (strip === null) throw new Error("Missing tab strip");
      // jsdom reports every rect as zero-width, so the strip never records
      // real tab widths and the measured branch of the insertion-index rule
      // stays unreachable. Stub the two tabs at 100px and 60px, then drive a
      // resize so measureStrip records them.
      const widths = new Map([
        [panel1.id, 100],
        [panel2.id, 60],
      ]);
      for (const [panelId, width] of widths) {
        const node = tab(panelId);
        node.getBoundingClientRect = () => new DOMRect(0, 0, width, 24);
      }
      resize(strip, { width: 400, height: 24 });

      const source = tab(panel3.id);
      const caretLeft = (): string => {
        const node = root.querySelector<HTMLElement>("[data-drop-caret]");
        if (node === null) throw new Error("Missing drop caret");
        return node.style.left;
      };
      pointer(source, "pointerDown", 600, 16);
      // Before the first tab's midpoint (50px): index 0, caret at the strip start.
      pointer(source, "pointerMove", 20, 16);
      expect(caretLeft()).toBe("0px");
      // Past the first midpoint but before the second (100 + 30 = 130): index 1.
      pointer(source, "pointerMove", 90, 16);
      expect(caretLeft()).toBe("100px");
      // Past the second midpoint: append at index 2, caret after both tabs.
      pointer(source, "pointerMove", 150, 16);
      expect(caretLeft()).toBe("160px");
      fireEvent.keyDown(document, { key: "Escape" });
      mounted.graph.dispose();
    })
  );

  it.effect("Escape-cancelled drag release does not activate the dragged tab", () =>
    Effect.gen(function* () {
      const mounted = yield* mount();
      expect(O.getOrThrow(mounted.graph.registry.get(mounted.graph.tabsAtom(group1))).active.id).toBe(panel1.id);
      pointer(tab(panel2.id), "pointerDown", 600, 16);
      expect(document.activeElement).toBe(tab(panel2.id));
      pointer(tab(panel2.id), "pointerMove", 100, 200);
      fireEvent.keyDown(document, { key: "Escape" });
      // Escape hands focus back to the group's active tab: the cancelled
      // gesture must leave no focus trace on the dragged tab.
      expect(document.activeElement).toBe(tab(panel1.id));
      pointer(tab(panel2.id), "pointerUp", 100, 200);
      // The browser delivers the trailing click to the pointer-capture target
      // even though the release happened far from the tab strip; a cancelled
      // drag's release must not read as an activation click.
      fireEvent.click(tab(panel2.id), { clientX: 100, clientY: 200 });
      yield* mounted.graph.awaitIdle;
      expect(O.getOrThrow(mounted.graph.registry.get(mounted.graph.tabsAtom(group1))).active.id).toBe(panel1.id);
      mounted.graph.dispose();
    })
  );

  it.effect("clears sash and tab gestures on pointercancel without committing", () =>
    Effect.gen(function* () {
      const mounted = yield* mount(true);
      const root = screen.getByTestId("dockview-react");
      const initialRevision = mounted.graph.registry.get(mounted.graph.workspaceAtom).revision;
      const sash = root.querySelector<HTMLElement>(`[data-sash-id='${splitId}']`);
      if (sash === null) throw new Error("Missing sash");
      const pane = root.querySelector<HTMLElement>(`[data-group-id='${group1}']`);
      if (pane === null) throw new Error("Missing pane");
      // 800px container, gap 8, even split: each pane lays out at 396px.
      const initialWidth = "396px";
      pointer(sash, "pointerDown", 400, 200);
      pointer(sash, "pointerMove", 500, 200);
      expect(pane.style.width).not.toBe(initialWidth);
      fireEvent.pointerCancel(sash, { pointerId: 7 });
      expect(pane.style.width).toBe(initialWidth);
      const source = tab(panel1.id);
      pointer(source, "pointerDown", 100, 16);
      pointer(source, "pointerMove", 410, 200);
      expect(root.querySelector("[data-drag-ghost]")).not.toBeNull();
      // Over the source group's own center there is no drop target, but the
      // ghost keeps following the pointer so the drag never looks dead.
      pointer(source, "pointerMove", 200, 220);
      expect(root.querySelector("[data-drop-indicator]")).toBeNull();
      expect(root.querySelector("[data-drag-ghost]")).not.toBeNull();
      fireEvent.pointerCancel(source, { pointerId: 7 });
      expect(root.querySelector("[data-drag-ghost]")).toBeNull();
      expect(root.querySelector("[data-drop-indicator]")).toBeNull();
      yield* mounted.graph.awaitIdle;
      expect(mounted.graph.registry.get(mounted.graph.workspaceAtom).revision).toBe(initialRevision);
      mounted.graph.dispose();
    })
  );

  it.effect("previews and commits one sash resize while ignoring no-move release", () =>
    Effect.gen(function* () {
      const mounted = yield* mount(true);
      const sash = screen.getByTestId("dockview-react").querySelector<HTMLElement>(`[data-sash-id='${splitId}']`);
      if (sash === null) throw new Error("Missing sash");
      const pane = screen.getByTestId("dockview-react").querySelector<HTMLElement>(`[data-group-id='${group1}']`);
      if (pane === null) throw new Error("Missing pane");
      const initialWidth = pane.style.width;
      pointer(sash, "pointerDown", 400, 200);
      pointer(sash, "pointerMove", 500, 200);
      expect(pane.style.width).not.toBe(initialWidth);
      pointer(sash, "pointerUp", 500, 200);
      yield* mounted.graph.awaitIdle;
      const resized = mounted.graph.registry.get(mounted.graph.workspaceAtom);
      expect(resized.kind).toBe("populated");
      if (resized.kind === "populated")
        expect(SplitLayout.ratio(O.getOrThrow(DockNode.findSplit(resized.root, splitId)).layout)).toBe(6250);
      const revision = resized.revision;
      pointer(sash, "pointerDown", 500, 200);
      pointer(sash, "pointerUp", 500, 200);
      yield* mounted.graph.awaitIdle;
      expect(mounted.graph.registry.get(mounted.graph.workspaceAtom).revision).toBe(revision);
      mounted.graph.dispose();
    })
  );
});

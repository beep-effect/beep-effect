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
      pointer(source, "pointerMove", 600, 200);
      expect(indicator().style.left).toBe("404px");
      expect(indicator().style.width).toBe("396px");
      fireEvent.keyDown(document, { key: "Escape" });
      mounted.graph.dispose();
    })
  );

  it.effect("reorders within a group and leaves no overlay", () =>
    Effect.gen(function* () {
      const mounted = yield* mount();
      pointer(tab(panel2.id), "pointerDown", 600, 16);
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-indicator]")).not.toBeNull();
      pointer(tab(panel2.id), "pointerMove", 100, 16);
      pointer(tab(panel2.id), "pointerUp", 100, 16);
      yield* mounted.graph.awaitIdle;
      const result = O.getOrThrow(mounted.graph.registry.get(mounted.graph.tabsAtom(group1)));
      expect(A.map(TabsNode.panels(result), (panel) => panel.id)).toEqual([panel2.id, panel1.id]);
      expect(screen.getByTestId("dockview-react").querySelector("[data-drop-indicator]")).toBeNull();
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
      expect(O.isNone(mounted.graph.registry.get(mounted.api.atoms.drag))).toBe(true);
      expect(mounted.graph.registry.get(mounted.graph.workspaceAtom).revision).toBe(initialRevision);
      pointer(tab(panel1.id), "pointerDown", 100, 16);
      pointer(tab(panel1.id), "pointerUp", 400, 220);
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

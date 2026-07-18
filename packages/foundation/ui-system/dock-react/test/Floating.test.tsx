import {
  ComponentPanelView,
  DockNode,
  FloatingMember,
  GroupId,
  HorizontalSplitLayout,
  makeDockAtoms,
  Panel,
  PanelId,
  PopulatedWorkspace,
  RendererKey,
  SplitId,
  SplitNode,
  TabsNode,
  TextPanelView,
  TopLeftAnchoredBox,
} from "@beep/dock";
import { DockviewReact } from "@beep/dock-react";
import { resize } from "@beep/dock-react/internal/ResizeObserverHarness";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { afterEach, describe, expect } from "vitest";
import type { AnchoredBox } from "@beep/dock";
import type { DockPanelProps } from "@beep/dock-react";

const dockedId = GroupId.make("floating-docked");
const floating1Id = GroupId.make("floating-one");
const floating2Id = GroupId.make("floating-two");
const otherDockedId = GroupId.make("floating-other-docked");
const dockedPanel = Panel.make({
  id: PanelId.make("floating-docked-panel"),
  title: "Docked",
  view: ComponentPanelView.make({ renderer: RendererKey.make("input"), input: {} }),
});
const floatingPanel1 = Panel.make({
  id: PanelId.make("floating-panel-one"),
  title: "Float One",
  view: TextPanelView.make({ text: "float one" }),
});
const floatingPanel2 = Panel.make({
  id: PanelId.make("floating-panel-two"),
  title: "Float Two",
  view: TextPanelView.make({ text: "float two" }),
});
const otherDockedPanel = Panel.make({
  id: PanelId.make("floating-other-docked-panel"),
  title: "Other Docked",
  view: TextPanelView.make({ text: "other docked" }),
});
const tabs = (groupId: GroupId, panel: Panel): TabsNode => TabsNode.make({ groupId, active: panel });
const anchored = (left: number, top: number, width = 240, height = 160): AnchoredBox =>
  TopLeftAnchoredBox.make({ left, top, width, height });
const workspace = (floating = true, twoDocked = false) =>
  PopulatedWorkspace.make({
    root: twoDocked
      ? SplitNode.make({
          splitId: SplitId.make("floating-initial-split"),
          layout: HorizontalSplitLayout.make({
            left: tabs(dockedId, dockedPanel),
            right: tabs(otherDockedId, otherDockedPanel),
          }),
        })
      : tabs(dockedId, dockedPanel),
    floating: floating
      ? [
          FloatingMember.make({ anchoredBox: anchored(40, 50), root: tabs(floating1Id, floatingPanel1) }),
          FloatingMember.make({ anchoredBox: anchored(320, 80), root: tabs(floating2Id, floatingPanel2) }),
        ]
      : [],
  });
const mount = Effect.fn("FloatingTest.mount")(function* (floating = true, twoDocked = false) {
  const graph = yield* makeDockAtoms(workspace(floating, twoDocked));
  const Input = (props: DockPanelProps) => <input data-testid={`input-${props.api.id}`} defaultValue="kept" />;
  render(<DockviewReact graph={graph} components={{ input: Input }} options={{ gap: 8 }} />);
  resize(screen.getByTestId("dockview-react"), 800, 500);
  if (P.isTruthy(floating)) {
    yield* Effect.promise(() =>
      waitFor(() => expect(query(`[data-floating-pane='${floating1Id}']`).style.width).toBe("240px"))
    );
  }
  return graph;
});
const query = (selector: string): HTMLElement => {
  const node = screen.getByTestId("dockview-react").querySelector<HTMLElement>(selector);
  if (node === null) throw new Error(`Missing ${selector}`);
  return node;
};
const pointer = (node: Element, name: "pointerDown" | "pointerMove" | "pointerUp", x: number, y: number) =>
  fireEvent[name](node, { button: 0, clientX: x, clientY: y, pointerId: 11 });

afterEach(cleanup);

describe("floating dock adapter", { concurrent: false }, () => {
  it.effect(
    "renders z-ordered floating panes and preserves a portal target across docked-to-floating movement",
    Effect.fnUntraced(function* () {
      const graph = yield* mount();
      const first = query(`[data-floating-pane='${floating1Id}']`);
      const second = query(`[data-floating-pane='${floating2Id}']`);
      // The pane is chrome around the anchored content box: 32px taller for
      // the drag header, so the kernel geometry inside stays undistorted.
      expect([first.style.left, first.style.top, first.style.width, first.style.height]).toEqual([
        "40px",
        "50px",
        "240px",
        "192px",
      ]);
      expect(Number(first.style.zIndex)).toBeLessThan(Number(second.style.zIndex));
      expect(screen.getByTestId("panel-floating-panel-one").closest("[data-floating-pane]")).toBe(first);

      const input = screen.getByTestId(`input-${dockedPanel.id}`);
      fireEvent.click(screen.getByRole("button", { name: `Float group ${dockedId}` }));
      yield* graph.awaitIdle;
      yield* Effect.promise(() => waitFor(() => expect(screen.getByTestId(`input-${dockedPanel.id}`)).toBe(input)));
      expect(input.closest("[data-floating-pane]")).not.toBeNull();
      graph.dispose();
    })
  );

  it.effect("brings a non-frontmost floating member to front", () =>
    Effect.gen(function* () {
      const graph = yield* mount();
      pointer(query(`[data-floating-pane='${floating1Id}']`), "pointerDown", 100, 120);
      yield* graph.awaitIdle;
      expect(graph.registry.get(graph.workspaceAtom).floating.at(-1)?.root).toEqual(tabs(floating1Id, floatingPanel1));
      graph.dispose();
    })
  );

  it.effect(
    "previews one header move, commits once, and cancels with Escape",
    Effect.fnUntraced(function* () {
      const graph = yield* mount();
      const header = query(`[data-floating-header='${floating2Id}']`);
      const pane = query(`[data-floating-pane='${floating2Id}']`);
      pointer(header, "pointerDown", 340, 90);
      pointer(header, "pointerMove", 390, 120);
      expect([pane.style.left, pane.style.top]).toEqual(["370px", "110px"]);
      pointer(header, "pointerUp", 390, 120);
      yield* graph.awaitIdle;
      expect(graph.registry.get(graph.workspaceAtom).floating.at(-1)?.anchoredBox).toEqual(anchored(370, 110));
      const revision = graph.registry.get(graph.workspaceAtom).revision;
      pointer(header, "pointerDown", 390, 120);
      pointer(header, "pointerMove", 430, 150);
      fireEvent.keyDown(document, { key: "Escape" });
      yield* graph.awaitIdle;
      expect(graph.registry.get(graph.workspaceAtom).revision).toBe(revision);
      expect(query(`[data-floating-pane='${floating2Id}']`).style.left).toBe("370px");
      graph.dispose();
    })
  );

  it.effect("resizes a floating member with a 32px minimum extent", () =>
    Effect.gen(function* () {
      const graph = yield* mount();
      const handle = query(`[data-floating-resize='${floating2Id}']`);
      pointer(handle, "pointerDown", 560, 240);
      pointer(handle, "pointerMove", 600, 280);
      pointer(handle, "pointerUp", 600, 280);
      yield* graph.awaitIdle;
      expect(graph.registry.get(graph.workspaceAtom).floating.at(-1)?.anchoredBox).toEqual(anchored(320, 80, 280, 200));
      graph.dispose();
    })
  );

  it.effect("floats a docked group, then docks it back where it came from", () =>
    Effect.gen(function* () {
      const graph = yield* mount(false, true);
      fireEvent.click(screen.getByRole("button", { name: `Float group ${dockedId}` }));
      yield* graph.awaitIdle;
      expect(graph.registry.get(graph.workspaceAtom).kind).toBe("populated");
      expect(graph.registry.get(graph.workspaceAtom).floating).toHaveLength(1);
      expect(screen.queryByRole("button", { name: `Maximize group ${dockedId}` })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: `Dock group ${dockedId}` }));
      yield* graph.awaitIdle;
      const result = graph.registry.get(graph.workspaceAtom);
      expect(result.kind).toBe("populated");
      if (result.kind === "populated") {
        expect(result.floating).toHaveLength(0);
        expect(result.root._tag).toBe("Split");
        expect(result.root._tag === "Split" && result.root.layout.axis).toBe("horizontal");
        if (result.root._tag === "Split" && result.root.layout.axis === "horizontal") {
          // The float/dock cycle is a round trip: the group returns to the
          // side it left (pre-float placement memory, QA finding R1-03) —
          // not a forced root-right column.
          expect(DockNode.panels(result.root.layout.left)[0]?.id).toBe(dockedPanel.id);
        }
      }
      graph.dispose();
    })
  );

  it.effect("round-trips maximize by button and maximizes from strip background", () =>
    Effect.gen(function* () {
      const graph = yield* mount(false);
      fireEvent.click(screen.getByRole("button", { name: `Maximize group ${dockedId}` }));
      yield* graph.awaitIdle;
      let result = graph.registry.get(graph.workspaceAtom);
      expect(result.kind === "populated" && O.contains(result.maximized, dockedId)).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: `Restore group ${dockedId}` }));
      yield* graph.awaitIdle;
      result = graph.registry.get(graph.workspaceAtom);
      expect(result.kind === "populated" && O.isNone(result.maximized)).toBe(true);
      fireEvent.doubleClick(screen.getByRole("tablist"));
      yield* graph.awaitIdle;
      result = graph.registry.get(graph.workspaceAtom);
      expect(result.kind === "populated" && O.contains(result.maximized, dockedId)).toBe(true);
      graph.dispose();
    })
  );

  it.effect("drops a docked tab onto a floating tab strip before docked and container targets", () =>
    Effect.gen(function* () {
      const graph = yield* mount();
      const tab = query(`[data-panel-id='${dockedPanel.id}']`);
      pointer(tab, "pointerDown", 10, 10);
      pointer(tab, "pointerUp", 100, 55);
      yield* graph.awaitIdle;
      const destination = O.getOrThrow(graph.registry.get(graph.tabsAtom(floating1Id)));
      expect(A.map(TabsNode.panels(destination), (panel) => panel.id)).toContain(dockedPanel.id);
      graph.dispose();
    })
  );
});

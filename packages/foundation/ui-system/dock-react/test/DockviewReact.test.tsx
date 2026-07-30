import {
  ActivatePanelCommand,
  CommandId,
  ComponentPanelView,
  DispatchDockCommand,
  DockCommandEnvelope,
  GroupId,
  HorizontalSplitLayout,
  MovePanelCommand,
  makeDockAtoms,
  Panel,
  PanelId,
  PopulatedWorkspace,
  RendererKey,
  SplitId,
  SplitNode,
  TabPlacement,
  TabsNode,
  TextPanelView,
  UserCommandOrigin,
} from "@beep/dock";
import { DockviewReact } from "@beep/dock-react";
import { activeResizeObserverCount, resize } from "@beep/dock-react/internal/ResizeObserverHarness";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import React from "react";
import { afterEach, describe, expect, vi } from "vitest";
import type { DockAtomGraph, DockPanelProps } from "@beep/dock-react";

const group1 = GroupId.make("group-1");
const group2 = GroupId.make("group-2");
const panel1Id = PanelId.make("panel-1");
const panel2Id = PanelId.make("panel-2");
const panel3Id = PanelId.make("panel-3");

const textPanel = (
  id: PanelId,
  title: string,
  text: string,
  renderMode: "onlyWhenVisible" | "always" = "onlyWhenVisible"
) => Panel.make({ id, title, view: TextPanelView.make({ text }), renderMode });

const componentPanel = (id: PanelId, title: string, renderMode: "onlyWhenVisible" | "always") =>
  Panel.make({
    id,
    title,
    renderMode,
    view: ComponentPanelView.make({ renderer: RendererKey.make("input"), input: {} }),
  });

const makeWorkspace = (
  firstPanels: readonly [Panel, ...ReadonlyArray<Panel>],
  secondPanels?: readonly [Panel, ...ReadonlyArray<Panel>]
) => {
  const first = TabsNode.fromPanels(
    group1,
    firstPanels,
    firstPanels[0].id,
    TabsNode.make({ groupId: group1, active: firstPanels[0] }).metadata
  );
  if (secondPanels === undefined) return PopulatedWorkspace.make({ root: first });
  const second = TabsNode.fromPanels(
    group2,
    secondPanels,
    secondPanels[0].id,
    TabsNode.make({ groupId: group2, active: secondPanels[0] }).metadata
  );
  return PopulatedWorkspace.make({
    root: SplitNode.make({
      splitId: SplitId.make("split-1"),
      layout: HorizontalSplitLayout.make({ left: first, right: second }),
    }),
  });
};

const makeGraph = (
  workspace = makeWorkspace([textPanel(panel1Id, "One", "first"), textPanel(panel2Id, "Two", "second")])
) => makeDockAtoms(workspace);

let operationId = 0;
const dispatch = (graph: DockAtomGraph, command: ActivatePanelCommand | MovePanelCommand): void => {
  operationId += 1;
  const id = `test-operation-${operationId}`;
  graph.registry.set(
    graph.operationAtom,
    DispatchDockCommand.make({
      envelope: DockCommandEnvelope.make({
        commandId: CommandId.make(id),
        origin: UserCommandOrigin.make({ interactionId: id }),
        command,
      }),
    })
  );
};

const sizeRoot = (): void => resize(screen.getByTestId("dockview-react"), { width: 800, height: 400 });

afterEach(() => cleanup());

describe("DockviewReact", { concurrent: false }, () => {
  it.effect("collapses measured overflow while keeping the active tab visible", () =>
    Effect.gen(function* () {
      const panel4Id = PanelId.make("panel-4");
      const graph = yield* makeGraph(
        makeWorkspace([
          textPanel(panel1Id, "One", "first"),
          textPanel(panel2Id, "Two", "second"),
          textPanel(panel3Id, "Three", "third"),
          textPanel(panel4Id, "Four", "fourth"),
        ])
      );
      render(<DockviewReact graph={graph} components={{}} />);
      sizeRoot();
      const strip = screen.getByTestId("dockview-react").querySelector<HTMLElement>("[data-dock-tab-strip]");
      if (strip === null) throw new Error("Missing measured tab strip");
      A.forEach(screen.getAllByRole("tab"), (tab) =>
        vi.spyOn(tab, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ width: 100, height: 32 }))
      );
      resize(strip, { width: 260, height: 32 });
      const trigger = yield* Effect.promise(() => screen.findByRole("button", { name: "Show 2 overflowed tabs" }));
      expect(screen.getByRole("tab", { name: /One/ }).getAttribute("data-active")).toBe("true");
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("menuitem", { name: "Four" }));
      yield* graph.awaitIdle;
      expect(O.getOrThrow(graph.registry.get(graph.activePanelAtom(group1))).id).toBe(panel4Id);
      expect(screen.getByRole("tab", { name: /Four/ }).getAttribute("data-active")).toBe("true");
      graph.dispose();
    })
  );

  it.effect("renders geometry, zipper tabs, and active content", () =>
    Effect.gen(function* () {
      const graph = yield* makeGraph();
      render(<DockviewReact graph={graph} components={{}} options={{ gap: 8 }} />);
      sizeRoot();
      yield* Effect.promise(() => waitFor(() => expect(screen.getByTestId("panel-panel-1").isConnected).toBe(true)));
      const tabs = screen.getAllByRole("tab");
      expect(tabs.map((tab) => tab.getAttribute("data-panel-id"))).toEqual(["panel-1", "panel-2"]);
      const pane = screen.getByTestId("dockview-react").querySelector<HTMLElement>("[data-group-id='group-1']");
      expect(pane?.style.width).toBe("800px");
      expect(pane?.style.height).toBe("400px");
      graph.dispose();
    })
  );

  it.effect("activates a tab and closes panels through typed operations", () =>
    Effect.gen(function* () {
      const graph = yield* makeGraph();
      render(<DockviewReact graph={graph} components={{}} />);
      sizeRoot();
      fireEvent.click(screen.getByText("Two"));
      yield* graph.awaitIdle;
      expect(O.getOrThrow(graph.registry.get(graph.activePanelAtom(group1))).id).toBe(panel2Id);
      fireEvent.click(screen.getByRole("button", { name: "Close Two" }));
      yield* graph.awaitIdle;
      expect(graph.registry.get(graph.panelsAtom).map((panel) => panel.id)).toEqual([panel1Id]);
      fireEvent.click(screen.getByRole("button", { name: "Close One" }));
      yield* graph.awaitIdle;
      expect(graph.registry.get(graph.workspaceAtom).kind).toBe("empty");
      graph.dispose();
    })
  );

  it.effect("preserves portal DOM identity across a group move and honors both render modes", () =>
    Effect.gen(function* () {
      const moving = componentPanel(panel1Id, "Moving", "onlyWhenVisible");
      const always = componentPanel(panel2Id, "Always", "always");
      const graph = yield* makeGraph(makeWorkspace([moving, always], [textPanel(panel3Id, "Other", "other")]));
      const Input = (_props: DockPanelProps) => <input data-testid={`input-${_props.api.id}`} defaultValue="kept" />;
      render(<DockviewReact graph={graph} components={{ input: Input }} />);
      sizeRoot();
      const movingNode = yield* Effect.promise(() => screen.findByTestId("input-panel-1"));
      const alwaysTarget = screen.getByTestId("input-panel-2").parentElement;
      expect(alwaysTarget?.isConnected).toBe(true);
      expect(alwaysTarget?.hasAttribute("hidden")).toBe(true);
      dispatch(graph, MovePanelCommand.make({ panelId: panel1Id, target: TabPlacement.make({ groupId: group2 }) }));
      yield* graph.awaitIdle;
      yield* Effect.promise(() => waitFor(() => expect(screen.getByTestId("input-panel-1")).toBe(movingNode)));
      expect(movingNode.closest("[data-content-host]")?.getAttribute("data-content-host")).toBe("group-2");
      dispatch(graph, ActivatePanelCommand.make({ panelId: panel3Id }));
      yield* graph.awaitIdle;
      yield* Effect.promise(() => waitFor(() => expect(movingNode.parentElement?.isConnected).toBe(false)));
      expect(alwaysTarget?.isConnected).toBe(true);
      graph.dispose();
    })
  );

  it.effect("renders missing-renderer diagnostics and the empty watermark", () =>
    Effect.gen(function* () {
      const missing = Panel.make({
        id: panel1Id,
        title: "Missing",
        view: ComponentPanelView.make({ renderer: RendererKey.make("not-registered"), input: {} }),
      });
      const graph = yield* makeGraph(makeWorkspace([missing]));
      const view = render(<DockviewReact graph={graph} components={{}} />);
      sizeRoot();
      expect((yield* Effect.promise(() => screen.findByRole("alert"))).textContent).toContain("not-registered");
      view.unmount();
      graph.dispose();

      const empty = yield* makeDockAtoms();
      render(<DockviewReact graph={empty} components={{}} watermarkComponent={() => <div>Watermark</div>} />);
      expect(screen.getByText("Watermark").isConnected).toBe(true);
      empty.dispose();
    })
  );

  it.effect("treats prototype renderer keys as missing", () =>
    Effect.gen(function* () {
      const inherited = Panel.make({
        id: panel1Id,
        title: "Inherited",
        view: ComponentPanelView.make({ renderer: RendererKey.make("constructor"), input: {} }),
      });
      const graph = yield* makeGraph(makeWorkspace([inherited]));
      render(<DockviewReact graph={graph} components={{}} />);
      sizeRoot();
      expect((yield* Effect.promise(() => screen.findByRole("alert"))).textContent).toContain("constructor");
      graph.dispose();
    })
  );

  it.effect("treats prototype tab renderer keys as missing", () =>
    Effect.gen(function* () {
      const inherited = Panel.make({
        id: panel1Id,
        title: "Inherited Tab",
        view: TextPanelView.make({ text: "first" }),
        tabComponent: O.some(RendererKey.make("toString")),
      });
      const graph = yield* makeGraph(makeWorkspace([inherited]));
      render(<DockviewReact graph={graph} components={{}} tabComponents={{}} />);
      sizeRoot();
      expect((yield* Effect.promise(() => screen.findByRole("tab"))).textContent).toContain("Inherited Tab");
      graph.dispose();
    })
  );

  it.effect("survives StrictMode remount cleanup without taking ownership of the graph", () =>
    Effect.gen(function* () {
      const graph = yield* makeGraph();
      const dispose = vi.spyOn(graph, "dispose");
      const onReady = vi.fn();
      const view = render(
        <React.StrictMode>
          <DockviewReact graph={graph} components={{}} onReady={onReady} />
        </React.StrictMode>
      );
      sizeRoot();
      expect((yield* Effect.promise(() => screen.findByText("One"))).isConnected).toBe(true);
      view.unmount();
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(dispose).not.toHaveBeenCalled();
      expect(activeResizeObserverCount()).toBe(0);
      graph.dispose();
    })
  );
});

import "@testing-library/jest-dom/vitest";
import { SaveDockSnapshot, validateWorkspace } from "@beep/dock";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import {
  DOCK_SNAPSHOT_KEY,
  defaultDesktopWorkspace,
  dockPersistenceBindingAtom,
  isPanelActive,
  isPanelOpen,
  LEGACY_DOCK_SNAPSHOT_KEYS,
  makeDesktopDockGraph,
  panelOperation,
} from "@/workspace/dock.atoms";

describe("Desktop dock shell", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage.removeItem(DOCK_SNAPSHOT_KEY);
    globalThis.localStorage.removeItem(LEGACY_DOCK_SNAPSHOT_KEYS[0]);
  });

  it("ships the locked core-cluster default layout, kernel-validated", () => {
    const validated = Effect.runSync(validateWorkspace(defaultDesktopWorkspace));

    expect(validated.kind).toBe("populated");
    // Actives: one per group — Explorer left, Graph center, Inspector right,
    // Chat along the shell row.
    expect(isPanelActive(validated, "ontology-explorer")).toBe(true);
    expect(isPanelActive(validated, "ontology-graph")).toBe(true);
    expect(isPanelActive(validated, "ontology-inspector")).toBe(true);
    expect(isPanelActive(validated, "chat")).toBe(true);
    // Open-but-inactive tabs of the core cluster.
    expect(isPanelOpen(validated, "ontology-document")).toBe(true);
    expect(isPanelOpen(validated, "ontology-source")).toBe(true);
    expect(isPanelOpen(validated, "ontology-changelog")).toBe(true);
    expect(isPanelOpen(validated, "home")).toBe(true);
    expect(isPanelOpen(validated, "sync")).toBe(true);
    // Heavy tools start closed; the rail menu opens them.
    expect(isPanelOpen(validated, "ontology-sparql")).toBe(false);
    expect(isPanelOpen(validated, "ontology-validation")).toBe(false);
    expect(isPanelOpen(validated, "ontology-metrics")).toBe(false);
  });

  it("round-trips the workspace through the localStorage snapshot store", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const first = yield* makeDesktopDockGraph;
        const initial = first.registry.get(first.workspaceAtom);
        first.registry.set(first.operationAtom, panelOperation(initial, "ontology-source"));
        yield* first.awaitIdle;
        first.registry.set(first.operationAtom, SaveDockSnapshot.make({}));
        yield* first.awaitIdle;
        first.dispose();

        expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).not.toBeNull();

        // A fresh boot restores the saved layout instead of the default.
        const second = yield* makeDesktopDockGraph;
        const restored = second.registry.get(second.workspaceAtom);
        second.dispose();

        expect(isPanelActive(restored, "ontology-source")).toBe(true);
        expect(isPanelActive(restored, "ontology-graph")).toBe(false);
      })
    ));

  it("falls back to the default workspace and clears a poisoned snapshot", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        globalThis.localStorage.setItem(DOCK_SNAPSHOT_KEY, "not a dock snapshot");

        const graph = yield* makeDesktopDockGraph;
        const workspace = graph.registry.get(graph.workspaceAtom);
        const panels = graph.registry.get(graph.panelsAtom);
        graph.dispose();

        expect(isPanelActive(workspace, "chat")).toBe(true);
        expect(panels.length).toBe(9);
        expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).toBeNull();
      })
    ));

  it("removes retired v1 snapshot keys at boot without touching the default", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        // A v1 snapshot decodes but references the retired coarse `ontology`
        // renderer; the boot must delete the key rather than restore from it.
        globalThis.localStorage.setItem(LEGACY_DOCK_SNAPSHOT_KEYS[0], "stale v1 snapshot");

        const graph = yield* makeDesktopDockGraph;
        const workspace = graph.registry.get(graph.workspaceAtom);
        graph.dispose();

        expect(globalThis.localStorage.getItem(LEGACY_DOCK_SNAPSHOT_KEYS[0])).toBeNull();
        expect(isPanelActive(workspace, "chat")).toBe(true);
        expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).toBeNull();
      })
    ));

  it("persists automatically once workspace changes settle (debounced binding)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const graph = yield* makeDesktopDockGraph;
        const release = graph.registry.mount(dockPersistenceBindingAtom(graph));
        const workspace = graph.registry.get(graph.workspaceAtom);
        graph.registry.set(graph.operationAtom, panelOperation(workspace, "ontology-source"));
        yield* graph.awaitIdle;
        // Wait past the debounce quiet period, then let the save drain.
        yield* Effect.sleep("600 millis");
        yield* graph.awaitIdle;
        const stored = globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY);
        release();
        graph.dispose();
        expect(stored).not.toBeNull();
      })
    ));

  it("keeps chat mounted while another panel in its group is active", () => {
    const { container, unmount } = render(<App />);
    const screen = within(container);

    return screen
      .findByTestId("chat-app")
      .then((chatApp) => {
        expect(chatApp).toBeInTheDocument();

        const homeButton = screen.getByRole("button", { name: "Home" });
        fireEvent.click(homeButton);

        return screen.findByRole("button", { name: "Home", current: "page" }).then((activeButton) => {
          expect(activeButton).toBeInTheDocument();
          // Keep-alive means the SAME node survives — not a remounted lookalike.
          // Node identity fails if the renderer map hands React a fresh
          // component type per workspace change (the P0 the review caught).
          expect(screen.getByTestId("chat-app")).toBe(chatApp);
          expect(screen.getByRole("button", { name: "Chat" })).not.toHaveAttribute("aria-current", "page");
        });
      })
      .finally(unmount);
  });

  it("opens a closed ontology panel from the rail's Ontology menu", () => {
    const { container, unmount } = render(<App />);
    const screen = within(container);

    return screen
      .findByTestId("chat-app")
      .then(() => {
        fireEvent.click(screen.getByRole("button", { name: "Ontology" }));
        const item = screen.getByRole("menuitem", { name: "SPARQL" });
        fireEvent.click(item);

        return screen.findByRole("tab", { name: /SPARQL/ }).then((tab) => {
          expect(tab).toBeInTheDocument();
          // Selecting an entry dismisses the menu.
          expect(screen.queryByRole("menu")).toBeNull();
        });
      })
      .finally(unmount);
  });
});

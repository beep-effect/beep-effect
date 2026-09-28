import "@testing-library/jest-dom/vitest";
import { SaveDockSnapshot } from "@beep/dock/Dock.protocol";
import { validateWorkspace } from "@beep/dock/Dock.reducer";
import { it } from "@beep/test-runner";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { AtomRegistry } from "effect/reactivity";
import { App } from "@/App";
import {
  DESKTOP_PANELS,
  DOCK_SNAPSHOT_KEY,
  defaultDesktopWorkspace,
  dockPersistenceBindingAtom,
  isPanelActive,
  isPanelOpen,
  makeDesktopDockGraph,
  makeResetDockSnapshotAtom,
  panelOperation,
} from "@/workspace/dock.atoms";

describe("Desktop dock shell", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage.removeItem(DOCK_SNAPSHOT_KEY);
  });

  it.effect(
    "ships the locked core-cluster default layout, kernel-validated",
    Effect.fnUntraced(function* () {
      const validated = yield* validateWorkspace(defaultDesktopWorkspace);

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
      expect(isPanelOpen(validated, "editor-proof")).toBe(false);
      expect(isPanelOpen(validated, "contradiction-triage")).toBe(false);
      // Heavy tools start closed; the rail menu opens them.
      expect(isPanelOpen(validated, "ontology-sparql")).toBe(false);
      expect(isPanelOpen(validated, "ontology-validation")).toBe(false);
      expect(isPanelOpen(validated, "ontology-metrics")).toBe(false);
    })
  );

  it("registers contradiction triage as the thirteenth direct shell panel", () => {
    const panel = DESKTOP_PANELS.find(({ key }) => key === "contradiction-triage");

    expect(DESKTOP_PANELS).toHaveLength(14);
    expect(panel).toEqual({
      cluster: "shell",
      description: "Review contradictory beliefs against their verified source text.",
      key: "contradiction-triage",
      label: "Beliefs",
      title: "Contradiction Triage",
    });
  });

  it.effect(
    "round-trips the workspace through the localStorage snapshot store",
    Effect.fnUntraced(function* () {
      const first = yield* Effect.acquireRelease(makeDesktopDockGraph, (graph) => Effect.sync(() => graph.dispose()));
      const initial = first.registry.get(first.workspaceAtom);
      first.registry.set(first.operationAtom, panelOperation(initial, "ontology-source"));
      yield* first.awaitIdle;
      first.registry.set(first.operationAtom, SaveDockSnapshot.make({}));
      yield* first.awaitIdle;
      first.dispose();

      expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).not.toBeNull();

      // A fresh boot restores the saved layout instead of the default.
      const second = yield* Effect.acquireRelease(makeDesktopDockGraph, (graph) => Effect.sync(() => graph.dispose()));
      const restored = second.registry.get(second.workspaceAtom);
      second.dispose();

      expect(isPanelActive(restored, "ontology-source")).toBe(true);
      expect(isPanelActive(restored, "ontology-graph")).toBe(false);
    })
  );

  it.effect(
    "falls back to the default workspace and clears a poisoned snapshot",
    Effect.fnUntraced(function* () {
      globalThis.localStorage.setItem(DOCK_SNAPSHOT_KEY, "not a dock snapshot");

      const graph = yield* Effect.acquireRelease(makeDesktopDockGraph, (graph) => Effect.sync(() => graph.dispose()));
      const workspace = graph.registry.get(graph.workspaceAtom);
      const panels = graph.registry.get(graph.panelsAtom);
      graph.dispose();

      expect(isPanelActive(workspace, "chat")).toBe(true);
      expect(panels.length).toBe(9);
      expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).toBeNull();
    })
  );

  it.effect(
    "persists automatically once workspace changes settle (debounced binding)",
    Effect.fnUntraced(function* () {
      expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).toBeNull();
      const graph = yield* Effect.acquireRelease(makeDesktopDockGraph, (graph) => Effect.sync(() => graph.dispose()));
      const release = yield* Effect.acquireRelease(
        Effect.sync(() => graph.registry.mount(dockPersistenceBindingAtom(graph))),
        (release) => Effect.sync(release)
      );
      const workspace = graph.registry.get(graph.workspaceAtom);
      graph.registry.set(graph.operationAtom, panelOperation(workspace, "ontology-source"));
      yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true });
      // Observe the mounted binding's completed write within the original 600 ms budget.
      const stored = yield* Effect.promise(() =>
        waitFor(
          () => {
            const snapshot = globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY);
            expect(snapshot).not.toBeNull();
            return snapshot;
          },
          { timeout: 600 }
        )
      );
      release();
      graph.dispose();
      expect(stored).not.toBeNull();
    })
  );

  it.effect(
    "clears the persisted layout through the storage runtime before reload",
    Effect.fnUntraced(function* () {
      globalThis.localStorage.setItem(DOCK_SNAPSHOT_KEY, "saved layout");
      let reloadRequested = false;
      const resetDockSnapshotAtom = makeResetDockSnapshotAtom(
        Effect.sync(() => {
          expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).toBeNull();
          reloadRequested = true;
        })
      );
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const release = yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(resetDockSnapshotAtom)),
        (release) => Effect.sync(release)
      );
      registry.set(resetDockSnapshotAtom, void 0);
      yield* AtomRegistry.getResult(registry, resetDockSnapshotAtom);

      expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).toBeNull();
      expect(reloadRequested).toBe(true);
      release();
      registry.dispose();
    })
  );

  it("keeps chat mounted while another panel in its group is active", () => {
    const { container, unmount } = render(<App />);
    const screen = within(container);

    return screen
      .findByTestId("chat-app")
      .then((chatApp) => {
        expect(chatApp).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Beliefs" })).toBeNull();

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
        const disclosure = screen.getByRole("button", { name: "Ontology" });
        expect(disclosure).not.toHaveAttribute("aria-haspopup");
        fireEvent.click(disclosure);
        expect(disclosure).toHaveAttribute("aria-controls", "ontology-panel-disclosure");
        const item = screen.getByRole("button", { name: "SPARQL" });
        fireEvent.click(item);

        return screen.findByRole("tab", { name: /SPARQL/ }).then((tab) => {
          expect(tab).toBeInTheDocument();
          // Selecting an entry keeps the disclosure open for successive panel
          // picks; outside press and Escape still dismiss it.
          expect(screen.getByRole("button", { name: "SPARQL" })).toBeInTheDocument();
        });
      })
      .finally(unmount);
  });
});

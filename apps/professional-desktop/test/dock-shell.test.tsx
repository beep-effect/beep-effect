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
  isSurfaceActive,
  makeDesktopDockGraph,
  surfaceOperation,
} from "@/workspace/dock.atoms";

describe("Desktop dock shell", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage.removeItem(DOCK_SNAPSHOT_KEY);
  });

  it("ships a default workspace the kernel validates", () => {
    const validated = Effect.runSync(validateWorkspace(defaultDesktopWorkspace));

    expect(validated.kind).toBe("populated");
    expect(isSurfaceActive(validated, "chat")).toBe(true);
  });

  it("round-trips the workspace through the localStorage snapshot store", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const first = yield* makeDesktopDockGraph;
        const initial = first.registry.get(first.workspaceAtom);
        first.registry.set(first.operationAtom, surfaceOperation(initial, "ontology"));
        yield* first.awaitIdle;
        first.registry.set(first.operationAtom, SaveDockSnapshot.make({}));
        yield* first.awaitIdle;
        first.dispose();

        expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).not.toBeNull();

        // A fresh boot restores the saved layout instead of the default.
        const second = yield* makeDesktopDockGraph;
        const restored = second.registry.get(second.workspaceAtom);
        second.dispose();

        expect(isSurfaceActive(restored, "ontology")).toBe(true);
        expect(isSurfaceActive(restored, "chat")).toBe(false);
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

        expect(isSurfaceActive(workspace, "chat")).toBe(true);
        expect(panels.length).toBe(4);
        expect(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)).toBeNull();
      })
    ));

  it("persists automatically once workspace changes settle (debounced binding)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const graph = yield* makeDesktopDockGraph;
        const release = graph.registry.mount(dockPersistenceBindingAtom(graph));
        const workspace = graph.registry.get(graph.workspaceAtom);
        graph.registry.set(graph.operationAtom, surfaceOperation(workspace, "ontology"));
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

  it("keeps chat mounted while another surface is active", () => {
    const { container, unmount } = render(<App />);
    const screen = within(container);

    return screen
      .findByTestId("chat-app")
      .then((chatApp) => {
        expect(chatApp).toBeInTheDocument();

        const ontologyTab = screen.getByRole("button", { name: "Ontology" });
        fireEvent.click(ontologyTab);

        return screen.findByRole("button", { name: "Ontology", current: "page" }).then((activeTab) => {
          expect(activeTab).toBeInTheDocument();
          // Keep-alive means the SAME node survives — not a remounted lookalike.
          // Node identity fails if the renderer map hands React a fresh
          // component type per workspace change (the P0 the review caught).
          expect(screen.getByTestId("chat-app")).toBe(chatApp);
          expect(screen.getByRole("button", { name: "Chat" })).not.toHaveAttribute("aria-current", "page");
        });
      })
      .finally(unmount);
  });
});

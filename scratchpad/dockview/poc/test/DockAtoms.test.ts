import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { makeDockAtoms } from "../DockAtoms.ts";
import { DockWorkspace } from "../Domain.ts";
import { clearWorkspace, groupOne, openPanelOne, panelOne, restoreRequest } from "./Fixtures.ts";

const workspaceEquals = S.toEquivalence(DockWorkspace);

describe("DockAtoms", () => {
  it.effect("publishes one live-state update and refreshes the service-backed snapshot query", () =>
    Effect.acquireUseRelease(
      Effect.sync(AtomRegistry.make),
      (registry) =>
        Effect.gen(function* () {
          const graph = makeDockAtoms();
          registry.mount(graph.workspaceAtom);
          registry.mount(graph.persistedSnapshotAtom);

          registry.set(graph.dispatchAtom, openPanelOne);
          const opened = yield* AtomRegistry.getResult(registry, graph.dispatchAtom);

          expect(registry.get(graph.groupCountAtom)).toBe(1);
          expect(registry.get(graph.workspaceAtom)).toEqual(opened.state);
          expect(registry.get(graph.panelAtom(panelOne.id))).toEqual(O.some(panelOne));
          expect(registry.get(graph.activePanelAtom(groupOne))).toEqual(O.some(panelOne));

          registry.set(graph.saveSnapshotAtom, undefined);
          yield* AtomRegistry.getResult(registry, graph.saveSnapshotAtom);
          const persisted = registry.get(graph.persistedSnapshotAtom);
          expect(AsyncResult.isSuccess(persisted)).toBe(true);
          expect(O.isSome(AsyncResult.getOrElse(persisted, () => O.none()))).toBe(true);

          registry.set(graph.dispatchAtom, clearWorkspace);
          yield* AtomRegistry.getResult(registry, graph.dispatchAtom);
          expect(registry.get(graph.workspaceAtom).kind).toBe("empty");

          registry.set(graph.restoreSnapshotAtom, restoreRequest);
          const restored = yield* AtomRegistry.getResult(registry, graph.restoreSnapshotAtom);
          expect(restored.events[0].kind).toBe("workspaceRestored");
          expect(registry.get(graph.groupCountAtom)).toBe(1);
          expect(workspaceEquals(registry.get(graph.workspaceAtom), opened.state)).toBe(true);
        }),
      (registry) => Effect.sync(() => registry.dispose())
    )
  );

  it.effect("keeps state unchanged when unknown command decoding fails", () =>
    Effect.acquireUseRelease(
      Effect.sync(AtomRegistry.make),
      (registry) =>
        Effect.gen(function* () {
          const graph = makeDockAtoms();
          registry.set(graph.dispatchAtom, openPanelOne);
          yield* AtomRegistry.getResult(registry, graph.dispatchAtom);
          const before = registry.get(graph.workspaceAtom);

          registry.set(graph.dispatchUnknownAtom, { commandId: "invalid" });
          const failure = yield* Effect.flip(AtomRegistry.getResult(registry, graph.dispatchUnknownAtom));

          expect(failure._tag).toBe("DockInputError");
          expect(workspaceEquals(registry.get(graph.workspaceAtom), before)).toBe(true);
        }),
      (registry) => Effect.sync(() => registry.dispose())
    )
  );
});

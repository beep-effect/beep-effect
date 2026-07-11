import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { makeDockAtoms } from "../DockAtoms.ts";
import { DockWorkspace } from "../Domain.ts";
import {
  activatePanelOne,
  clearWorkspace,
  dispatch,
  dispatchUnknown,
  duplicatePanelWorkspace,
  groupOne,
  openPanelOne,
  openPanelTwo,
  panelOne,
  restoreSnapshot,
  saveSnapshot,
} from "./Fixtures.ts";

const workspaceEquals = DockWorkspace.equals;

describe("DockAtoms", () => {
  it.effect("owns one registry lifetime and refreshes service-backed persistence", () =>
    Effect.acquireUseRelease(
      makeDockAtoms(),
      Effect.fnUntraced(function* (graph) {
        graph.registry.set(graph.operationAtom, dispatch(openPanelOne));
        const openedResult = yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, {
          suspendOnWaiting: true,
        });
        const opened = graph.registry.get(graph.workspaceAtom);

        expect(openedResult.kind).toBe("mutationCompleted");
        expect(graph.registry.get(graph.groupCountAtom)).toBe(1);
        expect(graph.registry.get(graph.panelAtom(panelOne.id))).toEqual(O.some(panelOne));
        expect(graph.registry.get(graph.activePanelAtom(groupOne))).toEqual(O.some(panelOne));

        graph.registry.set(graph.operationAtom, saveSnapshot);
        const saved = yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, {
          suspendOnWaiting: true,
        });
        const persisted = graph.registry.get(graph.persistedSnapshotAtom);
        expect(saved.kind).toBe("snapshotSaved");
        expect(AsyncResult.isSuccess(persisted)).toBe(true);
        expect(O.isSome(AsyncResult.getOrElse(persisted, () => O.none()))).toBe(true);

        graph.registry.set(graph.operationAtom, dispatch(clearWorkspace));
        yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true });
        expect(graph.registry.get(graph.workspaceAtom).kind).toBe("empty");

        graph.registry.set(graph.operationAtom, restoreSnapshot);
        const restored = yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, {
          suspendOnWaiting: true,
        });
        const restoredWorkspace = graph.registry.get(graph.workspaceAtom);
        expect(restored).toMatchObject({
          kind: "mutationCompleted",
          outcome: { result: { _tag: "Changed" } },
        });
        expect(graph.registry.get(graph.groupCountAtom)).toBe(1);
        expect(A.map(graph.registry.get(graph.panelsAtom), (panel) => panel.id)).toEqual([panelOne.id]);
        expect(restoredWorkspace.revision).toBe(3);
        expect(workspaceEquals(restoredWorkspace, opened)).toBe(false);
      }),
      (graph) => Effect.sync(graph.dispose)
    )
  );

  it.effect("serializes rapid typed and unknown commands without cancellation or stale writes", () =>
    Effect.acquireUseRelease(
      makeDockAtoms(),
      Effect.fnUntraced(function* (graph) {
        graph.registry.set(graph.operationAtom, dispatch(openPanelOne));
        graph.registry.set(graph.operationAtom, dispatchUnknown(openPanelTwo));

        yield* graph.awaitIdle;
        yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true });
        const state = graph.registry.get(graph.workspaceAtom);
        expect(A.map(graph.registry.get(graph.panelsAtom), (panel) => panel.id)).toEqual([panelOne.id, "panel-two"]);
        expect(state.revision).toBe(2);
      }),
      (graph) => Effect.sync(graph.dispose)
    )
  );

  it.effect("does not publish live state for an explicit unchanged outcome", () =>
    Effect.acquireUseRelease(
      makeDockAtoms(),
      Effect.fnUntraced(function* (graph) {
        graph.registry.set(graph.operationAtom, dispatch(openPanelOne));
        yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true });
        const before = graph.registry.get(graph.workspaceAtom);
        let publications = 0;
        const unsubscribe = graph.registry.subscribe(graph.workspaceAtom, () => {
          publications += 1;
        });

        graph.registry.set(graph.operationAtom, dispatch(activatePanelOne));
        const result = yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, {
          suspendOnWaiting: true,
        });
        unsubscribe();

        expect(result).toMatchObject({
          kind: "mutationCompleted",
          outcome: { result: { _tag: "Unchanged", reason: "panel-already-active" } },
        });
        expect(publications).toBe(0);
        expect(workspaceEquals(graph.registry.get(graph.workspaceAtom), before)).toBe(true);
      }),
      (graph) => Effect.sync(graph.dispose)
    )
  );

  it.effect("keeps state unchanged for malformed input and a missing snapshot", () =>
    Effect.acquireUseRelease(
      makeDockAtoms(),
      Effect.fnUntraced(function* (graph) {
        const before = graph.registry.get(graph.workspaceAtom);

        graph.registry.set(graph.operationAtom, dispatchUnknown({ commandId: "invalid" }));
        const commandFailure = yield* Effect.flip(
          AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true })
        );
        expect(commandFailure._tag).toBe("DockInputError");
        expect(workspaceEquals(graph.registry.get(graph.workspaceAtom), before)).toBe(true);

        graph.registry.set(graph.operationAtom, restoreSnapshot);
        const restoreFailure = yield* Effect.flip(
          AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true })
        );
        expect(restoreFailure._tag).toBe("DockSnapshotMissing");
        expect(workspaceEquals(graph.registry.get(graph.workspaceAtom), before)).toBe(true);
      }),
      (graph) => Effect.sync(graph.dispose)
    )
  );

  it.effect("rejects globally invalid initial state before exposing a registry", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(makeDockAtoms(duplicatePanelWorkspace));
      expect(failure).toMatchObject({ _tag: "DockInvariantViolation", reason: "duplicate-panel-id" });
    })
  );
});

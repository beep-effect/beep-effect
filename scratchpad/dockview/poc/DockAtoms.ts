/**
 * Headless Effect Atom adapter for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect, Layer } from "effect";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import { Atom } from "effect/unstable/reactivity";
import {
  DockEngine,
  DockEngineLive,
  DockSnapshotStore,
  makeDockSnapshotStoreMemory,
  requireSnapshot,
} from "./DockEngine.ts";
import type { DockCommandEnvelope, DockWorkspace, GroupId, PanelId, RestoreSnapshotRequest } from "./Domain.ts";
import {
  emptyDockWorkspace,
  findPanelInWorkspace,
  findTabsInWorkspace,
  groupCount,
  panelsInWorkspace,
} from "./Reducer.ts";

const SNAPSHOT_REACTIVITY_KEY = "dockview-snapshot";

/** Console logging layer installed into every isolated POC Atom factory. */
export const DockAtomObservabilityLive: Layer.Layer<never> = Logger.layer([Logger.consolePretty()]);

/**
 * Creates one isolated reactive Dockview instance.
 *
 * Live layout state belongs to a private writable atom. `DockEngine` is a
 * stateless capability, while snapshot persistence is service-backed external
 * state and therefore uses an explicit Reactivity key.
 */
export const makeDockAtoms = (
  initial: DockWorkspace = emptyDockWorkspace,
  engineLayer: Layer.Layer<DockEngine> = DockEngineLive,
  snapshotStoreLayer: Layer.Layer<DockSnapshotStore> = makeDockSnapshotStoreMemory()
) => {
  const factory = Atom.context({
    memoMap: Layer.makeMemoMapUnsafe(),
  });
  factory.addGlobalLayer(DockAtomObservabilityLive);

  const runtime = factory(Layer.mergeAll(engineLayer, snapshotStoreLayer));

  const stateAtom = Atom.make(initial).pipe(Atom.keepAlive);

  /** Read-only authoritative workspace projection. */
  const workspaceAtom = Atom.readable((get) => get(stateAtom)).pipe(Atom.keepAlive);

  /** All panels in tree order. */
  const panelsAtom = Atom.map(workspaceAtom, panelsInWorkspace);

  /** Number of non-empty tab groups. */
  const groupCountAtom = Atom.map(workspaceAtom, groupCount);

  /** Per-panel projection without component-local state. */
  const panelAtom = Atom.family((panelId: PanelId) =>
    Atom.map(workspaceAtom, (state) => findPanelInWorkspace(state, panelId))
  );

  /** Per-group projection without component-local state. */
  const tabsAtom = Atom.family((groupId: GroupId) =>
    Atom.map(workspaceAtom, (state) => findTabsInWorkspace(state, groupId))
  );

  /** Active panel projection for one group. */
  const activePanelAtom = Atom.family((groupId: GroupId) =>
    Atom.map(workspaceAtom, (state) => O.map(findTabsInWorkspace(state, groupId), (tabs) => tabs.active))
  );

  /** Typed command mutation. State is written exactly once after success. */
  const dispatchAtom = runtime.fn<DockCommandEnvelope>()(
    Effect.fn("DockAtoms.dispatch")(function* (envelope, get) {
      const engine = yield* DockEngine;
      const result = yield* engine.transition(get(stateAtom), envelope);
      get.set(stateAtom, result.state);
      return result;
    })
  );

  /** Unknown-input command mutation with schema decoding at the boundary. */
  const dispatchUnknownAtom = runtime.fn<unknown>()(
    Effect.fn("DockAtoms.dispatchUnknown")(function* (input, get) {
      const engine = yield* DockEngine;
      const envelope = yield* engine.decodeCommand(input);
      const result = yield* engine.transition(get(stateAtom), envelope);
      get.set(stateAtom, result.state);
      return result;
    })
  );

  /** Service-backed persisted snapshot query. */
  const persistedSnapshotAtom = runtime
    .atom(DockSnapshotStore.use((store) => store.load))
    .pipe(factory.withReactivity([SNAPSHOT_REACTIVITY_KEY]), Atom.keepAlive);

  /** Persists the current state and invalidates only the snapshot query. */
  const saveSnapshotAtom = runtime.fn<void>()(
    Effect.fn("DockAtoms.saveSnapshot")(function* (_, get) {
      const engine = yield* DockEngine;
      const store = yield* DockSnapshotStore;
      const snapshot = yield* engine.encodeSnapshot(get(stateAtom));
      yield* store.save(snapshot);
      return snapshot;
    }),
    { reactivityKeys: [SNAPSHOT_REACTIVITY_KEY] }
  );

  /** Decodes and validates the complete persisted snapshot before one write. */
  const restoreSnapshotAtom = runtime.fn<RestoreSnapshotRequest>()(
    Effect.fn("DockAtoms.restoreSnapshot")(function* (request, get) {
      const engine = yield* DockEngine;
      const store = yield* DockSnapshotStore;
      const snapshot = yield* requireSnapshot(yield* store.load);
      const result = yield* engine.restore(get(stateAtom), snapshot, request);
      get.set(stateAtom, result.state);
      return result;
    })
  );

  return {
    runtime,
    workspaceAtom,
    panelsAtom,
    groupCountAtom,
    panelAtom,
    tabsAtom,
    activePanelAtom,
    dispatchAtom,
    dispatchUnknownAtom,
    persistedSnapshotAtom,
    saveSnapshotAtom,
    restoreSnapshotAtom,
  };
};

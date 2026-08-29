/**
 * Headless Effect Atom session for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Context, Effect, Layer, Logger } from "effect";
import { dual } from "effect/Function";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import type {
  DockAtomFeedEntry,
  DockAtomOperation,
  DockAtomOperationOutcome,
  DockAtomSessionError,
} from "./Dock.protocol.ts";

export {
  /**
   * @category protocols
   * @since 0.0.0
   */
  DockAtomSessionError,
} from "./Dock.protocol.ts";

import { validateWorkspace } from "./Dock.reducer.ts";
import { DockWorkspace } from "./Dock.tree.ts";
import { DockEngineLive, DockSnapshotStore, makeDockSnapshotStoreMemory } from "./DockEngine.service.ts";
import { DockAtomSession, makeDockAtomSessionLayer, SNAPSHOT_REACTIVITY_KEY } from "./internal/DockAtoms.session.ts";
import type { GroupId, PanelId } from "./Dock.ids.ts";
import type { DockEngine } from "./DockEngine.service.ts";

/**
 * Console observability layer installed in each isolated Atom graph.
 *
 * **Example** (Installing console observability)
 *
 * ```ts
 * import { DockAtomObservabilityLive } from "@beep/dock"
 * import { Effect, Layer } from "effect"
 *
 * const status = Effect.runSync(
 *   Layer.build(DockAtomObservabilityLive).pipe(Effect.as("observability-ready"), Effect.scoped)
 * )
 * console.log(status)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const DockAtomObservabilityLive: Layer.Layer<never> = Logger.layer([Logger.consolePretty()]);

const makeDockAtomGraph = <E>(
  initial: DockWorkspace,
  servicesLayer: Layer.Layer<DockEngine | DockSnapshotStore, E>
) => {
  const factory = Atom.context({
    memoMap: Layer.makeMemoMapUnsafe(),
  });
  factory.addGlobalLayer(DockAtomObservabilityLive);

  const stateAtom = Atom.make(initial).pipe(Atom.keepAlive);
  const operationResultAtom = Atom.make<AsyncResult.AsyncResult<DockAtomOperationOutcome, DockAtomSessionError>>(
    AsyncResult.initial()
  ).pipe(Atom.keepAlive);
  const operationFeedAtom = Atom.make<ReadonlyArray<DockAtomFeedEntry>>([]).pipe(Atom.keepAlive);
  const operationFeed = Atom.readable((get) => get(operationFeedAtom)).pipe(Atom.keepAlive);
  const sessionLayer = makeDockAtomSessionLayer(stateAtom, operationResultAtom, operationFeedAtom).pipe(
    Layer.provideMerge(servicesLayer)
  );
  const runtime = factory(sessionLayer);

  /** Read-only authoritative workspace projection. */
  const workspaceAtom = Atom.readable((get) => get(stateAtom)).pipe(Atom.keepAlive);

  /** All panels in tree order. */
  const panelsAtom = Atom.map(workspaceAtom, DockWorkspace.panels);

  /** Number of non-empty tab groups. */
  const groupCountAtom = Atom.map(workspaceAtom, DockWorkspace.groupCount);

  /** Per-panel projection without component-local state. */
  const panelAtom = Atom.family((panelId: PanelId) => Atom.map(workspaceAtom, DockWorkspace.findPanel(panelId)));

  /** Per-group projection without component-local state. */
  const tabsAtom = Atom.family((groupId: GroupId) => Atom.map(workspaceAtom, DockWorkspace.findTabs(groupId)));

  /** Selected panel projection for one group. */
  const activePanelAtom = Atom.family((groupId: GroupId) =>
    Atom.map(workspaceAtom, DockWorkspace.findActivePanel(groupId))
  );

  /** Service-backed persisted snapshot query. */
  const persistedSnapshotAtom = runtime
    .atom(DockSnapshotStore.use((store) => store.load))
    .pipe(factory.withReactivity([SNAPSHOT_REACTIVITY_KEY]), Atom.keepAlive);

  const registry = AtomRegistry.make();
  const releaseRuntime = registry.mount(runtime);
  const releasePersistence = registry.mount(persistedSnapshotAtom);

  const disposeBase = (): void => {
    releasePersistence();
    releaseRuntime();
    registry.dispose();
  };

  return {
    registry,
    runtime,
    operationResultAtom,
    operationFeedAtom: operationFeed,
    workspaceAtom,
    panelsAtom,
    groupCountAtom,
    panelAtom,
    tabsAtom,
    activePanelAtom,
    persistedSnapshotAtom,
    disposeBase,
  };
};

/** Shared implementation behind the dual `makeDockAtomsWith` signature. */
const makeDockAtomsWithImpl = <E>(
  servicesLayer: Layer.Layer<DockEngine | DockSnapshotStore, E>,
  initial: DockWorkspace = DockWorkspace.empty
) =>
  validateWorkspace(initial).pipe(
    Effect.flatMap((validated) => {
      const graph = makeDockAtomGraph(validated, servicesLayer);
      return AtomRegistry.getResult(graph.registry, graph.runtime, { suspendOnWaiting: true }).pipe(
        Effect.map((context) => {
          const session = Context.get(context, DockAtomSession);

          /**
           * The only stateful operation lane. Writes submit synchronously into
           * the Context-owned Effect runtime; reads expose the latest typed
           * `AsyncResult` for host adapters.
           */
          const operationAtom = Atom.writable(
            (get) => get(graph.operationResultAtom),
            (_ctx, operation: DockAtomOperation) => session.submitUnsafe(operation)
          ).pipe(Atom.keepAlive);
          const releaseOperations = graph.registry.mount(operationAtom);

          /** Releases the one-registry session and every service scope it owns. */
          const dispose = (): void => {
            releaseOperations();
            graph.disposeBase();
          };

          return {
            registry: graph.registry,
            runtime: graph.runtime,
            workspaceAtom: graph.workspaceAtom,
            panelsAtom: graph.panelsAtom,
            groupCountAtom: graph.groupCountAtom,
            panelAtom: graph.panelAtom,
            tabsAtom: graph.tabsAtom,
            activePanelAtom: graph.activePanelAtom,
            awaitIdle: session.awaitIdle,
            operationAtom,
            operationFeedAtom: graph.operationFeedAtom,
            persistedSnapshotAtom: graph.persistedSnapshotAtom,
            dispose,
          };
        }),
        Effect.onError(() => Effect.sync(graph.disposeBase))
      );
    }),
    Effect.withSpan("DockAtoms.makeWith")
  );

/**
 * Named carrier for the session Effect so the dual signature does not repeat a
 * deferred `ReturnType<...>` — docgen's type printer recurses forever on that form.
 */
interface DockAtomsSessionEffect<E> extends ReturnType<typeof makeDockAtomsWithImpl<E>> {}

/**
 * Builds a validated isolated Atom session from caller-provided services.
 *
 * **Details**
 *
 * Layer construction failures remain typed in the returned Effect.
 *
 * **Example** (Building a session with services)
 *
 * ```ts
 * import { DockEngineLive, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, makeDockAtomsWith, makeDockSnapshotStoreMemory } from "@beep/dock"
 * import { Effect, Layer } from "effect"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const groupCount = await Effect.runPromise(
 *   Effect.acquireUseRelease(
 *     makeDockAtomsWith(Layer.mergeAll(DockEngineLive, makeDockSnapshotStoreMemory()), workspace),
 *     (session) => Effect.sync(() => session.registry.get(session.groupCountAtom)),
 *     (session) => Effect.sync(session.dispose)
 *   )
 * )
 * console.log(groupCount)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const makeDockAtomsWith: {
  (
    initial?: DockWorkspace
  ): <E>(servicesLayer: Layer.Layer<DockEngine | DockSnapshotStore, E>) => DockAtomsSessionEffect<E>;
  <E>(
    servicesLayer: Layer.Layer<DockEngine | DockSnapshotStore, E>,
    initial?: DockWorkspace
  ): DockAtomsSessionEffect<E>;
} = dual((args) => Layer.isLayer(args[0]), makeDockAtomsWithImpl);

/**
 * Builds a validated isolated Atom session with live in-memory services.
 *
 * **Example** (Building an in-memory session)
 *
 * ```ts
 * import { GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, makeDockAtoms } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const panelCount = await Effect.runPromise(
 *   Effect.acquireUseRelease(
 *     makeDockAtoms(workspace),
 *     (session) => Effect.sync(() => session.registry.get(session.panelsAtom).length),
 *     (session) => Effect.sync(session.dispose)
 *   )
 * )
 * console.log(panelCount)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const makeDockAtoms = (initial: DockWorkspace = DockWorkspace.empty) =>
  makeDockAtomsWith(Layer.mergeAll(DockEngineLive, makeDockSnapshotStoreMemory()), initial);

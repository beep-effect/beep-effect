/**
 * The desktop dock workspace: default layout, localStorage persistence, and
 * the atom graph the shell renders.
 *
 * The dock graph owns its own private `AtomRegistry` (the kernel session
 * mounts its atoms there), separate from the app's root `RegistryProvider`.
 * Components outside the dock read dock atoms through `useDockAtom`, and the
 * shell re-provides the app registry to panel content — see `App.tsx`.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */

import {
  ActivatePanelCommand,
  ApiCommandOrigin,
  CommandId,
  ComponentPanelView,
  DispatchDockCommand,
  DockCommandEnvelope,
  DockEngineLive,
  DockNode,
  DockPersistenceError,
  DockSnapshotStore,
  DockWorkspace,
  GroupId,
  makeDockAtomsWith,
  OpenPanelCommand,
  Panel,
  PanelId,
  PopulatedWorkspace,
  RendererKey,
  RestoreDockSnapshot,
  RestoreSnapshotRequest,
  RootPlacement,
  SaveDockSnapshot,
  TabPlacement,
  TabsNode,
  UserCommandOrigin,
} from "@beep/dock";
import { Duration, Effect, Layer } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import type { DockAtomOperation } from "@beep/dock";
import type { DockAtomGraph } from "@beep/dock-react";

/**
 * The four coarse desktop surfaces, each one dock panel.
 *
 * @example
 * ```ts
 * import { DESKTOP_SURFACES } from "@/workspace/dock.atoms"
 *
 * console.log(DESKTOP_SURFACES.length) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DESKTOP_SURFACES = [
  { description: "Return to the workspace overview.", label: "Home", surface: "home", title: "Home" },
  {
    description: "Work with the professional assistant and your saved threads.",
    label: "Chat",
    surface: "chat",
    title: "Chat",
  },
  {
    description: "Explore and refine the workspace knowledge model.",
    label: "Ontology",
    surface: "ontology",
    title: "Ontology",
  },
  {
    description: "Review provider connectivity, queue health, and conflicts.",
    label: "Vault sync",
    surface: "sync",
    title: "Vault sync",
  },
] as const;

/**
 * One of the four desktop surface names.
 *
 * @example
 * ```ts
 * import type { DesktopSurface } from "@/workspace/dock.atoms"
 *
 * const surface: DesktopSurface = "chat"
 * console.log(surface)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DesktopSurface = (typeof DESKTOP_SURFACES)[number]["surface"];

/**
 * The resolved desktop dock atom graph (kernel session plus derived atoms).
 *
 * @example
 * ```ts
 * import type { DesktopDockGraph } from "@/workspace/dock.atoms"
 *
 * const workspaceAtom = (graph: DesktopDockGraph) => graph.workspaceAtom
 * console.log(workspaceAtom)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DesktopDockGraph = DockAtomGraph;

// Panel id for a desktop surface (`surface-<name>`).
const surfacePanelId = (surface: DesktopSurface): PanelId => PanelId.make(`surface-${surface}`);

const surfacePanel = (surface: DesktopSurface, title: string): Panel =>
  Panel.make({
    id: surfacePanelId(surface),
    title,
    view: ComponentPanelView.make({ renderer: RendererKey.make(surface) }),
    // Keep-alive: surfaces stay mounted while inactive so chat streams,
    // ontology state, and sync progress survive tab switches.
    renderMode: "always",
  });

const DESKTOP_GROUP_ID = GroupId.make("desktop-main");

/**
 * The default workspace: one group, four keep-alive surface panels, chat active.
 *
 * @example
 * ```ts
 * import { defaultDesktopWorkspace } from "@/workspace/dock.atoms"
 *
 * console.log(defaultDesktopWorkspace.kind) // "populated"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultDesktopWorkspace = PopulatedWorkspace.make({
  root: TabsNode.make({
    groupId: DESKTOP_GROUP_ID,
    before: [surfacePanel("home", "Home")],
    active: surfacePanel("chat", "Chat"),
    after: [surfacePanel("ontology", "Ontology"), surfacePanel("sync", "Vault sync")],
  }),
});

/**
 * The localStorage key holding the persisted dock snapshot.
 *
 * @example
 * ```ts
 * import { DOCK_SNAPSHOT_KEY } from "@/workspace/dock.atoms"
 *
 * console.log(DOCK_SNAPSHOT_KEY) // "desktop:dock-workspace:v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCK_SNAPSHOT_KEY = "desktop:dock-workspace:v1";

const storageFailure = (operation: "load" | "save"): DockPersistenceError =>
  DockPersistenceError.make({ operation, message: "localStorage is unavailable in this environment." });

// Snapshot store over `window.localStorage` (the `Atom.kvs` persistence
// precedent, expressed as the kernel's `DockSnapshotStore` service).
const DockSnapshotStoreLocalStorage = Layer.succeed(
  DockSnapshotStore,
  DockSnapshotStore.of({
    load: Effect.try({
      try: () => O.fromNullishOr(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)),
      catch: () => storageFailure("load"),
    }),
    save: Effect.fn("DockSnapshotStore.save")((snapshot) =>
      Effect.try({
        try: () => globalThis.localStorage.setItem(DOCK_SNAPSHOT_KEY, snapshot),
        catch: () => storageFailure("save"),
      })
    ),
  })
);

let commandCounter = 0;
const nextCommandId = (name: string): CommandId => {
  commandCounter += 1;
  return CommandId.make(`desktop-${name}-${commandCounter}`);
};

const restoreOperation = (): DockAtomOperation =>
  RestoreDockSnapshot.make({
    request: RestoreSnapshotRequest.make({
      commandId: nextCommandId("restore"),
      origin: ApiCommandOrigin.make({ requestId: "desktop-boot-restore" }),
    }),
  });

const saveOperation = (): DockAtomOperation => SaveDockSnapshot.make({});

/**
 * Builds the desktop dock graph: validated default workspace, live engine,
 * localStorage snapshot store, and a boot-time restore. A persisted snapshot
 * that fails to load, parse, or validate falls back to the default workspace
 * and clears the poisoned key.
 *
 * @example
 * ```ts
 * import { makeDesktopDockGraph } from "@/workspace/dock.atoms"
 * import { Effect } from "effect"
 *
 * const panels = await Effect.runPromise(
 *   Effect.map(makeDesktopDockGraph, (graph) => graph.registry.get(graph.panelsAtom).length)
 * )
 * console.log(panels) // 4
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDesktopDockGraph = Effect.gen(function* () {
  const graph = yield* makeDockAtomsWith(
    Layer.mergeAll(DockEngineLive, DockSnapshotStoreLocalStorage),
    defaultDesktopWorkspace
  );
  // Storage access is guarded end to end: an unreadable store means "nothing
  // to restore", and a failed poison cleanup must not fail the boot either.
  const persisted = yield* Effect.try({
    try: () => O.fromNullishOr(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)),
    catch: () => storageFailure("load"),
  }).pipe(Effect.orElseSucceed(O.none<string>));
  yield* O.match(persisted, {
    onNone: () => Effect.void,
    onSome: Effect.fnUntraced(function* () {
      graph.registry.set(graph.operationAtom, restoreOperation());
      yield* graph.awaitIdle;
      const result = graph.registry.get(graph.operationAtom);
      yield* AsyncResult.isFailure(result)
        ? Effect.try({
            try: () => globalThis.localStorage.removeItem(DOCK_SNAPSHOT_KEY),
            catch: () => storageFailure("save"),
          }).pipe(Effect.ignore)
        : Effect.void;
    }),
  });
  return graph;
}).pipe(Effect.withSpan("DesktopDock.makeGraph"));

/**
 * The application dock graph. `AsyncResult`: Initial while the session builds
 * and any persisted layout restores; Success carries the graph the shell (and
 * its registry provider) renders from.
 *
 * @example
 * ```ts
 * import { desktopDockGraphAtom } from "@/workspace/dock.atoms"
 * import { useAtomValue } from "@effect/atom-react"
 * import { AsyncResult } from "effect/unstable/reactivity"
 *
 * const useDockPanelCount = (): number => {
 *   const result = useAtomValue(desktopDockGraphAtom)
 *   return AsyncResult.isSuccess(result) ? result.value.registry.get(result.value.panelsAtom).length : 0
 * }
 * console.log(useDockPanelCount.name)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
// Deliberately never disposed: the graph's lifetime IS the page's. Tests that
// build graphs directly use makeDesktopDockGraph and dispose them explicitly.
export const desktopDockGraphAtom = Atom.make(makeDesktopDockGraph).pipe(Atom.keepAlive);

// Milliseconds of quiet between workspace changes before a snapshot save.
const DOCK_SAVE_DEBOUNCE_MS = 400;

/**
 * Mounted binding that persists the workspace: every change schedules a
 * debounced `SaveDockSnapshot`, so drag storms collapse into one write.
 *
 * @example
 * ```ts
 * import { dockPersistenceBindingAtom, makeDesktopDockGraph } from "@/workspace/dock.atoms"
 * import { Effect } from "effect"
 *
 * // Mounting the binding arms debounced saves; releasing it cancels them.
 * const program = Effect.map(makeDesktopDockGraph, (graph) => {
 *   const release = graph.registry.mount(dockPersistenceBindingAtom(graph))
 *   release()
 *   graph.dispose()
 * })
 * console.log(typeof program)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const dockPersistenceBindingAtom = Atom.family((graph: DesktopDockGraph) =>
  Atom.make((get) => {
    // Effect-native debounce by generation: every workspace change forks a
    // sleep; only the latest generation saves, so drag storms cost one write.
    // (`Atom.debounce` never fires in effect 4.0.0-beta.97 — proven by test —
    // so the quiet period is expressed with `Effect.sleep` directly.)
    let generation = 0;
    const cancel = graph.registry.subscribe(graph.workspaceAtom, () => {
      generation += 1;
      const scheduled = generation;
      Effect.runFork(
        Effect.sleep(Duration.millis(DOCK_SAVE_DEBOUNCE_MS)).pipe(
          Effect.andThen(
            Effect.sync(() => {
              if (scheduled === generation) graph.registry.set(graph.operationAtom, saveOperation());
            })
          )
        )
      );
    });
    get.addFinalizer(() => {
      generation += 1;
      cancel();
    });
    return undefined;
  })
);

const firstGroupId = (root: DockNode): O.Option<GroupId> => O.map(A.head(DockNode.tabs(root)), (tabs) => tabs.groupId);

// A root-recovery group id that cannot collide with any live group — the
// reducer's uniqueness guard is workspace-scoped, so a floating group may
// still own "desktop-main" while the docked tree is empty.
const recoveryRootGroupId = (workspace: DockWorkspace): GroupId =>
  O.getOrElse(
    A.findFirst(
      A.map(A.range(0, 64), (n) => (n === 0 ? DESKTOP_GROUP_ID : GroupId.make(`desktop-main-${n}`))),
      (candidate) => O.isNone(DockWorkspace.findTabs(workspace, candidate))
    ),
    // 65 live desktop-main groups would be required to exhaust the probe; the
    // kernel then rejects the reopen with group-already-exists, retryably.
    () => GroupId.make("desktop-main-overflow")
  );

/**
 * The operation a nav click submits for a surface: activate its panel when it
 * is open anywhere in the workspace, otherwise reopen it (into the first
 * docked group, or as the new root when everything was closed).
 *
 * @example
 * ```ts
 * import { defaultDesktopWorkspace, surfaceOperation } from "@/workspace/dock.atoms"
 *
 * const operation = surfaceOperation(defaultDesktopWorkspace, "ontology")
 * console.log(operation.kind) // "dispatchCommand"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const surfaceOperation: {
  (surface: DesktopSurface): (workspace: DockWorkspace) => DockAtomOperation;
  (workspace: DockWorkspace, surface: DesktopSurface): DockAtomOperation;
} = dual(2, (workspace: DockWorkspace, surface: DesktopSurface): DockAtomOperation => {
  const panelId = surfacePanelId(surface);
  const title = O.getOrElse(
    O.map(
      A.findFirst(DESKTOP_SURFACES, (item) => item.surface === surface),
      (item) => item.title
    ),
    () => surface
  );
  const command = O.match(DockWorkspace.findTabsForPanel(workspace, panelId), {
    onSome: () => ActivatePanelCommand.make({ panelId }),
    onNone: () =>
      OpenPanelCommand.make({
        panel: surfacePanel(surface, title),
        placement: DockWorkspace.match(workspace, {
          empty: () => RootPlacement.make({ groupId: recoveryRootGroupId(workspace) }),
          populated: ({ root }) =>
            O.getOrElse(
              O.map(firstGroupId(root), (groupId) => TabPlacement.make({ groupId })),
              () => RootPlacement.make({ groupId: recoveryRootGroupId(workspace) })
            ),
        }),
      }),
  });
  return DispatchDockCommand.make({
    envelope: DockCommandEnvelope.make({
      commandId: nextCommandId(`surface-${surface}`),
      origin: UserCommandOrigin.make({ interactionId: `desktop-nav-${surface}` }),
      command,
    }),
  });
});

/**
 * Whether a surface's panel is the active tab of the group containing it.
 *
 * @example
 * ```ts
 * import { defaultDesktopWorkspace, isSurfaceActive } from "@/workspace/dock.atoms"
 *
 * console.log(isSurfaceActive(defaultDesktopWorkspace, "chat")) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const isSurfaceActive: {
  (surface: DesktopSurface): (workspace: DockWorkspace) => boolean;
  (workspace: DockWorkspace, surface: DesktopSurface): boolean;
} = dual(2, (workspace: DockWorkspace, surface: DesktopSurface): boolean => {
  const panelId = surfacePanelId(surface);
  return O.exists(DockWorkspace.findTabsForPanel(workspace, panelId), (tabs) =>
    PanelId.equals(tabs.active.id, panelId)
  );
});

/**
 * The desktop dock workspace: default layout, localStorage persistence, and
 * the atom graph the shell renders.
 *
 * The dock graph owns its own private `AtomRegistry` (the kernel session
 * mounts its atoms there), separate from the app's root `RegistryProvider`.
 * Components outside the dock read dock atoms through registry bridges, and
 * the shell re-provides the app registry to panel content — see `App.tsx`.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */

import { makeDockAtomsWith } from "@beep/dock/Dock.atoms";
import {
  ActivatePanelCommand,
  ApiCommandOrigin,
  DockCommandEnvelope,
  OpenPanelCommand,
  RestoreSnapshotRequest,
  UserCommandOrigin,
} from "@beep/dock/Dock.commands";
import { DockPersistenceError } from "@beep/dock/Dock.errors";
import { CommandId, GroupId, PanelId, RendererKey, SplitId, SplitRatio } from "@beep/dock/Dock.ids";
import { ComponentPanelView, Panel, PanelConstraints } from "@beep/dock/Dock.models";
import { RootPlacement, TabPlacement } from "@beep/dock/Dock.placement";
import { DispatchDockCommand, RestoreDockSnapshot, SaveDockSnapshot } from "@beep/dock/Dock.protocol";
import {
  DockNode,
  DockWorkspace,
  HorizontalSplitLayout,
  PopulatedWorkspace,
  SplitNode,
  TabsNode,
  VerticalSplitLayout,
} from "@beep/dock/Dock.tree";
import { DockEngineLive, DockSnapshotStore } from "@beep/dock/DockEngine.service";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { KeyValueStore } from "effect/unstable/persistence";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { professionalBrowserRuntime, professionalStorageRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { DockPersistenceOperation } from "@beep/dock/Dock.errors";
import type { DockAtomOperation } from "@beep/dock/Dock.protocol";
import type { DockAtomGraph } from "@beep/dock-react/DockReact.types";
/**
 * Every desktop dock panel: the five shell surfaces plus the nine ontology
 * workbench regions. `cluster` names the default-layout group a panel calls
 * home — reopening a closed panel targets a group where its cluster siblings
 * live, so SPARQL lands beside Inspector rather than in a random group.
 *
 * **Example** (Logging desktop panels length)
 *
 * ```ts
 * import { DESKTOP_PANELS } from "@/workspace/dock.atoms"
 *
 * console.log(DESKTOP_PANELS.length) // 14
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DESKTOP_PANELS = [
  { cluster: "shell", description: "Return to the workspace overview.", key: "home", label: "Home", title: "Home" },
  {
    cluster: "shell",
    description: "Work with the professional assistant and your saved threads.",
    key: "chat",
    label: "Chat",
    title: "Chat",
  },
  {
    cluster: "shell",
    description: "Review provider connectivity, queue health, and conflicts.",
    key: "sync",
    label: "Vault sync",
    title: "Vault sync",
  },
  {
    cluster: "shell",
    description: "Prove capability profiles over a sample document.",
    key: "editor-proof",
    label: "Editor proof",
    title: "Editor Capability Proof",
  },
  {
    cluster: "shell",
    description: "Review contradictory beliefs against their verified source text.",
    key: "contradiction-triage",
    label: "Beliefs",
    title: "Contradiction Triage",
  },
  {
    cluster: "ontology-left",
    description: "Search and browse the knowledge model tree.",
    key: "ontology-explorer",
    label: "Explorer",
    title: "Explorer",
  },
  {
    cluster: "ontology-left",
    description: "Open, save, and steer the ontology document.",
    key: "ontology-document",
    label: "Document",
    title: "Document",
  },
  {
    cluster: "ontology-center",
    description: "Visualize the knowledge model in 2D or 3D.",
    key: "ontology-graph",
    label: "Graph",
    title: "Graph",
  },
  {
    cluster: "ontology-center",
    description: "Read the ontology's Turtle source.",
    key: "ontology-source",
    label: "Source",
    title: "Source",
  },
  {
    cluster: "ontology-right",
    description: "Inspect the selected resource and author triples.",
    key: "ontology-inspector",
    label: "Inspector",
    title: "Inspector",
  },
  {
    cluster: "ontology-right",
    description: "Query the knowledge model with SPARQL.",
    key: "ontology-sparql",
    label: "SPARQL",
    title: "SPARQL",
  },
  {
    cluster: "ontology-right",
    description: "Validate the model and export reports.",
    key: "ontology-validation",
    label: "Validation",
    title: "Validation",
  },
  {
    cluster: "ontology-right",
    description: "Review the session's change history.",
    key: "ontology-changelog",
    label: "Change Log",
    title: "Change Log",
  },
  {
    cluster: "ontology-right",
    description: "Watch graph worker health and throughput.",
    key: "ontology-metrics",
    label: "Worker Metrics",
    title: "Worker Metrics",
  },
] as const;

/**
 * One of the fourteen desktop panel keys.
 *
 * **Example** (Assigning ontology graph key)
 *
 * ```ts
 * import type { DesktopPanelKey } from "@/workspace/dock.atoms"
 *
 * const key: DesktopPanelKey = "ontology-graph"
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DesktopPanelKey = (typeof DESKTOP_PANELS)[number]["key"];

/**
 * The panels the nav rail's Ontology menu lists, in default-layout order.
 *
 * **Example** (Logging ontology panels length)
 *
 * ```ts
 * import { ONTOLOGY_PANELS } from "@/workspace/dock.atoms"
 *
 * console.log(ONTOLOGY_PANELS.length) // 9
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ONTOLOGY_PANELS = A.filter(DESKTOP_PANELS, (panel) => panel.cluster !== "shell");

const panelSpec = (key: DesktopPanelKey): (typeof DESKTOP_PANELS)[number] =>
  O.getOrThrow(A.findFirst(DESKTOP_PANELS, (panel) => panel.key === key));

/**
 * The resolved desktop dock atom graph (kernel session plus derived atoms).
 *
 * **Example** (Extracting workspace atom)
 *
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

/**
 * Panel id for a desktop panel (`surface-<key>`).
 *
 * **Example** (Building surface panel id)
 *
 * ```ts
 * import { desktopPanelId } from "@/workspace/dock.atoms"
 *
 * console.log(desktopPanelId("chat")) // "surface-chat"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const desktopPanelId = (key: DesktopPanelKey): PanelId => PanelId.make(`surface-${key}`);

// Per-panel minima (the M1 kernel capability): a split or edge insertion can
// never squeeze a content-heavy panel below readability — QA round 1 showed
// a full-width row insertion clipping Chat to ~155px (finding R1-06).
const CONTENT_MIN = PanelConstraints.make({ minWidth: O.some(220), minHeight: O.some(180) });
// Chat's height floor is taller than the rest: its tab strip (~35px) plus the
// composer chrome (~104px) plus roughly three transcript lines must all stay
// visible for the panel to read as a conversation.
const CHAT_MIN = PanelConstraints.make({ minWidth: O.some(220), minHeight: O.some(260) });

// The kernel panel for a desktop panel key. Every panel is keep-alive
// (`renderMode: "always"`): inactive tabs stay mounted so chat streams,
// ontology session state, and sync progress survive tab switches.
const desktopPanel = (key: DesktopPanelKey): Panel =>
  Panel.make({
    id: desktopPanelId(key),
    title: panelSpec(key).title,
    view: ComponentPanelView.make({ renderer: RendererKey.make(key) }),
    renderMode: "always",
    constraints: O.some(key === "chat" ? CHAT_MIN : CONTENT_MIN),
  });

const GROUP_ONTOLOGY_LEFT = GroupId.make("desktop-ontology-left");
const GROUP_ONTOLOGY_CENTER = GroupId.make("desktop-ontology-center");
const GROUP_ONTOLOGY_RIGHT = GroupId.make("desktop-ontology-right");
const GROUP_SHELL = GroupId.make("desktop-shell");

/**
 * The default workspace, the ontology core cluster over the shell row:
 * Explorer|Document tabs on the left, Graph|Source center (Graph active),
 * Inspector|Change Log on the right, and Chat|Home|Sync along the bottom
 * (Chat active). SPARQL, Validation, and Worker Metrics start closed and
 * open from the nav rail's Ontology menu.
 *
 * **Example** (Inspecting default workspace kind)
 *
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
  root: SplitNode.make({
    splitId: SplitId.make("desktop-rows"),
    layout: VerticalSplitLayout.make({
      // 56/44 rather than 62/38: the bottom shell row hosts Chat, whose 260px
      // minHeight clamp engages only while top (180px ontology floor) + gap +
      // bottom (260px) fit the viewport; below that feasibility floor the raw
      // ratio governs, and 44% keeps the composer and a few transcript lines
      // visible on short viewports (QA closeout P0/P1). The ontology cluster
      // keeps the majority share.
      topRatio: SplitRatio.make(5_600),
      top: SplitNode.make({
        splitId: SplitId.make("desktop-ontology-columns"),
        layout: HorizontalSplitLayout.make({
          leftRatio: SplitRatio.make(2_200),
          left: TabsNode.make({
            groupId: GROUP_ONTOLOGY_LEFT,
            active: desktopPanel("ontology-explorer"),
            after: [desktopPanel("ontology-document")],
          }),
          right: SplitNode.make({
            splitId: SplitId.make("desktop-ontology-main"),
            layout: HorizontalSplitLayout.make({
              leftRatio: SplitRatio.make(6_400),
              left: TabsNode.make({
                groupId: GROUP_ONTOLOGY_CENTER,
                active: desktopPanel("ontology-graph"),
                after: [desktopPanel("ontology-source")],
              }),
              right: TabsNode.make({
                groupId: GROUP_ONTOLOGY_RIGHT,
                active: desktopPanel("ontology-inspector"),
                after: [desktopPanel("ontology-changelog")],
              }),
            }),
          }),
        }),
      }),
      bottom: TabsNode.make({
        groupId: GROUP_SHELL,
        before: [desktopPanel("home")],
        active: desktopPanel("chat"),
        after: [desktopPanel("sync")],
      }),
    }),
  }),
});

/**
 * The localStorage key holding the persisted dock snapshot. `v3` because the
 * per-panel constraints changed (Chat gained a 260px height floor, the rest
 * dropped to 180px): snapshots serialize `Panel.constraints`, so a `v2`
 * snapshot still decodes but would pin the old uniform 220px floors — and the
 * crushed shell row — forever. The key bump is the honest invalidation (boot
 * deletes stale keys); `v2` bumped for the nine-panel ontology surface.
 *
 * **Example** (Storing under snapshot key)
 *
 * ```ts
 * import { DOCK_SNAPSHOT_KEY } from "@/workspace/dock.atoms"
 *
 * globalThis.localStorage.setItem(DOCK_SNAPSHOT_KEY, "saved workspace")
 * console.log(globalThis.localStorage.getItem(DOCK_SNAPSHOT_KEY)) // "saved workspace"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCK_SNAPSHOT_KEY = "desktop:dock-workspace:v3";

/**
 * Builds the runtime action that clears the saved layout before executing an
 * injected reload effect.
 *
 * **Example** (Wiring reset button atom)
 *
 * ```tsx
 * import { makeResetDockSnapshotAtom } from "@/workspace/dock.atoms"
 * import { useAtomSet } from "@effect/atom-react"
 * import * as Effect from "effect/Effect";
 * const resetAtom = makeResetDockSnapshotAtom(Effect.logInfo("reload requested"))
 *
 * function ResetButton() {
 *   const reset = useAtomSet(resetAtom)
 *   return <button onClick={() => reset()}>Reset</button>
 * }
 * ```
 *
 * @effects The returned action removes the persisted snapshot through
 * `KeyValueStore`, then executes the injected reload effect.
 * @category atoms
 * @since 0.0.0
 */
export const makeResetDockSnapshotAtom = (
  reload: Effect.Effect<void>
): Atom.AtomResultFn<void, void, KeyValueStore.KeyValueStoreError> =>
  professionalStorageRuntime.fn<void>()(
    Effect.fn("professional_desktop.workspace.reset_snapshot")(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.remove(DOCK_SNAPSHOT_KEY);
      yield* reload;
    })
  );

/**
 * Runtime action that clears the saved dock layout before reloading the shell.
 *
 * **Example** (Resetting via button click)
 *
 * ```tsx
 * import { resetDockSnapshotAtom } from "@/workspace/dock.atoms"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * function ResetWorkspaceButton() {
 *   const reset = useAtomSet(resetDockSnapshotAtom)
 *   return <button onClick={() => reset()}>Reset workspace</button>
 * }
 * ```
 *
 * @effects Removes the persisted dock snapshot through the professional storage
 * runtime, then reloads the browser location.
 * @category atoms
 * @since 0.0.0
 */
export const resetDockSnapshotAtom = makeResetDockSnapshotAtom(Effect.sync(() => globalThis.location.reload()));

const storageFailure = (operation: DockPersistenceOperation): DockPersistenceError =>
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

const restoreOperation = (): DockAtomOperation =>
  RestoreDockSnapshot.make({
    request: RestoreSnapshotRequest.make({
      commandId: CommandId.make("desktop-boot-restore"),
      origin: ApiCommandOrigin.make({ requestId: "desktop-boot-restore" }),
      allowedRenderers: O.some(A.map(DESKTOP_PANELS, ({ key }) => RendererKey.make(key))),
    }),
  });

const saveOperation = (): DockAtomOperation => SaveDockSnapshot.make();

/**
 * Builds the desktop dock graph: validated default workspace, live engine,
 * localStorage snapshot store, and a boot-time restore. A persisted snapshot
 * that fails to load, parse, or validate falls back to the default workspace
 * and clears the poisoned key.
 *
 * **Example** (Creating runtime dock atom)
 *
 * ```ts
 * import { makeDesktopDockGraph } from "@/workspace/dock.atoms"
 * import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime"
 *
 * const dockGraphAtom = professionalBrowserRuntime.atom(makeDesktopDockGraph)
 * console.log(typeof dockGraphAtom === "object") // true
 * ```
 *
 * @effects Allocates a dock atom registry, restores a valid persisted
 * workspace, and clears an invalid snapshot.
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
 * **Example** (Hook counting dock panels)
 *
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
export const desktopDockGraphAtom = professionalBrowserRuntime.atom(makeDesktopDockGraph).pipe(Atom.keepAlive);

// Milliseconds of quiet between workspace changes before a snapshot save.
const DOCK_SAVE_DEBOUNCE_MS = 400;

/**
 * Mounted binding that persists the workspace: every change schedules a
 * debounced `SaveDockSnapshot`, so drag storms collapse into one write.
 *
 * **Example** (Mounting and releasing binding)
 *
 * ```ts
 * import { dockPersistenceBindingAtom, makeDesktopDockGraph } from "@/workspace/dock.atoms"
 * import * as Effect from "effect/Effect";
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
  professionalBrowserRuntime.atom(
    AtomRegistry.toStream(graph.registry, graph.workspaceAtom).pipe(
      Stream.drop(1),
      Stream.debounce(Duration.millis(DOCK_SAVE_DEBOUNCE_MS)),
      Stream.runForEach(() =>
        Effect.sync(() => {
          graph.registry.set(graph.operationAtom, saveOperation());
        })
      )
    )
  )
);

const firstGroupId = (root: DockNode): O.Option<GroupId> => O.map(A.head(DockNode.tabs(root)), (tabs) => tabs.groupId);

// A root-recovery group id that cannot collide with any live group — the
// reducer's uniqueness guard is workspace-scoped, so a floating group may
// still own "desktop-shell" while the docked tree is empty.
const recoveryRootGroupId = (workspace: DockWorkspace): GroupId =>
  O.getOrElse(
    A.findFirst(
      A.map(A.range(0, 64), (n) => (n === 0 ? GROUP_SHELL : GroupId.make(`desktop-shell-${n}`))),
      (candidate) => O.isNone(DockWorkspace.findTabs(workspace, candidate))
    ),
    // 65 live desktop-shell groups would be required to exhaust the probe; the
    // kernel then rejects the reopen with group-already-exists, retryably.
    () => GroupId.make("desktop-shell-overflow")
  );

// The group a reopened panel should join: the group holding one of its
// default-layout cluster siblings (SPARQL belongs beside Inspector), falling
// back to the first docked group when the whole cluster is closed.
const clusterAnchorGroup = (workspace: DockWorkspace, key: DesktopPanelKey): O.Option<GroupId> => {
  const cluster = panelSpec(key).cluster;
  const siblings = A.filter(DESKTOP_PANELS, (panel) => panel.cluster === cluster && panel.key !== key);
  return O.map(
    A.head(
      A.getSomes(A.map(siblings, (panel) => DockWorkspace.findTabsForPanel(workspace, desktopPanelId(panel.key))))
    ),
    (tabs) => tabs.groupId
  );
};

/**
 * The operation a nav or menu click submits for a panel: activate it when it
 * is open anywhere in the workspace, otherwise open it beside its
 * default-layout cluster siblings (then the first docked group, then as the
 * new root when everything was closed).
 *
 * **Example** (Computing SPARQL panel operation)
 *
 * ```ts
 * import { defaultDesktopWorkspace, panelOperation } from "@/workspace/dock.atoms"
 *
 * const operation = panelOperation(defaultDesktopWorkspace, "ontology-sparql")
 * console.log(operation.kind) // "dispatchCommand"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const panelOperation: {
  (key: DesktopPanelKey): (workspace: DockWorkspace) => DockAtomOperation;
  (workspace: DockWorkspace, key: DesktopPanelKey): DockAtomOperation;
} = dual(2, (workspace: DockWorkspace, key: DesktopPanelKey): DockAtomOperation => {
  const panelId = desktopPanelId(key);
  const command = O.match(DockWorkspace.findTabsForPanel(workspace, panelId), {
    onSome: () => ActivatePanelCommand.make({ panelId }),
    onNone: () =>
      OpenPanelCommand.make({
        panel: desktopPanel(key),
        placement: O.getOrElse(
          O.map(
            O.orElse(clusterAnchorGroup(workspace, key), () =>
              DockWorkspace.match(workspace, {
                empty: O.none<GroupId>,
                populated: ({ root }) => firstGroupId(root),
              })
            ),
            (groupId) => TabPlacement.make({ groupId })
          ),
          () => RootPlacement.make({ groupId: recoveryRootGroupId(workspace) })
        ),
      }),
  });
  return DispatchDockCommand.make({
    envelope: DockCommandEnvelope.make({
      commandId: CommandId.make(`desktop-panel-${key}-${workspace.revision}`),
      origin: UserCommandOrigin.make({ interactionId: `desktop-nav-${key}` }),
      command,
    }),
  });
});

/**
 * Whether a panel is the active tab of the group containing it.
 *
 * **Example** (Checking chat panel active)
 *
 * ```ts
 * import { defaultDesktopWorkspace, isPanelActive } from "@/workspace/dock.atoms"
 *
 * console.log(isPanelActive(defaultDesktopWorkspace, "chat")) // true
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const isPanelActive: {
  (key: DesktopPanelKey): (workspace: DockWorkspace) => boolean;
  (workspace: DockWorkspace, key: DesktopPanelKey): boolean;
} = dual(2, (workspace: DockWorkspace, key: DesktopPanelKey): boolean => {
  const panelId = desktopPanelId(key);
  return O.exists(DockWorkspace.findTabsForPanel(workspace, panelId), (tabs) =>
    PanelId.equals(tabs.active.id, panelId)
  );
});

/**
 * Whether a panel is open anywhere in the workspace (docked or floating).
 *
 * **Example** (Checking SPARQL panel open)
 *
 * ```ts
 * import { defaultDesktopWorkspace, isPanelOpen } from "@/workspace/dock.atoms"
 *
 * console.log(isPanelOpen(defaultDesktopWorkspace, "ontology-sparql")) // false
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const isPanelOpen: {
  (key: DesktopPanelKey): (workspace: DockWorkspace) => boolean;
  (workspace: DockWorkspace, key: DesktopPanelKey): boolean;
} = dual(2, (workspace: DockWorkspace, key: DesktopPanelKey): boolean =>
  O.isSome(DockWorkspace.findTabsForPanel(workspace, desktopPanelId(key)))
);

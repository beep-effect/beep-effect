/**
 * Global invariant diagnostics and typed Effect transitions for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt } from "@beep/schema";
import { thunkEffectVoid } from "@beep/utils";
import { Effect, HashSet, Metric, Number as N, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import { DockCommand } from "../Dock.commands.ts";
import { DockCommandRejected, DockInvariantViolation } from "../Dock.errors.ts";
import {
  FloatingGroupMovedEvent,
  GroupDockedEvent,
  GroupFloatedEvent,
  GroupMaximizedEvent,
  GroupMergedEvent,
  GroupMovedEvent,
  GroupRestoredEvent,
  GroupUpdatedEvent,
  PanelActivatedEvent,
  PanelClosedEvent,
  PanelMovedEvent,
  PanelOpenedEvent,
  PanelRenderModeChangedEvent,
  PanelReorderedEvent,
  PanelTabComponentChangedEvent,
  PanelTitleChangedEvent,
  PanelViewChangedEvent,
  SplitResizedEvent,
  WorkspaceClearedEvent,
  WorkspaceRestoredEvent,
} from "../Dock.events.ts";
import { GroupId, PanelId, SplitRatio } from "../Dock.ids.ts";
import { GroupMetadata, Panel } from "../Dock.models.ts";
import { DockChanged, DockMutationOutcome, DockMutationResult, DockUnchanged } from "../Dock.outcomes.ts";
import { DockGroupMoveTarget, DockMoveTarget, DockPlacement } from "../Dock.placement.ts";
import {
  DockNode,
  DockWorkspace,
  EmptyWorkspace,
  FloatingMember,
  PopulatedWorkspace,
  SplitLayout,
  SplitNode,
  TabsNode,
} from "../Dock.tree.ts";
import type {
  ActivatePanelCommand,
  ClearWorkspaceCommand,
  ClosePanelCommand,
  DockCommandEnvelope,
  DockFloatingGroupCommand,
  FloatGroupCommand,
  MaximizeGroupCommand,
  MoveFloatingGroupCommand,
  MoveGroupCommand,
  MovePanelCommand,
  OpenPanelCommand,
  ResizeSplitCommand,
  RestoreMaximizedCommand,
  RestoreSnapshotRequest,
  UpdateGroupCommand,
  UpdatePanelCommand,
} from "../Dock.commands.ts";
import type { DockInvariantReason, DockRejectionReason, DockTransitionError } from "../Dock.errors.ts";
import type { DockEvent } from "../Dock.events.ts";
import type { DockUnchangedReason } from "../Dock.outcomes.ts";

const changedCommandCount = Metric.counter("dockview_poc_state_changes_total", {
  description: "Dockview POC commands that changed state.",
  incremental: true,
});

const nextRevision = (state: DockWorkspace) => NonNegativeInt.make(state.revision + 1);

const ensureRevisionAvailable = (state: DockWorkspace): Effect.Effect<void, DockInvariantViolation> =>
  Bool.match(N.isLessThan(state.revision, globalThis.Number.MAX_SAFE_INTEGER), {
    onTrue: thunkEffectVoid,
    onFalse: () =>
      DockInvariantViolation.make({
        reason: "revision-exhausted",
        message: "The workspace revision has reached Number.MAX_SAFE_INTEGER and cannot advance safely.",
      }),
  });

const reject = (envelope: DockCommandEnvelope, reason: DockRejectionReason, message: string): DockCommandRejected =>
  DockCommandRejected.make({
    commandId: envelope.commandId,
    reason,
    message,
  });

const changed = Effect.fn("DockReducer.changed")(function* (
  previous: DockWorkspace,
  envelope: Pick<DockCommandEnvelope, "commandId" | "origin">,
  build: (revision: NonNegativeInt) => readonly [state: DockWorkspace, event: DockEvent]
) {
  yield* ensureRevisionAvailable(previous);
  const [state, event] = build(nextRevision(previous));
  return DockMutationOutcome.make({
    commandId: envelope.commandId,
    origin: envelope.origin,
    result: DockChanged.make({
      previousRevision: previous.revision,
      state,
      events: [event],
    }),
  });
});

const changedMany = Effect.fn("DockReducer.changedMany")(function* (
  previous: DockWorkspace,
  envelope: Pick<DockCommandEnvelope, "commandId" | "origin">,
  build: (revision: NonNegativeInt) => readonly [state: DockWorkspace, events: A.NonEmptyReadonlyArray<DockEvent>]
) {
  yield* ensureRevisionAvailable(previous);
  const [state, events] = build(nextRevision(previous));
  return DockMutationOutcome.make({
    commandId: envelope.commandId,
    origin: envelope.origin,
    result: DockChanged.make({ previousRevision: previous.revision, state, events }),
  });
});

const unchanged = (
  state: DockWorkspace,
  envelope: Pick<DockCommandEnvelope, "commandId" | "origin">,
  reason: DockUnchangedReason
): DockMutationOutcome =>
  DockMutationOutcome.make({
    commandId: envelope.commandId,
    origin: envelope.origin,
    result: DockUnchanged.make({
      revision: state.revision,
      reason,
    }),
  });

const ensureUnique = (
  values: ReadonlyArray<string>,
  reason: DockInvariantReason,
  message: string
): Effect.Effect<void, DockInvariantViolation> =>
  Bool.match(Eq.equals(HashSet.size(HashSet.fromIterable(values)), A.length(values)), {
    onTrue: thunkEffectVoid,
    onFalse: () => DockInvariantViolation.make({ reason, message }),
  });

/** Provides reason-specific diagnostics for public workspace invariants. */
// crispen: the public schema already enforces identity uniqueness; this Effect
// pass remains until schema filters can preserve the exact typed boundary reason.
/**
 * Validates reason-specific workspace invariants at a public boundary.
 *
 * @example
 * ```ts
 * import { DockWorkspace, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, validateWorkspace } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const validated = Effect.runSync(validateWorkspace(workspace))
 * console.log(DockWorkspace.groupCount(validated))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateWorkspace = Effect.fn("DockReducer.validateWorkspace")(function* (state: DockWorkspace) {
  const roots = DockWorkspace.roots(state);
  const tabs = A.flatMap(roots, DockNode.tabs);
  const splits = A.flatMap(roots, DockNode.splits);
  yield* ensureUnique(
    A.map(A.flatMap(roots, DockNode.panels), (panel) => panel.id),
    "duplicate-panel-id",
    "Every panel id must occur exactly once in the workspace tree."
  );
  yield* ensureUnique(
    A.map(tabs, (group) => group.groupId),
    "duplicate-group-id",
    "Every group id must occur exactly once in the workspace tree."
  );
  yield* ensureUnique(
    A.map(splits, (split) => split.splitId),
    "duplicate-split-id",
    "Every split id must occur exactly once in the workspace tree."
  );
  const maximized = DockWorkspace.match(state, {
    empty: O.none<GroupId>,
    populated: ({ maximized }) => maximized,
  });
  yield* pipe(
    maximized,
    O.map((groupId) =>
      pipe(
        DockWorkspace.match(state, {
          empty: O.none<TabsNode>,
          populated: ({ root }) => DockNode.findTabs(root, groupId),
        }),
        O.filter((group) => group.metadata.visible),
        O.match({
          onSome: thunkEffectVoid,
          onNone: () =>
            DockInvariantViolation.make({
              reason: "maximized-group-invalid",
              message: "A maximized group must exist and be visible.",
            }),
        })
      )
    ),
    O.getOrElse(thunkEffectVoid)
  );
  return state;
});

const openPanel = Effect.fn("DockReducer.openPanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: OpenPanelCommand
) {
  yield* Bool.match(O.isSome(DockWorkspace.findPanel(state, command.panel.id)), {
    onTrue: () => reject(envelope, "panel-already-open", `Panel '${command.panel.id}' is already open.`),
    onFalse: thunkEffectVoid,
  });

  return yield* DockPlacement.match(command.placement, {
    root: (placement) =>
      DockWorkspace.match(state, {
        populated: () =>
          reject(envelope, "workspace-not-empty", "Root placement is only valid for an empty workspace."),
        empty: (workspace) =>
          changed(workspace, envelope, (revision) => [
            PopulatedWorkspace.make({
              revision,
              root: TabsNode.make({ groupId: placement.groupId, active: command.panel }),
              floating: workspace.floating,
            }),
            PanelOpenedEvent.make({
              panelId: command.panel.id,
              groupId: placement.groupId,
            }),
          ]),
      }),
    tab: (placement) =>
      O.match(DockWorkspace.findTabs(state, placement.groupId), {
        onNone: () => reject(envelope, "group-not-found", `Group '${placement.groupId}' does not exist.`),
        onSome: (tabs) =>
          changed(state, envelope, (revision) => [
            DockWorkspace.withRevision(
              DockWorkspace.replaceAtGroup(state, tabs.groupId, TabsNode.insert(tabs, command.panel, placement)),
              revision
            ),
            PanelOpenedEvent.make({ panelId: command.panel.id, groupId: placement.groupId }),
          ]),
      }),
    split: Effect.fnUntraced(function* (placement) {
      yield* Bool.match(O.isSome(DockWorkspace.findTabs(state, placement.newGroupId)), {
        onTrue: () => reject(envelope, "group-already-exists", `Group '${placement.newGroupId}' already exists.`),
        onFalse: thunkEffectVoid,
      });
      yield* Bool.match(O.isSome(DockWorkspace.findSplit(state, placement.splitId)), {
        onTrue: () => reject(envelope, "split-already-exists", `Split '${placement.splitId}' already exists.`),
        onFalse: thunkEffectVoid,
      });
      return yield* O.match(DockWorkspace.findTabs(state, placement.referenceGroupId), {
        onNone: () =>
          reject(envelope, "group-not-found", `Reference group '${placement.referenceGroupId}' does not exist.`),
        onSome: (reference) => {
          const next = DockWorkspace.replaceAtGroup(
            state,
            reference.groupId,
            SplitNode.fromPlacement(reference, command.panel, placement)
          );
          return changed(state, envelope, (revision) => [
            DockWorkspace.withRevision(next, revision),
            PanelOpenedEvent.make({
              panelId: command.panel.id,
              groupId: placement.newGroupId,
            }),
          ]);
        },
      });
    }),
    rootSplit: (placement) =>
      DockWorkspace.match(state, {
        empty: () =>
          reject(
            envelope,
            "workspace-empty",
            "Root split placement requires an existing docked root; use root placement to open the first docked panel."
          ),
        populated: Effect.fnUntraced(function* (workspace) {
          yield* Bool.match(O.isSome(DockWorkspace.findTabs(state, placement.newGroupId)), {
            onTrue: () => reject(envelope, "group-already-exists", `Group '${placement.newGroupId}' already exists.`),
            onFalse: thunkEffectVoid,
          });
          yield* Bool.match(O.isSome(DockWorkspace.findSplit(state, placement.splitId)), {
            onTrue: () => reject(envelope, "split-already-exists", `Split '${placement.splitId}' already exists.`),
            onFalse: thunkEffectVoid,
          });
          return yield* changed(workspace, envelope, (revision) => [
            PopulatedWorkspace.make({
              revision,
              root: SplitNode.fromNodes(
                workspace.root,
                TabsNode.make({ groupId: placement.newGroupId, active: command.panel }),
                placement
              ),
              floating: workspace.floating,
            }),
            PanelOpenedEvent.make({ panelId: command.panel.id, groupId: placement.newGroupId }),
          ]);
        }),
      }),
  });
});

// fallow-ignore-next-line complexity
const activatePanelCommand = Effect.fn("DockReducer.activatePanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: ActivatePanelCommand
) {
  const tabs = yield* Effect.fromOption(DockWorkspace.findTabsForPanel(state, command.panelId), () =>
    reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
  );
  const maximized = DockWorkspace.match(state, {
    empty: O.none<GroupId>,
    populated: ({ maximized }) => maximized,
  });
  const panelChanged = !PanelId.equals(tabs.active.id, command.panelId);
  const reveal = !tabs.metadata.visible;
  const restore = O.exists(maximized, (groupId) => !GroupId.equals(groupId, tabs.groupId));
  if (!panelChanged && !reveal && !restore) return unchanged(state, envelope, "panel-already-active");
  const activated = panelChanged
    ? yield* Effect.fromOption(TabsNode.activate(tabs, command.panelId), () =>
        reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
      )
    : tabs;
  const metadata = GroupMetadata.make({ ...activated.metadata, visible: true });
  const nextTabs = TabsNode.make({ ...activated, metadata });
  const events: A.NonEmptyReadonlyArray<DockEvent> = panelChanged
    ? [PanelActivatedEvent.make({ panelId: command.panelId, groupId: tabs.groupId })]
    : reveal
      ? [GroupUpdatedEvent.make({ groupId: tabs.groupId })]
      : [GroupRestoredEvent.make({ groupId: O.getOrThrow(maximized) })];
  const allEvents = pipe(
    events,
    reveal && panelChanged ? A.append(GroupUpdatedEvent.make({ groupId: tabs.groupId })) : (value) => value,
    restore && O.isSome(maximized) ? A.append(GroupRestoredEvent.make({ groupId: maximized.value })) : (value) => value
  );
  // fallow-ignore-next-line code-duplication
  const replaced = DockWorkspace.replaceAtGroup(state, nextTabs.groupId, nextTabs);
  const next = DockWorkspace.match(replaced, {
    empty: ({ floating }) => EmptyWorkspace.make({ floating }),
    populated: ({ root, floating }) =>
      PopulatedWorkspace.make({ root, floating, maximized: restore ? O.none() : maximized }),
  });
  return yield* changedMany(state, envelope, (revision) => [DockWorkspace.withRevision(next, revision), allEvents]);
});

const updatePanel = Effect.fn("DockReducer.updatePanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: UpdatePanelCommand
) {
  const tabs = yield* Effect.fromOption(DockWorkspace.findTabsForPanel(state, command.panelId), () =>
    reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
  );
  const panel = yield* Effect.fromOption(Panel.findInTabs(tabs, command.panelId), () =>
    reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
  );
  const updated = Panel.make({
    id: panel.id,
    title: O.getOrElse(command.patch.title, () => panel.title),
    view: O.getOrElse(command.patch.view, () => panel.view),
    renderMode: O.getOrElse(command.patch.renderMode, () => panel.renderMode),
    tabComponent: O.getOrElse(command.patch.tabComponent, () => panel.tabComponent),
  });
  if (Panel.equals(panel, updated)) return unchanged(state, envelope, "panel-unchanged");
  const events = A.getSomes([
    Bool.match(Eq.equals(panel.title, updated.title), {
      onTrue: O.none,
      onFalse: () =>
        O.some(PanelTitleChangedEvent.make({ panelId: panel.id, groupId: tabs.groupId, title: updated.title })),
    }),
    Bool.match(Eq.equals(panel.view, updated.view), {
      onTrue: O.none,
      onFalse: () =>
        O.some(PanelViewChangedEvent.make({ panelId: panel.id, groupId: tabs.groupId, view: updated.view })),
    }),
    Bool.match(Eq.equals(panel.renderMode, updated.renderMode), {
      onTrue: O.none,
      onFalse: () =>
        O.some(
          PanelRenderModeChangedEvent.make({
            panelId: panel.id,
            groupId: tabs.groupId,
            renderMode: updated.renderMode,
          })
        ),
    }),
    Bool.match(Eq.equals(panel.tabComponent, updated.tabComponent), {
      onTrue: O.none,
      onFalse: () =>
        O.some(
          PanelTabComponentChangedEvent.make({
            panelId: panel.id,
            groupId: tabs.groupId,
            tabComponent: updated.tabComponent,
          })
        ),
    }),
  ]);
  return yield* A.match(events, {
    onEmpty: () => Effect.succeed(unchanged(state, envelope, "panel-unchanged")),
    onNonEmpty: (changedEvents) =>
      changedMany(state, envelope, (revision) => [
        DockWorkspace.withRevision(
          DockWorkspace.replaceAtGroup(
            state,
            tabs.groupId,
            TabsNode.fromPanels(
              tabs.groupId,
              A.map(TabsNode.panels(tabs), (candidate) =>
                Bool.match(PanelId.equals(candidate.id, panel.id), {
                  onTrue: () => updated,
                  onFalse: () => candidate,
                })
              ),
              tabs.active.id,
              tabs.metadata
            )
          ),
          revision
        ),
        changedEvents,
      ]),
  });
});

const updateGroup = Effect.fn("DockReducer.updateGroup")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: UpdateGroupCommand
) {
  const tabs = yield* Effect.fromOption(DockWorkspace.findTabs(state, command.groupId), () =>
    reject(envelope, "group-not-found", `Group '${command.groupId}' does not exist.`)
  );
  const maximized = DockWorkspace.match(state, {
    empty: O.none<GroupId>,
    populated: ({ maximized }) => maximized,
  });
  const metadata = GroupMetadata.make({
    visible: O.getOrElse(command.patch.visible, () => tabs.metadata.visible),
    locked: O.getOrElse(command.patch.locked, () => tabs.metadata.locked),
    hideHeader: O.getOrElse(command.patch.hideHeader, () => tabs.metadata.hideHeader),
    headerPosition: O.getOrElse(command.patch.headerPosition, () => tabs.metadata.headerPosition),
  });
  if (GroupMetadata.equals(tabs.metadata, metadata)) {
    return unchanged(state, envelope, "group-unchanged");
  }
  const replaced = DockWorkspace.replaceAtGroup(
    state,
    tabs.groupId,
    TabsNode.make({
      groupId: tabs.groupId,
      before: tabs.before,
      active: tabs.active,
      after: tabs.after,
      metadata,
    })
  );
  const nextMaximized = Bool.match(
    Bool.and(
      O.exists(maximized, (id) => GroupId.equals(id, tabs.groupId)),
      !metadata.visible
    ),
    // fallow-ignore-next-line code-duplication
    { onTrue: O.none, onFalse: () => maximized }
  );
  const next = DockWorkspace.match(replaced, {
    empty: ({ floating }) => EmptyWorkspace.make({ floating }),
    populated: ({ root, floating }) => PopulatedWorkspace.make({ root, floating, maximized: nextMaximized }),
  });
  return yield* changedMany(state, envelope, (revision) => [
    DockWorkspace.withRevision(next, revision),
    Bool.and(
      O.exists(maximized, (id) => GroupId.equals(id, tabs.groupId)),
      !metadata.visible
    ) && O.isSome(maximized)
      ? [GroupUpdatedEvent.make({ groupId: tabs.groupId }), GroupRestoredEvent.make({ groupId: maximized.value })]
      : [GroupUpdatedEvent.make({ groupId: tabs.groupId })],
  ]);
});

const closePanel = Effect.fn("DockReducer.closePanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: ClosePanelCommand
) {
  const tabs = yield* Effect.fromOption(DockWorkspace.findTabsForPanel(state, command.panelId), () =>
    reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
  );
  const next = O.match(TabsNode.remove(tabs, command.panelId), {
    onSome: (remaining) => DockWorkspace.replaceAtGroup(state, tabs.groupId, remaining),
    onNone: () => DockWorkspace.removeTabs(state, tabs.groupId),
  });
  return yield* changed(state, envelope, (revision) => [
    DockWorkspace.withRevision(next, revision),
    PanelClosedEvent.make({
      panelId: command.panelId,
      groupId: tabs.groupId,
    }),
  ]);
});

const resizeSplit = Effect.fn("DockReducer.resizeSplit")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: ResizeSplitCommand
) {
  const split = yield* Effect.fromOption(DockWorkspace.findSplit(state, command.splitId), () =>
    reject(envelope, "split-not-found", `Split '${command.splitId}' does not exist.`)
  );
  return yield* Bool.match(SplitRatio.equals(SplitLayout.ratio(split.layout), command.ratio), {
    onTrue: () => Effect.succeed(unchanged(state, envelope, "split-ratio-unchanged")),
    onFalse: () => {
      const resized = SplitNode.withRatio(split, command.ratio);
      return changed(state, envelope, (revision) => [
        DockWorkspace.withRevision(DockWorkspace.replaceSplit(state, resized), revision),
        SplitResizedEvent.make({
          splitId: command.splitId,
          ratio: command.ratio,
        }),
      ]);
    },
  });
});

const maximizeGroup = Effect.fn("DockReducer.maximizeGroup")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: MaximizeGroupCommand
) {
  if (DockWorkspace.isFloatingGroup(state, command.groupId)) {
    return yield* reject(envelope, "group-floating", "Floating groups cannot be maximized.");
  }
  return yield* DockWorkspace.match(state, {
    empty: () => reject(envelope, "group-not-found", `Group '${command.groupId}' does not exist.`),
    populated: Effect.fnUntraced(function* (workspace) {
      const tabs = yield* Effect.fromOption(DockNode.findTabs(workspace.root, command.groupId), () =>
        reject(envelope, "group-not-found", `Group '${command.groupId}' does not exist.`)
      );
      if (O.exists(workspace.maximized, (groupId) => GroupId.equals(groupId, command.groupId))) {
        return unchanged(workspace, envelope, "group-already-maximized");
      }
      const reveal = !tabs.metadata.visible;
      const nextTabs = reveal
        ? TabsNode.make({ ...tabs, metadata: GroupMetadata.make({ ...tabs.metadata, visible: true }) })
        : tabs;
      const events: A.NonEmptyReadonlyArray<DockEvent> = reveal
        ? [GroupUpdatedEvent.make({ groupId: command.groupId }), GroupMaximizedEvent.make({ groupId: command.groupId })]
        : [GroupMaximizedEvent.make({ groupId: command.groupId })];
      return yield* changedMany(workspace, envelope, (revision) => [
        PopulatedWorkspace.make({
          revision,
          root: DockNode.replaceAtGroup(workspace.root, command.groupId, nextTabs),
          maximized: O.some(command.groupId),
          floating: workspace.floating,
        }),
        events,
      ]);
    }),
  });
});

const restoreMaximized = Effect.fn("DockReducer.restoreMaximized")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  _command: RestoreMaximizedCommand
) {
  return yield* DockWorkspace.match(state, {
    empty: () => Effect.succeed(unchanged(state, envelope, "no-group-maximized")),
    populated: (workspace) =>
      O.match(workspace.maximized, {
        onNone: () => Effect.succeed(unchanged(workspace, envelope, "no-group-maximized")),
        onSome: (groupId) =>
          changed(workspace, envelope, (revision) => [
            PopulatedWorkspace.make({
              revision,
              root: workspace.root,
              maximized: O.none(),
              floating: workspace.floating,
            }),
            GroupRestoredEvent.make({ groupId }),
          ]),
      }),
  });
});

const clearWorkspace = Effect.fn("DockReducer.clearWorkspace")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  _command: ClearWorkspaceCommand
) {
  return yield* DockWorkspace.match(state, {
    empty: (workspace) =>
      A.match(workspace.floating, {
        onEmpty: () => reject(envelope, "workspace-empty", "The workspace is already empty."),
        onNonEmpty: () =>
          changed(workspace, envelope, (revision) => [EmptyWorkspace.make({ revision }), WorkspaceClearedEvent.make()]),
      }),
    populated: (workspace) =>
      changed(workspace, envelope, (revision) => [EmptyWorkspace.make({ revision }), WorkspaceClearedEvent.make()]),
  });
});

const floatGroup = Effect.fn("DockReducer.floatGroup")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: FloatGroupCommand
) {
  if (DockWorkspace.isFloatingGroup(state, command.groupId)) {
    return yield* reject(envelope, "group-not-docked", `Group '${command.groupId}' is already floating.`);
  }
  return yield* DockWorkspace.match(state, {
    empty: () => reject(envelope, "group-not-docked", `Group '${command.groupId}' is not docked.`),
    populated: Effect.fnUntraced(function* (workspace) {
      const source = yield* Effect.fromOption(DockNode.findTabs(workspace.root, command.groupId), () =>
        reject(envelope, "group-not-docked", `Group '${command.groupId}' is not docked.`)
      );
      const docked = DockNode.removeTabs(workspace.root, source.groupId);
      const floating = A.append(
        workspace.floating,
        FloatingMember.make({ anchoredBox: command.anchoredBox, root: source })
      );
      return yield* changed(workspace, envelope, (revision) => [
        O.match(docked, {
          onNone: () => EmptyWorkspace.make({ revision, floating }),
          onSome: (root) => PopulatedWorkspace.make({ revision, root, floating }),
        }),
        GroupFloatedEvent.make({ groupId: source.groupId }),
      ]);
    }),
  });
});

const dockFloatingGroup = Effect.fn("DockReducer.dockFloatingGroup")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: DockFloatingGroupCommand
) {
  if (!DockWorkspace.isFloatingGroup(state, command.groupId)) {
    return yield* reject(envelope, "group-not-floating", `Group '${command.groupId}' is not floating.`);
  }
  const source = yield* Effect.fromOption(DockWorkspace.findTabs(state, command.groupId), () =>
    reject(envelope, "group-not-floating", `Group '${command.groupId}' is not floating.`)
  );
  const floating = A.flatMap(DockWorkspace.floatingMembers(state), (member) =>
    pipe(
      DockNode.findTabs(member.root, command.groupId),
      O.map(() =>
        pipe(
          // fallow-ignore-next-line code-duplication
          DockNode.removeTabs(member.root, command.groupId),
          O.map((root) => A.of(FloatingMember.make({ anchoredBox: member.anchoredBox, root }))),
          O.getOrElse(A.empty)
        )
      ),
      O.getOrElse(() => A.of(member))
    )
  );
  const dockedRoot = DockWorkspace.match(state, {
    empty: O.none<DockNode>,
    populated: ({ root }) => O.some(root),
  });
  const root = yield* DockGroupMoveTarget.match(command.target, {
    tab: Effect.fnUntraced(function* (target) {
      const current = yield* Effect.fromOption(
        pipe(
          dockedRoot,
          O.flatMap((root) => DockNode.findTabs(root, target.groupId))
        ),
        () => reject(envelope, "group-not-found", `Docked target group '${target.groupId}' does not exist.`)
      );
      if (GroupId.equals(source.groupId, current.groupId))
        return yield* reject(envelope, "same-group-move", "A group cannot merge into itself.");
      const index = N.clamp(
        O.getOrElse(target.index, () => A.length(TabsNode.panels(current))),
        { minimum: 0, maximum: A.length(TabsNode.panels(current)) }
      );
      const [before, after] = A.splitAt(TabsNode.panels(current), index);
      const panels = A.appendAll(A.appendAll(before, TabsNode.panels(source)), after);
      const active = target.activate ? source.active.id : current.active.id;
      return DockNode.replaceAtGroup(
        O.getOrThrow(dockedRoot),
        current.groupId,
        TabsNode.fromPanels(current.groupId, panels, active, current.metadata)
      );
    }),
    groupSplit: Effect.fnUntraced(function* (target) {
      const currentRoot = yield* Effect.fromOption(dockedRoot, () =>
        reject(envelope, "workspace-empty", "A sibling target requires a docked tree.")
      );
      const reference = yield* Effect.fromOption(DockNode.findTabs(currentRoot, target.referenceGroupId), () =>
        reject(envelope, "group-not-found", `Docked target group '${target.referenceGroupId}' does not exist.`)
      );
      return DockNode.replaceAtGroup(currentRoot, reference.groupId, SplitNode.fromNodes(reference, source, target));
    }),
    groupRootSplit: (target) =>
      O.match(dockedRoot, {
        onNone: () => Effect.succeed(source),
        onSome: (currentRoot) => Effect.succeed(SplitNode.fromNodes(currentRoot, source, target)),
      }),
  });
  return yield* changed(state, envelope, (revision) => [
    PopulatedWorkspace.make({ revision, root, floating }),
    GroupDockedEvent.make({ groupId: source.groupId }),
  ]);
});

const moveFloatingGroup = Effect.fn("DockReducer.moveFloatingGroup")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: MoveFloatingGroupCommand
) {
  const members = DockWorkspace.floatingMembers(state);
  const index = yield* Effect.fromOption(
    pipe(
      members,
      A.findFirstIndex((member) => O.isSome(DockNode.findTabs(member.root, command.groupId)))
    ),
    () => reject(envelope, "group-not-floating", `Group '${command.groupId}' is not floating.`)
  );
  const member = O.getOrThrow(A.get(members, index));
  if (Eq.equals(member.anchoredBox, command.anchoredBox) && Eq.equals(index, A.length(members) - 1)) {
    return unchanged(state, envelope, "floating-position-unchanged");
  }
  const floating = A.append(
    A.remove(members, index),
    FloatingMember.make({ anchoredBox: command.anchoredBox, root: member.root })
  );
  return yield* changed(state, envelope, (revision) => [
    DockWorkspace.match(state, {
      empty: () => EmptyWorkspace.make({ revision, floating }),
      populated: ({ root, maximized }) => PopulatedWorkspace.make({ revision, root, maximized, floating }),
    }),
    FloatingGroupMovedEvent.make({ groupId: command.groupId }),
  ]);
});

const installDockedRoot = (state: DockWorkspace, root: DockNode): DockWorkspace =>
  DockWorkspace.match(state, {
    empty: ({ revision, floating }) => PopulatedWorkspace.make({ revision, root, floating }),
    populated: ({ revision, maximized, floating }) => PopulatedWorkspace.make({ revision, root, maximized, floating }),
  });

const movePanelForest = Effect.fn("DockReducer.movePanelForest")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: MovePanelCommand
) {
  // fallow-ignore-next-line code-duplication
  const source = yield* Effect.fromOption(DockWorkspace.findTabsForPanel(state, command.panelId), () =>
    reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
  );
  const panel = yield* Effect.fromOption(Panel.findInTabs(source, command.panelId), () =>
    reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
  );
  if (DockMoveTarget.guards.tab(command.target) && GroupId.equals(source.groupId, command.target.groupId)) {
    if (O.isNone(command.target.index))
      return yield* reject(envelope, "same-group-move", "A same-group move requires an insertion index.");
    const panels = TabsNode.panels(source);
    const current = O.getOrThrow(A.findFirstIndex(panels, (candidate) => PanelId.equals(candidate.id, panel.id)));
    const without = A.remove(panels, current);
    const index = N.clamp(command.target.index.value, { minimum: 0, maximum: A.length(without) });
    if (Eq.equals(current, index)) return unchanged(state, envelope, "panel-position-unchanged");
    const reordered = O.getOrThrow(A.insertAt(without, index, panel)); // crispen: total after clamp; use total insert when available.
    const next = DockWorkspace.replaceAtGroup(
      state,
      source.groupId,
      TabsNode.fromPanels(source.groupId, reordered, source.active.id, source.metadata)
    );
    return yield* changed(state, envelope, (revision) => [
      DockWorkspace.withRevision(next, revision),
      PanelReorderedEvent.make({ panelId: panel.id, groupId: source.groupId, index: NonNegativeInt.make(index) }),
    ]);
  }
  yield* DockMoveTarget.match(command.target, {
    tab: (target) =>
      Effect.fromOption(DockWorkspace.findTabs(state, target.groupId), () =>
        reject(envelope, "group-not-found", `Group '${target.groupId}' does not exist.`)
      ).pipe(Effect.asVoid),
    split: Effect.fnUntraced(function* (target) {
      if (O.isSome(DockWorkspace.findTabs(state, target.newGroupId)))
        return yield* reject(envelope, "group-already-exists", `Group '${target.newGroupId}' already exists.`);
      if (O.isSome(DockWorkspace.findSplit(state, target.splitId)))
        return yield* reject(envelope, "split-already-exists", `Split '${target.splitId}' already exists.`);
      yield* Effect.fromOption(DockWorkspace.findTabs(state, target.referenceGroupId), () =>
        reject(envelope, "group-not-found", `Group '${target.referenceGroupId}' does not exist.`)
      );
    }),
    rootSplit: Effect.fnUntraced(function* (target) {
      if (O.isSome(DockWorkspace.findTabs(state, target.newGroupId)))
        return yield* reject(envelope, "group-already-exists", `Group '${target.newGroupId}' already exists.`);
      if (O.isSome(DockWorkspace.findSplit(state, target.splitId)))
        return yield* reject(envelope, "split-already-exists", `Split '${target.splitId}' already exists.`);
    }),
  });
  const removed = O.match(TabsNode.remove(source, panel.id), {
    onSome: (tabs) => DockWorkspace.replaceAtGroup(state, source.groupId, tabs),
    onNone: () => DockWorkspace.removeTabs(state, source.groupId),
  });
  const [next, toGroupId] = yield* DockMoveTarget.match(command.target, {
    tab: Effect.fnUntraced(function* (target) {
      const tabs = yield* Effect.fromOption(DockWorkspace.findTabs(removed, target.groupId), () =>
        DockInvariantViolation.make({ reason: "topology-corrupted", message: "Move target disappeared." })
      );
      return [
        DockWorkspace.replaceAtGroup(removed, tabs.groupId, TabsNode.insert(tabs, panel, target)),
        tabs.groupId,
      ] as const;
    }),
    split: Effect.fnUntraced(function* (target) {
      const tabs = yield* Effect.fromOption(DockWorkspace.findTabs(removed, target.referenceGroupId), () =>
        DockInvariantViolation.make({ reason: "topology-corrupted", message: "Split target disappeared." })
      );
      return [
        DockWorkspace.replaceAtGroup(removed, tabs.groupId, SplitNode.fromPlacement(tabs, panel, target)),
        target.newGroupId,
      ] as const;
    }),
    rootSplit: (target) => {
      const inserted = TabsNode.make({ groupId: target.newGroupId, active: panel });
      const root = DockWorkspace.match(removed, {
        empty: () => inserted,
        populated: ({ root }) => SplitNode.fromNodes(root, inserted, target),
      });
      return Effect.succeed([installDockedRoot(removed, root), target.newGroupId] as const);
    },
  });
  return yield* changed(state, envelope, (revision) => [
    DockWorkspace.withRevision(next, revision),
    PanelMovedEvent.make({ panelId: panel.id, fromGroupId: source.groupId, toGroupId }),
  ]);
});

const moveGroupForest = Effect.fn("DockReducer.moveGroupForest")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: MoveGroupCommand
) {
  const source = yield* Effect.fromOption(DockWorkspace.findTabs(state, command.groupId), () =>
    reject(envelope, "group-not-found", `Group '${command.groupId}' does not exist.`)
  );
  const removed = DockWorkspace.removeTabs(state, source.groupId);
  return yield* DockGroupMoveTarget.match(command.target, {
    tab: Effect.fnUntraced(function* (target) {
      if (GroupId.equals(source.groupId, target.groupId))
        return yield* reject(envelope, "same-group-move", "A group cannot merge into itself.");
      const destination = yield* Effect.fromOption(DockWorkspace.findTabs(removed, target.groupId), () =>
        reject(envelope, "group-not-found", `Group '${target.groupId}' does not exist.`)
      );
      const index = N.clamp(
        O.getOrElse(target.index, () => A.length(TabsNode.panels(destination))),
        { minimum: 0, maximum: A.length(TabsNode.panels(destination)) }
      );
      const [before, after] = A.splitAt(TabsNode.panels(destination), index);
      const panels = A.appendAll(A.appendAll(before, TabsNode.panels(source)), after);
      const merged = TabsNode.fromPanels(
        destination.groupId,
        panels,
        target.activate ? source.active.id : destination.active.id,
        destination.metadata
      );
      const next = DockWorkspace.replaceAtGroup(removed, destination.groupId, merged);
      return yield* changed(state, envelope, (revision) => [
        DockWorkspace.withRevision(next, revision),
        GroupMergedEvent.make({
          fromGroupId: source.groupId,
          toGroupId: destination.groupId,
          panelIds: A.map(TabsNode.panels(source), (panel) => panel.id),
        }),
      ]);
    }),
    groupSplit: Effect.fnUntraced(function* (target) {
      if (GroupId.equals(source.groupId, target.referenceGroupId))
        return yield* reject(envelope, "same-group-move", "A group cannot relocate beside itself.");
      if (O.isSome(DockWorkspace.findSplit(removed, target.splitId)))
        return yield* reject(envelope, "split-already-exists", `Split '${target.splitId}' already exists.`);
      const reference = yield* Effect.fromOption(DockWorkspace.findTabs(removed, target.referenceGroupId), () =>
        reject(envelope, "group-not-found", `Group '${target.referenceGroupId}' does not exist.`)
      );
      const next = DockWorkspace.replaceAtGroup(
        removed,
        reference.groupId,
        SplitNode.fromNodes(reference, source, target)
      );
      return yield* changed(state, envelope, (revision) => [
        DockWorkspace.withRevision(next, revision),
        GroupMovedEvent.make({ groupId: source.groupId, splitId: target.splitId }),
      ]);
    }),
    groupRootSplit: (target) =>
      DockWorkspace.match(removed, {
        empty: () =>
          DockWorkspace.isFloatingGroup(state, source.groupId)
            ? reject(
                envelope,
                "workspace-empty",
                "Root split move requires an existing docked root; use DockFloatingGroupCommand to dock a floating group."
              )
            : Effect.succeed(unchanged(state, envelope, "topology-unchanged")),
        populated: Effect.fnUntraced(function* ({ root: currentRoot }) {
          if (O.isSome(DockWorkspace.findSplit(removed, target.splitId)))
            return yield* reject(envelope, "split-already-exists", `Split '${target.splitId}' already exists.`);
          const root = SplitNode.fromNodes(currentRoot, source, target);
          const next = installDockedRoot(removed, root);
          return yield* changed(state, envelope, (revision) => [
            DockWorkspace.withRevision(next, revision),
            GroupMovedEvent.make({ groupId: source.groupId, splitId: target.splitId }),
          ]);
        }),
      }),
  });
});

/**
 * Applies one command and validates its next state before publication.
 *
 * @remarks
 * Each accepted transition publishes exactly one validated revision; unchanged
 * commands retain the current revision and emit no events.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, ClearWorkspaceCommand, CommandId, DockCommandEnvelope, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, reduceDockCommand } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const envelope = DockCommandEnvelope.make({ commandId: CommandId.make("command-clear"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), command: ClearWorkspaceCommand.make() })
 * const transition = Effect.runSync(reduceDockCommand(workspace, envelope))
 * console.log(transition.result._tag)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const reduceDockCommand = Effect.fn("DockReducer.reduceDockCommand")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope
): Effect.fn.Return<DockMutationOutcome, DockTransitionError> {
  yield* validateWorkspace(state);
  yield* Effect.annotateCurrentSpan({
    command_id: envelope.commandId,
    command_kind: envelope.command.kind,
    command_origin: envelope.origin.kind,
  });
  const rawResult = yield* DockCommand.match(envelope.command, {
    openPanel: (command) => openPanel(state, envelope, command),
    activatePanel: (command) => activatePanelCommand(state, envelope, command),
    updatePanel: (command) => updatePanel(state, envelope, command),
    movePanel: (command) => movePanelForest(state, envelope, command),
    moveGroup: (command) => moveGroupForest(state, envelope, command),
    updateGroup: (command) => updateGroup(state, envelope, command),
    closePanel: (command) => closePanel(state, envelope, command),
    resizeSplit: (command) => resizeSplit(state, envelope, command),
    clearWorkspace: (command) => clearWorkspace(state, envelope, command),
    maximizeGroup: (command) => maximizeGroup(state, envelope, command),
    restoreMaximized: (command) => restoreMaximized(state, envelope, command),
    floatGroup: (command) => floatGroup(state, envelope, command),
    dockFloatingGroup: (command) => dockFloatingGroup(state, envelope, command),
    moveFloatingGroup: (command) => moveFloatingGroup(state, envelope, command),
  });
  const structural = DockCommand.match(envelope.command, {
    openPanel: () => true,
    activatePanel: () => false,
    updatePanel: () => false,
    movePanel: () => true,
    moveGroup: () => true,
    updateGroup: () => false,
    closePanel: () => true,
    resizeSplit: () => false,
    clearWorkspace: () => true,
    maximizeGroup: () => false,
    restoreMaximized: () => false,
    floatGroup: () => true,
    dockFloatingGroup: () => true,
    moveFloatingGroup: () => false,
  });
  const preserve = DockCommand.match(envelope.command, {
    openPanel: () => false,
    activatePanel: () => false,
    updatePanel: () => true,
    movePanel: () => false,
    moveGroup: () => false,
    updateGroup: () => false,
    closePanel: () => false,
    resizeSplit: () => true,
    clearWorkspace: () => false,
    maximizeGroup: () => false,
    restoreMaximized: () => false,
    floatGroup: () => false,
    dockFloatingGroup: () => false,
    moveFloatingGroup: () => true,
  });
  const result = DockMutationResult.match(rawResult.result, {
    Unchanged: () => rawResult,
    Changed: (outcome) => {
      const previousMaximizedOption = DockWorkspace.guards.populated(state) ? state.maximized : O.none();
      if (O.isNone(previousMaximizedOption)) return rawResult;
      const previousMaximized = previousMaximizedOption.value;
      if (structural) {
        return DockMutationOutcome.make({
          commandId: rawResult.commandId,
          origin: rawResult.origin,
          result: DockChanged.make({
            ...outcome,
            state: DockWorkspace.guards.populated(outcome.state)
              ? PopulatedWorkspace.make({ ...outcome.state, maximized: O.none() })
              : outcome.state,
            events: A.append(outcome.events, GroupRestoredEvent.make({ groupId: previousMaximized })),
          }),
        });
      }
      if (preserve && DockWorkspace.guards.populated(outcome.state)) {
        return DockMutationOutcome.make({
          commandId: rawResult.commandId,
          origin: rawResult.origin,
          result: DockChanged.make({
            ...outcome,
            state: PopulatedWorkspace.make({ ...outcome.state, maximized: O.some(previousMaximized) }),
          }),
        });
      }
      return rawResult;
    },
  });
  yield* DockMutationResult.match(result.result, {
    Changed: Effect.fnUntraced(function* (outcome) {
      yield* validateWorkspace(outcome.state);
      yield* Effect.logDebug("dock command changed state").pipe(
        Effect.annotateLogs({
          commandId: envelope.commandId,
          commandKind: envelope.command.kind,
          revision: outcome.state.revision,
        })
      );
      yield* Metric.update(changedCommandCount, 1);
    }),
    Unchanged: (outcome) =>
      Effect.logDebug("dock command left state unchanged").pipe(
        Effect.annotateLogs({
          commandId: envelope.commandId,
          commandKind: envelope.command.kind,
          reason: outcome.reason,
          revision: outcome.revision,
        })
      ),
  });
  return result;
});

/**
 * Builds a monotonic outcome after a snapshot has decoded successfully.
 *
 * @remarks
 * Both current and restored workspaces are validated before comparison. A changed
 * restore preserves the snapshot content but advances from the live revision.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, DockWorkspace, GroupId, Panel, PanelId, PopulatedWorkspace, RestoreSnapshotRequest, TabsNode, TextPanelView, restoreDockWorkspace } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const restored = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const request = RestoreSnapshotRequest.make({ commandId: CommandId.make("command-restore"), origin: ApiCommandOrigin.make({ requestId: "request-one" }) })
 * const outcome = Effect.runSync(restoreDockWorkspace(DockWorkspace.empty, restored, request))
 * console.log(outcome.result._tag)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const restoreDockWorkspace = Effect.fn("DockReducer.restoreDockWorkspace")(function* (
  current: DockWorkspace,
  restored: DockWorkspace,
  request: RestoreSnapshotRequest
) {
  yield* validateWorkspace(current);
  yield* validateWorkspace(restored);
  return yield* Bool.match(DockWorkspace.hasSameContent(current, restored), {
    onTrue: () => Effect.succeed(unchanged(current, request, "snapshot-identical")),
    onFalse: () =>
      changed(current, request, (installedRevision) => [
        DockWorkspace.withRevision(restored, installedRevision),
        WorkspaceRestoredEvent.make({
          sourceRevision: restored.revision,
          installedRevision,
        }),
      ]),
  });
});

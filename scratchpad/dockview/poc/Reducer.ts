/**
 * Global invariant diagnostics and typed Effect transitions for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt } from "@beep/schema";
import { Effect, Metric } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import type { DockInvariantReason, DockRejectionReason, DockTransitionError, DockUnchangedReason } from "./Domain.ts";
import {
  type ActivatePanelCommand,
  type ClearWorkspaceCommand,
  type ClosePanelCommand,
  DockChanged,
  DockCommand,
  type DockCommandEnvelope,
  DockCommandRejected,
  type DockEvent,
  DockInvariantViolation,
  DockMoveTarget,
  DockMutationOutcome,
  DockMutationResult,
  DockNode,
  DockPlacement,
  DockUnchanged,
  DockWorkspace,
  EmptyWorkspace,
  GroupId,
  type MovePanelCommand,
  type OpenPanelCommand,
  Panel,
  PanelActivatedEvent,
  PanelClosedEvent,
  PanelId,
  PanelMovedEvent,
  PanelOpenedEvent,
  PopulatedWorkspace,
  type ResizeSplitCommand,
  type RestoreSnapshotRequest,
  SplitLayout,
  SplitNode,
  SplitRatio,
  SplitResizedEvent,
  TabsNode,
  WorkspaceClearedEvent,
  WorkspaceRestoredEvent,
} from "./Domain.ts";

const changedCommandCount = Metric.counter("dockview_poc_state_changes_total", {
  description: "Dockview POC commands that changed state.",
  incremental: true,
});

const nextRevision = (state: DockWorkspace) => NonNegativeInt.make(state.revision + 1);

const ensureRevisionAvailable = (state: DockWorkspace): Effect.Effect<void, DockInvariantViolation> =>
  Bool.match(N.isLessThan(state.revision, globalThis.Number.MAX_SAFE_INTEGER), {
    onTrue: () => Effect.void,
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
    onTrue: () => Effect.void,
    onFalse: () => DockInvariantViolation.make({ reason, message }),
  });

/** Provides reason-specific diagnostics for public workspace invariants. */
// crispen: the public schema already enforces identity uniqueness; this Effect
// pass remains until schema filters can preserve the exact typed boundary reason.
export const validateWorkspace = Effect.fn("DockReducer.validateWorkspace")(function* (state: DockWorkspace) {
  return yield* DockWorkspace.match(state, {
    empty: (workspace): Effect.Effect<DockWorkspace> => Effect.succeed(workspace),
    populated: Effect.fnUntraced(function* (workspace) {
      const tabs = DockNode.tabs(workspace.root);
      const splits = DockNode.splits(workspace.root);
      yield* ensureUnique(
        A.map(DockNode.panels(workspace.root), (panel) => panel.id),
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
      return workspace;
    }),
  });
});

const openPanel = Effect.fn("DockReducer.openPanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: OpenPanelCommand
) {
  yield* Bool.match(O.isSome(DockWorkspace.findPanel(state, command.panel.id)), {
    onTrue: () => reject(envelope, "panel-already-open", `Panel '${command.panel.id}' is already open.`),
    onFalse: () => Effect.void,
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
            }),
            PanelOpenedEvent.make({
              panelId: command.panel.id,
              groupId: placement.groupId,
            }),
          ]),
      }),
    tab: (placement) =>
      DockWorkspace.match(state, {
        empty: () => reject(envelope, "workspace-empty", "Tab placement requires an existing group."),
        populated: (workspace) =>
          O.match(DockNode.findTabs(workspace.root, placement.groupId), {
            onNone: () => reject(envelope, "group-not-found", `Group '${placement.groupId}' does not exist.`),
            onSome: (tabs) =>
              changed(workspace, envelope, (revision) => [
                PopulatedWorkspace.make({
                  revision,
                  root: DockNode.replaceAtGroup(workspace.root, tabs.groupId, TabsNode.append(tabs, command.panel)),
                }),
                PanelOpenedEvent.make({
                  panelId: command.panel.id,
                  groupId: placement.groupId,
                }),
              ]),
          }),
      }),
    split: (placement) =>
      DockWorkspace.match(state, {
        empty: () => reject(envelope, "workspace-empty", "Split placement requires an existing group."),
        populated: Effect.fnUntraced(function* (workspace) {
          yield* Bool.match(O.isSome(DockNode.findTabs(workspace.root, placement.newGroupId)), {
            onTrue: () => reject(envelope, "group-already-exists", `Group '${placement.newGroupId}' already exists.`),
            onFalse: () => Effect.void,
          });
          yield* Bool.match(O.isSome(DockNode.findSplit(workspace.root, placement.splitId)), {
            onTrue: () => reject(envelope, "split-already-exists", `Split '${placement.splitId}' already exists.`),
            onFalse: () => Effect.void,
          });
          return yield* O.match(DockNode.findTabs(workspace.root, placement.referenceGroupId), {
            onNone: () =>
              reject(envelope, "group-not-found", `Reference group '${placement.referenceGroupId}' does not exist.`),
            onSome: (reference) => {
              const root = DockNode.replaceAtGroup(
                workspace.root,
                reference.groupId,
                SplitNode.fromPlacement(reference, command.panel, placement)
              );
              return changed(workspace, envelope, (revision) => [
                PopulatedWorkspace.make({
                  revision,
                  root,
                }),
                PanelOpenedEvent.make({
                  panelId: command.panel.id,
                  groupId: placement.newGroupId,
                }),
              ]);
            },
          });
        }),
      }),
  });
});

const activatePanelCommand = Effect.fn("DockReducer.activatePanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: ActivatePanelCommand
) {
  return yield* DockWorkspace.match(state, {
    empty: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
    populated: Effect.fnUntraced(function* (workspace) {
      const tabs = yield* Effect.fromOption(TabsNode.findForPanel(workspace.root, command.panelId), () =>
        reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
      );
      return yield* Bool.match(PanelId.equals(tabs.active.id, command.panelId), {
        onTrue: () => Effect.succeed(unchanged(workspace, envelope, "panel-already-active")),
        onFalse: Effect.fnUntraced(function* () {
          const activated = yield* Effect.fromOption(TabsNode.activate(tabs, command.panelId), () =>
            reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
          );
          return yield* changed(workspace, envelope, (revision) => [
            PopulatedWorkspace.make({
              revision,
              root: DockNode.replaceAtGroup(workspace.root, activated.groupId, activated),
            }),
            PanelActivatedEvent.make({
              panelId: command.panelId,
              groupId: tabs.groupId,
            }),
          ]);
        }),
      });
    }),
  });
});

const movePanel = Effect.fn("DockReducer.movePanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: MovePanelCommand
) {
  return yield* DockWorkspace.match(state, {
    empty: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
    populated: Effect.fnUntraced(function* (workspace) {
      const source = yield* Effect.fromOption(TabsNode.findForPanel(workspace.root, command.panelId), () =>
        reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
      );
      const panel = yield* Effect.fromOption(Panel.findInTabs(source, command.panelId), () =>
        reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
      );

      yield* DockMoveTarget.match(command.target, {
        tab: Effect.fnUntraced(function* (target) {
          const targetTabs = yield* Effect.fromOption(DockNode.findTabs(workspace.root, target.groupId), () =>
            reject(envelope, "group-not-found", `Group '${target.groupId}' does not exist.`)
          );
          yield* Bool.match(GroupId.equals(source.groupId, targetTabs.groupId), {
            onTrue: () => reject(envelope, "same-group-move", "Move destination must be a different group."),
            onFalse: () => Effect.void,
          });
        }),
        split: Effect.fnUntraced(function* (target) {
          yield* Bool.match(O.isSome(DockNode.findTabs(workspace.root, target.newGroupId)), {
            onTrue: () => reject(envelope, "group-already-exists", `Group '${target.newGroupId}' already exists.`),
            onFalse: () => Effect.void,
          });
          yield* Bool.match(O.isSome(DockNode.findSplit(workspace.root, target.splitId)), {
            onTrue: () => reject(envelope, "split-already-exists", `Split '${target.splitId}' already exists.`),
            onFalse: () => Effect.void,
          });
          const reference = yield* Effect.fromOption(DockNode.findTabs(workspace.root, target.referenceGroupId), () =>
            reject(envelope, "group-not-found", `Reference group '${target.referenceGroupId}' does not exist.`)
          );
          yield* Bool.match(
            Bool.and(
              GroupId.equals(source.groupId, reference.groupId),
              Eq.equals(A.length(TabsNode.panels(source)), 1)
            ),
            {
              onTrue: () =>
                reject(
                  envelope,
                  "source-group-would-disappear",
                  "The only panel in a group cannot be docked beside that same group."
                ),
              onFalse: () => Effect.void,
            }
          );
        }),
      });

      const rootWithoutSource = yield* O.match(TabsNode.remove(source, command.panelId), {
        onSome: (remaining) => Effect.succeed(DockNode.replaceAtGroup(workspace.root, remaining.groupId, remaining)),
        onNone: () =>
          O.match(DockNode.removeTabs(workspace.root, source.groupId), {
            onSome: (value) => Effect.succeed(value),
            onNone: () =>
              DockInvariantViolation.make({
                reason: "topology-corrupted",
                message: "A valid move destination must survive removal of the source panel.",
              }),
          }),
      });

      const destination = yield* DockMoveTarget.match(command.target, {
        tab: (target) =>
          Effect.fromOption(DockNode.findTabs(rootWithoutSource, target.groupId), () =>
            DockInvariantViolation.make({
              reason: "topology-corrupted",
              message: "Move destination disappeared while collapsing the source group.",
            })
          ).pipe(
            Effect.map((currentTarget) => ({
              groupId: currentTarget.groupId,
              root: DockNode.replaceAtGroup(
                rootWithoutSource,
                currentTarget.groupId,
                TabsNode.append(currentTarget, panel)
              ),
            }))
          ),
        split: (target) =>
          Effect.fromOption(DockNode.findTabs(rootWithoutSource, target.referenceGroupId), () =>
            DockInvariantViolation.make({
              reason: "topology-corrupted",
              message: "Split reference disappeared while collapsing the source group.",
            })
          ).pipe(
            Effect.map((reference) => ({
              groupId: target.newGroupId,
              root: DockNode.replaceAtGroup(
                rootWithoutSource,
                reference.groupId,
                SplitNode.fromPlacement(reference, panel, target)
              ),
            }))
          ),
      });

      return yield* changed(workspace, envelope, (revision) => [
        PopulatedWorkspace.make({
          revision,
          root: destination.root,
        }),
        PanelMovedEvent.make({
          panelId: command.panelId,
          fromGroupId: source.groupId,
          toGroupId: destination.groupId,
        }),
      ]);
    }),
  });
});

const closePanel = Effect.fn("DockReducer.closePanel")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: ClosePanelCommand
) {
  return yield* DockWorkspace.match(state, {
    empty: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
    populated: Effect.fnUntraced(function* (workspace) {
      const tabs = yield* Effect.fromOption(TabsNode.findForPanel(workspace.root, command.panelId), () =>
        reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`)
      );
      const root = O.match(TabsNode.remove(tabs, command.panelId), {
        onSome: (remaining) => O.some(DockNode.replaceAtGroup(workspace.root, remaining.groupId, remaining)),
        onNone: () => DockNode.removeTabs(workspace.root, tabs.groupId),
      });
      return yield* changed(workspace, envelope, (revision) => [
        O.match(root, {
          onNone: () => EmptyWorkspace.make({ revision }),
          onSome: (nextRoot) => PopulatedWorkspace.make({ revision, root: nextRoot }),
        }),
        PanelClosedEvent.make({
          panelId: command.panelId,
          groupId: tabs.groupId,
        }),
      ]);
    }),
  });
});

const resizeSplit = Effect.fn("DockReducer.resizeSplit")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  command: ResizeSplitCommand
) {
  return yield* DockWorkspace.match(state, {
    empty: () => reject(envelope, "split-not-found", `Split '${command.splitId}' does not exist.`),
    populated: Effect.fnUntraced(function* (workspace) {
      const split = yield* Effect.fromOption(DockNode.findSplit(workspace.root, command.splitId), () =>
        reject(envelope, "split-not-found", `Split '${command.splitId}' does not exist.`)
      );
      return yield* Bool.match(SplitRatio.equals(SplitLayout.ratio(split.layout), command.ratio), {
        onTrue: () => Effect.succeed(unchanged(workspace, envelope, "split-ratio-unchanged")),
        onFalse: () => {
          const resized = SplitNode.withRatio(split, command.ratio);
          return changed(workspace, envelope, (revision) => [
            PopulatedWorkspace.make({
              revision,
              root: DockNode.replaceSplit(workspace.root, resized),
            }),
            SplitResizedEvent.make({
              splitId: command.splitId,
              ratio: command.ratio,
            }),
          ]);
        },
      });
    }),
  });
});

const clearWorkspace = Effect.fn("DockReducer.clearWorkspace")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope,
  _command: ClearWorkspaceCommand
) {
  return yield* DockWorkspace.match(state, {
    empty: () => reject(envelope, "workspace-empty", "The workspace is already empty."),
    populated: (workspace) =>
      changed(workspace, envelope, (revision) => [EmptyWorkspace.make({ revision }), WorkspaceClearedEvent.make()]),
  });
});

/** Applies one command and validates its complete next tree before publication. */
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
  const result = yield* DockCommand.match(envelope.command, {
    openPanel: (command) => openPanel(state, envelope, command),
    activatePanel: (command) => activatePanelCommand(state, envelope, command),
    movePanel: (command) => movePanel(state, envelope, command),
    closePanel: (command) => closePanel(state, envelope, command),
    resizeSplit: (command) => resizeSplit(state, envelope, command),
    clearWorkspace: (command) => clearWorkspace(state, envelope, command),
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

/** Builds a monotonic restore outcome after the snapshot has decoded successfully. */
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

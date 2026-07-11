/**
 * Pure topology queries and typed Effect transitions for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt } from "@beep/schema";
import { Effect, Metric, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { DockInvariantReason, DockRejectionReason, DockTransitionError } from "./Domain.ts";
import {
  type ActivatePanelCommand,
  type ClearWorkspaceCommand,
  type ClosePanelCommand,
  DockCommand,
  type DockCommandEnvelope,
  DockCommandRejected,
  type DockEvent,
  DockInvariantViolation,
  DockNode,
  DockPlacement,
  DockSide,
  DockTransition,
  DockWorkspace,
  EmptyWorkspace,
  GroupId,
  type MovePanelCommand,
  type OpenPanelCommand,
  type Panel,
  PanelActivatedEvent,
  PanelClosedEvent,
  PanelId,
  PanelMovedEvent,
  PanelOpenedEvent,
  PopulatedWorkspace,
  type ResizeSplitCommand,
  type RestoreSnapshotRequest,
  SplitId,
  SplitNode,
  SplitResizedEvent,
  TabsNode,
  WorkspaceClearedEvent,
  WorkspaceRestoredEvent,
} from "./Domain.ts";

const isSamePanelId = S.toEquivalence(PanelId);
const isSameGroupId = S.toEquivalence(GroupId);
const isSameSplitId = S.toEquivalence(SplitId);

const acceptedCommandCount = Metric.counter("dockview_poc_commands_accepted_total", {
  description: "Accepted Dockview POC state-machine commands.",
  incremental: true,
});

/** Initial immutable state for a new workspace instance. */
export const emptyDockWorkspace: DockWorkspace = EmptyWorkspace.make({
  kind: "empty",
  revision: NonNegativeInt.make(0),
});

/** Returns a tab zipper in ordinary display order. */
export const panelsInTabs = (tabs: TabsNode): ReadonlyArray<Panel> =>
  pipe(tabs.before, A.append(tabs.active), A.appendAll(tabs.after));

/** Returns every tab leaf in tree order. */
export const tabsInNode = (node: DockNode): ReadonlyArray<TabsNode> =>
  DockNode.match(node, {
    Tabs: (tabs): ReadonlyArray<TabsNode> => A.of(tabs),
    Split: (split): ReadonlyArray<TabsNode> => A.appendAll(tabsInNode(split.start), tabsInNode(split.end)),
  });

/** Returns every split in pre-order. */
export const splitsInNode = (node: DockNode): ReadonlyArray<SplitNode> =>
  DockNode.match(node, {
    Tabs: (): ReadonlyArray<SplitNode> => A.empty(),
    Split: (split): ReadonlyArray<SplitNode> =>
      pipe(A.of(split), A.appendAll(splitsInNode(split.start)), A.appendAll(splitsInNode(split.end))),
  });

/** Returns every panel in tree order. */
export const panelsInNode = (node: DockNode): ReadonlyArray<Panel> => pipe(tabsInNode(node), A.flatMap(panelsInTabs));

/** Returns every panel in a workspace. */
export const panelsInWorkspace = (state: DockWorkspace): ReadonlyArray<Panel> =>
  DockWorkspace.match(state, {
    empty: (): ReadonlyArray<Panel> => A.empty(),
    populated: (workspace): ReadonlyArray<Panel> => panelsInNode(workspace.root),
  });

/** Finds a tab group by identity. */
export const findTabs = (node: DockNode, groupId: GroupId): O.Option<TabsNode> =>
  pipe(
    tabsInNode(node),
    A.findFirst((tabs) => isSameGroupId(tabs.groupId, groupId))
  );

/** Finds a split by identity. */
export const findSplit = (node: DockNode, splitId: SplitId): O.Option<SplitNode> =>
  pipe(
    splitsInNode(node),
    A.findFirst((split) => isSameSplitId(split.splitId, splitId))
  );

/** Finds a panel inside one tab zipper. */
export const findPanelInTabs = (tabs: TabsNode, panelId: PanelId): O.Option<Panel> =>
  pipe(
    panelsInTabs(tabs),
    A.findFirst((panel) => isSamePanelId(panel.id, panelId))
  );

/** Finds the tab group that owns a panel. */
export const findTabsForPanel = (node: DockNode, panelId: PanelId): O.Option<TabsNode> =>
  pipe(
    tabsInNode(node),
    A.findFirst((tabs) => O.isSome(findPanelInTabs(tabs, panelId)))
  );

/** Finds a panel in a workspace. */
export const findPanelInWorkspace = (state: DockWorkspace, panelId: PanelId): O.Option<Panel> =>
  DockWorkspace.match(state, {
    empty: () => O.none<Panel>(),
    populated: (workspace) =>
      pipe(
        panelsInNode(workspace.root),
        A.findFirst((panel) => isSamePanelId(panel.id, panelId))
      ),
  });

/** Finds a tab group in a workspace. */
export const findTabsInWorkspace = (state: DockWorkspace, groupId: GroupId): O.Option<TabsNode> =>
  DockWorkspace.match(state, {
    empty: () => O.none<TabsNode>(),
    populated: (workspace) => findTabs(workspace.root, groupId),
  });

/** Counts the tab groups in a workspace. */
export const groupCount = (state: DockWorkspace): number =>
  DockWorkspace.match(state, {
    empty: () => 0,
    populated: (workspace) => A.length(tabsInNode(workspace.root)),
  });

const nextRevision = (state: DockWorkspace) => NonNegativeInt.make(state.revision + 1);

const singletonTabs = (groupId: GroupId, panel: Panel): TabsNode =>
  TabsNode.make({
    groupId,
    before: A.empty(),
    active: panel,
    after: A.empty(),
  });

const appendPanel = (tabs: TabsNode, panel: Panel): TabsNode =>
  TabsNode.make({
    groupId: tabs.groupId,
    before: panelsInTabs(tabs),
    active: panel,
    after: A.empty(),
  });

const activatePanel = (tabs: TabsNode, panelId: PanelId): O.Option<TabsNode> => {
  const [before, fromMatch] = A.splitWhere(panelsInTabs(tabs), (panel) => isSamePanelId(panel.id, panelId));
  return A.match(fromMatch, {
    onEmpty: O.none,
    onNonEmpty: (activeAndAfter) =>
      O.some(
        TabsNode.make({
          groupId: tabs.groupId,
          before,
          active: A.headNonEmpty(activeAndAfter),
          after: A.tailNonEmpty(activeAndAfter),
        })
      ),
  });
};

const removeActivePanel = (tabs: TabsNode): O.Option<TabsNode> =>
  A.match(tabs.after, {
    onNonEmpty: (after) =>
      O.some(
        TabsNode.make({
          groupId: tabs.groupId,
          before: tabs.before,
          active: A.headNonEmpty(after),
          after: A.tailNonEmpty(after),
        })
      ),
    onEmpty: () =>
      A.match(tabs.before, {
        onEmpty: O.none,
        onNonEmpty: (before) =>
          O.some(
            TabsNode.make({
              groupId: tabs.groupId,
              before: A.dropRight(before, 1),
              active: A.lastNonEmpty(before),
              after: A.empty(),
            })
          ),
      }),
  });

const removePanel = (tabs: TabsNode, panelId: PanelId): O.Option<TabsNode> =>
  Bool.match(isSamePanelId(tabs.active.id, panelId), {
    onTrue: () => removeActivePanel(tabs),
    onFalse: () =>
      O.some(
        TabsNode.make({
          groupId: tabs.groupId,
          before: A.filter(tabs.before, (panel) => Bool.not(isSamePanelId(panel.id, panelId))),
          active: tabs.active,
          after: A.filter(tabs.after, (panel) => Bool.not(isSamePanelId(panel.id, panelId))),
        })
      ),
  });

const replaceNodeAtGroup = (node: DockNode, groupId: GroupId, replacement: DockNode): DockNode =>
  DockNode.match(node, {
    Tabs: (tabs) =>
      Bool.match(isSameGroupId(tabs.groupId, groupId), {
        onTrue: () => replacement,
        onFalse: () => tabs,
      }),
    Split: (split) =>
      SplitNode.make({
        splitId: split.splitId,
        axis: split.axis,
        ratio: split.ratio,
        start: replaceNodeAtGroup(split.start, groupId, replacement),
        end: replaceNodeAtGroup(split.end, groupId, replacement),
      }),
  });

const replaceTabs = (node: DockNode, replacement: TabsNode): DockNode =>
  replaceNodeAtGroup(node, replacement.groupId, replacement);

const replaceSplit = (node: DockNode, replacement: SplitNode): DockNode =>
  DockNode.match(node, {
    Tabs: (tabs) => tabs,
    Split: (split) =>
      Bool.match(isSameSplitId(split.splitId, replacement.splitId), {
        onTrue: () => replacement,
        onFalse: () =>
          SplitNode.make({
            splitId: split.splitId,
            axis: split.axis,
            ratio: split.ratio,
            start: replaceSplit(split.start, replacement),
            end: replaceSplit(split.end, replacement),
          }),
      }),
  });

const removeTabs = (node: DockNode, groupId: GroupId): O.Option<DockNode> =>
  DockNode.match(node, {
    Tabs: (tabs) =>
      Bool.match(isSameGroupId(tabs.groupId, groupId), {
        onTrue: O.none,
        onFalse: () => O.some(tabs),
      }),
    Split: (split) =>
      Bool.match(O.isSome(findTabs(split.start, groupId)), {
        onTrue: () =>
          O.match(removeTabs(split.start, groupId), {
            onNone: () => O.some(split.end),
            onSome: (start) =>
              O.some(
                SplitNode.make({
                  splitId: split.splitId,
                  axis: split.axis,
                  ratio: split.ratio,
                  start,
                  end: split.end,
                })
              ),
          }),
        onFalse: () =>
          O.match(removeTabs(split.end, groupId), {
            onNone: () => O.some(split.start),
            onSome: (end) =>
              O.some(
                SplitNode.make({
                  splitId: split.splitId,
                  axis: split.axis,
                  ratio: split.ratio,
                  start: split.start,
                  end,
                })
              ),
          }),
      }),
  });

const splitTabs = (reference: TabsNode, panel: Panel, placement: Extract<DockPlacement, { kind: "split" }>) => {
  const inserted = singletonTabs(placement.newGroupId, panel);
  return pipe(
    placement.side,
    DockSide.$match({
      left: () =>
        SplitNode.make({
          splitId: placement.splitId,
          axis: "horizontal",
          ratio: placement.ratio,
          start: inserted,
          end: reference,
        }),
      right: () =>
        SplitNode.make({
          splitId: placement.splitId,
          axis: "horizontal",
          ratio: placement.ratio,
          start: reference,
          end: inserted,
        }),
      top: () =>
        SplitNode.make({
          splitId: placement.splitId,
          axis: "vertical",
          ratio: placement.ratio,
          start: inserted,
          end: reference,
        }),
      bottom: () =>
        SplitNode.make({
          splitId: placement.splitId,
          axis: "vertical",
          ratio: placement.ratio,
          start: reference,
          end: inserted,
        }),
    })
  );
};

const reject = (
  envelope: DockCommandEnvelope,
  reason: DockRejectionReason,
  message: string
): Effect.Effect<never, DockCommandRejected> =>
  Effect.fail(
    DockCommandRejected.make({
      commandId: envelope.commandId,
      reason,
      message,
    })
  );

const transition = (
  previous: DockWorkspace,
  envelope: DockCommandEnvelope,
  state: DockWorkspace,
  event: DockEvent
): DockTransition =>
  DockTransition.make({
    commandId: envelope.commandId,
    origin: envelope.origin,
    previousRevision: previous.revision,
    state,
    events: [event],
  });

const ensureUnique = (
  values: ReadonlyArray<string>,
  reason: DockInvariantReason,
  message: string
): Effect.Effect<void, DockInvariantViolation> =>
  Bool.match(Eq.equals(HashSet.size(HashSet.fromIterable(values)), A.length(values)), {
    onTrue: () => Effect.void,
    onFalse: () => Effect.fail(DockInvariantViolation.make({ reason, message })),
  });

/** Validates global tree invariants that local schemas cannot express alone. */
export const validateWorkspace = Effect.fn("DockReducer.validateWorkspace")(function* (state: DockWorkspace) {
  return yield* DockWorkspace.match(state, {
    empty: (workspace): Effect.Effect<DockWorkspace> => Effect.succeed(workspace),
    populated: Effect.fnUntraced(function* (workspace) {
      const tabs = tabsInNode(workspace.root);
      const splits = splitsInNode(workspace.root);
      yield* ensureUnique(
        A.map(panelsInNode(workspace.root), (panel) => panel.id),
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
  yield* Bool.match(O.isSome(findPanelInWorkspace(state, command.panel.id)), {
    onTrue: () => reject(envelope, "panel-already-open", `Panel '${command.panel.id}' is already open.`),
    onFalse: () => Effect.void,
  });

  return yield* DockPlacement.match(command.placement, {
    root: (placement) =>
      DockWorkspace.match(state, {
        populated: () =>
          reject(envelope, "workspace-not-empty", "Root placement is only valid for an empty workspace."),
        empty: (workspace) =>
          Effect.succeed(
            transition(
              workspace,
              envelope,
              PopulatedWorkspace.make({
                kind: "populated",
                revision: nextRevision(workspace),
                root: singletonTabs(placement.groupId, command.panel),
              }),
              PanelOpenedEvent.make({
                kind: "panelOpened",
                panelId: command.panel.id,
                groupId: placement.groupId,
              })
            )
          ),
      }),
    tab: (placement) =>
      DockWorkspace.match(state, {
        empty: () => reject(envelope, "workspace-empty", "Tab placement requires an existing group."),
        populated: (workspace) =>
          O.match(findTabs(workspace.root, placement.groupId), {
            onNone: () => reject(envelope, "group-not-found", `Group '${placement.groupId}' does not exist.`),
            onSome: (tabs) =>
              Effect.succeed(
                transition(
                  workspace,
                  envelope,
                  PopulatedWorkspace.make({
                    kind: "populated",
                    revision: nextRevision(workspace),
                    root: replaceTabs(workspace.root, appendPanel(tabs, command.panel)),
                  }),
                  PanelOpenedEvent.make({
                    kind: "panelOpened",
                    panelId: command.panel.id,
                    groupId: placement.groupId,
                  })
                )
              ),
          }),
      }),
    split: (placement) =>
      DockWorkspace.match(state, {
        empty: () => reject(envelope, "workspace-empty", "Split placement requires an existing group."),
        populated: Effect.fnUntraced(function* (workspace) {
          yield* Bool.match(O.isSome(findTabs(workspace.root, placement.newGroupId)), {
            onTrue: () => reject(envelope, "group-already-exists", `Group '${placement.newGroupId}' already exists.`),
            onFalse: () => Effect.void,
          });
          yield* Bool.match(O.isSome(findSplit(workspace.root, placement.splitId)), {
            onTrue: () => reject(envelope, "split-already-exists", `Split '${placement.splitId}' already exists.`),
            onFalse: () => Effect.void,
          });
          return yield* O.match(findTabs(workspace.root, placement.referenceGroupId), {
            onNone: () =>
              reject(envelope, "group-not-found", `Reference group '${placement.referenceGroupId}' does not exist.`),
            onSome: (reference) => {
              const root = replaceNodeAtGroup(
                workspace.root,
                reference.groupId,
                splitTabs(reference, command.panel, placement)
              );
              return Effect.succeed(
                transition(
                  workspace,
                  envelope,
                  PopulatedWorkspace.make({
                    kind: "populated",
                    revision: nextRevision(workspace),
                    root,
                  }),
                  PanelOpenedEvent.make({
                    kind: "panelOpened",
                    panelId: command.panel.id,
                    groupId: placement.newGroupId,
                  })
                )
              );
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
      const tabs = yield* O.match(findTabsForPanel(workspace.root, command.panelId), {
        onNone: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
        onSome: (value) => Effect.succeed(value),
      });
      const activated = yield* O.match(activatePanel(tabs, command.panelId), {
        onNone: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
        onSome: (value) => Effect.succeed(value),
      });
      return transition(
        workspace,
        envelope,
        PopulatedWorkspace.make({
          kind: "populated",
          revision: nextRevision(workspace),
          root: replaceTabs(workspace.root, activated),
        }),
        PanelActivatedEvent.make({
          kind: "panelActivated",
          panelId: command.panelId,
          groupId: tabs.groupId,
        })
      );
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
      const source = yield* O.match(findTabsForPanel(workspace.root, command.panelId), {
        onNone: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
        onSome: (value) => Effect.succeed(value),
      });
      const target = yield* O.match(findTabs(workspace.root, command.targetGroupId), {
        onNone: () => reject(envelope, "group-not-found", `Group '${command.targetGroupId}' does not exist.`),
        onSome: (value) => Effect.succeed(value),
      });
      yield* Bool.match(isSameGroupId(source.groupId, target.groupId), {
        onTrue: () => reject(envelope, "same-group-move", "Move destination must be a different group."),
        onFalse: () => Effect.void,
      });
      const panel = yield* O.match(findPanelInTabs(source, command.panelId), {
        onNone: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
        onSome: (value) => Effect.succeed(value),
      });
      const rootWithoutSource = yield* O.match(removePanel(source, command.panelId), {
        onSome: (remaining) => Effect.succeed(replaceTabs(workspace.root, remaining)),
        onNone: () =>
          O.match(removeTabs(workspace.root, source.groupId), {
            onSome: (value) => Effect.succeed(value),
            onNone: () =>
              Effect.fail(
                DockInvariantViolation.make({
                  reason: "duplicate-group-id",
                  message: "Moving between two groups cannot remove the destination group.",
                })
              ),
          }),
      });
      const currentTarget = yield* O.match(findTabs(rootWithoutSource, target.groupId), {
        onSome: (value) => Effect.succeed(value),
        onNone: () =>
          Effect.fail(
            DockInvariantViolation.make({
              reason: "duplicate-group-id",
              message: "Move destination disappeared while collapsing the source group.",
            })
          ),
      });
      return transition(
        workspace,
        envelope,
        PopulatedWorkspace.make({
          kind: "populated",
          revision: nextRevision(workspace),
          root: replaceTabs(rootWithoutSource, appendPanel(currentTarget, panel)),
        }),
        PanelMovedEvent.make({
          kind: "panelMoved",
          panelId: command.panelId,
          fromGroupId: source.groupId,
          toGroupId: target.groupId,
        })
      );
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
      const tabs = yield* O.match(findTabsForPanel(workspace.root, command.panelId), {
        onNone: () => reject(envelope, "panel-not-found", `Panel '${command.panelId}' does not exist.`),
        onSome: (value) => Effect.succeed(value),
      });
      const root = O.match(removePanel(tabs, command.panelId), {
        onSome: (remaining) => O.some(replaceTabs(workspace.root, remaining)),
        onNone: () => removeTabs(workspace.root, tabs.groupId),
      });
      const nextState = O.match(root, {
        onNone: () =>
          EmptyWorkspace.make({
            kind: "empty",
            revision: nextRevision(workspace),
          }),
        onSome: (nextRoot) =>
          PopulatedWorkspace.make({
            kind: "populated",
            revision: nextRevision(workspace),
            root: nextRoot,
          }),
      });
      return transition(
        workspace,
        envelope,
        nextState,
        PanelClosedEvent.make({
          kind: "panelClosed",
          panelId: command.panelId,
          groupId: tabs.groupId,
        })
      );
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
      const split = yield* O.match(findSplit(workspace.root, command.splitId), {
        onNone: () => reject(envelope, "split-not-found", `Split '${command.splitId}' does not exist.`),
        onSome: (value) => Effect.succeed(value),
      });
      const resized = SplitNode.make({
        splitId: split.splitId,
        axis: split.axis,
        ratio: command.ratio,
        start: split.start,
        end: split.end,
      });
      return transition(
        workspace,
        envelope,
        PopulatedWorkspace.make({
          kind: "populated",
          revision: nextRevision(workspace),
          root: replaceSplit(workspace.root, resized),
        }),
        SplitResizedEvent.make({
          kind: "splitResized",
          splitId: command.splitId,
          ratio: command.ratio,
        })
      );
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
      Effect.succeed(
        transition(
          workspace,
          envelope,
          EmptyWorkspace.make({
            kind: "empty",
            revision: nextRevision(workspace),
          }),
          WorkspaceClearedEvent.make({ kind: "workspaceCleared" })
        )
      ),
  });
});

/** Applies one command and validates its complete next tree before publication. */
export const reduceDockCommand = Effect.fn("DockReducer.reduceDockCommand")(function* (
  state: DockWorkspace,
  envelope: DockCommandEnvelope
): Effect.fn.Return<DockTransition, DockTransitionError> {
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
  yield* validateWorkspace(result.state);
  yield* Effect.logDebug("dock command accepted").pipe(
    Effect.annotateLogs({
      commandId: envelope.commandId,
      commandKind: envelope.command.kind,
      revision: result.state.revision,
    })
  );
  yield* Metric.update(acceptedCommandCount, 1);
  return result;
});

/** Builds a restore transition after the snapshot has decoded successfully. */
export const restoreDockWorkspace = Effect.fn("DockReducer.restoreDockWorkspace")(function* (
  current: DockWorkspace,
  restored: DockWorkspace,
  request: RestoreSnapshotRequest
) {
  yield* validateWorkspace(restored);
  return DockTransition.make({
    commandId: request.commandId,
    origin: request.origin,
    previousRevision: current.revision,
    state: restored,
    events: [
      WorkspaceRestoredEvent.make({
        kind: "workspaceRestored",
        revision: restored.revision,
      }),
    ],
  });
});

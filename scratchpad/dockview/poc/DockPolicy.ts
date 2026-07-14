/**
 * Replaceable command-policy layers for the Dockview POC transition kernel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { thunkEffectVoid } from "@beep/utils";
import { Effect, Layer, pipe } from "effect";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import { DockEngine, DockEngineLive } from "./DockEngine.ts";
import {
  DockCommand,
  type DockCommandEnvelope,
  DockCommandRejected,
  DockGroupMoveTarget,
  DockMoveTarget,
  DockPlacement,
  DockWorkspace,
  type DockWorkspace as DockWorkspaceType,
  GroupId,
  type GroupId as GroupIdType,
} from "./Domain.ts";

/** Pure command-interception contract; success allows delegation and failure vetoes it. */
export type DockCommandPolicy = (
  state: DockWorkspaceType,
  envelope: DockCommandEnvelope
) => Effect.Effect<void, DockCommandRejected>;

const rejectLocked = (envelope: DockCommandEnvelope): Effect.Effect<never, DockCommandRejected> =>
  Effect.fail(
    DockCommandRejected.make({
      commandId: envelope.commandId,
      reason: "group-locked",
      message: "The destination group does not accept this dock operation.",
    })
  );

const destinationLock = (state: DockWorkspaceType, groupId: GroupIdType) =>
  pipe(
    DockWorkspace.findTabs(state, groupId),
    O.map((tabs) => tabs.metadata.locked)
  );

const rejectLockedDestination = (
  state: DockWorkspaceType,
  envelope: DockCommandEnvelope,
  groupId: GroupIdType
): Effect.Effect<void, DockCommandRejected> =>
  Bool.match(
    O.exists(destinationLock(state, groupId), (locked) => Bool.not(Eq.equals(locked, "unlocked"))),
    {
      onFalse: thunkEffectVoid,
      onTrue: () => rejectLocked(envelope),
    }
  );

const rejectNoDropReference = (
  state: DockWorkspaceType,
  envelope: DockCommandEnvelope,
  groupId: GroupIdType
): Effect.Effect<void, DockCommandRejected> =>
  Bool.match(O.exists(destinationLock(state, groupId), Eq.equals("no-drop-target")), {
    onFalse: thunkEffectVoid,
    onTrue: () => rejectLocked(envelope),
  });

/**
 * Treats group locking as destination policy while preserving reorder and
 * outbound-move behavior.
 */
export const lockedGroupsPolicy: DockCommandPolicy = Effect.fn("DockPolicy.lockedGroups")(function* (state, envelope) {
  return yield* DockCommand.match(envelope.command, {
    openPanel: ({ placement }) =>
      DockPlacement.match(placement, {
        root: thunkEffectVoid,
        rootSplit: thunkEffectVoid,
        tab: ({ groupId }) => rejectLockedDestination(state, envelope, groupId),
        split: ({ referenceGroupId }) => rejectNoDropReference(state, envelope, referenceGroupId),
      }),
    movePanel: ({ panelId, target }) =>
      DockMoveTarget.match(target, {
        tab: ({ groupId }) =>
          Bool.match(
            O.exists(DockWorkspace.findTabsForPanel(state, panelId), (source) =>
              GroupId.equals(source.groupId, groupId)
            ),
            {
              onTrue: thunkEffectVoid,
              onFalse: () => rejectLockedDestination(state, envelope, groupId),
            }
          ),
        split: ({ referenceGroupId }) => rejectNoDropReference(state, envelope, referenceGroupId),
        rootSplit: thunkEffectVoid,
      }),
    moveGroup: ({ target }) =>
      DockGroupMoveTarget.match(target, {
        tab: ({ groupId }) => rejectLockedDestination(state, envelope, groupId),
        groupSplit: ({ referenceGroupId }) => rejectNoDropReference(state, envelope, referenceGroupId),
        groupRootSplit: thunkEffectVoid,
      }),
    activatePanel: thunkEffectVoid,
    updatePanel: thunkEffectVoid,
    updateGroup: thunkEffectVoid,
    closePanel: thunkEffectVoid,
    resizeSplit: thunkEffectVoid,
    clearWorkspace: thunkEffectVoid,
    maximizeGroup: thunkEffectVoid,
    restoreMaximized: thunkEffectVoid,
    floatGroup: thunkEffectVoid,
    dockFloatingGroup: ({ target }) =>
      DockGroupMoveTarget.match(target, {
        tab: ({ groupId }) => rejectLockedDestination(state, envelope, groupId),
        groupSplit: ({ referenceGroupId }) => rejectNoDropReference(state, envelope, referenceGroupId),
        groupRootSplit: thunkEffectVoid,
      }),
    moveFloatingGroup: thunkEffectVoid,
  });
});

/** Wraps the live engine with a command policy while retaining every other live capability. */
export const makePolicyDockEngineLayer = (policy: DockCommandPolicy): Layer.Layer<DockEngine> =>
  Layer.effect(
    DockEngine,
    Effect.gen(function* () {
      const live = yield* DockEngine;
      return DockEngine.of({
        ...live,
        transition: Effect.fn("DockPolicy.transition")(function* (state, envelope) {
          yield* policy(state, envelope);
          return yield* live.transition(state, envelope);
        }),
      });
    })
  ).pipe(Layer.provide(DockEngineLive));

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
import { DockCommand } from "./Dock.commands.ts";
import { DockCommandRejected } from "./Dock.errors.ts";
import { GroupId } from "./Dock.ids.ts";
import { DockGroupMoveTarget, DockMoveTarget, DockPlacement } from "./Dock.placement.ts";
import { DockWorkspace } from "./Dock.tree.ts";
import { DockEngine, DockEngineLive } from "./DockEngine.service.ts";
import type { DockCommandEnvelope } from "./Dock.commands.ts";
import type { GroupId as GroupIdType } from "./Dock.ids.ts";
import type { DockWorkspace as DockWorkspaceType } from "./Dock.tree.ts";

/**
 * Policy contract that can veto a command before transition.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, ClearWorkspaceCommand, CommandId, DockCommandEnvelope, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView } from "@beep/dock"
 * import type { DockCommandPolicy } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const allow: DockCommandPolicy = () => Effect.void
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const envelope = DockCommandEnvelope.make({ commandId: CommandId.make("command-clear"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), command: ClearWorkspaceCommand.make() })
 * const decision = Effect.runSync(Effect.as(allow(workspace, envelope), "allowed"))
 * console.log(decision)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
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
 * Destination policy enforcing persisted group locking metadata.
 *
 * @remarks Locking applies to destinations while preserving reorder and
 * outbound-move behavior.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, DockCommandEnvelope, GroupId, GroupMetadata, OpenPanelCommand, Panel, PanelId, PopulatedWorkspace, TabPlacement, TabsNode, TextPanelView, lockedGroupsPolicy } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const groupId = GroupId.make("group-one")
 * const openPanel = (id: string) => Panel.make({ id: PanelId.make(id), title: id, view: TextPanelView.make({ text: id }) })
 * const workspace = PopulatedWorkspace.make({
 *   root: TabsNode.make({ groupId, active: openPanel("panel-one"), metadata: GroupMetadata.make({ locked: "locked" }) })
 * })
 * const envelope = DockCommandEnvelope.make({
 *   commandId: CommandId.make("command-open-two"),
 *   origin: ApiCommandOrigin.make({ requestId: "request-one" }),
 *   command: OpenPanelCommand.make({ panel: openPanel("panel-two"), placement: TabPlacement.make({ groupId }) })
 * })
 * const rejection = Effect.runSync(Effect.flip(lockedGroupsPolicy(workspace, envelope)))
 * console.log(rejection.reason)
 * ```
 *
 * @category policies
 * @since 0.0.0
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

/**
 * Wraps the live engine with a command policy.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, DockCommandEnvelope, DockEngine, GroupId, GroupMetadata, OpenPanelCommand, Panel, PanelId, PopulatedWorkspace, TabPlacement, TabsNode, TextPanelView, lockedGroupsPolicy, makePolicyDockEngineLayer } from "@beep/dock"
 * import { Effect } from "effect"
 *
 * const groupId = GroupId.make("group-one")
 * const openPanel = (id: string) => Panel.make({ id: PanelId.make(id), title: id, view: TextPanelView.make({ text: id }) })
 * const workspace = PopulatedWorkspace.make({
 *   root: TabsNode.make({ groupId, active: openPanel("panel-one"), metadata: GroupMetadata.make({ locked: "locked" }) })
 * })
 * const envelope = DockCommandEnvelope.make({
 *   commandId: CommandId.make("command-open-two"),
 *   origin: ApiCommandOrigin.make({ requestId: "request-one" }),
 *   command: OpenPanelCommand.make({ panel: openPanel("panel-two"), placement: TabPlacement.make({ groupId }) })
 * })
 * const rejection = Effect.runSync(Effect.gen(function* () {
 *   const engine = yield* DockEngine
 *   return yield* Effect.flip(engine.transition(workspace, envelope))
 * }).pipe(Effect.provide(makePolicyDockEngineLayer(lockedGroupsPolicy))))
 * console.log(rejection.reason)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
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

/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { AnchoredBox } from "./AnchoredBox.ts";
import { CommandId, GroupId, PanelId, SplitId, SplitRatio } from "./Dock.ids.ts";
import { GroupPatch, Panel, PanelPatch } from "./Dock.models.ts";
import { DockGroupMoveTarget, DockMoveTarget, DockPlacement } from "./Dock.placement.ts";

const $I = $DockId.create("Dock.commands");

/**
 * User gesture origin carried by a top-level command.
 *
 * @example
 * ```ts
 * import { UserCommandOrigin } from "@beep/dock"
 *
 * const command = UserCommandOrigin.make({ interactionId: "drag-one" })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class UserCommandOrigin extends S.Class<UserCommandOrigin>($I`UserCommandOrigin`)(
  {
    kind: S.tag("user"),
    interactionId: S.NonEmptyString,
  },
  $I.annote("UserCommandOrigin", {
    description: "Origin metadata for a user gesture compiled into a command.",
  })
) {}

/**
 * Programmatic API origin carried by a top-level command.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin } from "@beep/dock"
 *
 * const command = ApiCommandOrigin.make({ requestId: "request-one" })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ApiCommandOrigin extends S.Class<ApiCommandOrigin>($I`ApiCommandOrigin`)(
  {
    kind: S.tag("api"),
    requestId: S.NonEmptyString,
  },
  $I.annote("ApiCommandOrigin", {
    description: "Origin metadata for a programmatic dock command.",
  })
) {}

const CommandOriginKind = LiteralKit(["user", "api"]);

/**
 * Tagged codec for explicit command origins.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandOrigin } from "@beep/dock"
 *
 * const command = ApiCommandOrigin.make({ requestId: "request-one" })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const CommandOrigin = CommandOriginKind.mapMembers(
  Tuple.evolve([() => UserCommandOrigin, () => ApiCommandOrigin])
)
  .annotate(
    $I.annote("CommandOrigin", {
      description: "Causal origin carried with every top-level dock command.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
/**
 * Decoded tagged codec for explicit command origins.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandOrigin } from "@beep/dock"
 *
 * const command: CommandOrigin = ApiCommandOrigin.make({ requestId: "request-one" })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export type CommandOrigin = typeof CommandOrigin.Type;

/**
 * Command that opens a panel at a semantic placement.
 *
 * @example
 * ```ts
 * import { GroupId, OpenPanelCommand, Panel, PanelId, RootPlacement, TextPanelView } from "@beep/dock"
 *
 * const command = OpenPanelCommand.make({ panel: Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) }), placement: RootPlacement.make({ groupId: GroupId.make("group-one") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class OpenPanelCommand extends S.Class<OpenPanelCommand>($I`OpenPanelCommand`)(
  {
    kind: S.tag("openPanel"),
    panel: Panel,
    placement: DockPlacement,
  },
  $I.annote("OpenPanelCommand", {
    description: "Opens one unique panel at a semantic destination.",
  })
) {}

/**
 * Command that activates a panel in its tab group.
 *
 * @example
 * ```ts
 * import { ActivatePanelCommand, PanelId } from "@beep/dock"
 *
 * const command = ActivatePanelCommand.make({ panelId: PanelId.make("panel-one") })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ActivatePanelCommand extends S.Class<ActivatePanelCommand>($I`ActivatePanelCommand`)(
  {
    kind: S.tag("activatePanel"),
    panelId: PanelId,
  },
  $I.annote("ActivatePanelCommand", {
    description: "Makes an existing panel active within its tab group.",
  })
) {}

/**
 * Command that replaces selected panel facets.
 *
 * @example
 * ```ts
 * import { PanelId, PanelPatch, UpdatePanelCommand } from "@beep/dock"
 * import * as O from "effect/Option"
 *
 * const command = UpdatePanelCommand.make({ panelId: PanelId.make("panel-one"), patch: PanelPatch.make({ title: O.some("Renamed") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class UpdatePanelCommand extends S.Class<UpdatePanelCommand>($I`UpdatePanelCommand`)(
  { kind: S.tag("updatePanel"), panelId: PanelId, patch: PanelPatch },
  $I.annote("UpdatePanelCommand", { description: "Applies whole-value replacements to an existing panel." })
) {}

/**
 * Command that moves a panel to a semantic destination.
 *
 * @example
 * ```ts
 * import { GroupId, MovePanelCommand, PanelId, TabPlacement } from "@beep/dock"
 *
 * const command = MovePanelCommand.make({ panelId: PanelId.make("panel-one"), target: TabPlacement.make({ groupId: GroupId.make("group-two") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MovePanelCommand extends S.Class<MovePanelCommand>($I`MovePanelCommand`)(
  {
    kind: S.tag("movePanel"),
    panelId: PanelId,
    target: DockMoveTarget,
  },
  $I.annote("MovePanelCommand", {
    description: "Moves a panel to a semantic destination as one atomic tree transition.",
  })
) {}

/**
 * Command that merges or relocates a complete tab group.
 *
 * @example
 * ```ts
 * import { GroupId, MoveGroupCommand, TabPlacement } from "@beep/dock"
 *
 * const command = MoveGroupCommand.make({ groupId: GroupId.make("group-one"), target: TabPlacement.make({ groupId: GroupId.make("group-two") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MoveGroupCommand extends S.Class<MoveGroupCommand>($I`MoveGroupCommand`)(
  { kind: S.tag("moveGroup"), groupId: GroupId, target: DockGroupMoveTarget },
  $I.annote("MoveGroupCommand", { description: "Merges or relocates an entire tab group as one atomic transition." })
) {}

/**
 * Command that replaces selected group metadata.
 *
 * @example
 * ```ts
 * import { GroupId, GroupPatch, UpdateGroupCommand } from "@beep/dock"
 * import * as O from "effect/Option"
 *
 * const command = UpdateGroupCommand.make({ groupId: GroupId.make("group-one"), patch: GroupPatch.make({ visible: O.some(false) }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class UpdateGroupCommand extends S.Class<UpdateGroupCommand>($I`UpdateGroupCommand`)(
  { kind: S.tag("updateGroup"), groupId: GroupId, patch: GroupPatch },
  $I.annote("UpdateGroupCommand", { description: "Applies whole-value replacements to existing group metadata." })
) {}

/**
 * Command that closes one panel and collapses empty topology.
 *
 * @example
 * ```ts
 * import { ClosePanelCommand, PanelId } from "@beep/dock"
 *
 * const command = ClosePanelCommand.make({ panelId: PanelId.make("panel-one") })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ClosePanelCommand extends S.Class<ClosePanelCommand>($I`ClosePanelCommand`)(
  {
    kind: S.tag("closePanel"),
    panelId: PanelId,
  },
  $I.annote("ClosePanelCommand", {
    description: "Closes one panel and canonically collapses empty topology.",
  })
) {}

/**
 * Command that changes a bounded split ratio.
 *
 * @example
 * ```ts
 * import { ResizeSplitCommand, SplitId, SplitRatio } from "@beep/dock"
 *
 * const command = ResizeSplitCommand.make({ splitId: SplitId.make("split-one"), ratio: SplitRatio.make(6_000) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ResizeSplitCommand extends S.Class<ResizeSplitCommand>($I`ResizeSplitCommand`)(
  {
    kind: S.tag("resizeSplit"),
    splitId: SplitId,
    ratio: SplitRatio,
  },
  $I.annote("ResizeSplitCommand", {
    description: "Changes one bounded binary split ratio.",
  })
) {}

/**
 * Command that clears the complete workspace.
 *
 * @example
 * ```ts
 * import { ClearWorkspaceCommand } from "@beep/dock"
 *
 * const command = ClearWorkspaceCommand.make()
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ClearWorkspaceCommand extends S.Class<ClearWorkspaceCommand>($I`ClearWorkspaceCommand`)(
  {
    kind: S.tag("clearWorkspace"),
  },
  $I.annote("ClearWorkspaceCommand", {
    description: "Clears every panel and layout node atomically.",
  })
) {}

/**
 * Command that reveals and maximizes one group.
 *
 * @example
 * ```ts
 * import { GroupId, MaximizeGroupCommand } from "@beep/dock"
 *
 * const command = MaximizeGroupCommand.make({ groupId: GroupId.make("group-one") })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MaximizeGroupCommand extends S.Class<MaximizeGroupCommand>($I`MaximizeGroupCommand`)(
  { kind: S.tag("maximizeGroup"), groupId: GroupId },
  $I.annote("MaximizeGroupCommand", { description: "Reveals and maximizes one existing tab group." })
) {}

/**
 * Command that leaves maximized mode.
 *
 * @example
 * ```ts
 * import { RestoreMaximizedCommand } from "@beep/dock"
 *
 * const command = RestoreMaximizedCommand.make()
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class RestoreMaximizedCommand extends S.Class<RestoreMaximizedCommand>($I`RestoreMaximizedCommand`)(
  { kind: S.tag("restoreMaximized") },
  $I.annote("RestoreMaximizedCommand", { description: "Clears the currently maximized group." })
) {}

/**
 * Command that moves a docked group into a floating member.
 *
 * @example
 * ```ts
 * import { FloatGroupCommand, GroupId, TopLeftAnchoredBox } from "@beep/dock"
 *
 * const command = FloatGroupCommand.make({ groupId: GroupId.make("group-one"), anchoredBox: TopLeftAnchoredBox.make({ left: 20, top: 12, width: 640, height: 480 }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class FloatGroupCommand extends S.Class<FloatGroupCommand>($I`FloatGroupCommand`)(
  { kind: S.tag("floatGroup"), groupId: GroupId, anchoredBox: AnchoredBox },
  $I.annote("FloatGroupCommand", { description: "Moves one docked group into a new topmost floating member." })
) {}
/**
 * Command that docks a floating group into the tree.
 *
 * @example
 * ```ts
 * import { DockFloatingGroupCommand, GroupId, TabPlacement } from "@beep/dock"
 *
 * const command = DockFloatingGroupCommand.make({ groupId: GroupId.make("group-one"), target: TabPlacement.make({ groupId: GroupId.make("group-two") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class DockFloatingGroupCommand extends S.Class<DockFloatingGroupCommand>($I`DockFloatingGroupCommand`)(
  { kind: S.tag("dockFloatingGroup"), groupId: GroupId, target: DockGroupMoveTarget },
  $I.annote("DockFloatingGroupCommand", { description: "Moves a floating group back into the docked tree." })
) {}
/**
 * Command that repositions a floating group and raises its z-order.
 *
 * @example
 * ```ts
 * import { GroupId, MoveFloatingGroupCommand, TopLeftAnchoredBox } from "@beep/dock"
 *
 * const command = MoveFloatingGroupCommand.make({ groupId: GroupId.make("group-one"), anchoredBox: TopLeftAnchoredBox.make({ left: 30, top: 24, width: 640, height: 480 }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MoveFloatingGroupCommand extends S.Class<MoveFloatingGroupCommand>($I`MoveFloatingGroupCommand`)(
  { kind: S.tag("moveFloatingGroup"), groupId: GroupId, anchoredBox: AnchoredBox },
  $I.annote("MoveFloatingGroupCommand", { description: "Updates a floating member box and brings it to front." })
) {}

const DockCommandKind = LiteralKit([
  "openPanel",
  "activatePanel",
  "updatePanel",
  "movePanel",
  "moveGroup",
  "updateGroup",
  "closePanel",
  "resizeSplit",
  "clearWorkspace",
  "maximizeGroup",
  "restoreMaximized",
  "floatGroup",
  "dockFloatingGroup",
  "moveFloatingGroup",
]);

/**
 * Tagged codec for every dock mutation command.
 *
 * @example
 * ```ts
 * import { ClearWorkspaceCommand, DockCommand } from "@beep/dock"
 *
 * const command = ClearWorkspaceCommand.make()
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const DockCommand = DockCommandKind.mapMembers(
  Tuple.evolve([
    () => OpenPanelCommand,
    () => ActivatePanelCommand,
    () => UpdatePanelCommand,
    () => MovePanelCommand,
    () => MoveGroupCommand,
    () => UpdateGroupCommand,
    () => ClosePanelCommand,
    () => ResizeSplitCommand,
    () => ClearWorkspaceCommand,
    () => MaximizeGroupCommand,
    () => RestoreMaximizedCommand,
    () => FloatGroupCommand,
    () => DockFloatingGroupCommand,
    () => MoveFloatingGroupCommand,
  ])
)
  .annotate(
    $I.annote("DockCommand", {
      description: "Exhaustive command algebra for the POC layout kernel.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
/**
 * Decoded tagged codec for every dock mutation command.
 *
 * @example
 * ```ts
 * import { ClearWorkspaceCommand, DockCommand } from "@beep/dock"
 *
 * const command: DockCommand = ClearWorkspaceCommand.make()
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export type DockCommand = typeof DockCommand.Type;

/**
 * Causal envelope around one top-level dock command.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, ClearWorkspaceCommand, CommandId, DockCommandEnvelope } from "@beep/dock"
 *
 * const command = DockCommandEnvelope.make({ commandId: CommandId.make("command-clear"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), command: ClearWorkspaceCommand.make() })
 * console.log(command.commandId)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class DockCommandEnvelope extends S.Class<DockCommandEnvelope>($I`DockCommandEnvelope`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
    command: DockCommand,
  },
  $I.annote("DockCommandEnvelope", {
    description: "Top-level dock command with explicit causal origin.",
  })
) {}

/**
 * Causal metadata for a validated snapshot installation.
 *
 * @example
 * ```ts
 * import { ApiCommandOrigin, CommandId, RestoreSnapshotRequest } from "@beep/dock"
 *
 * const command = RestoreSnapshotRequest.make({ commandId: CommandId.make("command-restore"), origin: ApiCommandOrigin.make({ requestId: "request-one" }) })
 * console.log(command.commandId)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class RestoreSnapshotRequest extends S.Class<RestoreSnapshotRequest>($I`RestoreSnapshotRequest`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
  },
  $I.annote("RestoreSnapshotRequest", {
    description: "Causal metadata attached to a validated snapshot installation.",
  })
) {}

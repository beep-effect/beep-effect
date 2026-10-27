/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { AnchoredBox } from "./AnchoredBox.ts";
import { CommandId, GroupId, PanelId, RendererKey, SplitId, SplitRatio } from "./Dock.ids.ts";
import { GroupPatch, Panel, PanelPatch } from "./Dock.models.ts";
import { DockGroupMoveTarget, DockMoveTarget, DockPlacement } from "./Dock.placement.ts";

const $I = $DockId.create("Dock.commands");

/**
 * User gesture origin carried by a top-level command.
 *
 * **Example** (Make user gesture origin)
 *
 * ```ts
 * import { UserCommandOrigin } from "@beep/dock/Dock.commands"
 *
 * const command = UserCommandOrigin.make({ interactionId: "drag-one" })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class UserCommandOrigin extends S.Opaque<UserCommandOrigin, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("user"),
    interactionId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("UserCommandOrigin", {
      description: "Origin metadata for a user gesture compiled into a command.",
    })
  )
) {}

/**
 * Programmatic API origin carried by a top-level command.
 *
 * **Example** (Make API command origin)
 *
 * ```ts
 * import { ApiCommandOrigin } from "@beep/dock/Dock.commands"
 *
 * const command = ApiCommandOrigin.make({ requestId: "request-one" })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ApiCommandOrigin extends S.Opaque<ApiCommandOrigin, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("api"),
    requestId: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ApiCommandOrigin", {
      description: "Origin metadata for a programmatic dock command.",
    })
  )
) {}

const CommandOriginKind = LiteralKit(["user", "api"]);

/**
 * Tagged codec for explicit command origins.
 *
 * **Example** (Build tagged command origin)
 *
 * ```ts
 * import { ApiCommandOrigin, CommandOrigin } from "@beep/dock/Dock.commands"
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
).pipe(
  $I.annoteSchema("CommandOrigin", {
    description: "Causal origin carried with every top-level dock command.",
  }),
  S.toTaggedUnion("kind")
);
/**
 * Decoded tagged codec for explicit command origins.
 *
 * **Example** (Type decoded command origin)
 *
 * ```ts
 * import { ApiCommandOrigin, CommandOrigin } from "@beep/dock/Dock.commands"
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
 * **Example** (Open panel at placement)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { OpenPanelCommand } from "@beep/dock/Dock.commands"
 * import { Panel, TextPanelView } from "@beep/dock/Dock.models"
 * import { RootPlacement } from "@beep/dock/Dock.placement"
 *
 * const command = OpenPanelCommand.make({ panel: Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) }), placement: RootPlacement.make({ groupId: GroupId.make("group-one") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class OpenPanelCommand extends S.Opaque<OpenPanelCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("openPanel"),
    panel: Panel,
    placement: DockPlacement,
  }).pipe(
    $I.annoteSchema("OpenPanelCommand", {
      description: "Opens one unique panel at a semantic destination.",
    })
  )
) {}

/**
 * Command that activates a panel in its tab group.
 *
 * **Example** (Activate panel by id)
 *
 * ```ts
 * import { ActivatePanelCommand } from "@beep/dock/Dock.commands"
 * import { PanelId } from "@beep/dock/Dock.ids"
 *
 * const command = ActivatePanelCommand.make({ panelId: PanelId.make("panel-one") })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ActivatePanelCommand extends S.Opaque<ActivatePanelCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("activatePanel"),
    panelId: PanelId,
  }).pipe(
    $I.annoteSchema("ActivatePanelCommand", {
      description: "Makes an existing panel active within its tab group.",
    })
  )
) {}

/**
 * Command that replaces selected panel facets.
 *
 * **Example** (Patch panel title facet)
 *
 * ```ts
 * import { PanelId } from "@beep/dock/Dock.ids"
 * import { PanelPatch } from "@beep/dock/Dock.models"
 * import { UpdatePanelCommand } from "@beep/dock/Dock.commands"
 * import * as O from "effect/Option"
 *
 * const command = UpdatePanelCommand.make({ panelId: PanelId.make("panel-one"), patch: PanelPatch.make({ title: O.some("Renamed") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class UpdatePanelCommand extends S.Opaque<UpdatePanelCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("updatePanel"), panelId: PanelId, patch: PanelPatch }).pipe(
    $I.annoteSchema("UpdatePanelCommand", { description: "Applies whole-value replacements to an existing panel." })
  )
) {}

/**
 * Command that moves a panel to a semantic destination.
 *
 * **Example** (Move panel to tab)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { MovePanelCommand } from "@beep/dock/Dock.commands"
 * import { TabPlacement } from "@beep/dock/Dock.placement"
 *
 * const command = MovePanelCommand.make({ panelId: PanelId.make("panel-one"), target: TabPlacement.make({ groupId: GroupId.make("group-two") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MovePanelCommand extends S.Opaque<MovePanelCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("movePanel"),
    panelId: PanelId,
    target: DockMoveTarget,
  }).pipe(
    $I.annoteSchema("MovePanelCommand", {
      description: "Moves a panel to a semantic destination as one atomic tree transition.",
    })
  )
) {}

/**
 * Command that merges or relocates a complete tab group.
 *
 * **Example** (Relocate complete tab group)
 *
 * ```ts
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { MoveGroupCommand } from "@beep/dock/Dock.commands"
 * import { TabPlacement } from "@beep/dock/Dock.placement"
 *
 * const command = MoveGroupCommand.make({ groupId: GroupId.make("group-one"), target: TabPlacement.make({ groupId: GroupId.make("group-two") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MoveGroupCommand extends S.Opaque<MoveGroupCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("moveGroup"), groupId: GroupId, target: DockGroupMoveTarget }).pipe(
    $I.annoteSchema("MoveGroupCommand", {
      description: "Merges or relocates an entire tab group as one atomic transition.",
    })
  )
) {}

/**
 * Command that replaces selected group metadata.
 *
 * **Example** (Patch group visibility)
 *
 * ```ts
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { GroupPatch } from "@beep/dock/Dock.models"
 * import { UpdateGroupCommand } from "@beep/dock/Dock.commands"
 * import * as O from "effect/Option"
 *
 * const command = UpdateGroupCommand.make({ groupId: GroupId.make("group-one"), patch: GroupPatch.make({ visible: O.some(false) }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class UpdateGroupCommand extends S.Opaque<UpdateGroupCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("updateGroup"), groupId: GroupId, patch: GroupPatch }).pipe(
    $I.annoteSchema("UpdateGroupCommand", {
      description: "Applies whole-value replacements to existing group metadata.",
    })
  )
) {}

/**
 * Command that closes one panel and collapses empty topology.
 *
 * **Example** (Close panel by id)
 *
 * ```ts
 * import { ClosePanelCommand } from "@beep/dock/Dock.commands"
 * import { PanelId } from "@beep/dock/Dock.ids"
 *
 * const command = ClosePanelCommand.make({ panelId: PanelId.make("panel-one") })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ClosePanelCommand extends S.Opaque<ClosePanelCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("closePanel"),
    panelId: PanelId,
  }).pipe(
    $I.annoteSchema("ClosePanelCommand", {
      description: "Closes one panel and canonically collapses empty topology.",
    })
  )
) {}

/**
 * Command that changes a bounded split ratio.
 *
 * **Example** (Change bounded split ratio)
 *
 * ```ts
 * import { ResizeSplitCommand } from "@beep/dock/Dock.commands"
 * import { SplitId, SplitRatio } from "@beep/dock/Dock.ids"
 *
 * const command = ResizeSplitCommand.make({ splitId: SplitId.make("split-one"), ratio: SplitRatio.make(6_000) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ResizeSplitCommand extends S.Opaque<ResizeSplitCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("resizeSplit"),
    splitId: SplitId,
    ratio: SplitRatio,
  }).pipe(
    $I.annoteSchema("ResizeSplitCommand", {
      description: "Changes one bounded binary split ratio.",
    })
  )
) {}

/**
 * Command that clears the docked tree and all floating members.
 *
 * **Example** (Clear entire workspace)
 *
 * ```ts
 * import { ClearWorkspaceCommand } from "@beep/dock/Dock.commands"
 *
 * const command = ClearWorkspaceCommand.make({})
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ClearWorkspaceCommand extends S.Opaque<ClearWorkspaceCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("clearWorkspace"),
  }).pipe(
    $I.annoteSchema("ClearWorkspaceCommand", {
      description: "Clears the docked tree and all floating members atomically.",
    })
  )
) {}

/**
 * Command that reveals and maximizes one group.
 *
 * **Example** (Maximize group by id)
 *
 * ```ts
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { MaximizeGroupCommand } from "@beep/dock/Dock.commands"
 *
 * const command = MaximizeGroupCommand.make({ groupId: GroupId.make("group-one") })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MaximizeGroupCommand extends S.Opaque<MaximizeGroupCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("maximizeGroup"), groupId: GroupId }).pipe(
    $I.annoteSchema("MaximizeGroupCommand", { description: "Reveals and maximizes one existing tab group." })
  )
) {}

/**
 * Command that leaves maximized mode.
 *
 * **Example** (Leave maximized mode)
 *
 * ```ts
 * import { RestoreMaximizedCommand } from "@beep/dock/Dock.commands"
 *
 * const command = RestoreMaximizedCommand.make({})
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class RestoreMaximizedCommand extends S.Opaque<RestoreMaximizedCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("restoreMaximized") }).pipe(
    $I.annoteSchema("RestoreMaximizedCommand", { description: "Clears the currently maximized group." })
  )
) {}

/**
 * Command that moves a docked group into a floating member.
 *
 * **Example** (Float group with box)
 *
 * ```ts
 * import { FloatGroupCommand } from "@beep/dock/Dock.commands"
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { TopLeftAnchoredBox } from "@beep/dock/AnchoredBox"
 *
 * const command = FloatGroupCommand.make({ groupId: GroupId.make("group-one"), anchoredBox: TopLeftAnchoredBox.make({ left: 20, top: 12, width: 640, height: 480 }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class FloatGroupCommand extends S.Opaque<FloatGroupCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("floatGroup"), groupId: GroupId, anchoredBox: AnchoredBox }).pipe(
    $I.annoteSchema("FloatGroupCommand", { description: "Moves one docked group into a new topmost floating member." })
  )
) {}
/**
 * Command that docks a floating group into the tree.
 *
 * **Example** (Dock floating group)
 *
 * ```ts
 * import { DockFloatingGroupCommand } from "@beep/dock/Dock.commands"
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { TabPlacement } from "@beep/dock/Dock.placement"
 *
 * const command = DockFloatingGroupCommand.make({ groupId: GroupId.make("group-one"), target: TabPlacement.make({ groupId: GroupId.make("group-two") }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class DockFloatingGroupCommand extends S.Opaque<DockFloatingGroupCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("dockFloatingGroup"), groupId: GroupId, target: DockGroupMoveTarget }).pipe(
    $I.annoteSchema("DockFloatingGroupCommand", { description: "Moves a floating group back into the docked tree." })
  )
) {}
/**
 * Command that repositions a floating group and raises its z-order.
 *
 * **Example** (Reposition floating group)
 *
 * ```ts
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { MoveFloatingGroupCommand } from "@beep/dock/Dock.commands"
 * import { TopLeftAnchoredBox } from "@beep/dock/AnchoredBox"
 *
 * const command = MoveFloatingGroupCommand.make({ groupId: GroupId.make("group-one"), anchoredBox: TopLeftAnchoredBox.make({ left: 30, top: 24, width: 640, height: 480 }) })
 * console.log(command.kind)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class MoveFloatingGroupCommand extends S.Opaque<MoveFloatingGroupCommand, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("moveFloatingGroup"), groupId: GroupId, anchoredBox: AnchoredBox }).pipe(
    $I.annoteSchema("MoveFloatingGroupCommand", {
      description: "Updates a floating member box and brings it to front.",
    })
  )
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
 * **Example** (Use dock command codec)
 *
 * ```ts
 * import { ClearWorkspaceCommand, DockCommand } from "@beep/dock/Dock.commands"
 *
 * const command = ClearWorkspaceCommand.make({})
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
).pipe(
  $I.annoteSchema("DockCommand", {
    description: "Exhaustive command algebra for the POC layout kernel.",
  }),
  S.toTaggedUnion("kind")
);
/**
 * Decoded tagged codec for every dock mutation command.
 *
 * **Example** (Type decoded dock command)
 *
 * ```ts
 * import { ClearWorkspaceCommand, DockCommand } from "@beep/dock/Dock.commands"
 *
 * const command: DockCommand = ClearWorkspaceCommand.make({})
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
 * **Example** (Wrap command in envelope)
 *
 * ```ts
 * import { ApiCommandOrigin, ClearWorkspaceCommand, DockCommandEnvelope } from "@beep/dock/Dock.commands"
 * import { CommandId } from "@beep/dock/Dock.ids"
 *
 * const command = DockCommandEnvelope.make({ commandId: CommandId.make("command-clear"), origin: ApiCommandOrigin.make({ requestId: "request-one" }), command: ClearWorkspaceCommand.make({}) })
 * console.log(command.commandId)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class DockCommandEnvelope extends S.Opaque<DockCommandEnvelope, { readonly brand: unique symbol }>()(
  S.Struct({
    commandId: CommandId,
    origin: CommandOrigin,
    command: DockCommand,
  }).pipe(
    $I.annoteSchema("DockCommandEnvelope", {
      description: "Top-level dock command with explicit causal origin.",
    })
  )
) {}

/**
 * Host renderer keys permitted when restoring component-backed panels.
 *
 * **Example** (List permitted renderer keys)
 *
 * ```ts
 * import { AllowedRenderers } from "@beep/dock/Dock.commands"
 * import { RendererKey } from "@beep/dock/Dock.ids"
 *
 * const allowed = AllowedRenderers.make([RendererKey.make("editor")])
 * console.log(allowed.length)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const AllowedRenderers = RendererKey.pipe(
  S.toType,
  S.Array,
  $I.annoteSchema("AllowedRenderers", {
    description: "Host renderer keys allowed to survive persisted workspace restoration.",
  })
);

/**
 * Runtime type for {@link AllowedRenderers}.
 *
 * **Example** (Type allowed renderers list)
 *
 * ```ts
 * import { AllowedRenderers } from "@beep/dock/Dock.commands"
 * import { RendererKey } from "@beep/dock/Dock.ids"
 *
 * const allowed: AllowedRenderers = AllowedRenderers.make([RendererKey.make("editor")])
 * console.log(allowed[0])
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export type AllowedRenderers = typeof AllowedRenderers.Type;

/**
 * Causal metadata for a validated snapshot installation.
 *
 * **Example** (Make restore snapshot request)
 *
 * ```ts
 * import { ApiCommandOrigin, RestoreSnapshotRequest } from "@beep/dock/Dock.commands"
 * import { CommandId } from "@beep/dock/Dock.ids"
 *
 * const command = RestoreSnapshotRequest.make({ commandId: CommandId.make("command-restore"), origin: ApiCommandOrigin.make({ requestId: "request-one" }) })
 * console.log(command.commandId)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class RestoreSnapshotRequest extends S.Opaque<RestoreSnapshotRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    commandId: CommandId,
    origin: CommandOrigin,
    allowedRenderers: AllowedRenderers.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ).annotateKey({
      description: "Optional host renderer allowlist; absence preserves every decoded panel.",
    }),
  }).pipe(
    $I.annoteSchema("RestoreSnapshotRequest", {
      description: "Causal metadata attached to a validated snapshot installation.",
    })
  )
) {}

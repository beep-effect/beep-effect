/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { GroupId, PanelId, RendererKey, SplitId, SplitRatio } from "./Dock.ids.ts";
import { PanelConstraints, PanelRenderMode, PanelView } from "./Dock.models.ts";

const $I = $DockId.create("Dock.events");

/**
 * Event recording a panel installation.
 *
 * **Example** (Make panel opened event)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelOpenedEvent } from "@beep/dock/Dock.events"
 *
 * const event = PanelOpenedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelOpenedEvent extends S.Opaque<PanelOpenedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("panelOpened"),
    panelId: PanelId,
    groupId: GroupId,
  }).pipe(
    $I.annoteSchema("PanelOpenedEvent", {
      description: "A panel was installed into a tab group.",
    })
  )
) {}

/**
 * Event recording a newly active panel.
 *
 * **Example** (Make panel activated event)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelActivatedEvent } from "@beep/dock/Dock.events"
 *
 * const event = PanelActivatedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelActivatedEvent extends S.Opaque<PanelActivatedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("panelActivated"),
    panelId: PanelId,
    groupId: GroupId,
  }).pipe(
    $I.annoteSchema("PanelActivatedEvent", {
      description: "A panel became the active member of its tab zipper.",
    })
  )
) {}

/**
 * Event recording a panel title replacement.
 *
 * **Example** (Make title changed event)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelTitleChangedEvent } from "@beep/dock/Dock.events"
 *
 * const event = PanelTitleChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), title: "Renamed" })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelTitleChangedEvent extends S.Opaque<PanelTitleChangedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("panelTitleChanged"), panelId: PanelId, groupId: GroupId, title: S.NonEmptyString }).pipe(
    $I.annoteSchema("PanelTitleChangedEvent", { description: "A panel title was replaced." })
  )
) {}

/**
 * Event recording a panel view replacement.
 *
 * **Example** (Make view changed event)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelViewChangedEvent } from "@beep/dock/Dock.events"
 * import { TextPanelView } from "@beep/dock/Dock.models"
 *
 * const event = PanelViewChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), view: TextPanelView.make({ text: "updated" }) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelViewChangedEvent extends S.Opaque<PanelViewChangedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("panelViewChanged"), panelId: PanelId, groupId: GroupId, view: PanelView }).pipe(
    $I.annoteSchema("PanelViewChangedEvent", { description: "A panel view contract was replaced." })
  )
) {}

/**
 * Event recording a panel rendering-policy replacement.
 *
 * **Example** (Make render mode event)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelRenderModeChangedEvent } from "@beep/dock/Dock.events"
 *
 * const event = PanelRenderModeChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), renderMode: "always" })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelRenderModeChangedEvent extends S.Opaque<
  PanelRenderModeChangedEvent,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("panelRenderModeChanged"),
    panelId: PanelId,
    groupId: GroupId,
    renderMode: PanelRenderMode,
  }).pipe($I.annoteSchema("PanelRenderModeChangedEvent", { description: "A panel rendering policy was replaced." }))
) {}

/**
 * Event recording replacement or removal of a custom tab renderer.
 *
 * **Example** (Clear panel tab component)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelTabComponentChangedEvent } from "@beep/dock/Dock.events"
 * import * as O from "effect/Option"
 *
 * const event = PanelTabComponentChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), tabComponent: O.none() })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelTabComponentChangedEvent extends S.Opaque<
  PanelTabComponentChangedEvent,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("panelTabComponentChanged"),
    panelId: PanelId,
    groupId: GroupId,
    tabComponent: S.Option(RendererKey),
  }).pipe(
    $I.annoteSchema("PanelTabComponentChangedEvent", {
      description: "A panel custom tab renderer key was replaced or cleared.",
    })
  )
) {}

/**
 * Event recording replacement or removal of panel size constraints.
 *
 * **Example** (Update panel size constraints)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelConstraints } from "@beep/dock/Dock.models"
 * import { PanelConstraintsChangedEvent } from "@beep/dock/Dock.events"
 * import * as O from "effect/Option"
 *
 * const event = PanelConstraintsChangedEvent.make({
 *   panelId: PanelId.make("panel-one"),
 *   groupId: GroupId.make("group-one"),
 *   constraints: O.some(PanelConstraints.make({ minWidth: O.some(240) })),
 * })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelConstraintsChangedEvent extends S.Opaque<
  PanelConstraintsChangedEvent,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("panelConstraintsChanged"),
    panelId: PanelId,
    groupId: GroupId,
    constraints: S.Option(PanelConstraints),
  }).pipe(
    $I.annoteSchema("PanelConstraintsChangedEvent", {
      description: "A panel size-constraint contract was replaced or cleared.",
    })
  )
) {}

/**
 * Event recording an atomic panel move between groups.
 *
 * **Example** (Move panel across groups)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelMovedEvent } from "@beep/dock/Dock.events"
 *
 * const event = PanelMovedEvent.make({ panelId: PanelId.make("panel-one"), fromGroupId: GroupId.make("group-one"), toGroupId: GroupId.make("group-two") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelMovedEvent extends S.Opaque<PanelMovedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("panelMoved"),
    panelId: PanelId,
    fromGroupId: GroupId,
    toGroupId: GroupId,
  }).pipe(
    $I.annoteSchema("PanelMovedEvent", {
      description: "A panel moved between tab groups in one tree publication.",
    })
  )
) {}

/**
 * Event recording a panel reorder within one group.
 *
 * **Example** (Reorder panel by index)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelReorderedEvent } from "@beep/dock/Dock.events"
 *
 * const event = PanelReorderedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), index: S.Natural.make(1) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelReorderedEvent extends S.Opaque<PanelReorderedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("panelReordered"), panelId: PanelId, groupId: GroupId, index: S.Natural }).pipe(
    $I.annoteSchema("PanelReorderedEvent", { description: "A panel changed position within its existing tab group." })
  )
) {}

/**
 * Event recording a whole-group merge in source order.
 *
 * **Example** (Merge groups in order)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { GroupMergedEvent } from "@beep/dock/Dock.events"
 *
 * const event = GroupMergedEvent.make({ fromGroupId: GroupId.make("group-one"), toGroupId: GroupId.make("group-two"), panelIds: [PanelId.make("panel-one")] })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupMergedEvent extends S.Opaque<GroupMergedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("groupMerged"),
    fromGroupId: GroupId,
    toGroupId: GroupId,
    panelIds: S.NonEmptyArray(PanelId),
  }).pipe(
    $I.annoteSchema("GroupMergedEvent", {
      description: "A complete source group was merged into a destination group in source order.",
    })
  )
) {}

/**
 * Event recording a whole-group relocation through a new split.
 *
 * **Example** (Move group into split)
 *
 * ```ts
 * import { GroupId, SplitId } from "@beep/dock/Dock.ids"
 * import { GroupMovedEvent } from "@beep/dock/Dock.events"
 *
 * const event = GroupMovedEvent.make({ groupId: GroupId.make("group-one"), splitId: SplitId.make("split-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupMovedEvent extends S.Opaque<GroupMovedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("groupMoved"), groupId: GroupId, splitId: SplitId }).pipe(
    $I.annoteSchema("GroupMovedEvent", {
      description: "A complete tab group was relocated through a newly created split.",
    })
  )
) {}

/**
 * Event recording a group metadata update.
 *
 * **Example** (Update group metadata)
 *
 * ```ts
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { GroupUpdatedEvent } from "@beep/dock/Dock.events"
 *
 * const event = GroupUpdatedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupUpdatedEvent extends S.Opaque<GroupUpdatedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("groupUpdated"), groupId: GroupId }).pipe(
    $I.annoteSchema("GroupUpdatedEvent", { description: "Persistable metadata for a tab group changed." })
  )
) {}

/**
 * Event recording a panel close and topology collapse.
 *
 * **Example** (Close panel with collapse)
 *
 * ```ts
 * import { GroupId, PanelId } from "@beep/dock/Dock.ids"
 * import { PanelClosedEvent } from "@beep/dock/Dock.events"
 *
 * const event = PanelClosedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelClosedEvent extends S.Opaque<PanelClosedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("panelClosed"),
    panelId: PanelId,
    groupId: GroupId,
  }).pipe(
    $I.annoteSchema("PanelClosedEvent", {
      description: "A panel was removed and empty topology was collapsed.",
    })
  )
) {}

/**
 * Event recording a bounded split-ratio change.
 *
 * **Example** (Resize split by ratio)
 *
 * ```ts
 * import { SplitId, SplitRatio } from "@beep/dock/Dock.ids"
 * import { SplitResizedEvent } from "@beep/dock/Dock.events"
 *
 * const event = SplitResizedEvent.make({ splitId: SplitId.make("split-one"), ratio: SplitRatio.make(6_000) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class SplitResizedEvent extends S.Opaque<SplitResizedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("splitResized"),
    splitId: SplitId,
    ratio: SplitRatio,
  }).pipe(
    $I.annoteSchema("SplitResizedEvent", {
      description: "A binary split ratio changed.",
    })
  )
) {}

/**
 * Event recording an atomic workspace clear.
 *
 * **Example** (Clear the workspace)
 *
 * ```ts
 * import { WorkspaceClearedEvent } from "@beep/dock/Dock.events"
 *
 * const event = WorkspaceClearedEvent.make({})
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class WorkspaceClearedEvent extends S.Opaque<WorkspaceClearedEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("workspaceCleared"),
  }).pipe(
    $I.annoteSchema("WorkspaceClearedEvent", {
      description: "The complete workspace was cleared atomically.",
    })
  )
) {}

/**
 * Event recording installation of a validated snapshot.
 *
 * **Example** (Restore validated snapshot)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WorkspaceRestoredEvent } from "@beep/dock/Dock.events"
 *
 * const event = WorkspaceRestoredEvent.make({ sourceRevision: S.Natural.make(3), installedRevision: S.Natural.make(8) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class WorkspaceRestoredEvent extends S.Opaque<WorkspaceRestoredEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("workspaceRestored"),
    sourceRevision: S.Natural,
    installedRevision: S.Natural,
  }).pipe(
    $I.annoteSchema("WorkspaceRestoredEvent", {
      description:
        "A fully decoded and validated snapshot replaced live content without rewinding live revision order.",
    })
  )
) {}

/**
 * Event recording entry into maximized mode.
 *
 * **Example** (Maximize a group)
 *
 * ```ts
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { GroupMaximizedEvent } from "@beep/dock/Dock.events"
 *
 * const event = GroupMaximizedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupMaximizedEvent extends S.Opaque<GroupMaximizedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("groupMaximized"), groupId: GroupId }).pipe(
    $I.annoteSchema("GroupMaximizedEvent", { description: "A visible group became the exclusive geometry projection." })
  )
) {}

/**
 * Event recording exit from maximized mode.
 *
 * **Example** (Restore maximized group)
 *
 * ```ts
 * import { GroupId } from "@beep/dock/Dock.ids"
 * import { GroupRestoredEvent } from "@beep/dock/Dock.events"
 *
 * const event = GroupRestoredEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupRestoredEvent extends S.Opaque<GroupRestoredEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("groupRestored"), groupId: GroupId }).pipe(
    $I.annoteSchema("GroupRestoredEvent", { description: "A group left maximized mode." })
  )
) {}
/**
 * Event recording a docked group becoming floating.
 *
 * **Example** (Float a docked group)
 *
 * ```ts
 * import { GroupFloatedEvent } from "@beep/dock/Dock.events"
 * import { GroupId } from "@beep/dock/Dock.ids"
 *
 * const event = GroupFloatedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupFloatedEvent extends S.Opaque<GroupFloatedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("groupFloated"), groupId: GroupId }).pipe(
    $I.annoteSchema("GroupFloatedEvent", { description: "A docked group became floating." })
  )
) {}
/**
 * Event recording a floating group returning to the dock tree.
 *
 * **Example** (Dock a floating group)
 *
 * ```ts
 * import { GroupDockedEvent } from "@beep/dock/Dock.events"
 * import { GroupId } from "@beep/dock/Dock.ids"
 *
 * const event = GroupDockedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupDockedEvent extends S.Opaque<GroupDockedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("groupDocked"), groupId: GroupId }).pipe(
    $I.annoteSchema("GroupDockedEvent", { description: "A floating group returned to the docked tree." })
  )
) {}
/**
 * Event recording a floating member move or z-order change.
 *
 * **Example** (Move floating group)
 *
 * ```ts
 * import { FloatingGroupMovedEvent } from "@beep/dock/Dock.events"
 * import { GroupId } from "@beep/dock/Dock.ids"
 *
 * const event = FloatingGroupMovedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class FloatingGroupMovedEvent extends S.Opaque<FloatingGroupMovedEvent, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("floatingGroupMoved"), groupId: GroupId }).pipe(
    $I.annoteSchema("FloatingGroupMovedEvent", { description: "A floating member moved or changed z-order." })
  )
) {}

const DockEventKind = LiteralKit([
  "panelOpened",
  "panelActivated",
  "panelTitleChanged",
  "panelViewChanged",
  "panelRenderModeChanged",
  "panelTabComponentChanged",
  "panelConstraintsChanged",
  "panelMoved",
  "panelReordered",
  "groupMerged",
  "groupMoved",
  "groupUpdated",
  "panelClosed",
  "splitResized",
  "workspaceCleared",
  "workspaceRestored",
  "groupMaximized",
  "groupRestored",
  "groupFloated",
  "groupDocked",
  "floatingGroupMoved",
]);

/**
 * Tagged codec for all domain events.
 *
 * **Example** (Create tagged dock event)
 *
 * ```ts
 * import { DockEvent, WorkspaceClearedEvent } from "@beep/dock/Dock.events"
 *
 * const event = WorkspaceClearedEvent.make({})
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const DockEvent = DockEventKind.mapMembers(
  Tuple.evolve([
    () => PanelOpenedEvent,
    () => PanelActivatedEvent,
    () => PanelTitleChangedEvent,
    () => PanelViewChangedEvent,
    () => PanelRenderModeChangedEvent,
    () => PanelTabComponentChangedEvent,
    () => PanelConstraintsChangedEvent,
    () => PanelMovedEvent,
    () => PanelReorderedEvent,
    () => GroupMergedEvent,
    () => GroupMovedEvent,
    () => GroupUpdatedEvent,
    () => PanelClosedEvent,
    () => SplitResizedEvent,
    () => WorkspaceClearedEvent,
    () => WorkspaceRestoredEvent,
    () => GroupMaximizedEvent,
    () => GroupRestoredEvent,
    () => GroupFloatedEvent,
    () => GroupDockedEvent,
    () => FloatingGroupMovedEvent,
  ])
).pipe(
  $I.annoteSchema("DockEvent", {
    description: "Exhaustive events produced by accepted commands and restores.",
  }),
  S.toTaggedUnion("kind")
);
/**
 * Decoded complete dock domain event.
 *
 * **Example** (Annotate dock event type)
 *
 * ```ts
 * import { DockEvent, WorkspaceClearedEvent } from "@beep/dock/Dock.events"
 *
 * const event: DockEvent = WorkspaceClearedEvent.make({})
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export type DockEvent = typeof DockEvent.Type;

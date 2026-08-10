/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { GroupId, PanelId, RendererKey, SplitId, SplitRatio } from "./Dock.ids.ts";
import { PanelConstraints, PanelRenderMode, PanelView } from "./Dock.models.ts";

const $I = $DockId.create("Dock.events");

/**
 * Event recording a panel installation.
 *
 * **Example** (Make panel opened event)
 *
 * ```ts
 * import { GroupId, PanelId, PanelOpenedEvent } from "@beep/dock"
 *
 * const event = PanelOpenedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelOpenedEvent extends S.Class<PanelOpenedEvent>($I`PanelOpenedEvent`)(
  {
    kind: S.tag("panelOpened"),
    panelId: PanelId,
    groupId: GroupId,
  },
  $I.annote("PanelOpenedEvent", {
    description: "A panel was installed into a tab group.",
  })
) {}

/**
 * Event recording a newly active panel.
 *
 * **Example** (Make panel activated event)
 *
 * ```ts
 * import { GroupId, PanelActivatedEvent, PanelId } from "@beep/dock"
 *
 * const event = PanelActivatedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelActivatedEvent extends S.Class<PanelActivatedEvent>($I`PanelActivatedEvent`)(
  {
    kind: S.tag("panelActivated"),
    panelId: PanelId,
    groupId: GroupId,
  },
  $I.annote("PanelActivatedEvent", {
    description: "A panel became the active member of its tab zipper.",
  })
) {}

/**
 * Event recording a panel title replacement.
 *
 * **Example** (Make title changed event)
 *
 * ```ts
 * import { GroupId, PanelId, PanelTitleChangedEvent } from "@beep/dock"
 *
 * const event = PanelTitleChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), title: "Renamed" })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelTitleChangedEvent extends S.Class<PanelTitleChangedEvent>($I`PanelTitleChangedEvent`)(
  { kind: S.tag("panelTitleChanged"), panelId: PanelId, groupId: GroupId, title: S.NonEmptyString },
  $I.annote("PanelTitleChangedEvent", { description: "A panel title was replaced." })
) {}

/**
 * Event recording a panel view replacement.
 *
 * **Example** (Make view changed event)
 *
 * ```ts
 * import { GroupId, PanelId, PanelViewChangedEvent, TextPanelView } from "@beep/dock"
 *
 * const event = PanelViewChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), view: TextPanelView.make({ text: "updated" }) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelViewChangedEvent extends S.Class<PanelViewChangedEvent>($I`PanelViewChangedEvent`)(
  { kind: S.tag("panelViewChanged"), panelId: PanelId, groupId: GroupId, view: PanelView },
  $I.annote("PanelViewChangedEvent", { description: "A panel view contract was replaced." })
) {}

/**
 * Event recording a panel rendering-policy replacement.
 *
 * **Example** (Make render mode event)
 *
 * ```ts
 * import { GroupId, PanelId, PanelRenderModeChangedEvent } from "@beep/dock"
 *
 * const event = PanelRenderModeChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), renderMode: "always" })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelRenderModeChangedEvent extends S.Class<PanelRenderModeChangedEvent>($I`PanelRenderModeChangedEvent`)(
  { kind: S.tag("panelRenderModeChanged"), panelId: PanelId, groupId: GroupId, renderMode: PanelRenderMode },
  $I.annote("PanelRenderModeChangedEvent", { description: "A panel rendering policy was replaced." })
) {}

/**
 * Event recording replacement or removal of a custom tab renderer.
 *
 * **Example** (Clear panel tab component)
 *
 * ```ts
 * import { GroupId, PanelId, PanelTabComponentChangedEvent } from "@beep/dock"
 * import * as O from "effect/Option"
 *
 * const event = PanelTabComponentChangedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), tabComponent: O.none() })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelTabComponentChangedEvent extends S.Class<PanelTabComponentChangedEvent>(
  $I`PanelTabComponentChangedEvent`
)(
  { kind: S.tag("panelTabComponentChanged"), panelId: PanelId, groupId: GroupId, tabComponent: S.Option(RendererKey) },
  $I.annote("PanelTabComponentChangedEvent", {
    description: "A panel custom tab renderer key was replaced or cleared.",
  })
) {}

/**
 * Event recording replacement or removal of panel size constraints.
 *
 * **Example** (Update panel size constraints)
 *
 * ```ts
 * import { GroupId, PanelConstraints, PanelConstraintsChangedEvent, PanelId } from "@beep/dock"
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
export class PanelConstraintsChangedEvent extends S.Class<PanelConstraintsChangedEvent>(
  $I`PanelConstraintsChangedEvent`
)(
  {
    kind: S.tag("panelConstraintsChanged"),
    panelId: PanelId,
    groupId: GroupId,
    constraints: S.Option(PanelConstraints),
  },
  $I.annote("PanelConstraintsChangedEvent", {
    description: "A panel size-constraint contract was replaced or cleared.",
  })
) {}

/**
 * Event recording an atomic panel move between groups.
 *
 * **Example** (Move panel across groups)
 *
 * ```ts
 * import { GroupId, PanelId, PanelMovedEvent } from "@beep/dock"
 *
 * const event = PanelMovedEvent.make({ panelId: PanelId.make("panel-one"), fromGroupId: GroupId.make("group-one"), toGroupId: GroupId.make("group-two") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelMovedEvent extends S.Class<PanelMovedEvent>($I`PanelMovedEvent`)(
  {
    kind: S.tag("panelMoved"),
    panelId: PanelId,
    fromGroupId: GroupId,
    toGroupId: GroupId,
  },
  $I.annote("PanelMovedEvent", {
    description: "A panel moved between tab groups in one tree publication.",
  })
) {}

/**
 * Event recording a panel reorder within one group.
 *
 * **Example** (Reorder panel by index)
 *
 * ```ts
 * import { GroupId, PanelId, PanelReorderedEvent } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const event = PanelReorderedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one"), index: NonNegativeInt.make(1) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelReorderedEvent extends S.Class<PanelReorderedEvent>($I`PanelReorderedEvent`)(
  { kind: S.tag("panelReordered"), panelId: PanelId, groupId: GroupId, index: NonNegativeInt },
  $I.annote("PanelReorderedEvent", { description: "A panel changed position within its existing tab group." })
) {}

/**
 * Event recording a whole-group merge in source order.
 *
 * **Example** (Merge groups in order)
 *
 * ```ts
 * import { GroupId, GroupMergedEvent, PanelId } from "@beep/dock"
 *
 * const event = GroupMergedEvent.make({ fromGroupId: GroupId.make("group-one"), toGroupId: GroupId.make("group-two"), panelIds: [PanelId.make("panel-one")] })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupMergedEvent extends S.Class<GroupMergedEvent>($I`GroupMergedEvent`)(
  { kind: S.tag("groupMerged"), fromGroupId: GroupId, toGroupId: GroupId, panelIds: S.NonEmptyArray(PanelId) },
  $I.annote("GroupMergedEvent", {
    description: "A complete source group was merged into a destination group in source order.",
  })
) {}

/**
 * Event recording a whole-group relocation through a new split.
 *
 * **Example** (Move group into split)
 *
 * ```ts
 * import { GroupId, GroupMovedEvent, SplitId } from "@beep/dock"
 *
 * const event = GroupMovedEvent.make({ groupId: GroupId.make("group-one"), splitId: SplitId.make("split-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupMovedEvent extends S.Class<GroupMovedEvent>($I`GroupMovedEvent`)(
  { kind: S.tag("groupMoved"), groupId: GroupId, splitId: SplitId },
  $I.annote("GroupMovedEvent", { description: "A complete tab group was relocated through a newly created split." })
) {}

/**
 * Event recording a group metadata update.
 *
 * **Example** (Update group metadata)
 *
 * ```ts
 * import { GroupId, GroupUpdatedEvent } from "@beep/dock"
 *
 * const event = GroupUpdatedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupUpdatedEvent extends S.Class<GroupUpdatedEvent>($I`GroupUpdatedEvent`)(
  { kind: S.tag("groupUpdated"), groupId: GroupId },
  $I.annote("GroupUpdatedEvent", { description: "Persistable metadata for a tab group changed." })
) {}

/**
 * Event recording a panel close and topology collapse.
 *
 * **Example** (Close panel with collapse)
 *
 * ```ts
 * import { GroupId, PanelClosedEvent, PanelId } from "@beep/dock"
 *
 * const event = PanelClosedEvent.make({ panelId: PanelId.make("panel-one"), groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class PanelClosedEvent extends S.Class<PanelClosedEvent>($I`PanelClosedEvent`)(
  {
    kind: S.tag("panelClosed"),
    panelId: PanelId,
    groupId: GroupId,
  },
  $I.annote("PanelClosedEvent", {
    description: "A panel was removed and empty topology was collapsed.",
  })
) {}

/**
 * Event recording a bounded split-ratio change.
 *
 * **Example** (Resize split by ratio)
 *
 * ```ts
 * import { SplitId, SplitRatio, SplitResizedEvent } from "@beep/dock"
 *
 * const event = SplitResizedEvent.make({ splitId: SplitId.make("split-one"), ratio: SplitRatio.make(6_000) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class SplitResizedEvent extends S.Class<SplitResizedEvent>($I`SplitResizedEvent`)(
  {
    kind: S.tag("splitResized"),
    splitId: SplitId,
    ratio: SplitRatio,
  },
  $I.annote("SplitResizedEvent", {
    description: "A binary split ratio changed.",
  })
) {}

/**
 * Event recording an atomic workspace clear.
 *
 * **Example** (Clear the workspace)
 *
 * ```ts
 * import { WorkspaceClearedEvent } from "@beep/dock"
 *
 * const event = WorkspaceClearedEvent.make()
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class WorkspaceClearedEvent extends S.Class<WorkspaceClearedEvent>($I`WorkspaceClearedEvent`)(
  {
    kind: S.tag("workspaceCleared"),
  },
  $I.annote("WorkspaceClearedEvent", {
    description: "The complete workspace was cleared atomically.",
  })
) {}

/**
 * Event recording installation of a validated snapshot.
 *
 * **Example** (Restore validated snapshot)
 *
 * ```ts
 * import { WorkspaceRestoredEvent } from "@beep/dock"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const event = WorkspaceRestoredEvent.make({ sourceRevision: NonNegativeInt.make(3), installedRevision: NonNegativeInt.make(8) })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class WorkspaceRestoredEvent extends S.Class<WorkspaceRestoredEvent>($I`WorkspaceRestoredEvent`)(
  {
    kind: S.tag("workspaceRestored"),
    sourceRevision: NonNegativeInt,
    installedRevision: NonNegativeInt,
  },
  $I.annote("WorkspaceRestoredEvent", {
    description: "A fully decoded and validated snapshot replaced live content without rewinding live revision order.",
  })
) {}

/**
 * Event recording entry into maximized mode.
 *
 * **Example** (Maximize a group)
 *
 * ```ts
 * import { GroupId, GroupMaximizedEvent } from "@beep/dock"
 *
 * const event = GroupMaximizedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupMaximizedEvent extends S.Class<GroupMaximizedEvent>($I`GroupMaximizedEvent`)(
  { kind: S.tag("groupMaximized"), groupId: GroupId },
  $I.annote("GroupMaximizedEvent", { description: "A visible group became the exclusive geometry projection." })
) {}

/**
 * Event recording exit from maximized mode.
 *
 * **Example** (Restore maximized group)
 *
 * ```ts
 * import { GroupId, GroupRestoredEvent } from "@beep/dock"
 *
 * const event = GroupRestoredEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupRestoredEvent extends S.Class<GroupRestoredEvent>($I`GroupRestoredEvent`)(
  { kind: S.tag("groupRestored"), groupId: GroupId },
  $I.annote("GroupRestoredEvent", { description: "A group left maximized mode." })
) {}
/**
 * Event recording a docked group becoming floating.
 *
 * **Example** (Float a docked group)
 *
 * ```ts
 * import { GroupFloatedEvent, GroupId } from "@beep/dock"
 *
 * const event = GroupFloatedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupFloatedEvent extends S.Class<GroupFloatedEvent>($I`GroupFloatedEvent`)(
  { kind: S.tag("groupFloated"), groupId: GroupId },
  $I.annote("GroupFloatedEvent", { description: "A docked group became floating." })
) {}
/**
 * Event recording a floating group returning to the dock tree.
 *
 * **Example** (Dock a floating group)
 *
 * ```ts
 * import { GroupDockedEvent, GroupId } from "@beep/dock"
 *
 * const event = GroupDockedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class GroupDockedEvent extends S.Class<GroupDockedEvent>($I`GroupDockedEvent`)(
  { kind: S.tag("groupDocked"), groupId: GroupId },
  $I.annote("GroupDockedEvent", { description: "A floating group returned to the docked tree." })
) {}
/**
 * Event recording a floating member move or z-order change.
 *
 * **Example** (Move floating group)
 *
 * ```ts
 * import { FloatingGroupMovedEvent, GroupId } from "@beep/dock"
 *
 * const event = FloatingGroupMovedEvent.make({ groupId: GroupId.make("group-one") })
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class FloatingGroupMovedEvent extends S.Class<FloatingGroupMovedEvent>($I`FloatingGroupMovedEvent`)(
  { kind: S.tag("floatingGroupMoved"), groupId: GroupId },
  $I.annote("FloatingGroupMovedEvent", { description: "A floating member moved or changed z-order." })
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
 * import { DockEvent, WorkspaceClearedEvent } from "@beep/dock"
 *
 * const event = WorkspaceClearedEvent.make()
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
)
  .annotate(
    $I.annote("DockEvent", {
      description: "Exhaustive events produced by accepted commands and restores.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
/**
 * Decoded complete dock domain event.
 *
 * **Example** (Annotate dock event type)
 *
 * ```ts
 * import { DockEvent, WorkspaceClearedEvent } from "@beep/dock"
 *
 * const event: DockEvent = WorkspaceClearedEvent.make()
 * console.log(event.kind)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export type DockEvent = typeof DockEvent.Type;

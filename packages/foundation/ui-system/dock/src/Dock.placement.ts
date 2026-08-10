/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { GroupId, SplitId, SplitRatio } from "./Dock.ids.ts";

const $I = $DockId.create("Dock.placement");

/**
 * Root placement that creates the first tab group.
 *
 * **Example** (Create first tab group)
 *
 * ```ts
 * import { GroupId, RootPlacement } from "@beep/dock"
 *
 * const placement = RootPlacement.make({ groupId: GroupId.make("group-one") })
 * console.log(placement.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootPlacement extends S.Class<RootPlacement>($I`RootPlacement`)(
  {
    kind: S.tag("root"),
    groupId: GroupId,
  },
  $I.annote("RootPlacement", {
    description: "Creates the root tab group in an empty workspace.",
  })
) {}

/**
 * Placement that inserts a panel into an existing tab group.
 *
 * **Example** (Insert into tab group)
 *
 * ```ts
 * import { GroupId, TabPlacement } from "@beep/dock"
 *
 * const placement = TabPlacement.make({ groupId: GroupId.make("group-one") })
 * console.log(placement.activate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TabPlacement extends S.Class<TabPlacement>($I`TabPlacement`)(
  {
    kind: S.tag("tab"),
    groupId: GroupId,
    index: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
    activate: S.Boolean.pipe(SchemaUtils.withConstantDefault<boolean>(true)),
  },
  $I.annote("TabPlacement", {
    description: "Inserts a panel into an existing tab group, optionally without changing its active panel.",
  })
) {}

/**
 * Codec for the semantic side of an inserted group.
 *
 * **Example** (Make docking side)
 *
 * ```ts
 * import { DockSide } from "@beep/dock"
 *
 * const side = DockSide.make("right")
 * console.log(side)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockSide = LiteralKit(["left", "right", "top", "bottom"]).annotate(
  $I.annote("DockSide", {
    description: "Semantic side on which a new tab group is inserted.",
  })
);
/**
 * Decoded semantic docking side.
 *
 * **Example** (Type docking side)
 *
 * ```ts
 * import { DockSide } from "@beep/dock"
 *
 * const side: DockSide = DockSide.make("left")
 * console.log(side)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockSide = typeof DockSide.Type;

/**
 * Placement that creates a sibling group and binary split.
 *
 * **Example** (Create sibling split group)
 *
 * ```ts
 * import { GroupId, SplitId, SplitPlacement } from "@beep/dock"
 *
 * const placement = SplitPlacement.make({ referenceGroupId: GroupId.make("group-one"), newGroupId: GroupId.make("group-two"), splitId: SplitId.make("split-one"), side: "right" })
 * console.log(placement.newGroupRatio)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SplitPlacement extends S.Class<SplitPlacement>($I`SplitPlacement`)(
  {
    kind: S.tag("split"),
    referenceGroupId: GroupId,
    newGroupId: GroupId,
    splitId: SplitId,
    side: DockSide,
    newGroupRatio: SplitRatio.pipe(SchemaUtils.withConstantDefault<number>(5_000)),
  },
  $I.annote("SplitPlacement", {
    description: "Creates a new tab group beside an existing group with an explicit share for the new group.",
  })
) {}

/**
 * Placement that inserts a new group against an existing docked workspace root.
 *
 * **Details**
 *
 * This placement requires an existing docked root. Use {@link RootPlacement}
 * to open the first docked panel in an empty-root workspace.
 *
 * **Example** (Split against docked root)
 *
 * ```ts
 * import { GroupId, RootSplitPlacement, SplitId } from "@beep/dock"
 *
 * const placement = RootSplitPlacement.make({ newGroupId: GroupId.make("group-two"), splitId: SplitId.make("split-one"), side: "left" })
 * console.log(placement.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootSplitPlacement extends S.Class<RootSplitPlacement>($I`RootSplitPlacement`)(
  {
    kind: S.tag("rootSplit"),
    side: DockSide,
    splitId: SplitId,
    newGroupId: GroupId,
    newGroupRatio: SplitRatio.pipe(SchemaUtils.withConstantDefault<number>(5_000)),
  },
  $I.annote("RootSplitPlacement", {
    description: "Creates a new tab group against one semantic edge of an existing docked workspace root.",
  })
) {}

/**
 * Placement that relocates a group beside another group.
 *
 * **Example** (Relocate group beside group)
 *
 * ```ts
 * import { GroupId, GroupSplitPlacement, SplitId } from "@beep/dock"
 *
 * const placement = GroupSplitPlacement.make({ referenceGroupId: GroupId.make("group-one"), splitId: SplitId.make("split-one"), side: "bottom" })
 * console.log(placement.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroupSplitPlacement extends S.Class<GroupSplitPlacement>($I`GroupSplitPlacement`)(
  {
    kind: S.tag("groupSplit"),
    referenceGroupId: GroupId,
    splitId: SplitId,
    side: DockSide,
    newGroupRatio: SplitRatio.pipe(SchemaUtils.withConstantDefault<number>(5_000)),
  },
  $I.annote("GroupSplitPlacement", {
    description: "Relocates an existing group beside a reference group using a new split.",
  })
) {}

/**
 * Placement that relocates a group against the workspace root.
 *
 * **Example** (Relocate group to root)
 *
 * ```ts
 * import { GroupRootSplitPlacement, SplitId } from "@beep/dock"
 *
 * const placement = GroupRootSplitPlacement.make({ splitId: SplitId.make("split-one"), side: "top" })
 * console.log(placement.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroupRootSplitPlacement extends S.Class<GroupRootSplitPlacement>($I`GroupRootSplitPlacement`)(
  {
    kind: S.tag("groupRootSplit"),
    side: DockSide,
    splitId: SplitId,
    newGroupRatio: SplitRatio.pipe(SchemaUtils.withConstantDefault<number>(5_000)),
  },
  $I.annote("GroupRootSplitPlacement", {
    description: "Relocates an existing group against one semantic edge of the workspace root.",
  })
) {}

const DockPlacementKind = LiteralKit(["root", "tab", "split", "rootSplit"]);

/**
 * Tagged codec for all panel-opening destinations.
 *
 * **Example** (Make panel destination)
 *
 * ```ts
 * import { DockPlacement, GroupId } from "@beep/dock"
 *
 * const placement = DockPlacement.make({ kind: "root", groupId: GroupId.make("group-one") })
 * console.log(placement.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockPlacement = DockPlacementKind.mapMembers(
  Tuple.evolve([() => RootPlacement, () => TabPlacement, () => SplitPlacement, () => RootSplitPlacement])
)
  .annotate(
    $I.annote("DockPlacement", {
      description: "Semantic panel placement independent from DOM coordinates.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
/**
 * Decoded panel-opening destination.
 *
 * **Example** (Type panel destination)
 *
 * ```ts
 * import { DockPlacement, GroupId, RootPlacement } from "@beep/dock"
 *
 * const placement: DockPlacement = RootPlacement.make({ groupId: GroupId.make("group-one") })
 * console.log(placement.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockPlacement = typeof DockPlacement.Type;

/**
 * Tagged codec for destinations of an existing panel.
 *
 * **Example** (Make panel move target)
 *
 * ```ts
 * import { DockMoveTarget, GroupId, TabPlacement } from "@beep/dock"
 *
 * const target = TabPlacement.make({ groupId: GroupId.make("group-one") })
 * console.log(target.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockMoveTarget = S.Union([TabPlacement, SplitPlacement, RootSplitPlacement]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DockMoveTarget", {
    description: "Moves a panel into tabs or docks it beside an existing group.",
  })
);
/**
 * Decoded destination for moving an existing panel.
 *
 * **Example** (Type panel move target)
 *
 * ```ts
 * import { DockMoveTarget, GroupId, TabPlacement } from "@beep/dock"
 *
 * const target: DockMoveTarget = TabPlacement.make({ groupId: GroupId.make("group-one") })
 * console.log(target.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockMoveTarget = typeof DockMoveTarget.Type;

/**
 * Tagged codec for whole-group merge and relocation destinations.
 *
 * **Example** (Make group move target)
 *
 * ```ts
 * import { DockGroupMoveTarget, GroupId, TabPlacement } from "@beep/dock"
 *
 * const target = TabPlacement.make({ groupId: GroupId.make("group-one") })
 * console.log(target.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockGroupMoveTarget = S.Union([TabPlacement, GroupSplitPlacement, GroupRootSplitPlacement]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DockGroupMoveTarget", {
    description: "Merges a group into tabs or relocates it without unused new-group identifiers.",
  })
);
/**
 * Decoded destination for moving a whole group.
 *
 * **Example** (Type group move target)
 *
 * ```ts
 * import { DockGroupMoveTarget, GroupId, TabPlacement } from "@beep/dock"
 *
 * const target: DockGroupMoveTarget = TabPlacement.make({ groupId: GroupId.make("group-one") })
 * console.log(target.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockGroupMoveTarget = typeof DockGroupMoveTarget.Type;

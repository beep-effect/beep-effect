/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { Effect, flow, HashSet, Number as N, pipe, Tuple } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AnchoredBox } from "./AnchoredBox.ts";
import { GroupId, PanelId, RendererKey, SplitId, SplitRatio } from "./Dock.ids.ts";
import { DockSide } from "./Dock.placement.ts";
import type { SplitPlacement, TabPlacement } from "./Dock.placement.ts";
import type { Dual2, Dual3 } from "./internal/Dual.ts";

const $I = $DockId.create("Dock.models-tree");

type Dual4<Self, First, Second, Third, Result> = {
  (self: Self, first: First, second: Second, third: Third): Result;
  (first: First, second: Second, third: Third): (self: Self) => Result;
};

const PanelViewKind = LiteralKit(["component", "text"]);

/**
 * Persistence policy for rendering inactive panels.
 *
 * @example
 * ```ts
 * import { PanelRenderMode } from "@beep/dock"
 *
 * const mode = PanelRenderMode.make("always")
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PanelRenderMode = LiteralKit(["onlyWhenVisible", "always"]).annotate(
  $I.annote("PanelRenderMode", {
    description: "Serializable host rendering policy for inactive panel content.",
  })
);
/**
 * Decoded inactive-panel rendering policy.
 *
 * @example
 * ```ts
 * import { PanelRenderMode } from "@beep/dock"
 *
 * const mode: PanelRenderMode = PanelRenderMode.make("onlyWhenVisible")
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PanelRenderMode = typeof PanelRenderMode.Type;

/**
 * Codec for JSON-safe renderer parameter scalars.
 *
 * @example
 * ```ts
 * import { PanelParameterValue } from "@beep/dock"
 *
 * const value = PanelParameterValue.make("dark")
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PanelParameterValue = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("PanelParameterValue", {
    description: "A JSON-safe scalar accepted by renderer-neutral panel parameters.",
  })
);
/**
 * Decoded renderer parameter scalar.
 *
 * @example
 * ```ts
 * import { PanelParameterValue } from "@beep/dock"
 *
 * const value: PanelParameterValue = PanelParameterValue.make(true)
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PanelParameterValue = typeof PanelParameterValue.Type;

/**
 * Codec for renderer-neutral panel parameter records.
 *
 * @example
 * ```ts
 * import { PanelParameters } from "@beep/dock"
 *
 * const input = PanelParameters.make({ theme: "dark", compact: true })
 * console.log(input.theme)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PanelParameters = S.Record(S.String, PanelParameterValue).pipe(
  $I.annoteSchema("PanelParameters", {
    description: "Serializable renderer parameters keyed by host-defined names.",
  })
);
/**
 * Decoded renderer parameter record.
 *
 * @example
 * ```ts
 * import { PanelParameters } from "@beep/dock"
 *
 * const input: PanelParameters = PanelParameters.make({ count: 3 })
 * console.log(input.count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PanelParameters = typeof PanelParameters.Type;

/**
 * Renderer-backed panel content resolved by a host registry.
 *
 * @example
 * ```ts
 * import { ComponentPanelView, RendererKey } from "@beep/dock"
 *
 * const view = ComponentPanelView.make({ renderer: RendererKey.make("markdown"), input: { source: "# Title" } })
 * console.log(view.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ComponentPanelView extends S.Class<ComponentPanelView>($I`ComponentPanelView`)(
  {
    kind: S.tag("component"),
    renderer: S.toType(RendererKey),
    input: PanelParameters.pipe(SchemaUtils.withConstantDefault<PanelParameters>({})),
  },
  $I.annote("ComponentPanelView", {
    description: "Panel content resolved by a host renderer registry.",
  })
) {}

/**
 * Serializable renderer-independent text panel content.
 *
 * @example
 * ```ts
 * import { TextPanelView } from "@beep/dock"
 *
 * const view = TextPanelView.make({ text: "one" })
 * console.log(view.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextPanelView extends S.Class<TextPanelView>($I`TextPanelView`)(
  {
    kind: S.tag("text"),
    text: S.String,
  },
  $I.annote("TextPanelView", {
    description: "Renderer-independent text panel content.",
  })
) {}

/**
 * Tagged codec for every renderer-neutral panel view.
 *
 * @example
 * ```ts
 * import { PanelView } from "@beep/dock"
 *
 * const view = PanelView.make({ kind: "text", text: "one" })
 * console.log(view.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PanelView = PanelViewKind.mapMembers(Tuple.evolve([() => ComponentPanelView, () => TextPanelView]))
  .annotate(
    $I.annote("PanelView", {
      description: "Discriminated panel content with no DOM or framework values.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
/**
 * Decoded renderer-neutral panel view.
 *
 * @example
 * ```ts
 * import { PanelView, TextPanelView } from "@beep/dock"
 *
 * const view: PanelView = TextPanelView.make({ text: "one" })
 * console.log(view.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PanelView = typeof PanelView.Type;

const PositiveFiniteExtent = S.Finite.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("PositiveFiniteExtent", {
    description: "A positive finite panel size constraint in host pixels.",
  })
);

/**
 * Optional minimum and maximum pixel extents for one panel.
 *
 * @remarks A missing facet leaves that axis bound unconstrained. When a
 * minimum exceeds a maximum, geometry gives the minimum precedence.
 *
 * @example
 * ```ts
 * import { PanelConstraints } from "@beep/dock"
 * import * as O from "effect/Option"
 *
 * const constraints = PanelConstraints.make({ minWidth: O.some(240), maxHeight: O.some(720) })
 * console.log(constraints.minWidth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PanelConstraints extends S.Class<PanelConstraints>($I`PanelConstraints`)(
  {
    minWidth: PositiveFiniteExtent.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    minHeight: PositiveFiniteExtent.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    maxWidth: PositiveFiniteExtent.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    maxHeight: PositiveFiniteExtent.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PanelConstraints", {
    description: "Optional positive finite minimum and maximum pixel extents for one panel.",
  })
) {}

/**
 * One persistable renderer-neutral panel instance.
 *
 * @example
 * ```ts
 * import { Panel, PanelId, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * console.log(panel.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Panel extends S.Class<Panel>($I`Panel`)(
  {
    id: S.toType(PanelId),
    title: S.NonEmptyString,
    view: PanelView,
    renderMode: PanelRenderMode.pipe(SchemaUtils.withConstantDefault<PanelRenderMode>("onlyWhenVisible")),
    tabComponent: S.toType(RendererKey).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    constraints: PanelConstraints.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("Panel", {
    description: "A renderer-neutral panel owned directly by one tab group.",
  })
) {
  static readonly equals = SchemaUtils.toEquivalence(Panel);
  static readonly findInNode: Dual2<DockNode.Type, PanelId, O.Option<Panel>> = dual(
    2,
    (node: DockNode.Type, panelId: PanelId): O.Option<Panel> =>
      pipe(
        DockNode.panels(node),
        A.findFirst((panel) => PanelId.equals(panel.id, panelId))
      )
  );

  static readonly findInTabs: Dual2<TabsNode, PanelId, O.Option<Panel>> = dual(
    2,
    (tabs: TabsNode, panelId: PanelId): O.Option<Panel> =>
      pipe(
        TabsNode.panels(tabs),
        A.findFirst((panel) => PanelId.equals(panel.id, panelId))
      )
  );

  static readonly is = S.is(Panel);
}

/**
 * Optional replacements accepted by a panel update.
 *
 * @example
 * ```ts
 * import { PanelPatch } from "@beep/dock"
 * import * as O from "effect/Option"
 *
 * const patch = PanelPatch.make({ title: O.some("Renamed") })
 * console.log(patch.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PanelPatch extends S.Class<PanelPatch>($I`PanelPatch`)(
  {
    title: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    view: S.OptionFromOptionalKey(PanelView).pipe(SchemaUtils.withNoneDefault),
    renderMode: S.OptionFromOptionalKey(PanelRenderMode).pipe(SchemaUtils.withNoneDefault),
    tabComponent: S.toType(RendererKey).pipe(S.Option, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    constraints: PanelConstraints.pipe(S.Option, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PanelPatch", {
    description: "Optional whole-value replacements for persistable panel facets.",
  })
) {}

/**
 * Persisted locking policy for a tab group.
 *
 * @example
 * ```ts
 * import { GroupLockedMode } from "@beep/dock"
 *
 * const mode = GroupLockedMode.make("locked")
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GroupLockedMode = LiteralKit(["unlocked", "locked", "no-drop-target"]).annotate(
  $I.annote("GroupLockedMode", { description: "Persisted group locking policy data." })
);
/**
 * Decoded tab-group locking policy.
 *
 * @example
 * ```ts
 * import { GroupLockedMode } from "@beep/dock"
 *
 * const mode: GroupLockedMode = GroupLockedMode.make("no-drop-target")
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GroupLockedMode = typeof GroupLockedMode.Type;

/**
 * Persisted edge used to render a tab-group header.
 *
 * @example
 * ```ts
 * import { GroupHeaderPosition } from "@beep/dock"
 *
 * const position = GroupHeaderPosition.make("bottom")
 * console.log(position)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GroupHeaderPosition = LiteralKit(["top", "bottom"]).annotate(
  $I.annote("GroupHeaderPosition", { description: "Persisted tab-group header edge." })
);
/**
 * Decoded tab-group header edge.
 *
 * @example
 * ```ts
 * import { GroupHeaderPosition } from "@beep/dock"
 *
 * const position: GroupHeaderPosition = GroupHeaderPosition.make("top")
 * console.log(position)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GroupHeaderPosition = typeof GroupHeaderPosition.Type;

/**
 * Persistable visibility, locking, and header metadata for a tab group.
 *
 * @example
 * ```ts
 * import { GroupMetadata } from "@beep/dock"
 *
 * const metadata = GroupMetadata.make({ locked: "locked", headerPosition: "bottom" })
 * console.log(metadata.visible)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroupMetadata extends S.Class<GroupMetadata>($I`GroupMetadata`)(
  {
    visible: S.Boolean.pipe(SchemaUtils.withConstantDefault<boolean>(true)),
    locked: GroupLockedMode.pipe(SchemaUtils.withConstantDefault<GroupLockedMode>("unlocked")),
    hideHeader: S.Boolean.pipe(SchemaUtils.withConstantDefault<boolean>(false)),
    headerPosition: GroupHeaderPosition.pipe(SchemaUtils.withConstantDefault<GroupHeaderPosition>("top")),
  },
  $I.annote("GroupMetadata", {
    description: "Serializable display and future policy metadata for one tab group.",
  })
) {
  static readonly equals = SchemaUtils.toEquivalence(GroupMetadata);
}

/**
 * Optional replacements accepted by a group update.
 *
 * @example
 * ```ts
 * import { GroupPatch } from "@beep/dock"
 * import * as O from "effect/Option"
 *
 * const patch = GroupPatch.make({ visible: O.some(false), locked: O.some("locked") })
 * console.log(patch.visible)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GroupPatch extends S.Class<GroupPatch>($I`GroupPatch`)(
  {
    visible: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    locked: S.OptionFromOptionalKey(GroupLockedMode).pipe(SchemaUtils.withNoneDefault),
    hideHeader: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    headerPosition: S.OptionFromOptionalKey(GroupHeaderPosition).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("GroupPatch", {
    description: "Optional whole-value replacements for persistable group metadata.",
  })
) {}

/**
 * A non-empty tab group represented as a zipper.
 *
 * The active panel is stored directly, so an invalid active-panel reference is
 * not representable.
 */

type SplitPosition = Pick<SplitPlacement, "side" | "splitId" | "newGroupRatio">;

/**
 * Non-empty tab zipper with the active panel stored structurally.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const tabs = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * console.log(TabsNode.panels(tabs).length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TabsNode extends S.TaggedClass<TabsNode>($I`TabsNode`)(
  "Tabs",
  {
    groupId: S.toType(GroupId),
    before: S.Array(Panel).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<Panel>>([])),
    active: Panel,
    after: S.Array(Panel).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<Panel>>([])),
    metadata: GroupMetadata.pipe(S.withConstructorDefault(Effect.succeed(GroupMetadata.make()))),
  },
  $I.annote("TabsNode", {
    description: "A non-empty ordered tab zipper with one structurally active panel.",
  })
) {
  /**
   * Constructs a tab zipper from an ordered non-empty panel collection.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromPanels: Dual4<GroupId, A.NonEmptyReadonlyArray<Panel>, PanelId, GroupMetadata, TabsNode> = dual(
    4,
    (
      groupId: GroupId,
      panels: A.NonEmptyReadonlyArray<Panel>,
      activePanelId: PanelId,
      metadata: GroupMetadata
    ): TabsNode => {
      const [before, activeAndAfter] = A.splitWhere(panels, (panel) => PanelId.equals(panel.id, activePanelId));
      return A.match(activeAndAfter, {
        onEmpty: () =>
          TabsNode.make({ groupId, active: A.headNonEmpty(panels), after: A.tailNonEmpty(panels), metadata }),
        onNonEmpty: (active) =>
          TabsNode.make({ groupId, before, active: A.headNonEmpty(active), after: A.tailNonEmpty(active), metadata }),
      });
    }
  );

  static readonly insert: Dual3<TabsNode, Panel, TabPlacement, TabsNode> = dual(
    3,
    (tabs: TabsNode, panel: Panel, placement: TabPlacement): TabsNode => {
      const panels = TabsNode.panels(tabs);
      const index = O.getOrElse(placement.index, () => A.length(panels));
      const inserted = O.getOrThrow(
        A.insertAt(panels, N.clamp(index, { minimum: 0, maximum: A.length(panels) }), panel)
      ); // crispen: total after clamp; use a total Effect Array insert when available.
      const activePanelId = Bool.match(placement.activate, {
        onTrue: () => panel.id,
        onFalse: () => tabs.active.id,
      });
      return TabsNode.fromPanels(tabs.groupId, inserted, activePanelId, tabs.metadata);
    }
  );

  static readonly activate: Dual2<TabsNode, PanelId, O.Option<TabsNode>> = dual(
    2,
    (tabs: TabsNode, panelId: PanelId): O.Option<TabsNode> => {
      const [before, fromMatch] = A.splitWhere(TabsNode.panels(tabs), (panel) => PanelId.equals(panel.id, panelId));
      return A.match(fromMatch, {
        onEmpty: O.none,
        onNonEmpty: (activeAndAfter) =>
          O.some(
            TabsNode.make({
              groupId: tabs.groupId,
              before,
              active: A.headNonEmpty(activeAndAfter),
              after: A.tailNonEmpty(activeAndAfter),
              metadata: tabs.metadata,
            })
          ),
      });
    }
  );

  static readonly append: Dual2<TabsNode, Panel, TabsNode> = dual(
    2,
    (tabs: TabsNode, panel: Panel): TabsNode =>
      TabsNode.make({
        groupId: tabs.groupId,
        before: TabsNode.panels(tabs),
        active: panel,
        metadata: tabs.metadata,
      })
  );

  static readonly findForPanel: Dual2<DockNode.Type, PanelId, O.Option<TabsNode>> = dual(
    2,
    (node: DockNode.Type, panelId: PanelId): O.Option<TabsNode> =>
      pipe(
        DockNode.tabs(node),
        A.findFirst((tabs) => O.isSome(Panel.findInTabs(tabs, panelId)))
      )
  );

  static readonly is = S.is(TabsNode);

  static readonly panels = (tabs: TabsNode): A.NonEmptyReadonlyArray<Panel> =>
    pipe(tabs.before, A.append(tabs.active), A.appendAll(tabs.after));

  static readonly remove: Dual2<TabsNode, PanelId, O.Option<TabsNode>> = dual(
    2,
    (tabs: TabsNode, panelId: PanelId): O.Option<TabsNode> =>
      Bool.match(PanelId.equals(tabs.active.id, panelId), {
        onTrue: () =>
          A.match(tabs.after, {
            onNonEmpty: (after) =>
              O.some(
                TabsNode.make({
                  groupId: tabs.groupId,
                  before: tabs.before,
                  active: A.headNonEmpty(after),
                  after: A.tailNonEmpty(after),
                  metadata: tabs.metadata,
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
                      metadata: tabs.metadata,
                    })
                  ),
              }),
          }),
        onFalse: () =>
          O.some(
            TabsNode.make({
              groupId: tabs.groupId,
              before: A.filter(tabs.before, (panel) => Bool.not(PanelId.equals(panel.id, panelId))),
              active: tabs.active,
              after: A.filter(tabs.after, (panel) => Bool.not(PanelId.equals(panel.id, panelId))),
              metadata: tabs.metadata,
            })
          ),
      })
  );
}

const DockNodeRef = S.suspend((): S.Codec<DockNode.Type, DockNode.Encoded> => DockNode);
const DefaultSplitRatio = S.toType(SplitRatio).pipe(SchemaUtils.withConstantDefault<number>(5_000));

/**
 * Horizontal binary layout with semantic left and right children.
 *
 * @example
 * ```ts
 * import { GroupId, HorizontalSplitLayout, Panel, PanelId, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const tabs = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const layout = HorizontalSplitLayout.make({ left: tabs, right: tabs })
 * console.log(layout.axis)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HorizontalSplitLayout extends S.Class<HorizontalSplitLayout>($I`HorizontalSplitLayout`)(
  {
    axis: S.tag("horizontal"),
    leftRatio: DefaultSplitRatio,
    left: DockNodeRef,
    right: DockNodeRef,
  },
  $I.annote("HorizontalSplitLayout", {
    description: "Horizontal split geometry whose ratio describes the left child share.",
  })
) {}

/**
 * Vertical binary layout with semantic top and bottom children.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, TabsNode, TextPanelView, VerticalSplitLayout } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const tabs = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const layout = VerticalSplitLayout.make({ top: tabs, bottom: tabs })
 * console.log(layout.axis)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerticalSplitLayout extends S.Class<VerticalSplitLayout>($I`VerticalSplitLayout`)(
  {
    axis: S.tag("vertical"),
    topRatio: DefaultSplitRatio,
    top: DockNodeRef,
    bottom: DockNodeRef,
  },
  $I.annote("VerticalSplitLayout", {
    description: "Vertical split geometry whose ratio describes the top child share.",
  })
) {}

type SplitLayoutShape = HorizontalSplitLayout | VerticalSplitLayout;

/**
 * Tagged codec for horizontal and vertical binary layouts.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, SplitLayout, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const tabs = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const layout = SplitLayout.cases.horizontal.make({ left: tabs, right: tabs })
 * console.log(SplitLayout.ratio(layout))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SplitLayout = S.Union([HorizontalSplitLayout, VerticalSplitLayout]).pipe(
  S.toTaggedUnion("axis"),
  $I.annoteSchema("SplitLayout", {
    description: "Axis-specific split geometry with semantic child and leading-ratio names.",
  }),
  SchemaUtils.withStatics((schema) => {
    const children = (layout: SplitLayoutShape): readonly [DockNodeShape, DockNodeShape] =>
      schema.match(layout, {
        horizontal: ({ left, right }): readonly [DockNodeShape, DockNodeShape] => [left, right],
        vertical: ({ top, bottom }): readonly [DockNodeShape, DockNodeShape] => [top, bottom],
      });

    const mapChildren: Dual2<SplitLayoutShape, (node: DockNodeShape) => DockNodeShape, SplitLayoutShape> = dual(
      2,
      (layout: SplitLayoutShape, f: (node: DockNodeShape) => DockNodeShape): SplitLayoutShape =>
        schema.match(layout, {
          horizontal: ({ left, leftRatio, right }) =>
            HorizontalSplitLayout.make({ leftRatio, left: f(left), right: f(right) }),
          vertical: ({ bottom, top, topRatio }) =>
            VerticalSplitLayout.make({ topRatio, top: f(top), bottom: f(bottom) }),
        })
    );

    const ratio = (layout: SplitLayoutShape): SplitRatio =>
      schema.match(layout, {
        horizontal: ({ leftRatio }) => leftRatio,
        vertical: ({ topRatio }) => topRatio,
      });

    const withChildren: Dual3<SplitLayoutShape, DockNodeShape, DockNodeShape, SplitLayoutShape> = dual(
      3,
      (layout: SplitLayoutShape, first: DockNodeShape, second: DockNodeShape): SplitLayoutShape =>
        schema.match(layout, {
          horizontal: ({ leftRatio }) => HorizontalSplitLayout.make({ leftRatio, left: first, right: second }),
          vertical: ({ topRatio }) => VerticalSplitLayout.make({ topRatio, top: first, bottom: second }),
        })
    );

    const withRatio: Dual2<SplitLayoutShape, SplitRatio, SplitLayoutShape> = dual(
      2,
      (layout: SplitLayoutShape, nextRatio: SplitRatio): SplitLayoutShape =>
        schema.match(layout, {
          horizontal: ({ left, right }) => HorizontalSplitLayout.make({ leftRatio: nextRatio, left, right }),
          vertical: ({ bottom, top }) => VerticalSplitLayout.make({ topRatio: nextRatio, top, bottom }),
        })
    );

    return { children, mapChildren, ratio, withChildren, withRatio };
  })
);
/**
 * Decoded axis-specific binary layout.
 *
 * @example
 * ```ts
 * import { GroupId, HorizontalSplitLayout, Panel, PanelId, SplitLayout, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const tabs = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const layout: SplitLayout = HorizontalSplitLayout.make({ left: tabs, right: tabs })
 * console.log(layout.axis)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SplitLayout = typeof SplitLayout.Type;

/**
 * Recursive binary split node with exactly two children.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, SplitId, SplitLayout, SplitNode, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const tabs = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const split = SplitNode.make({ splitId: SplitId.make("split-one"), layout: SplitLayout.cases.horizontal.make({ left: tabs, right: tabs }) })
 * console.log(split._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SplitNode extends S.TaggedClass<SplitNode>($I`SplitNode`)(
  "Split",
  {
    splitId: S.toType(SplitId),
    layout: SplitLayout,
  },
  $I.annote("SplitNode", {
    description: "A recursive binary split with axis-specific geometry and exactly two children.",
  })
) {
  static readonly fromNodes: Dual3<DockNode.Type, DockNode.Type, SplitPosition, SplitNode> = dual(
    3,
    (reference: DockNode.Type, inserted: DockNode.Type, placement: SplitPosition): SplitNode =>
      DockSide.$match(placement.side, {
        left: () =>
          SplitNode.make({
            splitId: placement.splitId,
            layout: HorizontalSplitLayout.make({
              leftRatio: placement.newGroupRatio,
              left: inserted,
              right: reference,
            }),
          }),
        right: () =>
          SplitNode.make({
            splitId: placement.splitId,
            layout: HorizontalSplitLayout.make({
              leftRatio: SplitRatio.complement(placement.newGroupRatio),
              left: reference,
              right: inserted,
            }),
          }),
        top: () =>
          SplitNode.make({
            splitId: placement.splitId,
            layout: VerticalSplitLayout.make({ topRatio: placement.newGroupRatio, top: inserted, bottom: reference }),
          }),
        bottom: () =>
          SplitNode.make({
            splitId: placement.splitId,
            layout: VerticalSplitLayout.make({
              topRatio: SplitRatio.complement(placement.newGroupRatio),
              top: reference,
              bottom: inserted,
            }),
          }),
      })
  );

  static readonly fromPlacement: Dual3<TabsNode, Panel, SplitPlacement, SplitNode> = dual(
    3,
    (reference: TabsNode, panel: Panel, placement: SplitPlacement): SplitNode =>
      SplitNode.fromNodes(reference, TabsNode.make({ groupId: placement.newGroupId, active: panel }), placement)
  );

  static readonly is = S.is(SplitNode);

  static readonly withRatio: Dual2<SplitNode, SplitRatio, SplitNode> = dual(
    2,
    (split: SplitNode, ratio: SplitRatio): SplitNode =>
      SplitNode.make({
        splitId: split.splitId,
        layout: SplitLayout.withRatio(split.layout, ratio),
      })
  );
}

type DockNodeShape = TabsNode | SplitNode;

/** Recursive layout tree node. */
const DockNodeBase = S.Union([TabsNode, SplitNode])
  .annotate(
    $I.annote("DockNode", {
      description: "Recursive binary dock tree containing only non-empty leaves.",
    })
  )
  .pipe(S.toTaggedUnion("_tag"));

/**
 * Recursive codec for tabs and binary split tree nodes.
 *
 * @example
 * ```ts
 * import { DockNode, GroupId, Panel, PanelId, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const node = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * console.log(DockNode.panels(node).length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockNode = DockNodeBase.pipe(
  SchemaUtils.withStatics((schema) => {
    const tabs = (node: DockNodeShape): ReadonlyArray<TabsNode> =>
      schema.match(node, {
        Tabs: (tabsNode): ReadonlyArray<TabsNode> => A.of(tabsNode),
        Split: ({ layout }): ReadonlyArray<TabsNode> => {
          const [first, second] = SplitLayout.children(layout);
          return A.appendAll(tabs(first), tabs(second));
        },
      });

    const splits = (node: DockNodeShape): ReadonlyArray<SplitNode> =>
      schema.match(node, {
        Tabs: A.empty<SplitNode>,
        Split: (split): ReadonlyArray<SplitNode> => {
          const [first, second] = SplitLayout.children(split.layout);
          return pipe(A.of(split), A.appendAll(splits(first)), A.appendAll(splits(second)));
        },
      });

    const panels: (node: DockNodeShape) => ReadonlyArray<Panel> = flow(tabs, A.flatMap(TabsNode.panels));

    const findTabs: Dual2<DockNodeShape, GroupId, O.Option<TabsNode>> = dual(
      2,
      (node: DockNodeShape, groupId: GroupId): O.Option<TabsNode> =>
        pipe(
          tabs(node),
          A.findFirst((candidate) => GroupId.equals(candidate.groupId, groupId))
        )
    );

    const findSplit: Dual2<DockNodeShape, SplitId, O.Option<SplitNode>> = dual(
      2,
      (node: DockNodeShape, splitId: SplitId): O.Option<SplitNode> =>
        pipe(
          splits(node),
          A.findFirst((candidate) => SplitId.equals(candidate.splitId, splitId))
        )
    );

    const replaceAtGroup: Dual3<DockNodeShape, GroupId, DockNodeShape, DockNodeShape> = dual(
      3,
      (node: DockNodeShape, groupId: GroupId, replacement: DockNodeShape): DockNodeShape =>
        schema.match(node, {
          Tabs: (candidate) =>
            Bool.match(GroupId.equals(candidate.groupId, groupId), {
              onTrue: () => replacement,
              onFalse: () => candidate,
            }),
          Split: (split) =>
            SplitNode.make({
              splitId: split.splitId,
              layout: SplitLayout.mapChildren(split.layout, (child: DockNodeShape) =>
                replaceAtGroup(child, groupId, replacement)
              ),
            }),
        })
    );

    const replaceSplit: Dual2<DockNodeShape, SplitNode, DockNodeShape> = dual(
      2,
      (node: DockNodeShape, replacement: SplitNode): DockNodeShape =>
        schema.match(node, {
          Tabs: (tabsNode) => tabsNode,
          Split: (split) =>
            Bool.match(SplitId.equals(split.splitId, replacement.splitId), {
              onTrue: () => replacement,
              onFalse: () =>
                SplitNode.make({
                  splitId: split.splitId,
                  layout: SplitLayout.mapChildren(split.layout, (child: DockNodeShape) =>
                    replaceSplit(child, replacement)
                  ),
                }),
            }),
        })
    );

    const removeTabs: Dual2<DockNodeShape, GroupId, O.Option<DockNodeShape>> = dual(
      2,
      (node: DockNodeShape, groupId: GroupId): O.Option<DockNodeShape> =>
        schema.match(node, {
          Tabs: (candidate) =>
            Bool.match(GroupId.equals(candidate.groupId, groupId), {
              onTrue: O.none,
              onFalse: () => O.some(candidate),
            }),
          Split: (split) => {
            const [first, second] = SplitLayout.children(split.layout);
            return Bool.match(O.isSome(findTabs(first, groupId)), {
              onTrue: () =>
                O.match(removeTabs(first, groupId), {
                  onNone: () => O.some(second),
                  onSome: (nextFirst) =>
                    O.some(
                      SplitNode.make({
                        splitId: split.splitId,
                        layout: SplitLayout.withChildren(split.layout, nextFirst, second),
                      })
                    ),
                }),
              onFalse: () =>
                O.match(removeTabs(second, groupId), {
                  onNone: () => O.some(first),
                  onSome: (nextSecond) =>
                    O.some(
                      SplitNode.make({
                        splitId: split.splitId,
                        layout: SplitLayout.withChildren(split.layout, first, nextSecond),
                      })
                    ),
                }),
            });
          },
        })
    );

    return {
      equals: SchemaUtils.toEquivalence(schema),
      findSplit,
      findTabs,
      is: S.is(schema),
      panels,
      removeTabs,
      replaceAtGroup,
      replaceSplit,
      splits,
      tabs,
    };
  })
) satisfies S.Codec<DockNodeShape, DockNodeEncoded>;
/**
 * Decoded recursive dock tree node.
 *
 * @example
 * ```ts
 * import { DockNode, GroupId, Panel, PanelId, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const node: DockNode = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * console.log(node._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockNode = typeof DockNode.Type;

interface TabsNodeEncoded extends Omit<TabsNode, "before" | "active" | "after" | "metadata"> {
  readonly active: typeof Panel.Encoded;
  readonly after: ReadonlyArray<typeof Panel.Encoded>;
  readonly before: ReadonlyArray<typeof Panel.Encoded>;
  readonly metadata: typeof GroupMetadata.Encoded;
}

interface HorizontalSplitLayoutEncoded extends Omit<HorizontalSplitLayout, "left" | "right"> {
  readonly left: DockNodeEncoded;
  readonly right: DockNodeEncoded;
}

interface VerticalSplitLayoutEncoded extends Omit<VerticalSplitLayout, "top" | "bottom"> {
  readonly bottom: DockNodeEncoded;
  readonly top: DockNodeEncoded;
}

type SplitLayoutEncoded = HorizontalSplitLayoutEncoded | VerticalSplitLayoutEncoded;

interface SplitNodeEncoded extends Omit<SplitNode, "layout"> {
  readonly layout: SplitLayoutEncoded;
}

type DockNodeEncoded = TabsNodeEncoded | SplitNodeEncoded;

/**
 * Type helpers associated with the recursive dock-node codec.
 *
 * @example
 * ```ts
 * import { DockNode, GroupId, Panel, PanelId, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const node: DockNode.Type = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * console.log(node._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace DockNode {
  /**
   * Decoded type exposed by the dock-node namespace.
   *
   * @example
   * ```ts
   * import { DockNode, GroupId, Panel, PanelId, TabsNode, TextPanelView } from "@beep/dock"
   *
   * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
   * const node: DockNode.Type = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
   * console.log(node._tag)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = DockNodeShape;
  /**
   * Encoded recursive dock-node representation.
   *
   * @example
   * ```ts
   * import { DockNode, GroupId, Panel, PanelId, TabsNode, TextPanelView } from "@beep/dock"
   *
   * const encoded: DockNode.Encoded = {
   *   _tag: "Tabs",
   *   groupId: GroupId.make("group-one"),
   *   before: [],
   *   active: {
   *     id: PanelId.make("panel-one"),
   *     title: "Panel One",
   *     view: { kind: "text", text: "one" },
   *     renderMode: "onlyWhenVisible"
   *   },
   *   after: [],
   *   metadata: {
   *     visible: true,
   *     locked: "unlocked",
   *     hideHeader: false,
   *     headerPosition: "top"
   *   }
   * }
   * console.log(encoded._tag)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = DockNodeEncoded;
}

/**
 * One independently positioned floating dock subtree.
 *
 * @example
 * ```ts
 * import { FloatingMember, GroupId, Panel, PanelId, TabsNode, TextPanelView, TopLeftAnchoredBox } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const root = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const member = FloatingMember.make({ anchoredBox: TopLeftAnchoredBox.make({ left: 20, top: 12, width: 640, height: 480 }), root })
 * console.log(member.root._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FloatingMember extends S.Class<FloatingMember>($I`FloatingMember`)(
  { anchoredBox: AnchoredBox, root: DockNode },
  $I.annote("FloatingMember", { description: "A floating dock subtree and its anchored container geometry." })
) {}

/**
 * Workspace state without a docked root node.
 *
 * @example
 * ```ts
 * import { EmptyWorkspace } from "@beep/dock"
 *
 * const workspace = EmptyWorkspace.make()
 * console.log(workspace.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmptyWorkspace extends S.Class<EmptyWorkspace>($I`EmptyWorkspace`)(
  {
    kind: S.tag("empty"),
    revision: NonNegativeInt.pipe(SchemaUtils.withConstantDefault<number>(0)),
    floating: S.Array(FloatingMember).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<FloatingMember>>([])),
  },
  $I.annote("EmptyWorkspace", {
    description: "A dock workspace with no docked tree; floating subtrees may still exist.",
  })
) {}

/**
 * Workspace state containing a non-empty dock tree.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const root = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const workspace = PopulatedWorkspace.make({ root })
 * console.log(workspace.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PopulatedWorkspace extends S.Class<PopulatedWorkspace>($I`PopulatedWorkspace`)(
  {
    kind: S.tag("populated"),
    revision: NonNegativeInt.pipe(SchemaUtils.withConstantDefault<number>(0)),
    root: DockNode,
    maximized: S.toType(GroupId).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    floating: S.Array(FloatingMember).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<FloatingMember>>([])),
  },
  $I.annote("PopulatedWorkspace", {
    description: "A dock workspace containing a non-empty binary layout tree.",
  })
) {}

const DockWorkspaceKind = LiteralKit(["empty", "populated"]);

const DockWorkspaceBase = DockWorkspaceKind.mapMembers(
  Tuple.evolve([() => EmptyWorkspace, () => PopulatedWorkspace])
).pipe(S.toTaggedUnion("kind"));
type DockWorkspaceShape = typeof DockWorkspaceBase.Type;

const idsAreUnique = (ids: ReadonlyArray<string>): boolean =>
  Eq.equals(HashSet.size(HashSet.fromIterable(ids)), A.length(ids));

const DockWorkspaceGlobalIdentityCheck = S.makeFilter<typeof DockWorkspaceBase.Type>(
  (workspace) =>
    DockWorkspaceBase.match(workspace, {
      empty: ({ floating }) => {
        const roots = A.map(floating, (member) => member.root);
        return Bool.and(
          idsAreUnique(A.flatMap(roots, (root) => A.map(DockNode.panels(root), (panel) => panel.id))),
          Bool.and(
            idsAreUnique(A.flatMap(roots, (root) => A.map(DockNode.tabs(root), (tabs) => tabs.groupId))),
            idsAreUnique(A.flatMap(roots, (root) => A.map(DockNode.splits(root), (split) => split.splitId)))
          )
        );
      },
      populated: ({ floating, maximized, root }) => {
        const roots = A.prepend(
          A.map(floating, (member) => member.root),
          root
        );
        const panelIds = A.flatMap(roots, (candidate) => A.map(DockNode.panels(candidate), (panel) => panel.id));
        const groupIds = A.flatMap(roots, (candidate) => A.map(DockNode.tabs(candidate), (tabs) => tabs.groupId));
        const splitIds = A.flatMap(roots, (candidate) => A.map(DockNode.splits(candidate), (split) => split.splitId));
        const maximizedIsValid = O.match(maximized, {
          onNone: () => true,
          onSome: (groupId) =>
            pipe(
              DockNode.findTabs(root, groupId),
              O.exists((tabs) => tabs.metadata.visible)
            ),
        });
        return Bool.and(
          maximizedIsValid,
          Bool.and(idsAreUnique(panelIds), Bool.and(idsAreUnique(groupIds), idsAreUnique(splitIds)))
        );
      },
    }),
  {
    identifier: $I`DockWorkspaceGlobalIdentityCheck`,
    title: "Dock workspace global identity",
    description: "Identifiers must be globally unique and a maximized group must exist and be visible.",
    message: "Expected globally unique panel, group, and split identifiers and an existing visible maximized group.",
  }
);

/**
 * Validated codec for complete empty or populated dock state.
 *
 * @example
 * ```ts
 * import { DockWorkspace } from "@beep/dock"
 *
 * const workspace = DockWorkspace.empty
 * console.log(DockWorkspace.groupCount(workspace))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DockWorkspace = DockWorkspaceBase.pipe(
  S.check(DockWorkspaceGlobalIdentityCheck),
  $I.annoteSchema("DockWorkspace", {
    description: "Complete dock state discriminated between empty and populated layouts.",
  }),
  SchemaUtils.withStatics((schema) => {
    const asPopulated = O.liftPredicate(DockWorkspaceBase.guards.populated);
    const empty: DockWorkspaceShape = EmptyWorkspace.make();

    const roots = (workspace: DockWorkspaceShape): ReadonlyArray<DockNodeShape> =>
      DockWorkspaceBase.match(workspace, {
        empty: ({ floating }) => A.map(floating, (member) => member.root),
        populated: ({ floating, root }) =>
          A.prepend(
            A.map(floating, (member) => member.root),
            root
          ),
      });
    const floatingMembers = (workspace: DockWorkspaceShape): ReadonlyArray<FloatingMember> =>
      DockWorkspaceBase.match(workspace, { empty: ({ floating }) => floating, populated: ({ floating }) => floating });

    const findPanel: Dual2<DockWorkspaceShape, PanelId, O.Option<Panel>> = dual(
      2,
      (workspace: DockWorkspaceShape, panelId: PanelId): O.Option<Panel> =>
        pipe(
          roots(workspace),
          A.findFirst((root) => O.isSome(Panel.findInNode(root, panelId))),
          O.flatMap((root) => Panel.findInNode(root, panelId))
        )
    );

    const findActivePanel: Dual2<DockWorkspaceShape, GroupId, O.Option<Panel>> = dual(
      2,
      (workspace: DockWorkspaceShape, groupId: GroupId): O.Option<Panel> =>
        pipe(
          findTabs(workspace, groupId),
          O.map((tabs) => tabs.active)
        )
    );

    const findTabs: Dual2<DockWorkspaceShape, GroupId, O.Option<TabsNode>> = dual(
      2,
      (workspace: DockWorkspaceShape, groupId: GroupId): O.Option<TabsNode> =>
        pipe(
          roots(workspace),
          A.findFirst((root) => O.isSome(DockNode.findTabs(root, groupId))),
          O.flatMap((root) => DockNode.findTabs(root, groupId))
        )
    );

    const findSplit: Dual2<DockWorkspaceShape, SplitId, O.Option<SplitNode>> = dual(2, (workspace, splitId) =>
      pipe(
        roots(workspace),
        A.findFirst((root) => O.isSome(DockNode.findSplit(root, splitId))),
        O.flatMap((root) => DockNode.findSplit(root, splitId))
      )
    );
    const findTabsForPanel: Dual2<DockWorkspaceShape, PanelId, O.Option<TabsNode>> = dual(2, (workspace, panelId) =>
      pipe(
        roots(workspace),
        A.findFirst((root) => O.isSome(TabsNode.findForPanel(root, panelId))),
        O.flatMap((root) => TabsNode.findForPanel(root, panelId))
      )
    );
    const isFloatingGroup: Dual2<DockWorkspaceShape, GroupId, boolean> = dual(2, (workspace, groupId) =>
      A.some(floatingMembers(workspace), (member) => O.isSome(DockNode.findTabs(member.root, groupId)))
    );

    const replaceAtGroup: Dual3<DockWorkspaceShape, GroupId, DockNodeShape, DockWorkspaceShape> = dual(
      3,
      (workspace, groupId, replacement) => {
        const floating = A.map(floatingMembers(workspace), (member) =>
          FloatingMember.make({
            anchoredBox: member.anchoredBox,
            root: DockNode.replaceAtGroup(member.root, groupId, replacement),
          })
        );
        return DockWorkspaceBase.match(workspace, {
          empty: ({ revision }) => EmptyWorkspace.make({ revision, floating }),
          populated: ({ revision, root, maximized }) =>
            PopulatedWorkspace.make({
              revision,
              root: DockNode.replaceAtGroup(root, groupId, replacement),
              maximized,
              floating,
            }),
        });
      }
    );

    const replaceSplit: Dual2<DockWorkspaceShape, SplitNode, DockWorkspaceShape> = dual(2, (workspace, replacement) => {
      const floating = A.map(floatingMembers(workspace), (member) =>
        FloatingMember.make({ anchoredBox: member.anchoredBox, root: DockNode.replaceSplit(member.root, replacement) })
      );
      return DockWorkspaceBase.match(workspace, {
        empty: ({ revision }) => EmptyWorkspace.make({ revision, floating }),
        populated: ({ revision, root, maximized }) =>
          PopulatedWorkspace.make({ revision, root: DockNode.replaceSplit(root, replacement), maximized, floating }),
      });
    });
    const removeTabs: Dual2<DockWorkspaceShape, GroupId, DockWorkspaceShape> = dual(2, (workspace, groupId) => {
      const floating = A.flatMap(floatingMembers(workspace), (member) =>
        pipe(
          DockNode.findTabs(member.root, groupId),
          O.map(() =>
            pipe(
              // fallow-ignore-next-line code-duplication -- floating-group removal rebuilds its tree while preserving its box
              DockNode.removeTabs(member.root, groupId),
              O.map((root) => A.of(FloatingMember.make({ anchoredBox: member.anchoredBox, root }))),
              O.getOrElse(A.empty)
            )
          ),
          O.getOrElse(() => A.of(member))
        )
      );
      return DockWorkspaceBase.match(workspace, {
        empty: ({ revision }) => EmptyWorkspace.make({ revision, floating }),
        populated: ({ revision, root, maximized }) =>
          pipe(
            DockNode.findTabs(root, groupId),
            O.map(() =>
              pipe(
                DockNode.removeTabs(root, groupId),
                O.map((nextRoot) =>
                  PopulatedWorkspace.make({
                    revision,
                    root: nextRoot,
                    maximized: O.filter(maximized, (id) => !GroupId.equals(id, groupId)),
                    floating,
                  })
                ),
                O.getOrElse(() => EmptyWorkspace.make({ revision, floating }))
              )
            ),
            O.getOrElse(() => PopulatedWorkspace.make({ revision, root, maximized, floating }))
          ),
      });
    });

    const hasSameContent: Dual2<DockWorkspaceShape, DockWorkspaceShape, boolean> = dual(
      2,
      (left: DockWorkspaceShape, right: DockWorkspaceShape): boolean =>
        DockWorkspaceBase.match(left, {
          empty: ({ floating }) => DockWorkspaceBase.guards.empty(right) && Eq.equals(floating, right.floating),
          populated: ({ floating, maximized, root }) =>
            pipe(
              right,
              asPopulated,
              O.exists((candidate) =>
                Bool.and(
                  DockNode.equals(root, candidate.root),
                  Bool.and(Eq.equals(floating, candidate.floating), Eq.equals(maximized, candidate.maximized))
                )
              )
            ),
        })
    );

    const withRevision: Dual2<DockWorkspaceShape, NonNegativeInt, DockWorkspaceShape> = dual(
      2,
      (workspace: DockWorkspaceShape, revision: NonNegativeInt): DockWorkspaceShape =>
        DockWorkspaceBase.match(workspace, {
          empty: ({ floating }) => EmptyWorkspace.make({ revision, floating }),
          populated: ({ floating, maximized, root }) =>
            PopulatedWorkspace.make({ revision, root, maximized, floating }),
        })
    );

    return {
      empty,
      equals: SchemaUtils.toEquivalence(schema),
      findActivePanel,
      findPanel,
      findSplit,
      findTabs,
      findTabsForPanel,
      floatingMembers,
      groupCount: (workspace: DockWorkspaceShape): number =>
        DockWorkspaceBase.match(workspace, {
          empty: ({ floating }) => A.length(A.flatMap(floating, (member) => DockNode.tabs(member.root))),
          populated: ({ floating, root }) =>
            A.length(DockNode.tabs(root)) + A.length(A.flatMap(floating, (member) => DockNode.tabs(member.root))),
        }),
      guards: DockWorkspaceBase.guards,
      hasSameContent,
      is: S.is(schema),
      match: DockWorkspaceBase.match,
      panels: (workspace: DockWorkspaceShape): ReadonlyArray<Panel> =>
        DockWorkspaceBase.match(workspace, {
          empty: ({ floating }): ReadonlyArray<Panel> => A.flatMap(floating, (member) => DockNode.panels(member.root)),
          populated: ({ floating, root }): ReadonlyArray<Panel> =>
            A.appendAll(
              DockNode.panels(root),
              A.flatMap(floating, (member) => DockNode.panels(member.root))
            ),
        }),
      replaceAtGroup,
      replaceSplit,
      removeTabs,
      roots,
      isFloatingGroup,
      withRevision,
    };
  })
);
/**
 * Decoded complete dock workspace state.
 *
 * @example
 * ```ts
 * import { DockWorkspace } from "@beep/dock"
 *
 * const workspace: DockWorkspace = DockWorkspace.empty
 * console.log(workspace.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DockWorkspace = typeof DockWorkspace.Type;

/**
 * Versioned persisted envelope for one complete dock workspace.
 *
 * @example
 * ```ts
 * import { DockSnapshot, DockWorkspace } from "@beep/dock"
 *
 * const snapshot = DockSnapshot.make({ workspace: DockWorkspace.empty })
 * console.log(snapshot.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockSnapshot extends S.Class<DockSnapshot>($I`DockSnapshot`)(
  {
    version: S.tag(1),
    workspace: DockWorkspace,
  },
  $I.annote("DockSnapshot", {
    description: "Version one persisted snapshot envelope containing one complete dock workspace.",
  })
) {}

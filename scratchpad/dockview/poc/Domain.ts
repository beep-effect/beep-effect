/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Effect, flow, pipe, Tuple } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AnchoredBox } from "./AnchoredBox.ts";

const $I = $ScratchpadId.create("dockview/poc/Domain");

type Dual2<Self, That, Result> = {
  (self: Self, that: That): Result;
  (that: That): (self: Self) => Result;
};

type Dual3<Self, First, Second, Result> = {
  (self: Self, first: First, second: Second): Result;
  (first: First, second: Second): (self: Self) => Result;
};

type Dual4<Self, First, Second, Third, Result> = {
  (self: Self, first: First, second: Second, third: Third): Result;
  (first: First, second: Second, third: Third): (self: Self) => Result;
};

/** Stable identity for a panel instance. */
export const PanelId = S.NonEmptyString.pipe(
  S.brand("DockPanelId"),
  $I.annoteSchema("PanelId", {
    description: "Stable identity for one panel instance in a dock workspace.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
export type PanelId = typeof PanelId.Type;

/** Stable identity for a tab group. */
export const GroupId = S.NonEmptyString.pipe(
  S.brand("DockGroupId"),
  $I.annoteSchema("GroupId", {
    description: "Stable identity for one non-empty tab group.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
export type GroupId = typeof GroupId.Type;

/** Stable identity for a binary split. */
export const SplitId = S.NonEmptyString.pipe(
  S.brand("DockSplitId"),
  $I.annoteSchema("SplitId", {
    description: "Stable identity for one binary layout split.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
export type SplitId = typeof SplitId.Type;

/** Stable identity for a top-level command. */
export const CommandId = S.NonEmptyString.pipe(
  S.brand("DockCommandId"),
  $I.annoteSchema("CommandId", {
    description: "Causal identity shared by a command and its emitted events.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
export type CommandId = typeof CommandId.Type;

/** Host registry key used to resolve a framework-specific panel renderer. */
export const RendererKey = S.NonEmptyString.pipe(
  S.brand("DockRendererKey"),
  $I.annoteSchema("RendererKey", {
    description: "Renderer-neutral key resolved by a host adapter outside dockview-core.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
export type RendererKey = typeof RendererKey.Type;

/** Relative share of one child in integer basis points. */
export const SplitRatio = S.Int.check(
  S.isBetween({
    minimum: 1_000,
    maximum: 9_000,
  })
).pipe(
  S.brand("DockSplitRatio"),
  $I.annoteSchema("SplitRatio", {
    description: "Exact child share in basis points, bounded from ten through ninety percent.",
  }),
  SchemaUtils.withStatics((schema) => ({
    complement: (ratio: typeof schema.Type) => schema.make(N.subtract(10_000, ratio)),
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
export type SplitRatio = typeof SplitRatio.Type;

const PanelViewKind = LiteralKit(["component", "text"]);

/** Persistence contract controlling whether an inactive panel remains rendered. */
export const PanelRenderMode = LiteralKit(["onlyWhenVisible", "always"]).annotate(
  $I.annote("PanelRenderMode", {
    description: "Serializable host rendering policy for inactive panel content.",
  })
);
export type PanelRenderMode = typeof PanelRenderMode.Type;

/** JSON-safe scalar accepted by the POC renderer parameter record. */
export const PanelParameterValue = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("PanelParameterValue", {
    description: "A JSON-safe scalar accepted by renderer-neutral panel parameters.",
  })
);
export type PanelParameterValue = typeof PanelParameterValue.Type;

/** Serializable parameters handed to a host renderer registry. */
export const PanelParameters = S.Record(S.String, PanelParameterValue).pipe(
  $I.annoteSchema("PanelParameters", {
    description: "Serializable renderer parameters keyed by host-defined names.",
  })
);
export type PanelParameters = typeof PanelParameters.Type;

/** Renderer-backed panel content that remains framework-neutral. */
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

/** Serializable text content used by tests and simple host adapters. */
export class TextPanelView extends S.Class<TextPanelView>($I`TextPanelView`)(
  {
    kind: S.tag("text"),
    text: S.String,
  },
  $I.annote("TextPanelView", {
    description: "Renderer-independent text panel content.",
  })
) {}

/** Renderer-neutral, serializable panel content. */
export const PanelView = PanelViewKind.mapMembers(Tuple.evolve([() => ComponentPanelView, () => TextPanelView]))
  .annotate(
    $I.annote("PanelView", {
      description: "Discriminated panel content with no DOM or framework values.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type PanelView = typeof PanelView.Type;

/** One persistable panel instance. */
export class Panel extends S.Class<Panel>($I`Panel`)(
  {
    id: S.toType(PanelId),
    title: S.NonEmptyString,
    view: PanelView,
    renderMode: PanelRenderMode.pipe(SchemaUtils.withConstantDefault<PanelRenderMode>("onlyWhenVisible")),
    tabComponent: S.toType(RendererKey).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
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

/** Optional whole-value replacements accepted by a panel update command. */
export class PanelPatch extends S.Class<PanelPatch>($I`PanelPatch`)(
  {
    title: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    view: S.OptionFromOptionalKey(PanelView).pipe(SchemaUtils.withNoneDefault),
    renderMode: S.OptionFromOptionalKey(PanelRenderMode).pipe(SchemaUtils.withNoneDefault),
    tabComponent: S.toType(RendererKey).pipe(S.Option, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PanelPatch", {
    description: "Optional whole-value replacements for persistable panel facets.",
  })
) {}

/** Persisted locking mode for a tab group. */
export const GroupLockedMode = LiteralKit(["unlocked", "locked", "no-drop-target"]).annotate(
  $I.annote("GroupLockedMode", { description: "Persisted group locking policy data." })
);
export type GroupLockedMode = typeof GroupLockedMode.Type;

/** Persisted edge on which a tab-group header is rendered. */
export const GroupHeaderPosition = LiteralKit(["top", "bottom"]).annotate(
  $I.annote("GroupHeaderPosition", { description: "Persisted tab-group header edge." })
);
export type GroupHeaderPosition = typeof GroupHeaderPosition.Type;

/** Persistable metadata attached to one tab group. */
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

/** Optional whole-value replacements accepted by a group update command. */
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

/** Horizontal split geometry with semantic left and right children. */
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

/** Vertical split geometry with semantic top and bottom children. */
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

/** Axis-specific geometry owned by one binary split. */
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
export type SplitLayout = typeof SplitLayout.Type;

/** Recursive binary split with model-owned topology operations. */
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
        Tabs: (): ReadonlyArray<SplitNode> => A.empty(),
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
export type DockNode = typeof DockNode.Type;

interface TabsNodeEncoded extends Omit<TabsNode, "before" | "active" | "after" | "metadata"> {
  readonly before: ReadonlyArray<typeof Panel.Encoded>;
  readonly active: typeof Panel.Encoded;
  readonly after: ReadonlyArray<typeof Panel.Encoded>;
  readonly metadata: typeof GroupMetadata.Encoded;
}

interface HorizontalSplitLayoutEncoded extends Omit<HorizontalSplitLayout, "left" | "right"> {
  readonly left: DockNodeEncoded;
  readonly right: DockNodeEncoded;
}

interface VerticalSplitLayoutEncoded extends Omit<VerticalSplitLayout, "top" | "bottom"> {
  readonly top: DockNodeEncoded;
  readonly bottom: DockNodeEncoded;
}

type SplitLayoutEncoded = HorizontalSplitLayoutEncoded | VerticalSplitLayoutEncoded;

interface SplitNodeEncoded extends Omit<SplitNode, "layout"> {
  readonly layout: SplitLayoutEncoded;
}

type DockNodeEncoded = TabsNodeEncoded | SplitNodeEncoded;

export declare namespace DockNode {
  export type Type = DockNodeShape;
  export type Encoded = DockNodeEncoded;
}

/** One independently positioned dock subtree; array order is back-to-front z-order. */
export class FloatingMember extends S.Class<FloatingMember>($I`FloatingMember`)(
  { anchoredBox: AnchoredBox, root: DockNode },
  $I.annote("FloatingMember", { description: "A floating dock subtree and its anchored container geometry." })
) {}

/** Workspace with no panels and therefore no root node. */
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

/** Workspace with one schema-valid root node. */
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

/** Complete serializable workspace state. */
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
        O.match(DockNode.findTabs(member.root, groupId), {
          onNone: () => A.of(member),
          onSome: () =>
            O.match(DockNode.removeTabs(member.root, groupId), {
              onNone: A.empty,
              onSome: (root) => A.of(FloatingMember.make({ anchoredBox: member.anchoredBox, root })),
            }),
        })
      );
      return DockWorkspaceBase.match(workspace, {
        empty: ({ revision }) => EmptyWorkspace.make({ revision, floating }),
        populated: ({ revision, root, maximized }) =>
          O.match(DockNode.findTabs(root, groupId), {
            onNone: () => PopulatedWorkspace.make({ revision, root, maximized, floating }),
            onSome: () =>
              O.match(DockNode.removeTabs(root, groupId), {
                onNone: () => EmptyWorkspace.make({ revision, floating }),
                onSome: (nextRoot) =>
                  PopulatedWorkspace.make({
                    revision,
                    root: nextRoot,
                    maximized: O.filter(maximized, (id) => !GroupId.equals(id, groupId)),
                    floating,
                  }),
              }),
          }),
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
export type DockWorkspace = typeof DockWorkspace.Type;

/** Migration-proof persisted snapshot containing one complete workspace. */
export class DockSnapshot extends S.Class<DockSnapshot>($I`DockSnapshot`)(
  {
    version: S.tag(1),
    workspace: DockWorkspace,
  },
  $I.annote("DockSnapshot", {
    description: "Version one persisted snapshot envelope containing one complete dock workspace.",
  })
) {}

/** Placement for the first panel in an empty workspace. */
export class RootPlacement extends S.Class<RootPlacement>($I`RootPlacement`)(
  {
    kind: S.tag("root"),
    groupId: GroupId,
  },
  $I.annote("RootPlacement", {
    description: "Creates the root tab group in an empty workspace.",
  })
) {}

/** Placement that appends a panel to an existing tab group. */
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

export const DockSide = LiteralKit(["left", "right", "top", "bottom"]).annotate(
  $I.annote("DockSide", {
    description: "Semantic side on which a new tab group is inserted.",
  })
);
export type DockSide = typeof DockSide.Type;

/** Placement that creates a sibling tab group and binary split. */
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

type SplitPosition = Pick<SplitPlacement, "side" | "splitId" | "newGroupRatio">;

/** Placement that creates a new tab group against the complete workspace root. */
export class RootSplitPlacement extends S.Class<RootSplitPlacement>($I`RootSplitPlacement`)(
  {
    kind: S.tag("rootSplit"),
    side: DockSide,
    splitId: SplitId,
    newGroupId: GroupId,
    newGroupRatio: SplitRatio.pipe(SchemaUtils.withConstantDefault<number>(5_000)),
  },
  $I.annote("RootSplitPlacement", {
    description: "Creates a new tab group against one semantic edge of the complete workspace root.",
  })
) {}

/** Group relocation beside an existing group without a dangling new-group identity. */
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

/** Group relocation against the workspace root without a dangling new-group identity. */
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

/** Semantic destination for opening a panel. */
export const DockPlacement = DockPlacementKind.mapMembers(
  Tuple.evolve([() => RootPlacement, () => TabPlacement, () => SplitPlacement, () => RootSplitPlacement])
)
  .annotate(
    $I.annote("DockPlacement", {
      description: "Semantic panel placement independent from DOM coordinates.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockPlacement = typeof DockPlacement.Type;

/** Semantic destination for moving an existing panel. */
export const DockMoveTarget = S.Union([TabPlacement, SplitPlacement, RootSplitPlacement]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DockMoveTarget", {
    description: "Moves a panel into tabs or docks it beside an existing group.",
  })
);
export type DockMoveTarget = typeof DockMoveTarget.Type;

/** Honest target algebra for whole-group merge and relocation. */
export const DockGroupMoveTarget = S.Union([TabPlacement, GroupSplitPlacement, GroupRootSplitPlacement]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DockGroupMoveTarget", {
    description: "Merges a group into tabs or relocates it without unused new-group identifiers.",
  })
);
export type DockGroupMoveTarget = typeof DockGroupMoveTarget.Type;

/** Command originating from a user interaction. */
export class UserCommandOrigin extends S.Class<UserCommandOrigin>($I`UserCommandOrigin`)(
  {
    kind: S.tag("user"),
    interactionId: S.NonEmptyString,
  },
  $I.annote("UserCommandOrigin", {
    description: "Origin metadata for a user gesture compiled into a command.",
  })
) {}

/** Command originating from a programmatic API call. */
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

/** Explicit command origin replacing mutable ambient origin stacks. */
export const CommandOrigin = CommandOriginKind.mapMembers(
  Tuple.evolve([() => UserCommandOrigin, () => ApiCommandOrigin])
)
  .annotate(
    $I.annote("CommandOrigin", {
      description: "Causal origin carried with every top-level dock command.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type CommandOrigin = typeof CommandOrigin.Type;

/** Opens a new panel at a semantic placement. */
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

/** Activates a panel within its owning tab zipper. */
export class ActivatePanelCommand extends S.Class<ActivatePanelCommand>($I`ActivatePanelCommand`)(
  {
    kind: S.tag("activatePanel"),
    panelId: PanelId,
  },
  $I.annote("ActivatePanelCommand", {
    description: "Makes an existing panel active within its tab group.",
  })
) {}

/** Replaces selected persistable facets of one panel. */
export class UpdatePanelCommand extends S.Class<UpdatePanelCommand>($I`UpdatePanelCommand`)(
  { kind: S.tag("updatePanel"), panelId: PanelId, patch: PanelPatch },
  $I.annote("UpdatePanelCommand", { description: "Applies whole-value replacements to an existing panel." })
) {}

/** Moves a panel into tabs or docks it beside an existing group. */
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

/** Moves or merges one complete non-empty tab group atomically. */
export class MoveGroupCommand extends S.Class<MoveGroupCommand>($I`MoveGroupCommand`)(
  { kind: S.tag("moveGroup"), groupId: GroupId, target: DockGroupMoveTarget },
  $I.annote("MoveGroupCommand", { description: "Merges or relocates an entire tab group as one atomic transition." })
) {}

/** Replaces selected persistable metadata of one group. */
export class UpdateGroupCommand extends S.Class<UpdateGroupCommand>($I`UpdateGroupCommand`)(
  { kind: S.tag("updateGroup"), groupId: GroupId, patch: GroupPatch },
  $I.annote("UpdateGroupCommand", { description: "Applies whole-value replacements to existing group metadata." })
) {}

/** Closes a panel, collapsing an empty leaf and its parent split. */
export class ClosePanelCommand extends S.Class<ClosePanelCommand>($I`ClosePanelCommand`)(
  {
    kind: S.tag("closePanel"),
    panelId: PanelId,
  },
  $I.annote("ClosePanelCommand", {
    description: "Closes one panel and canonically collapses empty topology.",
  })
) {}

/** Changes the ratio of an existing split. */
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

/** Clears the workspace in one transition. */
export class ClearWorkspaceCommand extends S.Class<ClearWorkspaceCommand>($I`ClearWorkspaceCommand`)(
  {
    kind: S.tag("clearWorkspace"),
  },
  $I.annote("ClearWorkspaceCommand", {
    description: "Clears every panel and layout node atomically.",
  })
) {}

/** Maximizes one group, revealing it when hidden. */
export class MaximizeGroupCommand extends S.Class<MaximizeGroupCommand>($I`MaximizeGroupCommand`)(
  { kind: S.tag("maximizeGroup"), groupId: GroupId },
  $I.annote("MaximizeGroupCommand", { description: "Reveals and maximizes one existing tab group." })
) {}

/** Restores the normal split projection. */
export class RestoreMaximizedCommand extends S.Class<RestoreMaximizedCommand>($I`RestoreMaximizedCommand`)(
  { kind: S.tag("restoreMaximized") },
  $I.annote("RestoreMaximizedCommand", { description: "Clears the currently maximized group." })
) {}

export class FloatGroupCommand extends S.Class<FloatGroupCommand>($I`FloatGroupCommand`)(
  { kind: S.tag("floatGroup"), groupId: GroupId, anchoredBox: AnchoredBox },
  $I.annote("FloatGroupCommand", { description: "Moves one docked group into a new topmost floating member." })
) {}
export class DockFloatingGroupCommand extends S.Class<DockFloatingGroupCommand>($I`DockFloatingGroupCommand`)(
  { kind: S.tag("dockFloatingGroup"), groupId: GroupId, target: DockGroupMoveTarget },
  $I.annote("DockFloatingGroupCommand", { description: "Moves a floating group back into the docked tree." })
) {}
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

/** Complete domain command union. */
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
export type DockCommand = typeof DockCommand.Type;

/** Causally identified top-level command. */
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

/** Causal metadata for installing a persisted snapshot. */
export class RestoreSnapshotRequest extends S.Class<RestoreSnapshotRequest>($I`RestoreSnapshotRequest`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
  },
  $I.annote("RestoreSnapshotRequest", {
    description: "Causal metadata attached to a validated snapshot installation.",
  })
) {}

/** Event emitted after opening a panel. */
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

/** Event emitted after changing a tab group's active panel. */
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

/** Event emitted after replacing a panel title. */
export class PanelTitleChangedEvent extends S.Class<PanelTitleChangedEvent>($I`PanelTitleChangedEvent`)(
  { kind: S.tag("panelTitleChanged"), panelId: PanelId, groupId: GroupId, title: S.NonEmptyString },
  $I.annote("PanelTitleChangedEvent", { description: "A panel title was replaced." })
) {}

/** Event emitted after replacing a panel view. */
export class PanelViewChangedEvent extends S.Class<PanelViewChangedEvent>($I`PanelViewChangedEvent`)(
  { kind: S.tag("panelViewChanged"), panelId: PanelId, groupId: GroupId, view: PanelView },
  $I.annote("PanelViewChangedEvent", { description: "A panel view contract was replaced." })
) {}

/** Event emitted after replacing a panel render mode. */
export class PanelRenderModeChangedEvent extends S.Class<PanelRenderModeChangedEvent>($I`PanelRenderModeChangedEvent`)(
  { kind: S.tag("panelRenderModeChanged"), panelId: PanelId, groupId: GroupId, renderMode: PanelRenderMode },
  $I.annote("PanelRenderModeChangedEvent", { description: "A panel rendering policy was replaced." })
) {}

/** Event emitted after replacing or clearing a custom tab renderer key. */
export class PanelTabComponentChangedEvent extends S.Class<PanelTabComponentChangedEvent>(
  $I`PanelTabComponentChangedEvent`
)(
  { kind: S.tag("panelTabComponentChanged"), panelId: PanelId, groupId: GroupId, tabComponent: S.Option(RendererKey) },
  $I.annote("PanelTabComponentChangedEvent", {
    description: "A panel custom tab renderer key was replaced or cleared.",
  })
) {}

/** Event emitted after atomically moving a panel between groups. */
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

/** Event emitted after reordering a panel within its current group. */
export class PanelReorderedEvent extends S.Class<PanelReorderedEvent>($I`PanelReorderedEvent`)(
  { kind: S.tag("panelReordered"), panelId: PanelId, groupId: GroupId, index: NonNegativeInt },
  $I.annote("PanelReorderedEvent", { description: "A panel changed position within its existing tab group." })
) {}

/** Event emitted after merging a complete source group into another group. */
export class GroupMergedEvent extends S.Class<GroupMergedEvent>($I`GroupMergedEvent`)(
  { kind: S.tag("groupMerged"), fromGroupId: GroupId, toGroupId: GroupId, panelIds: S.NonEmptyArray(PanelId) },
  $I.annote("GroupMergedEvent", {
    description: "A complete source group was merged into a destination group in source order.",
  })
) {}

/** Event emitted after relocating a complete group through a new split. */
export class GroupMovedEvent extends S.Class<GroupMovedEvent>($I`GroupMovedEvent`)(
  { kind: S.tag("groupMoved"), groupId: GroupId, splitId: SplitId },
  $I.annote("GroupMovedEvent", { description: "A complete tab group was relocated through a newly created split." })
) {}

/** Event emitted after replacing group metadata. */
export class GroupUpdatedEvent extends S.Class<GroupUpdatedEvent>($I`GroupUpdatedEvent`)(
  { kind: S.tag("groupUpdated"), groupId: GroupId },
  $I.annote("GroupUpdatedEvent", { description: "Persistable metadata for a tab group changed." })
) {}

/** Event emitted after closing a panel. */
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

/** Event emitted after resizing a split. */
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

/** Event emitted after clearing the workspace. */
export class WorkspaceClearedEvent extends S.Class<WorkspaceClearedEvent>($I`WorkspaceClearedEvent`)(
  {
    kind: S.tag("workspaceCleared"),
  },
  $I.annote("WorkspaceClearedEvent", {
    description: "The complete workspace was cleared atomically.",
  })
) {}

/** Event emitted after installing a validated snapshot. */
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

/** Event emitted after maximizing a group. */
export class GroupMaximizedEvent extends S.Class<GroupMaximizedEvent>($I`GroupMaximizedEvent`)(
  { kind: S.tag("groupMaximized"), groupId: GroupId },
  $I.annote("GroupMaximizedEvent", { description: "A visible group became the exclusive geometry projection." })
) {}

/** Event emitted after leaving maximized mode. */
export class GroupRestoredEvent extends S.Class<GroupRestoredEvent>($I`GroupRestoredEvent`)(
  { kind: S.tag("groupRestored"), groupId: GroupId },
  $I.annote("GroupRestoredEvent", { description: "A group left maximized mode." })
) {}
export class GroupFloatedEvent extends S.Class<GroupFloatedEvent>($I`GroupFloatedEvent`)(
  { kind: S.tag("groupFloated"), groupId: GroupId },
  $I.annote("GroupFloatedEvent", { description: "A docked group became floating." })
) {}
export class GroupDockedEvent extends S.Class<GroupDockedEvent>($I`GroupDockedEvent`)(
  { kind: S.tag("groupDocked"), groupId: GroupId },
  $I.annote("GroupDockedEvent", { description: "A floating group returned to the docked tree." })
) {}
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

/** Complete domain event union. */
export const DockEvent = DockEventKind.mapMembers(
  Tuple.evolve([
    () => PanelOpenedEvent,
    () => PanelActivatedEvent,
    () => PanelTitleChangedEvent,
    () => PanelViewChangedEvent,
    () => PanelRenderModeChangedEvent,
    () => PanelTabComponentChangedEvent,
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
export type DockEvent = typeof DockEvent.Type;

export const DockUnchangedReason = LiteralKit([
  "panel-already-active",
  "panel-unchanged",
  "group-unchanged",
  "split-ratio-unchanged",
  "snapshot-identical",
  "panel-position-unchanged",
  "topology-unchanged",
  "group-already-maximized",
  "no-group-maximized",
  "floating-position-unchanged",
]).annotate(
  $I.annote("DockUnchangedReason", {
    description: "Expected reasons a valid dock intent produces no state change or domain event.",
  })
);
export type DockUnchangedReason = typeof DockUnchangedReason.Type;

/** Outcome for a state-changing dock intent. */
export class DockChanged extends S.TaggedClass<DockChanged>($I`DockChanged`)(
  "Changed",
  {
    previousRevision: NonNegativeInt,
    state: DockWorkspace,
    events: S.NonEmptyArray(DockEvent),
  },
  $I.annote("DockChanged", {
    description: "A dock intent changed state and produced causally associated events.",
  })
) {}

/** Outcome for a valid idempotent dock intent. */
export class DockUnchanged extends S.TaggedClass<DockUnchanged>($I`DockUnchanged`)(
  "Unchanged",
  {
    revision: NonNegativeInt,
    reason: DockUnchangedReason,
  },
  $I.annote("DockUnchanged", {
    description: "A valid dock intent left state and revision untouched and emitted no event.",
  })
) {}

/** Variant-specific result of a valid dock mutation. */
export const DockMutationResult = S.Union([DockChanged, DockUnchanged]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockMutationResult", {
    description: "Discriminates published state changes from idempotent no-change results.",
  })
);
export type DockMutationResult = typeof DockMutationResult.Type;

/** Causal envelope around a changed or unchanged mutation result. */
export class DockMutationOutcome extends S.Class<DockMutationOutcome>($I`DockMutationOutcome`)(
  {
    commandId: CommandId,
    origin: CommandOrigin,
    result: DockMutationResult,
  },
  $I.annote("DockMutationOutcome", {
    description: "Causally identified result of a valid command or snapshot restore.",
  })
) {}

export const DockRejectionReason = LiteralKit([
  "workspace-not-empty",
  "workspace-empty",
  "panel-already-open",
  "panel-not-found",
  "group-not-found",
  "split-not-found",
  "group-already-exists",
  "split-already-exists",
  "group-locked",
  "same-group-move",
  "source-group-would-disappear",
  "group-floating",
  "group-not-docked",
  "group-not-floating",
]).annotate(
  $I.annote("DockRejectionReason", {
    description: "Expected business reasons for rejecting a dock command.",
  })
);
export type DockRejectionReason = typeof DockRejectionReason.Type;

/** Expected command rejection in the typed failure channel. */
export class DockCommandRejected extends TaggedErrorClass<DockCommandRejected>($I`DockCommandRejected`)(
  "DockCommandRejected",
  {
    commandId: CommandId,
    reason: DockRejectionReason,
    message: S.String,
  },
  $I.annote("DockCommandRejected", {
    description: "An expected command rejection that leaves state untouched.",
  })
) {}

export const DockInvariantReason = LiteralKit([
  "duplicate-panel-id",
  "duplicate-group-id",
  "duplicate-split-id",
  "revision-exhausted",
  "topology-corrupted",
  "maximized-group-invalid",
]).annotate(
  $I.annote("DockInvariantReason", {
    description: "Workspace invariant failures surfaced through the typed transition boundary.",
  })
);
export type DockInvariantReason = typeof DockInvariantReason.Type;

/** Workspace invariant failure discovered before state publication. */
export class DockInvariantViolation extends TaggedErrorClass<DockInvariantViolation>($I`DockInvariantViolation`)(
  "DockInvariantViolation",
  {
    reason: DockInvariantReason,
    message: S.String,
  },
  $I.annote("DockInvariantViolation", {
    description: "A workspace invariant failed before state publication.",
  })
) {}

export const DockInputBoundary = LiteralKit(["command", "snapshot"]).annotate(
  $I.annote("DockInputBoundary", {
    description: "External schema boundary at which unknown input was rejected.",
  })
);
export type DockInputBoundary = typeof DockInputBoundary.Type;

/** Invalid unknown command or snapshot input. */
export class DockInputError extends TaggedErrorClass<DockInputError>($I`DockInputError`)(
  "DockInputError",
  {
    boundary: DockInputBoundary,
    message: S.String,
  },
  $I.annote("DockInputError", {
    description: "Schema decoding failure mapped at a public POC boundary.",
  })
) {}

export const DockPersistenceOperation = LiteralKit(["load", "save"]).annotate(
  $I.annote("DockPersistenceOperation", {
    description: "Snapshot-store operation that can fail in a host adapter.",
  })
);
export type DockPersistenceOperation = typeof DockPersistenceOperation.Type;

/** Typed snapshot-store failure for replaceable persistence adapters. */
export class DockPersistenceError extends TaggedErrorClass<DockPersistenceError>($I`DockPersistenceError`)(
  "DockPersistenceError",
  {
    operation: DockPersistenceOperation,
    message: S.String,
  },
  $I.annote("DockPersistenceError", {
    description: "Failure while loading or saving a dock snapshot.",
  })
) {}

/** Missing persisted snapshot requested by a restore action. */
export class DockSnapshotMissing extends TaggedErrorClass<DockSnapshotMissing>($I`DockSnapshotMissing`)(
  "DockSnapshotMissing",
  {
    message: S.String,
  },
  $I.annote("DockSnapshotMissing", {
    description: "No persisted snapshot exists for a restore action.",
  })
) {}

/** Error union for a typed dock transition. */
export const DockTransitionError = S.Union([DockCommandRejected, DockInvariantViolation]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("DockTransitionError", {
    description: "Error while executing a dock transition.",
  })
);

export type DockTransitionError = typeof DockTransitionError.Type;

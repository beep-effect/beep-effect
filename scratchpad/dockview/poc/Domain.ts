/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { flow, pipe, Tuple } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("dockview/poc/Domain");

type Dual2<Self, That, Result> = {
  (self: Self, that: That): Result;
  (that: That): (self: Self) => Result;
};

type Dual3<Self, First, Second, Result> = {
  (self: Self, first: First, second: Second): Result;
  (first: First, second: Second): (self: Self) => Result;
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
  },
  $I.annote("Panel", {
    description: "A renderer-neutral panel owned directly by one tab group.",
  })
) {
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
  },
  $I.annote("TabsNode", {
    description: "A non-empty ordered tab zipper with one structurally active panel.",
  })
) {
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

  static readonly panels = (tabs: TabsNode): ReadonlyArray<Panel> =>
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
  static readonly fromPlacement: Dual3<TabsNode, Panel, SplitPlacement, SplitNode> = dual(
    3,
    (reference: TabsNode, panel: Panel, placement: SplitPlacement): SplitNode => {
      const inserted = TabsNode.make({ groupId: placement.newGroupId, active: panel });
      return DockSide.$match(placement.side, {
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
            layout: VerticalSplitLayout.make({
              topRatio: placement.newGroupRatio,
              top: inserted,
              bottom: reference,
            }),
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
      });
    }
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
) satisfies S.Codec<DockNodeShape>;
export type DockNode = typeof DockNode.Type;

export declare namespace DockNode {
  export type Type = DockNodeShape;
  export type Encoded = DockNodeShape;
}

/** Workspace with no panels and therefore no root node. */
export class EmptyWorkspace extends S.Class<EmptyWorkspace>($I`EmptyWorkspace`)(
  {
    kind: S.tag("empty"),
    revision: NonNegativeInt.pipe(SchemaUtils.withConstantDefault<number>(0)),
  },
  $I.annote("EmptyWorkspace", {
    description: "A dock workspace with no representable layout tree.",
  })
) {}

/** Workspace with one schema-valid root node. */
export class PopulatedWorkspace extends S.Class<PopulatedWorkspace>($I`PopulatedWorkspace`)(
  {
    kind: S.tag("populated"),
    revision: NonNegativeInt.pipe(SchemaUtils.withConstantDefault<number>(0)),
    root: DockNode,
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
      empty: () => true,
      populated: ({ root }) => {
        const panelIds = A.map(DockNode.panels(root), (panel) => panel.id);
        const groupIds = A.map(DockNode.tabs(root), (tabs) => tabs.groupId);
        const splitIds = A.map(DockNode.splits(root), (split) => split.splitId);
        return Bool.and(idsAreUnique(panelIds), Bool.and(idsAreUnique(groupIds), idsAreUnique(splitIds)));
      },
    }),
  {
    identifier: $I`DockWorkspaceGlobalIdentityCheck`,
    title: "Dock workspace global identity",
    description: "Panel, group, and split identifiers must each be globally unique across the complete tree.",
    message: "Expected globally unique panel, group, and split identifiers.",
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

    const findPanel: Dual2<DockWorkspaceShape, PanelId, O.Option<Panel>> = dual(
      2,
      (workspace: DockWorkspaceShape, panelId: PanelId): O.Option<Panel> =>
        DockWorkspaceBase.match(workspace, {
          empty: (): O.Option<Panel> => O.none(),
          populated: ({ root }): O.Option<Panel> => Panel.findInNode(root, panelId),
        })
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
        DockWorkspaceBase.match(workspace, {
          empty: (): O.Option<TabsNode> => O.none(),
          populated: ({ root }): O.Option<TabsNode> => DockNode.findTabs(root, groupId),
        })
    );

    const hasSameContent: Dual2<DockWorkspaceShape, DockWorkspaceShape, boolean> = dual(
      2,
      (left: DockWorkspaceShape, right: DockWorkspaceShape): boolean =>
        DockWorkspaceBase.match(left, {
          empty: () => DockWorkspaceBase.guards.empty(right),
          populated: ({ root }) =>
            pipe(
              right,
              asPopulated,
              O.exists((candidate) => DockNode.equals(root, candidate.root))
            ),
        })
    );

    const withRevision: Dual2<DockWorkspaceShape, NonNegativeInt, DockWorkspaceShape> = dual(
      2,
      (workspace: DockWorkspaceShape, revision: NonNegativeInt): DockWorkspaceShape =>
        DockWorkspaceBase.match(workspace, {
          empty: () => EmptyWorkspace.make({ revision }),
          populated: ({ root }) => PopulatedWorkspace.make({ revision, root }),
        })
    );

    return {
      empty,
      equals: SchemaUtils.toEquivalence(schema),
      findActivePanel,
      findPanel,
      findTabs,
      groupCount: (workspace: DockWorkspaceShape): number =>
        DockWorkspaceBase.match(workspace, {
          empty: () => 0,
          populated: ({ root }) => A.length(DockNode.tabs(root)),
        }),
      guards: DockWorkspaceBase.guards,
      hasSameContent,
      is: S.is(schema),
      match: DockWorkspaceBase.match,
      panels: (workspace: DockWorkspaceShape): ReadonlyArray<Panel> =>
        DockWorkspaceBase.match(workspace, {
          empty: (): ReadonlyArray<Panel> => A.empty(),
          populated: ({ root }): ReadonlyArray<Panel> => DockNode.panels(root),
        }),
      withRevision,
    };
  })
);
export type DockWorkspace = typeof DockWorkspace.Type;

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
  },
  $I.annote("TabPlacement", {
    description: "Appends a panel to an existing tab group and activates it.",
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

const DockPlacementKind = LiteralKit(["root", "tab", "split"]);

/** Semantic destination for opening a panel. */
export const DockPlacement = DockPlacementKind.mapMembers(
  Tuple.evolve([() => RootPlacement, () => TabPlacement, () => SplitPlacement])
)
  .annotate(
    $I.annote("DockPlacement", {
      description: "Semantic panel placement independent from DOM coordinates.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));
export type DockPlacement = typeof DockPlacement.Type;

/** Semantic destination for moving an existing panel. */
export const DockMoveTarget = S.Union([TabPlacement, SplitPlacement]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DockMoveTarget", {
    description: "Moves a panel into tabs or docks it beside an existing group.",
  })
);
export type DockMoveTarget = typeof DockMoveTarget.Type;

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

const DockCommandKind = LiteralKit([
  "openPanel",
  "activatePanel",
  "movePanel",
  "closePanel",
  "resizeSplit",
  "clearWorkspace",
]);

/** Complete domain command union. */
export const DockCommand = DockCommandKind.mapMembers(
  Tuple.evolve([
    () => OpenPanelCommand,
    () => ActivatePanelCommand,
    () => MovePanelCommand,
    () => ClosePanelCommand,
    () => ResizeSplitCommand,
    () => ClearWorkspaceCommand,
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

const DockEventKind = LiteralKit([
  "panelOpened",
  "panelActivated",
  "panelMoved",
  "panelClosed",
  "splitResized",
  "workspaceCleared",
  "workspaceRestored",
]);

/** Complete domain event union. */
export const DockEvent = DockEventKind.mapMembers(
  Tuple.evolve([
    () => PanelOpenedEvent,
    () => PanelActivatedEvent,
    () => PanelMovedEvent,
    () => PanelClosedEvent,
    () => SplitResizedEvent,
    () => WorkspaceClearedEvent,
    () => WorkspaceRestoredEvent,
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
  "split-ratio-unchanged",
  "snapshot-identical",
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
  "same-group-move",
  "source-group-would-disappear",
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

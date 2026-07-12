/**
 * Pure pixel geometry projections for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import type { AnchoredBox } from "./AnchoredBox.ts";
import {
  type DockNode,
  DockNode as DockNodeModel,
  type DockWorkspace,
  DockWorkspace as DockWorkspaceModel,
  GroupId,
  SplitId,
  SplitLayout,
} from "./Domain.ts";

const $I = $ScratchpadId.create("dockview/poc/Geometry");

type Dual2<Self, That, Result> = {
  (self: Self, that: That): Result;
  (that: That): (self: Self) => Result;
};

const Extent = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("Extent", { description: "A finite non-negative pixel coordinate or extent." })
);

/**
 * A finite non-negative rectangle in host pixel coordinates.
 *
 * Missing constructor fields default to zero, which represents an unmeasured
 * host container before its first resize observation.
 *
 * @example
 * ```ts
 * import { DockBox } from "./Geometry.ts"
 *
 * const empty = DockBox.make()
 * console.log(empty.width) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockBox extends S.Class<DockBox>($I`DockBox`)(
  {
    left: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    top: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    width: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    height: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
  },
  $I.annote("DockBox", { description: "A finite non-negative rectangle in host pixel coordinates." })
) {}

/** Projected rectangle for one tab group. */
export class GroupGeometry extends S.Class<GroupGeometry>($I`GroupGeometry`)(
  { groupId: S.toType(GroupId), box: DockBox },
  $I.annote("GroupGeometry", { description: "The projected pixel rectangle for one tab group." })
) {}

/** Projected hit rectangle for one split sash. */
export class SashGeometry extends S.Class<SashGeometry>($I`SashGeometry`)(
  { splitId: S.toType(SplitId), axis: LiteralKit(["horizontal", "vertical"]), box: DockBox },
  $I.annote("SashGeometry", { description: "A split gap hit rectangle, optionally expanded for grabbing." })
) {}

/** Geometry projected inside one resolved floating member box. */
export class FloatingGeometry extends S.Class<FloatingGeometry>($I`FloatingGeometry`)(
  { box: DockBox, groups: S.Array(GroupGeometry), sashes: S.Array(SashGeometry) },
  $I.annote("FloatingGeometry", { description: "One floating subtree projection in z-order." })
) {}

/** Complete renderer-facing geometry projection. */
export class DockGeometry extends S.Class<DockGeometry>($I`DockGeometry`)(
  {
    groups: S.Array(GroupGeometry),
    sashes: S.Array(SashGeometry),
    floating: S.Array(FloatingGeometry).pipe(SchemaUtils.withConstantDefault<ReadonlyArray<FloatingGeometry>>([])),
  },
  $I.annote("DockGeometry", { description: "Ordered leaf rectangles and split sash hit rectangles." })
) {
  static readonly empty = DockGeometry.make({ groups: [], sashes: [] });

  static readonly forGroup: Dual2<DockGeometry, GroupId, O.Option<DockBox>> = dual(
    2,
    (geometry: DockGeometry, groupId: GroupId): O.Option<DockBox> =>
      pipe(
        geometry.groups,
        A.findFirst((group) => GroupId.equals(group.groupId, groupId)),
        O.map((group) => group.box)
      )
  );
}

const minimumFloatingExtent = 32;

/** Resolves and clamps an anchored box into a host container. */
export const resolveAnchoredBox = (anchoredBox: AnchoredBox, container: DockBox): DockBox => {
  const width = N.min(container.width, N.max(minimumFloatingExtent, anchoredBox.width));
  const height = N.min(container.height, N.max(minimumFloatingExtent, anchoredBox.height));
  const rawLeft =
    anchoredBox._tag === "TopLeft" || anchoredBox._tag === "BottomLeft"
      ? N.sum(container.left, anchoredBox.left)
      : N.subtract(N.sum(container.left, container.width), N.sum(anchoredBox.right, width));
  const rawTop =
    anchoredBox._tag === "TopLeft" || anchoredBox._tag === "TopRight"
      ? N.sum(container.top, anchoredBox.top)
      : N.subtract(N.sum(container.top, container.height), N.sum(anchoredBox.bottom, height));
  return DockBox.make({
    left: N.clamp(rawLeft, {
      minimum: container.left,
      maximum: N.subtract(N.sum(container.left, container.width), width),
    }),
    top: N.clamp(rawTop, {
      minimum: container.top,
      maximum: N.subtract(N.sum(container.top, container.height), height),
    }),
    width,
    height,
  });
};

/** Options controlling gap allocation, sash hit-target expansion, and minimum group extent. */
export class GeometryOptions extends S.Class<GeometryOptions>($I`GeometryOptions`)(
  {
    gap: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
    minSashThickness: Extent.pipe(SchemaUtils.withConstantDefault<number>(8)),
    minGroupExtent: Extent.pipe(SchemaUtils.withConstantDefault<number>(0)),
  },
  $I.annote("GeometryOptions", {
    description:
      "Gap, minimum sash hit thickness, and minimum per-side split extent for geometry projection. The minimum extent is a per-split-local clamp, not a global constraint solver: each feasible split guarantees both sides at least minGroupExtent; an infeasible split (available < 2 x minGroupExtent) degrades to the unclamped proportional partition.",
  })
) {}

const hasVisibleGroup = (node: DockNode): boolean =>
  DockNodeModel.match(node, {
    Tabs: ({ metadata }) => metadata.visible,
    Split: ({ layout }) => {
      const [first, second] = SplitLayout.children(layout);
      return Bool.or(hasVisibleGroup(first), hasVisibleGroup(second));
    },
  });

/**
 * Host-supplied per-group minimum extents, e.g. derived from content
 * measurement (a panel title's natural width). The effective per-leaf
 * minimum is the maximum of this lookup and the global
 * `GeometryOptions.minGroupExtent`.
 */
export type GroupMinimumLookup = (groupId: GroupId) => number;

const zeroMinimum: GroupMinimumLookup = () => 0;

/**
 * Per-group minimum extents as a plain record value, keyed by group id. This
 * is the atom-friendly shape: a value (not a function) so hosts can store it
 * in a writable Atom and update it as content measurements change.
 */
export type GroupMinimaRecord = Readonly<Record<string, number>>;

const minimaFromRecord =
  (record: GroupMinimaRecord): GroupMinimumLookup =>
  (groupId) =>
    pipe(
      R.get(record, groupId),
      O.getOrElse(() => 0)
    );

// The minimum extent a visible subtree needs along the given axis: leaf
// minimums SUM through same-axis splits (plus the gap when both sides are
// visible) and take the MAX across cross-axis splits. Hidden subtrees need
// nothing. This is what makes the clamp honest for nested trees — a scalar
// clamped level-by-level would understate a same-axis run's requirement.
const requiredExtent = (
  node: DockNode,
  axis: SashGeometry["axis"],
  options: GeometryOptions,
  minima: GroupMinimumLookup
): number =>
  DockNodeModel.match(node, {
    Tabs: ({ groupId, metadata }) =>
      Bool.match(metadata.visible, {
        onFalse: () => 0,
        onTrue: () => N.max(options.minGroupExtent, minima(groupId)),
      }),
    Split: ({ layout }) => {
      const [first, second] = SplitLayout.children(layout);
      const firstRequired = requiredExtent(first, axis, options, minima);
      const secondRequired = requiredExtent(second, axis, options, minima);
      const bothVisible = Bool.and(hasVisibleGroup(first), hasVisibleGroup(second));
      return Bool.match(Eq.equals(layout.axis, axis), {
        onFalse: () => N.max(firstRequired, secondRequired),
        onTrue: () =>
          Bool.match(bothVisible, {
            onFalse: () => N.max(firstRequired, secondRequired),
            onTrue: () => N.sum(firstRequired, N.sum(options.gap, secondRequired)),
          }),
      });
    },
  });

const projectNode = (
  node: DockNode,
  box: DockBox,
  options: GeometryOptions,
  minima: GroupMinimumLookup
): DockGeometry =>
  DockNodeModel.match(node, {
    Tabs: ({ groupId, metadata }) =>
      Bool.match(metadata.visible, {
        onFalse: () => DockGeometry.empty,
        onTrue: () => DockGeometry.make({ groups: [GroupGeometry.make({ groupId, box })], sashes: [] }),
      }),
    Split: ({ splitId, layout }) => {
      const [first, second] = SplitLayout.children(layout);
      const firstVisible = hasVisibleGroup(first);
      const secondVisible = hasVisibleGroup(second);
      if (!firstVisible && !secondVisible) return DockGeometry.empty;
      if (!firstVisible) return projectNode(second, box, options, minima);
      if (!secondVisible) return projectNode(first, box, options, minima);
      const axisExtent = SplitLayout.match(layout, {
        horizontal: () => box.width,
        vertical: () => box.height,
      });
      if (N.isLessThanOrEqualTo(axisExtent, 0)) {
        const firstGeometry = projectNode(first, box, options, minima);
        const secondGeometry = projectNode(second, box, options, minima);
        return DockGeometry.make({
          groups: A.appendAll(firstGeometry.groups, secondGeometry.groups),
          sashes: pipe(
            firstGeometry.sashes,
            A.appendAll(secondGeometry.sashes),
            A.append(SashGeometry.make({ splitId, axis: layout.axis, box }))
          ),
        });
      }

      const gap = N.min(options.gap, axisExtent);
      const available = N.subtract(axisExtent, gap);
      const rawLeading = pipe(available, N.multiply(SplitLayout.ratio(layout)), N.divideUnsafe(10_000), N.round(0));
      // Minimum-extent clamp fed by requiredExtent, so nested same-axis
      // subtrees carry their summed leaf requirements (content-aware minimums
      // are pure inputs — see explorations/computable-workspace-geometry).
      // With zero minimums the bounds are [0, available] and the projection
      // is unchanged; an infeasible split keeps the proportional partition
      // rather than clamping one side into negatives.
      const minLeading = requiredExtent(first, layout.axis, options, minima);
      const minTrailing = requiredExtent(second, layout.axis, options, minima);
      const leading = Bool.match(N.isGreaterThanOrEqualTo(available, N.sum(minLeading, minTrailing)), {
        onFalse: () => rawLeading,
        onTrue: () =>
          N.clamp(rawLeading, {
            minimum: minLeading,
            maximum: N.subtract(available, minTrailing),
          }),
      });
      const trailing = N.subtract(available, leading);
      const [firstBox, secondBox, gapBox] = SplitLayout.match(layout, {
        horizontal: () => [
          DockBox.make({ left: box.left, top: box.top, width: leading, height: box.height }),
          DockBox.make({
            left: N.sum(box.left, N.sum(leading, gap)),
            top: box.top,
            width: trailing,
            height: box.height,
          }),
          DockBox.make({ left: N.sum(box.left, leading), top: box.top, width: gap, height: box.height }),
        ],
        vertical: () => [
          DockBox.make({ left: box.left, top: box.top, width: box.width, height: leading }),
          DockBox.make({
            left: box.left,
            top: N.sum(box.top, N.sum(leading, gap)),
            width: box.width,
            height: trailing,
          }),
          DockBox.make({ left: box.left, top: N.sum(box.top, leading), width: box.width, height: gap }),
        ],
      });
      const sashThickness = N.max(gap, options.minSashThickness);
      const expansion = N.divideUnsafe(N.subtract(sashThickness, gap), 2);
      const sashBox = SplitLayout.match(layout, {
        horizontal: () =>
          DockBox.make({
            left: N.max(0, N.subtract(gapBox.left, expansion)),
            top: gapBox.top,
            width: sashThickness,
            height: gapBox.height,
          }),
        vertical: () =>
          DockBox.make({
            left: gapBox.left,
            top: N.max(0, N.subtract(gapBox.top, expansion)),
            width: gapBox.width,
            height: sashThickness,
          }),
      });
      const firstGeometry = projectNode(first, firstBox, options, minima);
      const secondGeometry = projectNode(second, secondBox, options, minima);
      return DockGeometry.make({
        groups: A.appendAll(firstGeometry.groups, secondGeometry.groups),
        sashes: pipe(
          firstGeometry.sashes,
          A.appendAll(secondGeometry.sashes),
          A.append(SashGeometry.make({ splitId, axis: layout.axis, box: sashBox }))
        ),
      });
    },
  });

/** Projects a ratio tree into exact-partition pixel boxes and sash hit rectangles. */
export const project = (
  root: DockNode,
  container: DockBox,
  options = GeometryOptions.make(),
  minima: GroupMinimumLookup = zeroMinimum
): DockGeometry => projectNode(root, container, options, minima);

/** Projects a workspace, returning empty geometry for an empty workspace. */
export const projectWorkspace = (
  workspace: DockWorkspace,
  container: DockBox,
  options = GeometryOptions.make(),
  minima: GroupMinimumLookup = zeroMinimum
): DockGeometry => {
  const floating = A.map(DockWorkspaceModel.floatingMembers(workspace), (member) => {
    const box = resolveAnchoredBox(member.anchoredBox, container);
    const geometry = project(member.root, box, options, minima);
    return FloatingGeometry.make({ box, groups: geometry.groups, sashes: geometry.sashes });
  });
  const docked = DockWorkspaceModel.match(workspace, {
    empty: () => DockGeometry.empty,
    populated: ({ maximized, root }) =>
      O.match(maximized, {
        onNone: () => project(root, container, options, minima),
        onSome: (groupId) =>
          pipe(
            DockNodeModel.findTabs(root, groupId),
            O.match({
              onNone: () => DockGeometry.empty,
              onSome: () =>
                DockGeometry.make({ groups: [GroupGeometry.make({ groupId, box: container })], sashes: [] }),
            })
          ),
      }),
  });
  return DockGeometry.make({ groups: docked.groups, sashes: docked.sashes, floating });
};

/** One weighted entry in a normalized same-axis row view. */
export class DockRowEntry extends S.Class<DockRowEntry>($I`DockRowEntry`)(
  { node: DockNodeModel, share: Extent },
  $I.annote("DockRowEntry", { description: "A dock subtree and its proportional share within a normalized row view." })
) {}

/** A derived maximal same-axis row view; it is never persisted as tree state. */
export class DockRow extends S.Class<DockRow>($I`DockRow`)(
  { axis: LiteralKit(["horizontal", "vertical"]), entries: S.Array(DockRowEntry) },
  $I.annote("DockRow", { description: "A derived flat view of one maximal run of same-axis binary splits." })
) {}

const rowEntries = (node: DockNode, axis: DockRow["axis"], share: number): ReadonlyArray<DockRowEntry> =>
  DockNodeModel.match(node, {
    Tabs: () => A.of(DockRowEntry.make({ node, share })),
    Split: ({ layout }) =>
      Bool.match(Eq.equals(layout.axis, axis), {
        onFalse: () => A.of(DockRowEntry.make({ node, share })),
        onTrue: () => {
          const [first, second] = SplitLayout.children(layout);
          const leadingShare = N.multiply(share, N.divideUnsafe(SplitLayout.ratio(layout), 10_000));
          return A.appendAll(
            rowEntries(first, axis, leadingShare),
            rowEntries(second, axis, N.subtract(share, leadingShare))
          );
        },
      }),
  });

/** Returns every maximal split row, flattening nested splits only when their axes match. */
export const rows = (node: DockNode): ReadonlyArray<DockRow> =>
  DockNodeModel.match(node, {
    Tabs: (): ReadonlyArray<DockRow> => A.empty(),
    Split: ({ layout }) => {
      const entries = rowEntries(node, layout.axis, 1);
      return pipe(
        A.of(DockRow.make({ axis: layout.axis, entries })),
        A.appendAll(A.flatMap(entries, (entry) => rows(entry.node)))
      );
    },
  });

/** Builds derived geometry atoms from host-owned workspace and container atoms. */
export const makeDockGeometryAtoms = (input: {
  readonly workspaceAtom: Atom.Atom<DockWorkspace>;
  readonly containerAtom: Atom.Atom<DockBox>;
  readonly options?: GeometryOptions | undefined;
  readonly minima?: GroupMinimumLookup | undefined;
  readonly minimaAtom?: Atom.Atom<GroupMinimaRecord> | undefined;
}) => {
  const options = O.getOrElse(O.fromUndefinedOr(input.options), () => GeometryOptions.make());
  const minima = O.getOrElse(O.fromUndefinedOr(input.minima), () => zeroMinimum);
  const geometryAtom = Atom.readable((get) => {
    // Reactive per-group minimums compose with the static lookup by max, so
    // content-driven updates (a retitled panel, a loaded document) recompute
    // geometry without rebuilding the atom graph.
    const lookup = O.match(O.fromUndefinedOr(input.minimaAtom), {
      onNone: () => minima,
      onSome: (recordAtom) => {
        const fromRecord = minimaFromRecord(get(recordAtom));
        return (groupId: GroupId) => N.max(minima(groupId), fromRecord(groupId));
      },
    });
    return projectWorkspace(get(input.workspaceAtom), get(input.containerAtom), options, lookup);
  });
  const groupBoxAtom = Atom.family((groupId: GroupId) =>
    Atom.map(geometryAtom, (geometry) => DockGeometry.forGroup(geometry, groupId))
  );
  return { geometryAtom, groupBoxAtom };
};

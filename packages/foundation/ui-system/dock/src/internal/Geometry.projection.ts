/**
 * Pure pixel geometry projections for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Number as N, pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { DockNode as DockNodeModel, DockWorkspace as DockWorkspaceModel, SplitLayout } from "../Dock.tree.ts";
import {
  DockBox,
  DockGeometry,
  Extent,
  FloatingGeometry,
  GeometryOptions,
  GroupGeometry,
  resolveAnchoredBox,
  SashGeometry,
} from "../Geometry.models.ts";
import type { GroupId } from "../Dock.ids.ts";
import type { DockNode, DockWorkspace } from "../Dock.tree.ts";

const $I = $DockId.create("Geometry.projection");

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
type GroupMinimumLookup = (groupId: GroupId) => number;

const zeroMinimum: GroupMinimumLookup = () => 0;

/**
 * Per-group minimum extents as a plain record value, keyed by group id. This
 * is the atom-friendly shape: a value (not a function) so hosts can store it
 * in a writable Atom and update it as content measurements change.
 */
type GroupMinimaRecord = Readonly<Record<string, number>>;

interface MakeDockGeometryAtomsInput {
  readonly containerAtom: Atom.Atom<DockBox>;
  readonly minima?: GroupMinimumLookup | undefined;
  readonly minimaAtom?: Atom.Atom<GroupMinimaRecord> | undefined;
  readonly options?: GeometryOptions | undefined;
  readonly workspaceAtom: Atom.Atom<DockWorkspace>;
}

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
      return Bool.match(Bool.and(Eq.equals(layout.axis, axis), bothVisible), {
        onFalse: () => N.max(firstRequired, secondRequired),
        onTrue: () => N.sum(firstRequired, N.sum(options.gap, secondRequired)),
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

/**
 * Projects a dock tree into exact-partition group and sash boxes.
 *
 * @remarks
 * Rounding assigns the integer remainder to the trailing child, so child
 * extents plus the gap always equal the parent extent.
 *
 * @example
 * ```ts
 * import { DockBox, GeometryOptions, GroupId, Panel, PanelId, SplitId, SplitLayout, SplitNode, TabsNode, TextPanelView, project } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const tabs = TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
 * const split = SplitNode.make({ splitId: SplitId.make("split-one"), layout: SplitLayout.cases.horizontal.make({ left: tabs, right: tabs }) })
 * const geometry = project(split, DockBox.make({ width: 101, height: 40 }), GeometryOptions.make({ gap: 1 }))
 * console.log(geometry.groups.length)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const project = (
  root: DockNode,
  container: DockBox,
  options = GeometryOptions.make(),
  minima: GroupMinimumLookup = zeroMinimum
): DockGeometry => projectNode(root, container, options, minima);

/**
 * Projects docked, maximized, and floating workspace geometry.
 *
 * @example
 * ```ts
 * import { DockBox, DockWorkspace, projectWorkspace } from "@beep/dock"
 *
 * const geometry = projectWorkspace(DockWorkspace.empty, DockBox.make({ width: 800, height: 600 }))
 * console.log(geometry.groups.length)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
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
      pipe(
        maximized,
        O.map((groupId) =>
          pipe(
            DockNodeModel.findTabs(root, groupId),
            O.map(() => DockGeometry.make({ groups: [GroupGeometry.make({ groupId, box: container })], sashes: [] })),
            O.getOrElse(() => DockGeometry.empty)
          )
        ),
        O.getOrElse(() => project(root, container, options, minima))
      ),
  });
  return DockGeometry.make({ groups: docked.groups, sashes: docked.sashes, floating });
};

/** One weighted entry in a normalized same-axis row view. */
class DockRowEntry extends S.Class<DockRowEntry>($I`DockRowEntry`)(
  { node: DockNodeModel, share: Extent },
  $I.annote("DockRowEntry", { description: "A dock subtree and its proportional share within a normalized row view." })
) {}

/** A derived maximal same-axis row view; it is never persisted as tree state. */
class DockRow extends S.Class<DockRow>($I`DockRow`)(
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
    Tabs: A.empty<DockRow>,
    Split: ({ layout }) => {
      const entries = rowEntries(node, layout.axis, 1);
      return pipe(
        A.of(DockRow.make({ axis: layout.axis, entries })),
        A.appendAll(A.flatMap(entries, (entry) => rows(entry.node)))
      );
    },
  });

/**
 * Builds reactive geometry projections from host-owned workspace and container atoms.
 *
 * @example
 * ```ts
 * import { DockBox, GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, makeDockGeometryAtoms } from "@beep/dock"
 * import { Atom, AtomRegistry } from "effect/unstable/reactivity"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const atoms = makeDockGeometryAtoms({ workspaceAtom: Atom.make(workspace), containerAtom: Atom.make(DockBox.make({ width: 800, height: 600 })) })
 * const geometry = AtomRegistry.make().get(atoms.geometryAtom)
 * console.log(geometry.groups[0]?.box.width)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const makeDockGeometryAtoms = (input: MakeDockGeometryAtomsInput) => {
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

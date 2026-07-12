import { describe, expect, it } from "@effect/vitest";
import { Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import {
  DockNode,
  type DockWorkspace,
  EmptyWorkspace,
  GroupId,
  GroupMetadata,
  PopulatedWorkspace,
  type SplitId,
  SplitLayout,
  SplitNode,
  SplitRatio,
  TabsNode,
} from "../Domain.ts";
import {
  DockBox,
  DockGeometry,
  GeometryOptions,
  type GroupMinimaRecord,
  makeDockGeometryAtoms,
  project,
  projectWorkspace,
  rows,
} from "../Geometry.ts";
import { groupOne, groupThree, groupTwo, panelOne, panelThree, panelTwo, splitOne, splitTwo } from "./Fixtures.ts";

const tabsOne = TabsNode.make({ groupId: groupOne, active: panelOne });
const tabsTwo = TabsNode.make({ groupId: groupTwo, active: panelTwo });
const tabsThree = TabsNode.make({ groupId: groupThree, active: panelThree });

const split = (
  axis: "horizontal" | "vertical",
  ratio: number,
  first: DockNode,
  second: DockNode,
  id: SplitId = splitOne
): SplitNode =>
  SplitNode.make({
    splitId: id,
    layout: Match.value(axis).pipe(
      Match.when("horizontal", () =>
        SplitLayout.cases.horizontal.make({ leftRatio: SplitRatio.make(ratio), left: first, right: second })
      ),
      Match.when("vertical", () =>
        SplitLayout.cases.vertical.make({ topRatio: SplitRatio.make(ratio), top: first, bottom: second })
      ),
      Match.exhaustive
    ),
  });

const box = DockBox.make({ left: 0, top: 0, width: 101, height: 99 });

describe("dock geometry projection", () => {
  it("partitions odd horizontal and vertical extents exactly at 50/50", () => {
    const options = GeometryOptions.make({ gap: 3 });
    const horizontal = project(split("horizontal", 5_000, tabsOne, tabsTwo), box, options);
    const vertical = project(split("vertical", 5_000, tabsOne, tabsTwo), box, options);
    const [left, right] = horizontal.groups;
    const [top, bottom] = vertical.groups;

    expect(left?.box.width).toBe(49);
    expect(right?.box.width).toBe(49);
    expect((left?.box.width ?? 0) + 3 + (right?.box.width ?? 0)).toBe(box.width);
    expect(top?.box.height).toBe(48);
    expect(bottom?.box.height).toBe(48);
    expect((top?.box.height ?? 0) + 3 + (bottom?.box.height ?? 0)).toBe(box.height);
  });

  it("projects a nested three-way visual row and normalizes its shares", () => {
    const root = split("horizontal", 4_000, tabsOne, split("horizontal", 5_000, tabsTwo, tabsThree, splitTwo));
    const geometry = project(
      root,
      DockBox.make({ left: 0, top: 0, width: 101, height: 20 }),
      GeometryOptions.make({ gap: 1 })
    );

    expect(A.map(geometry.groups, (group) => group.box)).toEqual([
      DockBox.make({ left: 0, top: 0, width: 40, height: 20 }),
      DockBox.make({ left: 41, top: 0, width: 30, height: 20 }),
      DockBox.make({ left: 72, top: 0, width: 29, height: 20 }),
    ]);
    const normalized = rows(root);
    expect(A.map(normalized[0]?.entries ?? [], (entry) => entry.share)).toEqual([0.4, 0.3, 0.3]);
    expect(
      A.map(normalized[0]?.entries ?? [], (entry) =>
        DockNode.match(entry.node, { Tabs: ({ groupId }) => groupId, Split: () => GroupId.make("unexpected") })
      )
    ).toEqual([groupOne, groupTwo, groupThree]);
  });

  it("keeps extreme and complementary ratios as exact partitions", () => {
    const assertRatio = (ratio: 1_000 | 9_000) => {
      const geometry = project(split("horizontal", ratio, tabsOne, tabsTwo), box, GeometryOptions.make({ gap: 1 }));
      const [leading, trailing] = geometry.groups;
      expect((leading?.box.width ?? 0) + 1 + (trailing?.box.width ?? 0)).toBe(box.width);
    };
    assertRatio(1_000);
    assertRatio(9_000);
  });

  it("allocates gaps and expands sash hit rectangles symmetrically", () => {
    const geometry = project(
      split("horizontal", 5_000, tabsOne, tabsTwo),
      DockBox.make({ left: 10, top: 20, width: 101, height: 40 }),
      GeometryOptions.make({ gap: 3, minSashThickness: 9 })
    );
    expect(geometry.sashes[0]?.box).toEqual(DockBox.make({ left: 56, top: 20, width: 9, height: 40 }));
    expect(geometry.groups[1]?.box.left).toBe(62);
  });

  it("turns a zero-size container into finite zero-extent geometry", () => {
    const geometry = project(
      split("vertical", 5_000, tabsOne, split("horizontal", 5_000, tabsTwo, tabsThree, splitTwo)),
      DockBox.make({ left: 7, top: 9, width: 0, height: 0 })
    );
    const boxes = A.appendAll(
      A.map(geometry.groups, (group) => group.box),
      A.map(geometry.sashes, (sash) => sash.box)
    );
    expect(A.every(boxes, (candidate) => candidate.width === 0 && candidate.height === 0)).toBe(true);
    expect(
      A.every(
        A.flatMap(boxes, (candidate) => [candidate.left, candidate.top, candidate.width, candidate.height]),
        Number.isFinite
      )
    ).toBe(true);
  });

  it("projects an empty workspace to empty geometry", () => {
    expect(projectWorkspace(EmptyWorkspace.make(), box)).toEqual(DockGeometry.empty);
  });

  it("recomputes geometry atoms when the host container changes", () => {
    const workspaceAtom = Atom.make<DockWorkspace>(PopulatedWorkspace.make({ root: tabsOne }));
    const containerAtom = Atom.make(DockBox.make({ left: 0, top: 0, width: 10, height: 20 }));
    const atoms = makeDockGeometryAtoms({ workspaceAtom, containerAtom });
    const registry = AtomRegistry.make();

    expect(O.getOrThrow(registry.get(atoms.groupBoxAtom(groupOne))).width).toBe(10);
    registry.set(containerAtom, DockBox.make({ left: 0, top: 0, width: 30, height: 40 }));
    expect(O.getOrThrow(registry.get(atoms.groupBoxAtom(groupOne))).width).toBe(30);
    expect(O.isNone(registry.get(atoms.groupBoxAtom(groupTwo)))).toBe(true);
  });
});

describe("minimum group extent clamp", () => {
  const options = GeometryOptions.make({ gap: 3, minGroupExtent: 30 });

  it("clamps the leading side up to the minimum with an exact partition", () => {
    const geometry = project(split("horizontal", 1_000, tabsOne, tabsTwo), box, options);
    const [left, right] = geometry.groups;
    expect(left?.box.width).toBe(30);
    expect(right?.box.width).toBe(68);
    expect(right?.box.left).toBe(33);
  });

  it("clamps the trailing side symmetrically", () => {
    const geometry = project(split("horizontal", 9_000, tabsOne, tabsTwo), box, options);
    const [left, right] = geometry.groups;
    expect(left?.box.width).toBe(68);
    expect(right?.box.width).toBe(30);
  });

  it("clamps on the vertical axis too", () => {
    const geometry = project(split("vertical", 1_000, tabsOne, tabsTwo), box, options);
    const [top, bottom] = geometry.groups;
    expect(top?.box.height).toBe(30);
    expect(bottom?.box.height).toBe(66);
  });

  it("degrades to the proportional partition when infeasible", () => {
    const infeasible = GeometryOptions.make({ gap: 3, minGroupExtent: 60 });
    const geometry = project(split("horizontal", 1_000, tabsOne, tabsTwo), box, infeasible);
    const [left, right] = geometry.groups;
    expect(left?.box.width).toBe(10);
    expect(right?.box.width).toBe(88);
  });

  it("defaults to zero and reproduces the unclamped projection exactly", () => {
    const node = split("horizontal", 7_000, tabsOne, tabsTwo);
    const implicit = project(node, box, GeometryOptions.make({ gap: 3 }));
    const explicit = project(node, box, GeometryOptions.make({ gap: 3, minGroupExtent: 0 }));
    expect(explicit).toEqual(implicit);
    expect(implicit.groups[0]?.box.width).toBe(69);
  });

  it("leaves the hidden-sibling full-extent path unclamped", () => {
    const hidden = TabsNode.make({
      groupId: groupTwo,
      active: panelTwo,
      metadata: GroupMetadata.make({ visible: false }),
    });
    const clamped = GeometryOptions.make({ gap: 3, minGroupExtent: 500 });
    const geometry = project(split("horizontal", 1_000, tabsOne, hidden), box, clamped);
    expect(geometry.groups).toHaveLength(1);
    expect(geometry.groups[0]?.box.width).toBe(101);
  });
});

describe("per-group minimum lookup", () => {
  const gapThree = GeometryOptions.make({ gap: 3 });

  it("honors a per-group minimum on the trailing side", () => {
    const geometry = project(split("horizontal", 9_000, tabsOne, tabsTwo), box, gapThree, (groupId) =>
      GroupId.equals(groupId, groupTwo) ? 50 : 0
    );
    const [left, right] = geometry.groups;
    expect(left?.box.width).toBe(48);
    expect(right?.box.width).toBe(50);
  });

  it("sums leaf requirements through nested same-axis splits", () => {
    const nested = split("horizontal", 5_000, tabsOne, split("horizontal", 5_000, tabsTwo, tabsThree, splitTwo));
    const options = GeometryOptions.make({ gap: 3, minGroupExtent: 30 });
    const geometry = project(nested, box, options);
    const [one, two, three] = geometry.groups;
    // Outer trailing side REQUIRES 30 + 3 + 30 = 63, so the outer clamp
    // yields 35/63 (a scalar clamped level-by-level would give 49/49 and
    // squeeze the inner groups to 23px each, violating the minimum).
    expect(one?.box.width).toBe(35);
    expect(two?.box.width).toBe(30);
    expect(three?.box.width).toBe(30);
    expect(three?.box.left).toBe(71);
  });

  it("recomputes geometry when the reactive minima record changes", () => {
    const workspaceAtom = Atom.make<DockWorkspace>(
      PopulatedWorkspace.make({ root: split("horizontal", 9_000, tabsOne, tabsTwo) })
    );
    const containerAtom = Atom.make(DockBox.make({ left: 0, top: 0, width: 101, height: 99 }));
    const minimaAtom = Atom.make<GroupMinimaRecord>({});
    const atoms = makeDockGeometryAtoms({
      workspaceAtom,
      containerAtom,
      options: GeometryOptions.make({ gap: 3 }),
      minimaAtom,
    });
    const registry = AtomRegistry.make();

    expect(O.getOrThrow(registry.get(atoms.groupBoxAtom(groupTwo))).width).toBe(10);
    registry.set(minimaAtom, { [groupTwo]: 50 });
    expect(O.getOrThrow(registry.get(atoms.groupBoxAtom(groupTwo))).width).toBe(50);
    expect(O.getOrThrow(registry.get(atoms.groupBoxAtom(groupOne))).width).toBe(48);
  });

  it("takes the maximum requirement across a cross-axis subtree", () => {
    const crossed = split("horizontal", 9_000, tabsOne, split("vertical", 5_000, tabsTwo, tabsThree, splitTwo));
    const geometry = project(crossed, box, gapThree, (groupId) => (GroupId.equals(groupId, groupThree) ? 40 : 0));
    const widths = A.map(geometry.groups, (group) => group.box.width);
    expect(widths).toEqual([58, 40, 40]);
  });
});

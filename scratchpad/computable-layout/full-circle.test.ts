// The full circle, in one test file: browser-measured font metrics (the
// shippable value) → naturalWidth (pure content minimum) → GroupMinimumLookup
// → the actual dock kernel's geometry projection → a panel guaranteed wide
// enough that the sentence renders on one line. Blocks feed docks; both are
// pure; no DOM anywhere.
import { describe, expect, test } from "bun:test";
import {
  DockBox,
  GeometryOptions,
  GroupId,
  Panel,
  PanelId,
  project,
  SplitId,
  SplitLayout,
  SplitNode,
  SplitRatio,
  TabsNode,
  TextPanelView,
} from "@beep/dock";
import fixture from "./fixture.json" with { type: "json" };
import { layoutLineCount, naturalWidth } from "./layout.ts";

const metrics = { words: fixture.words, spaceWidth: fixture.spaceWidth };

const sidebar = TabsNode.make({
  groupId: GroupId.make("group-sidebar"),
  active: Panel.make({
    id: PanelId.make("panel-sidebar"),
    title: "Sidebar",
    view: TextPanelView.make({ text: "sidebar" }),
  }),
});

const proseGroup = GroupId.make("group-prose");
const prose = TabsNode.make({
  groupId: proseGroup,
  active: Panel.make({
    id: PanelId.make("panel-prose"),
    title: "Prose",
    view: TextPanelView.make({ text: fixture.sentence }),
  }),
});

describe("full circle: font metrics → content minimum → dock geometry → one line", () => {
  test("the prose panel is clamped wide enough that its sentence never wraps", () => {
    const contentMinimum = naturalWidth(fixture.sentence, metrics);
    // A greedy 90/10 split would starve the prose panel without the minimum.
    const workspaceRoot = SplitNode.make({
      splitId: SplitId.make("split-shell"),
      layout: SplitLayout.cases.horizontal.make({
        leftRatio: SplitRatio.make(9_000),
        left: sidebar,
        right: prose,
      }),
    });
    const container = DockBox.make({ left: 0, top: 0, width: 900, height: 600 });
    const geometry = project(workspaceRoot, {
      container,
      minima: (groupId) => (GroupId.equals(groupId, proseGroup) ? contentMinimum : 0),
      options: GeometryOptions.make({ gap: 4 }),
    });
    const proseBox = geometry.groups.find((group) => GroupId.equals(group.groupId, proseGroup))?.box;
    expect(proseBox).toBeDefined();
    expect(proseBox!.width).toBeGreaterThanOrEqual(contentMinimum);
    // The kernel-granted width provably renders the sentence on one line —
    // asserted with the same pure breaker the browser oracle validated.
    expect(layoutLineCount(fixture.sentence, metrics, proseBox!.width)).toBe(1);
  });

  test("without the minimum, the same split starves the prose panel into wrapping", () => {
    const workspaceRoot = SplitNode.make({
      splitId: SplitId.make("split-shell"),
      layout: SplitLayout.cases.horizontal.make({
        leftRatio: SplitRatio.make(9_000),
        left: sidebar,
        right: prose,
      }),
    });
    const container = DockBox.make({ left: 0, top: 0, width: 900, height: 600 });
    const geometry = project(workspaceRoot, { container, options: GeometryOptions.make({ gap: 4 }) });
    const proseBox = geometry.groups.find((group) => GroupId.equals(group.groupId, proseGroup))?.box;
    expect(layoutLineCount(fixture.sentence, metrics, proseBox!.width)).toBeGreaterThan(1);
  });
});

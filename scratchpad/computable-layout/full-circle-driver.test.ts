// The full-circle proof, reproduced against the shipped driver surface:
// @beep/pretext's checked-in fixture (the same Chrome/150 capture) → the
// driver's pure naturalWidth → GroupMinimumLookup → the dock kernel's
// geometry projection → a panel guaranteed wide enough that the sentence
// renders on one line. Same theorem as full-circle.test.ts, but every layout
// value now flows through the graduated package instead of scratchpad code.
import { describe, expect, test } from "bun:test";
import { chromeLinuxArial16, lineCount, naturalWidth, TextLayoutInput } from "@beep/pretext";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
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

const metrics = Effect.runSync(chromeLinuxArial16).metrics;
const sentence = O.getOrThrow(metrics.sentence);

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
    view: TextPanelView.make({ text: sentence }),
  }),
});

describe("full circle against @beep/pretext: driver metrics → content minimum → dock geometry → one line", () => {
  test("the prose panel is clamped wide enough that its sentence never wraps", () => {
    const contentMinimum = O.getOrThrow(naturalWidth(metrics, sentence));
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
    const geometry = project(workspaceRoot, container, GeometryOptions.make({ gap: 4 }), (groupId) =>
      GroupId.equals(groupId, proseGroup) ? contentMinimum : 0
    );
    const proseBox = geometry.groups.find((group) => GroupId.equals(group.groupId, proseGroup))?.box;
    expect(proseBox).toBeDefined();
    expect(proseBox!.width).toBeGreaterThanOrEqual(contentMinimum);
    // The kernel-granted width provably renders the sentence on one line —
    // asserted with the driver's own pure greedy breaker.
    expect(lineCount(metrics, TextLayoutInput.make({ maxWidth: proseBox!.width, text: sentence }))).toEqual(O.some(1));
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
    const geometry = project(workspaceRoot, container, GeometryOptions.make({ gap: 4 }));
    const proseBox = geometry.groups.find((group) => GroupId.equals(group.groupId, proseGroup))?.box;
    expect(
      O.getOrThrow(lineCount(metrics, TextLayoutInput.make({ maxWidth: proseBox!.width, text: sentence })))
    ).toBeGreaterThan(1);
  });
});

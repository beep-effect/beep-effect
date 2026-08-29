import {
  DockEngine,
  DockEngineLive,
  DockMutationResult,
  DockNode,
  DockWorkspace,
  GroupRootSplitPlacement,
  GroupSplitPlacement,
  MoveGroupCommand,
  MovePanelCommand,
  OpenPanelCommand,
  Panel,
  PanelId,
  RootSplitPlacement,
  SplitId,
  SplitLayout,
  SplitRatio,
  TabPlacement,
  TabsNode,
  TextPanelView,
} from "@beep/dock";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  envelope,
  groupOne,
  groupThree,
  groupTwo,
  openPanelOne,
  openPanelThreeSplitRight,
  openPanelTwo,
  panelOne,
  panelThree,
  panelTwo,
  splitOne,
  splitTwo,
} from "./Fixtures.ts";
import type { DockChanged, DockMutationOutcome } from "@beep/dock";

const splitThree = SplitId.make("split-three");
const panelFour = Panel.make({
  id: PanelId.make("panel-four"),
  title: "Panel Four",
  view: TextPanelView.make({ text: "four" }),
});

const requireChanged = (outcome: DockMutationOutcome): Effect.Effect<DockChanged> =>
  DockMutationResult.match(outcome.result, {
    Changed: (changed): Effect.Effect<DockChanged> => Effect.succeed(changed),
    Unchanged: ({ reason }) => Effect.die(`Expected Changed, received ${reason}`),
  });

const ids = (tabs: TabsNode): ReadonlyArray<PanelId> => A.map(TabsNode.panels(tabs), (panel) => panel.id);

describe("dock gesture command parity", () => {
  it.layer(DockEngineLive)("gesture transitions", (it) => {
    it.effect(
      "opens at zero, middle, and a clamped upper index while supporting inactive insertion",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "open-two-clamped",
              OpenPanelCommand.make({
                panel: panelTwo,
                placement: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(99)) }),
              })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "open-three-zero-inactive",
              OpenPanelCommand.make({
                panel: panelThree,
                placement: TabPlacement.make({
                  groupId: groupOne,
                  index: O.some(NonNegativeInt.make(0)),
                  activate: false,
                }),
              })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "open-four-middle-inactive",
              OpenPanelCommand.make({
                panel: panelFour,
                placement: TabPlacement.make({
                  groupId: groupOne,
                  index: O.some(NonNegativeInt.make(1)),
                  activate: false,
                }),
              })
            )
          )
        )).state;
        const tabs = O.getOrThrow(DockWorkspace.findTabs(state, groupOne));
        expect(ids(tabs)).toEqual([panelThree.id, panelFour.id, panelOne.id, panelTwo.id]);
        expect(tabs.active.id).toBe(panelTwo.id);
      })
    );

    it.effect(
      "reorders active and inactive panels without changing active identity and reports an indexed no-op",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelTwo))).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "open-three",
              OpenPanelCommand.make({ panel: panelThree, placement: TabPlacement.make({ groupId: groupOne }) })
            )
          )
        )).state;
        const movedActive = yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "reorder-active",
              MovePanelCommand.make({
                panelId: panelThree.id,
                target: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(0)) }),
              })
            )
          )
        );
        expect(movedActive.events[0]).toMatchObject({ kind: "panelReordered", index: 0 });
        state = movedActive.state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "reorder-inactive",
              MovePanelCommand.make({
                panelId: panelOne.id,
                target: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(2)) }),
              })
            )
          )
        )).state;
        const tabs = O.getOrThrow(DockWorkspace.findTabs(state, groupOne));
        expect(ids(tabs)).toEqual([panelThree.id, panelTwo.id, panelOne.id]);
        expect(tabs.active.id).toBe(panelThree.id);
        const noOp = yield* engine.transition(
          state,
          envelope(
            "reorder-noop",
            MovePanelCommand.make({
              panelId: panelTwo.id,
              target: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(1)) }),
            })
          )
        );
        expect(noOp.result).toMatchObject({
          _tag: "Unchanged",
          reason: "panel-position-unchanged",
          revision: state.revision,
        });
        const rejected = yield* Effect.flip(
          engine.transition(
            state,
            envelope(
              "same-group-append",
              MovePanelCommand.make({ panelId: panelTwo.id, target: TabPlacement.make({ groupId: groupOne }) })
            )
          )
        );
        expect(rejected).toMatchObject({ reason: "same-group-move" });
      })
    );

    it.effect(
      "opens against left and bottom workspace edges and rejects root-edge opening on empty",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const emptyFailure = yield* Effect.flip(
          engine.transition(
            DockWorkspace.empty,
            envelope(
              "empty-root-split",
              OpenPanelCommand.make({
                panel: panelOne,
                placement: RootSplitPlacement.make({ side: "left", splitId: splitOne, newGroupId: groupOne }),
              })
            )
          )
        );
        expect(emptyFailure).toMatchObject({ reason: "workspace-empty" });
        const root = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        const left = yield* requireChanged(
          yield* engine.transition(
            root,
            envelope(
              "root-left",
              OpenPanelCommand.make({
                panel: panelTwo,
                placement: RootSplitPlacement.make({ side: "left", splitId: splitOne, newGroupId: groupTwo }),
              })
            )
          )
        );
        const bottom = yield* requireChanged(
          yield* engine.transition(
            root,
            envelope(
              "root-bottom",
              OpenPanelCommand.make({
                panel: panelThree,
                placement: RootSplitPlacement.make({ side: "bottom", splitId: splitTwo, newGroupId: groupThree }),
              })
            )
          )
        );
        expect(O.getOrThrow(DockWorkspace.findTabs(left.state, groupTwo)).active.id).toBe(panelTwo.id);
        const bottomRoot = yield* DockWorkspace.match(bottom.state, {
          empty: () => Effect.die("expected populated"),
          populated: (workspace) => Effect.succeed(workspace.root),
        });
        expect(
          DockNode.match(bottomRoot, {
            Tabs: () => "tabs",
            Split: (split) =>
              SplitLayout.match(split.layout, { horizontal: () => "horizontal", vertical: () => "vertical" }),
          })
        ).toBe("vertical");
      })
    );

    it.effect(
      "moves a panel to a root split target",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelTwo))).state;
        const moved = yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "move-panel-root",
              MovePanelCommand.make({
                panelId: panelTwo.id,
                target: RootSplitPlacement.make({ side: "right", splitId: splitOne, newGroupId: groupTwo }),
              })
            )
          )
        );
        expect(moved.events[0]).toMatchObject({ kind: "panelMoved", toGroupId: groupTwo });
        expect(DockWorkspace.groupCount(moved.state)).toBe(2);
      })
    );

    it.effect(
      "moves a panel across groups at index zero without activating it",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelTwo))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelThreeSplitRight))).state;
        const moved = yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "move-panel-index-zero-inactive",
              MovePanelCommand.make({
                panelId: panelTwo.id,
                target: TabPlacement.make({
                  groupId: groupTwo,
                  index: O.some(NonNegativeInt.make(0)),
                  activate: false,
                }),
              })
            )
          )
        );
        const destination = O.getOrThrow(DockWorkspace.findTabs(moved.state, groupTwo));
        expect(ids(destination)).toEqual([panelTwo.id, panelThree.id]);
        expect(destination.active.id).toBe(panelThree.id);
      })
    );

    it.effect(
      "merges groups in source order with default and inactive activation policies and round-trips the result",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let base = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        base = (yield* requireChanged(yield* engine.transition(base, openPanelThreeSplitRight))).state;
        base = (yield* requireChanged(
          yield* engine.transition(
            base,
            envelope(
              "open-two-source",
              OpenPanelCommand.make({
                panel: panelTwo,
                placement: TabPlacement.make({ groupId: groupTwo, activate: false }),
              })
            )
          )
        )).state;
        const merged = yield* requireChanged(
          yield* engine.transition(
            base,
            envelope(
              "merge-default",
              MoveGroupCommand.make({
                groupId: groupTwo,
                target: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(0)) }),
              })
            )
          )
        );
        const tabs = O.getOrThrow(DockWorkspace.findTabs(merged.state, groupOne));
        expect(ids(tabs)).toEqual([panelThree.id, panelTwo.id, panelOne.id]);
        expect(tabs.active.id).toBe(panelThree.id);
        expect(DockWorkspace.groupCount(merged.state)).toBe(1);
        expect(
          DockWorkspace.equals(yield* engine.decodeSnapshot(yield* engine.encodeSnapshot(merged.state)), merged.state)
        ).toBe(true);

        const inactive = yield* requireChanged(
          yield* engine.transition(
            base,
            envelope(
              "merge-inactive",
              MoveGroupCommand.make({
                groupId: groupTwo,
                target: TabPlacement.make({ groupId: groupOne, activate: false }),
              })
            )
          )
        );
        expect(O.getOrThrow(DockWorkspace.findTabs(inactive.state, groupOne)).active.id).toBe(panelOne.id);
      })
    );

    it.effect(
      "relocates a complete group with its zipper intact and collapses its old parent",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelThreeSplitRight))).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "source-second-panel",
              OpenPanelCommand.make({
                panel: panelTwo,
                placement: TabPlacement.make({ groupId: groupTwo, activate: false }),
              })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "third-group",
              OpenPanelCommand.make({
                panel: panelFour,
                placement: RootSplitPlacement.make({ side: "bottom", splitId: splitTwo, newGroupId: groupThree }),
              })
            )
          )
        )).state;
        const before = O.getOrThrow(DockWorkspace.findTabs(state, groupTwo));
        const beforeEncoded = yield* S.encodeEffect(S.fromJsonString(TabsNode))(before);
        const moved = yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "relocate-group",
              MoveGroupCommand.make({
                groupId: groupTwo,
                target: GroupSplitPlacement.make({
                  referenceGroupId: groupThree,
                  side: "left",
                  splitId: splitThree,
                  newGroupRatio: SplitRatio.make(2_500),
                }),
              })
            )
          )
        );
        const after = O.getOrThrow(DockWorkspace.findTabs(moved.state, groupTwo));
        expect(yield* S.encodeEffect(S.fromJsonString(TabsNode))(after)).toBe(beforeEncoded);
        expect(DockWorkspace.groupCount(moved.state)).toBe(3);
        expect(
          O.isNone(
            DockWorkspace.match(moved.state, {
              empty: O.none,
              populated: (workspace) => DockNode.findSplit(workspace.root, splitOne),
            })
          )
        ).toBe(true);
        const movedRoot = yield* DockWorkspace.match(moved.state, {
          empty: () => Effect.die("expected populated"),
          populated: (workspace) => Effect.succeed(workspace.root),
        });
        const created = O.getOrThrow(DockNode.findSplit(movedRoot, splitThree));
        expect(SplitLayout.ratio(created.layout)).toBe(2_500);
      })
    );

    it.effect(
      "relocates a group against the populated workspace root",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelThreeSplitRight))).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "root-relocate-third",
              OpenPanelCommand.make({
                panel: panelFour,
                placement: RootSplitPlacement.make({ side: "bottom", splitId: splitTwo, newGroupId: groupThree }),
              })
            )
          )
        )).state;
        const moved = yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "root-relocate",
              MoveGroupCommand.make({
                groupId: groupTwo,
                target: GroupRootSplitPlacement.make({
                  side: "left",
                  splitId: splitThree,
                  newGroupRatio: SplitRatio.make(3_000),
                }),
              })
            )
          )
        );
        expect(moved.events[0]).toMatchObject({ kind: "groupMoved", groupId: groupTwo, splitId: splitThree });
        const root = yield* DockWorkspace.match(moved.state, {
          empty: () => Effect.die("expected populated"),
          populated: (workspace) => Effect.succeed(workspace.root),
        });
        const rootSplit = O.getOrThrow(DockNode.findSplit(root, splitThree));
        expect(SplitLayout.ratio(rootSplit.layout)).toBe(3_000);
      })
    );

    it.effect(
      "returns topology-unchanged for a single-group root relocation",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        const outcome = yield* engine.transition(
          state,
          envelope(
            "single-root-relocate",
            MoveGroupCommand.make({
              groupId: groupOne,
              target: GroupRootSplitPlacement.make({ side: "left", splitId: splitOne }),
            })
          )
        );
        expect(outcome.result).toMatchObject({
          _tag: "Unchanged",
          reason: "topology-unchanged",
          revision: state.revision,
        });
      })
    );
  });
});

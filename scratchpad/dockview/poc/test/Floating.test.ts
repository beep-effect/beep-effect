import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BottomRightAnchoredBox, TopLeftAnchoredBox } from "../AnchoredBox.ts";
import { DockEngine, DockEngineLive } from "../DockEngine.ts";
import {
  ActivatePanelCommand,
  ClosePanelCommand,
  type DockChanged,
  DockFloatingGroupCommand,
  type DockMutationOutcome,
  DockMutationResult,
  DockSnapshot,
  DockWorkspace,
  EmptyWorkspace,
  FloatGroupCommand,
  GroupPatch,
  GroupRootSplitPlacement,
  GroupSplitPlacement,
  MaximizeGroupCommand,
  MoveFloatingGroupCommand,
  MoveGroupCommand,
  MovePanelCommand,
  PopulatedWorkspace,
  SplitLayout,
  SplitNode,
  TabPlacement,
  TabsNode,
  UpdateGroupCommand,
} from "../Domain.ts";
import { DockBox, projectWorkspace, resolveAnchoredBox } from "../Geometry.ts";
import { envelope, groupOne, groupTwo, panelOne, panelThree, panelTwo, splitOne, splitTwo } from "./Fixtures.ts";

const firstBox = TopLeftAnchoredBox.make({ left: 10, top: 20, width: 300, height: 200 });
const secondBox = BottomRightAnchoredBox.make({ right: 5, bottom: 6, width: 250, height: 180 });
const tabsOne = TabsNode.make({ groupId: groupOne, active: panelOne });
const tabsTwo = TabsNode.make({ groupId: groupTwo, active: panelTwo });
const workspace = PopulatedWorkspace.make({
  root: SplitNode.make({
    splitId: splitOne,
    layout: SplitLayout.cases.horizontal.make({ left: tabsOne, right: tabsTwo }),
  }),
});
const changed = (outcome: DockMutationOutcome): DockChanged =>
  DockMutationResult.match(outcome.result, {
    Changed: (value) => value,
    Unchanged: ({ reason }) => {
      throw new Error(`Expected Changed: ${reason}`);
    },
  });

describe("floating dock topology", () => {
  it.layer(DockEngineLive)("forest transitions", (it) => {
    it.effect(
      "floats groups, preserves metadata, collapses docked topology, and rejects repeat float",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const floated = changed(
          yield* engine.transition(
            workspace,
            envelope("float-one", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        );
        expect(floated.events).toContainEqual(expect.objectContaining({ kind: "groupFloated", groupId: groupOne }));
        expect(DockWorkspace.findTabs(floated.state, groupOne)).toEqual(O.some(tabsOne));
        expect(floated.state.floating).toHaveLength(1);
        const last = changed(
          yield* engine.transition(
            PopulatedWorkspace.make({ root: tabsOne }),
            envelope("float-last", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        );
        expect(last.state).toMatchObject({ kind: "empty", floating: [{ root: tabsOne }] });
        const error = yield* Effect.flip(
          engine.transition(
            last.state,
            envelope("float-again", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        );
        expect(error).toMatchObject({ reason: "group-not-docked" });
      })
    );

    it.effect(
      "activates, updates, reorders, and closes inside a floating member",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = changed(
          yield* engine.transition(
            PopulatedWorkspace.make({
              root: TabsNode.make({ groupId: groupOne, active: panelOne, after: [panelTwo] }),
            }),
            envelope("float", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        ).state;
        state = changed(
          yield* engine.transition(state, envelope("activate", ActivatePanelCommand.make({ panelId: panelTwo.id })))
        ).state;
        state = changed(
          yield* engine.transition(
            state,
            envelope(
              "update",
              UpdateGroupCommand.make({ groupId: groupOne, patch: GroupPatch.make({ hideHeader: O.some(true) }) })
            )
          )
        ).state;
        state = changed(
          yield* engine.transition(
            state,
            envelope(
              "reorder",
              MovePanelCommand.make({
                panelId: panelOne.id,
                target: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(1)) }),
              })
            )
          )
        ).state;
        state = changed(
          yield* engine.transition(state, envelope("close-two", ClosePanelCommand.make({ panelId: panelTwo.id })))
        ).state;
        state = changed(
          yield* engine.transition(state, envelope("close-one", ClosePanelCommand.make({ panelId: panelOne.id })))
        ).state;
        expect(state).toMatchObject({ kind: "empty", floating: [] });
      })
    );

    it.effect(
      "moves panels and groups across trees and round-trips the forest",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const source = PopulatedWorkspace.make({
          root: SplitNode.make({
            splitId: splitOne,
            layout: SplitLayout.cases.horizontal.make({
              left: TabsNode.make({ groupId: groupOne, active: panelOne, after: [panelThree] }),
              right: tabsTwo,
            }),
          }),
        });
        let state = changed(
          yield* engine.transition(
            source,
            envelope("float-one", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        ).state;
        state = changed(
          yield* engine.transition(
            state,
            envelope(
              "panel-to-docked",
              MovePanelCommand.make({ panelId: panelOne.id, target: TabPlacement.make({ groupId: groupTwo }) })
            )
          )
        ).state;
        state = changed(
          yield* engine.transition(
            state,
            envelope(
              "group-back-floating",
              MoveGroupCommand.make({
                groupId: groupTwo,
                target: GroupSplitPlacement.make({ referenceGroupId: groupOne, side: "left", splitId: splitTwo }),
              })
            )
          )
        ).state;
        const encoded = yield* S.encodeEffect(DockSnapshot)(DockSnapshot.make({ workspace: state }));
        const decoded = yield* S.decodeUnknownEffect(DockSnapshot)(encoded);
        expect(decoded.workspace).toEqual(state);
      })
    );

    it.effect(
      "docks floating groups into empty roots and merge targets",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const floatingOnly = changed(
          yield* engine.transition(
            PopulatedWorkspace.make({ root: tabsOne }),
            envelope("float", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        ).state;
        const docked = changed(
          yield* engine.transition(
            floatingOnly,
            envelope(
              "dock",
              DockFloatingGroupCommand.make({
                groupId: groupOne,
                target: GroupRootSplitPlacement.make({ side: "left", splitId: splitOne }),
              })
            )
          )
        );
        expect(docked.state).toMatchObject({ kind: "populated", floating: [] });
        let mixed = changed(
          yield* engine.transition(
            workspace,
            envelope("float-two", FloatGroupCommand.make({ groupId: groupTwo, anchoredBox: secondBox }))
          )
        ).state;
        mixed = changed(
          yield* engine.transition(
            mixed,
            envelope(
              "merge",
              DockFloatingGroupCommand.make({ groupId: groupTwo, target: TabPlacement.make({ groupId: groupOne }) })
            )
          )
        ).state;
        expect(mixed.floating).toHaveLength(0);
        const error = yield* Effect.flip(
          engine.transition(
            mixed,
            envelope(
              "dock-docked",
              DockFloatingGroupCommand.make({
                groupId: groupOne,
                target: GroupSplitPlacement.make({ referenceGroupId: groupTwo, splitId: splitTwo, side: "right" }),
              })
            )
          )
        );
        expect(error).toMatchObject({ reason: "group-not-floating" });
      })
    );

    it.effect(
      "moves floating members, changes z-order, and reports unchanged frontmost positions",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = changed(
          yield* engine.transition(
            workspace,
            envelope("float-one", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        ).state;
        state = changed(
          yield* engine.transition(
            state,
            envelope("float-two", FloatGroupCommand.make({ groupId: groupTwo, anchoredBox: secondBox }))
          )
        ).state;
        state = changed(
          yield* engine.transition(
            state,
            envelope("move-one", MoveFloatingGroupCommand.make({ groupId: groupOne, anchoredBox: secondBox }))
          )
        ).state;
        expect(DockWorkspace.floatingMembers(state).at(-1)?.root).toEqual(tabsOne);
        const unchanged = yield* engine.transition(
          state,
          envelope("move-one-again", MoveFloatingGroupCommand.make({ groupId: groupOne, anchoredBox: secondBox }))
        );
        expect(unchanged.result).toMatchObject({ _tag: "Unchanged", reason: "floating-position-unchanged" });
      })
    );

    it.effect(
      "rejects floating maximize and projects docked maximize below floating geometry",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const state = changed(
          yield* engine.transition(
            workspace,
            envelope("float-two", FloatGroupCommand.make({ groupId: groupTwo, anchoredBox: firstBox }))
          )
        ).state;
        const error = yield* Effect.flip(
          engine.transition(state, envelope("maximize-floating", MaximizeGroupCommand.make({ groupId: groupTwo })))
        );
        expect(error).toMatchObject({ reason: "group-floating" });
        const maximized = changed(
          yield* engine.transition(state, envelope("maximize-docked", MaximizeGroupCommand.make({ groupId: groupOne })))
        );
        const geometry = projectWorkspace(maximized.state, DockBox.make({ left: 0, top: 0, width: 800, height: 600 }));
        expect(geometry.groups[0]?.box).toEqual(DockBox.make({ left: 0, top: 0, width: 800, height: 600 }));
        expect(geometry.floating).toHaveLength(1);
      })
    );
  });

  it("clamps anchored boxes to a sensible minimum inside the container", () => {
    expect(
      resolveAnchoredBox(
        TopLeftAnchoredBox.make({ left: 999, top: -5, width: 1, height: 1 }),
        DockBox.make({ left: 0, top: 0, width: 100, height: 80 })
      )
    ).toEqual(DockBox.make({ left: 68, top: 0, width: 32, height: 32 }));
  });

  it("schema-rejects duplicate identities across docked and floating roots", () => {
    expect(
      S.decodeUnknownResult(DockWorkspace)({
        kind: "populated",
        revision: 0,
        root: tabsOne,
        maximized: O.none(),
        floating: [{ anchoredBox: firstBox, root: tabsOne }],
      })._tag
    ).toBe("Failure");
    expect(EmptyWorkspace.make().floating).toEqual([]);
  });
});

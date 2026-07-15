import {
  ActivatePanelCommand,
  AnchoredBox,
  BottomRightAnchoredBox,
  ClearWorkspaceCommand,
  ClosePanelCommand,
  DockBox,
  DockEngine,
  DockEngineLive,
  DockFloatingGroupCommand,
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
  OpenPanelCommand,
  PopulatedWorkspace,
  projectWorkspace,
  RootPlacement,
  RootSplitPlacement,
  resolveAnchoredBox,
  SplitLayout,
  SplitNode,
  TabPlacement,
  TabsNode,
  TopLeftAnchoredBox,
  UpdateGroupCommand,
} from "@beep/dock";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { envelope, groupOne, groupTwo, panelOne, panelThree, panelTwo, splitOne, splitTwo } from "./Fixtures.ts";
import type { DockChanged, DockMutationOutcome } from "@beep/dock";

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
      "rejects root-split panel opening when only floating members exist",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const floatingOnly = changed(
          yield* engine.transition(
            PopulatedWorkspace.make({ root: tabsOne }),
            envelope("float", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        ).state;
        const error = yield* Effect.flip(
          engine.transition(
            floatingOnly,
            envelope(
              "open-colliding-root-split",
              OpenPanelCommand.make({
                panel: panelTwo,
                placement: RootSplitPlacement.make({
                  side: "left",
                  splitId: splitOne,
                  newGroupId: groupOne,
                }),
              })
            )
          )
        );
        expect(error).toMatchObject({ reason: "workspace-empty" });
      })
    );

    it.effect(
      "opens the first docked panel with root placement while preserving floating members",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const floatingOnly = changed(
          yield* engine.transition(
            PopulatedWorkspace.make({ root: tabsOne }),
            envelope("float", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        ).state;
        const opened = changed(
          yield* engine.transition(
            floatingOnly,
            envelope(
              "open-root",
              OpenPanelCommand.make({
                panel: panelTwo,
                placement: RootPlacement.make({ groupId: groupTwo }),
              })
            )
          )
        );
        expect(opened.state).toMatchObject({
          kind: "populated",
          root: { _tag: "Tabs", groupId: groupTwo },
          floating: [{ root: tabsOne }],
        });
      })
    );

    it.effect(
      "keeps a sole docked group root relocation unchanged when floating members exist",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const state = changed(
          yield* engine.transition(
            workspace,
            envelope(
              "float-two-before-root-relocate",
              FloatGroupCommand.make({ groupId: groupTwo, anchoredBox: firstBox })
            )
          )
        ).state;
        const outcome = yield* engine.transition(
          state,
          envelope(
            "single-root-relocate-with-floating",
            MoveGroupCommand.make({
              groupId: groupOne,
              target: GroupRootSplitPlacement.make({ side: "left", splitId: splitTwo }),
            })
          )
        );
        expect(outcome.result).toMatchObject({
          _tag: "Unchanged",
          reason: "topology-unchanged",
          revision: state.revision,
        });
        expect(outcome.result).not.toHaveProperty("events");
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

    it.effect(
      "clears both a populated docked tree and its floating members",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const withFloating = changed(
          yield* engine.transition(
            workspace,
            envelope("float-before-clear", FloatGroupCommand.make({ groupId: groupTwo, anchoredBox: firstBox }))
          )
        ).state;
        const cleared = changed(
          yield* engine.transition(withFloating, envelope("clear-populated", ClearWorkspaceCommand.make()))
        );
        expect(cleared.state).toMatchObject({ kind: "empty", floating: [] });
        expect(cleared.events).toContainEqual(expect.objectContaining({ kind: "workspaceCleared" }));
      })
    );

    it.effect(
      "clears floating members from an empty-root workspace",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const floatingOnly = changed(
          yield* engine.transition(
            PopulatedWorkspace.make({ root: tabsOne }),
            envelope("float-only-before-clear", FloatGroupCommand.make({ groupId: groupOne, anchoredBox: firstBox }))
          )
        ).state;
        const cleared = changed(
          yield* engine.transition(floatingOnly, envelope("clear-floating-only", ClearWorkspaceCommand.make()))
        );
        expect(cleared.state).toMatchObject({ kind: "empty", floating: [] });
        expect(cleared.events).toContainEqual(expect.objectContaining({ kind: "workspaceCleared" }));
      })
    );

    it.effect(
      "rejects clearing a workspace with no docked tree or floating members",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const error = yield* Effect.flip(
          engine.transition(DockWorkspace.empty, envelope("clear-empty", ClearWorkspaceCommand.make()))
        );
        expect(error).toMatchObject({ reason: "workspace-empty" });
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

describe("anchored box codec properties", () => {
  it.effect("round-trips arbitrary anchored boxes through their codec", () =>
    Effect.sync(() =>
      fc.assert(
        fc.property(S.toArbitrary(AnchoredBox), (box) => {
          const decoded = O.flatMap(S.encodeOption(AnchoredBox)(box), S.decodeUnknownOption(AnchoredBox));
          expect(O.exists(decoded, (value) => Equal.equals(value, box))).toBe(true);
        })
      )
    )
  );
});

import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { DockEngine, DockEngineLive } from "../DockEngine.ts";
import {
  type DockChanged,
  type DockMutationOutcome,
  DockMutationResult,
  DockWorkspace,
  GroupId,
  GroupPatch,
  GroupSplitPlacement,
  MoveGroupCommand,
  MovePanelCommand,
  OpenPanelCommand,
  Panel,
  PanelId,
  PanelPatch,
  RendererKey,
  RootSplitPlacement,
  SplitId,
  TabPlacement,
  TextPanelView,
  UpdateGroupCommand,
  UpdatePanelCommand,
} from "../Domain.ts";
import {
  envelope,
  groupOne,
  groupThree,
  groupTwo,
  openPanelOne,
  openPanelThreeSplitRight,
  openPanelTwo,
  panelOne,
  splitTwo,
} from "./Fixtures.ts";

const requireChanged = (outcome: DockMutationOutcome): Effect.Effect<DockChanged> =>
  DockMutationResult.match(outcome.result, {
    Changed: (changed): Effect.Effect<DockChanged> => Effect.succeed(changed),
    Unchanged: ({ reason }) => Effect.die(`Expected Changed, received ${reason}`),
  });

const updatePanel = (id: string, panelId: PanelId, patch: PanelPatch) =>
  envelope(id, UpdatePanelCommand.make({ panelId, patch }));

const updateGroup = (id: string, groupId: GroupId, patch: GroupPatch) =>
  envelope(id, UpdateGroupCommand.make({ groupId, patch }));

describe("panel and group updates", () => {
  it.layer(DockEngineLive)("kernel updates", (it) => {
    it.effect(
      "updates a title and reports an identical replacement without advancing revision",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const opened = yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne));
        const changed = yield* requireChanged(
          yield* engine.transition(
            opened.state,
            updatePanel("update-title", panelOne.id, PanelPatch.make({ title: O.some("Renamed") }))
          )
        );
        expect(changed.events).toEqual([
          { kind: "panelTitleChanged", panelId: panelOne.id, groupId: groupOne, title: "Renamed" },
        ]);
        expect(changed.state.revision).toBe(opened.state.revision + 1);
        const noOp = yield* engine.transition(
          changed.state,
          updatePanel("update-title-again", panelOne.id, PanelPatch.make({ title: O.some("Renamed") }))
        );
        expect(noOp.result).toMatchObject({
          _tag: "Unchanged",
          reason: "panel-unchanged",
          revision: changed.state.revision,
        });
      })
    );

    it.effect(
      "emits one event for each changed panel facet in a combined patch",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const opened = yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne));
        const changed = yield* requireChanged(
          yield* engine.transition(
            opened.state,
            updatePanel(
              "update-title-view",
              panelOne.id,
              PanelPatch.make({ title: O.some("Combined"), view: O.some(TextPanelView.make({ text: "changed" })) })
            )
          )
        );
        expect(A.map(changed.events, (event) => event.kind)).toEqual(["panelTitleChanged", "panelViewChanged"]);
      })
    );

    it.effect(
      "round-trips render mode and tab component through the snapshot envelope",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const opened = yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne));
        const changed = yield* requireChanged(
          yield* engine.transition(
            opened.state,
            updatePanel(
              "update-render-contract",
              panelOne.id,
              PanelPatch.make({
                renderMode: O.some("always"),
                tabComponent: O.some(O.some(RendererKey.make("custom-tab"))),
              })
            )
          )
        );
        const restored = yield* engine.decodeSnapshot(yield* engine.encodeSnapshot(changed.state));
        const panel = O.getOrThrow(DockWorkspace.findPanel(restored, panelOne.id));
        expect(panel.renderMode).toBe("always");
        expect(panel.tabComponent).toEqual(O.some(RendererKey.make("custom-tab")));
      })
    );

    it.effect(
      "updates group metadata and reports an identical replacement without advancing revision",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const opened = yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne));
        const changed = yield* requireChanged(
          yield* engine.transition(
            opened.state,
            updateGroup("lock-group", groupOne, GroupPatch.make({ locked: O.some("locked") }))
          )
        );
        expect(changed.events).toEqual([{ kind: "groupUpdated", groupId: groupOne }]);
        const noOp = yield* engine.transition(
          changed.state,
          updateGroup("lock-group-again", groupOne, GroupPatch.make({ locked: O.some("locked") }))
        );
        expect(noOp.result).toMatchObject({
          _tag: "Unchanged",
          reason: "group-unchanged",
          revision: changed.state.revision,
        });
      })
    );

    it.effect(
      "preserves metadata through reorder, panel moves, relocation, and destination-owned merge",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelTwo))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelThreeSplitRight))).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "open-fourth-group",
              OpenPanelCommand.make({
                panel: Panel.make({
                  id: PanelId.make("panel-four"),
                  title: "Panel Four",
                  view: TextPanelView.make({ text: "four" }),
                }),
                placement: RootSplitPlacement.make({
                  side: "bottom",
                  splitId: splitTwo,
                  newGroupId: groupThree,
                }),
              })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            updateGroup(
              "metadata-source",
              groupOne,
              GroupPatch.make({ locked: O.some("locked"), hideHeader: O.some(true), headerPosition: O.some("bottom") })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "reorder-source",
              MovePanelCommand.make({
                panelId: panelOne.id,
                target: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(1)) }),
              })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "move-out",
              MovePanelCommand.make({ panelId: panelOne.id, target: TabPlacement.make({ groupId: groupTwo }) })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "move-in",
              MovePanelCommand.make({ panelId: panelOne.id, target: TabPlacement.make({ groupId: groupOne }) })
            )
          )
        )).state;
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "relocate-source",
              MoveGroupCommand.make({
                groupId: groupOne,
                target: GroupSplitPlacement.make({
                  referenceGroupId: groupThree,
                  side: "left",
                  splitId: SplitId.make("metadata-relocation"),
                }),
              })
            )
          )
        )).state;
        expect(O.getOrThrow(DockWorkspace.findTabs(state, groupOne)).metadata).toMatchObject({
          locked: "locked",
          hideHeader: true,
          headerPosition: "bottom",
        });
        state = (yield* requireChanged(
          yield* engine.transition(
            state,
            updateGroup("metadata-destination", groupTwo, GroupPatch.make({ locked: O.some("no-drop-target") }))
          )
        )).state;
        const merged = yield* requireChanged(
          yield* engine.transition(
            state,
            envelope(
              "merge-source",
              MoveGroupCommand.make({ groupId: groupOne, target: TabPlacement.make({ groupId: groupTwo }) })
            )
          )
        );
        expect(O.getOrThrow(DockWorkspace.findTabs(merged.state, groupTwo)).metadata.locked).toBe("no-drop-target");
      })
    );

    it.effect(
      "rejects missing update targets and cleanly rejects a pre-metadata version-one snapshot",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const panelFailure = yield* Effect.flip(
          engine.transition(
            DockWorkspace.empty,
            updatePanel("missing-panel", PanelId.make("missing-panel"), PanelPatch.make({ title: O.some("Missing") }))
          )
        );
        const groupFailure = yield* Effect.flip(
          engine.transition(
            DockWorkspace.empty,
            updateGroup("missing-group", GroupId.make("missing-group"), GroupPatch.make({ locked: O.some("locked") }))
          )
        );
        const legacyFailure = yield* Effect.flip(
          engine.decodeSnapshot(
            '{"version":1,"workspace":{"kind":"populated","revision":0,"root":{"_tag":"Tabs","groupId":"legacy-group","before":[],"active":{"id":"legacy-panel","title":"Legacy","view":{"kind":"text","text":"legacy"}},"after":[]}}}'
          )
        );
        expect(panelFailure).toMatchObject({ reason: "panel-not-found" });
        expect(groupFailure).toMatchObject({ reason: "group-not-found" });
        expect(legacyFailure).toMatchObject({ _tag: "DockInputError", boundary: "snapshot" });
      })
    );
  });
});

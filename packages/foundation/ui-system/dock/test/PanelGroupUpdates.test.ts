import {
  DockEngine,
  DockEngineLive,
  DockMutationResult,
  DockWorkspace,
  GroupId,
  GroupPatch,
  GroupSplitPlacement,
  MoveGroupCommand,
  MovePanelCommand,
  OpenPanelCommand,
  Panel,
  PanelConstraints,
  PanelConstraintsChangedEvent,
  PanelId,
  PanelPatch,
  RendererKey,
  RootSplitPlacement,
  SplitId,
  TabPlacement,
  TextPanelView,
  UpdateGroupCommand,
  UpdatePanelCommand,
} from "@beep/dock";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
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
  splitTwo,
} from "./Fixtures.ts";
import { preM1Snapshot } from "./fixtures/pre-m1-snapshot.ts";
import type { DockChanged, DockMutationOutcome } from "@beep/dock";

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
        const transition1 = yield* engine.transition(DockWorkspace.empty, openPanelOne);
        const opened = yield* requireChanged(transition1);
        const transition2 = yield* engine.transition(
          opened.state,
          updatePanel("update-title", panelOne.id, PanelPatch.make({ title: O.some("Renamed") }))
        );
        const changed = yield* requireChanged(transition2);
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
        const transition3 = yield* engine.transition(DockWorkspace.empty, openPanelOne);
        const opened = yield* requireChanged(transition3);
        const transition4 = yield* engine.transition(
          opened.state,
          updatePanel(
            "update-title-view",
            panelOne.id,
            PanelPatch.make({ title: O.some("Combined"), view: O.some(TextPanelView.make({ text: "changed" })) })
          )
        );
        const changed = yield* requireChanged(transition4);
        expect(A.map(changed.events, (event) => event.kind)).toEqual(["panelTitleChanged", "panelViewChanged"]);
      })
    );

    it.effect(
      "round-trips render mode and tab component through the snapshot envelope",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition5 = yield* engine.transition(DockWorkspace.empty, openPanelOne);
        const opened = yield* requireChanged(transition5);
        const transition6 = yield* engine.transition(
          opened.state,
          updatePanel(
            "update-render-contract",
            panelOne.id,
            PanelPatch.make({
              renderMode: O.some("always"),
              tabComponent: O.some(O.some(RendererKey.make("custom-tab"))),
            })
          )
        );
        const changed = yield* requireChanged(transition6);
        const encodedSnapshot = yield* engine.encodeSnapshot(changed.state);
        const restored = yield* engine.decodeSnapshot(encodedSnapshot);
        const panel = O.getOrThrow(DockWorkspace.findPanel(restored, panelOne.id));
        expect(panel.renderMode).toBe("always");
        assertSome(panel.tabComponent, RendererKey.make("custom-tab"));
      })
    );

    it.effect(
      "updates and clears panel constraints through PanelPatch",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition7 = yield* engine.transition(DockWorkspace.empty, openPanelOne);
        const opened = yield* requireChanged(transition7);
        const constraints = PanelConstraints.make({ minWidth: O.some(240), maxHeight: O.some(720) });
        const transition8 = yield* engine.transition(
          opened.state,
          updatePanel("update-constraints", panelOne.id, PanelPatch.make({ constraints: O.some(O.some(constraints)) }))
        );
        const constrained = yield* requireChanged(transition8);
        deepStrictEqual(constrained.events, [
          PanelConstraintsChangedEvent.make({
            kind: "panelConstraintsChanged",
            panelId: panelOne.id,
            groupId: groupOne,
            constraints: O.some(constraints),
          }),
        ]);
        assertSome(O.getOrThrow(DockWorkspace.findPanel(constrained.state, panelOne.id)).constraints, constraints);
        const transition9 = yield* engine.transition(
          constrained.state,
          updatePanel("clear-constraints", panelOne.id, PanelPatch.make({ constraints: O.some(O.none()) }))
        );
        const cleared = yield* requireChanged(transition9);
        assertNone(O.getOrThrow(DockWorkspace.findPanel(cleared.state, panelOne.id)).constraints);
      })
    );

    it.effect(
      "decodes a pre-M1 version-one snapshot fixture without constraints",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const restored = yield* engine.decodeSnapshot(preM1Snapshot);
        const panel = O.getOrThrow(DockWorkspace.findPanel(restored, PanelId.make("pre-m1-panel")));
        expect(panel.title).toBe("Legacy");
        assertNone(panel.constraints);
      })
    );

    it.effect(
      "updates group metadata and reports an identical replacement without advancing revision",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition10 = yield* engine.transition(DockWorkspace.empty, openPanelOne);
        const opened = yield* requireChanged(transition10);
        const transition11 = yield* engine.transition(
          opened.state,
          updateGroup("lock-group", groupOne, GroupPatch.make({ locked: O.some("locked") }))
        );
        const changed = yield* requireChanged(transition11);
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
        const transition12 = yield* engine.transition(DockWorkspace.empty, openPanelOne);
        let state = (yield* requireChanged(transition12)).state;
        const transition13 = yield* engine.transition(state, openPanelTwo);
        state = (yield* requireChanged(transition13)).state;
        const transition14 = yield* engine.transition(state, openPanelThreeSplitRight);
        state = (yield* requireChanged(transition14)).state;
        const transition15 = yield* engine.transition(
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
        );
        state = (yield* requireChanged(transition15)).state;
        const transition16 = yield* engine.transition(
          state,
          updateGroup(
            "metadata-source",
            groupOne,
            GroupPatch.make({ locked: O.some("locked"), hideHeader: O.some(true), headerPosition: O.some("bottom") })
          )
        );
        state = (yield* requireChanged(transition16)).state;
        const transition17 = yield* engine.transition(
          state,
          envelope(
            "reorder-source",
            MovePanelCommand.make({
              panelId: panelOne.id,
              target: TabPlacement.make({ groupId: groupOne, index: O.some(S.Natural.make(1)) }),
            })
          )
        );
        state = (yield* requireChanged(transition17)).state;
        const transition18 = yield* engine.transition(
          state,
          envelope(
            "move-out",
            MovePanelCommand.make({ panelId: panelOne.id, target: TabPlacement.make({ groupId: groupTwo }) })
          )
        );
        state = (yield* requireChanged(transition18)).state;
        const transition19 = yield* engine.transition(
          state,
          envelope(
            "move-in",
            MovePanelCommand.make({ panelId: panelOne.id, target: TabPlacement.make({ groupId: groupOne }) })
          )
        );
        state = (yield* requireChanged(transition19)).state;
        const transition20 = yield* engine.transition(
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
        );
        state = (yield* requireChanged(transition20)).state;
        expect(O.getOrThrow(DockWorkspace.findTabs(state, groupOne)).metadata).toMatchObject({
          locked: "locked",
          hideHeader: true,
          headerPosition: "bottom",
        });
        const transition21 = yield* engine.transition(
          state,
          updateGroup("metadata-destination", groupTwo, GroupPatch.make({ locked: O.some("no-drop-target") }))
        );
        state = (yield* requireChanged(transition21)).state;
        const transition22 = yield* engine.transition(
          state,
          envelope(
            "merge-source",
            MoveGroupCommand.make({ groupId: groupOne, target: TabPlacement.make({ groupId: groupTwo }) })
          )
        );
        const merged = yield* requireChanged(transition22);
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

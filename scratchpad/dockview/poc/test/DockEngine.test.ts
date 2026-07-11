import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { DockEngine, DockEngineLive } from "../DockEngine.ts";
import { DockNode, DockWorkspace, OpenPanelCommand, TabPlacement } from "../Domain.ts";
import { emptyDockWorkspace, groupCount, panelsInWorkspace } from "../Reducer.ts";
import {
  activatePanelOne,
  closePanelTwo,
  envelope,
  groupOne,
  groupTwo,
  movePanelOne,
  openPanelOne,
  openPanelThreeSplitRight,
  openPanelTwo,
  panelOne,
  resizeSplit,
} from "./Fixtures.ts";

const workspaceEquals = S.toEquivalence(DockWorkspace);

describe("DockEngine", () => {
  it.layer(DockEngineLive)("live transition layer", (it) => {
    it.effect(
      "runs the greenfield docking scenario and round-trips the snapshot",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state = emptyDockWorkspace;

        state = (yield* engine.transition(state, openPanelOne)).state;
        state = (yield* engine.transition(state, openPanelTwo)).state;
        state = (yield* engine.transition(state, openPanelThreeSplitRight)).state;
        state = (yield* engine.transition(state, resizeSplit)).state;
        state = (yield* engine.transition(state, activatePanelOne)).state;
        state = (yield* engine.transition(state, movePanelOne)).state;
        const closed = yield* engine.transition(state, closePanelTwo);
        state = closed.state;

        expect(closed.events[0].kind).toBe("panelClosed");
        expect(groupCount(state)).toBe(1);
        expect(A.map(panelsInWorkspace(state), (panel) => panel.id)).toEqual(["panel-three", "panel-one"]);

        const populated = yield* DockWorkspace.match(state, {
          empty: () => Effect.die("expected a populated workspace"),
          populated: (value) => Effect.succeed(value),
        });
        const tabs = yield* DockNode.match(populated.root, {
          Tabs: (value) => Effect.succeed(value),
          Split: () => Effect.die("expected the redundant split to collapse"),
        });
        expect(tabs.groupId).toBe(groupTwo);
        expect(tabs.active.id).toBe(panelOne.id);

        const encoded = yield* engine.encodeSnapshot(state);
        const decoded = yield* engine.decodeSnapshot(encoded);
        expect(workspaceEquals(decoded, state)).toBe(true);
      })
    );

    it.effect(
      "rejects a duplicate panel without mutating the caller's state",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const opened = yield* engine.transition(emptyDockWorkspace, openPanelOne);
        const before = opened.state;
        const duplicate = envelope(
          "command-duplicate",
          OpenPanelCommand.make({
            kind: "openPanel",
            panel: panelOne,
            placement: TabPlacement.make({ kind: "tab", groupId: groupOne }),
          })
        );

        const failure = yield* Effect.flip(engine.transition(before, duplicate));
        expect(failure._tag).toBe("DockCommandRejected");
        expect(workspaceEquals(before, opened.state)).toBe(true);
      })
    );

    it.effect(
      "maps malformed command and snapshot inputs to typed boundary errors",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const commandFailure = yield* Effect.flip(engine.decodeCommand({ commandId: "missing-command" }));
        const snapshotFailure = yield* Effect.flip(engine.decodeSnapshot("{"));

        expect(commandFailure._tag).toBe("DockInputError");
        expect(commandFailure.boundary).toBe("command");
        expect(snapshotFailure).toMatchObject({ _tag: "DockInputError", boundary: "snapshot" });
      })
    );
  });
});

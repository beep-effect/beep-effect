import {
  ActivatePanelCommand,
  ClosePanelCommand,
  DockBox,
  DockEngine,
  DockEngineLive,
  DockGeometry,
  DockMutationResult,
  DockWorkspace,
  GeometryOptions,
  GroupMetadata,
  GroupPatch,
  MaximizeGroupCommand,
  MovePanelCommand,
  OpenPanelCommand,
  PopulatedWorkspace,
  projectWorkspace,
  RestoreMaximizedCommand,
  SplitLayout,
  SplitNode,
  SplitRatio,
  TabPlacement,
  TabsNode,
  UpdateGroupCommand,
} from "@beep/dock";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { envelope, groupOne, groupTwo, panelOne, panelThree, panelTwo, splitOne } from "./Fixtures.ts";
import type { DockChanged, DockMutationOutcome } from "@beep/dock";

const requireChanged = (outcome: DockMutationOutcome): Effect.Effect<DockChanged> =>
  DockMutationResult.match(outcome.result, {
    Changed: (changed): Effect.Effect<DockChanged> => Effect.succeed(changed),
    Unchanged: ({ reason }) => Effect.die(`Expected Changed, received ${reason}`),
  });
const requirePopulated = (state: DockWorkspace): Effect.Effect<PopulatedWorkspace> =>
  DockWorkspace.match(state, {
    empty: () => Effect.die("Expected populated workspace"),
    populated: (populated): Effect.Effect<PopulatedWorkspace> => Effect.succeed(populated),
  });

const tabsOne = TabsNode.make({ groupId: groupOne, active: panelOne });
const tabsTwo = TabsNode.make({ groupId: groupTwo, active: panelTwo });
const root = SplitNode.make({
  splitId: splitOne,
  layout: SplitLayout.cases.horizontal.make({ leftRatio: SplitRatio.make(4_000), left: tabsOne, right: tabsTwo }),
});
const workspace = PopulatedWorkspace.make({ root });
const box = DockBox.make({ left: 0, top: 0, width: 100, height: 40 });
const updateVisibility = (groupId: typeof groupOne, visible: boolean) =>
  envelope(
    `visibility-${groupId}-${visible}`,
    UpdateGroupCommand.make({ groupId, patch: GroupPatch.make({ visible: O.some(visible) }) })
  );
const maximize = (groupId = groupOne) => envelope(`maximize-${groupId}`, MaximizeGroupCommand.make({ groupId }));

describe("hidden groups and maximize", () => {
  it.layer(DockEngineLive)("visibility and maximize transitions", (it) => {
    it.effect(
      "hides without losing the ratio, supports all-hidden geometry, and unhides exactly",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition1 = yield* engine.transition(workspace, updateVisibility(groupOne, false));
        const hidden = yield* requireChanged(transition1);
        const oneHidden = projectWorkspace(hidden.state, {
          container: box,
          options: GeometryOptions.make({ gap: 4 }),
        });
        expect(oneHidden.groups).toEqual([{ groupId: groupTwo, box }]);
        expect(oneHidden.sashes).toEqual([]);
        assertNone(DockGeometry.forGroup(oneHidden, groupOne));
        const transition2 = yield* engine.transition(hidden.state, updateVisibility(groupTwo, false));
        const allHidden = yield* requireChanged(transition2);
        expect(projectWorkspace(allHidden.state, { container: box })).toEqual(DockGeometry.empty);
        const transition3 = yield* engine.transition(allHidden.state, updateVisibility(groupOne, true));
        const shown = yield* requireChanged(transition3);
        const shownRoot = (yield* requirePopulated(shown.state)).root;
        const ratio = SplitNode.is(shownRoot) ? SplitLayout.ratio(shownRoot.layout) : SplitRatio.make(5_000);
        expect(ratio).toBe(4_000);
      })
    );

    it.effect(
      "maximizes, restores, and reports idempotent reasons",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition4 = yield* engine.transition(workspace, maximize());
        const maximized = yield* requireChanged(transition4);
        expect(projectWorkspace(maximized.state, { container: box }).groups).toEqual([{ groupId: groupOne, box }]);
        expect(projectWorkspace(maximized.state, { container: box }).sashes).toEqual([]);
        const again = yield* engine.transition(maximized.state, maximize());
        expect(again.result).toMatchObject({ _tag: "Unchanged", reason: "group-already-maximized" });
        const transition5 = yield* engine.transition(
          maximized.state,
          envelope("restore", RestoreMaximizedCommand.make({}))
        );
        const restored = yield* requireChanged(transition5);
        expect(restored.events).toContainEqual(expect.objectContaining({ kind: "groupRestored", groupId: groupOne }));
        const none = yield* engine.transition(
          restored.state,
          envelope("restore-none", RestoreMaximizedCommand.make({}))
        );
        expect(none.result).toMatchObject({ _tag: "Unchanged", reason: "no-group-maximized" });
      })
    );

    it.effect(
      "reveals a hidden group while maximizing it",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition6 = yield* engine.transition(workspace, updateVisibility(groupOne, false));
        const hidden = yield* requireChanged(transition6);
        const transition7 = yield* engine.transition(hidden.state, maximize());
        const result = yield* requireChanged(transition7);
        expect(A.map(result.events, (event) => event.kind)).toEqual(["groupUpdated", "groupMaximized"]);
        expect(O.getOrThrow(DockWorkspace.findTabs(result.state, groupOne)).metadata.visible).toBe(true);
      })
    );

    it.effect(
      "exits maximize for open, close, and move structural commands",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const commands = [
          OpenPanelCommand.make({ panel: panelThree, placement: TabPlacement.make({ groupId: groupOne }) }),
          ClosePanelCommand.make({ panelId: panelOne.id }),
          MovePanelCommand.make({ panelId: panelOne.id, target: TabPlacement.make({ groupId: groupTwo }) }),
        ];
        for (const [index, command] of A.map(commands, (command, index) => [index, command] as const)) {
          const transition8 = yield* engine.transition(workspace, maximize());
          const maximized = yield* requireChanged(transition8);
          const transition9 = yield* engine.transition(maximized.state, envelope(`structural-${index}`, command));
          const result = yield* requireChanged(transition9);
          expect(result.events.at(-1)).toMatchObject({ kind: "groupRestored", groupId: groupOne });
          assertNone((yield* requirePopulated(result.state)).maximized);
        }
      })
    );

    it.effect(
      "applies activation reveal and maximize exit rules",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition10 = yield* engine.transition(workspace, maximize());
        const maximized = yield* requireChanged(transition10);
        const inside = yield* engine.transition(
          maximized.state,
          envelope("activate-inside", ActivatePanelCommand.make({ panelId: panelOne.id }))
        );
        expect(inside.result).toMatchObject({ _tag: "Unchanged", reason: "panel-already-active" });
        const transition11 = yield* engine.transition(
          maximized.state,
          envelope("activate-outside", ActivatePanelCommand.make({ panelId: panelTwo.id }))
        );
        const outside = yield* requireChanged(transition11);
        expect(outside.events).toContainEqual(expect.objectContaining({ kind: "groupRestored" }));
        const transition12 = yield* engine.transition(workspace, updateVisibility(groupTwo, false));
        const hidden = yield* requireChanged(transition12);
        const transition13 = yield* engine.transition(
          hidden.state,
          envelope("activate-hidden", ActivatePanelCommand.make({ panelId: panelTwo.id }))
        );
        const revealed = yield* requireChanged(transition13);
        expect(O.getOrThrow(DockWorkspace.findTabs(revealed.state, groupTwo)).metadata.visible).toBe(true);
        expect(revealed.events).toContainEqual(expect.objectContaining({ kind: "groupUpdated" }));
      })
    );

    it.effect(
      "clears maximize when hidden or when its last panel closes and round-trips snapshots",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition14 = yield* engine.transition(workspace, maximize());
        const maximized = yield* requireChanged(transition14);
        const transition15 = yield* engine.transition(maximized.state, updateVisibility(groupOne, false));
        const hidden = yield* requireChanged(transition15);
        assertNone((yield* requirePopulated(hidden.state)).maximized);
        expect(A.map(hidden.events, (event) => event.kind)).toEqual(["groupUpdated", "groupRestored"]);
        const transition16 = yield* engine.transition(
          maximized.state,
          envelope("close-maximized", ClosePanelCommand.make({ panelId: panelOne.id }))
        );
        const closed = yield* requireChanged(transition16);
        expect(closed.events.at(-1)).toMatchObject({ kind: "groupRestored", groupId: groupOne });
        const snapshotState = PopulatedWorkspace.make({
          root: SplitNode.make({
            splitId: splitOne,
            layout: SplitLayout.cases.horizontal.make({
              left: TabsNode.make({ groupId: groupOne, active: panelOne }),
              right: TabsNode.make({
                groupId: groupTwo,
                active: panelTwo,
                metadata: GroupMetadata.make({ visible: false }),
              }),
            }),
          }),
          maximized: O.some(groupOne),
        });
        const encodedSnapshot = yield* engine.encodeSnapshot(snapshotState);
        const decoded = yield* engine.decodeSnapshot(encodedSnapshot);
        assertSome((yield* requirePopulated(decoded)).maximized, groupOne);
        expect(O.getOrThrow(DockWorkspace.findTabs(decoded, groupTwo)).metadata.visible).toBe(false);
      })
    );

    it.effect(
      "emits exactly one restore event when activating an already-active panel outside the maximized group",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const transition17 = yield* engine.transition(workspace, maximize());
        const maximized = yield* requireChanged(transition17);
        const transition18 = yield* engine.transition(
          maximized.state,
          envelope("activate-restore-only", ActivatePanelCommand.make({ panelId: panelTwo.id }))
        );
        const result = yield* requireChanged(transition18);
        const restoreEvents = A.filter(result.events, (event) => event.kind === "groupRestored");
        expect(restoreEvents).toEqual([expect.objectContaining({ kind: "groupRestored", groupId: groupOne })]);
        assertNone((yield* requirePopulated(result.state)).maximized);
      })
    );
  });
});

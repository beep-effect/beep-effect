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
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
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
        const hidden = yield* requireChanged(yield* engine.transition(workspace, updateVisibility(groupOne, false)));
        const oneHidden = projectWorkspace(hidden.state, box, GeometryOptions.make({ gap: 4 }));
        expect(oneHidden.groups).toEqual([{ groupId: groupTwo, box }]);
        expect(oneHidden.sashes).toEqual([]);
        expect(O.isNone(DockGeometry.forGroup(oneHidden, groupOne))).toBe(true);
        const allHidden = yield* requireChanged(
          yield* engine.transition(hidden.state, updateVisibility(groupTwo, false))
        );
        expect(projectWorkspace(allHidden.state, box)).toEqual(DockGeometry.empty);
        const shown = yield* requireChanged(
          yield* engine.transition(allHidden.state, updateVisibility(groupOne, true))
        );
        const shownRoot = (yield* requirePopulated(shown.state)).root;
        const ratio = SplitNode.is(shownRoot) ? SplitLayout.ratio(shownRoot.layout) : SplitRatio.make(5_000);
        expect(ratio).toBe(4_000);
      })
    );

    it.effect(
      "maximizes, restores, and reports idempotent reasons",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const maximized = yield* requireChanged(yield* engine.transition(workspace, maximize()));
        expect(projectWorkspace(maximized.state, box).groups).toEqual([{ groupId: groupOne, box }]);
        expect(projectWorkspace(maximized.state, box).sashes).toEqual([]);
        const again = yield* engine.transition(maximized.state, maximize());
        expect(again.result).toMatchObject({ _tag: "Unchanged", reason: "group-already-maximized" });
        const restored = yield* requireChanged(
          yield* engine.transition(maximized.state, envelope("restore", RestoreMaximizedCommand.make()))
        );
        expect(restored.events).toContainEqual(expect.objectContaining({ kind: "groupRestored", groupId: groupOne }));
        const none = yield* engine.transition(restored.state, envelope("restore-none", RestoreMaximizedCommand.make()));
        expect(none.result).toMatchObject({ _tag: "Unchanged", reason: "no-group-maximized" });
      })
    );

    it.effect(
      "reveals a hidden group while maximizing it",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const hidden = yield* requireChanged(yield* engine.transition(workspace, updateVisibility(groupOne, false)));
        const result = yield* requireChanged(yield* engine.transition(hidden.state, maximize()));
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
          const maximized = yield* requireChanged(yield* engine.transition(workspace, maximize()));
          const result = yield* requireChanged(
            yield* engine.transition(maximized.state, envelope(`structural-${index}`, command))
          );
          expect(result.events.at(-1)).toMatchObject({ kind: "groupRestored", groupId: groupOne });
        }
      })
    );

    it.effect(
      "applies activation reveal and maximize exit rules",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const maximized = yield* requireChanged(yield* engine.transition(workspace, maximize()));
        const inside = yield* engine.transition(
          maximized.state,
          envelope("activate-inside", ActivatePanelCommand.make({ panelId: panelOne.id }))
        );
        expect(inside.result).toMatchObject({ _tag: "Unchanged", reason: "panel-already-active" });
        const outside = yield* requireChanged(
          yield* engine.transition(
            maximized.state,
            envelope("activate-outside", ActivatePanelCommand.make({ panelId: panelTwo.id }))
          )
        );
        expect(outside.events).toContainEqual(expect.objectContaining({ kind: "groupRestored" }));
        const hidden = yield* requireChanged(yield* engine.transition(workspace, updateVisibility(groupTwo, false)));
        const revealed = yield* requireChanged(
          yield* engine.transition(
            hidden.state,
            envelope("activate-hidden", ActivatePanelCommand.make({ panelId: panelTwo.id }))
          )
        );
        expect(O.getOrThrow(DockWorkspace.findTabs(revealed.state, groupTwo)).metadata.visible).toBe(true);
        expect(revealed.events).toContainEqual(expect.objectContaining({ kind: "groupUpdated" }));
      })
    );

    it.effect(
      "clears maximize when hidden or when its last panel closes and round-trips snapshots",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const maximized = yield* requireChanged(yield* engine.transition(workspace, maximize()));
        const hidden = yield* requireChanged(
          yield* engine.transition(maximized.state, updateVisibility(groupOne, false))
        );
        expect(O.isNone((yield* requirePopulated(hidden.state)).maximized)).toBe(true);
        expect(A.map(hidden.events, (event) => event.kind)).toEqual(["groupUpdated", "groupRestored"]);
        const closed = yield* requireChanged(
          yield* engine.transition(
            maximized.state,
            envelope("close-maximized", ClosePanelCommand.make({ panelId: panelOne.id }))
          )
        );
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
        const decoded = yield* engine.decodeSnapshot(yield* engine.encodeSnapshot(snapshotState));
        expect((yield* requirePopulated(decoded)).maximized).toEqual(O.some(groupOne));
        expect(O.getOrThrow(DockWorkspace.findTabs(decoded, groupTwo)).metadata.visible).toBe(false);
      })
    );
  });
});

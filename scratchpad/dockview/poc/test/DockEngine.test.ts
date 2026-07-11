import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DockEngine, DockEngineLive } from "../DockEngine.ts";
import {
  type DockChanged,
  type DockMutationOutcome,
  DockMutationResult,
  DockNode,
  DockSide,
  DockWorkspace,
  EmptyWorkspace,
  MovePanelCommand,
  OpenPanelCommand,
  Panel,
  PanelId,
  PopulatedWorkspace,
  ResizeSplitCommand,
  SplitLayout,
  SplitNode,
  SplitPlacement,
  SplitRatio,
  TabsNode,
} from "../Domain.ts";
import {
  activatePanelOne,
  clearWorkspace,
  closePanelTwo,
  duplicatePanelWorkspace,
  envelope,
  groupOne,
  groupThree,
  groupTwo,
  movePanelOne,
  openPanelOne,
  openPanelThreeSplitRight,
  openPanelTwo,
  panelOne,
  panelTwo,
  resizeSplit,
  restoreRequest,
  splitOne,
  splitTwo,
} from "./Fixtures.ts";

const workspaceEquals = DockWorkspace.equals;

const requireChanged = (outcome: DockMutationOutcome): Effect.Effect<DockChanged> =>
  DockMutationResult.match(outcome.result, {
    Changed: (changed): Effect.Effect<DockChanged> => Effect.succeed(changed),
    Unchanged: ({ reason }): Effect.Effect<DockChanged> =>
      Effect.die(`Expected a changed transition, received '${reason}'.`),
  });

const requireRootSplit = (state: DockWorkspace): Effect.Effect<SplitNode> =>
  DockWorkspace.match(state, {
    empty: (): Effect.Effect<SplitNode> => Effect.die("expected populated state"),
    populated: (workspace) =>
      DockNode.match(workspace.root, {
        Tabs: (): Effect.Effect<SplitNode> => Effect.die("expected split root"),
        Split: (split): Effect.Effect<SplitNode> => Effect.succeed(split),
      }),
  });

describe("DockEngine", () => {
  it("owns discriminants, defaults, and pure queries on model companions", () => {
    const left = TabsNode.make({ groupId: groupOne, active: panelOne });
    const right = TabsNode.make({ groupId: groupTwo, active: panelTwo });
    const layout = SplitLayout.cases.horizontal.make({ left, right });
    const split = SplitNode.make({ splitId: splitOne, layout });

    expect(layout.axis).toBe("horizontal");
    expect(layout.leftRatio).toBe(5_000);
    expect(split._tag).toBe("Split");
    expect(PanelId.is(panelOne.id)).toBe(true);
    expect(PanelId.equals(panelOne.id)(panelOne.id)).toBe(true);
    expect(Panel.findInTabs(left, panelOne.id)).toEqual(O.some(panelOne));
    expect(TabsNode.findForPanel(split, panelTwo.id)).toEqual(O.some(right));
  });

  it.layer(DockEngineLive)("live transition layer", (it) => {
    it.effect(
      "runs the greenfield docking scenario and round-trips the snapshot",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state: DockWorkspace = DockWorkspace.empty;

        state = (yield* requireChanged(yield* engine.transition(state, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelTwo))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelThreeSplitRight))).state;
        state = (yield* requireChanged(yield* engine.transition(state, resizeSplit))).state;
        state = (yield* requireChanged(yield* engine.transition(state, activatePanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, movePanelOne))).state;
        const closed = yield* requireChanged(yield* engine.transition(state, closePanelTwo));
        state = closed.state;

        expect(closed.events[0].kind).toBe("panelClosed");
        expect(DockWorkspace.groupCount(state)).toBe(1);
        expect(A.map(DockWorkspace.panels(state), (panel) => panel.id)).toEqual(["panel-three", "panel-one"]);

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
      "models valid idempotent commands as explicit unchanged outcomes",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const onePanel = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        const activeAgain = yield* engine.transition(onePanel, activatePanelOne);
        const split = (yield* requireChanged(yield* engine.transition(onePanel, openPanelThreeSplitRight))).state;
        const sameRatio = yield* engine.transition(
          split,
          envelope(
            "command-resize-identical",
            ResizeSplitCommand.make({
              splitId: splitOne,
              ratio: SplitRatio.make(5_000),
            })
          )
        );

        expect(activeAgain.result).toMatchObject({
          _tag: "Unchanged",
          reason: "panel-already-active",
          revision: onePanel.revision,
        });
        expect(sameRatio.result._tag).toBe("Unchanged");
      })
    );

    it.effect(
      "keeps restore revision monotonic and preserves snapshot provenance",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const saved = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        const snapshot = yield* engine.encodeSnapshot(saved);
        const cleared = (yield* requireChanged(yield* engine.transition(saved, clearWorkspace))).state;
        const restored = yield* requireChanged(yield* engine.restore(cleared, snapshot, restoreRequest));
        const event = restored.events[0];

        expect(restored.previousRevision).toBe(2);
        expect(restored.state.revision).toBe(3);
        expect(event).toMatchObject({
          kind: "workspaceRestored",
          sourceRevision: 1,
          installedRevision: 3,
        });

        const identical = yield* engine.restore(saved, snapshot, restoreRequest);
        expect(identical.result).toMatchObject({ _tag: "Unchanged", reason: "snapshot-identical", revision: 1 });
      })
    );

    it.effect(
      "docks an existing panel beside another group in one transition",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        let state: DockWorkspace = DockWorkspace.empty;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelOne))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelTwo))).state;
        state = (yield* requireChanged(yield* engine.transition(state, openPanelThreeSplitRight))).state;

        const moveBeside = envelope(
          "command-move-beside",
          MovePanelCommand.make({
            panelId: panelTwo.id,
            target: SplitPlacement.make({
              referenceGroupId: groupTwo,
              newGroupId: groupThree,
              splitId: splitTwo,
              side: "left",
              newGroupRatio: SplitRatio.make(2_500),
            }),
          })
        );
        const moved = yield* requireChanged(yield* engine.transition(state, moveBeside));

        expect(DockWorkspace.groupCount(moved.state)).toBe(3);
        expect(O.map(DockWorkspace.findTabs(moved.state, groupThree), (tabs) => tabs.active.id)).toEqual(
          O.some(panelTwo.id)
        );
        expect(moved.events[0]).toMatchObject({ kind: "panelMoved", toGroupId: groupThree });
      })
    );

    it.effect(
      "interprets split sizing as the new group's share on every semantic side",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const root = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;

        yield* Effect.forEach(DockSide.Options, (side) =>
          Effect.gen(function* () {
            const opened = yield* requireChanged(
              yield* engine.transition(
                root,
                envelope(
                  `command-side-${side}`,
                  OpenPanelCommand.make({
                    panel: panelTwo,
                    placement: SplitPlacement.make({
                      referenceGroupId: groupOne,
                      newGroupId: groupTwo,
                      splitId: splitOne,
                      side,
                      newGroupRatio: SplitRatio.make(2_500),
                    }),
                  })
                )
              )
            );
            const split = yield* requireRootSplit(opened.state);
            const expected = DockSide.$match({
              left: () => ({ axis: "horizontal", groupId: groupTwo, ratio: 2_500 }),
              right: () => ({ axis: "horizontal", groupId: groupOne, ratio: 7_500 }),
              top: () => ({ axis: "vertical", groupId: groupTwo, ratio: 2_500 }),
              bottom: () => ({ axis: "vertical", groupId: groupOne, ratio: 7_500 }),
            })(side);
            const geometry = yield* SplitLayout.match(split.layout, {
              horizontal: ({ left, leftRatio }) =>
                DockNode.match(left, {
                  Tabs: (tabs) => Effect.succeed({ axis: "horizontal", groupId: tabs.groupId, ratio: leftRatio }),
                  Split: () => Effect.die("expected a tab leaf"),
                }),
              vertical: ({ top, topRatio }) =>
                DockNode.match(top, {
                  Tabs: (tabs) => Effect.succeed({ axis: "vertical", groupId: tabs.groupId, ratio: topRatio }),
                  Split: () => Effect.die("expected a tab leaf"),
                }),
            });

            expect(geometry).toEqual(expected);
          })
        );
      })
    );

    it.effect(
      "uses exact basis-point complements at and below the upper bound",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const root = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;

        yield* Effect.forEach(
          [
            { requested: SplitRatio.make(9_000), expected: 1_000 },
            { requested: SplitRatio.make(7_000), expected: 3_000 },
          ],
          ({ requested, expected }) =>
            Effect.gen(function* () {
              const opened = yield* requireChanged(
                yield* engine.transition(
                  root,
                  envelope(
                    `command-complement-${requested}`,
                    OpenPanelCommand.make({
                      panel: panelTwo,
                      placement: SplitPlacement.make({
                        referenceGroupId: groupOne,
                        newGroupId: groupTwo,
                        splitId: splitOne,
                        side: "right",
                        newGroupRatio: requested,
                      }),
                    })
                  )
                )
              );

              expect(SplitLayout.ratio((yield* requireRootSplit(opened.state)).layout)).toBe(expected);
            })
        );
      })
    );

    it.effect(
      "enforces global identity invariants on the public workspace codec",
      Effect.fnUntraced(function* () {
        const codec = S.fromJsonString(DockWorkspace);
        const encodeFailure = yield* Effect.flip(S.encodeEffect(codec)(duplicatePanelWorkspace));
        const uncheckedJson = yield* S.encodeEffect(S.fromJsonString(S.Unknown))(duplicatePanelWorkspace);
        const decodeFailure = yield* Effect.flip(S.decodeUnknownEffect(codec)(uncheckedJson));

        expect(encodeFailure.message).toContain("globally unique panel, group, and split identifiers");
        expect(decodeFailure.message).toContain("globally unique panel, group, and split identifiers");
      })
    );

    it.effect(
      "refuses to encode globally invalid snapshot state",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const failure = yield* Effect.flip(engine.encodeSnapshot(duplicatePanelWorkspace));

        expect(failure).toMatchObject({ _tag: "DockInvariantViolation", reason: "duplicate-panel-id" });
      })
    );

    it.effect(
      "fails revision exhaustion in the declared typed channel",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const exhausted = EmptyWorkspace.make({
          revision: NonNegativeInt.make(globalThis.Number.MAX_SAFE_INTEGER),
        });
        const failure = yield* Effect.flip(engine.transition(exhausted, openPanelOne));

        expect(failure).toMatchObject({
          _tag: "DockInvariantViolation",
          reason: "revision-exhausted",
        });
      })
    );

    it.effect(
      "preserves idempotent and rejected semantics at the maximum revision",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const opened = (yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne))).state;
        const exhausted = yield* DockWorkspace.match(opened, {
          empty: () => Effect.die("expected populated state"),
          populated: (workspace) =>
            Effect.succeed(
              PopulatedWorkspace.make({
                revision: NonNegativeInt.make(globalThis.Number.MAX_SAFE_INTEGER),
                root: workspace.root,
              })
            ),
        });
        const unchanged = yield* engine.transition(exhausted, activatePanelOne);
        const rejected = yield* Effect.flip(engine.transition(exhausted, openPanelOne));

        expect(unchanged.result).toMatchObject({
          _tag: "Unchanged",
          reason: "panel-already-active",
          revision: globalThis.Number.MAX_SAFE_INTEGER,
        });
        expect(rejected).toMatchObject({
          _tag: "DockCommandRejected",
          reason: "panel-already-open",
        });
      })
    );

    it.effect(
      "rejects a duplicate panel without mutating the caller's state",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const opened = yield* requireChanged(yield* engine.transition(DockWorkspace.empty, openPanelOne));
        const before = opened.state;
        const duplicate = envelope(
          "command-duplicate",
          OpenPanelCommand.make({
            panel: panelOne,
            placement: SplitPlacement.make({
              referenceGroupId: groupOne,
              newGroupId: groupTwo,
              splitId: splitOne,
              side: "right",
            }),
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

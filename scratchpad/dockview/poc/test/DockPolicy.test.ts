import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import { AtomRegistry } from "effect/unstable/reactivity";
import { makeDockAtomsWith } from "../DockAtoms.ts";
import { DockEngine, DockEngineLive, makeDockSnapshotStoreMemory } from "../DockEngine.ts";
import { lockedGroupsPolicy, makePolicyDockEngineLayer } from "../DockPolicy.ts";
import {
  ActivatePanelCommand,
  type DockMutationOutcome,
  DockMutationResult,
  type DockWorkspace,
  GroupMetadata,
  MoveGroupCommand,
  MovePanelCommand,
  OpenPanelCommand,
  Panel,
  PanelId,
  PopulatedWorkspace,
  ResizeSplitCommand,
  SplitId,
  SplitLayout,
  SplitNode,
  SplitPlacement,
  SplitRatio,
  TabPlacement,
  TabsNode,
  TextPanelView,
} from "../Domain.ts";
import {
  dispatch,
  envelope,
  groupOne,
  groupThree,
  groupTwo,
  panelOne,
  panelThree,
  panelTwo,
  saveSnapshot,
  splitOne,
  splitTwo,
} from "./Fixtures.ts";

const panelFour = Panel.make({
  id: PanelId.make("panel-four"),
  title: "Panel Four",
  view: TextPanelView.make({ text: "four" }),
});

const workspaceWith = (locked: "locked" | "no-drop-target"): DockWorkspace =>
  PopulatedWorkspace.make({
    root: SplitNode.make({
      splitId: splitOne,
      layout: SplitLayout.cases.horizontal.make({
        left: TabsNode.make({
          groupId: groupOne,
          active: panelOne,
          after: [panelTwo],
          metadata: GroupMetadata.make({ locked }),
        }),
        right: TabsNode.make({ groupId: groupTwo, active: panelThree }),
      }),
    }),
  });

const moveIntoLocked = envelope(
  "policy-move-in",
  MovePanelCommand.make({ panelId: panelThree.id, target: TabPlacement.make({ groupId: groupOne }) })
);

const requireChangedState = (outcome: DockMutationOutcome): Effect.Effect<DockWorkspace> =>
  DockMutationResult.match(outcome.result, {
    Changed: ({ state }) => Effect.succeed(state),
    Unchanged: ({ reason }) => Effect.die(`Expected changed state, received '${reason}'.`),
  });

describe("DockPolicy", () => {
  it.layer(DockEngineLive)("without policy", (it) => {
    it.effect(
      "treats locked metadata as data and permits a move into the group",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const outcome = yield* engine.transition(workspaceWith("locked"), moveIntoLocked);

        expect(outcome.result._tag).toBe("Changed");
      })
    );
  });

  it.layer(makePolicyDockEngineLayer(lockedGroupsPolicy))("locked-groups policy", (it) => {
    it.effect(
      "vetoes inbound drops while allowing reorder and outbound moves",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const state = workspaceWith("locked");
        const rejection = yield* Effect.flip(engine.transition(state, moveIntoLocked));
        const reordered = yield* engine.transition(
          state,
          envelope(
            "policy-reorder",
            MovePanelCommand.make({
              panelId: panelTwo.id,
              target: TabPlacement.make({ groupId: groupOne, index: O.some(NonNegativeInt.make(0)) }),
            })
          )
        );
        const movedOut = yield* engine.transition(
          state,
          envelope(
            "policy-move-out",
            MovePanelCommand.make({ panelId: panelOne.id, target: TabPlacement.make({ groupId: groupTwo }) })
          )
        );
        const mergeRejection = yield* Effect.flip(
          engine.transition(
            state,
            envelope(
              "policy-merge-in",
              MoveGroupCommand.make({ groupId: groupTwo, target: TabPlacement.make({ groupId: groupOne }) })
            )
          )
        );

        expect(rejection).toMatchObject({ _tag: "DockCommandRejected", reason: "group-locked" });
        expect(reordered.result._tag).toBe("Changed");
        expect(movedOut.result._tag).toBe("Changed");
        expect(mergeRejection).toMatchObject({ _tag: "DockCommandRejected", reason: "group-locked" });
      })
    );

    it.effect(
      "distinguishes locked tabs from no-drop split references and passes other capabilities through",
      Effect.fnUntraced(function* () {
        const engine = yield* DockEngine;
        const splitAgainst = envelope(
          "policy-split-against",
          OpenPanelCommand.make({
            panel: panelFour,
            placement: SplitPlacement.make({
              referenceGroupId: groupOne,
              newGroupId: groupThree,
              splitId: splitTwo,
              side: "right",
            }),
          })
        );
        const allowedSplit = yield* engine.transition(workspaceWith("locked"), splitAgainst);
        const splitRejection = yield* Effect.flip(engine.transition(workspaceWith("no-drop-target"), splitAgainst));
        const activated = yield* engine.transition(
          workspaceWith("locked"),
          envelope("policy-activate", ActivatePanelCommand.make({ panelId: panelTwo.id }))
        );
        const activatedState = yield* requireChangedState(activated);
        const resized = yield* engine.transition(
          activatedState,
          envelope(
            "policy-resize",
            ResizeSplitCommand.make({ splitId: SplitId.make(splitOne), ratio: SplitRatio.make(6_000) })
          )
        );
        const snapshot = yield* engine.encodeSnapshot(yield* requireChangedState(resized));

        expect(allowedSplit.result._tag).toBe("Changed");
        expect(splitRejection).toMatchObject({ _tag: "DockCommandRejected", reason: "group-locked" });
        expect(resized.result._tag).toBe("Changed");
        expect(snapshot).toContain("panel-two");
      })
    );
  });

  it.effect("installs the policy engine in a session without changing the Atom graph", () =>
    Effect.acquireUseRelease(
      makeDockAtomsWith(
        Layer.mergeAll(makePolicyDockEngineLayer(lockedGroupsPolicy), makeDockSnapshotStoreMemory()),
        workspaceWith("locked")
      ),
      Effect.fnUntraced(function* (graph) {
        let publications = 0;
        const unsubscribe = graph.registry.subscribe(graph.workspaceAtom, () => {
          publications += 1;
        });

        graph.registry.set(graph.operationAtom, dispatch(moveIntoLocked));
        const rejection = yield* Effect.flip(
          AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true })
        );
        graph.registry.set(graph.operationAtom, saveSnapshot);
        const saved = yield* AtomRegistry.getResult(graph.registry, graph.operationAtom, { suspendOnWaiting: true });
        unsubscribe();

        expect(rejection).toMatchObject({ _tag: "DockCommandRejected", reason: "group-locked" });
        expect(saved.kind).toBe("snapshotSaved");
        expect(publications).toBe(0);
        expect(graph.registry.get(graph.workspaceAtom).revision).toBe(0);
      }),
      (graph) => Effect.sync(graph.dispose)
    )
  );
});

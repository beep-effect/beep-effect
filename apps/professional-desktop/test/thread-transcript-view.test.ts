import {
  StreamingTurn,
  streamingTurnAtom,
  threadTimelineAtoms,
  unreconciledTurnAtoms,
} from "@beep/agents-client/Chat.atoms";
import * as MdModel from "@beep/md/Md.model";
import { NonNegativeInt } from "@beep/schema/Number";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { ThreadTimeline, TimelineMessageItem, TimelineTurn } from "@beep/workspace-use-cases/aggregates/Thread";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { AsyncResult, AtomRegistry } from "effect/unstable/reactivity";
import { afterEach, describe, expect, it } from "vitest";
import { visibleThreadTurnsAtoms } from "@/chat/ui/Thread.atoms";

const threadId = WorkspaceIdentity.ThreadId.make(7);
const firstTurnId = WorkspaceIdentity.TurnId.make(71);
const editedTurnId = WorkspaceIdentity.TurnId.make(72);
const tailTurnId = WorkspaceIdentity.TurnId.make(73);

const message = (value: string) =>
  MdModel.Document.make({ children: [MdModel.P.make({ children: [MdModel.Text.make({ value })] })] });

const turn = (turnId: WorkspaceIdentity.TurnId, index: number) =>
  TimelineTurn.make({
    turnId,
    turnIndex: NonNegativeInt.make(index),
    items: [TimelineMessageItem.make({ role: "user", content: message(`turn ${index}`) })],
    costMicros: 0,
  });

const timeline = ThreadTimeline.make({
  threadId,
  turns: [turn(firstTurnId, 0), turn(editedTurnId, 1), turn(tailTurnId, 2)],
});

const registryWithTimeline = () =>
  AtomRegistry.make({
    initialValues: [[threadTimelineAtoms(threadId), AsyncResult.success(timeline)]],
  });

const registries: Array<AtomRegistry.AtomRegistry> = [];
const track = (registry: AtomRegistry.AtomRegistry) => {
  registries.push(registry);
  return registry;
};

afterEach(() => {
  for (const registry of registries) registry.dispose();
  registries.length = 0;
});

describe("visibleThreadTurnsAtoms", () => {
  it("shows the full active branch when nothing streams", () => {
    const registry = track(registryWithTimeline());
    const view = registry.get(visibleThreadTurnsAtoms(threadId));
    expect(A.map(view.turns, (item) => item.turnId)).toEqual([firstTurnId, editedTurnId, tailTurnId]);
    expect(view.empty).toBe(false);
    expect(view.failed).toBe(false);
  });

  it("truncates from the edited turn while its replacement streams", () => {
    const registry = track(registryWithTimeline());
    registry.set(
      streamingTurnAtom,
      O.some(
        StreamingTurn.make({
          threadId,
          userContent: message("rewrite"),
          truncateFrom: O.some(editedTurnId),
          blocks: [],
        })
      )
    );
    const view = registry.get(visibleThreadTurnsAtoms(threadId));
    expect(A.map(view.turns, (item) => item.turnId)).toEqual([firstTurnId]);
    expect(O.isSome(view.streaming)).toBe(true);
  });

  it("keeps the tail removed after streaming completes into a receipt-phase turn", () => {
    const registry = track(registryWithTimeline());
    registry.set(streamingTurnAtom, O.none());
    registry.set(unreconciledTurnAtoms(threadId), [
      StreamingTurn.make({
        threadId,
        userContent: message("rewrite"),
        truncateFrom: O.some(editedTurnId),
        reconciliation: "receipt",
        blocks: [],
      }),
    ]);
    const view = registry.get(visibleThreadTurnsAtoms(threadId));
    expect(A.map(view.turns, (item) => item.turnId)).toEqual([firstTurnId]);
    expect(A.length(view.unreconciled)).toBe(1);
    expect(O.isNone(view.streaming)).toBe(true);
  });

  it("ignores a streaming turn belonging to another thread", () => {
    const registry = track(registryWithTimeline());
    registry.set(
      streamingTurnAtom,
      O.some(
        StreamingTurn.make({
          threadId: WorkspaceIdentity.ThreadId.make(99),
          userContent: message("elsewhere"),
          truncateFrom: O.some(editedTurnId),
          blocks: [],
        })
      )
    );
    const view = registry.get(visibleThreadTurnsAtoms(threadId));
    expect(A.map(view.turns, (item) => item.turnId)).toEqual([firstTurnId, editedTurnId, tailTurnId]);
    expect(O.isNone(view.streaming)).toBe(true);
  });

  it("marks no siblings in a linear conversation", () => {
    const registry = track(registryWithTimeline());
    const view = registry.get(visibleThreadTurnsAtoms(threadId));
    expect(HashSet.size(view.siblingTurnIds)).toBe(0);
  });
});

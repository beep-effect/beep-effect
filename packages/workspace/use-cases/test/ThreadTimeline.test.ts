import { Document } from "@beep/md";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { Thread } from "@beep/workspace-use-cases/public";
import { Thread as ServerThread } from "@beep/workspace-use-cases/server";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeThreadThreadTimeline = S.decodeEffect(Thread.ThreadTimeline);
const decodeThreadTimelineTurn = S.decodeEffect(Thread.TimelineTurn);
const decodeWorkspaceIdentityThreadId = S.decodeEffect(WorkspaceIdentity.ThreadId);
const decodeWorkspaceIdentityTurnId = S.decodeEffect(WorkspaceIdentity.TurnId);
const decodeWorkspaceIdentityWorkspaceId = S.decodeEffect(WorkspaceIdentity.WorkspaceId);
const decodeThreadTimelineMessageItem = S.decodeUnknownEffect(Thread.TimelineMessageItem);
const decodeThreadTimelineToolCallItem = S.decodeUnknownEffect(Thread.TimelineToolCallItem);
const decodeUnknownThreadThreadTimeline = S.decodeUnknownEffect(Thread.ThreadTimeline);
const encodeDocument = S.encodeEffect(Document);
const encodeServerThreadAppendTurnInput = S.encodeEffect(ServerThread.AppendTurnInput);
const encodeServerThreadCreateThreadInput = S.encodeEffect(ServerThread.CreateThreadInput);
const encodeServerThreadThreadStoreError = S.encodeEffect(ServerThread.ThreadStoreError);
const encodeThreadThreadTimeline = S.encodeEffect(Thread.ThreadTimeline);

describe("ThreadTimeline", () => {
  it.effect(
    "decodes a thread timeline with resolved message and tool-call items",
    Effect.fnUntraced(function* () {
      const threadId = yield* decodeWorkspaceIdentityThreadId(10);
      const turnId = yield* decodeWorkspaceIdentityTurnId(20);
      const content = yield* encodeDocument(Document.make({ children: [] }));

      const timeline = yield* decodeThreadThreadTimeline({
        threadId: 10,
        turns: [
          {
            turnId: 20,
            turnIndex: 0,
            parentTurnId: null,
            costMicros: 0,
            items: [
              { kind: "message", role: "user", content },
              { kind: "tool_call", name: "search" },
            ],
          },
        ],
      });

      expect(timeline.threadId).toStrictEqual(threadId);
      expect(timeline.turns[0]?.turnId).toStrictEqual(turnId);
      expect(timeline.turns[0]?.costMicros).toBe(0);
      assertSome(
        O.map(A.head(timeline.turns), (turn) => A.map(turn.items, (item) => item.kind)),
        ["message", "tool_call"]
      );
    })
  );

  it.effect(
    "keeps thread input and timeline encoded shapes stable",
    Effect.fnUntraced(function* () {
      const workspaceId = yield* decodeWorkspaceIdentityWorkspaceId(7);
      const threadId = yield* decodeWorkspaceIdentityThreadId(10);
      const turnId = yield* decodeWorkspaceIdentityTurnId(20);
      const content = Document.make({ children: [] });
      const encodedContent = yield* encodeDocument(content);

      const createInput = ServerThread.CreateThreadInput.make({
        title: "Matter intake",
        workspaceId,
      });
      const encodedServerThreadCreateThreadInput = yield* encodeServerThreadCreateThreadInput(createInput);
      expect(encodedServerThreadCreateThreadInput).toStrictEqual({
        title: "Matter intake",
        workspaceId: 7,
      });

      const appendInput = ServerThread.AppendTurnInput.make({
        content,
        role: "user",
        threadId,
      });
      assertNone(appendInput.parentTurnId);
      const encodedServerThreadAppendTurnInput = yield* encodeServerThreadAppendTurnInput(appendInput);
      deepStrictEqual(encodedServerThreadAppendTurnInput, {
        content: encodedContent,
        parentTurnId: O.none(),
        role: "user",
        threadId: 10,
      });

      const wireTimeline = {
        threadId: 10,
        turns: [
          {
            turnId: 20,
            turnIndex: 0,
            parentTurnId: null,
            costMicros: 0,
            items: [
              { kind: "message", role: "user", content: encodedContent },
              { kind: "tool_call", name: "search" },
            ],
          },
        ],
      };
      const timeline = yield* decodeUnknownThreadThreadTimeline(wireTimeline);
      const encodedThreadThreadTimeline = yield* encodeThreadThreadTimeline(timeline);
      expect(encodedThreadThreadTimeline).toStrictEqual(wireTimeline);
      expect(S.is(Thread.TimelineItem)(timeline.turns[0]?.items[0])).toBe(true);

      const pipe1 = yield* decodeThreadTimelineTurn({
        turnId: 20,
        turnIndex: 0,
        parentTurnId: null,
        costMicros: -1,
        items: [],
      }).pipe(Effect.flip);
      expect(pipe1).toBeDefined();

      const unavailable = ServerThread.ThreadStoreUnavailable.make({ reason: "database unavailable" });
      expect(S.is(ServerThread.ThreadStoreError)(unavailable)).toBe(true);
      const encodedServerThreadThreadStoreError = yield* encodeServerThreadThreadStoreError(unavailable);
      expect(encodedServerThreadThreadStoreError).toStrictEqual({
        _tag: "ThreadStoreUnavailable",
        reason: "database unavailable",
      });

      expect(turnId).toStrictEqual(timeline.turns[0]?.turnId);
    })
  );

  it.effect(
    "union-derived guards discriminate timeline items by kind",
    Effect.fnUntraced(function* () {
      const content = yield* encodeDocument(Document.make({ children: [] }));
      const message = yield* decodeThreadTimelineMessageItem({ kind: "message", role: "user", content });
      const toolCall = yield* decodeThreadTimelineToolCallItem({ kind: "tool_call", name: "search" });

      expect(Thread.TimelineItem.guards.message(message)).toBe(true);
      expect(Thread.TimelineItem.guards.message(toolCall)).toBe(false);
      expect(Thread.TimelineItem.guards.tool_call(toolCall)).toBe(true);
      expect(Thread.TimelineItem.guards.tool_call(message)).toBe(false);
    })
  );

  const schemaLawCases: ReadonlyArray<readonly [string, S.Codec<unknown>]> = [
    ["ServerThread.CreateThreadInput", ServerThread.CreateThreadInput],
    ["ServerThread.AppendTurnInput", ServerThread.AppendTurnInput],
    ["ServerThread.SetThreadTitleIfEmptyInput", ServerThread.SetThreadTitleIfEmptyInput],
    ["Thread.TimelineMessageItem", Thread.TimelineMessageItem],
    ["Thread.TimelineToolCallItem", Thread.TimelineToolCallItem],
    ["Thread.TimelineItem", Thread.TimelineItem],
    ["Thread.TimelineTurn", Thread.TimelineTurn],
    ["Thread.ThreadTimeline", Thread.ThreadTimeline],
    ["ServerThread.ThreadStoreNotFound", ServerThread.ThreadStoreNotFound],
    ["ServerThread.ThreadStoreConflict", ServerThread.ThreadStoreConflict],
    ["ServerThread.ThreadStoreUnavailable", ServerThread.ThreadStoreUnavailable],
    ["ServerThread.ThreadStoreError", ServerThread.ThreadStoreError],
  ];
  for (const [name, schema] of schemaLawCases) {
    const equivalent = S.toEquivalence(schema);
    it.effect.prop(
      `round-trips schema-derived ${name}`,
      [schema],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* S.encodeEffect(schema)(value);
          const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
          expect(equivalent(decoded, value)).toBe(true);
        }),
      { arbitrary: fcRuns(5) }
    );
  }

  it.effect(
    "drops the replaced turn and everything after it from the active branch",
    Effect.fnUntraced(function* () {
      const content = yield* encodeDocument(Document.make({ children: [] }));
      const turn = (turnId: number, turnIndex: number, parentTurnId: number | null) => ({
        turnId,
        turnIndex,
        parentTurnId,
        costMicros: 0,
        items: [{ kind: "message", role: "user", content }],
      });

      const firstPrompt = turn(1, 0, null);
      const firstAnswer = turn(2, 1, null);
      const editedPrompt = turn(3, 2, null);
      const supersededAnswer = turn(4, 3, null);
      const replacementPrompt = turn(5, 4, 3);
      const replacementAnswer = turn(6, 5, null);
      const timeline = yield* decodeUnknownThreadThreadTimeline({
        threadId: 10,
        turns: [firstPrompt, firstAnswer, editedPrompt, supersededAnswer, replacementPrompt, replacementAnswer],
      });

      const branch = Thread.activeBranchTurns(timeline.turns);

      expect(A.map(branch, (t) => Number(t.turnId))).toEqual([1, 2, 5, 6]);
    })
  );

  it.effect(
    "keeps a timeline with no edits intact, in turn order",
    Effect.fnUntraced(function* () {
      const content = yield* encodeDocument(Document.make({ children: [] }));
      const timeline = yield* decodeThreadThreadTimeline({
        threadId: 10,
        turns: [
          {
            turnId: 2,
            turnIndex: 1,
            parentTurnId: null,
            costMicros: 0,
            items: [{ kind: "message", role: "assistant", content }],
          },
          {
            turnId: 1,
            turnIndex: 0,
            parentTurnId: null,
            costMicros: 0,
            items: [{ kind: "message", role: "user", content }],
          },
        ],
      });

      expect(A.map(Thread.activeBranchTurns(timeline.turns), (t) => Number(t.turnId))).toEqual([1, 2]);
    })
  );

  it.effect(
    "ignores parent links that cannot describe a replacement",
    Effect.fnUntraced(function* () {
      const content = yield* encodeDocument(Document.make({ children: [] }));
      const turn = (turnId: number, turnIndex: number, parentTurnId: number | null) => ({
        turnId,
        turnIndex,
        parentTurnId,
        costMicros: 0,
        items: [{ kind: "message", role: "user", content }],
      });

      const parentsItself = turn(1, 0, 1);
      const parentsMissingTurn = turn(2, 1, 9);
      const parentsLaterTurn = turn(3, 2, 4);
      const timeline = yield* decodeUnknownThreadThreadTimeline({
        threadId: 10,
        turns: [parentsItself, parentsMissingTurn, parentsLaterTurn, turn(4, 3, null)],
      });

      expect(
        A.map(Thread.activeBranchTurns(timeline.turns), (t) => Number(t.turnId)),
        "an unresolvable link replaces nothing, so no real turn is lost from the transcript"
      ).toEqual([1, 2, 3, 4]);
    })
  );
});

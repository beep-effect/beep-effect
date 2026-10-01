import { Document } from "@beep/md";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { Thread } from "@beep/workspace-use-cases/public";
import { Thread as ServerThread } from "@beep/workspace-use-cases/server";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Effect } from "effect";
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
      expect(timeline.turns[0]?.items.map((item) => item.kind)).toEqual(["message", "tool_call"]);
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
      expect(yield* encodeServerThreadCreateThreadInput(createInput)).toStrictEqual({
        title: "Matter intake",
        workspaceId: 7,
      });

      const appendInput = ServerThread.AppendTurnInput.make({
        content,
        role: "user",
        threadId,
      });
      assertNone(appendInput.parentTurnId);
      expect(yield* encodeServerThreadAppendTurnInput(appendInput)).toStrictEqual({
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
      expect(yield* encodeThreadThreadTimeline(timeline)).toStrictEqual(wireTimeline);
      expect(S.is(Thread.TimelineItem)(timeline.turns[0]?.items[0])).toBe(true);

      expect(
        yield* decodeThreadTimelineTurn({
          turnId: 20,
          turnIndex: 0,
          parentTurnId: null,
          costMicros: -1,
          items: [],
        }).pipe(Effect.flip)
      ).toBeDefined();

      const unavailable = ServerThread.ThreadStoreUnavailable.make({ reason: "database unavailable" });
      expect(S.is(ServerThread.ThreadStoreError)(unavailable)).toBe(true);
      expect(yield* encodeServerThreadThreadStoreError(unavailable)).toStrictEqual({
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

  // Editing a turn appends a replacement parented to the turn it replaces. The
  // transcript used to render every turn in index order, so the exchange an edit
  // promised to discard reappeared the moment streaming finished — and the model
  // was handed it as history.
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

      const timeline = yield* decodeUnknownThreadThreadTimeline({
        threadId: 10,
        turns: [
          turn(1, 0, null), // first prompt
          turn(2, 1, null), // its answer
          turn(3, 2, null), // second prompt        <- edited
          turn(4, 3, null), // its answer           <- superseded
          turn(5, 4, 3), //    replacement prompt   <- replaces turn 3
          turn(6, 5, null), // the replacement's answer
        ],
      });

      const branch = Thread.activeBranchTurns(timeline.turns);

      expect(branch.map((t) => Number(t.turnId))).toEqual([1, 2, 5, 6]);
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

      expect(Thread.activeBranchTurns(timeline.turns).map((t) => Number(t.turnId))).toEqual([1, 2]);
    })
  );

  // Corrupt parent links must never truncate the transcript: a reader would lose
  // real turns. An unresolvable link degrades to "this turn replaces nothing".
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

      const timeline = yield* decodeUnknownThreadThreadTimeline({
        threadId: 10,
        turns: [
          turn(1, 0, 1), // parents itself
          turn(2, 1, 9), // parents a turn that does not exist
          turn(3, 2, 4), // parents a turn that has not happened yet
          turn(4, 3, null),
        ],
      });

      expect(Thread.activeBranchTurns(timeline.turns).map((t) => Number(t.turnId))).toEqual([1, 2, 3, 4]);
    })
  );
});

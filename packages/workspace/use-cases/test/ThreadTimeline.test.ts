import { Document } from "@beep/md";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns } from "@beep/test-utils";
import { Thread } from "@beep/workspace-use-cases/public";
import { Thread as ServerThread } from "@beep/workspace-use-cases/server";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("ThreadTimeline", () => {
  it.effect(
    "decodes a thread timeline with resolved message and tool-call items",
    Effect.fnUntraced(function* () {
      const threadId = yield* WorkspaceIdentity.ThreadId.decodeEffect(10);
      const turnId = yield* WorkspaceIdentity.TurnId.decodeEffect(20);
      const content = yield* Document.encodeEffect(Document.make({ children: [] }));

      const timeline = yield* Thread.ThreadTimeline.decodeEffect({
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
      const workspaceId = yield* WorkspaceIdentity.WorkspaceId.decodeEffect(7);
      const threadId = yield* WorkspaceIdentity.ThreadId.decodeEffect(10);
      const turnId = yield* WorkspaceIdentity.TurnId.decodeEffect(20);
      const content = Document.make({ children: [] });
      const encodedContent = yield* S.encodeEffect(Document)(content);

      const createInput = ServerThread.CreateThreadInput.make({
        title: "Matter intake",
        workspaceId,
      });
      expect(yield* S.encodeEffect(ServerThread.CreateThreadInput)(createInput)).toStrictEqual({
        title: "Matter intake",
        workspaceId: 7,
      });

      const appendInput = ServerThread.AppendTurnInput.make({
        content,
        role: "user",
        threadId,
      });
      expect(O.isNone(appendInput.parentTurnId)).toBe(true);
      expect(yield* S.encodeEffect(ServerThread.AppendTurnInput)(appendInput)).toStrictEqual({
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
      const timeline = yield* S.decodeUnknownEffect(Thread.ThreadTimeline)(wireTimeline);
      expect(yield* S.encodeEffect(Thread.ThreadTimeline)(timeline)).toStrictEqual(wireTimeline);
      expect(Thread.TimelineItem.is(timeline.turns[0]?.items[0])).toBe(true);

      expect(
        yield* S.decodeEffect(Thread.TimelineTurn)({
          turnId: 20,
          turnIndex: 0,
          parentTurnId: null,
          costMicros: -1,
          items: [],
        }).pipe(Effect.flip)
      ).toBeDefined();

      const unavailable = ServerThread.ThreadStoreUnavailable.make({ reason: "database unavailable" });
      expect(ServerThread.ThreadStoreError.is(unavailable)).toBe(true);
      expect(yield* S.encodeEffect(ServerThread.ThreadStoreError)(unavailable)).toStrictEqual({
        _tag: "ThreadStoreUnavailable",
        reason: "database unavailable",
      });

      expect(turnId).toStrictEqual(timeline.turns[0]?.turnId);
    })
  );

  it("union-derived guards discriminate timeline items by kind", () => {
    const content = Document.encodeSync(Document.make({ children: [] }));
    const message = S.decodeSync(Thread.TimelineMessageItem)({ kind: "message", role: "user", content });
    const toolCall = S.decodeSync(Thread.TimelineToolCallItem)({ kind: "tool_call", name: "search" });

    expect(Thread.TimelineItem.guards.message(message)).toBe(true);
    expect(Thread.TimelineItem.guards.message(toolCall)).toBe(false);
    expect(Thread.TimelineItem.guards.tool_call(toolCall)).toBe(true);
    expect(Thread.TimelineItem.guards.tool_call(message)).toBe(false);
  });

  it("schema-derived arbitraries round-trip through exported schemas", () => {
    const schemas: ReadonlyArray<S.Codec<unknown>> = [
      ServerThread.CreateThreadInput,
      ServerThread.AppendTurnInput,
      ServerThread.SetThreadTitleIfEmptyInput,
      Thread.TimelineMessageItem,
      Thread.TimelineToolCallItem,
      Thread.TimelineItem,
      Thread.TimelineTurn,
      Thread.ThreadTimeline,
      ServerThread.ThreadStoreNotFound,
      ServerThread.ThreadStoreConflict,
      ServerThread.ThreadStoreUnavailable,
      ServerThread.ThreadStoreError,
    ];

    for (const schema of schemas) {
      const decode = S.decodeUnknownSync(schema);
      const encode = S.encodeSync(schema);
      const equivalent = S.toEquivalence(schema);
      fc.assert(
        fc.property(S.toArbitrary(schema)(fc), (value) => equivalent(decode(encode(value)), value)),
        fcRuns(5)
      );
    }
  });

  // Editing a turn appends a replacement parented to the turn it replaces. The
  // transcript used to render every turn in index order, so the exchange an edit
  // promised to discard reappeared the moment streaming finished — and the model
  // was handed it as history.
  it.effect(
    "drops the replaced turn and everything after it from the active branch",
    Effect.fnUntraced(function* () {
      const content = yield* S.encodeEffect(Document)(Document.make({ children: [] }));
      const turn = (turnId: number, turnIndex: number, parentTurnId: number | null) => ({
        turnId,
        turnIndex,
        parentTurnId,
        costMicros: 0,
        items: [{ kind: "message", role: "user", content }],
      });

      const timeline = yield* S.decodeUnknownEffect(Thread.ThreadTimeline)({
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
      const content = yield* S.encodeEffect(Document)(Document.make({ children: [] }));
      const timeline = yield* S.decodeEffect(Thread.ThreadTimeline)({
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
      const content = yield* S.encodeEffect(Document)(Document.make({ children: [] }));
      const turn = (turnId: number, turnIndex: number, parentTurnId: number | null) => ({
        turnId,
        turnIndex,
        parentTurnId,
        costMicros: 0,
        items: [{ kind: "message", role: "user", content }],
      });

      const timeline = yield* S.decodeUnknownEffect(Thread.ThreadTimeline)({
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

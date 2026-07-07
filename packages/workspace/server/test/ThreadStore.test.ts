import { Document, P, Text } from "@beep/md";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { makeInMemoryThreadStore } from "@beep/workspace-server/aggregates/Thread";
import { ThreadStoreRepoTestSchemas } from "@beep/workspace-server/test";
import { SetThreadTitleIfEmptyInput } from "@beep/workspace-use-cases/aggregates/Thread/server";
import { describe, expect, it } from "@effect/vitest";
import { Effect, HashMap } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeWorkspaceId = S.decodeUnknownEffect(WorkspaceIdentity.WorkspaceId);
const SetThreadTitleIfEmptyInputArbitrary = S.toArbitrary(SetThreadTitleIfEmptyInput);
const { InMemoryState, MessageEntityInput, ThreadEntityInput, TurnEntityInput } = ThreadStoreRepoTestSchemas;
const InMemoryStateArbitrary = S.toArbitrary(InMemoryState);
const MessageEntityInputArbitrary = S.toArbitrary(MessageEntityInput);
const ThreadEntityInputArbitrary = S.toArbitrary(ThreadEntityInput);
const TurnEntityInputArbitrary = S.toArbitrary(TurnEntityInput);
const docOf = (value: string) => Document.make({ children: [P.make({ children: [Text.make({ value })] })] });

const schemaRoundTrips = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): boolean => {
  const encoded = S.encodeSync(schema)(value);
  const decoded = S.decodeUnknownSync(schema)(encoded);
  return Eq.equals(decoded, value) || S.toEquivalence(schema)(decoded, value);
};

describe("ThreadStore in-memory", () => {
  it.effect(
    "creates a thread, appends ordered turns, and projects a timeline",
    Effect.fnUntraced(function* () {
      const store = yield* makeInMemoryThreadStore();
      const workspaceId = yield* decodeWorkspaceId(2);

      const thread = yield* store.createThread({ title: "Matter intake", workspaceId });
      expect(thread.title).toBe("Matter intake");

      const threads = yield* store.listThreads(workspaceId);
      expect(threads.map((t) => t.id)).toEqual([thread.id]);

      const first = yield* store.appendTurn({
        threadId: thread.id,
        parentTurnId: O.none(),
        role: "user",
        content: docOf("Hello"),
      });
      expect(first.turn.turnIndex).toBe(0);
      expect(first.message.role).toBe("user");

      const second = yield* store.appendTurn({
        threadId: thread.id,
        parentTurnId: O.some(first.turn.id),
        role: "assistant",
        content: docOf("Hi there"),
      });
      expect(second.turn.turnIndex).toBe(1);
      expect(O.getOrNull(second.turn.parentTurnId)).toStrictEqual(first.turn.id);

      const timeline = yield* store.timeline(thread.id);
      expect(timeline.threadId).toStrictEqual(thread.id);
      expect(timeline.turns.map((turn) => turn.turnIndex)).toEqual([0, 1]);
      expect(timeline.turns.every((turn) => turn.costMicros === 0)).toBe(true);

      const firstItem = timeline.turns[0]?.items[0];
      expect(firstItem?.kind).toBe("message");
      if (firstItem?.kind === "message") {
        expect(firstItem.role).toBe("user");
      }
      const secondItem = timeline.turns[1]?.items[0];
      expect(secondItem?.kind).toBe("message");
      if (secondItem?.kind === "message") {
        expect(secondItem.role).toBe("assistant");
      }
    })
  );

  it.effect(
    "fails with ThreadStoreNotFound when appending to an unknown thread",
    Effect.fnUntraced(function* () {
      const store = yield* makeInMemoryThreadStore();
      const missing = yield* S.decodeUnknownEffect(WorkspaceIdentity.ThreadId)(999);
      const error = yield* store
        .appendTurn({ threadId: missing, parentTurnId: O.none(), role: "user", content: docOf("x") })
        .pipe(Effect.flip);
      expect(error._tag).toBe("ThreadStoreNotFound");
    })
  );

  it.effect(
    "sets an empty thread title once",
    Effect.fnUntraced(function* () {
      const store = yield* makeInMemoryThreadStore();
      const workspaceId = yield* decodeWorkspaceId(2);

      const thread = yield* store.createThread({ title: "New thread", workspaceId });

      yield* store.setTitleIfEmpty({
        threadId: thread.id,
        emptyTitle: "New thread",
        title: "Draft fee memo",
      });
      yield* store.setTitleIfEmpty({
        threadId: thread.id,
        emptyTitle: "New thread",
        title: "Ignored replacement",
      });

      const threads = yield* store.listThreads(workspaceId);
      expect(A.map(threads, (thread) => thread.title)).toEqual(["Draft fee memo"]);
    })
  );

  it("generates valid set-title inputs from the production schema", () => {
    fc.assert(
      fc.property(SetThreadTitleIfEmptyInputArbitrary, (input) => {
        expect(input.emptyTitle.length).toBeGreaterThan(0);
        expect(input.title.length).toBeGreaterThan(0);
      })
    );
  });

  it("keeps crispened construction schema encoded shapes stable", () => {
    expect(
      S.encodeSync(ThreadEntityInput)(
        ThreadEntityInput.make({
          id: PosInt.make(1),
          title: "Matter intake",
          workspaceId: PosInt.make(2),
        })
      )
    ).toEqual({ id: 1, title: "Matter intake", workspaceId: 2 });

    expect(
      S.encodeSync(TurnEntityInput)(
        TurnEntityInput.make({
          id: PosInt.make(3),
          messageId: PosInt.make(4),
          parentTurnId: null,
          threadId: PosInt.make(1),
          turnIndex: NonNegativeInt.make(0),
        })
      )
    ).toEqual({ id: 3, messageId: 4, parentTurnId: null, threadId: 1, turnIndex: 0 });

    expect(
      S.encodeSync(MessageEntityInput)(
        MessageEntityInput.make({
          content: docOf("Hello"),
          id: PosInt.make(4),
          role: "assistant",
          threadId: PosInt.make(1),
          turnId: PosInt.make(3),
        })
      )
    ).toEqual({
      content: {
        _tag: "document",
        children: [{ _tag: "p", children: [{ _tag: "text", value: "Hello" }] }],
      },
      id: 4,
      role: "assistant",
      threadId: 1,
      turnId: 3,
    });

    const encodedState = S.encodeSync(InMemoryState)(InMemoryState.make({}));
    expect(encodedState.nextId).toBe(1);
    expect(HashMap.size(encodedState.messages)).toBe(0);
    expect(HashMap.size(encodedState.threads)).toBe(0);
    expect(HashMap.size(encodedState.turns)).toBe(0);
  });

  it("round-trips crispened construction schemas from derived arbitraries", () => {
    fc.assert(
      fc.property(ThreadEntityInputArbitrary, (value) => schemaRoundTrips(ThreadEntityInput, value)),
      {
        numRuns: 25,
      }
    );
    fc.assert(
      fc.property(TurnEntityInputArbitrary, (value) => schemaRoundTrips(TurnEntityInput, value)),
      {
        numRuns: 25,
      }
    );
    fc.assert(
      fc.property(MessageEntityInputArbitrary, (value) => schemaRoundTrips(MessageEntityInput, value)),
      {
        numRuns: 25,
      }
    );
    fc.assert(
      fc.property(InMemoryStateArbitrary, (value) => schemaRoundTrips(InMemoryState, value)),
      {
        numRuns: 25,
      }
    );
  });

  it.effect(
    "fails with ThreadStoreNotFound when setting the title for an unknown thread",
    Effect.fnUntraced(function* () {
      const store = yield* makeInMemoryThreadStore();
      const missing = yield* S.decodeUnknownEffect(WorkspaceIdentity.ThreadId)(999);
      const error = yield* store
        .setTitleIfEmpty({ threadId: missing, emptyTitle: "New thread", title: "Missing" })
        .pipe(Effect.flip);
      expect(error._tag).toBe("ThreadStoreNotFound");
    })
  );
});

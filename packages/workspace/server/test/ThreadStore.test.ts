import { Document, P, Text } from "@beep/md";
import { CuidState } from "@beep/schema/Cuid";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { makeInMemoryThreadStore, ThreadStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Thread";
import { ThreadStoreRepoTestSchemas } from "@beep/workspace-server/test";
import { SetThreadTitleIfEmptyInput } from "@beep/workspace-use-cases/aggregates/Thread/server";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Clock, DateTime, Effect, Exit, HashMap, Layer } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { FastCheck as fc, TestClock } from "effect/testing";

const decodeWorkspaceId = S.decodeUnknownEffect(WorkspaceIdentity.WorkspaceId);
const SetThreadTitleIfEmptyInputArbitrary = S.toArbitrary(SetThreadTitleIfEmptyInput)(fc);
const { InMemoryState, MessageEntityInput, ThreadEntityInput, TurnEntityInput } = ThreadStoreRepoTestSchemas;
const InMemoryStateArbitrary = S.toArbitrary(InMemoryState)(fc);
const MessageEntityInputArbitrary = S.toArbitrary(MessageEntityInput)(fc);
const ThreadEntityInputArbitrary = S.toArbitrary(ThreadEntityInput)(fc);
const TurnEntityInputArbitrary = S.toArbitrary(TurnEntityInput)(fc);
const docOf = (value: string) => Document.make({ children: [P.make({ children: [Text.make({ value })] })] });
const CuidTestLayer = CuidState.Default.pipe(Layer.provideMerge(BunCrypto.layer));
const makeTestThreadStore = makeInMemoryThreadStore().pipe(provideScopedLayer(CuidTestLayer));

const makeYieldingCuidLayer = () => {
  let randomCall = 0;
  const YieldingCryptoLayer = Layer.succeed(
    Crypto.Crypto,
    Crypto.make({
      digest: Effect.fn("ThreadStoreTest.yieldingDigest")(function* (_algorithm, data) {
        yield* Effect.yieldNow;
        const digest = new Uint8Array(64);
        for (let index = 0; index < digest.length; index++) {
          digest[index] = ((data[index % data.length] ?? 0) + index) % 256;
        }
        return digest;
      }),
      randomBytes: (size) => new Uint8Array(size).fill(++randomCall),
    })
  );
  return CuidState.Default.pipe(Layer.provideMerge(YieldingCryptoLayer));
};

const schemaRoundTrips = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): boolean => {
  const encoded = S.encodeSync(schema)(value);
  const decoded = S.decodeUnknownSync(schema)(encoded);
  return Eq.equals(decoded, value) || S.toEquivalence(schema)(decoded, value);
};

describe("ThreadStore in-memory", () => {
  it.effect(
    "creates a thread, appends ordered turns, and projects a timeline",
    Effect.fnUntraced(function* () {
      const store = yield* makeTestThreadStore;
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
    "atomically persists concurrent threads and turns while public-id generation yields",
    Effect.fnUntraced(function* () {
      const concurrency = 8;
      const store = yield* makeInMemoryThreadStore().pipe(provideScopedLayer(makeYieldingCuidLayer()));
      const workspaceId = yield* decodeWorkspaceId(2);

      const created = yield* Effect.all(
        A.makeBy(concurrency, (index) => store.createThread({ title: `Concurrent ${index}`, workspaceId })),
        { concurrency }
      );
      const persisted = yield* store.listThreads(workspaceId);

      expect(persisted).toHaveLength(concurrency);
      expect(new Set(A.map(persisted, (thread) => thread.id)).size).toBe(concurrency);

      const thread = created[0];
      expect(thread).toBeDefined();
      if (thread === undefined) {
        return;
      }

      const appended = yield* Effect.all(
        A.makeBy(concurrency, (index) =>
          store.appendTurn({
            threadId: thread.id,
            parentTurnId: O.none(),
            role: "user",
            content: docOf(`Concurrent ${index}`),
          })
        ),
        { concurrency }
      );
      const timeline = yield* store.timeline(thread.id);

      expect(timeline.turns).toHaveLength(concurrency);
      expect(A.map(timeline.turns, (turn) => turn.turnIndex)).toEqual(A.makeBy(concurrency, (index) => index));
      expect(new Set(A.map(appended, ({ turn }) => turn.id)).size).toBe(concurrency);
      expect(new Set(A.map(appended, ({ message }) => message.id)).size).toBe(concurrency);
    })
  );

  it.effect(
    "fails with ThreadStoreNotFound when appending to an unknown thread",
    Effect.fnUntraced(function* () {
      const store = yield* makeTestThreadStore;
      const missing = yield* S.decodeEffect(WorkspaceIdentity.ThreadId)(999);
      const error = yield* store
        .appendTurn({ threadId: missing, parentTurnId: O.none(), role: "user", content: docOf("x") })
        .pipe(Effect.flip);
      expect(error._tag).toBe("ThreadStoreNotFound");
    })
  );

  it.effect(
    "maps public-id generation failures to ThreadStoreUnavailable",
    Effect.fnUntraced(function* () {
      let digestCalls = 0;
      const FailingCryptoLayer = Layer.succeed(
        Crypto.Crypto,
        Crypto.make({
          digest: (_algorithm, data) =>
            digestCalls++ === 0
              ? Effect.succeed(data)
              : Effect.fail(
                  PlatformError.systemError({
                    _tag: "Unknown",
                    module: "ThreadStoreTest",
                    method: "digest",
                  })
                ),
          randomBytes: (size) => new Uint8Array(size).fill(1),
        })
      );
      const FailingCuidLayer = CuidState.Default.pipe(Layer.provideMerge(FailingCryptoLayer));
      const store = yield* makeInMemoryThreadStore().pipe(provideScopedLayer(FailingCuidLayer));
      const workspaceId = yield* decodeWorkspaceId(2);
      const error = yield* store.createThread({ title: "Unavailable", workspaceId }).pipe(Effect.flip);

      expect(error._tag).toBe("ThreadStoreUnavailable");
      expect(error.reason).toBe("generate Thread public id failed");
    })
  );

  it.effect(
    "preserves public-id generator initialization failures as typed store errors",
    Effect.fnUntraced(function* () {
      const initializationFailure = PlatformError.systemError({
        _tag: "Unknown",
        module: "ThreadStoreTest",
        method: "digest",
      });
      const FailingInitializationCryptoLayer = Layer.succeed(
        Crypto.Crypto,
        Crypto.make({
          digest: () => Effect.fail(initializationFailure),
          randomBytes: (size) => new Uint8Array(size).fill(1),
        })
      );
      const exit = yield* Effect.exit(
        Effect.scoped(Layer.build(ThreadStoreInMemoryLayer.pipe(Layer.provide(FailingInitializationCryptoLayer))))
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasFails(exit.cause)).toBe(true);
        expect(Cause.hasDies(exit.cause)).toBe(false);
        expect(Cause.squash(exit.cause)).toMatchObject({
          _tag: "ThreadStoreUnavailable",
          reason: "initialize public id generator failed",
        });
      }
    })
  );

  it.effect(
    "sets an empty thread title once",
    Effect.fnUntraced(function* () {
      const store = yield* makeTestThreadStore;
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
      fcRuns(25)
    );
    fc.assert(
      fc.property(TurnEntityInputArbitrary, (value) => schemaRoundTrips(TurnEntityInput, value)),
      fcRuns(25)
    );
    fc.assert(
      fc.property(MessageEntityInputArbitrary, (value) => schemaRoundTrips(MessageEntityInput, value)),
      fcRuns(25)
    );
    fc.assert(
      fc.property(InMemoryStateArbitrary, (value) => schemaRoundTrips(InMemoryState, value)),
      fcRuns(25)
    );
  });

  it.effect(
    "fails with ThreadStoreNotFound when setting the title for an unknown thread",
    Effect.fnUntraced(function* () {
      const store = yield* makeTestThreadStore;
      const missing = yield* S.decodeEffect(WorkspaceIdentity.ThreadId)(999);
      const error = yield* store
        .setTitleIfEmpty({ threadId: missing, emptyTitle: "New thread", title: "Missing" })
        .pipe(Effect.flip);
      expect(error._tag).toBe("ThreadStoreNotFound");
    })
  );

  // Audit stamps were filled with the row's entity id, so thread 1 was created
  // at 1970-01-01T00:00:00.001Z and the sidebar showed every conversation as
  // "Dec 31" (1969, in any negative UTC offset). The clock is the only source of
  // a timestamp: under the test clock every stamp must be *exactly* the current
  // time, which the old id-derived stamps never were.
  it.effect(
    "stamps rows from the clock, and a rename advances updatedAt without restamping createdAt",
    Effect.fnUntraced(function* () {
      const store = yield* makeTestThreadStore;
      const workspaceId = yield* decodeWorkspaceId(2);
      const createdTime = yield* Clock.currentTimeMillis;

      const thread = yield* store.createThread({ title: "New thread", workspaceId });
      expect(DateTime.toEpochMillis(thread.createdAt)).toBe(createdTime);
      expect(DateTime.toEpochMillis(thread.updatedAt)).toBe(createdTime);

      const { message, turn } = yield* store.appendTurn({
        threadId: thread.id,
        parentTurnId: O.none(),
        role: "user",
        content: docOf("Hello"),
      });
      expect(DateTime.toEpochMillis(turn.createdAt)).toBe(createdTime);
      expect(DateTime.toEpochMillis(message.createdAt)).toBe(createdTime);

      yield* TestClock.adjust("1 minute");
      const renameTime = yield* Clock.currentTimeMillis;
      expect(renameTime).toBeGreaterThan(createdTime);

      yield* store.setTitleIfEmpty(
        SetThreadTitleIfEmptyInput.make({
          threadId: thread.id,
          title: "Renamed",
          emptyTitle: "New thread",
        })
      );
      const [renamed] = yield* store.listThreads(workspaceId);
      expect(renamed?.title).toBe("Renamed");
      expect(DateTime.toEpochMillis(renamed!.createdAt)).toBe(createdTime);
      expect(DateTime.toEpochMillis(renamed!.updatedAt)).toBe(renameTime);
    })
  );
});

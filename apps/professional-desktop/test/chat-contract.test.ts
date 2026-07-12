/**
 * App-level chat-orchestration contract test — the headline SPEC CI acceptance.
 *
 * Proven entirely with an in-memory stack: the deterministic FixtureTurnKernel
 * (no LLM), the in-memory ThreadStore (no PGlite/Tauri), and the in-memory
 * UsageRecordSink. The orchestration operations are exercised directly via
 * their use-case Effects/streams (no rpc transport).
 */
import { assistantContentToDocument } from "@beep/agents-domain/values/AssistantContent";
import { FixtureTurnKernel, fixtureBlocksFor } from "@beep/agents-use-cases/proof";
import { AgentTurnKernel, TurnHistoryItem } from "@beep/agents-use-cases/public";
import * as Md from "@beep/md/Md.model";
import { assertSchemaArbitraryDecodesToSelf, provideScopedLayer } from "@beep/test-utils";
import { ThreadStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Thread";
import { Thread } from "@beep/workspace-use-cases/server";
import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Metric, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeWorkspaceId, userDocument, userParagraphDocument } from "@/chat/ChatFixtures";
import { documentToPlainText, makeChatOperations } from "@/chat/ChatOrchestrator";
import { makeInMemoryUsageRecordSink } from "@/chat/UsageRecordSink";
import type { IndexedBlock, TurnHistoryItem as TurnHistoryItemType } from "@beep/agents-use-cases/public";

// Build the chat operations + the usage Ref over the provided in-memory stack.
const makeStack = Effect.gen(function* () {
  const store = yield* Thread.ThreadStore;
  const kernel = yield* AgentTurnKernel;
  const { ref, sink } = yield* makeInMemoryUsageRecordSink;
  return { operations: makeChatOperations(store, kernel, sink), usageRef: ref };
});

const TestCryptoLayer = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (_algorithm, data) => Effect.succeed(data),
    randomBytes: (size) => new Uint8Array(size).fill(1),
  })
);
const ThreadStoreTestLayer = ThreadStoreInMemoryLayer.pipe(Layer.provide(TestCryptoLayer));
const StackLayer = Layer.merge(ThreadStoreTestLayer, FixtureTurnKernel);

type MessageItem = { readonly role: Thread.TimelineMessageItem["role"]; readonly content: Md.Document.Type };

const messageItems = (timeline: Thread.ThreadTimeline): ReadonlyArray<MessageItem> =>
  A.flatMap(timeline.turns, (turn) =>
    A.flatMap(
      turn.items,
      (item): ReadonlyArray<MessageItem> =>
        item.kind === "message" ? [{ role: item.role, content: item.content }] : []
    )
  );

const userTurns = (timeline: Thread.ThreadTimeline): ReadonlyArray<Thread.TimelineTurn> =>
  A.filter(timeline.turns, (turn) => A.some(turn.items, (item) => item.kind === "message" && item.role === "user"));

describe("@beep/professional-desktop chat contract", () => {
  it.effect("happy path: send streams fixture blocks, persists user+assistant turns, appends one usage record", () =>
    Effect.gen(function* () {
      const { operations, usageRef } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);

      const thread = yield* operations.createThread(workspaceId, "Contract");
      const content = userDocument("Hi");

      const expectedBlocks = fixtureBlocksFor([{ role: "user", text: "Hi" }]);
      const emitted = yield* Stream.runCollect(operations.sendMessage(thread.id, content));

      // 1) the stream emits the fixture's deterministic blocks
      expect(emitted).toHaveLength(expectedBlocks.length);
      expect(emitted[0]).toStrictEqual(expectedBlocks[0]);
      expect([...emitted]).toStrictEqual([...expectedBlocks]);

      // 2) the timeline shows a user turn then an assistant turn whose content
      // is the lifted Document
      const timeline = yield* operations.getTimeline(thread.id);
      const items = messageItems(timeline);
      expect(items.map((m) => m.role)).toEqual(["user", "assistant"]);
      expect(items[0]?.content).toStrictEqual(content);
      expect(items[1]?.content).toStrictEqual(assistantContentToDocument([...expectedBlocks]));

      // 3) exactly one usage record, provider "fixture"
      const usage = yield* Ref.get(usageRef);
      expect(usage).toHaveLength(1);
      expect(usage[0]?.provider).toBe("fixture");

      // The successful stream records completion and duration telemetry in the
      // same Effect runtime that executed the contract.
      const metrics = yield* Metric.snapshot;
      const completed = O.getOrThrow(
        A.findFirst(
          metrics,
          (snapshot) => snapshot.id === "agents_chat_turns_completed_total" && snapshot.type === "Counter"
        )
      );
      const duration = O.getOrThrow(
        A.findFirst(metrics, (snapshot) => snapshot.id === "agents_chat_turn_duration" && snapshot.type === "Histogram")
      );
      expect(completed.type).toBe("Counter");
      expect(completed.type === "Counter" ? completed.state.count : 0).not.toBe(0);
      expect(duration.type).toBe("Histogram");
      expect(duration.type === "Histogram" ? duration.state.count : 0).toBeGreaterThan(0);
    }).pipe(provideScopedLayer(StackLayer))
  );

  it.effect("derives a thread title from the first non-empty user line without overwriting existing titles", () =>
    Effect.gen(function* () {
      const { operations } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);
      const longTitle = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-title-that-will-be-truncated";

      const trimmed = yield* operations.createThread(workspaceId, "New thread");
      const leadingBlank = yield* operations.createThread(workspaceId, "New thread");
      const empty = yield* operations.createThread(workspaceId, "New thread");
      const truncated = yield* operations.createThread(workspaceId, "New thread");
      const existing = yield* operations.createThread(workspaceId, "Pinned title");

      yield* Stream.runDrain(operations.sendMessage(trimmed.id, userDocument("  Draft fee memo  \nignored")));
      yield* Stream.runDrain(
        operations.sendMessage(leadingBlank.id, userParagraphDocument(["   ", "Later block title"]))
      );
      yield* Stream.runDrain(operations.sendMessage(empty.id, userDocument("  \n  ")));
      yield* Stream.runDrain(operations.sendMessage(truncated.id, userDocument(longTitle)));
      yield* Stream.runDrain(operations.sendMessage(existing.id, userDocument("Replacement title")));

      const titles = A.map(yield* operations.listThreads(workspaceId), (thread) => thread.title);
      expect(titles).toEqual(
        expect.arrayContaining([
          "Draft fee memo",
          "Later block title",
          "New thread",
          Str.slice(0, 64)(longTitle),
          "Pinned title",
        ])
      );
      expect(titles).not.toContain("Replacement title");
    }).pipe(provideScopedLayer(StackLayer))
  );

  it.effect("continues the assistant stream when best-effort title persistence fails", () =>
    Effect.gen(function* () {
      const store = yield* Thread.ThreadStore;
      const kernel = yield* AgentTurnKernel;
      const { ref: usageRef, sink } = yield* makeInMemoryUsageRecordSink;
      const titleFailingStore = Thread.ThreadStore.of({
        ...store,
        setTitleIfEmpty: Effect.fn("Thread.ThreadStore.setTitleIfEmpty")(function* () {
          return yield* Thread.ThreadStoreUnavailable.make({ reason: "title unavailable" });
        }),
      });
      const operations = makeChatOperations(titleFailingStore, kernel, sink);
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "New thread");
      const content = userDocument("Best effort title");

      const expectedBlocks = fixtureBlocksFor([{ role: "user", text: "Best effort title" }]);
      const emitted = yield* Stream.runCollect(operations.sendMessage(thread.id, content));

      expect([...emitted]).toStrictEqual([...expectedBlocks]);
      const timeline = yield* operations.getTimeline(thread.id);
      expect(messageItems(timeline).map((m) => m.role)).toEqual(["user", "assistant"]);
      const usage = yield* Ref.get(usageRef);
      expect(usage).toHaveLength(1);
    }).pipe(provideScopedLayer(StackLayer))
  );

  it.effect("derives a thread title when editing the first user turn from blank content", () =>
    Effect.gen(function* () {
      const { operations } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "New thread");

      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("  \n  ")));
      const timeline = yield* operations.getTimeline(thread.id);
      const firstUserTurn = O.getOrThrow(A.head(userTurns(timeline)));

      yield* Stream.runDrain(operations.editMessage(thread.id, firstUserTurn.turnId, userDocument("Edited title")));

      const titles = A.map(yield* operations.listThreads(workspaceId), (item) => item.title);
      expect(titles).toContain("Edited title");
    }).pipe(provideScopedLayer(StackLayer))
  );

  it.effect("updates a derived thread title when editing the first user turn", () =>
    Effect.gen(function* () {
      const { operations } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "New thread");

      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("Draft memo")));
      const timeline = yield* operations.getTimeline(thread.id);
      const firstUserTurn = O.getOrThrow(A.head(userTurns(timeline)));

      yield* Stream.runDrain(operations.editMessage(thread.id, firstUserTurn.turnId, userDocument("Final memo")));

      const titles = A.map(yield* operations.listThreads(workspaceId), (item) => item.title);
      expect(titles).toContain("Final memo");
      expect(titles).not.toContain("Draft memo");
    }).pipe(provideScopedLayer(StackLayer))
  );

  it.effect("does not derive a thread title when editing a later user turn", () =>
    Effect.gen(function* () {
      const { operations } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "New thread");

      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("  \n  ")));
      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument(" \t ")));
      const timeline = yield* operations.getTimeline(thread.id);
      const laterUserTurn = O.getOrThrow(A.get(userTurns(timeline), 1));

      yield* Stream.runDrain(
        operations.editMessage(thread.id, laterUserTurn.turnId, userDocument("Later edited title"))
      );

      const titles = A.map(yield* operations.listThreads(workspaceId), (item) => item.title);
      expect(titles).toContain("New thread");
      expect(titles).not.toContain("Later edited title");
    }).pipe(provideScopedLayer(StackLayer))
  );

  it("projects table cells, youtube embeds, blockquotes, and task lists into turn-history plain text", () => {
    const content = Md.Document.make({
      children: [
        Md.Table.make({
          headerRow: true,
          children: [
            Md.TableRow.make({
              children: [
                Md.TableCell.make({ children: [Md.Text.make({ value: "Feature" })] }),
                Md.TableCell.make({ children: [Md.Text.make({ value: "Status" })] }),
              ],
            }),
            Md.TableRow.make({
              children: [
                Md.TableCell.make({ children: [Md.Text.make({ value: "Rich blocks" })] }),
                Md.TableCell.make({ children: [Md.Code.make({ value: "Ready" })] }),
              ],
            }),
          ],
        }),
        Md.YouTube.make({ videoId: "dQw4w9WgXcQ" }),
        Md.BlockQuote.make({ children: [Md.P.make({ children: [Md.Text.make({ value: "Quoted note" })] })] }),
        Md.TaskList.make({
          children: [Md.TaskItem.make({ checked: false, children: [Md.Text.make({ value: "Ship docs" })] })],
        }),
      ],
    });

    const text = documentToPlainText(content);

    // Structured nodes are projected by the canonical @beep/md plain-text
    // renderer (not a bespoke walker): tables stay tab-separated, youtube embeds
    // surface their watch URL, blockquotes recurse, and task items keep their text.
    expect(text).toContain("Feature\tStatus");
    expect(text).toContain("Rich blocks\tReady");
    expect(text).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(text).toContain("Quoted note");
    expect(text).toContain("Ship docs");
  });

  it.effect("cancel leaves no partial assistant row and appends no usage record", () =>
    Effect.gen(function* () {
      const { operations, usageRef } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "Cancel");

      const firstBlockSeen = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();

      // Park the stream after the first block so it never reaches onEnd; the
      // test interrupts it before completion.
      const parked = operations.sendMessage(thread.id, userDocument("Hi")).pipe(
        Stream.tap(() =>
          Effect.gen(function* () {
            yield* Deferred.succeed(firstBlockSeen, void 0);
            yield* Deferred.await(release);
          })
        )
      );

      const fiber = yield* Effect.forkChild(Stream.runDrain(parked));
      yield* Deferred.await(firstBlockSeen);
      yield* Fiber.interrupt(fiber);

      // timeline shows the user turn but NO assistant turn
      const timeline = yield* operations.getTimeline(thread.id);
      const items = messageItems(timeline);
      expect(items.map((m) => m.role)).toEqual(["user"]);

      // no usage record appended on interrupt
      const usage = yield* Ref.get(usageRef);
      expect(usage).toHaveLength(0);
    }).pipe(provideScopedLayer(StackLayer))
  );

  it.effect("timeline ordering: a second send appends after the first assistant turn", () =>
    Effect.gen(function* () {
      const { operations } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "Ordering");

      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("first")));
      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("second")));

      const timeline = yield* operations.getTimeline(thread.id);
      // user, assistant, user, assistant — strictly increasing turn indices
      expect(timeline.turns.map((t) => t.turnIndex)).toEqual([0, 1, 2, 3]);
      const items = messageItems(timeline);
      expect(items.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
      expect(documentToPlainText(items[2]!.content)).toBe("second");
    }).pipe(provideScopedLayer(StackLayer))
  );

  it.effect("projects role-tagged turn history for the kernel", () =>
    Effect.gen(function* () {
      const historyRef = yield* Ref.make<ReadonlyArray<TurnHistoryItemType>>(A.empty());
      const CaptureKernel = Layer.succeed(AgentTurnKernel)({
        streamTurn: (history: ReadonlyArray<TurnHistoryItemType>): Stream.Stream<IndexedBlock> => {
          const indexedBlocks = A.map(fixtureBlocksFor(history), (block, index): IndexedBlock => ({ block, index }));
          return Stream.unwrap(Ref.set(historyRef, history).pipe(Effect.as(Stream.fromIterable(indexedBlocks))));
        },
      });

      yield* Effect.gen(function* () {
        const { operations } = yield* makeStack;
        const workspaceId = decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "History");

        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("first")));
        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("second")));
      }).pipe(provideScopedLayer(Layer.merge(ThreadStoreTestLayer, CaptureKernel)));

      const history = yield* Ref.get(historyRef);
      const firstAssistantText = documentToPlainText(
        assistantContentToDocument(fixtureBlocksFor([{ role: "user", text: "first" }]))
      );
      const encodeTurnHistoryItem = S.encodeUnknownEffect(TurnHistoryItem);
      const decodeTurnHistoryItem = S.decodeUnknownEffect(TurnHistoryItem);
      const wireHistory = yield* Effect.forEach(history, (item) => encodeTurnHistoryItem(item));
      const decodedHistory = yield* Effect.forEach(wireHistory, (item) => decodeTurnHistoryItem(item));

      expect(A.map(history, (item) => item.role)).toEqual(["user", "assistant", "user"]);
      expect(A.map(history, (item) => item.text)).toEqual(["first", firstAssistantText, "second"]);
      expect(wireHistory).toStrictEqual([
        { role: "user", text: "first" },
        { role: "assistant", text: firstAssistantText },
        { role: "user", text: "second" },
      ]);
      expect(decodedHistory).toStrictEqual(history);
    })
  );

  it("round-trips schema-derived turn history items through the wire contract", () => {
    assertSchemaArbitraryDecodesToSelf(TurnHistoryItem, { numRuns: 25 });
  });
});

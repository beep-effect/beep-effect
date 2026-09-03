/**
 * App-level chat-orchestration contract test — the headline SPEC CI acceptance.
 *
 * Proven entirely with an in-memory stack: the deterministic FixtureTurnKernel
 * (no LLM), the in-memory ThreadStore (no PGlite/Tauri), and the in-memory
 * UsageRecordSink. The orchestration operations are exercised directly via
 * their use-case Effects/streams (no rpc transport).
 */
import { assistantContentToDocument } from "@beep/agents-domain/values/AssistantContent";
import { FixtureTurnKernel, fixtureBlocksFor, fixtureEventsFor } from "@beep/agents-use-cases/proof";
import { AgentTurnKernel, TurnGenerationError, TurnHistoryItem } from "@beep/agents-use-cases/public";
import * as Md from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { assertSchemaArbitraryDecodesToSelf, provideScopedLayer } from "@beep/test-utils";
import { ThreadStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Thread";
import { Thread } from "@beep/workspace-use-cases/server";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { TestClock } from "effect/testing";
import { decodeWorkspaceId, userDocument, userParagraphDocument } from "@/chat/ChatFixtures";
import { documentToPlainText, makeChatOperations } from "@/chat/ChatOrchestrator";
import { makeInMemoryUsageRecordSink } from "@/chat/UsageRecordSink";
import type { TurnHistoryItem as TurnHistoryItemType } from "@beep/agents-use-cases/public";

// Build the chat operations + the usage Ref over the provided in-memory stack.
const makeStack = Effect.gen(function* () {
  const store = yield* Thread.ThreadStore;
  const kernel = yield* AgentTurnKernel;
  const { ref, sink } = yield* makeInMemoryUsageRecordSink;
  return { operations: yield* makeChatOperations(store, kernel, sink), usageRef: ref };
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
const encodeTurnHistoryItem = S.encodeUnknownEffect(TurnHistoryItem);
const decodeTurnHistoryItem = S.decodeUnknownEffect(TurnHistoryItem);

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
  it.effect(
    "happy path: send streams fixture blocks, persists user+assistant turns, appends one usage record",
    Effect.fnUntraced(function* () {
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

      // 3) exactly one finalized usage row with the fixture kernel's exact
      // provider accounting and an explicit absent Activity link.
      const usage = yield* Ref.get(usageRef);
      expect(usage).toHaveLength(1);
      const record = O.getOrThrow(A.head(usage));
      expect(record.provider).toBe("fixture");
      expect(record.model).toBe("fixture");
      expect(record.orgId).toBe(thread.orgId);
      expect(O.getOrThrow(record.inputTokens)).toBe(12);
      expect(O.getOrThrow(record.outputTokens)).toBe(8);
      expect(O.getOrThrow(record.totalTokens)).toBe(20);
      expect(O.getOrThrow(record.latencyMillis)).toBe(0);
      expect(O.getOrThrow(record.costUsdApproxMicros)).toBe(0);
      expect(O.isNone(record.activityId)).toBe(true);
      expect(record.metadata.activityLinkStatus).toBe("unavailable_no_activity_store");
      expect(record.metadata.stopReason).toBe("stop");

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
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "derives a thread title from the first non-empty user line without overwriting existing titles",
    Effect.fnUntraced(function* () {
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
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "continues the assistant stream when best-effort title persistence fails",
    Effect.fnUntraced(function* () {
      const store = yield* Thread.ThreadStore;
      const kernel = yield* AgentTurnKernel;
      const { ref: usageRef, sink } = yield* makeInMemoryUsageRecordSink;
      const titleFailingStore = Thread.ThreadStore.of({
        ...store,
        setTitleIfEmpty: Effect.fn("Thread.ThreadStore.setTitleIfEmpty")(function* () {
          return yield* Thread.ThreadStoreUnavailable.make({ reason: "title unavailable" });
        }),
      });
      const operations = yield* makeChatOperations(titleFailingStore, kernel, sink);
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
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "derives a thread title when editing the first user turn from blank content",
    Effect.fnUntraced(function* () {
      const { operations } = yield* makeStack;
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "New thread");

      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("  \n  ")));
      const timeline = yield* operations.getTimeline(thread.id);
      const firstUserTurn = O.getOrThrow(A.head(userTurns(timeline)));

      yield* Stream.runDrain(operations.editMessage(thread.id, firstUserTurn.turnId, userDocument("Edited title")));

      const titles = A.map(yield* operations.listThreads(workspaceId), (item) => item.title);
      expect(titles).toContain("Edited title");
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "updates a derived thread title when editing the first user turn",
    Effect.fnUntraced(function* () {
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
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "does not derive a thread title when editing a later user turn",
    Effect.fnUntraced(function* () {
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
    }, provideScopedLayer(StackLayer))
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
        Md.YouTube.make({ videoId: "M7lc1UVf-VE" }),
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
    expect(text).toContain("https://www.youtube.com/watch?v=M7lc1UVf-VE");
    expect(text).toContain("Quoted note");
    expect(text).toContain("Ship docs");
  });

  // Cancelling still keeps no partial model output and bills nothing. What it no
  // longer does is erase the turn entirely: persisting nothing left the user's
  // prompt with no answer, so a reload orphaned it and — because the kernel is
  // handed the whole conversation — the next prompt arrived after an unanswered
  // request and the model answered the abandoned one instead.
  it.effect(
    "cancel records a stopped turn, keeps no partial content, and bills nothing",
    Effect.fnUntraced(function* () {
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

      const fiber = yield* parked.pipe(Stream.runDrain, Effect.forkChild);
      yield* Deferred.await(firstBlockSeen);
      yield* Fiber.interrupt(fiber);

      // the prompt is answered by a turn that says it was stopped
      const timeline = yield* operations.getTimeline(thread.id);
      const items = messageItems(timeline);
      expect(items.map((m) => m.role)).toEqual(["user", "assistant"]);

      // the stopped turn carries the marker and none of the streamed content
      const stopped = items[1];
      const stoppedText = renderPlainTextUnsafe(stopped!.content).trim();
      expect(stoppedText).toBe("(stopped)");

      // still no usage record on interrupt
      const usage = yield* Ref.get(usageRef);
      expect(usage).toHaveLength(0);
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "does not expose provider failure details through the chat action error",
    Effect.fnUntraced(function* () {
      const store = yield* Thread.ThreadStore;
      const { sink } = yield* makeInMemoryUsageRecordSink;
      const kernel = AgentTurnKernel.of({
        streamTurn: () =>
          Stream.fail(
            TurnGenerationError.make({
              message: "provider token=private-value failed at /home/operator/credentials",
            })
          ),
      });
      const operations = yield* makeChatOperations(store, kernel, sink);
      const thread = yield* operations.createThread(decodeWorkspaceId(1), "Redacted failure");
      const error = yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("fail safely"))).pipe(
        Effect.flip
      );

      expect(error.message).toBe("The assistant could not complete this response.");
      expect(error.message).not.toContain("private-value");
      expect(error.message).not.toContain("/home/operator");
    }, provideScopedLayer(ThreadStoreTestLayer))
  );

  it.effect(
    "reports user_persisted repeatedly when assistant persistence fails after the user append",
    Effect.fnUntraced(function* () {
      const store = yield* Thread.ThreadStore;
      const kernel = yield* AgentTurnKernel;
      const { sink } = yield* makeInMemoryUsageRecordSink;
      const histories = yield* Ref.make<ReadonlyArray<ReadonlyArray<TurnHistoryItemType>>>([]);
      const capturingKernel = AgentTurnKernel.of({
        streamTurn: (history) =>
          Stream.unwrap(
            Ref.update(histories, (all) => A.append(all, history)).pipe(Effect.as(kernel.streamTurn(history)))
          ),
      });
      const assistantFailingStore = Thread.ThreadStore.of({
        ...store,
        appendTurn: Effect.fn("Thread.ThreadStore.appendTurn")((input) =>
          input.role === "assistant"
            ? Effect.fail(Thread.ThreadStoreUnavailable.make({ reason: "assistant persistence unavailable" }))
            : store.appendTurn(input)
        ),
      });
      const operations = yield* makeChatOperations(assistantFailingStore, capturingKernel, sink);
      const thread = yield* operations.createThread(decodeWorkspaceId(1), "Persistence failure");

      yield* Stream.runDrain(
        operations.sendMessage(thread.id, userDocument("Keep the durable prompt"), "after-user-append")
      ).pipe(Effect.exit);

      expect(yield* operations.getTurnRequestStatus("after-user-append")).toBe("user_persisted");
      expect(yield* operations.getTurnRequestStatus("after-user-append")).toBe("user_persisted");
      yield* Stream.runDrain(
        operations.sendMessage(thread.id, userDocument("Do not append this yet"), "after-orphaned-user")
      ).pipe(Effect.exit);
      const timeline = yield* operations.getTimeline(thread.id);
      expect(messageItems(timeline).map((item) => item.role)).toEqual(["user"]);
      const captured = yield* Ref.get(histories);
      expect(A.map(captured, (history) => A.map(history, (item) => item.role))).toStrictEqual([["user"]]);
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "reports persisted when interrupted after the assistant append commits",
    Effect.fnUntraced(function* () {
      const store = yield* Thread.ThreadStore;
      const kernel = yield* AgentTurnKernel;
      const { sink } = yield* makeInMemoryUsageRecordSink;
      const assistantCommitted = yield* Deferred.make<void>();
      const releaseAssistantAppend = yield* Deferred.make<void>();
      const gatedStore = Thread.ThreadStore.of({
        ...store,
        appendTurn: Effect.fn("Thread.ThreadStore.appendTurn")((input) =>
          input.role === "assistant"
            ? store.appendTurn(input).pipe(
                Effect.tap(() => Deferred.succeed(assistantCommitted, undefined)),
                Effect.tap(() => Deferred.await(releaseAssistantAppend))
              )
            : store.appendTurn(input)
        ),
      });
      const operations = yield* makeChatOperations(gatedStore, kernel, sink);
      const thread = yield* operations.createThread(decodeWorkspaceId(1), "Committed assistant");
      const send = yield* operations
        .sendMessage(thread.id, userDocument("Keep the answer"), "assistant-committed")
        .pipe(Stream.runDrain, Effect.forkChild);

      yield* Deferred.await(assistantCommitted);
      const interrupt = yield* send.pipe(Fiber.interrupt, Effect.forkChild);
      yield* Effect.yieldNow;
      yield* Deferred.succeed(releaseAssistantAppend, undefined);
      yield* Fiber.join(interrupt);

      expect(yield* operations.getTurnRequestStatus("assistant-committed")).toBe("persisted");
      expect(yield* operations.getTurnRequestStatus("assistant-committed")).toBe("persisted");
      const timeline = yield* operations.getTimeline(thread.id);
      expect(messageItems(timeline).map((item) => item.role)).toEqual(["user", "assistant"]);
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "timeline ordering: a second send appends after the first assistant turn",
    Effect.fnUntraced(function* () {
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
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "projects role-tagged turn history for the kernel",
    Effect.fnUntraced(function* () {
      const historyRef = yield* Ref.make<ReadonlyArray<TurnHistoryItemType>>(A.empty());
      const CaptureKernel = Layer.succeed(AgentTurnKernel)({
        streamTurn: (history: ReadonlyArray<TurnHistoryItemType>) =>
          Stream.unwrap(Ref.set(historyRef, history).pipe(Effect.as(Stream.fromIterable(fixtureEventsFor(history))))),
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

  // A turn appends the user message, reads the whole conversation back, and asks
  // the kernel to continue it. Two turns in flight on one thread interleave: both
  // prompts land with no answer between them, so each kernel is handed a history
  // ending in two unanswered requests — and both answer the *first*. Two windows
  // on one thread produced two copies of the reply to the first message and none
  // to the second, and the corruption was persisted.
  //
  // The kernel here blocks until released, which is what forces the two turns to
  // actually overlap; the assertion is on the history each kernel call is given,
  // because that is where the corruption originates.
  it.effect(
    "never hands the kernel a history ending in an unanswered prompt",
    Effect.fnUntraced(function* () {
      const store = yield* Thread.ThreadStore;
      const { sink } = yield* makeInMemoryUsageRecordSink;
      const histories = yield* Ref.make<ReadonlyArray<ReadonlyArray<TurnHistoryItemType>>>([]);
      const release = yield* Deferred.make<void>();

      const gatedKernel = AgentTurnKernel.of({
        streamTurn: (history) =>
          Stream.unwrap(
            Effect.gen(function* () {
              yield* Ref.update(histories, (all) => [...all, history]);
              yield* Deferred.await(release);
              return Stream.fromIterable(fixtureEventsFor(history));
            })
          ),
      });

      const operations = yield* makeChatOperations(store, gatedKernel, sink);
      const workspaceId = decodeWorkspaceId(1);
      const thread = yield* operations.createThread(workspaceId, "Concurrent");

      const first = yield* operations
        .sendMessage(thread.id, userDocument("ALPHA"))
        .pipe(Stream.runDrain, Effect.forkChild);
      // Wait until the first turn is inside the kernel (holding the thread).
      yield* Effect.repeat(Ref.get(histories), { until: (all) => all.length === 1 });

      const second = yield* operations
        .sendMessage(thread.id, userDocument("BRAVO"))
        .pipe(Stream.runDrain, Effect.forkChild);
      // Give the second turn every chance to barge in ahead of the first.
      yield* Effect.yieldNow;
      yield* Effect.yieldNow;

      yield* Deferred.succeed(release, void 0);
      yield* Fiber.join(first);
      yield* Fiber.join(second);

      const seen = yield* Ref.get(histories);
      expect(seen).toHaveLength(2);

      // The second turn's history must already contain the first turn's answer:
      // it must never end in two prompts in a row.
      const secondHistory = seen[1]!;
      expect(secondHistory.map((item) => item.role)).toEqual(["user", "assistant", "user"]);
      // ...and the prompt it is being asked to answer is its own.
      expect(secondHistory[2]!.text).toContain("BRAVO");
    }, provideScopedLayer(ThreadStoreTestLayer))
  );

  it.effect(
    "does not credit another window's persisted turn to a queued request interrupted before append",
    Effect.fnUntraced(function* () {
      const store = yield* Thread.ThreadStore;
      const { sink } = yield* makeInMemoryUsageRecordSink;
      const enteredKernel = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const kernel = AgentTurnKernel.of({
        streamTurn: (history) =>
          Stream.unwrap(
            Deferred.succeed(enteredKernel, undefined).pipe(
              Effect.andThen(Deferred.await(release)),
              Effect.as(Stream.fromIterable(fixtureEventsFor(history)))
            )
          ),
      });
      const operations = yield* makeChatOperations(store, kernel, sink);
      const thread = yield* operations.createThread(decodeWorkspaceId(1), "Two windows");
      const first = yield* operations
        .sendMessage(thread.id, userDocument("ALPHA"), "window-a")
        .pipe(Stream.runDrain, Effect.forkChild);
      yield* Deferred.await(enteredKernel);
      const queued = yield* operations
        .sendMessage(thread.id, userDocument("BRAVO"), "window-b")
        .pipe(Stream.runDrain, Effect.forkChild);
      yield* Effect.yieldNow;
      const interrupt = yield* queued.pipe(Fiber.interrupt, Effect.forkChild);
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(first);
      yield* Fiber.join(interrupt);

      expect(yield* operations.getTurnRequestStatus("window-b")).toBe("not_persisted");
      expect(yield* operations.getTurnRequestStatus("window-b")).toBe("not_persisted");
      const timeline = yield* operations.getTimeline(thread.id);
      expect(
        timeline.turns.some((turn) => turn.items.some((item) => item.kind === "message" && item.role === "assistant"))
      ).toBe(true);
    }, provideScopedLayer(ThreadStoreTestLayer))
  );

  it.effect(
    "isolates request receipts between independently constructed operation sets",
    Effect.fnUntraced(function* () {
      const store = yield* Thread.ThreadStore;
      const kernel = yield* AgentTurnKernel;
      const { sink } = yield* makeInMemoryUsageRecordSink;
      const first = yield* makeChatOperations(store, kernel, sink);
      const second = yield* makeChatOperations(store, kernel, sink);
      const thread = yield* first.createThread(decodeWorkspaceId(1), "Isolated coordinators");

      yield* Stream.runDrain(first.sendMessage(thread.id, userDocument("ALPHA"), "isolated-request"));

      expect(yield* first.getTurnRequestStatus("isolated-request")).toBe("persisted");
      expect(yield* second.getTurnRequestStatus("isolated-request")).toBe("unknown");
    }, provideScopedLayer(StackLayer))
  );

  it.effect(
    "expires terminal request receipts without detached cleanup fibers",
    Effect.fnUntraced(function* () {
      const { operations } = yield* makeStack;
      const thread = yield* operations.createThread(decodeWorkspaceId(1), "Receipt expiry");

      yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("ALPHA"), "expiring-request"));
      expect(yield* operations.getTurnRequestStatus("expiring-request")).toBe("persisted");

      yield* TestClock.adjust(Duration.minutes(5));

      expect(yield* operations.getTurnRequestStatus("expiring-request")).toBe("unknown");
    }, provideScopedLayer(StackLayer))
  );
});

/**
 * App-level chat-orchestration contract test — the headline SPEC CI acceptance.
 *
 * Proven entirely with an in-memory stack: the deterministic FixtureTurnKernel
 * (no LLM), the in-memory ThreadStore (no PGlite/Tauri), and the in-memory
 * UsageRecordSink. The orchestration operations are exercised directly via
 * their use-case Effects/streams (no rpc transport).
 */

import { assistantContentToDocument } from "@beep/agents-domain/values/AssistantContent";
import { UserTurnHistoryItem } from "@beep/agents-use-cases";
import { FixtureTurnKernel, fixtureBlocksFor, fixtureEventsFor } from "@beep/agents-use-cases/proof";
import { AgentTurnKernel, TurnGenerationError, TurnHistoryItem } from "@beep/agents-use-cases/public";
import { UsageRecord } from "@beep/epistemic-domain";
import * as Md from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf, productEntityFixtureInput } from "@beep/test-utils";
import { ThreadStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Thread";
import { Thread } from "@beep/workspace-use-cases/server";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
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
import * as TestClock from "effect/testing/TestClock";
import { decodeWorkspaceId, userDocument, userParagraphDocument } from "@/chat/ChatFixtures";
import { documentToPlainText, makeChatOperations } from "@/chat/ChatOrchestrator";
import { makeInMemoryUsageRecordSink, UsageRecordSink, UsageRecordSinkInMemory } from "@/chat/UsageRecordSink";
import { fcDeepSweepActive, vitestCoverageRunActive } from "../../../vitest.shared.ts";
import type { TurnHistoryItem as TurnHistoryItemType } from "@beep/agents-use-cases/public";

const chatLayerTimeout = vitestCoverageRunActive || fcDeepSweepActive ? "5 minutes" : "10 seconds";

const makeStack = Effect.gen(function* () {
  const store = yield* Thread.ThreadStore;
  const kernel = yield* AgentTurnKernel;
  const { ref, sink } = yield* makeInMemoryUsageRecordSink;
  return { operations: yield* makeChatOperations(store, kernel, sink), usageRef: ref };
});

const TestCryptoLayer = Layer.mergeAll(
  Layer.mock(Digest.Digest)({ digest: (_algorithm, data) => Effect.succeed(data) }),
  Layer.succeed(
    SecureRandom.SecureRandom,
    SecureRandom.make((size) => new Uint8Array(size).fill(1))
  )
);
const ThreadStoreTestLayer = ThreadStoreInMemoryLayer.pipe(Layer.provide(TestCryptoLayer));
const StackLayer = Layer.merge(ThreadStoreTestLayer, FixtureTurnKernel);
const decodeUsageRecord = S.decodeUnknownEffect(UsageRecord);
const usageRecordInput = {
  ...productEntityFixtureInput("EpistemicUsageRecord", 1),
  activityId: null,
  actor: { component: "Runtime", kind: "System" },
  costUsdApproxMicros: null,
  credentialReference: null,
  inputTokens: 12,
  latencyMillis: null,
  metadata: { trace: "fixture" },
  model: "fixture-model",
  outputTokens: 34,
  provider: "fixture",
  totalTokens: 46,
  unitCount: null,
};
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
  it.layer(
    Layer.mergeAll(
      StackLayer,
      Layer.sync(Metric.MetricRegistry, () => new Map())
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "happy path: send streams fixture blocks, persists user+assistant turns, appends one usage record",
      Effect.fnUntraced(function* () {
        const { operations, usageRef } = yield* makeStack;
        const workspaceId = yield* decodeWorkspaceId(1);

        const thread = yield* operations.createThread(workspaceId, "Contract");
        const content = userDocument("Hi");

        const expectedBlocks = fixtureBlocksFor([UserTurnHistoryItem.make({ role: "user", text: "Hi" })]);
        const emitted = yield* Stream.runCollect(operations.sendMessage(thread.id, content));

        expect(emitted).toHaveLength(expectedBlocks.length);
        expect(emitted[0]).toStrictEqual(expectedBlocks[0]);
        expect([...emitted], "the stream emits the fixture's deterministic blocks").toStrictEqual([...expectedBlocks]);

        const timeline = yield* operations.getTimeline(thread.id);
        const items = messageItems(timeline);
        expect(A.map(items, (m) => m.role)).toEqual(["user", "assistant"]);
        expect(items[0]?.content).toStrictEqual(content);
        expect(items[1]?.content, "the assistant turn's content is the lifted Document").toStrictEqual(
          assistantContentToDocument([...expectedBlocks])
        );

        const usage = yield* Ref.get(usageRef);
        expect(
          usage,
          "exactly one finalized usage row, with the fixture's exact provider accounting and an absent Activity link"
        ).toHaveLength(1);
        const record = O.getOrThrow(A.head(usage));
        expect(record.provider).toBe("fixture");
        expect(record.model).toBe("fixture");
        expect(record.orgId).toBe(thread.orgId);
        expect(O.getOrThrow(record.inputTokens)).toBe(12);
        expect(O.getOrThrow(record.outputTokens)).toBe(8);
        expect(O.getOrThrow(record.totalTokens)).toBe(20);
        expect(O.getOrThrow(record.latencyMillis)).toBe(0);
        expect(O.getOrThrow(record.costUsdApproxMicros)).toBe(0);
        assertNone(record.activityId);
        expect(record.metadata.activityLinkStatus).toBe("unavailable_no_activity_store");
        expect(record.metadata.stopReason).toBe("stop");

        const metrics = yield* Metric.snapshot;
        const completed = O.getOrThrow(
          A.findFirst(
            metrics,
            (snapshot) => snapshot.id === "agents_chat_turns_completed_total" && snapshot.type === "Counter"
          )
        );
        const duration = O.getOrThrow(
          A.findFirst(
            metrics,
            (snapshot) => snapshot.id === "agents_chat_turn_duration" && snapshot.type === "Histogram"
          )
        );
        expect(completed.type).toBe("Counter");
        expect(
          completed.type === "Counter" ? completed.state.count : 0,
          "the stream records completion telemetry in the runtime that executed the contract"
        ).not.toBe(0);
        expect(duration.type).toBe("Histogram");
        expect(duration.type === "Histogram" ? duration.state.count : 0).toBeGreaterThan(0);
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "derives a thread title from the first non-empty user line without overwriting existing titles",
      Effect.fnUntraced(function* () {
        const { operations } = yield* makeStack;
        const workspaceId = yield* decodeWorkspaceId(1);
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

        const listThreads1 = yield* operations.listThreads(workspaceId);
        const titles = A.map(listThreads1, (thread) => thread.title);
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
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
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
        const workspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "New thread");
        const content = userDocument("Best effort title");

        const expectedBlocks = fixtureBlocksFor([
          UserTurnHistoryItem.make({ role: "user", text: "Best effort title" }),
        ]);
        const emitted = yield* Stream.runCollect(operations.sendMessage(thread.id, content));

        expect([...emitted]).toStrictEqual([...expectedBlocks]);
        const timeline = yield* operations.getTimeline(thread.id);
        expect(A.map(messageItems(timeline), (m) => m.role)).toEqual(["user", "assistant"]);
        const usage = yield* Ref.get(usageRef);
        expect(usage).toHaveLength(1);
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "derives a thread title when editing the first user turn from blank content",
      Effect.fnUntraced(function* () {
        const { operations } = yield* makeStack;
        const workspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "New thread");

        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("  \n  ")));
        const timeline = yield* operations.getTimeline(thread.id);
        const firstUserTurn = O.getOrThrow(A.head(userTurns(timeline)));

        yield* Stream.runDrain(operations.editMessage(thread.id, firstUserTurn.turnId, userDocument("Edited title")));

        const listThreads2 = yield* operations.listThreads(workspaceId);
        const titles = A.map(listThreads2, (item) => item.title);
        expect(titles).toContain("Edited title");
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "updates a derived thread title when editing the first user turn",
      Effect.fnUntraced(function* () {
        const { operations } = yield* makeStack;
        const workspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "New thread");

        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("Draft memo")));
        const timeline = yield* operations.getTimeline(thread.id);
        const firstUserTurn = O.getOrThrow(A.head(userTurns(timeline)));

        yield* Stream.runDrain(operations.editMessage(thread.id, firstUserTurn.turnId, userDocument("Final memo")));

        const listThreads3 = yield* operations.listThreads(workspaceId);
        const titles = A.map(listThreads3, (item) => item.title);
        expect(titles).toContain("Final memo");
        expect(titles).not.toContain("Draft memo");
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "does not derive a thread title when editing a later user turn",
      Effect.fnUntraced(function* () {
        const { operations } = yield* makeStack;
        const workspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "New thread");

        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("  \n  ")));
        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument(" \t ")));
        const timeline = yield* operations.getTimeline(thread.id);
        const laterUserTurn = O.getOrThrow(A.get(userTurns(timeline), 1));

        yield* Stream.runDrain(
          operations.editMessage(thread.id, laterUserTurn.turnId, userDocument("Later edited title"))
        );

        const listThreads4 = yield* operations.listThreads(workspaceId);
        const titles = A.map(listThreads4, (item) => item.title);
        expect(titles).toContain("New thread");
        expect(titles).not.toContain("Later edited title");
      })
    );
  });

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

    expect(text, "the canonical @beep/md plain-text renderer keeps table cells tab-separated").toContain(
      "Feature\tStatus"
    );
    expect(text).toContain("Rich blocks\tReady");
    expect(text).toContain("https://www.youtube.com/watch?v=M7lc1UVf-VE");
    expect(text).toContain("Quoted note");
    expect(text).toContain("Ship docs");
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "cancel records a stopped turn, keeps no partial content, and bills nothing",
      Effect.fnUntraced(function* () {
        const { operations, usageRef } = yield* makeStack;
        const workspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "Cancel");

        const firstBlockSeen = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();

        const parkedAfterFirstBlock = operations.sendMessage(thread.id, userDocument("Hi")).pipe(
          Stream.tap(() =>
            Effect.gen(function* () {
              yield* Deferred.succeed(firstBlockSeen, void 0);
              yield* Deferred.await(release);
            })
          )
        );

        const fiber = yield* parkedAfterFirstBlock.pipe(Stream.runDrain, Effect.forkChild);
        yield* Deferred.await(firstBlockSeen);
        yield* Fiber.interrupt(fiber);

        const timeline = yield* operations.getTimeline(thread.id);
        const items = messageItems(timeline);
        expect(
          A.map(items, (m) => m.role),
          "a stopped turn answers the prompt, so a reload or the next turn never meets an unanswered request"
        ).toEqual(["user", "assistant"]);

        const stopped = items[1];
        const stoppedText = Str.trim(renderPlainTextUnsafe(stopped!.content));
        expect(stoppedText, "the stopped turn carries the marker and none of the streamed content").toBe("(stopped)");

        const usage = yield* Ref.get(usageRef);
        expect(usage, "an interrupted turn bills nothing").toHaveLength(0);
      })
    );
  });

  it.layer(ThreadStoreTestLayer, { timeout: chatLayerTimeout })("isolated thread store", (it) => {
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
        const decodedWorkspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(decodedWorkspaceId, "Redacted failure");
        const error = yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("fail safely"))).pipe(
          Effect.flip
        );

        expect(error.message).toBe("The assistant could not complete this response.");
        expect(error.message).not.toContain("private-value");
        expect(error.message).not.toContain("/home/operator");
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
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
        const decodedWorkspaceId5 = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(decodedWorkspaceId5, "Persistence failure");

        yield* Stream.runDrain(
          operations.sendMessage(thread.id, userDocument("Keep the durable prompt"), "after-user-append")
        ).pipe(Effect.exit);

        const gotTurnRequestStatus = yield* operations.getTurnRequestStatus("after-user-append");
        expect(gotTurnRequestStatus).toBe("user_persisted");
        const gotTurnRequestStatus6 = yield* operations.getTurnRequestStatus("after-user-append");
        expect(gotTurnRequestStatus6).toBe("user_persisted");
        yield* Stream.runDrain(
          operations.sendMessage(thread.id, userDocument("Do not append this yet"), "after-orphaned-user")
        ).pipe(Effect.exit);
        const timeline = yield* operations.getTimeline(thread.id);
        expect(A.map(messageItems(timeline), (item) => item.role)).toEqual(["user"]);
        const captured = yield* Ref.get(histories);
        expect(A.map(captured, (history) => A.map(history, (item) => item.role))).toStrictEqual([["user"]]);
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
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
        const decodedWorkspaceId7 = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(decodedWorkspaceId7, "Committed assistant");
        const send = yield* operations
          .sendMessage(thread.id, userDocument("Keep the answer"), "assistant-committed")
          .pipe(Stream.runDrain, Effect.forkChild);

        yield* Deferred.await(assistantCommitted);
        const interrupt = yield* send.pipe(Fiber.interrupt, Effect.forkChild);
        yield* Effect.yieldNow;
        yield* Deferred.succeed(releaseAssistantAppend, undefined);
        yield* Fiber.join(interrupt);

        const gotTurnRequestStatus8 = yield* operations.getTurnRequestStatus("assistant-committed");
        expect(gotTurnRequestStatus8).toBe("persisted");
        const gotTurnRequestStatus9 = yield* operations.getTurnRequestStatus("assistant-committed");
        expect(gotTurnRequestStatus9).toBe("persisted");
        const timeline = yield* operations.getTimeline(thread.id);
        expect(A.map(messageItems(timeline), (item) => item.role)).toEqual(["user", "assistant"]);
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "timeline ordering: a second send appends after the first assistant turn",
      Effect.fnUntraced(function* () {
        const { operations } = yield* makeStack;
        const workspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "Ordering");

        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("first")));
        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("second")));

        const timeline = yield* operations.getTimeline(thread.id);
        expect(
          A.map(timeline.turns, (t) => t.turnIndex),
          "turn indices strictly increase"
        ).toEqual([0, 1, 2, 3]);
        const items = messageItems(timeline);
        expect(A.map(items, (m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
        expect(documentToPlainText(items[2]!.content)).toBe("second");
      })
    );
  });

  it.layer(ThreadStoreTestLayer, { timeout: chatLayerTimeout })("isolated thread store", (it) => {
    it.effect(
      "projects role-tagged turn history for the kernel",
      Effect.fnUntraced(function* () {
        const historyRef = yield* Ref.make<ReadonlyArray<TurnHistoryItemType>>(A.empty());
        const captureKernel = AgentTurnKernel.of({
          streamTurn: (history: ReadonlyArray<TurnHistoryItemType>) =>
            Stream.unwrap(Ref.set(historyRef, history).pipe(Effect.as(Stream.fromIterable(fixtureEventsFor(history))))),
        });

        yield* Effect.gen(function* () {
          const { operations } = yield* makeStack;
          const workspaceId = yield* decodeWorkspaceId(1);
          const thread = yield* operations.createThread(workspaceId, "History");

          yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("first")));
          yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("second")));
        }).pipe(Effect.provideService(AgentTurnKernel, captureKernel));

        const history = yield* Ref.get(historyRef);
        const firstAssistantText = documentToPlainText(
          assistantContentToDocument(fixtureBlocksFor([UserTurnHistoryItem.make({ role: "user", text: "first" })]))
        );
        const wireHistory = yield* Effect.forEach(history, (item) => encodeTurnHistoryItem(item), { concurrency: 1 });
        const decodedHistory = yield* Effect.forEach(wireHistory, (item) => decodeTurnHistoryItem(item), {
          concurrency: 1,
        });

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
  });

  it("round-trips schema-derived turn history items through the wire contract", () => {
    assertSchemaArbitraryDecodesToSelf(TurnHistoryItem, { runs: 25 });
  });

  it.layer(ThreadStoreTestLayer, { timeout: chatLayerTimeout })("isolated thread store", (it) => {
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
        const workspaceId = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(workspaceId, "Concurrent");

        const first = yield* operations
          .sendMessage(thread.id, userDocument("ALPHA"))
          .pipe(Stream.runDrain, Effect.forkChild);
        yield* Effect.repeat(Ref.get(histories), { until: (all) => all.length === 1 });

        const second = yield* operations
          .sendMessage(thread.id, userDocument("BRAVO"))
          .pipe(Stream.runDrain, Effect.forkChild);
        yield* Effect.yieldNow;
        yield* Effect.yieldNow;

        yield* Deferred.succeed(release, void 0);
        yield* Fiber.join(first);
        yield* Fiber.join(second);

        const seen = yield* Ref.get(histories);
        expect(seen).toHaveLength(2);

        const secondHistory = seen[1]!;
        expect(
          A.map(secondHistory, (item) => item.role),
          "two in-flight turns serialize: the second history already holds the first answer, never two prompts in a row"
        ).toEqual(["user", "assistant", "user"]);
        expect(secondHistory[2]!.text, "the second turn answers its own prompt, not the first").toContain("BRAVO");
      })
    );
  });

  it.layer(ThreadStoreTestLayer, { timeout: chatLayerTimeout })("isolated thread store", (it) => {
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
        const decodedWorkspaceId10 = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(decodedWorkspaceId10, "Two windows");
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

        const gotTurnRequestStatus11 = yield* operations.getTurnRequestStatus("window-b");
        expect(gotTurnRequestStatus11).toBe("not_persisted");
        const gotTurnRequestStatus12 = yield* operations.getTurnRequestStatus("window-b");
        expect(gotTurnRequestStatus12).toBe("not_persisted");
        const timeline = yield* operations.getTimeline(thread.id);
        expect(
          A.some(timeline.turns, (turn) =>
            A.some(turn.items, (item) => item.kind === "message" && item.role === "assistant")
          )
        ).toBe(true);
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "isolates request receipts between independently constructed operation sets",
      Effect.fnUntraced(function* () {
        const store = yield* Thread.ThreadStore;
        const kernel = yield* AgentTurnKernel;
        const { sink } = yield* makeInMemoryUsageRecordSink;
        const first = yield* makeChatOperations(store, kernel, sink);
        const second = yield* makeChatOperations(store, kernel, sink);
        const decodedWorkspaceId13 = yield* decodeWorkspaceId(1);
        const thread = yield* first.createThread(decodedWorkspaceId13, "Isolated coordinators");

        yield* Stream.runDrain(first.sendMessage(thread.id, userDocument("ALPHA"), "isolated-request"));

        const gotTurnRequestStatus14 = yield* first.getTurnRequestStatus("isolated-request");
        expect(gotTurnRequestStatus14).toBe("persisted");
        const gotTurnRequestStatus15 = yield* second.getTurnRequestStatus("isolated-request");
        expect(gotTurnRequestStatus15).toBe("unknown");
      })
    );
  });

  it.layer(StackLayer, { timeout: chatLayerTimeout })("isolated chat stack", (it) => {
    it.effect(
      "expires terminal request receipts without detached cleanup fibers",
      Effect.fnUntraced(function* () {
        const { operations } = yield* makeStack;
        const decodedWorkspaceId16 = yield* decodeWorkspaceId(1);
        const thread = yield* operations.createThread(decodedWorkspaceId16, "Receipt expiry");

        yield* Stream.runDrain(operations.sendMessage(thread.id, userDocument("ALPHA"), "expiring-request"));
        const gotTurnRequestStatus17 = yield* operations.getTurnRequestStatus("expiring-request");
        expect(gotTurnRequestStatus17).toBe("persisted");

        yield* TestClock.adjust(Duration.minutes(5));

        const gotTurnRequestStatus18 = yield* operations.getTurnRequestStatus("expiring-request");
        expect(gotTurnRequestStatus18).toBe("unknown");
      })
    );
  });

  it.layer(UsageRecordSinkInMemory, { timeout: chatLayerTimeout })("isolated usage sink", (it) => {
    it.effect(
      "serves one memoized in-memory sink through the UsageRecordSink layer",
      Effect.fnUntraced(function* () {
        const sink = yield* UsageRecordSink;
        const again = yield* UsageRecordSink;
        const record = yield* decodeUsageRecord(usageRecordInput);

        expect(again).toBe(sink);
        yield* sink.append(record);
        yield* again.append(record);
      })
    );
  });
});

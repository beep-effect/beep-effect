import {
  ChatClient,
  draftAtoms,
  draftRevisionAtoms,
  runTurnAtom,
  SendTurnRequest,
  StreamingTurn,
  streamingTurnAtom,
  threadTimelineAtoms,
  turnActiveAtom,
  turnErrorAtom,
  unreconciledTurnAtoms,
} from "@beep/agents-client/Chat.atoms";
import { ParagraphBlock, TextInline } from "@beep/agents-domain/values/AssistantContent";
import { ChatActionError } from "@beep/agents-use-cases/public";
import { decodeSafeDocumentUnsafe } from "@beep/md";
import { Document, P as MdP, Text } from "@beep/md/Md.model";
import { NonNegativeInt } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { ThreadTimeline, TimelineMessageItem, TimelineTurn } from "@beep/workspace-use-cases/aggregates/Thread";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Deferred, Duration, Effect, Layer, Match, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { AsyncResult, Atom, AtomRegistry, Reactivity } from "effect/reactivity";
import type * as P from "effect/Predicate";

const threadId = WorkspaceIdentity.ThreadId.make(1);
const safeDocument = (value: string) =>
  decodeSafeDocumentUnsafe(Document.make({ children: [MdP.make({ children: [Text.make({ value })] })] }));
const content = safeDocument("Keep this prompt");
const newerContent = safeDocument("Keep this newer draft");
const assistantBlock = ParagraphBlock.make({
  children: [TextInline.make({ text: "A completed local reply" })],
});

type UncertainStatusKind = "accepted" | "protocol_unknown" | "transport_failure";
const uncertainStatusResult = (statusKind: UncertainStatusKind) =>
  Match.value(statusKind).pipe(
    Match.when("accepted", () => Effect.succeed("accepted" as const)),
    Match.when("protocol_unknown", () => Effect.succeed("unknown" as const)),
    Match.when("transport_failure", () => Effect.fail(ChatActionError.new("receipt status unavailable"))),
    Match.exhaustive
  );
const reconciliationReceiptStatus = (requestId: string | undefined) =>
  Match.value(requestId).pipe(
    Match.when("receipt-persisted", () => "persisted" as const),
    Match.when("receipt-not-persisted", () => "not_persisted" as const),
    Match.when("receipt-accepted", () => "accepted" as const),
    Match.orElse(() => "unknown" as const)
  );

const emptyTimeline = ThreadTimeline.make({ threadId, turns: [] });
const userOnlyTimeline = ThreadTimeline.make({
  threadId,
  turns: [
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(1),
      turnIndex: NonNegativeInt.make(0),
      items: [TimelineMessageItem.make({ role: "user", content })],
      costMicros: 0,
    }),
  ],
});
const completedTimeline = ThreadTimeline.make({
  threadId,
  turns: [
    ...userOnlyTimeline.turns,
    TimelineTurn.make({
      turnId: WorkspaceIdentity.TurnId.make(2),
      turnIndex: NonNegativeInt.make(1),
      items: [TimelineMessageItem.make({ role: "assistant", content })],
      costMicros: 0,
    }),
  ],
});

// Receipt polls are real wall-clock delays in the product; a few millis keep a
// starved CI runner from stretching eight of them past the case's timeout.
const FastReceiptPollLayer = ConfigProvider.layer(
  ConfigProvider.fromUnknown({ BEEP_TURN_RECEIPT_POLL_INTERVAL: "2 millis" })
);
const registryWithClient = Effect.fnUntraced(function* (client: ChatClient["Service"]) {
  return yield* Effect.acquireRelease(
    Effect.sync(() =>
      AtomRegistry.make({
        initialValues: [
          [
            ChatClient.runtime.layer,
            Layer.mergeAll(Layer.succeed(ChatClient, client), Reactivity.layer, FastReceiptPollLayer),
          ],
        ],
      })
    ),
    (registry) => Effect.sync(() => registry.dispose())
  );
});
const waitForAtom = Effect.fnUntraced(function* <A>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<A>,
  predicate: P.Predicate<A>
) {
  yield* Effect.callback<void>((resume) => {
    if (predicate(registry.get(atom))) {
      resume(Effect.void);
      return;
    }
    const cancel = registry.subscribe(atom, (value) => {
      if (!predicate(value)) return;
      cancel();
      resume(Effect.void);
    });
    return Effect.sync(cancel);
  });
});

describe("assistant turn reconciliation", { concurrent: false }, () => {
  it.live(
    "retains unreconciled per-thread replies across view unmounts",
    Effect.fnUntraced(function* () {
      const atom = unreconciledTurnAtoms(threadId);
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make({ defaultIdleTTL: 1, timeoutResolution: 1 })),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const fallback = StreamingTurn.make({ threadId, userContent: content, blocks: [assistantBlock] });
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* AtomRegistry.mount(registry, atom);
          registry.set(atom, [fallback]);
        })
      );

      yield* Effect.sleep(Duration.millis(20));
      expect(registry.get(atom)).toStrictEqual([fallback]);
    })
  );

  it.live(
    "does not mistake a newly persisted user turn for the stopped assistant turn",
    Effect.fnUntraced(function* () {
      const streamStarted = yield* Deferred.make<void>();
      let timeline: ThreadTimeline = emptyTimeline;
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") {
          return Effect.sync(() => timeline);
        }
        if (tag === "GetTurnRequestStatus") return Effect.succeed("not_persisted");
        if (tag === "SendMessage") {
          return Stream.unwrap(Deferred.succeed(streamStarted, undefined).pipe(Effect.as(Stream.never)));
        }
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = yield* registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      const draftAtom = draftAtoms(threadId);
      yield* AtomRegistry.mount(registry, timelineAtom);
      yield* AtomRegistry.mount(registry, runTurnAtom);
      yield* AtomRegistry.mount(registry, draftAtom);
      yield* AtomRegistry.mount(registry, streamingTurnAtom);
      yield* AtomRegistry.mount(registry, turnActiveAtom);
      yield* AtomRegistry.mount(registry, turnErrorAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* Deferred.await(streamStarted);

      // The server persists the user row before the interrupted stream records
      // its assistant `(stopped)` marker. Every bounded refresh sees only that
      // user row: total-count growth must not be accepted as reconciliation.
      timeline = userOnlyTimeline;
      registry.set(runTurnAtom, Atom.Interrupt);
      yield* waitForAtom(registry, streamingTurnAtom, O.isNone);

      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
      expect(registry.get(turnActiveAtom)).toBe(false);
      expect(registry.get(draftAtom)).toStrictEqual(O.some(content));
      expect(O.isSome(registry.get(turnErrorAtom))).toBe(true);
    })
  );

  it.live(
    "does not restore a cancelled prompt after the server confirms its user row persisted",
    Effect.fnUntraced(function* () {
      const streamStarted = yield* Deferred.make<void>();
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") {
          return Effect.succeed(userOnlyTimeline);
        }
        if (tag === "GetTurnRequestStatus") return Effect.succeed("user_persisted");
        if (tag === "SendMessage") {
          return Stream.unwrap(Deferred.succeed(streamStarted, undefined).pipe(Effect.as(Stream.never)));
        }
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = yield* registryWithClient(client);
      const draftAtom = draftAtoms(threadId);
      yield* AtomRegistry.mount(registry, threadTimelineAtoms(threadId));
      yield* AtomRegistry.mount(registry, runTurnAtom);
      yield* AtomRegistry.mount(registry, draftAtom);
      yield* AtomRegistry.mount(registry, streamingTurnAtom);
      yield* AtomRegistry.mount(registry, turnErrorAtom);

      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* Deferred.await(streamStarted);
      registry.set(runTurnAtom, Atom.Interrupt);
      yield* waitForAtom(registry, streamingTurnAtom, O.isNone);

      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
      expect(registry.get(draftAtom)).toStrictEqual(O.none());
      expect(registry.get(turnErrorAtom)).toStrictEqual(O.none());
    })
  );

  const verifyUncertainFailedTurnStatus = Effect.fn("verifyUncertainFailedTurnStatus")(function* (
    statusKind: UncertainStatusKind
  ) {
    let statusReads = 0;
    let timelineReads = 0;
    const client = ChatClient.of(((tag: string) => {
      if (tag === "GetTimeline") {
        timelineReads += 1;
        return Effect.succeed(emptyTimeline);
      }
      if (tag === "GetTurnRequestStatus") {
        return Effect.suspend(() => {
          statusReads += 1;
          return uncertainStatusResult(statusKind);
        });
      }
      if (tag === "SendMessage") return Stream.fail(ChatActionError.new("generation failed"));
      return Effect.die(`unexpected chat RPC: ${tag}`);
    }) as unknown as ChatClient["Service"]);
    const registry = yield* registryWithClient(client);
    const timelineAtom = threadTimelineAtoms(threadId);
    const draftAtom = draftAtoms(threadId);
    const draftRevisionAtom = draftRevisionAtoms(threadId);
    const unreconciledAtom = unreconciledTurnAtoms(threadId);
    yield* AtomRegistry.mount(registry, timelineAtom);
    yield* AtomRegistry.mount(registry, runTurnAtom);
    yield* AtomRegistry.mount(registry, draftAtom);
    yield* AtomRegistry.mount(registry, draftRevisionAtom);
    yield* AtomRegistry.mount(registry, unreconciledAtom);

    yield* AtomRegistry.getResult(registry, timelineAtom);
    registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
    yield* waitForAtom(registry, unreconciledAtom, A.isReadonlyArrayNonEmpty).pipe(
      Effect.timeoutOrElse({
        duration: Duration.seconds(10),
        orElse: () =>
          Effect.fail(ChatActionError.new(`timed out waiting for ${statusKind} failed turn to become unreconciled`)),
      })
    );
    yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true }).pipe(Effect.exit);

    expect(registry.get(draftAtom)).toStrictEqual(O.none());
    expect(registry.get(draftRevisionAtom)).toBe(0);
    const [fallback] = registry.get(unreconciledAtom);
    expect(fallback?.userContent).toStrictEqual(content);
    expect(fallback?.reconciliation).toBe("receipt");
    expect(fallback?.blocks).toMatchObject([{ type: "paragraph", children: [{ type: "text", text: "(failed)" }] }]);
    expect(statusReads).toBeGreaterThan(1);
    expect(timelineReads).toBeGreaterThan(1);
  }, Effect.scoped);

  it.live("keeps accepted failed prompts non-sendable while receipt evidence is uncertain", () =>
    verifyUncertainFailedTurnStatus("accepted")
  );

  it.live("keeps protocol-unknown failed prompts non-sendable while receipt evidence is uncertain", () =>
    verifyUncertainFailedTurnStatus("protocol_unknown")
  );

  it.live("keeps transport-failed prompts non-sendable while receipt evidence is uncertain", () =>
    verifyUncertainFailedTurnStatus("transport_failure")
  );

  it.live(
    "keeps interrupted prompts non-sendable while receipt evidence is uncertain",
    Effect.fnUntraced(function* () {
      const verifyUncertainStatus = Effect.fn("verifyUncertainInterruptedTurnStatus")(function* (
        statusKind: UncertainStatusKind
      ) {
        const streamStarted = yield* Deferred.make<void>();
        let timelineReads = 0;
        const client = ChatClient.of(((tag: string) => {
          if (tag === "GetTimeline") {
            timelineReads += 1;
            return Effect.succeed(timelineReads === 1 ? emptyTimeline : userOnlyTimeline);
          }
          if (tag === "GetTurnRequestStatus") {
            return uncertainStatusResult(statusKind);
          }
          if (tag === "SendMessage") {
            return Stream.unwrap(Deferred.succeed(streamStarted, undefined).pipe(Effect.as(Stream.never)));
          }
          return Effect.die(`unexpected chat RPC: ${tag}`);
        }) as unknown as ChatClient["Service"]);
        const registry = yield* registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        const draftRevisionAtom = draftRevisionAtoms(threadId);
        const unreconciledAtom = unreconciledTurnAtoms(threadId);
        yield* AtomRegistry.mount(registry, timelineAtom);
        yield* AtomRegistry.mount(registry, runTurnAtom);
        yield* AtomRegistry.mount(registry, draftAtom);
        yield* AtomRegistry.mount(registry, draftRevisionAtom);
        yield* AtomRegistry.mount(registry, unreconciledAtom);
        yield* AtomRegistry.mount(registry, streamingTurnAtom);
        yield* AtomRegistry.mount(registry, turnErrorAtom);

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* Deferred.await(streamStarted);
        registry.set(runTurnAtom, Atom.Interrupt);
        yield* waitForAtom(registry, streamingTurnAtom, O.isNone);

        expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        expect(registry.get(draftRevisionAtom)).toBe(0);
        const [fallback] = registry.get(unreconciledAtom);
        expect(fallback?.userContent).toStrictEqual(content);
        expect(fallback?.reconciliation).toBe("receipt");
        expect(fallback?.blocks).toMatchObject([
          { type: "paragraph", children: [{ type: "text", text: "(stopped)" }] },
        ]);
        expect(O.isSome(registry.get(turnErrorAtom))).toBe(true);
      });

      yield* verifyUncertainStatus("accepted");
      yield* verifyUncertainStatus("protocol_unknown");
      yield* verifyUncertainStatus("transport_failure");
    })
  );

  it.effect(
    "restores a prompt only after polling recovers with explicit non-persistence",
    Effect.fnUntraced(function* () {
      const verifyRecoveredStatus = Effect.fn("verifyRecoveredTurnStatus")(function* (
        recoveredStatus: "persisted" | "not_persisted"
      ) {
        let statusReads = 0;
        let timelineReads = 0;
        const client = ChatClient.of(((tag: string) => {
          if (tag === "GetTimeline") {
            timelineReads += 1;
            return Effect.succeed(timelineReads === 1 ? emptyTimeline : userOnlyTimeline);
          }
          if (tag === "GetTurnRequestStatus") {
            return Effect.suspend(() => {
              statusReads += 1;
              return statusReads < 3
                ? Effect.fail(ChatActionError.new("receipt status temporarily unavailable"))
                : Effect.succeed(recoveredStatus);
            });
          }
          if (tag === "SendMessage") return Stream.fail(ChatActionError.new("generation failed"));
          return Effect.die(`unexpected chat RPC: ${tag}`);
        }) as unknown as ChatClient["Service"]);
        const registry = yield* registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        const draftRevisionAtom = draftRevisionAtoms(threadId);
        yield* AtomRegistry.mount(registry, timelineAtom);
        yield* AtomRegistry.mount(registry, runTurnAtom);
        yield* AtomRegistry.mount(registry, draftAtom);
        yield* AtomRegistry.mount(registry, draftRevisionAtom);

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true }).pipe(Effect.exit);

        expect(statusReads).toBe(3);
        expect(registry.get(draftAtom)).toStrictEqual(recoveredStatus === "not_persisted" ? O.some(content) : O.none());
        expect(registry.get(draftRevisionAtom)).toBe(recoveredStatus === "not_persisted" ? 1 : 0);
      });

      yield* verifyRecoveredStatus("persisted");
      yield* verifyRecoveredStatus("not_persisted");
    })
  );

  it.effect(
    "refreshes durable failed turns without restoring their prompts",
    Effect.fnUntraced(function* () {
      const verifyStatus = Effect.fn("verifyDurableStatus")(function* (status: "persisted" | "user_persisted") {
        const timelineRefreshed = yield* Deferred.make<void>();
        let timelineReads = 0;
        const client = ChatClient.of(((tag: string) => {
          if (tag === "GetTimeline") {
            timelineReads += 1;
            const timeline =
              timelineReads === 1 ? emptyTimeline : status === "persisted" ? completedTimeline : userOnlyTimeline;
            return Effect.succeed(timeline).pipe(
              Effect.tap(() => (timelineReads > 1 ? Deferred.succeed(timelineRefreshed, undefined) : Effect.void))
            );
          }
          if (tag === "GetTurnRequestStatus") return Effect.succeed(status);
          if (tag === "SendMessage") return Stream.fail(ChatActionError.new("generation failed"));
          return Effect.die(`unexpected chat RPC: ${tag}`);
        }) as unknown as ChatClient["Service"]);
        const registry = yield* registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        yield* AtomRegistry.mount(registry, timelineAtom);
        yield* AtomRegistry.mount(registry, runTurnAtom);
        yield* AtomRegistry.mount(registry, draftAtom);
        yield* AtomRegistry.mount(registry, streamingTurnAtom);
        yield* AtomRegistry.mount(registry, turnErrorAtom);

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true }).pipe(Effect.exit);
        yield* Deferred.await(timelineRefreshed);

        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
        expect(O.isSome(registry.get(turnErrorAtom))).toBe(true);
        expect(timelineReads).toBeGreaterThan(1);
      });

      yield* verifyStatus("persisted");
      yield* verifyStatus("user_persisted");
    })
  );

  it.effect(
    "retains failed turns when their durable timeline refresh fails",
    Effect.fnUntraced(function* () {
      const verifyStatus = Effect.fn("verifyFailedRefreshStatus")(function* (status: "persisted" | "user_persisted") {
        let timelineReads = 0;
        const client = ChatClient.of(((tag: string) => {
          if (tag === "GetTimeline") {
            timelineReads += 1;
            return timelineReads === 1
              ? Effect.succeed(emptyTimeline)
              : Effect.fail(ChatActionError.new("timeline refresh unavailable"));
          }
          if (tag === "GetTurnRequestStatus") return Effect.succeed(status);
          if (tag === "SendMessage") return Stream.fail(ChatActionError.new("generation failed"));
          return Effect.die(`unexpected chat RPC: ${tag}`);
        }) as unknown as ChatClient["Service"]);
        const registry = yield* registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        yield* AtomRegistry.mount(registry, timelineAtom);
        yield* AtomRegistry.mount(registry, runTurnAtom);
        yield* AtomRegistry.mount(registry, draftAtom);
        yield* AtomRegistry.mount(registry, unreconciledTurnAtoms(threadId));

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true }).pipe(Effect.exit);

        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        const [fallback] = registry.get(unreconciledTurnAtoms(threadId));
        expect(fallback?.userContent).toStrictEqual(content);
        expect(fallback?.blocks).toMatchObject([{ type: "paragraph", children: [{ type: "text", text: "(failed)" }] }]);
      });

      yield* verifyStatus("persisted");
      yield* verifyStatus("user_persisted");
    })
  );

  it.live(
    "retains a stopped turn when its durable timeline refresh fails",
    Effect.fnUntraced(function* () {
      const streamStarted = yield* Deferred.make<void>();
      const timelineRefreshAttempted = yield* Deferred.make<void>();
      let timelineReads = 0;
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") {
          timelineReads += 1;
          return timelineReads === 1
            ? Effect.succeed(emptyTimeline)
            : Deferred.succeed(timelineRefreshAttempted, undefined).pipe(
                Effect.andThen(Effect.fail(ChatActionError.new("timeline refresh unavailable")))
              );
        }
        if (tag === "GetTurnRequestStatus") return Effect.succeed("persisted");
        if (tag === "SendMessage") {
          return Stream.unwrap(Deferred.succeed(streamStarted, undefined).pipe(Effect.as(Stream.never)));
        }
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = yield* registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      const draftAtom = draftAtoms(threadId);
      yield* AtomRegistry.mount(registry, timelineAtom);
      yield* AtomRegistry.mount(registry, runTurnAtom);
      yield* AtomRegistry.mount(registry, draftAtom);
      yield* AtomRegistry.mount(registry, unreconciledTurnAtoms(threadId));

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* Deferred.await(streamStarted);
      registry.set(runTurnAtom, Atom.Interrupt);
      yield* Deferred.await(timelineRefreshAttempted);
      yield* Effect.sleep(Duration.millis(25));

      expect(registry.get(draftAtom)).toStrictEqual(O.none());
      const [fallback] = registry.get(unreconciledTurnAtoms(threadId));
      expect(fallback?.userContent).toStrictEqual(content);
      expect(fallback?.blocks).toMatchObject([{ type: "paragraph", children: [{ type: "text", text: "(stopped)" }] }]);
    })
  );

  it.effect(
    "retains the completed local reply when its durable timeline refresh fails",
    Effect.fnUntraced(function* () {
      let timelineReads = 0;
      let sends = 0;
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") {
          timelineReads += 1;
          return timelineReads === 1
            ? Effect.succeed(emptyTimeline)
            : Effect.fail(ChatActionError.new("timeline refresh unavailable"));
        }
        if (tag === "SendMessage") {
          sends += 1;
          return sends === 1
            ? Stream.fromIterable([assistantBlock])
            : Stream.fail(ChatActionError.new("second send failed"));
        }
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = yield* registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      yield* AtomRegistry.mount(registry, timelineAtom);
      yield* AtomRegistry.mount(registry, runTurnAtom);
      yield* AtomRegistry.mount(registry, streamingTurnAtom);
      yield* AtomRegistry.mount(registry, turnActiveAtom);
      yield* AtomRegistry.mount(registry, turnErrorAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true });

      expect(timelineReads).toBeGreaterThan(1);
      const [localReply] = registry.get(unreconciledTurnAtoms(threadId));
      expect(localReply).toBeDefined();
      if (localReply === undefined) return;
      expect(localReply.blocks).toStrictEqual([assistantBlock]);
      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
      expect(registry.get(turnActiveAtom)).toBe(false);
      expect(AsyncResult.isFailure(registry.get(timelineAtom)) && O.isSome(registry.get(turnErrorAtom))).toBe(true);

      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true }).pipe(Effect.exit);
      expect(registry.get(unreconciledTurnAtoms(threadId))).toHaveLength(1);
    })
  );

  it.effect(
    "retires receipt fallbacks only after an exact terminal status",
    Effect.fnUntraced(function* () {
      let timelineReads = 0;
      let statusReads = 0;
      let beforeStatusResolution = (_requestId: string | undefined): void => {};
      const client = ChatClient.of(((tag: string, payload?: { readonly requestId?: string }) => {
        if (tag === "GetTimeline") {
          timelineReads += 1;
          return Effect.succeed(timelineReads === 1 ? emptyTimeline : completedTimeline);
        }
        if (tag === "GetTurnRequestStatus") {
          statusReads += 1;
          return Effect.sync(() => {
            beforeStatusResolution(payload?.requestId);
            return reconciliationReceiptStatus(payload?.requestId);
          });
        }
        if (tag === "SendMessage") return Stream.fromIterable([assistantBlock]);
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = yield* registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      const unreconciledAtom = unreconciledTurnAtoms(threadId);
      const draftAtom = draftAtoms(threadId);
      const draftRevisionAtom = draftRevisionAtoms(threadId);
      const receiptFallback = StreamingTurn.make({
        threadId,
        requestId: O.some("receipt-uncertain"),
        userContent: content,
        reconciliation: "receipt",
        blocks: [assistantBlock],
      });
      const durableReceiptFallback = StreamingTurn.make({
        threadId,
        requestId: O.some("receipt-persisted"),
        userContent: content,
        reconciliation: "receipt",
        blocks: [assistantBlock],
      });
      const acceptedReceiptFallback = StreamingTurn.make({
        threadId,
        requestId: O.some("receipt-accepted"),
        userContent: content,
        reconciliation: "receipt",
        blocks: [assistantBlock],
      });
      const notPersistedReceiptFallback = StreamingTurn.make({
        threadId,
        requestId: O.some("receipt-not-persisted"),
        userContent: content,
        reconciliation: "receipt",
        blocks: [assistantBlock],
      });
      const anotherNotPersistedFallback = StreamingTurn.make({
        threadId,
        requestId: O.some("receipt-not-persisted"),
        userContent: newerContent,
        reconciliation: "receipt",
        blocks: [assistantBlock],
      });
      const timelineFallback = StreamingTurn.make({
        threadId,
        userContent: content,
        blocks: [assistantBlock],
      });
      yield* AtomRegistry.mount(registry, timelineAtom);
      yield* AtomRegistry.mount(registry, runTurnAtom);
      yield* AtomRegistry.mount(registry, unreconciledAtom);
      yield* AtomRegistry.mount(registry, draftAtom);
      yield* AtomRegistry.mount(registry, draftRevisionAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(unreconciledAtom, [
        receiptFallback,
        acceptedReceiptFallback,
        notPersistedReceiptFallback,
        anotherNotPersistedFallback,
        durableReceiptFallback,
        timelineFallback,
      ]);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true });

      expect(registry.get(unreconciledAtom)).toStrictEqual([
        receiptFallback,
        acceptedReceiptFallback,
        anotherNotPersistedFallback,
      ]);
      expect(registry.get(draftAtom)).toStrictEqual(O.some(content));
      expect(registry.get(draftRevisionAtom)).toBe(1);
      expect(statusReads).toBeGreaterThanOrEqual(5);

      registry.set(draftAtom, O.none());
      registry.set(unreconciledAtom, [notPersistedReceiptFallback]);
      beforeStatusResolution = (requestId) =>
        Match.value(requestId).pipe(
          Match.when("receipt-not-persisted", () => {
            registry.set(draftAtom, O.some(newerContent));
            registry.set(draftRevisionAtom, 2);
            registry.set(unreconciledAtom, A.append(registry.get(unreconciledAtom), receiptFallback));
          }),
          Match.orElse(() => undefined)
        );
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true });

      expect(registry.get(unreconciledAtom)).toStrictEqual([notPersistedReceiptFallback, receiptFallback]);
      expect(registry.get(draftAtom)).toStrictEqual(O.some(newerContent));
      expect(registry.get(draftRevisionAtom)).toBe(2);
    })
  );

  it.effect(
    "clears the local reply only after a fresh durable timeline succeeds",
    Effect.fnUntraced(function* () {
      let timelineReads = 0;
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") {
          timelineReads += 1;
          return Effect.succeed(timelineReads === 1 ? emptyTimeline : completedTimeline);
        }
        if (tag === "SendMessage") return Stream.fromIterable([assistantBlock]);
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = yield* registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      yield* AtomRegistry.mount(registry, timelineAtom);
      yield* AtomRegistry.mount(registry, runTurnAtom);
      yield* AtomRegistry.mount(registry, streamingTurnAtom);
      yield* AtomRegistry.mount(registry, turnActiveAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom, { suspendOnWaiting: true });

      expect(timelineReads).toBeGreaterThan(1);
      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
      expect(registry.get(turnActiveAtom)).toBe(false);
    })
  );
});

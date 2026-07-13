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
import { Document, P, Text } from "@beep/md/Md.model";
import { NonNegativeInt } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { ThreadTimeline, TimelineMessageItem, TimelineTurn } from "@beep/workspace-use-cases/aggregates/Thread";
import { describe, expect, it } from "@effect/vitest";
import { Deferred, Duration, Effect, Layer, Stream } from "effect";
import * as O from "effect/Option";
import { AsyncResult, Atom, AtomRegistry, Reactivity } from "effect/unstable/reactivity";

const threadId = WorkspaceIdentity.ThreadId.make(1);
const content = Document.make({ children: [P.make({ children: [Text.make({ value: "Keep this prompt" })] })] });
const assistantBlock = ParagraphBlock.make({
  children: [TextInline.make({ text: "A completed local reply" })],
});

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

const registryWithClient = (client: ChatClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [[ChatClient.runtime.layer, Layer.mergeAll(Layer.succeed(ChatClient, client), Reactivity.layer)]],
  });

describe("assistant turn reconciliation", { concurrent: false }, () => {
  it.live(
    "retains unreconciled per-thread replies across view unmounts",
    Effect.fnUntraced(function* () {
      const atom = unreconciledTurnAtoms(threadId);
      const registry = AtomRegistry.make({ defaultIdleTTL: 1, timeoutResolution: 1 });
      const unmount = registry.mount(atom);
      const fallback = StreamingTurn.make({ threadId, userContent: content, blocks: [assistantBlock] });
      registry.set(atom, [fallback]);
      unmount();

      yield* Effect.sleep(Duration.millis(20));
      expect(registry.get(atom)).toStrictEqual([fallback]);
      registry.dispose();
    })
  );

  it.live(
    "does not mistake a newly persisted user turn for the stopped assistant turn",
    Effect.fnUntraced(function* () {
      const streamStarted = yield* Deferred.make<void>();
      let timeline: ThreadTimeline = emptyTimeline;
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") return Effect.sync(() => timeline);
        if (tag === "GetTurnRequestStatus") return Effect.succeed("not_persisted");
        if (tag === "SendMessage") {
          return Stream.unwrap(Deferred.succeed(streamStarted, undefined).pipe(Effect.as(Stream.never)));
        }
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      const draftAtom = draftAtoms(threadId);
      const unmountTimeline = registry.mount(timelineAtom);
      const unmountTurn = registry.mount(runTurnAtom);
      const unmountDraft = registry.mount(draftAtom);
      const unmountStreaming = registry.mount(streamingTurnAtom);
      const unmountActivity = registry.mount(turnActiveAtom);
      const unmountError = registry.mount(turnErrorAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* Deferred.await(streamStarted);

      // The server persists the user row before the interrupted stream records
      // its assistant `(stopped)` marker. Every bounded refresh sees only that
      // user row: total-count growth must not be accepted as reconciliation.
      timeline = userOnlyTimeline;
      registry.set(runTurnAtom, Atom.Interrupt);
      yield* Effect.sleep(Duration.millis(1_600));

      expect(registry.get(turnActiveAtom)).toBe(false);
      expect(registry.get(draftAtom)).toStrictEqual(O.some(content));
      expect(O.isSome(registry.get(turnErrorAtom))).toBe(true);
      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());

      unmountError();
      unmountActivity();
      unmountStreaming();
      unmountDraft();
      unmountTurn();
      unmountTimeline();
      registry.dispose();
    })
  );

  it.live(
    "does not restore a cancelled prompt after the server confirms its user row persisted",
    Effect.fnUntraced(function* () {
      const streamStarted = yield* Deferred.make<void>();
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") return Effect.succeed(userOnlyTimeline);
        if (tag === "GetTurnRequestStatus") return Effect.succeed("user_persisted");
        if (tag === "SendMessage") {
          return Stream.unwrap(Deferred.succeed(streamStarted, undefined).pipe(Effect.as(Stream.never)));
        }
        return Effect.die(`unexpected chat RPC: ${tag}`);
      }) as unknown as ChatClient["Service"]);
      const registry = registryWithClient(client);
      const draftAtom = draftAtoms(threadId);
      const unmountTimeline = registry.mount(threadTimelineAtoms(threadId));
      const unmountTurn = registry.mount(runTurnAtom);
      const unmountDraft = registry.mount(draftAtom);
      const unmountStreaming = registry.mount(streamingTurnAtom);
      const unmountError = registry.mount(turnErrorAtom);

      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* Deferred.await(streamStarted);
      registry.set(runTurnAtom, Atom.Interrupt);
      yield* Effect.sleep(Duration.millis(350));

      expect(registry.get(draftAtom)).toStrictEqual(O.none());
      expect(registry.get(turnErrorAtom)).toStrictEqual(O.none());
      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());

      unmountError();
      unmountStreaming();
      unmountDraft();
      unmountTurn();
      unmountTimeline();
      registry.dispose();
    })
  );

  it.effect("keeps failed prompts non-sendable while receipt evidence is uncertain", () =>
    Effect.gen(function* () {
      const verifyUncertainStatus = Effect.fn("verifyUncertainFailedTurnStatus")(function* (
        statusKind: "protocol_unknown" | "transport_failure"
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
              return statusKind === "protocol_unknown"
                ? Effect.succeed("unknown")
                : Effect.fail(ChatActionError.new("receipt status unavailable"));
            });
          }
          if (tag === "SendMessage") return Stream.fail(ChatActionError.new("generation failed"));
          return Effect.die(`unexpected chat RPC: ${tag}`);
        }) as unknown as ChatClient["Service"]);
        const registry = registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        const draftRevisionAtom = draftRevisionAtoms(threadId);
        const unreconciledAtom = unreconciledTurnAtoms(threadId);
        const unmountTimeline = registry.mount(timelineAtom);
        const unmountTurn = registry.mount(runTurnAtom);
        const unmountDraft = registry.mount(draftAtom);
        const unmountDraftRevision = registry.mount(draftRevisionAtom);
        const unmountUnreconciled = registry.mount(unreconciledAtom);

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* AtomRegistry.getResult(registry, runTurnAtom).pipe(Effect.exit);

        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        expect(registry.get(draftRevisionAtom)).toBe(0);
        const [fallback] = registry.get(unreconciledAtom);
        expect(fallback?.userContent).toStrictEqual(content);
        expect(fallback?.reconciliation).toBe("receipt");
        expect(fallback?.blocks).toMatchObject([{ type: "paragraph", children: [{ type: "text", text: "(failed)" }] }]);
        expect(statusReads).toBeGreaterThan(1);
        expect(timelineReads).toBeGreaterThan(1);

        unmountUnreconciled();
        unmountDraftRevision();
        unmountDraft();
        unmountTurn();
        unmountTimeline();
        registry.dispose();
      });

      yield* verifyUncertainStatus("protocol_unknown");
      yield* verifyUncertainStatus("transport_failure");
    })
  );

  it.live(
    "keeps interrupted prompts non-sendable while receipt evidence is uncertain",
    Effect.fnUntraced(function* () {
      const verifyUncertainStatus = Effect.fn("verifyUncertainInterruptedTurnStatus")(function* (
        statusKind: "protocol_unknown" | "transport_failure"
      ) {
        const streamStarted = yield* Deferred.make<void>();
        let timelineReads = 0;
        const client = ChatClient.of(((tag: string) => {
          if (tag === "GetTimeline") {
            timelineReads += 1;
            return Effect.succeed(timelineReads === 1 ? emptyTimeline : userOnlyTimeline);
          }
          if (tag === "GetTurnRequestStatus") {
            return statusKind === "protocol_unknown"
              ? Effect.succeed("unknown")
              : Effect.fail(ChatActionError.new("receipt status unavailable"));
          }
          if (tag === "SendMessage") {
            return Stream.unwrap(Deferred.succeed(streamStarted, undefined).pipe(Effect.as(Stream.never)));
          }
          return Effect.die(`unexpected chat RPC: ${tag}`);
        }) as unknown as ChatClient["Service"]);
        const registry = registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        const draftRevisionAtom = draftRevisionAtoms(threadId);
        const unreconciledAtom = unreconciledTurnAtoms(threadId);
        const unmountTimeline = registry.mount(timelineAtom);
        const unmountTurn = registry.mount(runTurnAtom);
        const unmountDraft = registry.mount(draftAtom);
        const unmountDraftRevision = registry.mount(draftRevisionAtom);
        const unmountUnreconciled = registry.mount(unreconciledAtom);
        const unmountStreaming = registry.mount(streamingTurnAtom);
        const unmountError = registry.mount(turnErrorAtom);

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* Deferred.await(streamStarted);
        registry.set(runTurnAtom, Atom.Interrupt);
        yield* Effect.sleep(Duration.millis(1_600));

        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        expect(registry.get(draftRevisionAtom)).toBe(0);
        const [fallback] = registry.get(unreconciledAtom);
        expect(fallback?.userContent).toStrictEqual(content);
        expect(fallback?.reconciliation).toBe("receipt");
        expect(fallback?.blocks).toMatchObject([
          { type: "paragraph", children: [{ type: "text", text: "(stopped)" }] },
        ]);
        expect(O.isSome(registry.get(turnErrorAtom))).toBe(true);
        expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());

        unmountError();
        unmountStreaming();
        unmountUnreconciled();
        unmountDraftRevision();
        unmountDraft();
        unmountTurn();
        unmountTimeline();
        registry.dispose();
      });

      yield* verifyUncertainStatus("protocol_unknown");
      yield* verifyUncertainStatus("transport_failure");
    })
  );

  it.effect("restores a prompt only after polling recovers with explicit non-persistence", () =>
    Effect.gen(function* () {
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
        const registry = registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        const draftRevisionAtom = draftRevisionAtoms(threadId);
        const unmountTimeline = registry.mount(timelineAtom);
        const unmountTurn = registry.mount(runTurnAtom);
        const unmountDraft = registry.mount(draftAtom);
        const unmountDraftRevision = registry.mount(draftRevisionAtom);

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* AtomRegistry.getResult(registry, runTurnAtom).pipe(Effect.exit);

        expect(statusReads).toBe(3);
        expect(registry.get(draftAtom)).toStrictEqual(recoveredStatus === "not_persisted" ? O.some(content) : O.none());
        expect(registry.get(draftRevisionAtom)).toBe(recoveredStatus === "not_persisted" ? 1 : 0);

        unmountDraftRevision();
        unmountDraft();
        unmountTurn();
        unmountTimeline();
        registry.dispose();
      });

      yield* verifyRecoveredStatus("persisted");
      yield* verifyRecoveredStatus("not_persisted");
    })
  );

  it.effect("refreshes durable failed turns without restoring their prompts", () =>
    Effect.gen(function* () {
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
        const registry = registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        const unmountTimeline = registry.mount(timelineAtom);
        const unmountTurn = registry.mount(runTurnAtom);
        const unmountDraft = registry.mount(draftAtom);
        const unmountStreaming = registry.mount(streamingTurnAtom);
        const unmountError = registry.mount(turnErrorAtom);

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* AtomRegistry.getResult(registry, runTurnAtom).pipe(Effect.exit);
        yield* Deferred.await(timelineRefreshed);

        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
        expect(O.isSome(registry.get(turnErrorAtom))).toBe(true);
        expect(timelineReads).toBeGreaterThan(1);

        unmountError();
        unmountStreaming();
        unmountDraft();
        unmountTurn();
        unmountTimeline();
        registry.dispose();
      });

      yield* verifyStatus("persisted");
      yield* verifyStatus("user_persisted");
    })
  );

  it.effect("retains failed turns when their durable timeline refresh fails", () =>
    Effect.gen(function* () {
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
        const registry = registryWithClient(client);
        const timelineAtom = threadTimelineAtoms(threadId);
        const draftAtom = draftAtoms(threadId);
        const unmountTimeline = registry.mount(timelineAtom);
        const unmountTurn = registry.mount(runTurnAtom);
        const unmountDraft = registry.mount(draftAtom);
        const unmountUnreconciled = registry.mount(unreconciledTurnAtoms(threadId));

        yield* AtomRegistry.getResult(registry, timelineAtom);
        registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
        yield* AtomRegistry.getResult(registry, runTurnAtom).pipe(Effect.exit);

        expect(registry.get(draftAtom)).toStrictEqual(O.none());
        const [fallback] = registry.get(unreconciledTurnAtoms(threadId));
        expect(fallback?.userContent).toStrictEqual(content);
        expect(fallback?.blocks).toMatchObject([{ type: "paragraph", children: [{ type: "text", text: "(failed)" }] }]);

        unmountUnreconciled();
        unmountDraft();
        unmountTurn();
        unmountTimeline();
        registry.dispose();
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
      const registry = registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      const draftAtom = draftAtoms(threadId);
      const unmountTimeline = registry.mount(timelineAtom);
      const unmountTurn = registry.mount(runTurnAtom);
      const unmountDraft = registry.mount(draftAtom);
      const unmountUnreconciled = registry.mount(unreconciledTurnAtoms(threadId));

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

      unmountUnreconciled();
      unmountDraft();
      unmountTurn();
      unmountTimeline();
      registry.dispose();
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
      const registry = registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      const unmountTimeline = registry.mount(timelineAtom);
      const unmountTurn = registry.mount(runTurnAtom);
      const unmountStreaming = registry.mount(streamingTurnAtom);
      const unmountActivity = registry.mount(turnActiveAtom);
      const unmountError = registry.mount(turnErrorAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom);

      expect(timelineReads).toBeGreaterThan(1);
      const [localReply] = registry.get(unreconciledTurnAtoms(threadId));
      expect(localReply).toBeDefined();
      if (localReply === undefined) return;
      expect(localReply.blocks).toStrictEqual([assistantBlock]);
      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
      expect(registry.get(turnActiveAtom)).toBe(false);
      expect(AsyncResult.isFailure(registry.get(timelineAtom)) && O.isSome(registry.get(turnErrorAtom))).toBe(true);

      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom).pipe(Effect.exit);
      expect(registry.get(unreconciledTurnAtoms(threadId))).toHaveLength(1);

      unmountError();
      unmountActivity();
      unmountStreaming();
      unmountTurn();
      unmountTimeline();
      registry.dispose();
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
      const registry = registryWithClient(client);
      const timelineAtom = threadTimelineAtoms(threadId);
      const unmountTimeline = registry.mount(timelineAtom);
      const unmountTurn = registry.mount(runTurnAtom);
      const unmountStreaming = registry.mount(streamingTurnAtom);
      const unmountActivity = registry.mount(turnActiveAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom);

      expect(timelineReads).toBeGreaterThan(1);
      expect(registry.get(streamingTurnAtom)).toStrictEqual(O.none());
      expect(registry.get(turnActiveAtom)).toBe(false);

      unmountActivity();
      unmountStreaming();
      unmountTurn();
      unmountTimeline();
      registry.dispose();
    })
  );
});

import {
  ChatClient,
  draftAtoms,
  runTurnAtom,
  SendTurnRequest,
  streamingTurnAtom,
  threadTimelineAtoms,
  turnActiveAtom,
  turnErrorAtom,
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
    "does not mistake a newly persisted user turn for the stopped assistant turn",
    Effect.fnUntraced(function* () {
      const streamStarted = yield* Deferred.make<void>();
      let timeline: ThreadTimeline = emptyTimeline;
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") return Effect.sync(() => timeline);
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

  it.effect(
    "retains the completed local reply when its durable timeline refresh fails",
    Effect.fnUntraced(function* () {
      let timelineReads = 0;
      const client = ChatClient.of(((tag: string) => {
        if (tag === "GetTimeline") {
          timelineReads += 1;
          return timelineReads === 1
            ? Effect.succeed(emptyTimeline)
            : Effect.fail(ChatActionError.new("timeline refresh unavailable"));
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
      const unmountError = registry.mount(turnErrorAtom);

      yield* AtomRegistry.getResult(registry, timelineAtom);
      registry.set(runTurnAtom, SendTurnRequest.make({ threadId, content }));
      yield* AtomRegistry.getResult(registry, runTurnAtom);

      expect(timelineReads).toBeGreaterThan(1);
      const localReply = O.getOrThrow(registry.get(streamingTurnAtom));
      expect(localReply.blocks).toStrictEqual([assistantBlock]);
      expect(registry.get(turnActiveAtom)).toBe(false);
      expect(AsyncResult.isFailure(registry.get(timelineAtom)) && O.isSome(registry.get(turnErrorAtom))).toBe(true);

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

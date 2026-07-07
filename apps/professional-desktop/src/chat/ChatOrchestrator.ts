/**
 * Chat orchestration handler: the app-level wiring of the assistant-turn
 * kernel, the workspace ThreadStore, and the usage-record sink behind the
 * {@link ChatRpcs} wire contract.
 *
 * SPEC: "Cancel must leave no partial assistant row." The user turn is
 * persisted before streaming starts; the assistant turn+message is persisted
 * **only on successful stream completion** ({@link Stream.onEnd}). On
 * interrupt or error nothing is persisted, so a cancelled turn leaves the
 * user turn but no assistant turn. This deliberately differs from the POC,
 * which persisted partial blocks on abnormal exit via `Stream.onExit`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { assistantContentToDocument } from "@beep/agents-domain/values/AssistantContent";
import {
  AgentTurnKernel,
  AssistantTurnHistoryItem,
  ChatActionError,
  ChatRpcs,
  UserTurnHistoryItem,
} from "@beep/agents-use-cases/public";
import { appendTurnFinalizationUsageRecord, TurnFinalizationUsageAppend } from "@beep/epistemic-domain";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { MessageRole } from "@beep/workspace-domain/entities/Message";
import { Thread } from "@beep/workspace-use-cases/server";
import { Clock, Duration, Effect, Metric, Order, pipe, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DerivedThreadTitle } from "./DerivedThreadTitle.ts";
import { UsageRecordSink } from "./UsageRecordSink.ts";
import type { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import type { IndexedBlock, TurnGenerationError, TurnHistoryItem } from "@beep/agents-use-cases/public";
import type { Document } from "@beep/md/Md.model";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

// ---------------------------------------------------------------------------
// Document → plain text
// ---------------------------------------------------------------------------

/**
 * Project a `@beep/md` {@link Document} to plain text for the turn-kernel
 * history.
 *
 * @category projections
 * @since 0.0.0
 */
export const documentToPlainText = (document: Document.Type): string => renderPlainTextUnsafe(document);

const UNTITLED_THREAD_TITLE = "New thread" as const;

const decodeDerivedThreadTitle = S.decodeUnknownOption(DerivedThreadTitle);
const decodeDerivedThreadTitleLine = (line: string): O.Option<string> => decodeDerivedThreadTitle(line);

const deriveThreadTitle = (document: Document.Type): O.Option<string> =>
  pipe(documentToPlainText(document), Str.split("\n"), A.map(decodeDerivedThreadTitleLine), A.getSomes, A.head);

const turnHasUserMessage = (turn: Thread.TimelineTurn): boolean => A.some(turn.items, isUserMessageItem);

const isUserMessageItem = (item: Thread.TimelineItem): item is Thread.TimelineMessageItem =>
  Thread.TimelineItem.guards.message(item) && MessageRole.is.user(item.role);

const firstUserMessageTurn = (timeline: Thread.ThreadTimeline): O.Option<Thread.TimelineTurn> =>
  pipe(timeline.turns, A.findFirst(turnHasUserMessage));

const firstUserMessageTurnId = (timeline: Thread.ThreadTimeline): O.Option<WorkspaceIdentity.TurnId> =>
  pipe(
    firstUserMessageTurn(timeline),
    O.map((turn) => turn.turnId)
  );

const isFirstUserMessageTurn = (timeline: Thread.ThreadTimeline, turnId: WorkspaceIdentity.TurnId): boolean =>
  pipe(
    firstUserMessageTurnId(timeline),
    O.match({
      onNone: () => false,
      onSome: (firstUserTurnId) => firstUserTurnId === turnId,
    })
  );

const userMessageContent = (turn: Thread.TimelineTurn): O.Option<Document.Type> =>
  pipe(
    turn.items,
    A.findFirst(isUserMessageItem),
    O.map((item) => item.content)
  );

const titleGuardForEditedFirstUserTurn = (
  timeline: Thread.ThreadTimeline,
  turnId: WorkspaceIdentity.TurnId
): O.Option<string> =>
  pipe(
    firstUserMessageTurn(timeline),
    O.flatMap((turn) =>
      turn.turnId === turnId
        ? pipe(
            userMessageContent(turn),
            O.flatMap(deriveThreadTitle),
            O.orElse(() => O.some(UNTITLED_THREAD_TITLE))
          )
        : O.none()
    )
  );

// ---------------------------------------------------------------------------
// Persisted-order helpers
// ---------------------------------------------------------------------------

const indexOf = (indexed: IndexedBlock): number => indexed.index;

const messageItemToHistory = (item: Thread.TimelineMessageItem): ReadonlyArray<TurnHistoryItem> =>
  MessageRole.$match(item.role, {
    agent: () => [UserTurnHistoryItem.make({ text: documentToPlainText(item.content) })],
    assistant: () => [AssistantTurnHistoryItem.make({ text: documentToPlainText(item.content) })],
    system: () => [UserTurnHistoryItem.make({ text: documentToPlainText(item.content) })],
    tool: () => [UserTurnHistoryItem.make({ text: documentToPlainText(item.content) })],
    user: () => [UserTurnHistoryItem.make({ text: documentToPlainText(item.content) })],
  });

const projectTimelineToHistory = (timeline: Thread.ThreadTimeline): ReadonlyArray<TurnHistoryItem> =>
  pipe(
    timeline.turns,
    A.flatMap((turn) =>
      A.flatMap(
        turn.items,
        (item): ReadonlyArray<TurnHistoryItem> =>
          Thread.TimelineItem.match({
            message: messageItemToHistory,
            tool_call: () => [],
          })(item)
      )
    )
  );

// ---------------------------------------------------------------------------
// Boundary translation (std-09): drop internal detail, keep it in the log
// ---------------------------------------------------------------------------

const toChatActionError =
  (context: string) =>
  (error: { readonly _tag: string }): Effect.Effect<never, ChatActionError> =>
    Effect.logWarning("chat action dropped internal failure", { context, detail: error }).pipe(
      Effect.andThen(ChatActionError.failEffect(context))
    );

// ---------------------------------------------------------------------------
// Usage-record synthesis (fixture path)
// ---------------------------------------------------------------------------

const SYSTEM_PRINCIPAL = { component: "Runtime", kind: "System" } as const;

const decodeUsageAppend = S.decodeUnknownSync(TurnFinalizationUsageAppend);

/**
 * Synthesize the finalized-turn {@link UsageRecord} for the fixture path. The
 * fixture kernel performs no real LLM work, so provider/model are `"fixture"`
 * and every token/cost/latency field is absent. The orgId, principal, and
 * synthesized activity/usage ids stand in for the not-yet-wired request
 * principal, matching the in-memory ThreadStore's system stand-in.
 *
 * TODO(live sidecar): carry real provider/model/token/latency from the kernel
 * turn-meta and a real request principal/activity once the Anthropic kernel and
 * the sidecar request context land.
 */
const fixtureUsageRecord = appendTurnFinalizationUsageRecord(
  decodeUsageAppend({
    createdAt: 0,
    createdByPrincipal: SYSTEM_PRINCIPAL,
    entityType: "EpistemicUsageRecord",
    id: 1,
    orgId: 1,
    rowVersion: 1,
    schemaVersion: "0.0.0",
    source: "System",
    updatedAt: 0,
    updatedByPrincipal: SYSTEM_PRINCIPAL,
    activityId: 1,
    actor: SYSTEM_PRINCIPAL,
    costUsdApproxMicros: null,
    credentialReference: null,
    inputTokens: null,
    latencyMillis: null,
    metadata: {},
    model: "fixture",
    outputTokens: null,
    provider: "fixture",
    totalTokens: null,
    unitCount: null,
  })
);

// ---------------------------------------------------------------------------
// Stream-and-persist tail (shared by SendMessage and EditMessage)
// ---------------------------------------------------------------------------

const chatTurnsTotal = Metric.counter("agents_chat_turns_total", {
  description: "Assistant turns prepared for streaming by the Professional Desktop sidecar",
  incremental: true,
});
const chatTurnFailuresTotal = Metric.counter("agents_chat_turn_failures_total", {
  description: "Assistant turns that failed before successful completion",
  incremental: true,
});
const chatTurnDuration = Metric.timer("agents_chat_turn_duration", {
  description: "Server-side assistant turn duration",
  boundaries: [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 60000],
});
const chatBlocksStreamedTotal = Metric.counter("agents_chat_blocks_streamed_total", {
  description: "Assistant blocks streamed to the chat client",
  incremental: true,
});

/**
 * Build the assistant-turn stream for a thread: stream the kernel turn,
 * collecting indexed blocks as they pass, and on **successful completion only**
 * persist the assistant turn+message and append the usage record. A single-shot
 * `Ref` guard makes the persist run at most once. Nothing is persisted on error
 * or interrupt — the SPEC's cancel-no-partial invariant.
 */
const streamAndPersist = (
  store: Thread.ThreadStore["Service"],
  kernel: AgentTurnKernel["Service"],
  usage: UsageRecordSink["Service"],
  threadId: WorkspaceIdentity.ThreadId,
  kind: "send" | "edit"
): Stream.Stream<AssistantBlock, ChatActionError> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const startedAt = yield* Clock.currentTimeMillis;
      const trackTurnFailure = (phase: "kernel" | "persist" | "prepare") =>
        Metric.update(Metric.withAttributes(chatTurnFailuresTotal, { kind, phase }), 1);
      const recordTurnDuration = Effect.gen(function* () {
        const completedAt = yield* Clock.currentTimeMillis;
        yield* Metric.update(
          Metric.withAttributes(chatTurnDuration, { kind }),
          Duration.millis(completedAt - startedAt)
        );
      });

      return yield* Effect.gen(function* () {
        const timeline = yield* store.timeline(threadId).pipe(Effect.catch(toChatActionError("GetTimeline")));
        const history = projectTimelineToHistory(timeline);
        yield* Metric.update(Metric.withAttributes(chatTurnsTotal, { kind }), 1);
        let collected: ReadonlyArray<IndexedBlock> = A.empty<IndexedBlock>();
        const persisted = yield* Ref.make(false);

        // Persist runs once, only on success: sort collected blocks by envelope
        // index, lift to a Document, append the assistant turn, then append the
        // finalized-turn usage record. Its failure channel is ChatActionError.
        const persist: Effect.Effect<void, ChatActionError> = Effect.gen(function* () {
          if (yield* Ref.getAndSet(persisted, true)) return;
          const blocks = A.map(A.sortWith(collected, indexOf, Order.Number), (indexed) => indexed.block);
          const content = assistantContentToDocument(blocks);
          yield* store
            .appendTurn({ threadId, parentTurnId: O.none(), role: "assistant", content })
            .pipe(Effect.catch(toChatActionError("SendMessage.persistAssistant")));
          yield* usage.append(fixtureUsageRecord);
        });

        const persistWithTelemetry = persist.pipe(
          Effect.tapError((error) =>
            trackTurnFailure("persist").pipe(
              Effect.andThen(
                Effect.logWarning("chat stream failed", {
                  context: "SendMessage.persistAssistant",
                  detail: error,
                })
              )
            )
          )
        );

        return kernel.streamTurn(history).pipe(
          Stream.tap(
            Effect.fnUntraced(function* (indexed: IndexedBlock) {
              collected = A.append(collected, indexed);
              yield* Metric.update(Metric.withAttributes(chatBlocksStreamedTotal, { kind }), 1);
            })
          ),
          Stream.tapError((error) =>
            trackTurnFailure("kernel").pipe(
              Effect.andThen(Effect.logWarning("chat stream failed", { context: "SendMessage.kernel", detail: error }))
            )
          ),
          // wire stays bare blocks; envelope indices are a handler-side concern
          Stream.map((indexed): AssistantBlock => indexed.block),
          // success path only — persist nothing on error/interrupt (no onExit).
          // onEnd widens the error channel with persist's ChatActionError.
          Stream.onEnd(persistWithTelemetry),
          // translate the kernel's TurnGenerationError to the client-safe wire
          // error; the persist ChatActionError passes through unchanged (std-09).
          Stream.mapError(
            (error: TurnGenerationError | ChatActionError): ChatActionError =>
              S.is(ChatActionError)(error) ? error : ChatActionError.new(error.message)
          ),
          Stream.ensuring(recordTurnDuration)
        );
      }).pipe(Effect.tapError(() => trackTurnFailure("prepare").pipe(Effect.andThen(recordTurnDuration))));
    })
  );

const setTitleFromFirstUserMessage = (
  store: Thread.ThreadStore["Service"],
  threadId: WorkspaceIdentity.ThreadId,
  content: Document.Type,
  emptyTitle: string = UNTITLED_THREAD_TITLE
): Effect.Effect<void> =>
  pipe(
    deriveThreadTitle(content),
    O.map((title) =>
      store.setTitleIfEmpty({ threadId, emptyTitle, title }).pipe(
        Effect.catch((error) =>
          Effect.logWarning("chat title derivation skipped", {
            context: "SendMessage.setTitleIfEmpty",
            detail: error,
          })
        )
      )
    ),
    O.getOrElse(() => Effect.void)
  );

const titleGuardForEditedTurn = (
  store: Thread.ThreadStore["Service"],
  threadId: WorkspaceIdentity.ThreadId,
  turnId: WorkspaceIdentity.TurnId
): Effect.Effect<O.Option<string>> =>
  store.timeline(threadId).pipe(
    Effect.map((timeline) =>
      isFirstUserMessageTurn(timeline, turnId) ? titleGuardForEditedFirstUserTurn(timeline, turnId) : O.none()
    ),
    Effect.catch((error) =>
      Effect.logWarning("chat title derivation skipped", {
        context: "EditMessage.firstUserTitleGate",
        detail: error,
      }).pipe(Effect.as(O.none<string>()))
    )
  );

// ---------------------------------------------------------------------------
// Chat operations (raw — plainly typed Effects/Streams)
// ---------------------------------------------------------------------------

/**
 * The chat orchestration operations over already-acquired services. Each
 * operation is a plainly typed `Effect`/`Stream` translated to the client-safe
 * {@link ChatActionError} at the boundary (std-09), with a per-action
 * `<slice>.<concept>.<action>` span (std-12). The app-level contract test drives
 * these directly without the rpc transport, and {@link ChatHandlersLive} adapts
 * them onto {@link ChatRpcs}.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeChatOperations = (
  store: Thread.ThreadStore["Service"],
  kernel: AgentTurnKernel["Service"],
  usage: UsageRecordSink["Service"]
) => ({
  listThreads: (workspaceId: WorkspaceIdentity.WorkspaceId) =>
    store
      .listThreads(workspaceId)
      .pipe(Effect.catch(toChatActionError("ListThreads")), Effect.withSpan("agents.chat.list_threads")),

  createThread: (workspaceId: WorkspaceIdentity.WorkspaceId, title: string) =>
    store
      .createThread({ workspaceId, title })
      .pipe(Effect.catch(toChatActionError("CreateThread")), Effect.withSpan("agents.chat.create_thread")),

  getTimeline: (threadId: WorkspaceIdentity.ThreadId): Effect.Effect<Thread.ThreadTimeline, ChatActionError> =>
    store
      .timeline(threadId)
      .pipe(Effect.catch(toChatActionError("GetTimeline")), Effect.withSpan("agents.chat.get_timeline")),

  sendMessage: (
    threadId: WorkspaceIdentity.ThreadId,
    content: Document.Type
  ): Stream.Stream<AssistantBlock, ChatActionError> =>
    Stream.unwrap(
      Effect.gen(function* () {
        yield* store
          .appendTurn({ threadId, parentTurnId: O.none(), role: "user", content })
          .pipe(Effect.catch(toChatActionError("SendMessage")));
        yield* setTitleFromFirstUserMessage(store, threadId, content);
        return streamAndPersist(store, kernel, usage, threadId, "send");
      })
    ).pipe(Stream.withSpan("agents.chat.send_message")),

  editMessage: (
    threadId: WorkspaceIdentity.ThreadId,
    turnId: WorkspaceIdentity.TurnId,
    content: Document.Type
  ): Stream.Stream<AssistantBlock, ChatActionError> =>
    Stream.unwrap(
      Effect.gen(function* () {
        const titleGuard = yield* titleGuardForEditedTurn(store, threadId, turnId);
        yield* store
          .appendTurn({ threadId, parentTurnId: O.some(turnId), role: "user", content })
          .pipe(Effect.catch(toChatActionError("EditMessage")));
        yield* pipe(
          titleGuard,
          O.map((emptyTitle) => setTitleFromFirstUserMessage(store, threadId, content, emptyTitle)),
          O.getOrElse(() => Effect.void)
        );
        return streamAndPersist(store, kernel, usage, threadId, "edit");
      })
    ).pipe(Stream.withSpan("agents.chat.edit_message")),
});

/**
 * Runtime type for the chat orchestration operations.
 */
type ChatOperations = ReturnType<typeof makeChatOperations>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Adapt the chat operations onto the {@link ChatRpcs} handler record.
 *
 * @category constructors
 * @since 0.0.0
 */
const makeChatHandlers = (operations: ChatOperations) =>
  ChatRpcs.of({
    ListThreads: ({ workspaceId }) => operations.listThreads(workspaceId),
    CreateThread: ({ workspaceId, title }) => operations.createThread(workspaceId, title),
    GetTimeline: ({ threadId }) => operations.getTimeline(threadId),
    SendMessage: ({ threadId, content }) => operations.sendMessage(threadId, content),
    EditMessage: ({ threadId, turnId, content }) => operations.editMessage(threadId, turnId, content),
  });

/**
 * Live chat orchestration handler layer for the {@link ChatRpcs} group. Requires
 * an {@link AgentTurnKernel}, a {@link Thread.ThreadStore}, and a
 * {@link UsageRecordSink}.
 *
 * @example
 * ```ts
 * import { ChatHandlersLive } from "@/chat/ChatOrchestrator"
 *
 * console.log(ChatHandlersLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ChatHandlersLive = ChatRpcs.toLayer(
  Effect.gen(function* () {
    const store = yield* Thread.ThreadStore;
    const kernel = yield* AgentTurnKernel;
    const usage = yield* UsageRecordSink;
    return makeChatHandlers(makeChatOperations(store, kernel, usage));
  })
);

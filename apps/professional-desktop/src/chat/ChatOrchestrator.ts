/**
 * Chat orchestration handler: the app-level wiring of the assistant-turn
 * kernel, the workspace ThreadStore, and the usage-record sink behind the
 * {@link ChatRpcs} wire contract.
 *
 * The user turn is persisted before streaming starts, and the assistant turn is
 * persisted when the stream ends — successfully or not.
 *
 * Persisting only on success (the original "cancel must leave no partial
 * assistant row" rule) left a stopped or failed turn as a user message with no
 * answer. That was not merely untidy: a reload showed an orphaned prompt with no
 * way to retry, and because the kernel is handed the whole conversation, the
 * *next* prompt arrived after an unanswered request — so the model answered the
 * abandoned one instead of the new one. An unfinished turn now records what it
 * produced, marked stopped or failed, and both the transcript and the history
 * stay well-formed.
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
import { Document, P, Text } from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability";
import { MessageRole } from "@beep/workspace-domain/entities/Message";
import { Thread } from "@beep/workspace-use-cases/server";
import { Cause, Clock, Duration, Effect, Exit, HashMap, Metric, Order, pipe, Ref, Semaphore, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DerivedThreadTitle } from "./DerivedThreadTitle.ts";
import { UsageRecordSink } from "./UsageRecordSink.ts";
import type { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import type { IndexedBlock, TurnGenerationError, TurnHistoryItem } from "@beep/agents-use-cases/public";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

// ---------------------------------------------------------------------------
// Document → plain text
// ---------------------------------------------------------------------------

/**
 * Project a `@beep/md` {@link Document} to plain text for the turn-kernel
 * history.
 *
 * @example
 * ```ts
 * import { userDocument } from "@/chat/ChatFixtures"
 * import { documentToPlainText } from "@/chat/ChatOrchestrator"
 *
 * const text = documentToPlainText(userDocument("Hello world"))
 * console.log(text)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const documentToPlainText = (document: Document.Type): string => renderPlainTextUnsafe(document);

const UNTITLED_THREAD_TITLE = "New thread" as const;

// What an unfinished assistant turn says. Appended after whatever had streamed,
// so a stopped answer reads as a truncated answer that was stopped, and an empty
// one still records that the request was made and abandoned.
const STOPPED_NOTE = "(stopped)" as const;
const FAILED_NOTE = "(failed)" as const;

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

// Only the conversation as it now stands is sent to the model. Flattening every
// turn handed the kernel the tail an edit had already replaced, so a rewritten
// prompt was answered in the context of the wording it replaced.
const projectTimelineToHistory = (timeline: Thread.ThreadTimeline): ReadonlyArray<TurnHistoryItem> =>
  pipe(
    Thread.activeBranchTurns(timeline.turns),
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

const toChatActionError = (context: string) =>
  Effect.fnUntraced(function* (error: { readonly _tag: string }): Effect.fn.Return<never, ChatActionError> {
    yield* logRedactedCause(
      Cause.fail(error),
      LogRedactedCauseOptions.make({
        message: "chat action dropped internal failure",
        level: "Warn",
        attributes: { context, subsystem: "chat" },
      })
    );
    return yield* ChatActionError.failEffect(context);
  });

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
    publicId: "epistemic_usage_record_a1",
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
const chatTurnsCompletedTotal = Metric.counter("agents_chat_turns_completed_total", { incremental: true });
const chatTurnsInterruptedTotal = Metric.counter("agents_chat_turns_interrupted_total", { incremental: true });
const chatTurnsZeroBlockTotal = Metric.counter("agents_chat_turns_zero_block_total", { incremental: true });
const chatPersistenceFailuresTotal = Metric.counter("agents_chat_persistence_failures_total", { incremental: true });
const chatTimeToFirstBlock = Metric.timer("agents_chat_time_to_first_block", {
  boundaries: [25, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 60000],
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

        // Persist runs once. A finished turn stores the streamed blocks, sorted by
        // envelope index and lifted to a Document, and appends the finalized-turn
        // usage record. Its failure channel is ChatActionError.
        //
        // An unfinished turn (`note` set) stores *only* the note — never the
        // partial model output, and never a usage record. The original rule was
        // "cancel must leave no partial assistant row", and that intent holds:
        // half-generated content is not kept, and nothing is billed. What changed
        // is that the turn is no longer erased entirely. Persisting nothing left
        // the user's prompt in the thread with no answer, and because the kernel
        // is handed the whole conversation, the *next* prompt arrived after an
        // unanswered request — so the model answered the abandoned one instead of
        // the new one (a stop-then-send returned the cancelled request's reply).
        // A reload showed the same prompt orphaned, with no way to retry. Saying
        // "(stopped)" keeps both the transcript and the history well-formed.
        const persist = Effect.fnUntraced(function* (note: O.Option<string>) {
          if (yield* Ref.getAndSet(persisted, true)) return;
          const content = O.match(note, {
            onNone: () =>
              assistantContentToDocument(
                A.map(A.sortWith(collected, indexOf, Order.Number), (indexed) => indexed.block)
              ),
            onSome: (text) => Document.make({ children: [P.make({ children: [Text.make({ value: text })] })] }),
          });
          yield* store
            .appendTurn({ threadId, parentTurnId: O.none(), role: "assistant", content })
            .pipe(Effect.catch(toChatActionError("SendMessage.persistAssistant")));
          if (O.isNone(note)) {
            // The answer is committed. A usage-accounting failure must not fail
            // the turn behind it: doing so reported a delivered answer as a
            // rejected send, so the client handed the prompt back and a retry
            // produced the answer a second time. Record the miss and move on.
            yield* usage.append(fixtureUsageRecord).pipe(
              Effect.tapError((error) =>
                logRedactedCause(
                  Cause.fail(error),
                  LogRedactedCauseOptions.make({
                    message: "assistant turn persisted but its usage record was not recorded",
                    level: "Warn",
                    attributes: { context: "SendMessage.usage", kind, subsystem: "chat" },
                  })
                )
              ),
              Effect.ignore
            );
          }
        });

        const persistWithTelemetry = persist(O.none()).pipe(
          Effect.tapError((error) =>
            trackTurnFailure("persist").pipe(
              Effect.andThen(Metric.update(Metric.withAttributes(chatPersistenceFailuresTotal, { kind }), 1)),
              Effect.andThen(
                logRedactedCause(
                  Cause.fail(error),
                  LogRedactedCauseOptions.make({
                    message: "chat stream failed",
                    level: "Warn",
                    attributes: { context: "SendMessage.persistAssistant", subsystem: "chat" },
                  })
                )
              )
            )
          )
        );

        const completeWithTelemetry = Effect.gen(function* () {
          yield* persistWithTelemetry;
          yield* Metric.update(Metric.withAttributes(chatTurnsCompletedTotal, { kind }), 1);
          if (A.isReadonlyArrayEmpty(collected)) {
            yield* Metric.update(Metric.withAttributes(chatTurnsZeroBlockTotal, { kind }), 1);
            yield* Effect.logWarning("chat turn completed without assistant blocks").pipe(
              Effect.annotateLogs({ kind })
            );
          }
          yield* Effect.logInfo("chat turn completed").pipe(Effect.annotateLogs({ kind }));
        });

        return kernel.streamTurn(history).pipe(
          Stream.tap(
            Effect.fnUntraced(function* (indexed: IndexedBlock) {
              if (A.isReadonlyArrayEmpty(collected)) {
                const firstBlockAt = yield* Clock.currentTimeMillis;
                yield* Metric.update(
                  Metric.withAttributes(chatTimeToFirstBlock, { kind }),
                  Duration.millis(firstBlockAt - startedAt)
                );
              }
              collected = A.append(collected, indexed);
              yield* Metric.update(Metric.withAttributes(chatBlocksStreamedTotal, { kind }), 1);
            })
          ),
          Stream.tapError((error) =>
            trackTurnFailure("kernel").pipe(
              Effect.andThen(
                logRedactedCause(
                  Cause.fail(error),
                  LogRedactedCauseOptions.make({
                    message: "chat stream failed",
                    level: "Warn",
                    attributes: { context: "SendMessage.kernel", subsystem: "chat" },
                  })
                )
              )
            )
          ),
          // wire stays bare blocks; envelope indices are a handler-side concern
          Stream.map((indexed): AssistantBlock => indexed.block),
          Stream.onEnd(completeWithTelemetry),
          // A turn that stops or fails still happened: record it (with whatever
          // had streamed) so the prompt is not left hanging. `persist` is
          // idempotent, so the success path above already claimed it and this is
          // a no-op there. A persistence failure here must not replace the
          // original cause, so it is logged and swallowed.
          Stream.onExit((exit) =>
            Exit.isSuccess(exit)
              ? Effect.void
              : persist(O.some(Cause.hasInterrupts(exit.cause) ? STOPPED_NOTE : FAILED_NOTE)).pipe(
                  Effect.tapError((error) =>
                    logRedactedCause(
                      Cause.fail(error),
                      LogRedactedCauseOptions.make({
                        message: "chat turn could not record its interruption",
                        level: "Warn",
                        attributes: { context: "SendMessage.persistInterrupted", subsystem: "chat" },
                      })
                    )
                  ),
                  Effect.ignore
                )
          ),
          // translate the kernel's TurnGenerationError to the client-safe wire
          // error; the persist ChatActionError passes through unchanged (std-09).
          Stream.mapError(
            (error: TurnGenerationError | ChatActionError): ChatActionError =>
              S.is(ChatActionError)(error) ? error : ChatActionError.new(error.message)
          ),
          Stream.onExit((exit) =>
            Exit.hasInterrupts(exit)
              ? Metric.update(Metric.withAttributes(chatTurnsInterruptedTotal, { kind }), 1).pipe(
                  Effect.andThen(Effect.logInfo("chat turn interrupted").pipe(Effect.annotateLogs({ kind })))
                )
              : Effect.void
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
          logRedactedCause(
            Cause.fail(error),
            LogRedactedCauseOptions.make({
              message: "chat title derivation skipped",
              level: "Warn",
              attributes: { context: "SendMessage.setTitleIfEmpty", subsystem: "chat" },
            })
          )
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
      logRedactedCause(
        Cause.fail(error),
        LogRedactedCauseOptions.make({
          message: "chat title derivation skipped",
          level: "Warn",
          attributes: { context: "EditMessage.firstUserTitleGate", subsystem: "chat" },
        })
      ).pipe(Effect.as(O.none<string>()))
    )
  );

// ---------------------------------------------------------------------------
// Chat operations (raw — plainly typed Effects/Streams)
// ---------------------------------------------------------------------------

/**
 * One turn at a time per thread.
 *
 * A turn appends the user message, reads the whole conversation back, and asks
 * the kernel to continue it. Two turns in flight on the same thread therefore
 * interleave: both prompts land with no answer between them, and each kernel is
 * handed a history ending in two unanswered requests — so both answer the
 * *first* one. Two windows on one thread produced two copies of the reply to the
 * first message and none to the second, and a reload showed that corruption was
 * persisted.
 *
 * Serializing the whole turn — append, stream, persist — restores the invariant
 * a conversation already implies: the model never sees an unanswered prompt that
 * is not the one it is answering. The permit is held for the life of the stream,
 * so a concurrent send waits rather than racing.
 */
const threadTurnLocks = Ref.makeUnsafe(HashMap.empty<WorkspaceIdentity.ThreadId, Semaphore.Semaphore>());

const threadTurnLock = Effect.fn("chat.threadTurnLock")(function* (threadId: WorkspaceIdentity.ThreadId) {
  return yield* Ref.modify(threadTurnLocks, (locks) =>
    pipe(
      HashMap.get(locks, threadId),
      O.match({
        onSome: (
          existing
        ): readonly [Semaphore.Semaphore, HashMap.HashMap<WorkspaceIdentity.ThreadId, Semaphore.Semaphore>] => [
          existing,
          locks,
        ],
        onNone: (): readonly [
          Semaphore.Semaphore,
          HashMap.HashMap<WorkspaceIdentity.ThreadId, Semaphore.Semaphore>,
        ] => {
          const created = Semaphore.makeUnsafe(1);
          return [created, HashMap.set(locks, threadId, created)];
        },
      })
    )
  );
});

const holdThreadTurnPermit = Effect.fn("chat.holdThreadTurnPermit")(function* (threadId: WorkspaceIdentity.ThreadId) {
  const lock = yield* threadTurnLock(threadId);
  // Released when the stream's scope closes — completion, failure, or stop.
  yield* Effect.acquireRelease(lock.take(1), () => lock.release(1));
});

/**
 * The chat orchestration operations over already-acquired services. Each
 * operation is a plainly typed `Effect`/`Stream` translated to the client-safe
 * {@link ChatActionError} at the boundary (std-09), with a per-action
 * `<slice>.<concept>.<action>` span (std-12). The app-level contract test drives
 * these directly without the rpc transport, and {@link ChatHandlersLive} adapts
 * them onto {@link ChatRpcs}.
 *
 * @example
 * ```ts
 * import { AgentTurnKernel } from "@beep/agents-use-cases/public"
 * import { Thread } from "@beep/workspace-use-cases/server"
 * import { Effect } from "effect"
 * import { makeChatOperations } from "@/chat/ChatOrchestrator"
 * import { UsageRecordSink } from "@/chat/UsageRecordSink"
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* Thread.ThreadStore
 *   const kernel = yield* AgentTurnKernel
 *   const usage = yield* UsageRecordSink
 *   return makeChatOperations(store, kernel, usage)
 * })
 * ```
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
        yield* holdThreadTurnPermit(threadId);
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
        yield* holdThreadTurnPermit(threadId);
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

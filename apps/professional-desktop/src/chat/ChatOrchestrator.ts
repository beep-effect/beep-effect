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
  AssistantTurnEvent,
  AssistantTurnHistoryItem,
  ChatActionError,
  ChatRpcs,
  ProviderUsageMetadata,
  TurnGenerationError,
  UserTurnHistoryItem,
} from "@beep/agents-use-cases/public";
import { appendTurnFinalizationUsageRecord, TurnFinalizationUsageAppend } from "@beep/epistemic-domain";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { Document, P, Text } from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability";
import { LiteralKit } from "@beep/schema";
import { A, Eq, flow, O, Str, thunkEffectVoid, thunkFalse } from "@beep/utils";
import { MessageRole } from "@beep/workspace-domain/entities/Message";
import { Thread } from "@beep/workspace-use-cases/server";
import {
  Cause,
  Clock,
  Context,
  Duration,
  Effect,
  Exit,
  HashMap,
  Layer,
  Metric,
  Number as N,
  Order,
  pipe,
  Ref,
  Semaphore,
  Stream,
  Tuple,
} from "effect";
import * as S from "effect/Schema";
import { DerivedThreadTitle } from "./DerivedThreadTitle.ts";
import { approximateCostUsdMicros } from "./UsagePricing.ts";
import { UsageRecordSink } from "./UsageRecordSink.ts";
import type { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import type { IndexedBlock, TurnHistoryItem, TurnRequestStatus } from "@beep/agents-use-cases/public";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const $I = $ProfessionalDesktopId.create("chat/ChatOrchestrator");

// ---------------------------------------------------------------------------
// Document → plain text
// ---------------------------------------------------------------------------

/**
 * Project a `@beep/md` {@link Document} to plain text for the turn-kernel
 * history.
 *
 * **Example** (Convert document to plain text)
 *
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

const UNTITLED_THREAD_TITLE = "New thread";

// What an unfinished assistant turn says. Appended after whatever had streamed,
// so a stopped answer reads as a truncated answer that was stopped, and an empty
// one still records that the request was made and abandoned.
const STOPPED_NOTE = "(stopped)";
const FAILED_NOTE = "(failed)";
const CHAT_TURN_FAILED_MESSAGE = "The assistant could not complete this response.";
const terminalNoteDocument = (text: string): Document.Type =>
  Document.make({ children: [P.make({ children: [Text.make({ value: text })] })] });

const decodeDerivedThreadTitle = S.decodeUnknownOption(DerivedThreadTitle);
const isChatActionError = S.is(ChatActionError);
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
      onNone: thunkFalse,
      onSome: Eq.equals(turnId),
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
        Thread.TimelineItem.match({
          message: messageItemToHistory,
          tool_call: A.emptyReadonly<TurnHistoryItem>,
        })
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

// A prior assistant-store outage can leave the active branch ending in a user
// prompt. Repair that terminal marker before accepting another prompt so the
// kernel is never handed two unanswered user turns. If persistence is still
// unavailable, the new send fails before appending its user row and can retry
// this repair after the store recovers.
const repairOrphanedUserTurn = Effect.fn("agents.chat.repair_orphaned_user_turn")(function* (
  store: Thread.ThreadStore["Service"],
  threadId: WorkspaceIdentity.ThreadId
) {
  const timeline = yield* store.timeline(threadId).pipe(Effect.catch(toChatActionError("SendMessage.repairTimeline")));
  if (!O.exists(A.last(projectTimelineToHistory(timeline)), (turn) => turn.role === "user")) return;
  yield* store
    .appendTurn({
      threadId,
      parentTurnId: O.none(),
      role: "assistant",
      content: terminalNoteDocument(FAILED_NOTE),
    })
    .pipe(Effect.catch(toChatActionError("SendMessage.repairAssistant")));
});

// ---------------------------------------------------------------------------
// Usage-record synthesis
// ---------------------------------------------------------------------------

const SYSTEM_PRINCIPAL = { component: "Runtime", kind: "System" } as const;
const ACTIVITY_LINK_UNAVAILABLE = "unavailable_no_activity_store";

const decodeUsageAppend = S.decodeUnknownEffect(TurnFinalizationUsageAppend);
const encodeProviderUsage = S.encodeUnknownEffect(ProviderUsageMetadata);

/**
 * Build the finalized-turn {@link UsageRecord} from the kernel's provider
 * metadata and the real persisted assistant turn. `Activity` has a domain
 * model but no persistence table, repository, or desktop sink in this slice,
 * so `activityId` is explicitly absent and the real assistant-turn public id is
 * retained in metadata rather than inventing an Activity id.
 */
const makeTurnFinalizationUsageRecord = Effect.fn("agents.chat.make_turn_finalization_usage_record")(function* (
  assistant: Thread.AppendTurnResult,
  providerUsage: ProviderUsageMetadata,
  finalizedAt: number,
  latencyMillis: number,
  threadId: WorkspaceIdentity.ThreadId
) {
  const encodedUsage = yield* encodeProviderUsage(providerUsage);
  const append = yield* decodeUsageAppend({
    createdAt: finalizedAt,
    createdByPrincipal: SYSTEM_PRINCIPAL,
    entityType: "EpistemicUsageRecord",
    id: assistant.turn.id,
    orgId: assistant.turn.orgId,
    publicId: Str.replace("workspace_turn_", "epistemic_usage_record_")(assistant.turn.publicId),
    rowVersion: 1,
    schemaVersion: "0.0.0",
    source: "Agent",
    updatedAt: finalizedAt,
    updatedByPrincipal: SYSTEM_PRINCIPAL,
    activityId: null,
    actor: SYSTEM_PRINCIPAL,
    costUsdApproxMicros: O.getOrNull(approximateCostUsdMicros(providerUsage)),
    credentialReference: null,
    inputTokens: providerUsage.inputTokens,
    latencyMillis,
    metadata: {
      activityLinkStatus: ACTIVITY_LINK_UNAVAILABLE,
      assistantTurnPublicId: assistant.turn.publicId,
      stopReason: encodedUsage.stopReason,
      threadId,
    },
    model: providerUsage.model,
    outputTokens: providerUsage.outputTokens,
    provider: providerUsage.provider,
    totalTokens: N.sum(providerUsage.inputTokens, providerUsage.outputTokens),
    unitCount: null,
  });
  return appendTurnFinalizationUsageRecord(append);
});

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

const ChatTurnKind = LiteralKit(["send", "edit"]).pipe(
  $I.annoteSchema("ChatTurnKind", {
    description: "Chat turn origins attributed on desktop turn metrics.",
  })
);
type ChatTurnKind = typeof ChatTurnKind.Type;

const ChatTurnFailurePhase = LiteralKit(["kernel", "persist", "prepare"]).pipe(
  $I.annoteSchema("ChatTurnFailurePhase", {
    description: "Turn phases attributed on desktop chat turn failure metrics.",
  })
);
type ChatTurnFailurePhase = typeof ChatTurnFailurePhase.Type;

/**
 * Build the assistant-turn stream for a thread: stream the kernel turn,
 * collecting indexed blocks as they pass. Successful completion persists the
 * assistant content and appends the usage record; failure or interruption
 * persists only a terminal marker. A single-shot `Ref` guard makes the persist
 * run at most once, so partial model output is never stored or billed.
 */
const streamAndPersist = (
  store: Thread.ThreadStore["Service"],
  kernel: AgentTurnKernel["Service"],
  usage: UsageRecordSink["Service"],
  coordinator: ChatCoordinator["Service"],
  threadId: WorkspaceIdentity.ThreadId,
  kind: ChatTurnKind,
  requestId: string,
  requestGeneration: number
): Stream.Stream<AssistantBlock, ChatActionError> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const startedAt = yield* Clock.currentTimeMillis;
      const trackTurnFailure = (phase: ChatTurnFailurePhase) =>
        Metric.update(
          Metric.withAttributes(chatTurnFailuresTotal, {
            kind,
            phase,
          }),
          1
        );
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
        const finalizedAt = yield* Ref.make<O.Option<number>>(O.none());
        const finalizedUsage = yield* Ref.make<O.Option<ProviderUsageMetadata>>(O.none());

        const requireFinalization = Effect.fnUntraced(function* () {
          const observed = O.all({
            finalizedAt: yield* Ref.get(finalizedAt),
            usage: yield* Ref.get(finalizedUsage),
          });
          return yield* Effect.fromOption(observed, () =>
            TurnGenerationError.make({
              message: "Assistant turn stream ended without a provider-usage finalization signal",
            })
          );
        });

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
          const committed = yield* Effect.gen(function* () {
            if (yield* Ref.getAndSet(persisted, true)) return O.none<Thread.AppendTurnResult>();
            const content = O.match(note, {
              onNone: () =>
                assistantContentToDocument(
                  A.map(A.sortWith(collected, indexOf, Order.Number), (indexed) => indexed.block)
                ),
              onSome: terminalNoteDocument,
            });
            const assistant = yield* store
              .appendTurn({
                threadId,
                parentTurnId: O.none(),
                role: "assistant",
                content,
              })
              .pipe(Effect.catch(toChatActionError("SendMessage.persistAssistant")));
            yield* setTurnRequestStatus(
              coordinator,
              requestId,
              TurnRequestReceipts.cases.persisted.make({ generation: requestGeneration })
            );
            return O.some(assistant);
          }).pipe(
            Effect.tapError(() => Ref.set(persisted, false)),
            Effect.uninterruptible
          );
          if (O.isNone(committed)) return;
          if (O.isNone(note)) {
            // The answer is committed. A usage-accounting failure must not fail
            // the turn behind it: doing so reported a delivered answer as a
            // rejected send, so the client handed the prompt back and a retry
            // produced the answer a second time. Record the miss and move on.
            const finalization = yield* requireFinalization();
            yield* makeTurnFinalizationUsageRecord(
              committed.value,
              finalization.usage,
              finalization.finalizedAt,
              N.max(0, N.subtract(finalization.finalizedAt, startedAt)),
              threadId
            ).pipe(
              Effect.flatMap(usage.append),
              Effect.tapError(
                flow(
                  Cause.fail,
                  logRedactedCause(
                    LogRedactedCauseOptions.make({
                      message: "assistant turn persisted but its usage record was not recorded",
                      level: "Warn",
                      attributes: {
                        context: "SendMessage.usage",
                        kind,
                        subsystem: "chat",
                      },
                    })
                  )
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
                    attributes: {
                      context: "SendMessage.persistAssistant",
                      subsystem: "chat",
                    },
                  })
                )
              )
            )
          )
        );

        const completeWithTelemetry = Effect.gen(function* () {
          yield* requireFinalization();
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

        const handleTurnEvent = Effect.fnUntraced(function* (event: AssistantTurnEvent) {
          return yield* AssistantTurnEvent.match(event, {
            block: Effect.fnUntraced(function* ({ block: indexed }) {
              if (A.isReadonlyArrayEmpty(collected)) {
                const firstBlockAt = yield* Clock.currentTimeMillis;
                yield* Metric.update(
                  Metric.withAttributes(chatTimeToFirstBlock, { kind }),
                  Duration.millis(firstBlockAt - startedAt)
                );
              }
              collected = A.append(collected, indexed);
              yield* Metric.update(Metric.withAttributes(chatBlocksStreamedTotal, { kind }), 1);
              return O.some(indexed.block);
            }),
            finalization: Effect.fnUntraced(function* (event) {
              const completedAt = yield* Clock.currentTimeMillis;
              yield* Ref.set(finalizedUsage, O.some(event.usage));
              yield* Ref.set(finalizedAt, O.some(completedAt));
              return O.none<AssistantBlock>();
            }),
          });
        });

        return kernel.streamTurn(history).pipe(
          Stream.mapEffect(handleTurnEvent),
          Stream.flatMap(
            O.match({
              onNone: () => Stream.empty,
              onSome: Stream.succeed,
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
                    attributes: {
                      context: "SendMessage.kernel",
                      subsystem: "chat",
                    },
                  })
                )
              )
            )
          ),
          // wire stays bare blocks; kernel events are a handler-side concern
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
                  Effect.tapError(
                    flow(
                      Cause.fail,
                      logRedactedCause(
                        LogRedactedCauseOptions.make({
                          message: "chat turn could not record its interruption",
                          level: "Warn",
                          attributes: {
                            context: "SendMessage.persistInterrupted",
                            subsystem: "chat",
                          },
                        })
                      )
                    )
                  ),
                  Effect.ignore
                )
          ),
          // translate the kernel's TurnGenerationError to the client-safe wire
          // error; the persist ChatActionError passes through unchanged (std-09).
          Stream.mapError(
            (error: TurnGenerationError | ChatActionError): ChatActionError =>
              isChatActionError(error) ? error : ChatActionError.new(CHAT_TURN_FAILED_MESSAGE)
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
        Effect.catch(
          flow(
            Cause.fail,
            logRedactedCause(
              LogRedactedCauseOptions.make({
                message: "chat title derivation skipped",
                level: "Warn",
                attributes: {
                  context: "SendMessage.setTitleIfEmpty",
                  subsystem: "chat",
                },
              })
            )
          )
        )
      )
    ),
    O.getOrElse(thunkEffectVoid)
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
    Effect.catch(
      flow(
        Cause.fail,
        logRedactedCause(
          LogRedactedCauseOptions.make({
            message: "chat title derivation skipped",
            level: "Warn",
            attributes: {
              context: "EditMessage.firstUserTitleGate",
              subsystem: "chat",
            },
          })
        ),
        Effect.as(O.none<string>())
      )
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
const TurnRequestReceiptFields = { generation: S.Int };

class PendingTurnRequestReceipt extends S.Class<PendingTurnRequestReceipt>($I`PendingTurnRequestReceipt`)(
  { ...TurnRequestReceiptFields, status: S.tag("pending") },
  $I.annote("PendingTurnRequestReceipt", {
    description: "Generation-scoped pending persistence receipt for a chat turn request.",
  })
) {}

class AcceptedTurnRequestReceipt extends S.Class<AcceptedTurnRequestReceipt>($I`AcceptedTurnRequestReceipt`)(
  { ...TurnRequestReceiptFields, status: S.tag("accepted") },
  $I.annote("AcceptedTurnRequestReceipt", {
    description: "Generation-scoped accepted persistence receipt for a chat turn request.",
  })
) {}

class PersistedTurnRequestReceipt extends S.Class<PersistedTurnRequestReceipt>($I`PersistedTurnRequestReceipt`)(
  { ...TurnRequestReceiptFields, status: S.tag("persisted") },
  $I.annote("PersistedTurnRequestReceipt", {
    description: "Generation-scoped persisted receipt for a chat turn request.",
  })
) {}

class UserPersistedTurnRequestReceipt extends S.Class<UserPersistedTurnRequestReceipt>(
  $I`UserPersistedTurnRequestReceipt`
)(
  { ...TurnRequestReceiptFields, status: S.tag("user_persisted") },
  $I.annote("UserPersistedTurnRequestReceipt", {
    description: "Generation-scoped user-persisted receipt for a chat turn request.",
  })
) {}

class NotPersistedTurnRequestReceipt extends S.Class<NotPersistedTurnRequestReceipt>(
  $I`NotPersistedTurnRequestReceipt`
)(
  { ...TurnRequestReceiptFields, status: S.tag("not_persisted") },
  $I.annote("NotPersistedTurnRequestReceipt", {
    description: "Generation-scoped non-persisted receipt for a chat turn request.",
  })
) {}

// The receipt lifecycle is the shared rpc family minus "unknown". A literal
// tuple is required (deriving via omitOptions loses tuple-ness and collapses
// the receipt mapping below to one member); membership in the rpc family is
// enforced where receipt statuses flow into getTurnRequestStatus's
// TurnRequestStatus-typed return.
const TurnRequestReceiptStatus = LiteralKit([
  "pending",
  "accepted",
  "persisted",
  "user_persisted",
  "not_persisted",
]).pipe(
  $I.annoteSchema("TurnRequestReceiptStatus", {
    description: "Lifecycle variants for generation-scoped chat persistence receipts.",
  })
);

const TurnRequestReceipts = TurnRequestReceiptStatus.mapMembers(
  Tuple.evolve([
    () => PendingTurnRequestReceipt,
    () => AcceptedTurnRequestReceipt,
    () => PersistedTurnRequestReceipt,
    () => UserPersistedTurnRequestReceipt,
    () => NotPersistedTurnRequestReceipt,
  ])
).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("TurnRequestReceipts", {
    description: "Generation-scoped persistence receipts for chat turn requests.",
  })
);

type TurnRequestReceipt = typeof TurnRequestReceipts.Type;
type TurnRequestQueryStatus = TurnRequestStatus;
const TURN_REQUEST_STATUS_TTL_MILLIS = Duration.toMillis(Duration.minutes(5));

class TrackedTurnRequestReceipt extends S.Class<TrackedTurnRequestReceipt>($I`TrackedTurnRequestReceipt`)(
  {
    receipt: TurnRequestReceipts,
    expiresAt: S.Option(S.Int),
  },
  $I.annote("TrackedTurnRequestReceipt", {
    description: "A chat turn request receipt and its optional terminal-state expiry time.",
  })
) {}

type ThreadTurnLockEntry = {
  readonly semaphore: Semaphore.Semaphore;
  readonly users: number;
};

type ChatCoordinatorShape = {
  readonly threadTurnLocks: Ref.Ref<HashMap.HashMap<WorkspaceIdentity.ThreadId, ThreadTurnLockEntry>>;
  readonly turnRequestStatuses: Ref.Ref<HashMap.HashMap<string, TrackedTurnRequestReceipt>>;
  readonly internalRequestSequence: Ref.Ref<number>;
  readonly requestReceiptGeneration: Ref.Ref<number>;
};

class ChatCoordinator extends Context.Service<ChatCoordinator, ChatCoordinatorShape>()($I`ChatCoordinator`) {}

const makeChatCoordinator = Effect.gen(function* () {
  const threadTurnLocks = yield* Ref.make(HashMap.empty<WorkspaceIdentity.ThreadId, ThreadTurnLockEntry>());
  const turnRequestStatuses = yield* Ref.make(HashMap.empty<string, TrackedTurnRequestReceipt>());
  const internalRequestSequence = yield* Ref.make(0);
  const requestReceiptGeneration = yield* Ref.make(0);
  return ChatCoordinator.of({
    threadTurnLocks,
    turnRequestStatuses,
    internalRequestSequence,
    requestReceiptGeneration,
  });
});

const ChatCoordinatorLive = Layer.effect(ChatCoordinator, makeChatCoordinator);

const nextInternalRequestId = (coordinator: ChatCoordinator["Service"]) =>
  Ref.getAndUpdate(coordinator.internalRequestSequence, (sequence) => sequence + 1).pipe(
    Effect.map((sequence) => `internal:${sequence}`)
  );

const nextRequestReceiptGeneration = (coordinator: ChatCoordinator["Service"]) =>
  Ref.getAndUpdate(coordinator.requestReceiptGeneration, (generation) => generation + 1);

const setTurnRequestStatus = (
  coordinator: ChatCoordinator["Service"],
  requestId: string,
  receipt: TurnRequestReceipt
) =>
  Ref.update(coordinator.turnRequestStatuses, (statuses) =>
    pipe(
      HashMap.get(statuses, requestId),
      O.filter((current) => current.receipt.generation === receipt.generation),
      O.match({
        onNone: () => statuses,
        onSome: () =>
          HashMap.set(
            statuses,
            requestId,
            TrackedTurnRequestReceipt.make({
              receipt,
              expiresAt: O.none(),
            })
          ),
      })
    )
  );

const getTurnRequestStatus = (coordinator: ChatCoordinator["Service"], requestId: string) =>
  Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) =>
      Ref.modify(coordinator.turnRequestStatuses, (statuses) =>
        O.match(HashMap.get(statuses, requestId), {
          onNone: (): readonly [TurnRequestQueryStatus, typeof statuses] => ["unknown", statuses],
          onSome: (tracked): readonly [TurnRequestQueryStatus, typeof statuses] =>
            O.exists(tracked.expiresAt, (expiresAt) => expiresAt <= now)
              ? ["unknown", HashMap.remove(statuses, requestId)]
              : [tracked.receipt.status, statuses],
        })
      )
    ),
    Effect.withSpan("agents.chat.get_turn_request_status")
  );

const finalizeTurnRequestStatus = (coordinator: ChatCoordinator["Service"], requestId: string, generation: number) =>
  Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) =>
      Ref.update(coordinator.turnRequestStatuses, (statuses) =>
        O.match(HashMap.get(statuses, requestId), {
          onNone: () => statuses,
          onSome: (tracked) => {
            if (tracked.receipt.generation !== generation) return statuses;
            const terminalReceipt = TurnRequestReceipts.match(tracked.receipt, {
              pending: ({ generation }) => TurnRequestReceipts.cases.not_persisted.make({ generation }),
              accepted: ({ generation }) => TurnRequestReceipts.cases.user_persisted.make({ generation }),
              persisted: (receipt) => receipt,
              user_persisted: (receipt) => receipt,
              not_persisted: (receipt) => receipt,
            });
            return HashMap.set(
              statuses,
              requestId,
              TrackedTurnRequestReceipt.make({
                receipt: terminalReceipt,
                expiresAt: O.some(now + TURN_REQUEST_STATUS_TTL_MILLIS),
              })
            );
          },
        })
      )
    )
  );

const trackTurnRequest = <A, E>(
  coordinator: ChatCoordinator["Service"],
  requestId: string,
  generation: number,
  stream: Stream.Stream<A, E>
): Stream.Stream<A, E> => {
  const pendingReceipt = TurnRequestReceipts.cases.pending.make({ generation });
  return Stream.unwrap(
    Clock.currentTimeMillis.pipe(
      Effect.flatMap((now) =>
        Ref.update(coordinator.turnRequestStatuses, (statuses) =>
          HashMap.set(
            HashMap.filter(statuses, (tracked) => !O.exists(tracked.expiresAt, N.isLessThanOrEqualTo(now))),
            requestId,
            TrackedTurnRequestReceipt.make({
              receipt: pendingReceipt,
              expiresAt: O.none(),
            })
          )
        )
      ),
      Effect.as(stream)
    )
  ).pipe(Stream.ensuring(finalizeTurnRequestStatus(coordinator, requestId, generation)));
};

const acquireThreadTurnLock = Effect.fn("agents.chat.acquire_thread_turn_lock")(function* (
  coordinator: ChatCoordinator["Service"],
  threadId: WorkspaceIdentity.ThreadId
) {
  return yield* Ref.modify(coordinator.threadTurnLocks, (locks) =>
    O.match(HashMap.get(locks, threadId), {
      onSome: (entry): readonly [Semaphore.Semaphore, typeof locks] => [
        entry.semaphore,
        HashMap.set(locks, threadId, { ...entry, users: entry.users + 1 }),
      ],
      onNone: (): readonly [Semaphore.Semaphore, typeof locks] => {
        const semaphore = Semaphore.makeUnsafe(1);
        return [semaphore, HashMap.set(locks, threadId, { semaphore, users: 1 })];
      },
    })
  );
});

const releaseThreadTurnLock = (
  coordinator: ChatCoordinator["Service"],
  threadId: WorkspaceIdentity.ThreadId,
  semaphore: Semaphore.Semaphore
) =>
  Ref.update(coordinator.threadTurnLocks, (locks) =>
    O.match(HashMap.get(locks, threadId), {
      onNone: () => locks,
      onSome: (entry) =>
        entry.semaphore !== semaphore
          ? locks
          : entry.users === 1
            ? HashMap.remove(locks, threadId)
            : HashMap.set(locks, threadId, { ...entry, users: entry.users - 1 }),
    })
  );

const holdThreadTurnPermit = Effect.fn("agents.chat.hold_thread_turn_permit")(function* (
  coordinator: ChatCoordinator["Service"],
  threadId: WorkspaceIdentity.ThreadId
) {
  yield* Effect.acquireRelease(
    acquireThreadTurnLock(coordinator, threadId).pipe(
      Effect.tap((semaphore) =>
        semaphore.take(1).pipe(Effect.onInterrupt(() => releaseThreadTurnLock(coordinator, threadId, semaphore)))
      )
    ),
    (semaphore) => semaphore.release(1).pipe(Effect.andThen(releaseThreadTurnLock(coordinator, threadId, semaphore)))
  );
  // Released when the stream's scope closes — completion, failure, or stop.
});

const trackedThreadTurn = (
  coordinator: ChatCoordinator["Service"],
  threadId: WorkspaceIdentity.ThreadId,
  requestId: string | undefined,
  makeStream: (
    resolvedRequestId: string,
    requestGeneration: number
  ) => Effect.Effect<Stream.Stream<AssistantBlock, ChatActionError>, ChatActionError>
): Stream.Stream<AssistantBlock, ChatActionError> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const resolvedRequestId = requestId ?? (yield* nextInternalRequestId(coordinator));
      const requestGeneration = yield* nextRequestReceiptGeneration(coordinator);
      return trackTurnRequest(
        coordinator,
        resolvedRequestId,
        requestGeneration,
        Stream.unwrap(
          Effect.gen(function* () {
            yield* holdThreadTurnPermit(coordinator, threadId);
            return yield* makeStream(resolvedRequestId, requestGeneration);
          })
        )
      );
    })
  );

/**
 * The chat orchestration operations over already-acquired services. Each
 * operation is a plainly typed `Effect`/`Stream` translated to the client-safe
 * {@link ChatActionError} at the boundary (std-09), with a per-action
 * `<slice>.<concept>.<action>` span (std-12). The app-level contract test drives
 * these directly without the rpc transport, and {@link ChatHandlersLive} adapts
 * them onto {@link ChatRpcs}.
 *
 * **Example** (Compose operations from services)
 *
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
 *   return yield* makeChatOperations(store, kernel, usage)
 * })
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
const makeChatOperationsWith = (
  store: Thread.ThreadStore["Service"],
  kernel: AgentTurnKernel["Service"],
  usage: UsageRecordSink["Service"],
  coordinator: ChatCoordinator["Service"]
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

  getTurnRequestStatus: (requestId: string) => getTurnRequestStatus(coordinator, requestId),

  sendMessage: (
    threadId: WorkspaceIdentity.ThreadId,
    content: Document.Type,
    requestId?: string
  ): Stream.Stream<AssistantBlock, ChatActionError> =>
    trackedThreadTurn(
      coordinator,
      threadId,
      requestId,
      Effect.fnUntraced(function* (resolvedRequestId, requestGeneration) {
        yield* repairOrphanedUserTurn(store, threadId);
        yield* Effect.uninterruptible(
          store
            .appendTurn({
              threadId,
              parentTurnId: O.none(),
              role: "user",
              content,
            })
            .pipe(
              Effect.catch(toChatActionError("SendMessage")),
              Effect.andThen(
                setTurnRequestStatus(
                  coordinator,
                  resolvedRequestId,
                  TurnRequestReceipts.cases.accepted.make({ generation: requestGeneration })
                )
              )
            )
        );
        yield* setTitleFromFirstUserMessage(store, threadId, content);
        return streamAndPersist(
          store,
          kernel,
          usage,
          coordinator,
          threadId,
          "send",
          resolvedRequestId,
          requestGeneration
        );
      })
    ).pipe(Stream.withSpan("agents.chat.send_message")),

  editMessage: (
    threadId: WorkspaceIdentity.ThreadId,
    turnId: WorkspaceIdentity.TurnId,
    content: Document.Type,
    requestId?: string
  ): Stream.Stream<AssistantBlock, ChatActionError> =>
    trackedThreadTurn(
      coordinator,
      threadId,
      requestId,
      Effect.fnUntraced(function* (resolvedRequestId, requestGeneration) {
        const titleGuard = yield* titleGuardForEditedTurn(store, threadId, turnId);
        yield* Effect.uninterruptible(
          store
            .appendTurn({
              threadId,
              parentTurnId: O.some(turnId),
              role: "user",
              content,
            })
            .pipe(
              Effect.catch(toChatActionError("EditMessage")),
              Effect.andThen(
                setTurnRequestStatus(
                  coordinator,
                  resolvedRequestId,
                  TurnRequestReceipts.cases.accepted.make({ generation: requestGeneration })
                )
              )
            )
        );
        yield* pipe(
          titleGuard,
          O.map((emptyTitle) => setTitleFromFirstUserMessage(store, threadId, content, emptyTitle)),
          O.getOrElse(() => Effect.void)
        );
        return streamAndPersist(
          store,
          kernel,
          usage,
          coordinator,
          threadId,
          "edit",
          resolvedRequestId,
          requestGeneration
        );
      })
    ).pipe(Stream.withSpan("agents.chat.edit_message")),
});

/**
 * Construct an isolated set of chat orchestration operations over
 * already-acquired services.
 *
 * **Example** (Construct isolated chat operations)
 *
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
 *   return yield* makeChatOperations(store, kernel, usage)
 * })
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeChatOperations = Effect.fn("agents.chat.make_operations")(function* (
  store: Thread.ThreadStore["Service"],
  kernel: AgentTurnKernel["Service"],
  usage: UsageRecordSink["Service"]
) {
  const coordinator = yield* makeChatCoordinator;
  return makeChatOperationsWith(store, kernel, usage, coordinator);
});

/**
 * Runtime type for the chat orchestration operations.
 */
type ChatOperations = ReturnType<typeof makeChatOperationsWith>;

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
    GetTurnRequestStatus: ({ requestId }) => operations.getTurnRequestStatus(requestId),
    SendMessage: ({ threadId, content, requestId }) => operations.sendMessage(threadId, content, requestId),
    EditMessage: ({ threadId, turnId, content, requestId }) =>
      operations.editMessage(threadId, turnId, content, requestId),
  });

/**
 * Live chat orchestration handler layer for the {@link ChatRpcs} group. Requires
 * an {@link AgentTurnKernel}, a {@link Thread.ThreadStore}, and a
 * {@link UsageRecordSink}.
 *
 * **Example** (Verify handlers live layer)
 *
 * ```ts
 * import { ChatHandlersLive } from "@/chat/ChatOrchestrator"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ChatHandlersLive)) // true
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
    const coordinator = yield* ChatCoordinator;
    return makeChatHandlers(makeChatOperationsWith(store, kernel, usage, coordinator));
  })
).pipe(Layer.provide(ChatCoordinatorLive));

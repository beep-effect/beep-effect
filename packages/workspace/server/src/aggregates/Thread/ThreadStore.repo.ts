/**
 * ThreadStore repository adapters.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { Document } from "@beep/md/Md.model";
import { PostgresDrizzle } from "@beep/postgres";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { A, N } from "@beep/utils";
import { Message } from "@beep/workspace-domain/entities/Message";
import { Thread } from "@beep/workspace-domain/entities/Thread";
import { Turn } from "@beep/workspace-domain/entities/Turn";
import { DbSchema } from "@beep/workspace-tables";
import { fromMessageRow, toMessageInsert } from "@beep/workspace-tables/entities/Message";
import { fromThreadRow, toThreadInsert } from "@beep/workspace-tables/entities/Thread";
import { fromTurnRow, toTurnInsert } from "@beep/workspace-tables/entities/Turn";
import * as ThreadStoreServer from "@beep/workspace-use-cases/server";
import { and, asc, eq } from "drizzle-orm";
import { Effect, HashMap, Match, Order, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { InMemoryState } from "./ThreadStore.repo.internal.ts";
import type { MessageInsert } from "@beep/workspace-tables/entities/Message";
import type { MessageEntityInput, ThreadEntityInput, TurnEntityInput } from "./ThreadStore.repo.internal.ts";

const THREAD_TABLE_NAME = "workspace_thread" as const;
const TURN_TABLE_NAME = "workspace_turn" as const;
const MESSAGE_TABLE_NAME = "workspace_message" as const;

const encodeWorkspaceId = S.encodeSync(WorkspaceIdentity.WorkspaceId);
const encodeThreadId = S.encodeSync(WorkspaceIdentity.ThreadId);
const encodeTurnId = S.encodeSync(WorkspaceIdentity.TurnId);
const encodeMessageId = S.encodeSync(WorkspaceIdentity.MessageId);
const encodeDocument = S.encodeSync(Document);

const SYSTEM_PRINCIPAL = { component: "Runtime", kind: "System" } as const;
const publicIdFor = (entityType: string, id: PosInt): string =>
  `${entityType.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}_a${id}`;

const nextEntityId = (rows: ReadonlyArray<{ readonly id: number }>): PosInt =>
  PosInt.make(A.reduce(rows, 0, (max, row) => N.max(max, row.id)) + 1);

/**
 * Build the encoded BaseEntity audit prefix shared by every workspace row.
 *
 * Persisted BaseEntity columns are all NOT NULL with no database defaults, so
 * every audit field is supplied here. The conversation-persistence increment
 * does not yet wire a request principal, so a system principal stands in.
 */
const baseEntityRecord = (entityType: string, id: PosInt) => ({
  createdAt: id,
  createdByPrincipal: SYSTEM_PRINCIPAL,
  entityType,
  id,
  orgId: 1,
  publicId: publicIdFor(entityType, id),
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  updatedAt: id,
  updatedByPrincipal: SYSTEM_PRINCIPAL,
});

const makeThreadEntity = (input: ThreadEntityInput): Thread =>
  S.decodeUnknownSync(Thread)({
    ...baseEntityRecord("WorkspaceThread", input.id),
    title: input.title,
    workspaceId: input.workspaceId,
  });

const makeTurnEntity = (input: TurnEntityInput): Turn =>
  S.decodeUnknownSync(Turn)({
    ...baseEntityRecord("WorkspaceTurn", input.id),
    items: [{ itemType: "message", messageId: input.messageId }],
    parentTurnId: input.parentTurnId,
    threadId: input.threadId,
    turnIndex: input.turnIndex,
  });

const makeMessageEntity = (input: MessageEntityInput): Message =>
  S.decodeUnknownSync(Message)({
    ...baseEntityRecord("WorkspaceMessage", input.id),
    content: encodeDocument(input.content),
    role: input.role,
    threadId: input.threadId,
    turnId: input.turnId,
  });

const threadIdToNumber = (id: WorkspaceIdentity.ThreadId): PosInt => PosInt.make(Number(encodeThreadId(id)));

const turnIndexOrder = Order.mapInput(Order.Number, (turn: Turn) => turn.turnIndex);

const emptyState = InMemoryState.make({});

const projectTimeline = (
  threadId: WorkspaceIdentity.ThreadId,
  turns: ReadonlyArray<Turn>,
  messageFor: (id: WorkspaceIdentity.MessageId) => O.Option<Message>
): ThreadStoreServer.Thread.ThreadTimeline => {
  const ordered = A.sort(turns, turnIndexOrder);
  return ThreadStoreServer.Thread.ThreadTimeline.make({
    threadId,
    turns: A.map(ordered, (turn) =>
      ThreadStoreServer.Thread.TimelineTurn.make({
        turnId: turn.id,
        turnIndex: turn.turnIndex,
        parentTurnId: turn.parentTurnId,
        costMicros: 0,
        items: pipe(
          turn.items,
          A.map(
            (item): O.Option<ThreadStoreServer.Thread.TimelineItem> =>
              pipe(
                Match.value(item),
                Match.withReturnType<O.Option<ThreadStoreServer.Thread.TimelineItem>>(),
                Match.discriminatorsExhaustive("itemType")({
                  message: (item) =>
                    pipe(
                      messageFor(item.messageId),
                      O.map((message) =>
                        ThreadStoreServer.Thread.TimelineMessageItem.make({
                          kind: "message",
                          role: message.role,
                          content: message.content,
                        })
                      )
                    ),
                  tool_call: (item) =>
                    O.some(
                      ThreadStoreServer.Thread.TimelineToolCallItem.make({
                        kind: "tool_call",
                        name: item.name,
                      })
                    ),
                  tool_result: O.none<ThreadStoreServer.Thread.TimelineItem>,
                  artifact_ref: O.none<ThreadStoreServer.Thread.TimelineItem>,
                  activity: O.none<ThreadStoreServer.Thread.TimelineItem>,
                })
              )
          ),
          A.getSomes
        ),
      })
    ),
  });
};

/**
 * Build the in-memory ThreadStore used by the fast workspace proof.
 *
 * @example
 * ```ts
 * import { makeInMemoryThreadStore } from "@beep/workspace-server/aggregates/Thread"
 *
 * console.log(makeInMemoryThreadStore)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryThreadStore = Effect.fn("Workspace.ThreadStore.makeInMemory")(function* () {
  const store = yield* Ref.make(emptyState);

  return ThreadStoreServer.Thread.ThreadStore.of({
    createThread: Effect.fn("Workspace.ThreadStore.createThread")(function* (input) {
      const workspaceId = PosInt.make(Number(encodeWorkspaceId(input.workspaceId)));
      const state = yield* Ref.get(store);
      const id = state.nextId;
      const thread = makeThreadEntity({ id, title: input.title, workspaceId });
      yield* Ref.set(store, {
        ...state,
        threads: HashMap.set(state.threads, id, thread),
        nextId: PosInt.make(id + 1),
      });
      return thread;
    }),
    listThreads: Effect.fn("Workspace.ThreadStore.listThreads")(function* (workspaceId) {
      const encoded = PosInt.make(Number(encodeWorkspaceId(workspaceId)));
      const state = yield* Ref.get(store);
      return pipe(
        A.fromIterable(HashMap.values(state.threads)),
        A.filter((thread) => Number(encodeWorkspaceId(thread.workspaceId)) === encoded)
      );
    }),
    setTitleIfEmpty: Effect.fn("Workspace.ThreadStore.setTitleIfEmpty")(function* (input) {
      const threadId = threadIdToNumber(input.threadId);
      const result = yield* Ref.modify(store, (state) => {
        const current = HashMap.get(state.threads, threadId);
        if (O.isNone(current)) {
          return ["missing", state] as const;
        }
        if (current.value.title !== input.emptyTitle) {
          return ["unchanged", state] as const;
        }
        const thread = makeThreadEntity({
          id: threadId,
          title: input.title,
          workspaceId: PosInt.make(Number(encodeWorkspaceId(current.value.workspaceId))),
        });
        return [
          "updated",
          {
            ...state,
            threads: HashMap.set(state.threads, threadId, thread),
          },
        ] as const;
      });
      if (result === "missing") {
        return yield* ThreadStoreServer.Thread.ThreadStoreNotFound.make({ threadId: input.threadId });
      }
    }),
    appendTurn: Effect.fn("Workspace.ThreadStore.appendTurn")(function* (input) {
      const state = yield* Ref.get(store);
      const threadId = threadIdToNumber(input.threadId);
      if (O.isNone(HashMap.get(state.threads, threadId))) {
        return yield* ThreadStoreServer.Thread.ThreadStoreNotFound.make({ threadId: input.threadId });
      }
      const existingTurns = pipe(
        A.fromIterable(HashMap.values(state.turns)),
        A.filter((turn) => threadIdToNumber(turn.threadId) === threadId)
      );
      const turnIndex = NonNegativeInt.make(existingTurns.length);
      const turnId = state.nextId;
      const messageId = PosInt.make(state.nextId + 1);
      const parentTurnId = pipe(
        input.parentTurnId,
        O.map((id) => PosInt.make(Number(encodeTurnId(id)))),
        O.getOrNull
      );
      const message = makeMessageEntity({
        id: messageId,
        threadId,
        turnId,
        role: input.role,
        content: input.content,
      });
      const turn = makeTurnEntity({ id: turnId, threadId, parentTurnId, turnIndex, messageId });
      yield* Ref.set(store, {
        ...state,
        turns: HashMap.set(state.turns, turnId, turn),
        messages: HashMap.set(state.messages, messageId, message),
        nextId: PosInt.make(messageId + 1),
      });
      return { turn, message };
    }),
    timeline: Effect.fn("Workspace.ThreadStore.timeline")(function* (threadId) {
      const numericId = threadIdToNumber(threadId);
      const state = yield* Ref.get(store);
      if (O.isNone(HashMap.get(state.threads, numericId))) {
        return yield* ThreadStoreServer.Thread.ThreadStoreNotFound.make({ threadId });
      }
      const turns = pipe(
        A.fromIterable(HashMap.values(state.turns)),
        A.filter((turn) => threadIdToNumber(turn.threadId) === numericId)
      );
      return projectTimeline(threadId, turns, (messageId) =>
        HashMap.get(state.messages, PosInt.make(Number(encodeMessageId(messageId))))
      );
    }),
  });
});

const repositoryUnavailable =
  (operation: string, table: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ThreadStoreServer.Thread.ThreadStoreUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Workspace ThreadStore adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table, cause })
        )
      ),
      Effect.mapError(() =>
        ThreadStoreServer.Thread.ThreadStoreUnavailable.make({
          reason: `${operation} failed against ${table}`,
        })
      )
    );

const threadTable = DbSchema.thread;
const turnTable = DbSchema.turn;
const messageTable = DbSchema.message;

/**
 * Build a Drizzle-backed ThreadStore used by live persistence tests.
 *
 * @example
 * ```ts
 * import { makeDrizzleThreadStore } from "@beep/workspace-server/aggregates/Thread"
 *
 * console.log(makeDrizzleThreadStore)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleThreadStore = Effect.fn("Workspace.ThreadStore.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return ThreadStoreServer.Thread.ThreadStore.of({
    createThread: Effect.fn("Workspace.ThreadStore.drizzleCreateThread")(function* (input) {
      const workspaceId = PosInt.make(Number(encodeWorkspaceId(input.workspaceId)));
      const existingThreads = yield* db
        .select()
        .from(threadTable)
        .pipe(repositoryUnavailable("list Thread", THREAD_TABLE_NAME));
      const seed = makeThreadEntity({ id: nextEntityId(existingThreads), title: input.title, workspaceId });
      const rows = yield* db
        .insert(threadTable)
        .values(toThreadInsert(seed))
        .returning()
        .pipe(repositoryUnavailable("insert Thread", THREAD_TABLE_NAME));
      return pipe(
        rows,
        A.head,
        O.map(fromThreadRow),
        O.getOrElse(() => seed)
      );
    }),
    listThreads: Effect.fn("Workspace.ThreadStore.drizzleListThreads")(function* (workspaceId) {
      const encoded = PosInt.make(Number(encodeWorkspaceId(workspaceId)));
      const rows = yield* db
        .select()
        .from(threadTable)
        .where(eq(threadTable.workspaceId, encoded))
        .pipe(repositoryUnavailable("list Thread", THREAD_TABLE_NAME));
      return A.map(rows, fromThreadRow);
    }),
    setTitleIfEmpty: Effect.fn("Workspace.ThreadStore.drizzleSetTitleIfEmpty")(function* (input) {
      const threadId = threadIdToNumber(input.threadId);
      const rows = yield* db
        .select()
        .from(threadTable)
        .where(eq(threadTable.id, threadId))
        .limit(1)
        .pipe(repositoryUnavailable("select Thread", THREAD_TABLE_NAME));
      const thread = A.head(rows);
      if (O.isNone(thread)) {
        return yield* ThreadStoreServer.Thread.ThreadStoreNotFound.make({ threadId: input.threadId });
      }
      if (thread.value.title !== input.emptyTitle) {
        return;
      }
      yield* db
        .update(threadTable)
        .set({ title: input.title })
        .where(and(eq(threadTable.id, threadId), eq(threadTable.title, input.emptyTitle)))
        .pipe(repositoryUnavailable("update Thread title", THREAD_TABLE_NAME), Effect.asVoid);
    }),
    appendTurn: Effect.fn("Workspace.ThreadStore.drizzleAppendTurn")(function* (input) {
      const threadId = threadIdToNumber(input.threadId);
      const threadRows = yield* db
        .select()
        .from(threadTable)
        .where(eq(threadTable.id, threadId))
        .limit(1)
        .pipe(repositoryUnavailable("select Thread", THREAD_TABLE_NAME));
      if (A.length(threadRows) === 0) {
        return yield* ThreadStoreServer.Thread.ThreadStoreNotFound.make({ threadId: input.threadId });
      }
      const parentTurnId = pipe(
        input.parentTurnId,
        O.map((id) => PosInt.make(Number(encodeTurnId(id)))),
        O.getOrNull
      );
      return yield* db
        .transaction(
          Effect.fnUntraced(function* (tx) {
            const existingTurns = yield* tx.select().from(turnTable).where(eq(turnTable.threadId, threadId));
            const existingTurnRows = yield* tx.select().from(turnTable);
            const existingMessages = yield* tx.select().from(messageTable);
            const turnIndex = NonNegativeInt.make(existingTurns.length);
            const nextTurnId = nextEntityId(existingTurnRows);
            const nextMessageId = nextEntityId(existingMessages);

            const messageSeed = makeMessageEntity({
              id: nextMessageId,
              threadId,
              turnId: nextTurnId,
              role: input.role,
              content: input.content,
            });
            const turnSeed = makeTurnEntity({
              id: nextTurnId,
              threadId,
              parentTurnId,
              turnIndex,
              messageId: nextMessageId,
            });

            const turnRows = yield* tx.insert(turnTable).values(toTurnInsert(turnSeed)).returning();
            const persistedTurn = pipe(
              turnRows,
              A.head,
              O.map(fromTurnRow),
              O.getOrElse(() => turnSeed)
            );
            const persistedTurnId = PosInt.make(Number(encodeTurnId(persistedTurn.id)));

            const messageInsert: MessageInsert = {
              ...toMessageInsert(messageSeed),
              turnId: persistedTurnId,
            };
            const messageRows = yield* tx.insert(messageTable).values(messageInsert).returning();
            const persistedMessage = pipe(
              messageRows,
              A.head,
              O.map(fromMessageRow),
              O.getOrElse(() => messageSeed)
            );
            const persistedMessageId = PosInt.make(Number(encodeMessageId(persistedMessage.id)));

            const reconciledTurn = makeTurnEntity({
              id: PosInt.make(Number(encodeTurnId(persistedTurn.id))),
              threadId,
              parentTurnId,
              turnIndex,
              messageId: persistedMessageId,
            });
            const reconciledRows = yield* tx
              .update(turnTable)
              .set({ items: toTurnInsert(reconciledTurn).items })
              .where(eq(turnTable.id, persistedTurnId))
              .returning();
            const finalTurn = pipe(
              reconciledRows,
              A.head,
              O.map(fromTurnRow),
              O.getOrElse(() => reconciledTurn)
            );

            return { turn: finalTurn, message: persistedMessage };
          })
        )
        .pipe(repositoryUnavailable("append Turn", TURN_TABLE_NAME));
    }),
    timeline: Effect.fn("Workspace.ThreadStore.drizzleTimeline")(function* (threadId) {
      const numericId = threadIdToNumber(threadId);
      const threadRows = yield* db
        .select()
        .from(threadTable)
        .where(eq(threadTable.id, numericId))
        .limit(1)
        .pipe(repositoryUnavailable("select Thread", THREAD_TABLE_NAME));
      if (A.length(threadRows) === 0) {
        return yield* ThreadStoreServer.Thread.ThreadStoreNotFound.make({ threadId });
      }
      const turnRows = yield* db
        .select()
        .from(turnTable)
        .where(eq(turnTable.threadId, numericId))
        .orderBy(asc(turnTable.turnIndex))
        .pipe(repositoryUnavailable("list Turn", TURN_TABLE_NAME));
      const messageRows = yield* db
        .select()
        .from(messageTable)
        .where(eq(messageTable.threadId, numericId))
        .pipe(repositoryUnavailable("list Message", MESSAGE_TABLE_NAME));

      const turns = A.map(turnRows, fromTurnRow);
      const messages = A.map(messageRows, fromMessageRow);
      const messageById = HashMap.fromIterable(
        A.map(messages, (message) => [Number(encodeMessageId(message.id)), message] as const)
      );
      return projectTimeline(threadId, turns, (messageId) =>
        HashMap.get(messageById, Number(encodeMessageId(messageId)))
      );
    }),
  });
});

/**
 * Build the default ThreadStore for normal slice tests.
 *
 * @example
 * ```ts
 * import { makeThreadStore } from "@beep/workspace-server/aggregates/Thread"
 *
 * console.log(makeThreadStore)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeThreadStore = makeInMemoryThreadStore;

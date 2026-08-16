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
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
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
import { Clock, DateTime, Effect, HashMap, Match, Order, pipe, Ref, Semaphore } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { InMemoryState } from "./ThreadStore.repo.internal.ts";
import type { CuidState } from "@beep/schema/Cuid";
import type { MessageInsert } from "@beep/workspace-tables/entities/Message";
import type * as Crypto from "effect/Crypto";
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

const nextEntityId = (rows: ReadonlyArray<{ readonly id: number }>): PosInt =>
  PosInt.make(A.reduce(rows, 0, (max, row) => N.max(max, row.id)) + 1);

/**
 * Build the encoded ProductEntity audit prefix shared by every workspace row.
 *
 * Persisted ProductEntity columns are all NOT NULL with no database defaults, so
 * every audit field is supplied here. The conversation-persistence increment
 * does not yet wire a request principal, so a system principal stands in.
 */
/**
 * Audit timestamps in epoch milliseconds.
 *
 * These used to be filled with the row's *entity id* — so thread 1 was stamped
 * `1970-01-01T00:00:00.001Z` and the sidebar rendered every conversation as
 * "Dec 31" (1969, in any negative UTC offset). Callers read a real clock and
 * pass it in; an update carries the row's original `createdAt` forward rather
 * than restamping it.
 */
type EntityTimestamps = {
  readonly createdAt: number;
  readonly updatedAt: number;
};

const timestampsAt = (now: number): EntityTimestamps => ({ createdAt: now, updatedAt: now });

const baseEntityRecord = (entityType: string, id: PosInt, publicId: string, timestamps: EntityTimestamps) => ({
  createdAt: timestamps.createdAt,
  createdByPrincipal: SYSTEM_PRINCIPAL,
  entityType,
  id,
  orgId: 1,
  publicId,
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  updatedAt: timestamps.updatedAt,
  updatedByPrincipal: SYSTEM_PRINCIPAL,
});

const makeThreadEntity = (
  input: ThreadEntityInput,
  publicId: PublicEntityId.PublicEntityIdFor<typeof WorkspaceIdentity.ThreadId>,
  timestamps: EntityTimestamps
): Thread =>
  S.decodeUnknownSync(Thread)({
    ...baseEntityRecord("WorkspaceThread", input.id, publicId, timestamps),
    title: input.title,
    workspaceId: input.workspaceId,
  });

const makeTurnEntity = (
  input: TurnEntityInput,
  publicId: PublicEntityId.PublicEntityIdFor<typeof WorkspaceIdentity.TurnId>,
  timestamps: EntityTimestamps
): Turn =>
  S.decodeUnknownSync(Turn)({
    ...baseEntityRecord("WorkspaceTurn", input.id, publicId, timestamps),
    items: [{ itemType: "message", messageId: input.messageId }],
    parentTurnId: input.parentTurnId,
    threadId: input.threadId,
    turnIndex: input.turnIndex,
  });

const makeMessageEntity = (
  input: MessageEntityInput,
  publicId: PublicEntityId.PublicEntityIdFor<typeof WorkspaceIdentity.MessageId>,
  timestamps: EntityTimestamps
): Message =>
  S.decodeUnknownSync(Message)({
    ...baseEntityRecord("WorkspaceMessage", input.id, publicId, timestamps),
    content: encodeDocument(input.content),
    role: input.role,
    threadId: input.threadId,
    turnId: input.turnId,
  });

const threadIdToNumber = (id: WorkspaceIdentity.ThreadId): PosInt => PosInt.make(Number(encodeThreadId(id)));

const turnIndexOrder = Order.mapInput(Order.Number, (turn: Turn) => turn.turnIndex);

const emptyState = InMemoryState.make({});

const publicIdUnavailable =
  (entityType: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ThreadStoreServer.Thread.ThreadStoreUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Workspace ThreadStore adapter failed to generate a public id").pipe(
          Effect.annotateLogs({ entityType, cause })
        )
      ),
      Effect.mapError(() =>
        ThreadStoreServer.Thread.ThreadStoreUnavailable.make({
          reason: `generate ${entityType} public id failed`,
        })
      )
    );

const makePublicIdGenerators = Effect.fn("Workspace.ThreadStore.makePublicIdGenerators")(function* () {
  const context = yield* Effect.context<CuidState | Crypto.Crypto>();

  return {
    message: PublicEntityId.generate(WorkspaceIdentity.MessageId).pipe(
      Effect.provide(context),
      publicIdUnavailable("Message")
    ),
    thread: PublicEntityId.generate(WorkspaceIdentity.ThreadId).pipe(
      Effect.provide(context),
      publicIdUnavailable("Thread")
    ),
    turn: PublicEntityId.generate(WorkspaceIdentity.TurnId).pipe(Effect.provide(context), publicIdUnavailable("Turn")),
  };
});

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
 * **Example** (Create thread in memory)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { CuidState } from "@beep/schema/Cuid"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { makeInMemoryThreadStore } from "@beep/workspace-server/aggregates/Thread"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* makeInMemoryThreadStore()
 *   const thread = yield* store.createThread({
 *     title: "Matter intake",
 *     workspaceId: Workspace.WorkspaceId.make(1)
 *   })
 *   return thread.publicId.startsWith("workspace_thread_")
 * }).pipe(
 *   Effect.provide(CuidState.Default),
 *   Effect.provide(BunCrypto.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @effects Acquires CUID state and platform crypto, allocates mutable in-memory
 * state, and returns operations that generate non-enumerable public IDs before
 * atomically updating that state.
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryThreadStore = Effect.fn("Workspace.ThreadStore.makeInMemory")(function* () {
  const publicIds = yield* makePublicIdGenerators();
  const store = yield* Ref.make(emptyState);

  return ThreadStoreServer.Thread.ThreadStore.of({
    createThread: Effect.fn("Workspace.ThreadStore.createThread")(function* (input) {
      const workspaceId = PosInt.make(Number(encodeWorkspaceId(input.workspaceId)));
      const publicId = yield* publicIds.thread;
      const now = yield* Clock.currentTimeMillis;
      return yield* Ref.modify(store, (state) => {
        const id = state.nextId;
        const thread = makeThreadEntity({ id, title: input.title, workspaceId }, publicId, timestampsAt(now));
        return [
          thread,
          {
            ...state,
            threads: HashMap.set(state.threads, id, thread),
            nextId: PosInt.make(id + 1),
          },
        ];
      });
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
      const now = yield* Clock.currentTimeMillis;
      const result = yield* Ref.modify(store, (state) => {
        const current = HashMap.get(state.threads, threadId);
        if (O.isNone(current)) {
          return ["missing", state] as const;
        }
        if (current.value.title !== input.emptyTitle) {
          return ["unchanged", state] as const;
        }
        const thread = makeThreadEntity(
          {
            id: threadId,
            title: input.title,
            workspaceId: PosInt.make(Number(encodeWorkspaceId(current.value.workspaceId))),
          },
          current.value.publicId,
          // Renaming a thread must not restamp when it was created.
          { createdAt: DateTime.toEpochMillis(current.value.createdAt), updatedAt: now }
        );
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
      const parentTurnId = pipe(
        input.parentTurnId,
        O.map((id) => PosInt.make(Number(encodeTurnId(id)))),
        O.getOrNull
      );
      const messagePublicId = yield* publicIds.message;
      const turnPublicId = yield* publicIds.turn;
      const now = yield* Clock.currentTimeMillis;
      return yield* Ref.modify(store, (current) => {
        const existingTurns = pipe(
          A.fromIterable(HashMap.values(current.turns)),
          A.filter((turn) => threadIdToNumber(turn.threadId) === threadId)
        );
        const turnIndex = NonNegativeInt.make(existingTurns.length);
        const turnId = current.nextId;
        const messageId = PosInt.make(current.nextId + 1);
        const message = makeMessageEntity(
          {
            id: messageId,
            threadId,
            turnId,
            role: input.role,
            content: input.content,
          },
          messagePublicId,
          timestampsAt(now)
        );
        const turn = makeTurnEntity(
          { id: turnId, threadId, parentTurnId, turnIndex, messageId },
          turnPublicId,
          timestampsAt(now)
        );
        return [
          { turn, message },
          {
            ...current,
            turns: HashMap.set(current.turns, turnId, turn),
            messages: HashMap.set(current.messages, messageId, message),
            nextId: PosInt.make(messageId + 1),
          },
        ];
      });
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
 * **Example** (Build Drizzle ThreadStore effect)
 *
 * ```ts
 * import { makeDrizzleThreadStore } from "@beep/workspace-server/aggregates/Thread"
 * import { Effect } from "effect"
 *
 * const program = makeDrizzleThreadStore().pipe(
 *   Effect.map((store) => typeof store.createThread === "function")
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Acquires the Postgres Drizzle repository, CUID state, and platform
 * crypto. Returned operations generate public IDs and query or mutate the
 * workspace thread, turn, and message tables; driver and ID-generation
 * failures are translated to `ThreadStoreUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleThreadStore = Effect.fn("Workspace.ThreadStore.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;
  const publicIds = yield* makePublicIdGenerators();

  // Row ids are allocated as `max(existing) + 1`, read inside the write. Two
  // writes in flight — two windows on the same thread, a retried request —
  // therefore read the same maximum and claim the same id, and one of them loses
  // (the send simply never appeared, with nothing to explain why). Serializing
  // the writes makes the read-then-allocate atomic; the sidecar is the only
  // writer, so this is the whole race.
  const writeSemaphore = Semaphore.makeUnsafe(1);

  return ThreadStoreServer.Thread.ThreadStore.of({
    createThread: Effect.fn("Workspace.ThreadStore.drizzleCreateThread")(function* (input) {
      return yield* writeSemaphore.withPermit(
        Effect.gen(function* () {
          const workspaceId = PosInt.make(Number(encodeWorkspaceId(input.workspaceId)));
          const existingThreads = yield* db
            .select()
            .from(threadTable)
            .pipe(repositoryUnavailable("list Thread", THREAD_TABLE_NAME));
          const publicId = yield* publicIds.thread;
          const now = yield* Clock.currentTimeMillis;
          const seed = makeThreadEntity(
            { id: nextEntityId(existingThreads), title: input.title, workspaceId },
            publicId,
            timestampsAt(now)
          );
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
        })
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
      const messagePublicId = yield* publicIds.message;
      const turnPublicId = yield* publicIds.turn;
      const now = yield* Clock.currentTimeMillis;
      return yield* writeSemaphore.withPermit(
        db
          .transaction(
            Effect.fnUntraced(function* (tx) {
              const existingTurns = yield* tx.select().from(turnTable).where(eq(turnTable.threadId, threadId));
              const existingTurnRows = yield* tx.select().from(turnTable);
              const existingMessages = yield* tx.select().from(messageTable);
              const turnIndex = NonNegativeInt.make(existingTurns.length);
              const nextTurnId = nextEntityId(existingTurnRows);
              const nextMessageId = nextEntityId(existingMessages);

              const messageSeed = makeMessageEntity(
                {
                  id: nextMessageId,
                  threadId,
                  turnId: nextTurnId,
                  role: input.role,
                  content: input.content,
                },
                messagePublicId,
                timestampsAt(now)
              );
              const turnSeed = makeTurnEntity(
                {
                  id: nextTurnId,
                  threadId,
                  parentTurnId,
                  turnIndex,
                  messageId: nextMessageId,
                },
                turnPublicId,
                timestampsAt(now)
              );

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

              const reconciledTurn = makeTurnEntity(
                {
                  id: PosInt.make(Number(encodeTurnId(persistedTurn.id))),
                  threadId,
                  parentTurnId,
                  turnIndex,
                  messageId: persistedMessageId,
                },
                persistedTurn.publicId,
                // The row already exists; keep its creation stamp and only advance
                // the update stamp.
                { createdAt: DateTime.toEpochMillis(persistedTurn.createdAt), updatedAt: now }
              );
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
          .pipe(repositoryUnavailable("append Turn", TURN_TABLE_NAME))
      );
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
 * **Example** (Build default ThreadStore)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { CuidState } from "@beep/schema/Cuid"
 * import { makeThreadStore } from "@beep/workspace-server/aggregates/Thread"
 * import { Effect } from "effect"
 *
 * const program = makeThreadStore().pipe(
 *   Effect.map((store) => typeof store.timeline === "function"),
 *   Effect.provide(CuidState.Default),
 *   Effect.provide(BunCrypto.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @effects Uses the same CUID-backed mutable in-memory state as
 * {@link makeInMemoryThreadStore}, requiring CUID state and platform crypto.
 * @category repositories
 * @since 0.0.0
 */
export const makeThreadStore = makeInMemoryThreadStore;

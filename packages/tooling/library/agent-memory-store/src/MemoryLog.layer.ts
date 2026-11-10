/**
 * Live memory log: `effect/eventlog` over `SqlEventJournal` with the per-node
 * compare-and-set checked inside the journal's writer transaction.
 *
 * **Details**
 *
 * Decision `memory-log-on-effect-eventlog`: {@link MemoryLogLayer} provides
 * {@link MemoryLog} from `EventLog` over `SqlEventJournal`, with no compaction
 * registered and no remote. Decision
 * `memory-log-checks-parents-in-the-journal-transaction`: the event handlers
 * run inside the journal's writer transaction (`SqlEventJournal.writeMany`
 * calls them inside `sql.withTransaction`, before it inserts the batch), and
 * in that same transaction they maintain four store tables:
 *
 * - `agent_memory_heads`: the head revisions of every node;
 * - `agent_memory_nodes`: the file of every node, so a `NodeCreated` whose
 *   predecessor is unknown or in another file is refused with
 *   `UnplacedNodeError`;
 * - `agent_memory_holds`: every held write and whether it is still open
 *   (decision `held-writes-are-log-events`);
 * - `agent_memory_order`: the commit-order number of every entry, which is the
 *   `LogCursor` (decision `file-is-an-ordered-node-partition` orders siblings
 *   by journal entry order; the cursor counts commits, not entry ids).
 *
 * Because the journal rows and the store rows commit in one SQLite
 * transaction, reopening a database file finds them consistent; nothing is
 * rebuilt on open.
 *
 * **Gotchas**
 *
 * {@link makeMemoryLogSqliteLayer} loads `@beep/sqlite`, which imports `bun:sqlite`, with a
 * dynamic import, so this module still loads under Node; building the layer
 * under Node fails with a `MemoryLogError` whose operation is `"loadDriver"`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as EventJournal from "effect/eventlog/EventJournal";
import * as EventLog from "effect/eventlog/EventLog";
import * as EventLogEncryption from "effect/eventlog/EventLogEncryption";
import * as SqlEventJournal from "effect/eventlog/SqlEventJournal";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlError from "effect/sql/SqlError";
import { HoldNotOpenError, MemoryLogError, StaleParentsError, UnplacedNodeError } from "./AgentMemoryStore.errors.ts";
import { MemoryLog } from "./MemoryLog.service.ts";
import {
  MemoryEvents,
  MemoryLogSchema,
  NodeCreatedEvent,
  NodeRetiredEvent,
  NodeRevisedEvent,
  NodeStatusChangedEvent,
} from "./NodeEvent.events.ts";
import { LogCursor, MemoryFilePath, RevisionId } from "./NodeIdentity.models.ts";
import type { SqliteClientConfig } from "@beep/sqlite";
import type * as Arr from "effect/Array";
import type { Entry } from "effect/eventlog/EventJournal";
import type { HoldId } from "./Admission.models.ts";
import type { MemoryEvent } from "./NodeEvent.events.ts";
import type { NodeId } from "./NodeIdentity.models.ts";

/**
 * Journal table names the memory log passes to `SqlEventJournal`, so the log
 * can share one SQLite file with other store tables.
 *
 * **Example** (Read the journal entry table name)
 *
 * ```ts
 * import { MemoryLogJournalTables } from "@beep/agent-memory-store"
 *
 * console.log(MemoryLogJournalTables.entryTable) // "agent_memory_journal"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const MemoryLogJournalTables = {
  entryTable: "agent_memory_journal",
  remotesTable: "agent_memory_remotes",
} as const;

const nodeEventTags = A.make(
  NodeCreatedEvent.tag,
  NodeRevisedEvent.tag,
  NodeStatusChangedEvent.tag,
  NodeRetiredEvent.tag
);

const HeadRows = S.Array(S.Struct({ revision_id: RevisionId }));
const HoldRows = S.Array(S.Struct({ open: S.Literals([0, 1]) }));
const OrderRows = S.Array(S.Struct({ entry_id: EventJournal.EntryId }));
const CursorRows = S.Array(S.Struct({ cursor: LogCursor }));
const NodeFileRows = S.Array(S.Struct({ file_path: MemoryFilePath }));

const decodeHeadRows = S.decodeUnknownEffect(HeadRows);
const decodeHoldRows = S.decodeUnknownEffect(HoldRows);
const decodeOrderRows = S.decodeUnknownEffect(OrderRows);
const decodeCursorRows = S.decodeUnknownEffect(CursorRows);
const decodeNodeFileRows = S.decodeUnknownEffect(NodeFileRows);

const createTables = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE IF NOT EXISTS agent_memory_heads (
      node_id TEXT NOT NULL,
      revision_id TEXT NOT NULL,
      PRIMARY KEY (node_id, revision_id)
    )`;
  yield* sql`
    CREATE TABLE IF NOT EXISTS agent_memory_nodes (
      node_id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL
    )`;
  yield* sql`
    CREATE TABLE IF NOT EXISTS agent_memory_holds (
      hold_id TEXT PRIMARY KEY,
      open INTEGER NOT NULL
    )`;
  yield* sql`
    CREATE TABLE IF NOT EXISTS agent_memory_order (
      sequence INTEGER PRIMARY KEY,
      entry_id BLOB NOT NULL UNIQUE,
      event TEXT NOT NULL,
      primary_key TEXT NOT NULL
    )`;
  yield* sql`
    CREATE INDEX IF NOT EXISTS agent_memory_order_key_idx
    ON agent_memory_order (primary_key, sequence)`;
});

const readHeads = Effect.fnUntraced(function* (nodeId: NodeId) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    SELECT revision_id FROM agent_memory_heads WHERE node_id = ${nodeId} ORDER BY revision_id`.pipe(
    Effect.flatMap(decodeHeadRows)
  );
  return A.map(rows, (row) => row.revision_id);
});

const writeHead = Effect.fnUntraced(function* (nodeId: NodeId, revisionId: RevisionId) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DELETE FROM agent_memory_heads WHERE node_id = ${nodeId}`;
  yield* sql`INSERT INTO agent_memory_heads ${sql.insert({ node_id: nodeId, revision_id: revisionId })}`;
});

// Numbers the entry after every entry this replica committed before it; the
// handlers run in input order, so a batch is numbered in batch order.
const recordOrder = Effect.fnUntraced(function* (entry: Entry) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    INSERT INTO agent_memory_order (sequence, entry_id, event, primary_key)
    SELECT COALESCE(MAX(sequence), 0) + 1, ${entry.id}, ${entry.event}, ${entry.primaryKey}
    FROM agent_memory_order`;
});

const sameRevisions = (left: ReadonlyArray<RevisionId>, right: ReadonlyArray<RevisionId>): boolean =>
  Equal.equals(HashSet.fromIterable(left), HashSet.fromIterable(right));

const fileOfNode = Effect.fnUntraced(function* (nodeId: NodeId) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`SELECT file_path FROM agent_memory_nodes WHERE node_id = ${nodeId}`.pipe(
    Effect.flatMap(decodeNodeFileRows)
  );
  return O.map(A.head(rows), (row) => row.file_path);
});

// A created node is placed after a predecessor of its own file, or opens the
// file; earlier events of the same batch are already in the nodes table.
const checkPlacement = Effect.fnUntraced(function* (payload: {
  readonly nodeId: NodeId;
  readonly filePath: MemoryFilePath;
  readonly after: O.Option<NodeId>;
}) {
  if (O.isNone(payload.after)) {
    return;
  }
  const after = payload.after.value;
  const afterFilePath = yield* fileOfNode(after);
  if (!O.contains(afterFilePath, payload.filePath)) {
    return yield* UnplacedNodeError.make({ nodeId: payload.nodeId, filePath: payload.filePath, after, afterFilePath });
  }
});

const createNode = Effect.fnUntraced(function* (
  payload: {
    readonly nodeId: NodeId;
    readonly revisionId: RevisionId;
    readonly filePath: MemoryFilePath;
    readonly after: O.Option<NodeId>;
  },
  entry: Entry
) {
  const heads = yield* readHeads(payload.nodeId);
  if (A.isReadonlyArrayNonEmpty(heads)) {
    return yield* StaleParentsError.make({ nodeId: payload.nodeId, parents: [], heads });
  }
  yield* checkPlacement(payload);
  const sql = yield* SqlClient.SqlClient;
  yield* sql`INSERT INTO agent_memory_nodes ${sql.insert({ node_id: payload.nodeId, file_path: payload.filePath })}`;
  yield* writeHead(payload.nodeId, payload.revisionId);
  yield* recordOrder(entry);
});

const reviseNode = Effect.fnUntraced(function* (
  payload: {
    readonly nodeId: NodeId;
    readonly revisionId: RevisionId;
    readonly parents: Arr.NonEmptyReadonlyArray<RevisionId>;
  },
  entry: Entry
) {
  const heads = yield* readHeads(payload.nodeId);
  if (!A.isReadonlyArrayNonEmpty(heads) || !sameRevisions(payload.parents, heads)) {
    return yield* StaleParentsError.make({ nodeId: payload.nodeId, parents: payload.parents, heads });
  }
  yield* writeHead(payload.nodeId, payload.revisionId);
  yield* recordOrder(entry);
});

const openHold = Effect.fnUntraced(function* (holdId: HoldId, entry: Entry) {
  const sql = yield* SqlClient.SqlClient;
  // A HoldId names one hold; a repeated WriteHeld never reopens a settled one.
  yield* sql`INSERT INTO agent_memory_holds ${sql.insert({ hold_id: holdId, open: 1 })} ON CONFLICT DO NOTHING`;
  yield* recordOrder(entry);
});

const resolveHold = Effect.fnUntraced(function* (holdId: HoldId, entry: Entry) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`SELECT open FROM agent_memory_holds WHERE hold_id = ${holdId}`.pipe(
    Effect.flatMap(decodeHoldRows)
  );
  const isOpen = pipe(
    A.head(rows),
    O.exists((row) => row.open === 1)
  );
  if (!isOpen) {
    return yield* HoldNotOpenError.make({ holdId });
  }
  yield* sql`UPDATE agent_memory_holds SET open = 0 WHERE hold_id = ${holdId}`;
  yield* recordOrder(entry);
});

const isStoreFailure = (error: unknown): error is SqlError.SqlError | S.SchemaError =>
  SqlError.isSqlError(error) || S.isSchemaError(error);

// Store-table failures inside a handler abort the journal transaction; they
// surface as defects and `appendMany` turns them back into `MemoryLogError`.
const handlers = EventLog.group(MemoryEvents, (group) =>
  group
    .handle("NodeCreated", ({ payload, entry }) =>
      Effect.catchIf(createNode(payload, entry), isStoreFailure, Effect.die)
    )
    .handle("NodeRevised", ({ payload, entry }) =>
      Effect.catchIf(reviseNode(payload, entry), isStoreFailure, Effect.die)
    )
    .handle("NodeStatusChanged", ({ payload, entry }) =>
      Effect.catchIf(reviseNode(payload, entry), isStoreFailure, Effect.die)
    )
    .handle("NodeRetired", ({ payload, entry }) =>
      Effect.catchIf(reviseNode(payload, entry), isStoreFailure, Effect.die)
    )
    .handle("FolderImported", ({ entry }) => Effect.catchIf(recordOrder(entry), isStoreFailure, Effect.die))
    .handle("FileImported", ({ entry }) => Effect.catchIf(recordOrder(entry), isStoreFailure, Effect.die))
    .handle("WriteHeld", ({ payload, entry }) =>
      Effect.catchIf(openHold(payload.holdId, entry), isStoreFailure, Effect.die)
    )
    .handle("HoldResolved", ({ payload, entry }) =>
      Effect.catchIf(resolveHold(payload.holdId, entry), isStoreFailure, Effect.die)
    )
);

const toWriteItem = (event: MemoryEvent) =>
  Match.valueTags(event, {
    NodeCreated: ({ payload }) => ({ event: "NodeCreated", payload }) as const,
    NodeRevised: ({ payload }) => ({ event: "NodeRevised", payload }) as const,
    NodeStatusChanged: ({ payload }) => ({ event: "NodeStatusChanged", payload }) as const,
    NodeRetired: ({ payload }) => ({ event: "NodeRetired", payload }) as const,
    FolderImported: ({ payload }) => ({ event: "FolderImported", payload }) as const,
    FileImported: ({ payload }) => ({ event: "FileImported", payload }) as const,
    WriteHeld: ({ payload }) => ({ event: "WriteHeld", payload }) as const,
    HoldResolved: ({ payload }) => ({ event: "HoldResolved", payload }) as const,
  });

const make = Effect.gen(function* () {
  yield* createTables().pipe(Effect.mapError((cause) => MemoryLogError.fromUnknown("openTables", cause)));
  const sql = yield* SqlClient.SqlClient;
  const log = yield* EventLog.EventLog;
  const journal = yield* EventJournal.EventJournal;

  const readFailure =
    (operation: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, MemoryLogError, R> =>
      Effect.mapError(effect, (cause) => MemoryLogError.fromUnknown(operation, cause));

  const appendMany = (events: Arr.NonEmptyReadonlyArray<MemoryEvent>) =>
    log.writeMany({ schema: MemoryLogSchema, events: A.map(events, toWriteItem) }).pipe(
      Effect.asVoid,
      Effect.catchTag("EventJournalError", (cause) => Effect.fail(MemoryLogError.fromUnknown("append", cause))),
      Effect.catchDefect((defect) =>
        isStoreFailure(defect) ? Effect.fail(MemoryLogError.fromUnknown("append", defect)) : Effect.die(defect)
      )
    );

  const entriesOf = (operation: string, ids: ReadonlyArray<EventJournal.EntryId>) =>
    journal.entriesById(ids).pipe(
      Effect.flatMap((entries) => {
        const found = A.filter(entries, P.isNotUndefined);
        return found.length === entries.length
          ? Effect.succeed(found)
          : Effect.fail(MemoryLogError.fromUnknown(operation, "an ordered entry is missing from the journal"));
      }),
      readFailure(operation)
    );

  const entriesAfter = (cursor: LogCursor) =>
    sql`SELECT entry_id FROM agent_memory_order WHERE sequence > ${cursor} ORDER BY sequence`.pipe(
      Effect.flatMap(decodeOrderRows),
      readFailure("entriesAfter"),
      Effect.flatMap((rows) =>
        entriesOf(
          "entriesAfter",
          A.map(rows, (row) => row.entry_id)
        )
      )
    );

  const history = (nodeId: NodeId) =>
    sql`
      SELECT entry_id FROM agent_memory_order
      WHERE primary_key = ${nodeId} AND ${sql.in("event", nodeEventTags)}
      ORDER BY sequence`.pipe(
      Effect.flatMap(decodeOrderRows),
      readFailure("history"),
      Effect.flatMap((rows) =>
        entriesOf(
          "history",
          A.map(rows, (row) => row.entry_id)
        )
      )
    );

  return MemoryLog.of({
    append: Effect.fn("MemoryLog.append")((event: MemoryEvent) => appendMany(A.of(event))),
    appendMany,
    heads: Effect.fn("MemoryLog.heads")((nodeId: NodeId) =>
      readHeads(nodeId).pipe(Effect.provideService(SqlClient.SqlClient, sql), readFailure("heads"))
    ),
    cursor: sql`SELECT COALESCE(MAX(sequence), 0) AS cursor FROM agent_memory_order`.pipe(
      Effect.flatMap(decodeCursorRows),
      Effect.map((rows) =>
        pipe(A.head(rows), O.match({ onNone: () => LogCursor.make(0), onSome: (row) => row.cursor }))
      ),
      readFailure("cursor")
    ),
    entriesAfter,
    history,
  });
});

const identity = Layer.effect(EventLog.Identity, EventLog.makeIdentity).pipe(
  Layer.provide(EventLogEncryption.layerSubtle)
);

const journal = Layer.effect(
  EventJournal.EventJournal,
  SqlEventJournal.make(MemoryLogJournalTables).pipe(
    Effect.mapError((cause) => MemoryLogError.fromUnknown("openJournal", cause))
  )
);

const runtime = handlers.pipe(
  Layer.provideMerge(EventLog.layerEventLog),
  Layer.provide(identity),
  Layer.provideMerge(journal)
);

/**
 * Live {@link MemoryLog} over a caller-supplied `SqlClient`.
 *
 * **Details**
 *
 * Creates the store tables, then builds `SqlEventJournal` (tables
 * {@link MemoryLogJournalTables}), the `EventLog` runtime and the
 * `MemoryEvents` handlers, all on the one `SqlClient`. No compaction and no
 * remote are registered. Provide a writable SQLite client, such as `makeLayer`
 * from `@beep/sqlite`, to share the database with other store tables;
 * {@link makeMemoryLogSqliteLayer} opens one for you.
 *
 * **Example** (Compose the memory log with a SQL client layer)
 *
 * ```ts
 * import { MemoryLogLayer } from "@beep/agent-memory-store"
 * import * as Layer from "effect/Layer"
 * import type * as SqlClient from "effect/sql/SqlClient"
 *
 * const withClient = (client: Layer.Layer<SqlClient.SqlClient>) => MemoryLogLayer.pipe(Layer.provide(client))
 * console.log(withClient)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MemoryLogLayer: Layer.Layer<MemoryLog, MemoryLogError, SqlClient.SqlClient> = Layer.effect(
  MemoryLog,
  make
).pipe(Layer.provide(runtime));

/**
 * Bun SQLite `SqlClient` opened through `@beep/sqlite`, for the store layers
 * that share one database.
 *
 * **Details**
 *
 * `filename` names the database file; `":memory:"` opens a private in-memory
 * database. Provide one client to {@link MemoryLogLayer} and every other store
 * layer so they share the file and its transactions.
 *
 * **Gotchas**
 *
 * `@beep/sqlite` is loaded with a dynamic import when the layer is built, so
 * importing this module never loads `bun:sqlite`; building the layer outside
 * Bun fails with a `MemoryLogError` whose operation is `"loadDriver"`.
 *
 * **Example** (Open a SQL client for the store)
 *
 * ```ts
 * import { makeMemorySqlClientLayer } from "@beep/agent-memory-store"
 *
 * const client = makeMemorySqlClientLayer({ filename: ":memory:" })
 * console.log(client)
 * ```
 *
 * @param config - Bun SQLite client options; `filename` names the database.
 * @returns A layer providing the SQL client.
 * @category layers
 * @since 0.0.0
 */
export const makeMemorySqlClientLayer = (
  config: SqliteClientConfig
): Layer.Layer<SqlClient.SqlClient, MemoryLogError> =>
  Layer.unwrap(
    Effect.tryPromise({
      try: () => import("@beep/sqlite"),
      catch: (cause) => MemoryLogError.fromUnknown("loadDriver", cause),
    }).pipe(
      Effect.map((driver) =>
        Layer.effect(
          SqlClient.SqlClient,
          driver.make(config).pipe(Effect.mapError((cause) => MemoryLogError.fromUnknown("connect", cause)))
        ).pipe(Layer.provide(Reactivity.layer))
      )
    )
  );

/**
 * Live {@link MemoryLog} over a Bun SQLite database opened through
 * `@beep/sqlite`.
 *
 * **Details**
 *
 * `filename` names the database file; `":memory:"` opens a private in-memory
 * database. Two layers over one file are two connections: their appends
 * serialize on SQLite's write lock (`BEGIN IMMEDIATE` with a busy timeout),
 * and the compare-and-set lets exactly one of two appends naming the same
 * heads land.
 *
 * **Gotchas**
 *
 * The client comes from {@link makeMemorySqlClientLayer}, so building the
 * layer outside Bun fails with a `MemoryLogError` whose operation is
 * `"loadDriver"`.
 *
 * **Example** (Open the memory log on a database file)
 *
 * ```ts
 * import { makeMemoryLogSqliteLayer } from "@beep/agent-memory-store"
 *
 * const live = makeMemoryLogSqliteLayer({ filename: "./.beep/memory.db" })
 * console.log(live)
 * ```
 *
 * @param config - Bun SQLite client options; `filename` names the database.
 * @returns A layer providing the memory log with no remaining requirements.
 * @category layers
 * @since 0.0.0
 */
export const makeMemoryLogSqliteLayer = (config: SqliteClientConfig): Layer.Layer<MemoryLog, MemoryLogError> =>
  MemoryLogLayer.pipe(Layer.provide(makeMemorySqlClientLayer(config)));

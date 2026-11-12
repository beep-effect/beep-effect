/**
 * Memory log contract: the append-only node event log that is the store's
 * sole authority.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as A from "effect/Array";
import type * as Effect from "effect/Effect";
import type { Entry } from "effect/eventlog/EventJournal";
import type {
  FolderAlreadyImportedError,
  HoldNotOpenError,
  MemoryLogError,
  StaleParentsError,
  UnplacedNodeError,
} from "./AgentMemoryStore.errors.ts";
import type { MemoryEvent } from "./NodeEvent.events.ts";
import type { LogCursor, NodeId, RevisionId } from "./NodeIdentity.models.ts";

const $I = $AgentMemoryStoreId.create("MemoryLog.service");

/**
 * Committed journal entry of the memory log, re-exported from
 * `effect/eventlog/EventJournal`.
 *
 * @category re-exports
 * @since 0.0.0
 */
export type { Entry } from "effect/eventlog/EventJournal";

/**
 * Typed facade over `effect/eventlog/EventLog` for the memory events.
 *
 * **Details**
 *
 * Ruling 1: the log is the sole authority; indexes and Markdown files are
 * projections of it. P1 provides this service with `EventLog.layerEventLog`
 * plus `SqlEventJournal.layer` over `@beep/sqlite`.
 *
 * - `append` writes one event; `appendMany` writes several in one journal
 *   transaction, committing all or none.
 * - Both enforce the per-node compare-and-set (decision
 *   `memory-log-checks-parents-in-the-journal-transaction`): a
 *   revision-producing event lands only when its `parents` are exactly the
 *   node's current heads, and a `NodeCreated` only when the node has none.
 *   The check runs in the event handler inside the journal's writer
 *   transaction, against a heads table the handlers maintain in that same
 *   transaction, so two processes cannot both pass it and a later event of a
 *   batch sees the earlier ones. A stale event fails with `StaleParentsError`
 *   and the whole batch is rolled back.
 * - A `HoldResolved` lands only while its hold is open, checked in the same
 *   transaction; otherwise the batch fails with `HoldNotOpenError`, so two
 *   resolvers cannot both settle one hold.
 * - A `NodeCreated` whose `after` names a predecessor lands only when the log
 *   holds that node in the same file, checked in the same transaction;
 *   otherwise the batch fails with `UnplacedNodeError`, so the log never
 *   holds a node that no file projection shows.
 * - A `FolderImported` lands only when the log holds none, checked in the
 *   same transaction; otherwise the batch fails with
 *   `FolderAlreadyImportedError`, so of two first imports racing on one
 *   database exactly one lands (decision
 *   `second-import-is-idempotent-on-a-projected-folder`).
 * - Every memory file path an event carries is a `MemoryFilePath`: a path
 *   outside the memory-file rule fails the append with a `MemoryLogError`
 *   whose cause is the schema error, and the batch appends nothing.
 * - The check applies to appends made through this service, which are the
 *   only writes any phase of this packet makes, so every node keeps one head.
 *   A remote replay is a set-union and must not be refused: it would bypass
 *   the check and could add a second head. No phase wires a remote; the packet
 *   that does must first decide, by decision file, how a forked node is held
 *   and resolved, because agent operations name one expected revision.
 * - `heads` reads the current head revisions of one node: empty for an
 *   unknown node, otherwise one.
 * - `cursor` reads how many entries this replica has committed.
 * - `entriesAfter` reads the entries committed after a cursor, in commit
 *   order, so a projection catches up from where it stopped;
 *   `entriesAfter(LogCursor.make(0))` reads the whole log.
 * - `history` reads the entries keyed by one node, oldest first.
 *
 * **Example** (Read the heads of a node)
 *
 * ```ts
 * import { MemoryLog, NodeId } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const log = yield* MemoryLog
 *   return yield* log.heads(NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"))
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MemoryLog extends Context.Service<
  MemoryLog,
  {
    readonly append: (
      event: MemoryEvent
    ) => Effect.Effect<
      void,
      MemoryLogError | StaleParentsError | HoldNotOpenError | UnplacedNodeError | FolderAlreadyImportedError
    >;
    readonly appendMany: (
      events: A.NonEmptyReadonlyArray<MemoryEvent>
    ) => Effect.Effect<
      void,
      MemoryLogError | StaleParentsError | HoldNotOpenError | UnplacedNodeError | FolderAlreadyImportedError
    >;
    readonly heads: (nodeId: NodeId) => Effect.Effect<ReadonlyArray<RevisionId>, MemoryLogError>;
    readonly cursor: Effect.Effect<LogCursor, MemoryLogError>;
    readonly entriesAfter: (cursor: LogCursor) => Effect.Effect<ReadonlyArray<Entry>, MemoryLogError>;
    readonly history: (nodeId: NodeId) => Effect.Effect<ReadonlyArray<Entry>, MemoryLogError>;
  }
>()($I`MemoryLog`) {}

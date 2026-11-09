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
import type { MemoryLogError } from "./AgentMemoryStore.errors.ts";
import type { MemoryEvent } from "./NodeEvent.events.ts";
import type { NodeId, RevisionId } from "./NodeIdentity.models.ts";

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
 * - `append` writes one event; `appendMany` writes several under one journal
 *   lock, committing all or none.
 * - `entries` reads every committed entry in journal order.
 * - `frontier` reads the current head revisions across all nodes.
 * - `history` reads the entries keyed by one node, oldest first.
 *
 * **Example** (Read the memory log frontier)
 *
 * ```ts
 * import { MemoryLog } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const log = yield* MemoryLog
 *   return yield* log.frontier
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
    readonly append: (event: MemoryEvent) => Effect.Effect<void, MemoryLogError>;
    readonly appendMany: (events: A.NonEmptyReadonlyArray<MemoryEvent>) => Effect.Effect<void, MemoryLogError>;
    readonly entries: Effect.Effect<ReadonlyArray<Entry>, MemoryLogError>;
    readonly frontier: Effect.Effect<ReadonlyArray<RevisionId>, MemoryLogError>;
    readonly history: (nodeId: NodeId) => Effect.Effect<ReadonlyArray<Entry>, MemoryLogError>;
  }
>()($I`MemoryLog`) {}

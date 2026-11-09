/**
 * Memory indexes contract: Layer 2 projections that serve recall.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { MemoryIndexError } from "./AgentMemoryStore.errors.ts";
import type { NodeId } from "./NodeIdentity.models.ts";
import type { Candidate } from "./Recall.models.ts";
import type { SymbolReference } from "./Scip.models.ts";

const $I = $AgentMemoryStoreId.create("MemoryIndexes.service");

/**
 * Full-text, vector and symbol indexes projected from the memory log.
 *
 * **Details**
 *
 * The indexes are Layer 2 projections: prunable, and rebuildable from the log
 * at any time.
 *
 * - `rebuild` drops and re-projects every index from the log.
 * - `searchText` returns BM25 candidates; `searchVector` returns vector
 *   candidates. Both return at most `limit` candidates.
 * - `lookupSymbol` returns the nodes that reference a code symbol (the typed
 *   identity lookup).
 *
 * Every method fails with `MemoryIndexError`, which names the index
 * boundary; recall maps it into `RecallError` at its own boundary.
 *
 * **Example** (Search the text index)
 *
 * ```ts
 * import { MemoryIndexes } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const indexes = yield* MemoryIndexes
 *   return yield* indexes.searchText("sqlite driver", 50)
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MemoryIndexes extends Context.Service<
  MemoryIndexes,
  {
    readonly rebuild: Effect.Effect<void, MemoryIndexError>;
    readonly searchText: (query: string, limit: number) => Effect.Effect<ReadonlyArray<Candidate>, MemoryIndexError>;
    readonly searchVector: (query: string, limit: number) => Effect.Effect<ReadonlyArray<Candidate>, MemoryIndexError>;
    readonly lookupSymbol: (reference: SymbolReference) => Effect.Effect<ReadonlyArray<NodeId>, MemoryIndexError>;
  }
>()($I`MemoryIndexes`) {}

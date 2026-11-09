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
import type { IndexHit, IndexSearch } from "./Recall.models.ts";
import type { ScipSymbol } from "./Scip.models.ts";

const $I = $AgentMemoryStoreId.create("MemoryIndexes.service");

/**
 * Full-text, vector and symbol indexes projected from the memory log.
 *
 * **Details**
 *
 * The indexes are Layer 2 projections: prunable, and rebuildable from the log
 * at any time. `gap` nodes are never indexed.
 *
 * - `rebuild` drops and re-projects every index from the log.
 * - `searchText` returns BM25 hits and `searchVector` returns vector hits,
 *   each with that index's own score. Both apply the search's authoritative
 *   filters before its limit (decision
 *   `index-search-applies-filters-and-embedder-port`) and return at most
 *   `limit` hits.
 * - `searchVector` embeds the query through the `Embedder` port the
 *   implementing Layer depends on, and returns no hits when that port has no
 *   model.
 * - `lookupSymbol` returns the nodes that reference a code symbol (the typed
 *   identity lookup). It takes the bare symbol, which is all a recall
 *   `symbol` filter carries; the span hash belongs to
 *   `SymbolResolver.resolve`.
 *
 * Every method fails with `MemoryIndexError`, which names the index
 * boundary; recall maps it into `RecallError` at its own boundary.
 *
 * **Example** (Search the text index)
 *
 * ```ts
 * import { IndexSearch, MemoryIndexes } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const indexes = yield* MemoryIndexes
 *   return yield* indexes.searchText(IndexSearch.make({ text: "sqlite driver", filters: [], limit: 50 }))
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
    readonly searchText: (search: IndexSearch) => Effect.Effect<ReadonlyArray<IndexHit>, MemoryIndexError>;
    readonly searchVector: (search: IndexSearch) => Effect.Effect<ReadonlyArray<IndexHit>, MemoryIndexError>;
    readonly lookupSymbol: (symbol: ScipSymbol) => Effect.Effect<ReadonlyArray<NodeId>, MemoryIndexError>;
  }
>()($I`MemoryIndexes`) {}

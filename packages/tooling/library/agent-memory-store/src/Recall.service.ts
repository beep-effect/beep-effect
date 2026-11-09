/**
 * Recall contract: the fixed retrieval pipeline over the memory indexes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { RecallError } from "./AgentMemoryStore.errors.ts";
import type { RecallQuery, RecallResult } from "./Recall.models.ts";

const $I = $AgentMemoryStoreId.create("Recall.service");

/**
 * Answers recall queries from the memory indexes.
 *
 * **Details**
 *
 * Decision `retrieval-order-convex-fusion` fixes the order: authoritative
 * filters, BM25-leaning convex fusion over text and vector candidates, the
 * {@link Reranker} port, the admissibility gate with typed findings including
 * the typed symbol lookup, then budgets. There is no relevance stage, and
 * observation counts are never read (ruling 3).
 *
 * **Example** (Recall with a query)
 *
 * ```ts
 * import { Recall, RecallBudget, RecallQuery } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const recall = yield* Recall
 *   return yield* recall.recall(
 *     RecallQuery.make({ text: "sqlite driver", filters: [], budget: RecallBudget.make({ maxTokens: 2000 }) })
 *   )
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Recall extends Context.Service<
  Recall,
  {
    readonly recall: (query: RecallQuery) => Effect.Effect<RecallResult, RecallError>;
  }
>()($I`Recall`) {}

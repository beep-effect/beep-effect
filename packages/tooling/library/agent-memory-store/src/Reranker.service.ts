/**
 * Reranker port of the recall pipeline and its pass-through layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { Candidate } from "./Recall.models.ts";
import type { RecallError } from "./AgentMemoryStore.errors.ts";
import type { RecallQuery } from "./Recall.models.ts";

const $I = $AgentMemoryStoreId.create("Reranker.service");

const withoutRerankScore = (candidate: Candidate): Candidate => Candidate.make({ ...candidate, reranked: O.none() });

/**
 * Cross-encoder port that reorders fused candidates for a query.
 *
 * **Details**
 *
 * Decision `reranker-port-pass-through`: the reranker is a port so every test
 * runs keyless. `rerank` receives candidates in fused order and returns them
 * in reranked order with `reranked` scores set.
 *
 * **Example** (Rerank with the pass-through layer)
 *
 * ```ts
 * import { RecallBudget, RecallQuery, Reranker } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const reranker = yield* Reranker
 *   const query = RecallQuery.make({ text: "sqlite", filters: [], budget: RecallBudget.make({ maxTokens: 500 }) })
 *   return yield* reranker.rerank(query, [])
 * }).pipe(Effect.provide(Reranker.passThrough))
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Reranker extends Context.Service<
  Reranker,
  {
    readonly rerank: (
      query: RecallQuery,
      candidates: ReadonlyArray<Candidate>
    ) => Effect.Effect<ReadonlyArray<Candidate>, RecallError>;
  }
>()($I`Reranker`) {
  /**
   * Reranker that keeps the fused order and leaves every `reranked` score
   * absent.
   *
   * **Example** (Provide the pass-through reranker)
   *
   * ```ts
   * import { Reranker } from "@beep/agent-memory-store"
   *
   * console.log(Reranker.passThrough)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly passThrough: Layer.Layer<Reranker> = Layer.succeed(Reranker, {
    rerank: Effect.fn("Reranker.passThrough.rerank")((_query: RecallQuery, candidates: ReadonlyArray<Candidate>) =>
      Effect.succeed(A.map(candidates, withoutRerankScore))
    ),
  });
}

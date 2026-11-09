/**
 * Embedder port of the vector index and its unavailable layer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as A from "effect/Array";
import type * as O from "effect/Option";
import type { MemoryIndexError } from "./AgentMemoryStore.errors.ts";
import type { Embedding } from "./Recall.models.ts";

const $I = $AgentMemoryStoreId.create("Embedder.service");

/**
 * Local embedding model port the vector index is built and queried through.
 *
 * **Details**
 *
 * Decision `index-search-applies-filters-and-embedder-port`: embeddings are
 * an optional local model, so the embedder is a port and every test runs
 * keyless. `embed` returns one embedding per text, in order, or none when no
 * model is installed. The vector index owns both sides of the comparison: it
 * embeds node texts at rebuild and the query text at search through this one
 * port, so the two can never come from different models. With no model the
 * vector index stays empty and recall fuses the text index alone.
 *
 * **Example** (Embed with the unavailable layer)
 *
 * ```ts
 * import { Embedder } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const embedder = yield* Embedder
 *   return yield* embedder.embed(["sqlite driver"])
 * }).pipe(Effect.provide(Embedder.unavailable))
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Embedder extends Context.Service<
  Embedder,
  {
    readonly embed: (
      texts: A.NonEmptyReadonlyArray<string>
    ) => Effect.Effect<O.Option<A.NonEmptyReadonlyArray<Embedding>>, MemoryIndexError>;
  }
>()($I`Embedder`) {
  /**
   * Embedder for a machine with no local model: every call returns none.
   *
   * **Example** (Provide the unavailable embedder)
   *
   * ```ts
   * import { Embedder } from "@beep/agent-memory-store"
   *
   * console.log(Embedder.unavailable)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly unavailable: Layer.Layer<Embedder> = Layer.succeed(Embedder, {
    embed: Effect.fn("Embedder.unavailable.embed")((_texts: A.NonEmptyReadonlyArray<string>) => Effect.succeedNone),
  });
}

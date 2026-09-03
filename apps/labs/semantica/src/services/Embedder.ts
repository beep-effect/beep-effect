import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { ModelIdentity } from "@/schema/Model";
import type { EmbeddingBatch, EmbeddingInput } from "@/schema/Projection";

const $I = $SemanticaId.create("services/Embedder");

interface EmbedderShape {
  readonly embed: (inputs: ReadonlyArray<EmbeddingInput>) => Effect.Effect<EmbeddingBatch>;
}

/**
 * Active dimension-carrying embedding identity paired with a provider Layer.
 *
 * **Example** (Access the active model identity)
 *
 * ```ts
 * import { ActiveEmbeddingIdentity } from "@/services/Embedder"
 * import { Effect } from "effect"
 *
 * const program = ActiveEmbeddingIdentity.pipe(Effect.map((identity) => identity.name))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ActiveEmbeddingIdentity extends Context.Service<ActiveEmbeddingIdentity, ModelIdentity>()(
  $I`ActiveEmbeddingIdentity`
) {}

/**
 * App-local cached embedding boundary over exact canonical chunk text.
 *
 * **Example** (Access the embed function)
 *
 * ```ts
 * import { Embedder } from "@/services/Embedder"
 * import { Effect } from "effect"
 *
 * const program = Embedder.pipe(Effect.map((service) => typeof service.embed))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Embedder extends Context.Service<Embedder, EmbedderShape>()($I`Embedder`) {}

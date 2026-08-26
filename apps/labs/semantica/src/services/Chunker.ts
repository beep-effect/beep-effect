import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Crypto, Effect } from "effect";
import type * as A from "effect/Array";
import type { AnchorRejected } from "@/schema/Errors";
import type { CanonicalText, Chunk } from "@/schema/Text";

const $I = $SemanticaId.create("services/Chunker");

/**
 * Deterministic canonical-text chunking contract.
 *
 * @category services
 * @since 0.0.0
 */
interface ChunkerShape {
  readonly chunk: (
    canonical: CanonicalText
  ) => Effect.Effect<A.NonEmptyReadonlyArray<Chunk>, AnchorRejected, Crypto.Crypto>;
}

/**
 * App-local paragraph, heading, and sentence chunker.
 *
 * **Example** (Access the chunker)
 *
 * ```ts
 * import { Chunker } from "@/services/Chunker"
 * import { Effect } from "effect"
 *
 * const program = Chunker.pipe(Effect.map((service) => typeof service.chunk))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Chunker extends Context.Service<Chunker, ChunkerShape>()($I`Chunker`) {}

import { $SemanticaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as A from "effect/Array";
import type * as Crypto from "effect/Crypto";
import type * as Effect from "effect/Effect";
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
 * import * as Effect from "effect/Effect";
 * const program = Chunker.pipe(Effect.map((service) => typeof service.chunk))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Chunker extends Context.Service<Chunker, ChunkerShape>()($I`Chunker`) {}

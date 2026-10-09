import { $SemanticaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as A from "effect/Array";
import type * as Crypto from "effect/Crypto";
import type * as Effect from "effect/Effect";
import type { AnchorRejected } from "@/schema/Errors";
import type { ExtractOutcome } from "@/schema/Evidence";
import type { CanonicalText, Chunk } from "@/schema/Text";

const $I = $SemanticaId.create("services/Extractor");

/**
 * Shared extraction contract implemented by both C0 lanes.
 *
 * @category services
 * @since 0.0.0
 */
interface ExtractorShape {
  readonly extract: (
    canonical: CanonicalText,
    chunks: A.NonEmptyReadonlyArray<Chunk>
  ) => Effect.Effect<ExtractOutcome, AnchorRejected, Crypto.Crypto>;
}

/**
 * Hosted LangExtract lane.
 *
 * **Example** (Access the hosted extractor)
 *
 * ```ts
 * import { HostedExtractor } from "@/services/Extractor"
 * import * as Effect from "effect/Effect";
 * const program = HostedExtractor.pipe(Effect.map((service) => typeof service.extract))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HostedExtractor extends Context.Service<HostedExtractor, ExtractorShape>()($I`HostedExtractor`) {}

/**
 * Local Wink pattern lane.
 *
 * **Example** (Access the pattern extractor)
 *
 * ```ts
 * import { PatternExtractor } from "@/services/Extractor"
 * import * as Effect from "effect/Effect";
 * const program = PatternExtractor.pipe(Effect.map((service) => typeof service.extract))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PatternExtractor extends Context.Service<PatternExtractor, ExtractorShape>()($I`PatternExtractor`) {}

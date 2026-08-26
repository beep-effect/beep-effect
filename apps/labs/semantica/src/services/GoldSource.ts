import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { CorpusPaperId } from "@/corpus/Manifest";
import type { GoldUnavailable } from "@/schema/Errors";
import type { GoldFile } from "@/schema/Gold";

const $I = $SemanticaId.create("services/GoldSource");

/**
 * Injectable source of gold-v1 label files.
 *
 * @category services
 * @since 0.0.0
 */
interface GoldSourceShape {
  readonly load: (paperIds: ReadonlyArray<CorpusPaperId>) => Effect.Effect<ReadonlyArray<GoldFile>, GoldUnavailable>;
}

/**
 * App-local gold label source with live filesystem and test implementations.
 *
 * **Example** (Access the gold source)
 *
 * ```ts
 * import { GoldSource } from "@/services/GoldSource"
 * import { Effect } from "effect"
 *
 * const program = GoldSource.pipe(Effect.map((service) => typeof service.load))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoldSource extends Context.Service<GoldSource, GoldSourceShape>()($I`GoldSource`) {}

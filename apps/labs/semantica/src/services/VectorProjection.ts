import { $SemanticaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { ProjectionFailed } from "@/schema/Errors";
import type { EmbeddingVector, KnnQueryResult } from "@/schema/Projection";

const $I = $SemanticaId.create("services/VectorProjection");

interface VectorProjectionShape {
  readonly drop: Effect.Effect<void, ProjectionFailed>;
  readonly neighbors: (query: EmbeddingVector, limit: number) => Effect.Effect<KnnQueryResult, ProjectionFailed>;
  readonly rebuild: (vectors: ReadonlyArray<EmbeddingVector>) => Effect.Effect<void, ProjectionFailed>;
}

/**
 * Dimension-keyed DuckDB vector projection and exact-SQL kNN boundary.
 *
 * **Example** (Access the rebuild function)
 *
 * ```ts
 * import { VectorProjection } from "@/services/VectorProjection"
 * import * as Effect from "effect/Effect";
 * const program = VectorProjection.pipe(Effect.map((service) => typeof service.rebuild))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VectorProjection extends Context.Service<VectorProjection, VectorProjectionShape>()(
  $I`VectorProjection`
) {}

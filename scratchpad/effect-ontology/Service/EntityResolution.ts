/**
 * Service: Entity Resolution
 *
 * Service wrapper for entity resolution operations.
 *
 * @since 2.0.0
 * @module Service/EntityResolution
 */

import { Effect, Option, Context, Layer } from "effect"
import { KnowledgeGraph } from "../Domain/Model/Entity.ts"
import type { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts"
import { buildEntityResolutionGraph } from "../Workflow/EntityResolutionGraph.ts"
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/EntityResolution");

/**
 * EntityResolutionService - Entity resolution operations
 *
 * @since 2.0.0
 * @category Services
 */
const makeEntityResolutionService = Effect.gen(function*() {
  const _embedding = yield* EmbeddingService
  return {
    resolve: (graphs: ReadonlyArray<KnowledgeGraph>, config: EntityResolutionConfig) =>
      Effect.gen(function*() {
        // Merge all graphs
        const mergedEntities = graphs.flatMap((g) => g.entities)
        const mergedRelations = graphs.flatMap((g) => g.relations)

        const mergedGraph = KnowledgeGraph.make({
          entities: mergedEntities,
          relations: mergedRelations
        })

        return yield* buildEntityResolutionGraph(mergedGraph, config)
      })
  }
})

export class EntityResolutionService
  extends Context.Service<EntityResolutionService>()($I`EntityResolutionService`, {
        make: makeEntityResolutionService,
      })
{
  /**
   * Live layer for EntityResolutionService
   */
  static readonly Live = EntityResolutionService.Default
    static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([EmbeddingServiceDefault]));
}

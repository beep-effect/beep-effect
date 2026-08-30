/**
 * Service: Entity Resolution
 *
 * **Details**
 *
 * Service wrapper for entity resolution operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import { KnowledgeGraph } from "../Domain/Model/Entity.ts";
import type { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts";
import { buildEntityResolutionGraph } from "../Workflow/EntityResolutionGraph.ts";
import { EmbeddingService, EmbeddingServiceDefault } from "./Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EntityResolution");

/**
 * EntityResolutionService - Entity resolution operations
 *
 * @since 0.0.0
 * @category services
 */
const makeEntityResolutionService = Effect.gen(function* () {
  const embedding = yield* EmbeddingService;

  const resolve = Effect.fn("EntityResolutionService.resolve")(function* (
    graphs: ReadonlyArray<KnowledgeGraph>,
    config: EntityResolutionConfig
  ) {
    const mergedEntities = A.flatMap(graphs, (graph) => graph.entities);
    const mergedRelations = A.flatMap(graphs, (graph) => graph.relations);
    const mergedGraph = KnowledgeGraph.make({
      entities: mergedEntities,
      relations: mergedRelations,
    });

    return yield* buildEntityResolutionGraph(mergedGraph, config).pipe(
      Effect.provideService(EmbeddingService, embedding)
    );
  });

  return { resolve };
});

/**
 * Merges knowledge graphs and builds an entity-resolution graph.
 *
 * **Example** (Compose resolve against Default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { EntityResolutionConfig } from "@effect-ontology/Model/EntityResolution"
 * import { EntityResolutionService } from "@effect-ontology/Service/EntityResolution"
 *
 * const program = Effect.gen(function* () {
 *   const resolution = yield* EntityResolutionService
 *   return yield* resolution.resolve(
 *     [KnowledgeGraph.make({ entities: [], relations: [] })],
 *     EntityResolutionConfig.make({})
 *   )
 * }).pipe(Effect.provide(EntityResolutionService.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EntityResolutionService extends Context.Service<EntityResolutionService>()($I`EntityResolutionService`, {
  make: makeEntityResolutionService,
}) {
  static readonly Default = Layer.effect(this, this.make);

  /**
   * Live layer for EntityResolutionService
   */
  static readonly Live = this.Default.pipe(Layer.provide(EmbeddingServiceDefault));
}

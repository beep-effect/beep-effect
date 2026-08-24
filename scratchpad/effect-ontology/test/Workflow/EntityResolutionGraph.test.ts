import { IRI } from "@beep/rdf";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { assert, describe, it } from "@effect/vitest";
import { Effect, HashMap, Layer } from "effect";
import * as O from "effect/Option";
import { EmbeddingError } from "../../Domain/Error/Embedding.ts";
import { Entity } from "../../Domain/Model/Entity.ts";
import { EntityResolutionConfig } from "../../Domain/Model/EntityResolution.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { EmbeddingService } from "../../Service/Embedding.ts";
import { clusterEntities } from "../../Workflow/EntityResolutionGraph.ts";

const UnavailableEmbeddings = Layer.succeed(
  EmbeddingService,
  EmbeddingService.of({
    embed: Effect.fn("EntityResolutionGraphTest.embed")(() =>
      Effect.fail(
        EmbeddingError.make({
          message: "Embedding unavailable",
          provider: "test",
          cause: O.none(),
        })
      )
    ),
    embedBatch: Effect.fn("EntityResolutionGraphTest.embedBatch")(() =>
      Effect.fail(
        EmbeddingError.make({
          message: "Embedding unavailable",
          provider: "test",
          cause: O.none(),
        })
      )
    ),
    cosineSimilarity: () => 0,
    getProviderMetadata: Effect.succeed({ providerId: "nomic", modelId: "test", dimension: 1 }),
  })
);

const entities = [
  Entity.make({
    id: EntityId.make("alice"),
    mention: "Alice",
    types: [IRI.make("https://schema.org/Person")],
  }),
  Entity.make({
    id: EntityId.make("alicia"),
    mention: "Alicia",
    types: [IRI.make("https://schema.org/Person")],
  }),
];

describe("EntityResolutionGraph", () => {
  it.layer(UnavailableEmbeddings)("with unavailable embeddings", (it) => {
    it.effect(
      "continues without null sentinels",
      Effect.fnUntraced(function* () {
        const result = yield* clusterEntities(
          entities,
          [],
          EntityResolutionConfig.make({
            embeddingWeight: UnitInterval.make(1),
            requireTypeOverlap: false,
          })
        );

        assert.strictEqual(HashMap.size(result.embeddingMap), 0);
      })
    );
  });
});

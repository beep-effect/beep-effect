import { IRI, makeDataset } from "@beep/rdf";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Entity, Relation, RelationObject } from "../../Domain/Model/Entity.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { ClassificationError } from "../../Service/DocumentClassifier.ts";
import { CachedExtractionResult } from "../../Service/ExtractionCache.ts";
import { ExplanationContext } from "../../Service/ViolationExplainer.ts";
const decodeCachedExtractionResult = S.decodeEffect(CachedExtractionResult);
const decodeEntityId = S.decodeEffect(EntityId);
const decodeIRI = S.decodeEffect(IRI);
const decodeUnknownCachedExtractionResultOption = S.decodeUnknownOption(CachedExtractionResult);
const decodeUnknownExplanationContextOption = S.decodeUnknownOption(ExplanationContext);
const encodeCachedExtractionResult = S.encodeEffect(CachedExtractionResult);
const isRelation = S.is(Relation);

describe("canonical service schema boundaries", () => {
  it.effect(
    "round-trips canonical extraction entities and relations",
    Effect.fnUntraced(function* () {
      const ada = yield* decodeEntityId("ada_lovelace");
      const personIri = yield* decodeIRI("https://schema.org/Person");
      const nameIri = yield* decodeIRI("https://schema.org/name");
      const entity = Entity.make({
        id: ada,
        mention: "Ada Lovelace",
        types: [personIri],
      });
      const relation = Relation.make({
        subjectId: ada,
        predicate: nameIri,
        object: RelationObject.cases.Text.make({ value: "Ada Lovelace" }),
      });
      const cached: CachedExtractionResult = {
        entities: [entity],
        relations: [relation],
        metadata: {
          computedAt: "2026-08-17T00:00:00.000Z",
          model: "test-model",
          temperature: 0.3,
          computedIn: 25,
        },
      };

      const encoded = yield* encodeCachedExtractionResult(cached);
      const decoded = yield* decodeCachedExtractionResult(encoded);

      assert.isTrue(A.head(decoded.entities).pipe(O.getOrNull, Entity.is));
      assert.isTrue(A.head(decoded.relations).pipe(O.getOrNull, isRelation));
      assert.isTrue(
        O.isNone(
          decodeUnknownCachedExtractionResultOption({
            entities: [{ arbitrary: "payload" }],
            relations: [],
            metadata: cached.metadata,
          })
        )
      );
    })
  );

  it("accepts only canonical RDF datasets and normalizes typed error causes", () => {
    const context = ExplanationContext.make({ dataStore: O.some(makeDataset([])) });
    const error = ClassificationError.make({
      message: "Classification failed.",
      cause: O.some(context),
    });

    assert.isTrue(O.isSome(context.dataStore));
    assert.isTrue(ClassificationError.is(error));
    assert.isTrue(O.isSome(error.cause));
    assert.isTrue(
      O.isNone(
        decodeUnknownExplanationContextOption({
          dataStore: { arbitrary: "payload" },
        })
      )
    );
  });
});

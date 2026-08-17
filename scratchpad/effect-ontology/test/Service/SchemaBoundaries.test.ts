import { IRI, makeDataset } from "@beep/rdf";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Entity, Relation, RelationObject } from "../../Domain/Model/Entity.ts";
import { EntityId } from "../../Domain/Model/shared.ts";
import { ClassificationError } from "../../Service/DocumentClassifier.ts";
import { CachedExtractionResult } from "../../Service/ExtractionCache.ts";
import { ExplanationContext } from "../../Service/ViolationExplainer.ts";

describe("canonical service schema boundaries", () => {
  it.effect("round-trips canonical extraction entities and relations", () =>
    Effect.gen(function* () {
      const ada = EntityId.fromUnknown("ada_lovelace");
      const entity = Entity.make({
        id: ada,
        mention: "Ada Lovelace",
        types: [IRI.fromUnknown("https://schema.org/Person")],
      });
      const relation = Relation.make({
        subjectId: ada,
        predicate: IRI.fromUnknown("https://schema.org/name"),
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

      const encoded = yield* S.encodeEffect(CachedExtractionResult)(cached);
      const decoded = yield* S.decodeEffect(CachedExtractionResult)(encoded);

      assert.isTrue(A.head(decoded.entities).pipe(O.getOrNull, Entity.is));
      assert.isTrue(A.head(decoded.relations).pipe(O.getOrNull, S.is(Relation)));
      assert.isTrue(
        O.isNone(
          S.decodeUnknownOption(CachedExtractionResult)({
            entities: [{ arbitrary: "payload" }],
            relations: [],
            metadata: cached.metadata,
          })
        )
      );
    })
  );

  it.effect("accepts only canonical RDF datasets and normalizes typed error causes", () =>
    Effect.sync(() => {
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
          S.decodeUnknownOption(ExplanationContext)({
            dataStore: { arbitrary: "payload" },
          })
        )
      );
    })
  );
});

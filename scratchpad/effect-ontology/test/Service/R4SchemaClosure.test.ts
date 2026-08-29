import { IRI } from "@beep/rdf";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ClassDefinition } from "../../Domain/Model/Ontology.ts";
import type {
  CanonicalEntityId as CanonicalEntityIdType,
  EntityAliasId as EntityAliasIdType,
} from "../../Repository/EntityRegistry.ts";
import { CanonicalEntityId, EntityAliasId } from "../../Repository/EntityRegistry.ts";
import { ChunkOptions, OntologySearchResult, TextChunk } from "../../Service/Nlp.ts";

type IsAssignable<From, To> = [From] extends [To] ? true : false;

const canonicalIdIsAliasId: IsAssignable<CanonicalEntityIdType, EntityAliasIdType> = false;
const aliasIdIsCanonicalId: IsAssignable<EntityAliasIdType, CanonicalEntityIdType> = false;

describe("round-four schema closure", () => {
  it.effect(
    "keeps canonical and alias database identities nominally distinct",
    Effect.fnUntraced(function* () {
      const canonicalId = CanonicalEntityId.make("00000000-0000-4000-8000-000000000001");
      const aliasId = EntityAliasId.make("00000000-0000-4000-8000-000000000002");

      assert.isFalse(canonicalIdIsAliasId);
      assert.isFalse(aliasIdIsCanonicalId);
      assert.isTrue(S.is(CanonicalEntityId)(canonicalId));
      assert.isTrue(S.is(EntityAliasId)(aliasId));
      yield* Effect.void;
    })
  );

  it.effect(
    "rejects reversed chunk offsets and resolves strategy-owned defaults",
    Effect.fnUntraced(function* () {
      const invalidChunk = S.decodeOption(TextChunk)({
        index: 0,
        text: "Ada",
        startOffset: 4,
        endOffset: 1,
      });
      const options = yield* S.decodeEffect(ChunkOptions)({ strategy: "fine_grained" });

      assert.isTrue(O.isNone(invalidChunk));
      assert.strictEqual(options.strategy, "fine_grained");
      assert.strictEqual(options.params.chunkSize, 300);
      assert.strictEqual(options.params.overlapSentences, 3);
      assert.isTrue(options.params.preserveSentences);
    })
  );

  it.effect(
    "admits exactly one ontology search-result case",
    Effect.fnUntraced(function* () {
      const iri = IRI.make("https://schema.org/Person");
      const definition = yield* S.decodeEffect(ClassDefinition)({ id: iri, label: "Person" });
      const result = OntologySearchResult.cases.class.make({
        iri,
        score: 0.9,
        definition,
      });
      const invalidBag = S.decodeUnknownOption(OntologySearchResult)({
        iri,
        score: 0.9,
        class: result.definition,
        property: result.definition,
      });

      assert.isTrue(OntologySearchResult.guards.class(result));
      assert.strictEqual(result.definition.id, iri);
      assert.isTrue(O.isNone(invalidBag));
      yield* Effect.void;
    })
  );
});

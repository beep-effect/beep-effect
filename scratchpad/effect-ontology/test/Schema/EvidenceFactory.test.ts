import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ClassDefinition, PropertyDefinition } from "../../Domain/Model/Ontology.ts";
import { makeEntitySchema } from "../../Schema/EntityFactory.ts";
import { makeRelationSchema } from "../../Schema/RelationFactory.ts";

const decodePerson = S.decodeEffect(ClassDefinition)({
  id: "https://schema.org/#Person",
  label: "Person",
});

const decodeKnows = S.decodeEffect(PropertyDefinition)({
  id: "https://schema.org/#knows",
  label: "knows",
  rangeType: "object",
});

const legacyEvidence = {
  text: "Ada knows Bob",
  startChar: 0,
  endChar: 13,
  confidence: 0.8,
};

describe("extraction factory evidence", () => {
  it.effect(
    "decodes entity-factory evidence to the canonical quote representation",
    Effect.fnUntraced(function* () {
      const person = yield* decodePerson;
      const schema = makeEntitySchema([person], []);
      const output = yield* S.decodeEffect(schema)({
        entities: [
          {
            id: "ada",
            mention: "Ada",
            types: ["Person"],
            mentions: [legacyEvidence],
          },
        ],
      });

      const mention = O.map(output.entities[0].mentions, (mentions) => mentions[0]);
      expect(O.map(mention, (value) => value.quote)).toEqual(O.some(legacyEvidence.text));
      expect(O.flatMap(mention, (value) => value.confidence)).toEqual(O.some(0.8));
    })
  );

  it.effect(
    "shares canonical width validation across relation-factory evidence",
    Effect.fnUntraced(function* () {
      const knows = yield* decodeKnows;
      const schema = makeRelationSchema(["ada", "bob"], [knows]);
      const valid = yield* S.decodeEffect(schema)({
        relations: [
          {
            subjectId: "ada",
            predicate: "knows",
            object: "bob",
            evidence: legacyEvidence,
          },
        ],
      });
      const invalid = S.decodeResult(schema)({
        relations: [
          {
            subjectId: "ada",
            predicate: "knows",
            object: "bob",
            evidence: { ...legacyEvidence, endChar: 12 },
          },
        ],
      });

      expect(O.map(valid.relations[0].evidence, (evidence) => evidence.quote)).toEqual(O.some(legacyEvidence.text));
      expect(Result.isFailure(invalid)).toBe(true);
    })
  );
});

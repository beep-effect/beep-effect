import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ClassDefinition, PropertyDefinition } from "../../Domain/Model/Ontology.ts";
import { makeEntitySchema } from "../../Schema/EntityFactory.ts";
import { makeRelationSchema } from "../../Schema/RelationFactory.ts";

const person = ClassDefinition.fromUnknown({
  id: "https://schema.org/#Person",
  label: "Person",
});

const knows = PropertyDefinition.fromUnknown({
  id: "https://schema.org/#knows",
  label: "knows",
  rangeType: "object",
});

const legacyEvidence = {
  text: "Ada knows Bob",
  startChar: 0,
  endChar: 13,
  confidence: 0.8,
} as const;

describe("extraction factory evidence", () => {
  it("decodes entity-factory evidence to the canonical quote representation", () => {
    const schema = makeEntitySchema([person], []);
    const output = S.decodeSync(schema)({
      entities: [
        {
          id: "ada",
          mention: "Ada",
          types: ["Person"],
          mentions: [legacyEvidence],
        },
      ],
    });

    const mention = O.getOrThrow(output.entities[0].mentions)[0];
    expect(mention.quote).toBe(legacyEvidence.text);
    expect(O.getOrThrow(mention.confidence)).toBe(0.8);
  });

  it("shares canonical width validation across relation-factory evidence", () => {
    const schema = makeRelationSchema(["ada", "bob"], [knows]);
    const valid = S.decodeSync(schema)({
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

    expect(O.getOrThrow(valid.relations[0].evidence).quote).toBe(legacyEvidence.text);
    expect(Result.isFailure(invalid)).toBe(true);
  });
});

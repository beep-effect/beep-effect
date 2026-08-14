import { Confidence as CanonicalConfidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { IRI as CanonicalIRI } from "@beep/rdf/Iri";
import { URLStr as CanonicalURLStr } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import {
  Attributes,
  AttributeValue,
  Confidence,
  EntityId,
  IRI,
  OptionalConfidence,
  URLStr,
} from "../../../Domain/Model/shared.ts";

const sharedSchemas: ReadonlyArray<S.Constraint> = [
  AttributeValue,
  Attributes,
  Confidence,
  OptionalConfidence,
  EntityId,
];

describe("effect-ontology shared model schemas", () => {
  it("re-exports canonical shared value schemas by identity", () => {
    expect(Confidence).toBe(CanonicalConfidence);
    expect(IRI).toBe(CanonicalIRI);
    expect(URLStr).toBe(CanonicalURLStr);
  });

  it("derives arbitraries whose values satisfy every public schema", () => {
    for (const schema of sharedSchemas) {
      const arbitrary = S.toArbitrary(schema)(fc);
      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 32 }
      );
    }
  });

  it("keeps attribute records JSON-safe and provides a schema-owned empty value", () => {
    expect(Attributes.empty()).toEqual({});
    expect(Attributes.is({ active: true, confidence: 0.95, source: "article" })).toBe(true);
    expect(AttributeValue.is(Number.NaN)).toBe(false);
    expect(AttributeValue.is(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("normalizes nullish confidence at the schema boundary", () => {
    const fromNull = Result.getOrThrow(S.decodeResult(OptionalConfidence)(null));
    const fromUndefined = Result.getOrThrow(S.decodeResult(OptionalConfidence)(undefined));
    const present = Result.getOrThrow(S.decodeResult(OptionalConfidence)(0.8));

    expect(O.isNone(fromNull)).toBe(true);
    expect(O.isNone(fromUndefined)).toBe(true);
    expect(O.getOrUndefined(present)).toBe(0.8);
  });

  it("validates entity identifiers and exposes schema-derived equivalence", () => {
    const first = EntityId.make("cristiano_ronaldo");
    const same = EntityId.make("cristiano_ronaldo");
    const other = EntityId.make("lionel_messi");

    expect(EntityId.equivalence(first, same)).toBe(true);
    expect(EntityId.equivalence(first, other)).toBe(false);
    expect(EntityId.is("_private")).toBe(false);
    expect(EntityId.is("Upper_Case")).toBe(false);
  });
});

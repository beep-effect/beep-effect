import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as Model from "../../../Domain/Model/index.ts";

const publicModelSchemas = A.filter(R.values(Model), S.isSchema);

describe("effect-ontology model schemas", () => {
  it("derives schema-valid arbitrary values for every public model schema", () => {
    for (const schema of publicModelSchemas) {
      const arbitrary = S.toArbitrary(schema)(fc);
      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 16 }
      );
    }
  });
});

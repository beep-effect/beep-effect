import * as Effect from "effect/Effect";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Model from "../../../Domain/Model/index.ts";

const publicModelSchemas = A.filter(R.toEntries(Model), ([, value]) => S.isSchema(value));

describe("effect-ontology model schemas", () => {
  it("derives schema-valid arbitrary values for every public model schema", () => {
    for (const [name, schema] of publicModelSchemas) {
      if (!S.isSchema(schema)) continue;
      const companion = Reflect.get(Model, `${name}Arbitrary`);
      const arbitrary = Arbitrary.isArbitrary(companion) ? companion : Arbitrary.schema(schema);
      expect(
        Effect.runSync(
          Arbitrary.checkEffect(
            Arbitrary.all([arbitrary]),
            ([value]) => {
          expect(S.is(schema)(value)).toBe(true);

              return true;
            },
            { runs: 16, maxDiscards: 4096 }
          )
        )._tag,
        name
      ).toBe("Passed");
    }
  });
});

import * as Effect from "effect/Effect";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { OutputFilename, OutputType, OutputTypeRegistry } from "../../../Domain/Model/OutputType.ts";
const isOutputFilename = S.is(OutputFilename);

describe("effect-ontology output artifact taxonomy", () => {
  it("derives arbitraries for output types and filenames", () => {
    for (const schema of [OutputType, OutputFilename]) {
      const arbitrary = Arbitrary.schema(schema);
      expect(
        Effect.runSync(
          Arbitrary.checkEffect(
            Arbitrary.all([arbitrary]),
            ([value]) => {
          expect(S.is(schema)(value)).toBe(true);

              return true;
            },
            { runs: 32 }
          )
        )._tag
      ).toBe("Passed");
    }
  });

  it("provides total metadata for every output type", () => {
    for (const type of OutputType.Options) {
      const metadata = OutputType.metadata(type);

      expect(metadata).toBe(OutputTypeRegistry[type]);
      expect(isOutputFilename(metadata.filename)).toBe(true);
      expect(metadata.description.length).toBeGreaterThan(0);
    }
  });

  it("includes canonical JSON-LD output and rejects unregistered filenames", () => {
    expect(OutputType.filename("rdf-jsonld")).toBe("graph.jsonld");
    expect(OutputFilename.is.graphJsonld("graph.jsonld")).toBe(true);
    expect(OutputFilename.is.graphJsonld("custom-output.json")).toBe(false);
  });
});

import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import {
  getOutputDescription,
  getOutputFilename,
  OutputFilename,
  OutputType,
  OutputTypeRegistry,
} from "../../../Domain/Model/OutputType.ts";

describe("effect-ontology output artifact taxonomy", () => {
  it("derives warning-free arbitraries for output types and filenames", () => {
    for (const schema of [OutputType, OutputFilename]) {
      const arbitrary = S.toArbitrary(schema, { report: true });

      expect(arbitrary.report.warnings).toEqual([]);
      fc.assert(
        fc.property(arbitrary.value, (value) => {
          expect(S.is(schema)(value)).toBe(true);
        }),
        { numRuns: 32 }
      );
    }
  });

  it("provides total metadata for every output type", () => {
    for (const type of OutputType.Options) {
      const metadata = OutputType.metadata(type);

      expect(metadata).toBe(OutputTypeRegistry[type]);
      expect(S.is(OutputFilename)(metadata.filename)).toBe(true);
      expect(metadata.description.length).toBeGreaterThan(0);
    }
  });

  it("includes canonical JSON-LD output and rejects unregistered filenames", () => {
    expect(OutputType.filename("rdf-jsonld")).toBe("graph.jsonld");
    expect(OutputFilename.is.graphJsonld("graph.jsonld")).toBe(true);
    expect(OutputFilename.is.graphJsonld("custom-output.json")).toBe(false);
  });

  it("keeps compatibility helpers delegated to schema-owned statics", () => {
    expect(getOutputFilename("rdf-turtle")).toBe(OutputType.filename("rdf-turtle"));
    expect(getOutputDescription("entities")).toBe(OutputType.description("entities"));
  });
});

import { OxigraphSparqlError } from "@beep/oxigraph";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameOxigraphSparqlError = S.toEquivalence(OxigraphSparqlError);

describe("Oxigraph declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = OxigraphSparqlError.make({ message: "query failed", reason: "queryFailed" });
    const b = OxigraphSparqlError.make({ message: "query failed", reason: "queryFailed" });
    const c = OxigraphSparqlError.make({ message: "query failed", reason: "datasetLoadFailed" });

    expect(sameOxigraphSparqlError(a, b)).toBe(true);
    expect(sameOxigraphSparqlError(a, c)).toBe(false);
  });
});

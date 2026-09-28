import { OxigraphSparqlError } from "@beep/oxigraph";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

const sameOxigraphSparqlError = S.toEquivalence(OxigraphSparqlError);

describe("Oxigraph declared-field equivalence", () => {
  it("treats field-equal errors as equivalent and field-different errors as distinct", () => {
    const a = OxigraphSparqlError.make({ message: "query failed", reason: "queryFailed" });
    const b = OxigraphSparqlError.make({ message: "query failed", reason: "queryFailed" });
    const c = OxigraphSparqlError.make({ message: "query failed", reason: "datasetLoadFailed" });

    pipe(sameOxigraphSparqlError(a, b), assertTrue);
    pipe(sameOxigraphSparqlError(a, c), assertFalse);
  });
});

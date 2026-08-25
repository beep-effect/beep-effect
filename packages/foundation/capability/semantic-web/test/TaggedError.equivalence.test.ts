import { CanonicalizationError } from "@beep/semantic-web/services/canonicalization";
import { ShaclValidationError } from "@beep/semantic-web/services/shacl-validation";
import { SparqlQueryError } from "@beep/semantic-web/services/sparql-query";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  first: Schema["Type"],
  second: Schema["Type"],
  different: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("@beep/semantic-web tagged-error declared equivalence", () => {
  it("compares canonicalization, SHACL, and SPARQL errors by declared fields", () => {
    expectDeclaredEquivalence(
      CanonicalizationError,
      CanonicalizationError.make({ message: "Unsupported algorithm", reason: "unsupportedAlgorithm" }),
      CanonicalizationError.make({ message: "Unsupported algorithm", reason: "unsupportedAlgorithm" }),
      CanonicalizationError.make({ message: "Fingerprint failed", reason: "fingerprintFailure" })
    );
    expectDeclaredEquivalence(
      ShaclValidationError,
      ShaclValidationError.make({ message: "Shape invalid", reason: "invalidShape" }),
      ShaclValidationError.make({ message: "Shape invalid", reason: "invalidShape" }),
      ShaclValidationError.make({ message: "Engine failed", reason: "engineFailure" })
    );
    expectDeclaredEquivalence(
      SparqlQueryError,
      SparqlQueryError.make({ message: "Profile unsupported", reason: "unsupportedProfile" }),
      SparqlQueryError.make({ message: "Profile unsupported", reason: "unsupportedProfile" }),
      SparqlQueryError.make({ message: "Query unimplemented", reason: "unimplemented" })
    );
  });
});

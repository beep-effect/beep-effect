import { TaxonomyProjectionError } from "@beep/documents-domain/values/Taxonomy";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("documents-domain tagged-error declared equivalence", () => {
  it("compares TaxonomyProjectionError by its declared fields", () => {
    const sameError = S.toEquivalence(TaxonomyProjectionError);
    const a = TaxonomyProjectionError.make({ reason: "unknown taxonomy concept" });
    const b = TaxonomyProjectionError.make({ reason: "unknown taxonomy concept" });
    const c = TaxonomyProjectionError.make({ reason: "invalid filing context" });

    expect(sameError(a, b)).toBe(true);
    expect(sameError(a, c)).toBe(false);
  });
});

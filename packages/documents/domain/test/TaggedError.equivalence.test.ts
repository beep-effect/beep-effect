import { TaxonomyProjectionError } from "@beep/documents-domain/values/Taxonomy";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

describe("documents-domain tagged-error declared equivalence", () => {
  it("compares TaxonomyProjectionError by its declared fields", () => {
    const sameError = S.toEquivalence(TaxonomyProjectionError);
    const a = TaxonomyProjectionError.make({ reason: "unknown taxonomy concept" });
    const b = TaxonomyProjectionError.make({ reason: "unknown taxonomy concept" });
    const c = TaxonomyProjectionError.make({ reason: "invalid filing context" });

    pipe(sameError(a, b), assertTrue);
    pipe(sameError(a, c), assertFalse);
  });
});

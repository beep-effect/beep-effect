import { ProvRdfCodecError } from "@beep/rdf/ProvRdf";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

describe("@beep/rdf tagged-error declared equivalence", () => {
  it("compares PROV RDF codec errors by declared message", () => {
    const same = S.toEquivalence(ProvRdfCodecError);
    const first = ProvRdfCodecError.make({ message: "Unsupported PROV record" });
    const second = ProvRdfCodecError.make({ message: "Unsupported PROV record" });
    const different = ProvRdfCodecError.make({ message: "Invalid PROV relation" });

    pipe(same(first, second), assertTrue);
    pipe(same(first, different), assertFalse);
  });
});

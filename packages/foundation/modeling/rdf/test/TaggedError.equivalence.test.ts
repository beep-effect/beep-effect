import { ProvRdfCodecError } from "@beep/rdf/ProvRdf";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("@beep/rdf tagged-error declared equivalence", () => {
  it("compares PROV RDF codec errors by declared message", () => {
    const same = S.toEquivalence(ProvRdfCodecError);
    const first = ProvRdfCodecError.make({ message: "Unsupported PROV record" });
    const second = ProvRdfCodecError.make({ message: "Unsupported PROV record" });
    const different = ProvRdfCodecError.make({ message: "Invalid PROV relation" });

    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  });
});

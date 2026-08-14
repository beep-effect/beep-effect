import { AbsoluteIRI, IRI, IRIReference, RelativeIRIReference } from "@beep/rdf/Iri";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("IRI", () => {
  it("accepts representative internationalized and relative forms through the facade", () => {
    expect(S.decodeSync(IRI)("https://例え.テスト/δοκιμή?q=値#片段")).toBe("https://例え.テスト/δοκιμή?q=値#片段");
    expect(S.decodeSync(AbsoluteIRI)("mailto:用户@example.org")).toBe("mailto:用户@example.org");
    expect(S.decodeSync(IRIReference)("../résumé/δοκιμή?x=値#片段")).toBe("../résumé/δοκιμή?x=値#片段");
    expect(S.decodeSync(RelativeIRIReference)("folder/child:leaf")).toBe("folder/child:leaf");
  });

  it("rejects invalid facade inputs with the RDF schema diagnostics", () => {
    expect(() => S.decodeSync(IRI)("https://example.com/%ZZ")).toThrow("Expected a valid RFC 3987 IRI");
    expect(() => S.decodeSync(AbsoluteIRI)("https://example.com/path#frag")).toThrow(
      "Expected a valid RFC 3987 absolute IRI"
    );
    expect(() => S.decodeSync(RelativeIRIReference)("folder:child/leaf")).toThrow(
      "Expected a valid RFC 3987 relative IRI reference"
    );
  });

  it("only generates RFC 3987 IRI values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(IRI);
  });

  it("only generates RFC 3987 AbsoluteIRI values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(AbsoluteIRI);
  });

  it("only generates RFC 3987 IRIReference values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(IRIReference);
  });

  it("only generates RFC 3987 RelativeIRIReference values that decode to themselves", () => {
    assertSchemaArbitraryDecodesToSelf(RelativeIRIReference);
  });
});

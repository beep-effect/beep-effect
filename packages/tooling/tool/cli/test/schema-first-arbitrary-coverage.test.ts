import { sourceTextHasSchemaArbitraryPropertyCoverage } from "@beep/repo-cli/commands/Lint";
import { describe, expect, it } from "@effect/vitest";

describe("schema-derived property coverage syntax", () => {
  it.each([
    "it.prop([S.String])('round trip', check)",
    "it.effect.prop([S.String])('round trip', check)",
    "it.effect.scoped.prop([S.String])('round trip', check)",
    "fc.property(ModelArbitrary, check)",
    "fc.property(Model.pipe(S.Array, Arbitrary.schema), check)",
    "fc.property(Model.pipe(S.toArbitrary), check)",
    "fc.property([fc.string(), [Arbitrary.schema(Model)]], check)",
    "const derived = Arbitrary.schema(Model); fc.property(derived, check)",
    "fc.property(Arbitrary.schema(Model).map(transform), check)",
    "fc.property(S.toArbitrary(Model)(fc), check)",
  ])("recognizes schema property coverage in %s", (source) => {
    expect(sourceTextHasSchemaArbitraryPropertyCoverage(source)).toBe(true);
  });

  it.each([
    "prop([S.String])",
    "suite.prop([S.String])",
    "factory().prop([S.String])",
    "it.effect.each([S.String])",
    "fc.property(arbitraryModel, check)",
    "fc.property([fc.string(), [42, false]], check)",
    "fc.property(Model.pipe(other.schema), check)",
    "fc.property(Model.pipe(Arbitrary.other), check)",
    "fc.property(Model.pipe(factory().schema), check)",
    "fc.property(Model.pipe(42), check)",
    "fc.property(other.schema(Model), check)",
    "fc.property(S.other(Model), check)",
    "fc.property(factory().schema(Model), check)",
    "fc.property(build(Model), check)",
    "fc.property(ModelArbitraryExtra, check)",
    "const derived = Arbitrary.schema(Model); fc.sample(derived)",
    "const { derived } = helpers; let uninitialized; fc.property(uninitialized, check)",
  ])("rejects non-property or non-schema syntax in %s", (source) => {
    expect(sourceTextHasSchemaArbitraryPropertyCoverage(source)).toBe(false);
  });
});

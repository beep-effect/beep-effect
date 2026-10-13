import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, sample: S.Codec<T, unknown> = schema): void => {
  it.effect.prop(name, [Arbitrary.schema(sample)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { InvalidSpdxLicenseError, licenseExpressionOf, SpdxLicense } from "../../effected/package-json/License.ts";
import * as O from "effect/Option";
const LicenseSample = SpdxLicense.check(S.isPattern(/^(MIT|ISC|Apache-2\.0)( (AND|OR) (MIT|ISC|Apache-2\.0))?$|^UNLICENSED$|^SEE LICENSE IN [a-zA-Z.]{1,16}$/));
describe("License property floor", () => {
  roundTrips("InvalidSpdxLicenseError", InvalidSpdxLicenseError);
  roundTrips("SpdxLicense", SpdxLicense, LicenseSample);
});
it.effect.prop("license expression extraction retains parse/print fidelity and canonical printing is idempotent", [Arbitrary.schema(LicenseSample)], ([license]) => Effect.gen(function* () {
  const expression = licenseExpressionOf(license);
  if (O.isSome(expression)) {
    const text = expression.value.toString();
    const decoded = yield* S.decodeEffect(SpdxLicense)(text);
    const reparsed = licenseExpressionOf(decoded);
    assertSome(reparsed, expression.value);
    if (O.isSome(reparsed)) {
      assert.strictEqual(reparsed.value.toString(), text);
      assert.deepStrictEqual(reparsed.value, expression.value);
    }
  } else {
    assert.isTrue(license === "UNLICENSED" || license.startsWith("SEE LICENSE IN "));
  }
}), runs);

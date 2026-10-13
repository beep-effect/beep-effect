import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidSpdxExpressionError, License } from "../../effected/spdx/License.ts";
import { ACTIVE_LICENSE_IDS, DEPRECATED_LICENSE_ID_LIST } from "../../effected/spdx/internal/licenseIds.ts";

const runs = { arbitrary: fcRuns(100) };

describe("License property floor", () => {
  it.effect.prop("License schema round-trips without decode failure", [Arbitrary.schema(License)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(License)(value);
      const decoded = yield* S.decodeEffect(License)(encoded);
      assertTrue(S.toEquivalence(License)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(License)(decoded), encoded);
      assert.strictEqual(decoded.toString(), value.id);
    }), runs);

  it.effect.prop("InvalidSpdxExpressionError schema round-trips without decode failure", [Arbitrary.schema(InvalidSpdxExpressionError)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(InvalidSpdxExpressionError)(value);
      const decoded = yield* S.decodeEffect(InvalidSpdxExpressionError)(encoded);
      assertTrue(S.toEquivalence(InvalidSpdxExpressionError)(decoded, value));
      assert.strictEqual(decoded.message, `Invalid SPDX expression: "${value.input}"`);
    }), runs);

  it.effect.prop("catalog parsing and display are faithful and idempotent", [Arbitrary.schema(S.Literals([...ACTIVE_LICENSE_IDS, ...DEPRECATED_LICENSE_ID_LIST]))], ([id]) =>
    Effect.gen(function* () {
      const value = yield* License.parse(id);
      const reparsed = yield* License.parse(value.toString());
      assertTrue(S.toEquivalence(License)(reparsed, value));
      assert.strictEqual(reparsed.toString(), value.toString());
      assertSuccess(License.parseResult(value.toString()), value);
    }), runs);
});

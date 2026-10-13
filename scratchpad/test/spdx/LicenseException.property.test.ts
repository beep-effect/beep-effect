import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LicenseException } from "../../effected/spdx/LicenseException.ts";
import { ACTIVE_EXCEPTION_IDS, DEPRECATED_EXCEPTION_ID_LIST } from "../../effected/spdx/internal/exceptions.ts";

const runs = { arbitrary: fcRuns(100) };

describe("LicenseException property floor", () => {
  it.effect.prop("schema round-trips without decode failure", [Arbitrary.schema(LicenseException)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LicenseException)(value);
      const decoded = yield* S.decodeEffect(LicenseException)(encoded);
      assertTrue(S.toEquivalence(LicenseException)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(LicenseException)(decoded), encoded);
      assert.strictEqual(decoded.toString(), value.id);
    }), runs);
  it.effect.prop("catalog parsing and display are faithful and idempotent", [Arbitrary.schema(S.Literals([...ACTIVE_EXCEPTION_IDS, ...DEPRECATED_EXCEPTION_ID_LIST]))], ([id]) =>
    Effect.gen(function* () {
      const value = yield* LicenseException.parse(id);
      const reparsed = yield* LicenseException.parse(value.toString());
      assertTrue(S.toEquivalence(LicenseException)(reparsed, value));
      assert.strictEqual(reparsed.toString(), value.toString());
      assertSuccess(LicenseException.parseResult(value.toString()), value);
    }), runs);
});

import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { AndNode, LicenseNode, LicenseRefNode, SpdxExpression } from "../../effected/spdx/index.ts";

describe("SpdxExpression coverage", () => {
  it.effect("FromString rejects malformed input through the schema failure channel", () => Effect.gen(function* () {
    const failure = yield* Effect.result(S.decodeEffect(SpdxExpression.FromString)("MIT AND"));
    assertFailure(failure, failure.pipe(Result.getFailure, O.getOrThrow));
    assert.strictEqual(failure.failure.message, 'Invalid SPDX expression: "MIT AND"');
  }));
  it.effect("license collection includes valid references and skips directly constructed invalid leaves", () => Effect.gen(function* () {
    const known = LicenseNode.make({ id: "MIT", plus: false });
    const reference = LicenseRefNode.make({ ref: "custom" });
    const invalid = LicenseNode.make({ id: "unknown", plus: false });
    const invalidReference = LicenseRefNode.make({ ref: "" });
    const tree = AndNode.make({
      left: AndNode.make({ left: known, right: reference }),
      right: AndNode.make({ left: invalid, right: invalidReference }),
    });
    assert.deepStrictEqual(SpdxExpression.licensesOf(tree).map((license) => license.id), ["MIT", "LicenseRef-custom"]);
    assertNone(SpdxExpression.primaryLicense(invalid));
    assertNone(SpdxExpression.primaryLicense(invalidReference));
    assert.strictEqual(reference.toString(), "LicenseRef-custom");
    assert.strictEqual(LicenseRefNode.make({ ref: "custom", documentRef: "scope" }).toString(), "DocumentRef-scope:LicenseRef-custom");
  }));
});

import { JwtPayloadFailure, payloadOf, unsignedJwt } from "@beep/github-actions/internal/jwt";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

/** The `payload`-kind failure a token decodes to; any other answer fails the test. */
const payloadFailureOf = (token: string) => {
  const result = payloadOf(token);
  if (Result.isFailure(result) && result.failure.kind === "payload") return result.failure;
  return assert.fail(`expected a payload failure for ${token}`);
};

it.effect("JWT rejects invalid JSON and unencodable fixtures, and supports curried framing", () =>
  Effect.sync(() => {
    const failure = payloadOf(`e30.${Base64Url.encode("{")}.unsigned`);
    assertFailure(
      Result.mapError(failure, (error) => error.kind),
      "payload"
    );
    assertSuccess(payloadOf(unsignedJwt({ sub: "runner" })({ alg: "none" })), { sub: "runner" });
    assert.throws(() => unsignedJwt({}, undefined));
  })
);

it.effect("JWT failure schema preserves conditional causes and plain-object decoding", () =>
  Effect.gen(function* () {
    for (const failure of [
      { kind: "segments", detail: "" },
      { kind: "payload", detail: "codec failure", cause: { code: "invalid" } },
      { kind: "payload", detail: "", cause: undefined },
    ] satisfies ReadonlyArray<typeof JwtPayloadFailure.Encoded>) {
      const decoded = yield* S.decodeEffect(JwtPayloadFailure)(failure);
      assert.deepStrictEqual<unknown>(decoded, failure);
      assert.deepStrictEqual<unknown>(yield* S.encodeEffect(JwtPayloadFailure)(decoded), failure);
    }
    assert.isFalse(S.is(JwtPayloadFailure)({ kind: "payload", detail: "missing cause" }));
    assert.isFalse(S.is(JwtPayloadFailure)({ kind: "other", detail: "invalid kind" }));
    assert.isFalse(S.is(JwtPayloadFailure)({ kind: "segments" }));
    for (const token of ["bad", "e30.%.unsigned", `e30.${Base64Url.encode("{")}.unsigned`]) {
      const result = payloadOf(token);
      assertFailure(Result.mapError(result, S.is(JwtPayloadFailure)), true);
    }
  })
);

it.effect("JWT keeps codec causes and segment/base64url failure classifications", () =>
  Effect.sync(() => {
    for (const token of ["", "one.two", "one..three", "one.two.three.four"]) {
      assertFailure(
        Result.mapError(payloadOf(token), (error) => error.kind),
        "segments"
      );
    }
    const invalidBase64 = payloadFailureOf("e30.%.unsigned");
    assert.deepStrictEqual<unknown>(Result.flip(Base64Url.decodeString("%")), Result.succeed(invalidBase64.cause));
    const invalidJson = payloadFailureOf(`e30.${Base64Url.encode("{")}.unsigned`);
    assert.instanceOf(invalidJson.cause, S.SchemaError);
    assert.strictEqual(invalidJson.detail, "the payload is not base64url JSON");
  })
);

import { assert, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Base64Url from "effect/encoding/Base64Url";
import { payloadOf, unsignedJwt } from "../../../effected/github-actions/internal/jwt.ts";

it.effect("JWT rejects invalid JSON and unencodable fixtures, and supports curried framing", () => Effect.sync(() => {
  const failure = payloadOf(`e30.${Base64Url.encode("{")}.unsigned`);
  assertFailure(Result.mapError(failure, (error) => error.kind), "payload");
  assertSuccess(payloadOf(unsignedJwt({ sub: "runner" })({ alg: "none" })), { sub: "runner" });
  assert.throws(() => unsignedJwt({}, undefined));
}));

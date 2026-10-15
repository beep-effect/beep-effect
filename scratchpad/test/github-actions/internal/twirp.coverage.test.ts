import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { TwirpFailure } from "../../../effected/github-actions/internal/twirp.ts";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { field, stringField, twirpCall, twirpFailureFields, isRetryable } from "../../../effected/github-actions/internal/twirp.ts";
it.effect("Twirp field readers handle absent, primitive, snake-case, and empty values", () => Effect.sync(() => {
  assert.strictEqual(field(null, "uploadUrl"), undefined);
  assert.strictEqual(field({}, "uploadUrl"), undefined);
  assert.strictEqual(field({ upload_url: "snake" }, "uploadUrl"), "snake");
  assert.strictEqual(field({ uploadUrl: "camel", upload_url: "snake" }, "uploadUrl"), "camel");
  assert.strictEqual(field("uploadUrl")({ uploadUrl: null, upload_url: "fallback" }), "fallback");
  assert.strictEqual(stringField("uploadUrl")({ upload_url: "snake" }), "snake");
  assert.strictEqual(stringField({ uploadUrl: "" }, "uploadUrl"), undefined);
  assert.strictEqual(stringField({ uploadUrl: 4 }, "uploadUrl"), undefined);
  assert.deepStrictEqual(twirpFailureFields({ method: "Read", kind: "status" }), { reason: "refused", detail: "Read" });
  assert.deepStrictEqual(twirpFailureFields({ method: "Read", kind: "transport" }), { reason: "unreachable", detail: "Read did not answer with a Twirp body" });
  assert.strictEqual(isRetryable({ method: "Read", kind: "status" }), false);
}));

it.effect("Twirp failure schema preserves optional fields in every structural variant", () => Effect.gen(function* () {
  for (const kind of ["transport", "status", "malformed"] as const) {
    for (const failure of [
      { method: "", kind },
      { method: "Read", kind, status: undefined, cause: undefined },
      { method: "Read", kind, status: 503, cause: { message: "failure" } },
    ] satisfies ReadonlyArray<TwirpFailure>) {
      assert.deepStrictEqual(yield* S.decodeEffect(TwirpFailure)(failure), failure);
      assert.deepStrictEqual(yield* S.encodeEffect(TwirpFailure)(failure), failure);
    }
    for (const status of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "503"]) {
      assert.isFalse(S.is(TwirpFailure)({ method: "Read", kind, status }));
    }
  }
  assert.isFalse(S.is(TwirpFailure)({ method: "Read", kind: "other" }));
  assert.isFalse(S.is(TwirpFailure)({ kind: "status" }));
}));
it.effect("Twirp maps malformed JSON and informational statuses without retry", () => Effect.gen(function* () {
  for (const status of [199, 200]) {
    const http = HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request,
      new Response("{", { status: 200 })
    )).pipe(Effect.map((response) => status === 199 ? { ...response, status } : response)));
    const result = yield* Effect.result(twirpCall({ http, baseUrl: "https://example.test/", service: "Service", method: "Read", token: Redacted.make("test"), body: {} }));
    if (status === 199) {
      assertFailure(result, { method: "Read", kind: "status", status: 199 });
    } else {
      assertFailure(Result.mapError(result, (failure) => ({ kind: failure.kind, method: failure.method })), { kind: "malformed", method: "Read" });
    }
  }
}));

import { assertExitSuccess } from "@effect/vitest/utils";
import * as HttpClientError from "effect/http/HttpClientError";
import * as TestClock from "effect/testing/TestClock";
import { settle } from "../results.ts";
it.effect("a transport failure retries and returns the recovered body", () => Effect.gen(function* () {
  // This test exclusively owns its TestClock and advances only its retry fiber.
  let calls = 0;
  const http = HttpClient.make((request) => Effect.suspend(() => {
    calls += 1;
    return calls === 1
      ? Effect.fail(new HttpClientError.HttpClientError({ reason: new HttpClientError.TransportError({ request, cause: "disconnected" }) }))
      : Effect.succeed(HttpClientResponse.fromWeb(request, new Response('{"recovered":true}')));
  }));
  assert.isTrue(isRetryable({ method: "Read", kind: "transport" }));
  const exit = yield* settle(twirpCall({ http, baseUrl: "https://example.test/", service: "Service", method: "Read", token: Redacted.make("test"), body: {} }), TestClock.adjust("3 seconds"));
  assertExitSuccess(exit, { recovered: true });
  assert.strictEqual(calls, 2);
}));

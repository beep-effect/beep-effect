import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { HttpClient, HttpClientResponse } from "effect/http";
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

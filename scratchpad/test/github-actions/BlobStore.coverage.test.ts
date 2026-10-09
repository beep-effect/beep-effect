import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { BlobStore, BlobStoreError } from "../../effected/github-actions/BlobStore.ts";
import { ActionOutputs } from "../../effected/github-actions/ActionOutputs.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";

const config = {
  bucket: "bucket", region: "us-east-1", accessKeyId: "test",
  secretAccessKey: Redacted.make("fixture"),
};
const s3 = (client: HttpClient.HttpClient) => BlobStore.layerS3(config).pipe(Layer.provide(Layer.mergeAll(
  Layer.succeed(HttpClient.HttpClient)(client), ActionOutputs.layerTest({ setSecret: () => Effect.void })
)));

describe("BlobStore gaps", () => {
  it.effect("error messages preserve each optional diagnostic", () => Effect.sync(() => {
    assert.strictEqual(BlobStoreError.make({ reason: "unreachable" }).message, "The blob store could not be reached");
    assert.strictEqual(BlobStoreError.make({ reason: "unreachable", key: "k" }).message, 'The blob store could not be reached for "k"');
    assert.strictEqual(BlobStoreError.make({ reason: "refused", key: "k" }).message, 'The blob store refused "k"');
    assert.strictEqual(BlobStoreError.make({ reason: "refused", key: "k", status: 403, detail: "denied" }).message, 'The blob store refused "k" with status 403: denied');
    assert.strictEqual(BlobStoreError.make({ reason: "misconfigured" }).message, "The blob store is misconfigured");
    assert.strictEqual(BlobStoreError.make({ reason: "misconfigured", detail: "missing" }).message, "The blob store is misconfigured: missing");
  }));
  it.layer(BlobStore.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed get and put die naming the missing override", () => Effect.gen(function* () {
      const store = yield* BlobStore;
      for (const [name, call] of [
        ["get", store.get("k", S.String)],
        ["put", store.put("k", { metadata: "m", body: new Uint8Array() }, S.String)],
      ] as const) {
        assertExitFailure(yield* Effect.exit(call), Cause.die(UnstubbedMemberError.make({
          message: `BlobStore.makeTest: ${name}() was called but not stubbed — pass a \`${name}\` override.`,
        })));
      }
    }));
  });
  it.layer(s3(HttpClient.make((request) => Effect.fail(new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({ request, cause: "offline" }),
  })))), { timeout: "30 seconds" })((it) => {
    it.effect("transport errors become unreachable and name the requested key", () => Effect.gen(function* () {
      const error = yield* Effect.flip((yield* BlobStore).has("key"));
      assert.strictEqual(error.reason, "unreachable");
      assert.strictEqual(error.key, "key");
    }));
  });
  it.layer(s3(HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, new Response(
    new ReadableStream({ start(controller) { controller.error("body unavailable"); } }), { status: 200 }
  ))))), { timeout: "30 seconds" })((it) => {
    it.effect("body-read errors become unreachable even after a successful response", () => Effect.gen(function* () {
      const error = yield* Effect.flip((yield* BlobStore).get("key", S.String));
      assert.instanceOf(error, BlobStoreError);
      if (S.is(BlobStoreError)(error)) {
        assert.strictEqual(error.reason, "unreachable");
        assert.strictEqual(error.key, "key");
      }
    }));
  });
});

const seen: Array<string> = [];
it.layer(BlobStore.layerS3({ ...config, endpoint: "https://s3.example///" }).pipe(Layer.provide(Layer.mergeAll(
  ActionOutputs.layerTest({ setSecret: () => Effect.void }),
  Layer.succeed(HttpClient.HttpClient)(HttpClient.make((request) => {
    seen.push(request.url);
    return Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 200 })));
  })),
))), { timeout: "30 seconds" })((it) => {
  it.effect("strips every trailing endpoint slash before building the object URL", () => Effect.gen(function* () {
    assert.isTrue(yield* (yield* BlobStore).has("key"));
    assert.deepStrictEqual(seen, ["https://s3.example/bucket/key"]);
  }));
});

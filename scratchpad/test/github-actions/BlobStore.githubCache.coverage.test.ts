import { toCompatResponse } from "@azure/core-http-compat";
import { createHttpHeaders, createPipelineRequest } from "@azure/core-rest-pipeline";
import { BlobClient, BlockBlobClient } from "@azure/storage-blob";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FetchHttpClient } from "effect/http";
import { BlobEnvelope } from "../../effected/github-actions/BlobEnvelope.ts";
import { BlobStore, BlobStoreError } from "../../effected/github-actions/BlobStore.ts";
import { GitHubCacheBlobStore } from "../../effected/github-actions/BlobStore.githubCache.ts";
import { json, resultsEnv, twirpFetch } from "./results.ts";

const { fetch, calls } = twirpFetch({
  CreateCacheEntry: () => json({ ok: true, signed_upload_url: "https://blob.example/upload" }),
  FinalizeCacheEntryUpload: () => json({ ok: true, entry_id: "1" }),
  GetCacheEntryDownloadURL: () => json({ ok: true, signed_download_url: "https://blob.example/download", matched_key: "key" }),
});
const layer = GitHubCacheBlobStore.layer.pipe(Layer.provide(Layer.mergeAll(
  resultsEnv(),
  FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch)))
)));

describe("Azure cache transport", () => {
  it.layer(layer, { timeout: "30 seconds" })((it) => {
    it.effect("uploads the envelope and downloads only the returned buffer slice", () => Effect.gen(function* () {
      const frame = Result.getOrThrow(BlobEnvelope.encodeResult("metadata", new Uint8Array([7, 8]), S.String));
      const padded = Buffer.concat([Buffer.from([99]), Buffer.from(frame), Buffer.from([98])]);
      const upload = vi.spyOn(BlockBlobClient.prototype, "uploadData").mockResolvedValue({ _response: toCompatResponse({ request: createPipelineRequest({ url: "https://blob.example/upload" }), status: 201, headers: createHttpHeaders() }) });
      const download = vi.spyOn(BlobClient.prototype, "downloadToBuffer").mockResolvedValue(padded.subarray(1, padded.length - 1));
      yield* Effect.gen(function* () {
        const store = yield* BlobStore;
        yield* store.put("key", { metadata: "metadata", body: new Uint8Array([7, 8]) }, S.String);
        assert.deepStrictEqual(upload.mock.calls[0]?.[0], frame);
        assertSome(yield* store.get("key", S.String), { metadata: "metadata", body: new Uint8Array([7, 8]) });
        assert.isTrue(calls.some((call) => call.method === "FinalizeCacheEntryUpload"));
      }).pipe(Effect.ensuring(Effect.sync(() => { upload.mockRestore(); download.mockRestore(); })));
    }));
    it.effect("maps both Azure rejections to keyed unreachable errors", () => Effect.gen(function* () {
      const upload = vi.spyOn(BlockBlobClient.prototype, "uploadData").mockRejectedValue("upload unavailable");
      const download = vi.spyOn(BlobClient.prototype, "downloadToBuffer").mockRejectedValue("download unavailable");
      yield* Effect.gen(function* () {
        const store = yield* BlobStore;
        const putError = yield* Effect.flip(store.put("key", { metadata: "m", body: new Uint8Array() }, S.String));
        const getError = yield* Effect.flip(store.get("key", S.String));
        for (const error of [putError, getError]) {
          assert.instanceOf(error, BlobStoreError);
          assert.strictEqual(error.key, "key");
          assert.strictEqual(error.reason, "unreachable");
        }
      }).pipe(Effect.ensuring(Effect.sync(() => { upload.mockRestore(); download.mockRestore(); })));
    }));
  });
});

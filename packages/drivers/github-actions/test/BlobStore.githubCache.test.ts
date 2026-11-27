import { BlobStore, BlobStoreError, BlobTransferError, GitHubCacheBlobStore } from "@beep/github-actions";
import { assert, describe, it } from "@effect/vitest";
import { assertExitSuccess, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { json, resultsEnv, settle, twirpFetch } from "./support/results.ts";
import type { DataBlobTransfer } from "@beep/github-actions";

class AlternateBlobStore extends Context.Service<AlternateBlobStore, Context.Service.Shape<typeof BlobStore>>()(
  "@beep/github-actions/test/BlobStore.githubCache.test/AlternateBlobStore"
) {}

class Meta extends S.Class<Meta, { readonly brand: unique symbol }>("Meta")({ tag: S.String, durationMs: S.Finite }) {}

const memoryTransfer = () => {
  const blobs = MutableHashMap.empty<string, Uint8Array>();
  const transfer: DataBlobTransfer = {
    uploadData: dual(2, (url: string, data: Uint8Array) =>
      Effect.sync(() => {
        MutableHashMap.set(blobs, url, data);
      })
    ),
    downloadToBuffer: (url) =>
      Effect.suspend(() => {
        const found = O.getOrUndefined(MutableHashMap.get(blobs, url));
        return found === undefined
          ? Effect.fail(BlobTransferError.make({ reason: "downloadFailed" }))
          : Effect.succeed(found);
      }),
  };
  return { blobs, transfer };
};

const store = (
  fetch: typeof globalThis.fetch,
  transfer: DataBlobTransfer,
  env: Layer.Layer<never> | ReturnType<typeof resultsEnv> = resultsEnv()
) =>
  GitHubCacheBlobStore.layerWith(transfer).pipe(
    Layer.provide(
      Layer.mergeAll(env, FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fetch))))
    )
  );

describe("GitHubCacheBlobStore", () => {
  {
    const { fetch } = twirpFetch({});
    it.layer(store(fetch, memoryTransfer().transfer, resultsEnv({ ACTIONS_RESULTS_URL: "" })), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("names the missing variable rather than failing anonymously", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(Effect.flatMap(BlobStore, (blobs) => blobs.has("k")));
          assert.instanceOf(error, BlobStoreError);
          assert.strictEqual(error.reason, "misconfigured");
          assert.include(
            error.message,
            "ACTIONS_RESULTS_URL",
            "the backend reaches uses: steps, not run: steps, and nothing else differs; the error names the variable"
          );
        })
      );
    });
  }

  {
    const { blobs, transfer } = memoryTransfer();

    const { calls, fetch } = twirpFetch({
      CreateCacheEntry: () => json({ ok: true, signed_upload_url: "https://blob.example/upload?sig=abc" }),
      FinalizeCacheEntryUpload: () => json({ ok: true, entry_id: "1" }),
    });
    it.layer(store(fetch, transfer), { timeout: "30 seconds" })((it) => {
      it.effect("puts through create → upload → finalize, at the url the RPC handed back", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(BlobStore, (blobStore) =>
            blobStore.put(
              "build/1",
              { metadata: Meta.make({ tag: "x", durationMs: 12 }), body: new Uint8Array([1, 2, 3]) },
              Meta
            )
          );

          assert.deepStrictEqual(
            A.map(calls, (call) => call.method),
            ["CreateCacheEntry", "FinalizeCacheEntryUpload"]
          );
          const uploaded = O.getOrUndefined(MutableHashMap.get(blobs, "https://blob.example/upload?sig=abc"));
          assert.isDefined(uploaded, "the upload goes to the url the backend signed, not one this package composed");
          assert.strictEqual(
            calls[1]?.body.size_bytes,
            String(uploaded?.byteLength),
            "the finalized size is the framed size; the body length makes an entry the backend serves truncated"
          );
          assert.isAbove(uploaded?.byteLength ?? 0, 3);
        })
      );
    });
  }

  {
    const { calls, fetch } = twirpFetch({});
    it.layer(store(fetch, memoryTransfer().transfer, resultsEnv({ ACTIONS_RUNTIME_TOKEN: "" })), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("a missing runtime token is named too, and no request is made", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(Effect.flatMap(BlobStore, (blobs) => blobs.has("k")));
          assert.include(error.message, "ACTIONS_RUNTIME_TOKEN");
          assert.lengthOf(calls, 0);
        })
      );
    });
  }

  {
    const { calls, fetch } = twirpFetch({
      GetCacheEntryDownloadURL: () => json({ ok: false }),
    });
    it.layer(store(fetch, memoryTransfer().transfer), { timeout: "30 seconds" })((it) => {
      it.effect("appends the trailing slash the Twirp path needs and sends the token as a bearer", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(BlobStore, (blobs) => blobs.has("k"));
          assert.strictEqual(
            calls[0]?.url,
            "https://results.example/twirpbase/twirp/github.actions.results.api.v1.CacheService/GetCacheEntryDownloadURL",
            "the fixture URL has no trailing slash; unjoined, the path is …/twirpbasetwirp/… and every RPC 404s"
          );
          assert.include(calls[0]?.authorization ?? "", "Bearer ");
        })
      );
    });
  }

  {
    const { transfer } = memoryTransfer();

    const url = "https://blob.example/one?sig=abc";

    const { fetch } = twirpFetch({
      CreateCacheEntry: () => json({ ok: true, signedUploadUrl: url }),
      FinalizeCacheEntryUpload: () => json({ ok: true }),
      GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: url }),
    });
    it.layer(store(fetch, transfer), { timeout: "30 seconds" })((it) => {
      it.effect("round-trips metadata and body through the real envelope framing", () =>
        Effect.gen(function* () {
          const blobStore = yield* BlobStore;

          yield* blobStore.put(
            "k",
            { metadata: Meta.make({ tag: "turbo", durationMs: 4200 }), body: new Uint8Array([7, 8]) },
            Meta
          );

          const found = yield* blobStore.get("k", Meta);

          assertSome(found, {
            metadata: Meta.make({ tag: "turbo", durationMs: 4200 }),
            body: new Uint8Array([7, 8]),
          });

          assert.deepStrictEqual(found.value.metadata, Meta.make({ tag: "turbo", durationMs: 4200 }));

          assert.deepStrictEqual([...found.value.body], [7, 8]);
        })
      );
    });
  }

  {
    const { transfer, blobs } = memoryTransfer();

    const { fetch } = twirpFetch({
      GetCacheEntryDownloadURL: () => json({ ok: true, signed_download_url: "https://blob.example/snake" }),
    });
    it.layer(store(fetch, transfer), { timeout: "30 seconds" })((it) => {
      it.effect("reads both the camelCase and the snake_case spelling of a signed url", () =>
        Effect.gen(function* () {
          MutableHashMap.set(blobs, "https://blob.example/snake", new Uint8Array([1]));
          const flatMap1 = yield* Effect.flatMap(BlobStore, (blobStore) => blobStore.has("k"));
          assert.isTrue(
            flatMap1,
            "the backend's two halves disagree on spelling; reading one shows only as a cache that never hits"
          );
        })
      );
    });
  }

  {
    const { blobs, transfer } = memoryTransfer();

    const { calls, fetch } = twirpFetch({ CreateCacheEntry: () => new Response(null, { status: 409 }) });
    it.layer(store(fetch, transfer), { timeout: "30 seconds" })((it) => {
      it.effect("treats a create conflict as a write that already happened", () =>
        Effect.gen(function* () {
          yield* Effect.flatMap(BlobStore, (blobStore) =>
            blobStore.put("k", { metadata: Meta.make({ tag: "x", durationMs: 1 }), body: new Uint8Array([1]) }, Meta)
          );
          assert.strictEqual(
            MutableHashMap.size(blobs),
            0,
            "two jobs race on an immutable entry, so the loser got what it asked for and must not upload"
          );
          assert.lengthOf(calls, 1, "and must not finalize either");
        })
      );
    });
  }

  {
    const { fetch } = twirpFetch({ CreateCacheEntry: () => json({ ok: true }) });
    it.layer(store(fetch, memoryTransfer().transfer), { timeout: "30 seconds" })((it) => {
      it.effect("fails typed when the create returns no upload url", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Effect.flatMap(BlobStore, (blobStore) =>
              blobStore.put("k", { metadata: Meta.make({ tag: "x", durationMs: 1 }), body: new Uint8Array([1]) }, Meta)
            )
          );
          assert.strictEqual(error._tag, "BlobStoreError");
          assert.include(error.message, "CreateCacheEntry");
        })
      );
    });
  }

  {
    const { blobs, transfer } = memoryTransfer();

    const { fetch } = twirpFetch({
      CreateCacheEntry: () => json({ ok: true, signedUploadUrl: "https://blob.example/x" }),
      FinalizeCacheEntryUpload: () => json({ ok: false }),
    });
    it.layer(store(fetch, transfer), { timeout: "30 seconds" })((it) => {
      it.effect("fails when the upload is never finalized, even though every byte arrived", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Effect.flatMap(BlobStore, (blobStore) =>
              blobStore.put("k", { metadata: Meta.make({ tag: "x", durationMs: 1 }), body: new Uint8Array([1]) }, Meta)
            )
          );
          assert.strictEqual(MutableHashMap.size(blobs), 1);
          assert.include(
            error.message,
            "FinalizeCacheEntryUpload",
            "bytes in Azure no lookup can find are worse than no write: the caller believes the entry exists"
          );
        })
      );
    });
  }

  {
    const miss = twirpFetch({ GetCacheEntryDownloadURL: () => json({ ok: false }) });

    const present = twirpFetch({
      GetCacheEntryDownloadURL: () => json({ ok: true, signedDownloadUrl: "https://blob.example/gone" }),
    });
    it.layer(
      Layer.mergeAll(
        store(miss.fetch, memoryTransfer().transfer),
        Layer.effect(AlternateBlobStore, BlobStore).pipe(
          Layer.provide(Layer.fresh(store(present.fetch, memoryTransfer().transfer)))
        )
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("reports a miss as nothing, and a transport failure as a failure", () =>
        Effect.gen(function* () {
          const flatMap2 = yield* Effect.flatMap(BlobStore, (blobStore) => blobStore.get("absent", Meta));
          assertNone(flatMap2);
          const error = yield* Effect.flip(Effect.flatMap(AlternateBlobStore, (blobStore) => blobStore.get("k", Meta)));
          assert.strictEqual(
            error._tag,
            "BlobStoreError",
            "the url resolved but the bytes did not arrive; a miss would silently discard a cache the runner has"
          );
        })
      );
    });
  }

  describe("the retry policy", () => {
    {
      const { calls, fetch } = twirpFetch({
        GetCacheEntryDownloadURL: (_body, index) =>
          index === 0 ? new Response(null, { status: 503 }) : json({ ok: false }),
      });
      it.layer(store(fetch, memoryTransfer().transfer), { timeout: "30 seconds" })((it) => {
        it.effect("retries a 503 and succeeds", () =>
          Effect.gen(function* () {
            const blobStore = yield* BlobStore;
            const exit = yield* settle(blobStore.has("k"), TestClock.adjust("10 seconds"));
            assertExitSuccess(exit, false);
            assert.lengthOf(
              calls,
              2,
              "a 503 is the backend saying `later`; this single-test layer owns the TestClock it advances"
            );
          })
        );
      });
    }

    {
      const { calls, fetch } = twirpFetch({ GetCacheEntryDownloadURL: () => new Response(null, { status: 400 }) });
      it.layer(store(fetch, memoryTransfer().transfer), { timeout: "30 seconds" })((it) => {
        it.effect("does not retry a 400", () =>
          Effect.gen(function* () {
            const error = yield* Effect.flip(Effect.flatMap(BlobStore, (blobStore) => blobStore.has("k")));
            assert.lengthOf(
              calls,
              1,
              "no clock is advanced, so finishing at all proves a 400 is not retried four times"
            );
            assert.strictEqual(error.reason === "refused" ? error.status : undefined, 400);
          })
        );
      });
    }
  });
});

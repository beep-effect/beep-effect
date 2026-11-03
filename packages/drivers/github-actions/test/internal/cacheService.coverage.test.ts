import { CacheHit, finalizeUpload, lookupDownload, reserveUpload } from "@beep/github-actions/internal/cacheService";
import { CONFLICT } from "@beep/github-actions/internal/twirp";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { CacheServiceClient } from "@beep/github-actions/internal/cacheService";

it.effect("cache RPCs reject absent upload URLs and unconfirmed finalization and preserve lookup keys", () =>
  Effect.gen(function* () {
    const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
    const client = (response: unknown): CacheServiceClient<string> => ({
      call: dual(2, (method: string, body: Record<string, unknown>) => {
        calls.push({ method, body });
        return Effect.succeed(response);
      }),
      refused: (detail) => detail,
    });
    const result1 = yield* Effect.result(reserveUpload(client({ ok: true }), "key", "version"));
    assertFailure(result1, "CreateCacheEntry returned no upload url");
    const value = yield* reserveUpload("key", "version")(client({ ok: true, signedUploadUrl: "https://upload" }));
    assertSome(value, "https://upload");
    const reserveUpload2 = yield* reserveUpload(client(CONFLICT), "key", "version");
    assertNone(reserveUpload2);
    for (const response of [CONFLICT, { ok: false }]) {
      const result2 = yield* Effect.result(finalizeUpload("key", "version", 12n)(client(response)));
      assertFailure(result2, "FinalizeCacheEntryUpload did not confirm the upload");
    }
    yield* finalizeUpload(client({ ok: true }), "key", "version", 12);
    assert.deepStrictEqual(calls[calls.length - 1], {
      method: "FinalizeCacheEntryUpload",
      body: { key: "key", version: "version", size_bytes: "12" },
    });
    const lookupDownload3 = yield* lookupDownload(client(CONFLICT), "key", [], "version");
    assertNone(lookupDownload3);
    const lookupDownload4 = yield* lookupDownload(client({ ok: false }), "key", [], "version");
    assertNone(lookupDownload4);
    const lookupDownload5 = yield* lookupDownload(client({ ok: true }), "key", [], "version");
    assertNone(lookupDownload5);
    const value6 = yield* lookupDownload(
      "key",
      ["fallback"],
      "version"
    )(client({ ok: true, signedDownloadUrl: "https://download", matchedKey: "fallback" }));
    assertSome(value6, CacheHit.make({ url: "https://download", matchedKey: "fallback" }));
  })
);

it.effect("cache hit schema requires matchedKey while accepting explicit undefined", () =>
  Effect.gen(function* () {
    for (const matchedKey of ["fallback", undefined]) {
      const hit = { url: "", matchedKey } satisfies CacheHit.Encoded;
      const value7 = yield* S.decodeEffect(CacheHit)(hit);
      assert.deepStrictEqual(value7, hit);
      const value8 = yield* S.encodeEffect(CacheHit)(CacheHit.make(hit));
      assert.deepStrictEqual(value8, hit);
    }
    assert.isFalse(S.is(CacheHit)({ url: "https://download" }));
    assert.isFalse(S.is(CacheHit)({ url: "https://download", matchedKey: 1 }));
    assert.isFalse(S.is(CacheHit)({ url: 1, matchedKey: undefined }));
  })
);

it.effect("upload outcome matching constructs refusal only for rejected responses", () =>
  Effect.gen(function* () {
    let refusals = 0;
    const client = (response: unknown): CacheServiceClient<string> => ({
      call: dual(2, (_method: string, _body: Record<string, unknown>) => Effect.succeed(response)),
      refused: (detail) => {
        refusals += 1;
        return detail;
      },
    });
    const reserveUpload9 = yield* reserveUpload(client(CONFLICT), "key", "version");
    assertNone(reserveUpload9);
    const reserveUpload10 = yield* reserveUpload(
      client({ ok: true, signedUploadUrl: "https://upload" }),
      "key",
      "version"
    );
    assertSome(reserveUpload10, "https://upload");
    yield* finalizeUpload(client({ ok: true }), "key", "version", 0);
    assert.strictEqual(refusals, 0);
    for (const response of [
      { ok: false, signedUploadUrl: "https://upload" },
      { ok: true, signedUploadUrl: "" },
    ]) {
      const result11 = yield* Effect.result(reserveUpload(client(response), "key", "version"));
      assertFailure(result11, "CreateCacheEntry returned no upload url");
    }
    const result12 = yield* Effect.result(finalizeUpload(client(CONFLICT), "key", "version", 0));
    assertFailure(result12, "FinalizeCacheEntryUpload did not confirm the upload");
    assert.strictEqual(refusals, 3);
    const lookupDownload13 = yield* lookupDownload(
      client({ ok: true, signedDownloadUrl: "https://download" }),
      "key",
      [],
      "version"
    );
    assertSome(lookupDownload13, CacheHit.make({ url: "https://download", matchedKey: undefined }));
  })
);

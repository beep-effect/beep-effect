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
    assertFailure(
      yield* Effect.result(reserveUpload(client({ ok: true }), "key", "version")),
      "CreateCacheEntry returned no upload url"
    );
    assertSome(
      yield* reserveUpload("key", "version")(client({ ok: true, signedUploadUrl: "https://upload" })),
      "https://upload"
    );
    assertNone(yield* reserveUpload(client(CONFLICT), "key", "version"));
    for (const response of [CONFLICT, { ok: false }])
      assertFailure(
        yield* Effect.result(finalizeUpload("key", "version", 12n)(client(response))),
        "FinalizeCacheEntryUpload did not confirm the upload"
      );
    yield* finalizeUpload(client({ ok: true }), "key", "version", 12);
    assert.deepStrictEqual(calls[calls.length - 1], {
      method: "FinalizeCacheEntryUpload",
      body: { key: "key", version: "version", size_bytes: "12" },
    });
    assertNone(yield* lookupDownload(client(CONFLICT), "key", [], "version"));
    assertNone(yield* lookupDownload(client({ ok: false }), "key", [], "version"));
    assertNone(yield* lookupDownload(client({ ok: true }), "key", [], "version"));
    assertSome(
      yield* lookupDownload(
        "key",
        ["fallback"],
        "version"
      )(client({ ok: true, signedDownloadUrl: "https://download", matchedKey: "fallback" })),
      CacheHit.make({ url: "https://download", matchedKey: "fallback" })
    );
  })
);

it.effect("cache hit schema requires matchedKey while accepting explicit undefined", () =>
  Effect.gen(function* () {
    for (const matchedKey of ["fallback", undefined]) {
      const hit = { url: "", matchedKey } satisfies CacheHit.Encoded;
      assert.deepStrictEqual(yield* S.decodeEffect(CacheHit)(hit), hit);
      assert.deepStrictEqual(yield* S.encodeEffect(CacheHit)(CacheHit.make(hit)), hit);
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
    assertNone(yield* reserveUpload(client(CONFLICT), "key", "version"));
    assertSome(
      yield* reserveUpload(client({ ok: true, signedUploadUrl: "https://upload" }), "key", "version"),
      "https://upload"
    );
    yield* finalizeUpload(client({ ok: true }), "key", "version", 0);
    assert.strictEqual(refusals, 0);
    for (const response of [
      { ok: false, signedUploadUrl: "https://upload" },
      { ok: true, signedUploadUrl: "" },
    ]) {
      assertFailure(
        yield* Effect.result(reserveUpload(client(response), "key", "version")),
        "CreateCacheEntry returned no upload url"
      );
    }
    assertFailure(
      yield* Effect.result(finalizeUpload(client(CONFLICT), "key", "version", 0)),
      "FinalizeCacheEntryUpload did not confirm the upload"
    );
    assert.strictEqual(refusals, 3);
    assertSome(
      yield* lookupDownload(client({ ok: true, signedDownloadUrl: "https://download" }), "key", [], "version"),
      CacheHit.make({ url: "https://download", matchedKey: undefined })
    );
  })
);

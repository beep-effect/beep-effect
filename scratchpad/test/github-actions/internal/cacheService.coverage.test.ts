import { assert, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import {
  reserveUpload,
  finalizeUpload,
  lookupDownload,
  type CacheServiceClient,
} from "../../../effected/github-actions/internal/cacheService.ts";
import { CONFLICT } from "../../../effected/github-actions/internal/twirp.ts";
it.effect("cache RPCs reject absent upload URLs and unconfirmed finalization and preserve lookup keys", () =>
  Effect.gen(function* () {
    const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
    const client = (response: unknown): CacheServiceClient<string> => ({
      call: (method, body) => {
        calls.push({ method, body });
        return Effect.succeed(response);
      },
      refused: (detail) => detail,
    });
    assertFailure(
      yield* Effect.result(reserveUpload(client({ ok: true }), "key", "version")),
      "CreateCacheEntry returned no upload url",
    );
    assertSome(
      yield* reserveUpload("key", "version")(client({ ok: true, signedUploadUrl: "https://upload" })),
      "https://upload",
    );
    assertNone(yield* reserveUpload(client(CONFLICT), "key", "version"));
    for (const response of [CONFLICT, { ok: false }])
      assertFailure(
        yield* Effect.result(finalizeUpload("key", "version", 12n)(client(response))),
        "FinalizeCacheEntryUpload did not confirm the upload",
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
        "version",
      )(client({ ok: true, signedDownloadUrl: "https://download", matchedKey: "fallback" })),
      { url: "https://download", matchedKey: "fallback" },
    );
  }),
);

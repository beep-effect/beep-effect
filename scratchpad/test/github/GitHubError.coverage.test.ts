import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { GitHubError, readRateLimitHeaders } from "../../effected/github/GitHubError.ts";

describe("GitHubError coverage", () => {
  it.effect("classifies ordinary client errors as permanent rejections and retains their status and reason", () => Effect.sync(() => {
    for (const status of [400, 418]) {
      const error = GitHubError.fromOctokit("read", { status, message: "Refused" }, 0);
      assert.strictEqual(error.kind, "rejected");
      assert.strictEqual(error.status, status);
      assert.strictEqual(error.reason, "Refused");
      assert.strictEqual(error.retryable, false);
    }
  }));
  it.effect("rejects a partial rate-limit snapshot even when remaining and limit are valid", () => Effect.sync(() => {
    assert.strictEqual(readRateLimitHeaders({ "x-ratelimit-remaining": "1", "x-ratelimit-limit": "60" }), undefined);
    assert.strictEqual(readRateLimitHeaders({ "x-ratelimit-remaining": "1", "x-ratelimit-limit": "60", "x-ratelimit-reset": "not-a-number" }), undefined);
  }));
  it.effect("uses structural fallback reasons and ignores a validation entry without duplicate prose", () => Effect.sync(() => {
    const error = GitHubError.fromOctokit("update", { status: 409, response: { data: { errors: [{ code: "invalid" }, { message: "Not a fast forward" }] } } }, 0);
    assert.strictEqual(error.reason, "[object Object]");
    assert.strictEqual(error.kind, "rejected");
    assert.strictEqual(error.validation?.length, 2);
    assert.strictEqual(error.message, "update failed (409): [object Object]");
  }));
});

import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { SemVer } from "../../effected/semver/SemVer.ts";
import { Range } from "../../effected/semver/Range.ts";
import { VersionCache, VersionNotFoundError, UnsatisfiedRangeError } from "../../effected/semver/VersionCache.ts";

describe("VersionCache coverage boundaries", () => {
  it.layer(VersionCache.layer, { timeout: "10 seconds" })("cache", (it) => {
    it.effect("missing neighbors fail, absent removal preserves state and singular errors stay grammatical", () => Effect.gen(function* () {
      const cache = yield* VersionCache;
      const v = SemVer.of(1, 0, 0);
      const missing = SemVer.of(0, 0, 0);
      yield* cache.load([v]);
      assertFailure(yield* Effect.result(cache.next(missing)), VersionNotFoundError.make({ version: missing }));
      assertFailure(yield* Effect.result(cache.prev(missing)), VersionNotFoundError.make({ version: missing }));
      assertFailure(yield* Effect.result(cache.diff(missing, v)), VersionNotFoundError.make({ version: missing }));
      yield* cache.remove(missing);
      assert.deepStrictEqual(yield* cache.versions, [v]);
      const range = yield* Range.parse(">2.0.0");
      assert.strictEqual(UnsatisfiedRangeError.make({ range, available: [] }).message, "No version satisfies range >2.0.0 (0 versions available)");
      assert.strictEqual(UnsatisfiedRangeError.make({ range, available: [v] }).message, "No version satisfies range >2.0.0 (1 version available)");
    }));
  });
});

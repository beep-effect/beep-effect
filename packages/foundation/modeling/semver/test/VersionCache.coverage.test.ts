import { Range } from "@beep/semver/Range";
import { SemVer } from "@beep/semver/SemVer";
import { UnsatisfiedRangeError, VersionCache, VersionNotFoundError } from "@beep/semver/VersionCache";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";

describe("VersionCache coverage boundaries", () => {
  it.layer(VersionCache.layer, { timeout: "10 seconds" })("cache", (it) => {
    it.effect("missing neighbors fail, absent removal preserves state and singular errors stay grammatical", () =>
      Effect.gen(function* () {
        const cache = yield* VersionCache;
        const v = SemVer.of(1, 0, 0);
        const missing = SemVer.of(0, 0, 0);
        yield* cache.load([v]);
        const result1 = yield* Effect.result(cache.next(missing));
        assertFailure(result1, VersionNotFoundError.make({ version: missing }));
        const result2 = yield* Effect.result(cache.prev(missing));
        assertFailure(result2, VersionNotFoundError.make({ version: missing }));
        const result3 = yield* Effect.result(cache.diff(missing, v));
        assertFailure(result3, VersionNotFoundError.make({ version: missing }));
        yield* cache.remove(missing);
        const versions4 = yield* cache.versions;
        assert.deepStrictEqual(versions4, [v]);
        const range = yield* Range.parse(">2.0.0");
        assert.strictEqual(
          UnsatisfiedRangeError.make({ range, available: [] }).message,
          "No version satisfies range >2.0.0 (0 versions available)"
        );
        assert.strictEqual(
          UnsatisfiedRangeError.make({ range, available: [v] }).message,
          "No version satisfies range >2.0.0 (1 version available)"
        );
      })
    );
  });
});

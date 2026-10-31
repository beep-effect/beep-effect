import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { Minimatch } from "@beep/glob/internal/minimatch";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { legacyOracle } from "./legacyOracle.ts";

describe("independent legacy oracle coverage", () => {
  it("retains every captured reference group", () => {
    assert.strictEqual(legacyOracle.fragments.length, 5403);
    assert.strictEqual(legacyOracle.matches.length, 2043);
    assert.strictEqual(legacyOracle.optimizer.length, 108);
    assert.strictEqual(legacyOracle.patterns.length, 2541);
    assert.strictEqual(legacyOracle.regexps.length, 495);
    assert.strictEqual(legacyOracle.samples.length, 8000);
  });

  for (const suite of ["compliance-default", "compliance-options", "minimatch-property"]) {
    it.effect(`executes every recorded ${suite} input and upstream outcome`, () =>
      Effect.sync(() => {
        const rows = A.filter(legacyOracle.samples, ([name]) => name === suite);
        assert.strictEqual(rows.length, 2000);
        for (const [, pattern, candidate, options, expected] of rows)
          assert.strictEqual(new Minimatch(pattern, options).match(candidate), expected, `${pattern} vs ${candidate}`);
      })
    );
  }

  it.effect("executes every recorded public-facade case through both compilation APIs", () =>
    Effect.gen(function* () {
      const rows = A.filter(legacyOracle.samples, ([name]) => name === "public-facade");
      assert.strictEqual(rows.length, 2000);
      yield* Effect.forEach(
        rows,
        ([, pattern, candidate, options, expected]) =>
          Effect.gen(function* () {
            const decoded = GlobPatternOptions.make(options);
            const sync = GlobPattern.compileResult(pattern, decoded);
            assertSuccess(sync, Result.getOrThrow(sync));
            const compiled = yield* GlobPattern.compile(pattern, decoded);
            assert.strictEqual(sync.success.matches(candidate), expected, `${pattern} vs ${candidate}`);
            assert.strictEqual(compiled.matches(candidate), expected, `${pattern} vs ${candidate}`);
          }),
        { concurrency: 1, discard: true }
      );
    })
  );
});

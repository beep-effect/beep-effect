import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import { GlobPattern, GlobPatternError, GlobPatternOptions } from "../../effected/glob/GlobPattern.ts";
import { InvalidPattern } from "../../effected/glob/internal/assertValidPattern.ts";
import { Minimatch } from "../../effected/glob/internal/minimatch.ts";

describe("GlobPattern remaining branches", () => {
  it.effect("short diagnostics preserve the complete quoted source", () => Effect.sync(() => {
    assert.strictEqual(GlobPatternError.make({ pattern: "a\"b", reason: "PatternTooLong", limit: 2, actual: 3 }).message,
      'glob pattern "a\\"b" rejected: PatternTooLong (limit 2, actual 3)');
  }));

  it.effect("comment patterns have no enumeration prefix or matches", () => Effect.gen(function* () {
    const pattern = yield* GlobPattern.compile("#comment");
    assert.strictEqual(pattern.enumerationPrefix, "");
    assert.strictEqual(pattern.crossesSegments, false);
    assert.strictEqual(pattern.matches("#comment"), false);
  }));

  it.effect("explicit false options survive forwarding and retain ordinary matching", () => Effect.gen(function* () {
    const options = GlobPatternOptions.make({
      nobrace: false, nocomment: false, nonegate: false, noglobstar: false,
      noext: false, dot: false, nocase: false, nocaseMagicOnly: false,
      magicalBraces: false, matchBase: false, flipNegate: false, partial: false,
      preserveMultipleSlashes: false, windowsPathsNoEscape: false,
      windowsNoMagicRoot: false, optimizationLevel: 1, platform: "posix",
      braceExpandMax: 100, maxGlobstarRecursion: 100, maxExtglobRecursion: 100,
    });
    const pattern = yield* GlobPattern.compile("src/{a,b}/**/*.ts", options);
    assert.strictEqual(pattern.matches("src/a/lib/file.ts"), true);
    assert.strictEqual(pattern.matches("src/a/.hidden.ts"), false);
    assert.strictEqual(pattern.matches("elsewhere/file.ts"), false);
    assert.strictEqual(pattern.enumerationPrefix, "src/");
    assert.strictEqual(pattern.crossesSegments, true);
    assert.strictEqual(GlobPattern.unescape(GlobPattern.escape("a*b", options), options), "a*b");
  }));

  it.effect("schema construction propagates an unexpected engine programmer defect", () => Effect.gen(function* () {
    const defect = InvalidPattern.make({ message: "engine wiring defect" });
    const spy = vi.spyOn(Minimatch.prototype, "make").mockImplementationOnce(() => { throw defect; });
    try {
      assertExitFailure(yield* Effect.exit(Effect.sync(() => GlobPattern.make({ source: "valid" }))), Cause.die(defect));
    } finally {
      spy.mockRestore();
    }
  }));

  it.effect("compileResult propagates programmer defects rather than labelling them guard failures", () => Effect.gen(function* () {
    const defect = InvalidPattern.make({ message: "engine wiring defect" });
    const spy = vi.spyOn(Minimatch.prototype, "make").mockImplementationOnce(() => { throw defect; });
    try {
      assertExitFailure(yield* Effect.exit(Effect.sync(() => GlobPattern.compileResult("valid"))), Cause.die(defect));
    } finally {
      spy.mockRestore();
    }
  }));
});

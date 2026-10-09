import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Minimatch as Oracle } from "minimatch";
import { Minimatch, GLOBSTAR, type EngineOptions } from "../../../effected/glob/internal/minimatch.ts";

const patterns = ["*", "*.*", ".*", "*.TS", "?", "??", "?.TS", "??.ts", "[ab]", "@(a|b)", "a", "a/b", "**", "**/a", "a/**", "a/**/b", "**/a/**/b/**", "a/**/b/**/c", "**/**", "{a,b}", "!a", "", "#comment", "a/../b", "./.", "./", "a/**/../b/c", "//?/C:/a/*", "//server/share/*", "C:/a/*", "//s*/share/*", "//server/s*/a", "//?/foo/a"];
const candidates = ["", ".", "..", ".a", ".a.TS", "a", "b", "a.TS", "b.ts", "ab.ts", "ABC.TS", "a.b", "a/b", "a/b/", "a/b/c", "a/x/b/y/c", "a/.x/b", "a/./b", "a/../b", "a/x/b/y/z", "a/x/b/y/a/b/z", "/", "//", "a//b", "./", "C:/a/b", "c:/a/b", "D:/a/b", "//?/C:/a/b", "//server/share/a", "C:\\a\\b"];
const options: Array<EngineOptions> = [{}, { dot: true }, { nocase: true }, { dot: true, nocase: true }, { partial: true }, { noglobstar: true }, { optimizationLevel: 0 }, { optimizationLevel: 2 }, { optimizationLevel: 2, preserveMultipleSlashes: true }, { platform: "win32", nocase: true }, { platform: "win32", windowsNoMagicRoot: false }, { flipNegate: true }, { matchBase: true }, { nocomment: true }, { nonegate: true }];

describe("minimatch dedicated coverage", () => {
  it.effect("matches optimized segments, globstar sections and Windows roots like upstream", () => Effect.sync(() => {
    for (const opts of options) for (const pattern of patterns) {
      const actual = new Minimatch(pattern, opts);
      const expected = new Oracle(pattern, { ...opts, platform: opts.platform === "win32" ? "win32" : "linux" });
      assert.strictEqual(actual.hasMagic(), expected.hasMagic());
      for (const candidate of candidates) assert.strictEqual(actual.match(candidate), expected.match(candidate), `${pattern} against ${candidate}`);
      const re = actual.makeRe();
      const oracleRe = expected.makeRe();
      assert.strictEqual(actual.makeRe(), re);
      // Partial-prefix regex support is a deliberate newer-upstream feature.
      if (opts.partial !== true) for (const candidate of candidates) {
        assert.strictEqual(re === false ? false : re.test(candidate), oracleRe === false ? false : oracleRe.test(candidate), `regex ${pattern} against ${candidate}`);
      }
    }
  }));

  it.effect("normalizes path segments and merges compatible alternatives", () => Effect.sync(() => {
    const optimizerOptions: Array<EngineOptions> = [{}, { dot: true }, { preserveMultipleSlashes: true }, { platform: "win32" }];
    for (const opts of optimizerOptions) {
      const actual = new Minimatch("*", opts);
      const expected = new Oracle("*", { ...opts, platform: opts.platform === "win32" ? "win32" : "linux" });
      const parts = [[], [""], ["."], [".."], ["a", ".."], [".", "."], [".", ""], ["", "", "server", ".", "x"], ["a", "", ".", "b"], ["**", "**", "a", "**"], ["**", ".."], ["**", "..", ""], ["**", "..", ".", "x"], ["**", "..", "..", "x"], ["**", "..", "a", "."], ["**", "..", "a", ".."], ["**", "..", "a", ""], ["**", "..", "a", "b"], ["a", "..", "**"], ["C:", "..", "x"], ["*", "a"], ["a", "*"], ["*", "*"], ["", ".."], [".", ".."], ["..", ".."], ["**", "..", "a"]];
      for (const segments of parts) {
        assert.deepStrictEqual(actual.levelTwoFileOptimize([...segments]), expected.levelTwoFileOptimize([...segments]));
        assert.deepStrictEqual(actual.levelOneOptimize([[...segments]]), expected.levelOneOptimize([[...segments]]));
        assert.deepStrictEqual(actual.firstPhasePreProcess([[...segments]]), expected.firstPhasePreProcess([[...segments]]));
        assert.deepStrictEqual(actual.adjascentGlobstarOptimize([[...segments]]), expected.adjascentGlobstarOptimize([[...segments]]));
        for (const other of parts) for (const empty of [false, true]) {
          assert.deepStrictEqual(actual.partsMatch([...segments], [...other], empty), expected.partsMatch([...segments], [...other], empty));
          assert.deepStrictEqual(actual.secondPhasePreProcess([[...segments], [...other]]), expected.secondPhasePreProcess([[...segments], [...other]]));
        }
      }
    }
  }));

  it.effect("handles sparse segment arrays and malformed externally supplied regex metadata", () => Effect.sync(() => {
    const matcher = new Minimatch("a", { optimizationLevel: 0 });
    const sparse = new Array<string>(1);
    assert.deepStrictEqual(matcher.secondPhasePreProcess([sparse, ["a"]]), [sparse, ["a"]]);
    const sparseAlternatives = new Array<Array<string>>(2);
    assert.deepStrictEqual(matcher.secondPhasePreProcess(sparseAlternatives), []);
    assert.isFalse(matcher.partsMatch(sparse, ["a"]));
    assert.isFalse(matcher.partsMatch(["a"], sparse));
    assert.isFalse(matcher.matchOne(sparse, ["a"]));
    assert.isFalse(matcher.matchOne(["a"], sparse));
    assert.isFalse(matcher.matchOne(["a", "b", ...sparse, "c"], [GLOBSTAR, "b", GLOBSTAR, "c"]));
    matcher.set = [["a", GLOBSTAR, GLOBSTAR, "b"]];
    const adjacent = matcher.makeRe();
    assert.notStrictEqual(adjacent, false);
    if (adjacent !== false) assert.isTrue(adjacent.test("a/b"));
    matcher.regexp = null;
    matcher.set = [[Object.assign(/a/, { _src: "[", _glob: "a" })]];
    assert.strictEqual(matcher.makeRe(), false);
    assert.strictEqual(matcher.makeRe(), false);
  }));

  it.effect("rejects invalid compiled segments and handles empty and trailing path sections", () => Effect.sync(() => {
    const matcher = new Minimatch("a", { optimizationLevel: 0 });
    assert.isFalse(matcher.matchOne(["a"], [false]));
    assert.isTrue(matcher.matchOne([], [], false));
    assert.isFalse(matcher.matchOne(["a", "b"], ["a"]));
    assert.isTrue(matcher.matchOne(["a", ""], ["a"]));
    assert.isFalse(matcher.matchOne(["a", "b"], ["a", ""]));
    assert.isTrue(matcher.matchOne(["a"], ["a", "b"], true));
    assert.isFalse(matcher.matchOne(["a"], ["a", "b"]));
    assert.isFalse(matcher.matchOne(["a", "x"], ["a", GLOBSTAR, false]));
  }));
});

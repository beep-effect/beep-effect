import { GLOBSTAR, Minimatch } from "@beep/glob/internal/minimatch";
import { EngineOptions } from "@beep/glob/internal/types";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { legacyOracle } from "../legacyOracle.ts";
import type { EngineOptionsInput } from "@beep/glob/internal/minimatch";

const patterns = [
  "*",
  "*.*",
  ".*",
  "*.TS",
  "?",
  "??",
  "?.TS",
  "??.ts",
  "[ab]",
  "@(a|b)",
  "a",
  "a/b",
  "**",
  "**/a",
  "a/**",
  "a/**/b",
  "**/a/**/b/**",
  "a/**/b/**/c",
  "**/**",
  "{a,b}",
  "!a",
  "",
  "#comment",
  "a/../b",
  "./.",
  "./",
  "a/**/../b/c",
  "//?/C:/a/*",
  "//server/share/*",
  "C:/a/*",
  "//s*/share/*",
  "//server/s*/a",
  "//?/foo/a",
];
const candidates = [
  "",
  ".",
  "..",
  ".a",
  ".a.TS",
  "a",
  "b",
  "a.TS",
  "b.ts",
  "ab.ts",
  "ABC.TS",
  "a.b",
  "a/b",
  "a/b/",
  "a/b/c",
  "a/x/b/y/c",
  "a/.x/b",
  "a/./b",
  "a/../b",
  "a/x/b/y/z",
  "a/x/b/y/a/b/z",
  "/",
  "//",
  "a//b",
  "./",
  "C:/a/b",
  "c:/a/b",
  "D:/a/b",
  "//?/C:/a/b",
  "//server/share/a",
  "C:\\a\\b",
];
const options: Array<EngineOptionsInput> = [
  {},
  { dot: true },
  { nocase: true },
  { dot: true, nocase: true },
  { partial: true },
  { noglobstar: true },
  { optimizationLevel: 0 },
  { optimizationLevel: 2 },
  { optimizationLevel: 2, preserveMultipleSlashes: true },
  { platform: "win32", nocase: true },
  { platform: "win32", windowsNoMagicRoot: false },
  { flipNegate: true },
  { matchBase: true },
  { nocomment: true },
  { nonegate: true },
];

const regexMatches = (re: RegExp | false, candidate: string) => (re === false ? false : re.test(candidate));

const assertRegexParity = (pattern: string, re: RegExp | false, oracleRe: RegExp | false) => {
  for (const candidate of candidates) {
    assert.strictEqual(
      regexMatches(re, candidate),
      regexMatches(oracleRe, candidate),
      `regex ${pattern} against ${candidate}`
    );
  }
};

const sameOptions = S.toEquivalence(EngineOptions);
const sameParts = S.toEquivalence(S.Array(S.String));

const assertPatternParity = (pattern: string, opts: EngineOptionsInput) => {
  const actual = new Minimatch(pattern, opts);
  const reference = A.findFirst(
    legacyOracle.regexps,
    ([text, recorded]) => text === pattern && sameOptions(recorded, EngineOptions.make(opts))
  ).pipe(O.getOrElse(() => assert.fail(`Missing independent regex reference: ${pattern}`)));
  assert.strictEqual(actual.hasMagic(), reference[4]);
  assert.strictEqual(candidates.length, reference[5].length);
  for (const [candidate, [recorded, expected]] of A.zip(candidates, reference[5])) {
    assert.strictEqual(candidate, recorded);
    assert.strictEqual(actual.match(candidate), expected, `${pattern} against ${candidate}`);
  }
  const re = actual.makeRe();
  const oracleRe = O.map(reference[2], (source) => new RegExp(source, reference[3])).pipe(
    O.getOrElse((): false => false)
  );
  assert.strictEqual(actual.makeRe(), re);
  // Partial-prefix regex support is a deliberate newer-upstream feature.
  if (opts.partial !== true) assertRegexParity(pattern, re, oracleRe);
};

const optimizerParts: Array<Array<string>> = [
  [],
  [""],
  ["."],
  [".."],
  ["a", ".."],
  [".", "."],
  [".", ""],
  ["", "", "server", ".", "x"],
  ["a", "", ".", "b"],
  ["**", "**", "a", "**"],
  ["**", ".."],
  ["**", "..", ""],
  ["**", "..", ".", "x"],
  ["**", "..", "..", "x"],
  ["**", "..", "a", "."],
  ["**", "..", "a", ".."],
  ["**", "..", "a", ""],
  ["**", "..", "a", "b"],
  ["a", "..", "**"],
  ["C:", "..", "x"],
  ["*", "a"],
  ["a", "*"],
  ["*", "*"],
  ["", ".."],
  [".", ".."],
  ["..", ".."],
  ["**", "..", "a"],
];

type OptimizerReference = (typeof legacyOracle.optimizer)[number];

const assertSingleSegmentParity = (actual: Minimatch, segments: Array<string>, reference: OptimizerReference) => {
  assert.deepStrictEqual(actual.levelTwoFileOptimize([...segments]), reference[2]);
  assert.deepStrictEqual(actual.levelOneOptimize([[...segments]]), reference[3]);
  assert.deepStrictEqual(actual.firstPhasePreProcess([[...segments]]), reference[4]);
  assert.deepStrictEqual(actual.adjascentGlobstarOptimize([[...segments]]), reference[5]);
};

const assertSegmentPairParity = (
  actual: Minimatch,
  segments: Array<string>,
  other: Array<string>,
  reference: OptimizerReference
) => {
  for (const empty of [false, true]) {
    const pair = A.findFirst(
      reference[6],
      ([recorded, capturedEmpty]) => capturedEmpty === empty && sameParts(recorded, other)
    ).pipe(O.getOrElse(() => assert.fail("Missing independent optimizer pair reference")));
    assert.deepStrictEqual(
      actual.partsMatch([...segments], [...other], empty),
      O.getOrElse(pair[2], (): false => false)
    );
    assert.deepStrictEqual(actual.secondPhasePreProcess([[...segments], [...other]]), pair[3]);
  }
};

const assertOptimizerParity = (opts: EngineOptionsInput) => {
  const actual = new Minimatch("*", opts);
  for (const segments of optimizerParts) {
    const reference = A.findFirst(
      legacyOracle.optimizer,
      ([options, parts]) => sameOptions(options, EngineOptions.make(opts)) && sameParts(parts, segments)
    ).pipe(O.getOrElse(() => assert.fail("Missing independent optimizer reference")));
    assertSingleSegmentParity(actual, segments, reference);
    for (const other of optimizerParts) assertSegmentPairParity(actual, segments, other, reference);
  }
};

describe("minimatch dedicated coverage", () => {
  it.effect("matches optimized segments, globstar sections and Windows roots like upstream", () =>
    Effect.sync(() => {
      for (const opts of options) for (const pattern of patterns) assertPatternParity(pattern, opts);
    })
  );

  it.effect("normalizes path segments and merges compatible alternatives", () =>
    Effect.sync(() => {
      const optimizerOptions: Array<EngineOptionsInput> = [
        {},
        { dot: true },
        { preserveMultipleSlashes: true },
        { platform: "win32" },
      ];
      for (const opts of optimizerOptions) assertOptimizerParity(opts);
    })
  );

  it.effect("handles sparse segment arrays and malformed externally supplied regex metadata", () =>
    Effect.sync(() => {
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
    })
  );

  it.effect("rejects invalid compiled segments and handles empty and trailing path sections", () =>
    Effect.sync(() => {
      const matcher = new Minimatch("a", { optimizationLevel: 0 });
      assert.isFalse(matcher.matchOne(["a"], [false]));
      assert.isTrue(matcher.matchOne([], [], false));
      assert.isFalse(matcher.matchOne(["a", "b"], ["a"]));
      assert.isTrue(matcher.matchOne(["a", ""], ["a"]));
      assert.isFalse(matcher.matchOne(["a", "b"], ["a", ""]));
      assert.isTrue(matcher.matchOne(["a"], ["a", "b"], true));
      assert.isFalse(matcher.matchOne(["a"], ["a", "b"]));
      assert.isFalse(matcher.matchOne(["a", "x"], ["a", GLOBSTAR, false]));
    })
  );
});

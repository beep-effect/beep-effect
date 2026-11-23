import { escape as escapePattern, Minimatch } from "@beep/glob/internal/minimatch";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Minimatch as OracleMinimatch, minimatch as oracle } from "minimatch";
import { legacyOracle, legacySamples } from "./legacyOracle.ts";
import type { EngineOptionsInput } from "@beep/glob/internal/minimatch";
import type { MinimatchOptions } from "minimatch";

const JsonOptions = S.fromJsonString(S.Unknown);
const JsonString = S.fromJsonString(S.String);

type Row = readonly [pattern: string, candidate: string, expected: boolean, options?: EngineOptionsInput];

const LINUX_STANDS_IN_FOR_POSIX_SINCE_UPSTREAM_PLATFORM_HAS_NO_POSIX_AND_THE_ORACLE_MUST_NOT_READ_THE_HOST = "linux";

const oracleOpts = (opts: EngineOptionsInput): MinimatchOptions => {
  const { platform, ...options } = opts;
  return platform === undefined
    ? options
    : {
        ...options,
        platform:
          platform === "posix"
            ? LINUX_STANDS_IN_FOR_POSIX_SINCE_UPSTREAM_PLATFORM_HAS_NO_POSIX_AND_THE_ORACLE_MUST_NOT_READ_THE_HOST
            : platform,
      };
};

const LEADING_BANG_PAREN_IS_WHOLE_PATTERN_NEGATION_STRIPPED_BEFORE_THE_AST_SO_ONLY_NONEGATE_ROWS_HIT_THE_EXTGLOB: ReadonlyArray<Row> =
  [
    ["!(a)", "b", true],
    ["!(a)", "a", true],
    ["!(a)", "(a)", false],
    ["!(a)", "a", false, { nonegate: true }],
    ["!(a)", "b", true, { nonegate: true }],
  ];

const GLOBSTAR_DOTDOT_REWRITE_NEEDS_TWO_TRAILING_PORTIONS_ELSE_DOTDOT_STAYS_LITERAL_AND_MATCHES_NOTHING: ReadonlyArray<Row> =
  [
    ["a/**/../b/c", "a/x/b/c", true, { optimizationLevel: 2 }],
    ["a/**/../b", "a/x/b", false, { optimizationLevel: 2 }],
  ];

// decision: tests-compliance-oracle-gate
const table: ReadonlyArray<Row> = [
  ["*", "abc", true],
  ["*", ".abc", false],
  ["*", "a/b", false],
  ["*", "", false],
  ["a*", "abc", true],
  ["a*", "bac", false],
  ["*test*", "vitest", true],
  ["*test*", "vite", false],
  ["@scope/*", "somepkg", false],
  ["@scope/*", "@scope/x", true],
  ["a?c", "abc", true],
  ["a?c", "a/c", false],
  ["a?c", "ac", false],
  ["???", "abc", true],
  ["???", "ab", false],
  [".*", ".abc", true],
  ["*", ".abc", true, { dot: true }],
  ["*", ".", false, { dot: true }],
  ["*", "..", false, { dot: true }],
  ["a/*/b", "a/.x/b", false],
  ["a/*/b", "a/.x/b", true, { dot: true }],
  ["packages/**", "packages/a", true],
  ["packages/**", "packages/a/b", true],
  ["packages/**", "other/a", false],
  ["a/**/b", "a/b", true],
  ["a/**/b", "a/x/b", true],
  ["a/**/b", "a/x/y/b", true],
  ["a/**/b", "a/x/y/c", false],
  ["**", "a/b/c", true],
  ["**", ".a/b", false],
  ["**", ".a/b", true, { dot: true }],
  ["a/**", "a/.b/c", false],
  ["a/**", "a/.b/c", true, { dot: true }],
  ["a/**/b/**/c", "a/x/b/y/c", true],
  ["a/**/b/**/c", "a/b/c", true],
  ["a/**/b/**/c", "a/c", false],
  ["!a/*", "b/x", true],
  ["!a/*", "a/x", false],
  ["!a/*", "a/x", true, { flipNegate: true }],
  ["!a/*", "b/x", false, { flipNegate: true }],
  ["!!a", "a", true],
  ["!!!a", "a", false],
  ["!a", "!a", true, { nonegate: true }],
  ["!a", "b", false, { nonegate: true }],
  ["#a", "#a", false],
  ["#a", "anything", false],
  ["#a", "#a", true, { nocomment: true }],
  ["", "", true],
  ["", "a", false],
  ["a{b,c}d", "abd", true],
  ["a{b,c}d", "acd", true],
  ["a{b,c}d", "aed", false],
  ["x{1..3}", "x2", true],
  ["x{1..3}", "x4", false],
  ["{a,b}/*", "a/x", true],
  ["{a,b}/*", "c/x", false],
  ["a{b,c}d", "a{b,c}d", true, { nobrace: true }],
  ["a{b,c}d", "abd", false, { nobrace: true }],
  ["+(a|b)c", "aabc", true],
  ["+(a|b)c", "c", false],
  ["?(a)b", "b", true],
  ["?(a)b", "ab", true],
  ["?(a)b", "aab", false],
  ["*(a|b)", "", true],
  ["*(a|b)", "abab", true],
  ["@(a|b)", "a", true],
  ["@(a|b)", "ab", false],
  ...LEADING_BANG_PAREN_IS_WHOLE_PATTERN_NEGATION_STRIPPED_BEFORE_THE_AST_SO_ONLY_NONEGATE_ROWS_HIT_THE_EXTGLOB,
  ["a!(b)c", "axc", true],
  ["a!(b)c", "abc", false],
  ["+(a)", "+(a)", true, { noext: true }],
  ["+(a)", "a", false, { noext: true }],
  ["[abc]", "b", true],
  ["[abc]", "d", false],
  ["[a-c]x", "bx", true],
  ["[a-c]x", "dx", false],
  ["[!abc]", "d", true],
  ["[!abc]", "b", false],
  ["[[:digit:]]", "5", true],
  ["[[:digit:]]", "x", false],
  ["[[:alpha:]][[:digit:]]", "x5", true],
  ["libs/a.b+c/*", "libs/a.b+c/x", true],
  ["libs/a.b+c/*", "libs/aXbYc/x", false],
  ["\\*", "*", true],
  ["\\*", "x", false],
  ["a\\?b", "a?b", true],
  ["a\\?b", "axb", false],
  ["a?b", "/xyz/123/acb", true, { matchBase: true }],
  ["a?b", "/xyz/acb/123", false, { matchBase: true }],
  ["a/b", "/x/a/b", false, { matchBase: true }],
  ["AbC", "abc", true, { nocase: true }],
  ["AbC", "abc", false],
  ["A*C", "abc", true, { nocase: true }],
  ["AbC", "abc", false, { nocase: true, nocaseMagicOnly: true }],
  ["A*C", "abc", true, { nocase: true, nocaseMagicOnly: true }],
  ["/a/b/*/d", "/a/b", true, { partial: true }],
  ["/", "/", true, { partial: true }],
  ["/a/b", "/x", false, { partial: true }],
  ["a//b", "a/b", true],
  ["a//b", "a/b", false, { preserveMultipleSlashes: true }],
  ["a//b", "a//b", true, { preserveMultipleSlashes: true }],
  ["a/b/../c", "a/c", true, { optimizationLevel: 2 }],
  ["a/./b", "a/b", true, { optimizationLevel: 2 }],
  ["a/b/../c", "a/c", true, { optimizationLevel: 1 }],
  ...GLOBSTAR_DOTDOT_REWRITE_NEEDS_TWO_TRAILING_PORTIONS_ELSE_DOTDOT_STAYS_LITERAL_AND_MATCHES_NOTHING,
  ["a/b", "a/b", true, { optimizationLevel: 0 }],
  ["a/**/**/b", "a/x/b", true, { optimizationLevel: 0 }],
  ["a/b", "a\\b", true, { platform: "win32" }],
  ["a/b", "a\\b", false],
  ["c:/x/*", "C:/x/y", true, { platform: "win32", nocase: true }],
  ["//?/c:/x", "c:/x", true, { platform: "win32" }],
  ["a\\*b", "a*b", false, { windowsPathsNoEscape: true, platform: "win32" }],
  ["a\\*b", "a/xb", true, { windowsPathsNoEscape: true, platform: "win32" }],
  ["a/**/b", "a/x/y/b", false, { noglobstar: true }],
  ["a/**/b", "a/x/b", true, { noglobstar: true }],
  ["a/*", "a/b/", true],
  ["a/b/", "a/b", false],
  ["a/b/", "a/b/", true],
];

describe("engine compliance: behavioral table", () => {
  it("agrees with the expected outcome AND the oracle on every row", () => {
    const references = A.filter(legacyOracle.matches, ([suite]) => suite === "compliance");
    assert.strictEqual(references.length, table.length);
    for (const [[pattern, candidate, expected, options], recorded] of A.zip(table, references)) {
      const opts: EngineOptionsInput = { platform: "posix", ...options };
      const vendored = new Minimatch(pattern, opts).match(candidate);
      assert.deepStrictEqual([pattern, candidate, oracleOpts(opts)], [recorded[1], recorded[2], recorded[3]]);
      assert.strictEqual(vendored, expected, `expected: ${pattern} vs ${candidate}`);
      assert.strictEqual(vendored, recorded[4], `recorded oracle disagrees: ${pattern} vs ${candidate}`);
    }
  });

  it("classifies magic like the oracle Minimatch", () => {
    const cases: ReadonlyArray<readonly [string, EngineOptionsInput?]> = [
      ["packages/*"],
      ["packages/internal"],
      ["{a,b}"],
      ["{a,b}", { magicalBraces: true }],
      ["[x]"],
      ["a?b"],
      ["a/**"],
      ["plain/literal"],
    ];
    for (const [pattern, options] of cases) {
      const opts: EngineOptionsInput = { platform: "posix", ...options };
      assert.strictEqual(
        new Minimatch(pattern, opts).hasMagic(),
        new OracleMinimatch(pattern, oracleOpts(opts)).hasMagic(),
        `hasMagic: ${pattern} (${Result.getOrThrow(S.encodeResult(JsonOptions)(opts))})`
      );
    }
  });
});

// decision: tests-prop-array-form
const printableAsciiMinusSlashAndBackslashSpelledAsTheFourSpansAroundThemArb = Arbitrary.schema(
  S.String.check(S.isPattern(/^[ -.0-9:-@A-Z[\]-~]{1,30}$/))
);
const braceSegArb = Arbitrary.schema(
  S.Array(S.Literals(["a", "{b,c}", "{1..4}", "x{y,z}w", "{a,{b,c}}", "plain"])).check(S.isBetweenLength(1, 4))
).pipe(Arbitrary.map((xs) => A.join(xs, "/")));

describe("engine compliance: oracle properties", () => {
  it.effect.prop(
    "matches independent upstream references under default options",
    [legacySamples("compliance-default")],
    ([[, pattern, candidate, opts, expected]]) =>
      Effect.sync(() => {
        assert.strictEqual(new Minimatch(pattern, opts).match(candidate), expected, `${pattern} vs ${candidate}`);
      }),
    { arbitrary: { runs: 500 } }
  );

  it.effect.prop(
    "matches independent upstream references under arbitrary option bags",
    [legacySamples("compliance-options")],
    ([[, pattern, candidate, opts, expected]]) =>
      Effect.sync(() => {
        assert.strictEqual(
          new Minimatch(pattern, opts).match(candidate),
          expected,
          `${pattern} vs ${candidate} (${Result.getOrThrow(S.encodeResult(JsonOptions)(opts))})`
        );
      }),
    { arbitrary: { runs: 500 } }
  );

  it.effect.prop(
    "a compiled escape of any printable string matches exactly that string",
    [printableAsciiMinusSlashAndBackslashSpelledAsTheFourSpansAroundThemArb],
    ([s]) =>
      Effect.sync(() => {
        const leadingHashOrBangIsSyntaxEscapeLeavesAloneSoDisableIt: EngineOptionsInput = {
          platform: "posix",
          nocomment: true,
          nonegate: true,
        };
        const escapeBracesSinceExpansionIsMagicRegardless = { magicalBraces: true };
        const m = new Minimatch(
          escapePattern(s, escapeBracesSinceExpansionIsMagicRegardless),
          leadingHashOrBangIsSyntaxEscapeLeavesAloneSoDisableIt
        );
        assert.isTrue(
          m.match(s),
          `escape(${Result.getOrThrow(S.encodeResult(JsonString)(s))}) must match its own literal`
        );
        assert.strictEqual(
          m.match(s),
          oracle(
            s,
            oracle.escape(s, escapeBracesSinceExpansionIsMagicRegardless),
            oracleOpts(leadingHashOrBangIsSyntaxEscapeLeavesAloneSoDisableIt)
          )
        );
      }),
    { arbitrary: { runs: 300 } }
  );

  it.effect.prop(
    "braceExpand agrees with the upstream expansion for in-budget patterns",
    [braceSegArb],
    ([pattern]) =>
      Effect.sync(() => {
        const vendored = new Minimatch(pattern, { platform: "posix" });
        const upstream = new OracleMinimatch(pattern, oracleOpts({ platform: "posix" }));
        assert.deepStrictEqual(vendored.braceExpand(), upstream.braceExpand(), pattern);
      }),
    { arbitrary: { runs: 300 } }
  );
});

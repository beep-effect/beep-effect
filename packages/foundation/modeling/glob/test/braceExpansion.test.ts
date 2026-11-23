import { BalancedResult, balanced } from "@beep/glob/internal/balancedMatch";
import { expand } from "@beep/glob/internal/braceExpansion";
import { GuardExceeded, InvalidCap } from "@beep/glob/internal/limits";
import { assert, describe, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { braceExpand as oracleExpand } from "minimatch";

const reasonOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (S.is(GuardExceeded)(e)) return e.reason;
    throw e;
  }
  throw new Error("expected a GuardExceeded throw");
};

describe("balancedMatch port (pure sync engine, no Effect)", () => {
  it("finds the first balanced pair", () => {
    assert.deepStrictEqual(
      balanced("{", "}", "pre{in{nest}}post"),
      BalancedResult.make({
        start: 3,
        end: 12,
        pre: "pre",
        body: "in{nest}",
        post: "post",
      })
    );
  });

  it("returns false when there is no balanced pair", () => {
    assert.isFalse(balanced("{", "}", "no close {"));
    assert.isFalse(balanced("{", "}", "no open }"));
    assert.isFalse(balanced("{", "}", "nothing at all"));
  });

  it("handles an empty body", () => {
    assert.deepStrictEqual(
      balanced("{", "}", "a{}b"),
      BalancedResult.make({
        start: 1,
        end: 2,
        pre: "a",
        body: "",
        post: "b",
      })
    );
  });

  it("accepts regexp delimiters", () => {
    const r = balanced(/\{/, /\}/, "x{y}z");
    assert.isObject(r);
    assert.strictEqual(r === false ? "" : r.body, "y");
  });

  it("uses the first-closing pair when delimiters are identical", () => {
    assert.deepStrictEqual(
      balanced("|", "|", "a|b|c"),
      BalancedResult.make({
        start: 1,
        end: 3,
        pre: "a",
        body: "b",
        post: "c",
      })
    );
  });

  it("picks the leftmost outer pair among several", () => {
    const r = balanced("{", "}", "a{b}c{d}e");
    assert.isObject(r);
    assert.strictEqual(r === false ? "" : r.body, "b");
  });

  it("matches multi-character delimiters", () => {
    const r = balanced("<b>", "</b>", "pre<b>bold</b>post");
    assert.isObject(r);
    assert.strictEqual(r === false ? "" : r.body, "bold");
  });

  it("completes fast on a long pathological input (iterative, no guard needed)", () => {
    const long = `${Str.repeat(50_000)("{")}a`;
    assert.isFalse(balanced("{", "}", long));
  });
});

describe("braceExpansion port (pure sync engine, no Effect)", () => {
  it("expands comma sets", () => {
    assert.deepStrictEqual(expand("a{b,c}d"), ["abd", "acd"]);
  });

  it("expands nested sets", () => {
    assert.deepStrictEqual(expand("a{b,c{d,e}f}g"), ["abg", "acdfg", "acefg"]);
  });

  it("expands cross products", () => {
    assert.deepStrictEqual(expand("{a,b}{c,d}"), ["ac", "ad", "bc", "bd"]);
  });

  it("expands empty members", () => {
    assert.deepStrictEqual(expand("a{b,}c"), ["abc", "ac"]);
  });

  it("expands numeric sequences", () => {
    assert.deepStrictEqual(expand("a{0..3}d"), ["a0d", "a1d", "a2d", "a3d"]);
  });

  it("expands padded sequences", () => {
    assert.deepStrictEqual(expand("{01..03}"), ["01", "02", "03"]);
  });

  it("expands stepped sequences", () => {
    assert.deepStrictEqual(expand("{1..10..3}"), ["1", "4", "7", "10"]);
  });

  it("expands reverse sequences", () => {
    assert.deepStrictEqual(expand("{3..1}"), ["3", "2", "1"]);
  });

  it("expands negative sequences", () => {
    assert.deepStrictEqual(expand("{-1..1}"), ["-1", "0", "1"]);
  });

  it("expands alpha sequences with step", () => {
    assert.deepStrictEqual(expand("{a..e..2}"), ["a", "c", "e"]);
  });

  it("leaves invalid sets unexpanded", () => {
    assert.deepStrictEqual(expand("a{2..}b"), ["a{2..}b"]);
    assert.deepStrictEqual(expand("a{b}c"), ["a{b}c"]);
  });

  it("expands the doubled-brace single-member form", () => {
    assert.deepStrictEqual(expand("x{{a,b}}y"), ["x{a}y", "x{b}y"]);
  });

  it("preserves a leading {} at top level", () => {
    assert.deepStrictEqual(expand("{},a}b"), ["{},a}b"]);
  });

  it("rewrites the a{},b}c shape like Bash", () => {
    assert.deepStrictEqual(expand("a{},b}c"), ["a}c", "abc"]);
  });

  it("does not expand escaped braces", () => {
    assert.deepStrictEqual(expand("\\{a,b\\}"), ["{a,b}"]);
  });

  it("treats escaped commas as literal", () => {
    assert.deepStrictEqual(expand("{a\\,b,c}"), ["a,b", "c"]);
  });

  it("preserves dollar-prefixed brace groups", () => {
    const dollarGroupConcatenatedSinceTheGlobSyntaxTripsNoTemplateCurlyInString = "$" + "{a,b}";
    assert.deepStrictEqual(expand(dollarGroupConcatenatedSinceTheGlobSyntaxTripsNoTemplateCurlyInString), [
      dollarGroupConcatenatedSinceTheGlobSyntaxTripsNoTemplateCurlyInString,
    ]);
    assert.deepStrictEqual(expand(`${dollarGroupConcatenatedSinceTheGlobSyntaxTripsNoTemplateCurlyInString}{c,d}`), [
      `${dollarGroupConcatenatedSinceTheGlobSyntaxTripsNoTemplateCurlyInString}c`,
      `${dollarGroupConcatenatedSinceTheGlobSyntaxTripsNoTemplateCurlyInString}d`,
    ]);
  });

  it("returns an empty array for empty input", () => {
    assert.deepStrictEqual(expand(""), []);
  });
});

describe("braceExpansion hardening", () => {
  it("bounds large singletons and non-advancing endpoints by their member count", () => {
    assert.deepStrictEqual(expand("{9007199254740992..9007199254740992}", { max: 1 }), ["9007199254740992"]);
    assert.deepStrictEqual(expand("{9007199254740991..9007199254740992}", { max: 2 }), [
      "9007199254740991",
      "9007199254740992",
    ]);
    assert.deepStrictEqual(expand("{9007199254740992..9007199254740994}", { max: 3 }), [
      "9007199254740992",
      "9007199254740992",
      "9007199254740992",
    ]);
    assert.deepStrictEqual(expand("{-9007199254740992..-9007199254740994}", { max: 3 }), [
      "-9007199254740992",
      "-9007199254740992",
      "-9007199254740992",
    ]);
    assert.strictEqual(
      reasonOf(() => expand("{9007199254740992..9007199254740994}", { max: 2 })),
      "ExpansionBudgetExceeded"
    );
  });

  it("rejects non-finite member counts with an Infinity measurement instead of a schema defect", () => {
    const huge = Str.repeat(310)("9");
    const finite = `1${Str.repeat(308)("0")}`;
    for (const source of [
      `{${huge}..${huge}}`,
      `{1..${huge}..${huge}}`,
      `{-${finite}..${finite}}`,
      `{-${finite}..${finite}..${huge}}`,
    ]) {
      try {
        expand(source, { max: 1 });
        assert.fail("expected a GuardExceeded throw");
      } catch (error) {
        assertInstanceOf(error, GuardExceeded);
        assert.strictEqual(error.reason, "ExpansionBudgetExceeded");
        assert.strictEqual(error.limit, 1);
        assert.strictEqual(error.actual, Number.POSITIVE_INFINITY);
      }
    }
  });

  it("preserves finite counts, increments and padding when a step overflows", () => {
    assert.deepStrictEqual(expand(`{01..03..${Str.repeat(310)("9")}}`, { max: 1 }), ["01"]);
    assert.deepStrictEqual(expand("{03..-03..2}"), ["003", "001", "-01", "-03"]);
  });

  it("fails typed on nesting past the cap, never a stack overflow", () => {
    const bomb = `${Str.repeat(300)("{")}a,b${Str.repeat(300)("}")}`;
    assert.strictEqual(
      reasonOf(() => expand(bomb)),
      "NestingDepthExceeded",
      "the comma is load-bearing: comma-bearing nesting descends one expand_ frame per level, while a comma-free nest is returned unexpanded upstream"
    );
  });

  it("returns a comma-free deep nest unexpanded without recursing (upstream shape)", () => {
    const inert = `${Str.repeat(300)("{")}a${Str.repeat(300)("}")}`;
    assert.deepStrictEqual(expand(inert), [inert]);
  });

  it("fails typed when the expansion budget is exhausted", () => {
    const bomb = Str.repeat(17)("{a,b}");
    assert.strictEqual(
      reasonOf(() => expand(bomb)),
      "ExpansionBudgetExceeded",
      "2^17 = 131_072 > 100_000"
    );
  });

  it("honours a caller-lowered budget", () => {
    assert.strictEqual(
      reasonOf(() => expand("{a,b}{c,d}", { max: 3 })),
      "ExpansionBudgetExceeded"
    );
    assert.lengthOf(expand("{a,b}{c,d}", { max: 4 }), 4);
  });

  it("survives the a{},{},{} exponential-blowup shape (lazy post preserved)", () => {
    const r = expand(`a${Str.repeat(60)("{},")}b`);
    assert.isArray(r, "completing within the test timeout IS the assertion");
  });

  it("survives a {a},b} rewrite chain under the cap (for-loop rewrite preserved)", () => {
    assert.isArray(expand(`${Str.repeat(200)("{a},")}b}`));
  });

  it("fails typed, not with a stack overflow, past the sequential-group cap", () => {
    assert.strictEqual(
      reasonOf(() => expand(`${Str.repeat(5000)("{a},")}b}`)),
      "NestingDepthExceeded",
      "each sequential group is one parseCommaParts frame; upstream left this surface unguarded and would recurse 5000 deep"
    );
  });

  it("guards nested comma members in expand_", () => {
    const deep = `{a,${Str.repeat(300)("{b,")}c${Str.repeat(300)("}")}}`;
    assert.strictEqual(
      reasonOf(() => expand(deep)),
      "NestingDepthExceeded"
    );
  });

  it("guards parseCommaParts against long sequential group chains", () => {
    const chain = `{${Str.repeat(300)("{x},")}y}`;
    assert.strictEqual(
      reasonOf(() => expand(chain)),
      "NestingDepthExceeded",
      "sequential {x} groups recurse through parseCommaParts on the post side"
    );
  });

  it("dies on a NaN or non-integer max, programmer error rather than input error", () => {
    assert.throws(() => expand("x{a,b}", { max: Number.NaN }), InvalidCap);
    assert.throws(() => expand("x{a,b}", { max: 1.5 }), InvalidCap);
    assert.throws(() => expand("x{a,b}", { max: 0 }), InvalidCap);
  });

  it("stays fast and exact just under the budget", () => {
    const r = expand(Str.repeat(16)("{a,b}"));
    assert.lengthOf(r, 65_536, "2^16 = 65_536 <= 100_000: expands fully, no throw");
  });
});

describe("braceExpansion round-3 regressions", () => {
  it("follows rounded advancing increments to the endpoint and rejects the sixth member at max five", () => {
    const source = "{18014398509481984..18014398509482004..5}";
    const expected = [
      "18014398509481984",
      "18014398509481988",
      "18014398509481990",
      "18014398509481996",
      "18014398509482000",
      "18014398509482004",
    ];
    assert.deepStrictEqual(expand(source), expected);
    assert.deepStrictEqual(expand(source, { max: 6 }), oracleExpand(source));
    try {
      expand(source, { max: 5 });
      assert.fail("expected a budget failure");
    } catch (error) {
      assertInstanceOf(error, GuardExceeded);
      assert.strictEqual(error.reason, "ExpansionBudgetExceeded");
      assert.strictEqual(error.limit, 5);
      assert.strictEqual(error.actual, 6);
    }
  });

  it("rejects siblings without materializing their full member arrays", () => {
    const source = `{${A.join(A.replicate("{1..1000}", 32), ",")}}`;
    const push = Array.prototype.push;
    let retained = 0;
    let members = 0;
    Array.prototype.push = function (this: Array<unknown>, ...items: Array<unknown>) {
      const size = push.apply(this, items);
      retained = Math.max(retained, size);
      members += A.countBy(items, (item) => S.is(S.String)(item) && /^\d+$/.test(item));
      return size;
    };
    let failure: unknown;
    try {
      expand(source, { max: 1000 });
    } catch (error) {
      failure = error;
    } finally {
      Array.prototype.push = push;
    }
    assertInstanceOf(failure, GuardExceeded);
    assert.strictEqual(failure.reason, "ExpansionBudgetExceeded");
    assert.strictEqual(failure.limit, 1000);
    assert.strictEqual(failure.actual, 1001);
    assert.isAtMost(retained, 1000);
    assert.strictEqual(members, 1000);
  });

  it("preserves boundary, suffix-product and filtered-empty ordering", () => {
    for (const [source, max] of [
      ["{{1..3},{4..6}}", 6],
      ["{{1..3},{4..6}}{a,b}", 12],
      ["{,,a,,b,}", 2],
      ["{,,a,,b,}{,x}", 10],
      ["x{,,a,,b,}", 7],
      ["{{,},{,},a}", 1],
      ["{{,a}}{,b}", 4],
      ["{Z..a}", 8],
    ] as const) {
      assert.deepStrictEqual(expand(source, { max }), oracleExpand(source), source);
    }
    assert.strictEqual(
      reasonOf(() => expand("{{1..3},{4..6}}{a,b}", { max: 11 })),
      "ExpansionBudgetExceeded"
    );
  });
});

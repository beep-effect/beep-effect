import * as NodeUtil from "node:util";
import { AST, ASTError, ExtglobType } from "@beep/glob/internal/ast";
import { MAX_NESTING_DEPTH } from "@beep/glob/internal/limits";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { AST as OracleAST } from "minimatch";

const matches = (pattern: RegExp | string, candidate: string) =>
  typeof pattern === "string" ? pattern === candidate : pattern.test(candidate);

const normalizationCandidates = ["", "a", "b", "ab", "x", "y", "zaz", ".", "..", ".a", "a.b", "other"];

const nestedOperatorTexts = (outer: string, inner: string) => [
  `${outer}(${inner}(a|b))`,
  `${outer}(x|${inner}(a|b)|y)`,
  `${outer}(z${inner}(a|b)z)`,
  `${outer}(${inner}())`,
];

const assertNormalizationParity = (text: string) => {
  for (const dot of [false, true]) {
    const tree = AST.fromGlob(text, { dot });
    const actual = tree.toMMPattern();
    const expected = OracleAST.fromGlob(text, { dot }).toMMPattern();
    for (const candidate of normalizationCandidates) {
      assert.strictEqual(matches(actual, candidate), matches(expected, candidate), `${text}: ${candidate}`);
    }
    assert.strictEqual(tree.toString(), tree.toString());
    assert.isArray(tree.toJSON());
  }
};

const escapeTexts = [
  "",
  ".",
  "..",
  ".?",
  "..?",
  "...",
  "[.]",
  "[^]]",
  "[!]]",
  "[]]",
  "[abc",
  "[[:alpha:]]",
  "a\\",
  "\\a",
  "\\*",
  "\\?",
  "***",
  "a**b",
  "@(a\\|b|[!]]|[^]]|[]]|\\*)",
  "@(a",
  "!(a",
  "@()",
  "!()",
  "a!()b",
  "*(?)",
  "+(?)",
  "!(a)!(b)c",
  "a@(i|w!(x|y)z|j)b",
];

const assertEscapeCandidates = (text: string, dot: boolean, noext: boolean) => {
  const actual = AST.fromGlob(text, { dot, noext }).toMMPattern();
  const expected = OracleAST.fromGlob(text, { dot, noext }).toMMPattern();
  for (const candidate of [text, "a", "b", "abc", "", ".", "..", ".a", "a.b", "c", "aizb", "aib"]) {
    assert.strictEqual(matches(actual, candidate), matches(expected, candidate), `${text}: ${candidate}`);
  }
};

const assertEscapeParity = (text: string) => {
  for (const dot of [false, true]) for (const noext of [false, true]) assertEscapeCandidates(text, dot, noext);
};

describe("AST coverage", () => {
  it.effect("operator normalization preserves oracle matching across adoption and usurp maps", () =>
    Effect.sync(() => {
      for (const outer of ExtglobType.literals)
        for (const inner of ExtglobType.literals)
          for (const text of nestedOperatorTexts(outer, inner)) assertNormalizationParity(text);
    })
  );
  it.effect("escapes, classes, empty and unfinished operators retain oracle semantics", () =>
    Effect.sync(() => {
      for (const text of escapeTexts) assertEscapeParity(text);
      assert.strictEqual(AST.fromGlob("CAT", { nocase: true, nocaseMagicOnly: true }).toMMPattern(), "CAT");
      assert.isTrue(matches(AST.fromGlob("CAT", { nocase: true }).toMMPattern(), "cat"));
      assert.strictEqual(AST.fromGlob("123", { nocase: true }).toMMPattern(), "123");
      assert.isTrue(matches(AST.fromGlob("*", { dot: false }).toMMPattern(), "a"));
      assert.isTrue(new RegExp(`^${AST.fromGlob("*").toRegExpSource(true)[0]}$`).test(".a"));
    })
  );
  it.effect("manual tree boundaries, clones, copying and inspection", () =>
    Effect.sync(() => {
      const root = new AST(null, undefined, { dot: true });
      root.push("", "a");
      const op = new AST("@", root);
      const part = new AST(null, op);
      part.push("b");
      op.push(part);
      root.push(op);
      assert.strictEqual(root.depth, 0);
      assert.strictEqual(part.depth, 2);
      assert.strictEqual(op.options, root.options);
      assert.isFalse(op.isStart());
      assert.isTrue(op.isEnd());
      assert.isFalse(part.isStart());
      assert.isTrue(part.isEnd());
      assert.isTrue(root.hasMagic);
      assert.isTrue(Str.includes("@@type")(NodeUtil.inspect(root)));
      assert.isTrue(Str.includes("parent")(NodeUtil.inspect(part)));
      assert.isTrue(matches(part.toMMPattern(), "ab"));
      const copy = new AST(null);
      copy.copyIn(root);
      copy.copyIn("z");
      assert.strictEqual(copy.toString(), "a@(b)z");
      assert.isArray(copy.toJSON());
      const unknown = new AST(null);
      unknown.push("a", new AST(null, unknown));
      assert.strictEqual(unknown.hasMagic, undefined);
      const child = new AST(null, unknown);
      child.push("*");
      child.toRegExpSource();
      unknown.push(child);
      assert.isTrue(unknown.hasMagic);
      assert.throws(() => root.push(new AST(null)), ASTError);
      assert.throws(() => root.clone(copy, MAX_NESTING_DEPTH + 1));
      assert.throws(() => root.copyIn("x", MAX_NESTING_DEPTH + 1));
      assert.throws(() => root.toRegExpSource(false, MAX_NESTING_DEPTH + 1));
      const invalid = new AST("@");
      invalid.push("bad");
      assert.throws(() => invalid.toJSON(), ASTError);
      assert.throws(() => invalid.toRegExpSource(), ASTError);
      for (const [outer, inner] of [
        ["+", "@"],
        ["?", "+"],
      ] as const) {
        const root = new AST(null);
        const parent = new AST(outer, root);
        root.push(parent);
        const sequence = new AST(null, parent);
        parent.push(sequence);
        const nested = new AST(inner, sequence);
        sequence.push(nested);
        nested.push("invalid");
        assert.throws(() => root.toRegExpSource(), ASTError);
      }
      const cached = AST.fromGlob("a@(b|c)");
      assert.deepStrictEqual(cached.toRegExpSource(), cached.toRegExpSource());
      const negRoot = new AST(null);
      const neg = new AST("!", negRoot);
      neg.push("bad");
      negRoot.push(neg, "tail");
      assert.throws(() => negRoot.toRegExpSource(), ASTError);
      const mutatedRoot = new AST(null);
      const mutatedNeg = new AST("!", mutatedRoot);
      mutatedNeg.type = null;
      mutatedNeg.push("a");
      mutatedRoot.push(mutatedNeg);
      assert.isTrue(matches(mutatedRoot.toMMPattern(), "a"));
    })
  );
  it.effect("explicit recursion budgets and deep structural guards", () =>
    Effect.sync(() => {
      assert.throws(() => AST.fromGlob("a", { maxExtglobRecursion: Number.NaN }));
      for (const text of ["@(a|!(!(b)))", "@(@(@(a)))", "!(!(!(a)))"]) {
        const actual = AST.fromGlob(text, { maxExtglobRecursion: 1 }).toMMPattern();
        const expected = OracleAST.fromGlob(text, { maxExtglobRecursion: 1 }).toMMPattern();
        for (const candidate of ["a", "b", text])
          assert.strictEqual(matches(actual, candidate), matches(expected, candidate));
      }
      assert.throws(() =>
        AST.fromGlob(Str.repeat(MAX_NESTING_DEPTH + 1)("@(") + "a" + Str.repeat(MAX_NESTING_DEPTH + 1)(")"))
      );
      const root = new AST(null);
      let parent = root;
      for (let depth = 0; depth <= MAX_NESTING_DEPTH; depth++) {
        const child = new AST(null, parent);
        parent.push(child);
        parent = child;
      }
      parent.push("a");
      assert.throws(() => root.toRegExpSource());
    })
  );
});

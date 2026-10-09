import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { inspect } from "node:util";
import { AST as OracleAST } from "minimatch";
import { AST, ASTError, ExtglobType } from "../../../effected/glob/internal/ast.ts";
import { MAX_NESTING_DEPTH } from "../../../effected/glob/internal/limits.ts";

const matches = (pattern: RegExp | string, candidate: string) => typeof pattern === "string" ? pattern === candidate : pattern.test(candidate);

describe("AST coverage", () => {
  it.effect("operator normalization preserves oracle matching across adoption and usurp maps", () => Effect.sync(() => {
    for (const outer of ExtglobType.literals) for (const inner of ExtglobType.literals) {
      for (const text of [`${outer}(${inner}(a|b))`, `${outer}(x|${inner}(a|b)|y)`, `${outer}(z${inner}(a|b)z)`, `${outer}(${inner}())`]) {
        for (const dot of [false, true]) {
          const tree = AST.fromGlob(text, { dot });
          const actual = tree.toMMPattern();
          const expected = OracleAST.fromGlob(text, { dot }).toMMPattern();
          for (const candidate of ["", "a", "b", "ab", "x", "y", "zaz", ".", "..", ".a", "a.b", "other"]) {
            assert.strictEqual(matches(actual, candidate), matches(expected, candidate), `${text}: ${candidate}`);
          }
          assert.strictEqual(tree.toString(), tree.toString());
          assert.isArray(tree.toJSON());
        }
      }
    }
  }));
  it.effect("escapes, classes, empty and unfinished operators retain oracle semantics", () => Effect.sync(() => {
    for (const text of ["", ".", "..", ".?", "..?", "...", "[.]", "[^]]", "[!]]", "[]]", "[abc", "[[:alpha:]]", "a\\", "\\a", "\\*", "\\?", "***", "a**b", "@(a\\|b|[!]]|[^]]|[]]|\\*)", "@(a", "!(a", "@()", "!()", "a!()b", "*(?)", "+(?)", "!(a)!(b)c", "a@(i|w!(x|y)z|j)b"]) {
      for (const dot of [false, true]) for (const noext of [false, true]) {
        const actual = AST.fromGlob(text, { dot, noext }).toMMPattern();
        const expected = OracleAST.fromGlob(text, { dot, noext }).toMMPattern();
        for (const candidate of [text, "a", "b", "abc", "", ".", "..", ".a", "a.b", "c", "aizb", "aib"]) {
          assert.strictEqual(matches(actual, candidate), matches(expected, candidate), `${text}: ${candidate}`);
        }
      }
    }
    assert.strictEqual(AST.fromGlob("CAT", { nocase: true, nocaseMagicOnly: true }).toMMPattern(), "CAT");
    assert.isTrue(matches(AST.fromGlob("CAT", { nocase: true }).toMMPattern(), "cat"));
    assert.strictEqual(AST.fromGlob("123", { nocase: true }).toMMPattern(), "123");
    assert.isTrue(matches(AST.fromGlob("*", { dot: false }).toMMPattern(), "a"));
    assert.isTrue(new RegExp(`^${AST.fromGlob("*").toRegExpSource(true)[0]}$`).test(".a"));
  }));
  it.effect("manual tree boundaries, clones, copying and inspection", () => Effect.sync(() => {
    const root = new AST(null, undefined, { dot: true });
    root.push("", "a");
    const op = new AST("@", root);
    const part = new AST(null, op);
    part.push("b"); op.push(part); root.push(op);
    assert.strictEqual(root.depth, 0); assert.strictEqual(part.depth, 2);
    assert.strictEqual(op.options, root.options);
    assert.isFalse(op.isStart()); assert.isTrue(op.isEnd());
    assert.isFalse(part.isStart()); assert.isTrue(part.isEnd());
    assert.isTrue(root.hasMagic);
    assert.isTrue(inspect(root).includes("@@type")); assert.isTrue(inspect(part).includes("parent"));
    assert.isTrue(matches(part.toMMPattern(), "ab"));
    const copy = new AST(null); copy.copyIn(root); copy.copyIn("z");
    assert.strictEqual(copy.toString(), "a@(b)z");
    assert.isArray(copy.toJSON());
    const unknown = new AST(null); unknown.push("a", new AST(null, unknown));
    assert.strictEqual(unknown.hasMagic, undefined);
    const child = new AST(null, unknown); child.push("*"); child.toRegExpSource(); unknown.push(child);
    assert.isTrue(unknown.hasMagic);
    assert.throws(() => root.push(new AST(null)), ASTError);
    assert.throws(() => root.clone(copy, MAX_NESTING_DEPTH + 1));
    assert.throws(() => root.copyIn("x", MAX_NESTING_DEPTH + 1));
    assert.throws(() => root.toRegExpSource(false, MAX_NESTING_DEPTH + 1));
    const invalid = new AST("@"); invalid.push("bad");
    assert.throws(() => invalid.toJSON(), ASTError);
    assert.throws(() => invalid.toRegExpSource(), ASTError);
    for (const [outer, inner] of [["+", "@"], ["?", "+"]] as const) {
      const root = new AST(null);
      const parent = new AST(outer, root); root.push(parent);
      const sequence = new AST(null, parent); parent.push(sequence);
      const nested = new AST(inner, sequence); sequence.push(nested); nested.push("invalid");
      assert.throws(() => root.toRegExpSource(), ASTError);
    }
    const cached = AST.fromGlob("a@(b|c)");
    assert.deepStrictEqual(cached.toRegExpSource(), cached.toRegExpSource());
    const negRoot = new AST(null); const neg = new AST("!", negRoot); neg.push("bad"); negRoot.push(neg, "tail");
    assert.throws(() => negRoot.toRegExpSource(), ASTError);
    const mutatedRoot = new AST(null); const mutatedNeg = new AST("!", mutatedRoot); mutatedNeg.type = null; mutatedNeg.push("a"); mutatedRoot.push(mutatedNeg);
    assert.isTrue(matches(mutatedRoot.toMMPattern(), "a"));
  }));
  it.effect("explicit recursion budgets and deep structural guards", () => Effect.sync(() => {
    assert.throws(() => AST.fromGlob("a", { maxExtglobRecursion: Number.NaN }));
    for (const text of ["@(a|!(!(b)))", "@(@(@(a)))", "!(!(!(a)))"]) {
      const actual = AST.fromGlob(text, { maxExtglobRecursion: 1 }).toMMPattern();
      const expected = OracleAST.fromGlob(text, { maxExtglobRecursion: 1 }).toMMPattern();
      for (const candidate of ["a", "b", text]) assert.strictEqual(matches(actual, candidate), matches(expected, candidate));
    }
    assert.throws(() => AST.fromGlob("@(".repeat(MAX_NESTING_DEPTH + 1) + "a" + ")".repeat(MAX_NESTING_DEPTH + 1)));
    const root = new AST(null); let parent = root;
    for (let depth = 0; depth <= MAX_NESTING_DEPTH; depth++) { const child = new AST(null, parent); parent.push(child); parent = child; }
    parent.push("a"); assert.throws(() => root.toRegExpSource());
  }));
});

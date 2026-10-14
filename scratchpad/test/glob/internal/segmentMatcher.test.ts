import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Minimatch as OracleMinimatch } from "minimatch";
import { Minimatch } from "../../../effected/glob/internal/minimatch.ts";

it.effect("repeated segments preserve contextual dots, negation tails, optional branches and Unicode classes", () => Effect.sync(() => {
  for (const pattern of [
    "*+(a)", ".?*(a)", "[.]*(a)", "?(*(a)|b)", "*(|a)",
    "*(a|[[:alpha:]])", "*([[:alpha:]]|a)", "[[:alpha:]]*(a)",
    "!(a)*(b)", "!(a*(b))", "!(a*(b)c)", "a!(*(b))", "*(a)!()",
    "*(a)!(b)", "*(a)@(b|c)", "?(*(a)b)", "*(!(a))", "*(!())", "!(+(a))", "+(!(a|b))",
  ]) {
    for (const dot of [false, true]) for (const nocase of [false, true]) {
      const options = { dot, nocase, nonegate: true };
      const actual = new Minimatch(pattern, options);
      const expected = new OracleMinimatch(pattern, options);
      for (const candidate of ["", ".", "..", ".a", "a", "b", "aa", "ab", "ac", "abc", "a.b", "a/b", "A", "é", "α"]) {
        assert.strictEqual(actual.match(candidate), expected.match(candidate), `${pattern}, ${candidate}, dot=${dot}, nocase=${nocase}`);
      }
    }
  }
}));

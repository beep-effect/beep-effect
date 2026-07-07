/**
 * Proofs for the composable Operations algebra: Functor identity/composition,
 * Monad left/right identity + associativity, Applicative product/zipWith, and the
 * traverse/aggregate helpers. Laws are checked over `string -> number` style
 * operations so the categorical structure is verified without NLP coupling.
 *
 * Effect v4 + `@effect/vitest` coverage for the composable-operations design.
 */

import * as Monoid from "@beep/nlp/Algebra/Monoid";
import * as Composable from "@beep/nlp/Operations/Composable";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";

const len = Composable.makeOperation("len", S.String, S.Finite, (s) => Effect.succeed(s.length));
const inc = Composable.makeOperation("inc", S.Finite, S.Finite, (n) => Effect.succeed(n + 1));
const dbl = Composable.makeOperation("dbl", S.Finite, S.Finite, (n) => Effect.succeed(n * 2));

describe("Functor laws", () => {
  it.effect(
    "identity: map(id) = id",
    Effect.fnUntraced(function* () {
      const mapped = yield* len.map((n) => n, S.Finite).run("hello");
      const direct = yield* len.run("hello");
      expect(mapped).toBe(direct);
    })
  );

  it.effect(
    "composition: map(g ∘ f) = map(g) ∘ map(f)",
    Effect.fnUntraced(function* () {
      const f = (n: number) => n + 1;
      const g = (n: number) => n * 3;
      const composed = yield* len.map((n) => g(f(n)), S.Finite).run("abcd");
      const sequential = yield* len.map(f, S.Finite).map(g, S.Finite).run("abcd");
      expect(composed).toBe(sequential);
    })
  );

  it.effect(
    "dual helper supports data-first and pipe-friendly data-last map",
    Effect.fnUntraced(function* () {
      const dataFirst = Composable.map(len, (n) => n + 1, S.Finite);
      const dataLast = pipe(
        len,
        Composable.map((n) => n * 2, S.Finite)
      );

      expect(yield* dataFirst.run("abc")).toBe(4);
      expect(yield* dataLast.run("abc")).toBe(6);
    })
  );
});

describe("Monad laws", () => {
  it.effect(
    "left identity: pure(a).flatMap(f) = f(a)",
    Effect.fnUntraced(function* () {
      const viaFlatMap = yield* len.flatMap(inc).run("hey");
      const direct = yield* inc.run("hey".length);
      expect(viaFlatMap).toBe(direct);
    })
  );

  it.effect(
    "right identity: m.flatMap(pure) = m",
    Effect.fnUntraced(function* () {
      const idOp = Composable.identity(S.Finite);
      const viaFlatMap = yield* len.flatMap(idOp).run("hello");
      const direct = yield* len.run("hello");
      expect(viaFlatMap).toBe(direct);
    })
  );

  it.effect(
    "associativity: (m.flatMap(f)).flatMap(g) = m.flatMap(x => f(x).flatMap(g))",
    Effect.fnUntraced(function* () {
      const left = yield* len.flatMap(inc).flatMap(dbl).run("abcd");
      const right = yield* len.flatMap(inc.flatMap(dbl)).run("abcd");
      expect(left).toBe(right);
    })
  );
});

describe("Applicative", () => {
  it.effect(
    "product runs both operations on the same input",
    Effect.fnUntraced(function* () {
      const lenA = Composable.makeOperation("lenA", S.String, S.Finite, (s) => Effect.succeed(s.length));
      const lenB = Composable.makeOperation("lenB", S.String, S.Finite, (s) => Effect.succeed(s.length * 10));
      const paired = lenA.product(lenB, S.Tuple([S.Finite, S.Finite]));
      const [a, b] = yield* paired.run("abc");
      expect(a).toBe(3);
      expect(b).toBe(30);
      expect(paired.name).toContain("lenA");
    })
  );

  it.effect(
    "dual helper supports data-first and pipe-friendly data-last product",
    Effect.fnUntraced(function* () {
      const lenA = Composable.makeOperation("lenA", S.String, S.Finite, (s) => Effect.succeed(s.length));
      const lenB = Composable.makeOperation("lenB", S.String, S.Finite, (s) => Effect.succeed(s.length * 10));
      const outputSchema = S.Tuple([S.Finite, S.Finite]);

      const dataFirst = Composable.product(lenA, lenB, outputSchema);
      const dataLast = pipe(lenA, Composable.product(lenB, outputSchema));

      expect(yield* dataFirst.run("abc")).toEqual([3, 30]);
      expect(yield* dataLast.run("abc")).toEqual([3, 30]);
    })
  );

  it.effect(
    "zipWith combines both results with a function",
    Effect.fnUntraced(function* () {
      const lenA = Composable.makeOperation("lenA", S.String, S.Finite, (s) => Effect.succeed(s.length));
      const lenB = Composable.makeOperation("lenB", S.String, S.Finite, (s) => Effect.succeed(s.length * 10));
      const summed = lenA.zipWith(lenB, (a, b) => a + b, S.Finite);
      expect(yield* summed.run("abc")).toBe(33);
    })
  );

  it.effect(
    "dual helper supports data-first and pipe-friendly data-last zipWith",
    Effect.fnUntraced(function* () {
      const lenA = Composable.makeOperation("lenA", S.String, S.Finite, (s) => Effect.succeed(s.length));
      const lenB = Composable.makeOperation("lenB", S.String, S.Finite, (s) => Effect.succeed(s.length * 10));

      const dataFirst = Composable.zipWith(lenA, lenB, (a, b) => a + b, S.Finite);
      const dataLast = pipe(
        lenA,
        Composable.zipWith(lenB, (a, b) => a + b, S.Finite)
      );

      expect(yield* dataFirst.run("abc")).toBe(33);
      expect(yield* dataLast.run("abc")).toBe(33);
    })
  );
});

describe("compose + traverse + aggregate", () => {
  it.effect(
    "compose threads output into the next operation's input",
    Effect.fnUntraced(function* () {
      const pipeline = Composable.compose(len, inc);
      expect(yield* pipeline.run("hello")).toBe(6);
    })
  );

  it.effect(
    "compose supports pipe-friendly data-last usage",
    Effect.fnUntraced(function* () {
      const pipeline = pipe(len, Composable.compose(inc));
      expect(yield* pipeline.run("hello")).toBe(6);
    })
  );

  it.effect(
    "traverse maps an operation over an array of inputs",
    Effect.fnUntraced(function* () {
      const lengths = yield* Composable.traverse(len)(["a", "bb", "ccc"]);
      expect(lengths).toEqual([1, 2, 3]);
    })
  );

  it("aggregate folds values with a monoid", () => {
    const total = Composable.aggregate(Monoid.NumberSum, (s: string) => s.length)(["a", "bb", "ccc"]);
    expect(total).toBe(6);
  });
});

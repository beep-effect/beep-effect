/**
 * Proofs for the TypeClass operations: the functor laws for map, monadic chain,
 * applicative ap, the alt monoid, composition, executeOperation layering, the
 * Foldable graph instance, and the utility combinators (when/unless/replicate).
 *
 * Effect v4 + `@effect/vitest` coverage for TypeClass tests.
 * Operations are effectful node producers (Clock + Random id), so the proofs run
 * under the default test runtime.
 */

import * as EG from "@beep/nlp-processing/Graph/EffectGraph";
import * as TC from "@beep/nlp-processing/Graph/TypeClass";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";

describe("TypeClass pure operations", () => {
  it.effect(
    "pureOperation mints a child per produced value",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("hello world");
      const splitOp = TC.pureOperation("split", (s: string) => s.split(" "));
      const out = yield* splitOp.apply(node);
      expect(out.length).toBe(2);
      expect(out.map((n) => n.data)).toEqual(["hello", "world"]);
    })
  );

  it.effect(
    "mapOperation transforms data 1:1",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("abc");
      const upper = TC.mapOperation("upper", (s: string) => s.toUpperCase());
      const out = yield* upper.apply(node);
      expect(out.length).toBe(1);
      expect(out[0]?.data).toBe("ABC");
    })
  );

  it.effect(
    "filterOperation keeps or drops by predicate",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("keep");
      const keepLong = TC.filterOperation("keepLong", (s: string) => s.length > 3);
      expect((yield* keepLong.apply(node)).length).toBe(1);
      const dropAll = TC.filterOperation("dropShort", (s: string) => s.length > 99);
      expect((yield* dropAll.apply(node)).length).toBe(0);
    })
  );
});

describe("TypeClass functor laws", () => {
  it.effect(
    "map identity: map(op, id) = op",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("x");
      const op = TC.pureOperation("dup", (s: string) => [s, s]);
      const mapped = TC.map(op, (s) => s);
      const a = yield* op.apply(node);
      const b = yield* mapped.apply(node);
      expect(a.map((n) => n.data)).toEqual(b.map((n) => n.data));
    })
  );

  it.effect(
    "map composition: map(op, f∘g) = map(map(op, g), f)",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("ab");
      const op = TC.pureOperation("id", (s: string) => [s]);
      const f = (s: string): string => s.toUpperCase();
      const g = (s: string): string => `${s}!`;
      const composed = yield* TC.map(op, (s) => f(g(s))).apply(node);
      const sequential = yield* TC.map(TC.map(op, g), f).apply(node);
      expect(composed.map((n) => n.data)).toEqual(sequential.map((n) => n.data));
    })
  );
});

describe("TypeClass monad & applicative", () => {
  it.effect(
    "chain sequences dependent operations",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("a b");
      const split = TC.pureOperation("split", (s: string) => s.split(" "));
      const chained = TC.chain(split, (token) => TC.mapOperation(`up-${token}`, (s: string) => s.toUpperCase()));
      const out = yield* chained.apply(node);
      expect(out.map((n) => n.data).sort()).toEqual(["A", "B"]);
    })
  );

  it.effect(
    "ap forms the Cartesian product of functions and values",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("seed");
      const fns = TC.pureOperation<string, (s: string) => string>("fns", () => [(s) => `${s}1`, (s) => `${s}2`]);
      const vals = TC.pureOperation("vals", () => ["x", "y"]);
      const out = yield* TC.ap(fns, vals).apply(node);
      expect(out.length).toBe(4);
    })
  );

  it.effect(
    "pure lifts a constant value",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("ignored");
      const out = yield* TC.pure<string, number>(42).apply(node);
      expect(out.length).toBe(1);
      expect(out[0]?.data).toBe(42);
    })
  );
});

describe("TypeClass alt & combinators", () => {
  it.effect(
    "alt collects results from both operations",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("x");
      const one = TC.pureOperation("one", (s: string) => [s]);
      const two = TC.pureOperation("two", (s: string) => [`${s}${s}`]);
      const out = yield* TC.alt(one, two).apply(node);
      expect(out.length).toBe(2);
    })
  );

  it.effect(
    "empty is the identity for alt",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("x");
      const out = yield* TC.empty<string, string>().apply(node);
      expect(out.length).toBe(0);
      const nonempty = TC.pureOperation("nonempty", (value: string) => [value, `${value}!`]);
      const expected = A.map(yield* nonempty.apply(node), (child) => child.data);
      const left = yield* TC.alt(TC.empty<string, string>(), nonempty).apply(node);
      const right = yield* TC.alt(nonempty, TC.empty<string, string>()).apply(node);
      expect(A.map(left, (child) => child.data)).toEqual(expected);
      expect(A.map(right, (child) => child.data)).toEqual(expected);
    })
  );

  it.effect(
    "when / unless gate on the predicate",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("hello");
      const op = TC.mapOperation("id", (s: string) => s);
      expect((yield* TC.when((s: string) => s.length > 3, op).apply(node)).length).toBe(1);
      expect((yield* TC.unless((s: string) => s.length > 3, op).apply(node)).length).toBe(0);
    })
  );

  it.effect(
    "replicate applies an operation n times",
    Effect.fnUntraced(function* () {
      const node = yield* EG.makeNode("x");
      const op = TC.pureOperation("id", (s: string) => [s]);
      const out = yield* TC.replicate(op, 3).apply(node);
      expect(out.length).toBe(3);
    })
  );
});

describe("TypeClass graph execution & folding", () => {
  it.effect(
    "executeOperation adds a child layer to leaves",
    Effect.fnUntraced(function* () {
      const g0 = yield* EG.singleton("root text");
      const split = TC.pureOperation("split", (s: string) => s.split(" "));
      const g1 = yield* TC.executeOperation(g0, split);
      expect(EG.size(g1)).toBe(3);
    })
  );

  it.effect(
    "foldableGraph folds over all node data",
    Effect.fnUntraced(function* () {
      const g0 = yield* EG.singleton("aaa");
      const split = TC.pureOperation("chars", (s: string) => s.split(""));
      const g1 = yield* TC.executeOperation(g0, split);
      const foldable = TC.foldableGraph<string>();
      const totalLen = foldable.fold(g1, (acc, s) => acc + s.length, 0);
      expect(totalLen).toBe(6);
      expect(TC.collectData(g1).length).toBe(4);
    })
  );
});

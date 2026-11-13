import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { RecursiveArraySizeHint } from "../src/internal/RecursionHint.ts";

// An array that carries the hint, the same array without it, and one that combines the hint with a real check.
const Hinted = S.Array(S.String).check(RecursiveArraySizeHint);
const Plain = S.Array(S.String);
const HintedNonEmpty = S.Array(S.String).check(RecursiveArraySizeHint, S.isMinLength(1));

// The shape the hint exists for: an array on a recursive cycle.
interface Tree {
  readonly label: string;
  readonly children: ReadonlyArray<Tree>;
}

const Tree = S.Struct({
  label: S.String,
  children: S.Array(S.suspend((): S.Codec<Tree> => Tree)).check(RecursiveArraySizeHint),
});

const widestFanOut = (tree: Tree): number =>
  A.reduce(tree.children, A.length(tree.children), (widest, child) => Order.max(Order.Number)(widest, widestFanOut(child)));

const nodeCount = (tree: Tree): number => A.reduce(tree.children, 1, (count, child) => count + nodeCount(child));

const lengths = (arrays: ReadonlyArray<ReadonlyArray<unknown>>): ReadonlyArray<number> =>
  A.sort(A.dedupe(A.map(arrays, A.length)), Order.Number);

describe("RecursiveArraySizeHint", () => {
  // Law: the hint is not a constraint on values. Whatever the array holds and however long it is, the check passes.
  it.prop(
    "never rejects: a hinted array guards every array the plain array guards",
    [Arbitrary.schema(Plain)],
    ([strings]) => S.is(Hinted)(strings),
    { arbitrary: fcRuns(200) }
  );

  it.effect(
    "never rejects: arrays far longer than two elements decode, encode and guard unchanged",
    Effect.fnUntraced(function* () {
      const sizes = [0, 1, 2, 3, 10, 1000, 20_000];
      // `A.makeBy` never builds an empty array, so the empty case is spelled out.
      const arrays = A.map(sizes, (size) => (size === 0 ? A.empty<string>() : A.makeBy(size, (index) => `item-${index}`)));
      const decoded = yield* Effect.forEach(arrays, (strings) => S.decodeEffect(Hinted)(strings));
      const encoded = yield* Effect.forEach(decoded, (strings) => S.encodeEffect(Hinted)(strings));
      deepStrictEqual(A.map(decoded, A.length), sizes);
      deepStrictEqual(encoded, arrays);
      deepStrictEqual(A.map(arrays, S.is(Hinted)), A.map(sizes, () => true));
    })
  );

  it.effect(
    "never rejects by itself: only the array's own element and length checks still refuse a value",
    Effect.fnUntraced(function* () {
      const exits = yield* Effect.all([
        Effect.exit(S.decodeEffect(Hinted)(["a", "b", "c", "d"])),
        Effect.exit(S.decodeEffect(HintedNonEmpty)(["a", "b", "c", "d"])),
        // Refused by the element schema, not by the hint.
        Effect.exit(S.decodeUnknownEffect(Hinted)(["a", 2])),
        Effect.exit(S.decodeUnknownEffect(Hinted)("abc")),
        // Refused by the real minimum-length check that sits beside the hint.
        Effect.exit(S.decodeEffect(HintedNonEmpty)([])),
      ]);
      deepStrictEqual(A.map(exits, Exit.isSuccess), [true, true, false, false, false]);
      assertFalse(S.is(HintedNonEmpty)([]));
      assertTrue(S.is(HintedNonEmpty)(A.makeBy(50, () => "x")));
    })
  );

  it.effect(
    "never rejects on a recursive schema: a node with five children decodes",
    Effect.fnUntraced(function* () {
      const leaf = (label: string): Tree => ({ label, children: [] });
      const wide: Tree = { label: "root", children: A.map(["a", "b", "c", "d", "e"], leaf) };
      const decoded = yield* S.decodeEffect(Tree)(wide);
      strictEqual(A.length(decoded.children), 5);
      assertTrue(S.is(Tree)(wide));
      const encoded = yield* S.encodeEffect(Tree)(decoded);
      deepStrictEqual(encoded, wide);
    })
  );

  // Law: only generation reads the hint, and it caps a derived array at two elements.
  it.prop(
    "an arbitrary derived over a hinted array never generates more than two elements",
    [Arbitrary.schema(Hinted)],
    ([strings]) => A.length(strings) <= 2,
    { arbitrary: fcRuns(500) }
  );

  it.effect(
    "generates every length from zero through two, and nothing longer, across seeds",
    Effect.fnUntraced(function* () {
      const samples = yield* Effect.forEach([1, 2, 3, 4, 5], (seed) =>
        Arbitrary.sampleEffect(Arbitrary.schema(Hinted), { count: 200, seed })
      );
      const all = A.flatten(samples);
      strictEqual(A.length(all), 1000);
      deepStrictEqual(lengths(all), [0, 1, 2]);
      assertTrue(A.every(all, S.is(Hinted)));
    })
  );

  it.effect(
    "is what caps the length: the same array without the hint generates longer arrays",
    Effect.fnUntraced(function* () {
      const plain = yield* Arbitrary.sampleEffect(Arbitrary.schema(Plain), { count: 200, seed: 1 });
      const hinted = yield* Arbitrary.sampleEffect(Arbitrary.schema(Hinted), { count: 200, seed: 1 });
      assertTrue(A.some(plain, (strings) => A.length(strings) > 2));
      assertFalse(A.some(hinted, (strings) => A.length(strings) > 2));
    })
  );

  it.effect(
    "composes with a real length check: generation honours both bounds",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(HintedNonEmpty), { count: 300, seed: 9 });
      deepStrictEqual(lengths(samples), [1, 2]);
      assertTrue(A.every(samples, S.is(HintedNonEmpty)));
    })
  );

  it.effect(
    "keeps generated recursive trees finite: no node has more than two children",
    Effect.fnUntraced(function* () {
      const trees = yield* Arbitrary.sampleEffect(Arbitrary.schema(Tree), { count: 200, seed: 3 });
      strictEqual(A.length(trees), 200);
      assertTrue(A.every(trees, S.is(Tree)));
      assertTrue(A.every(trees, (tree) => widestFanOut(tree) <= 2));
      // Generation recursed at least once, and every tree it built is finite.
      assertTrue(A.some(trees, (tree) => nodeCount(tree) > 1));
      assertTrue(A.every(A.map(trees, nodeCount), Number.isFinite));
      const returned = yield* Effect.forEach(
        trees,
        Effect.fnUntraced(function* (tree) {
          const encoded = yield* S.encodeEffect(Tree)(tree);
          const decoded = yield* S.decodeEffect(Tree)(encoded);
          return S.toEquivalence(Tree)(decoded, tree);
        })
      );
      assertTrue(A.every(returned, identity));
    })
  );
});

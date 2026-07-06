/**
 * Proofs for the EffectGraph engine: construction, child/root queries, the
 * catamorphism/anamorphism duality, and the Functor map.
 *
 * Effect v4 + `@effect/vitest` coverage for graph tests.
 * Node construction is effectful (Clock + Random id), so tests run under the
 * default test runtime.
 */

import * as EG from "@beep/nlp-processing/Graph/EffectGraph";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expect(equals(decode(encode(value)), value)).toBe(true);
    }),
    { numRuns: 50 }
  );
};

describe("EffectGraph construction", () => {
  it("round-trips schema-derived node ids and metadata", () => {
    assertSchemaRoundTrip(EG.NodeId);
    assertSchemaRoundTrip(EG.NodeMetadata);
  });

  it.effect(
    "singleton has one root node",
    Effect.fnUntraced(function* () {
      const g = yield* EG.singleton("root");
      expect(EG.size(g)).toBe(1);
      const roots = EG.getRoots(g);
      expect(roots).toHaveLength(1);
      expect(roots[0]?.data).toBe("root");
    })
  );

  it.effect(
    "addNode links a child under its parent",
    Effect.fnUntraced(function* () {
      const g0 = yield* EG.singleton("parent");
      const parent = EG.getRoots(g0)[0]!;
      const childNode = yield* EG.makeNode("child", O.some(parent.id));
      const g1 = EG.addNode(g0, childNode);
      expect(EG.size(g1)).toBe(2);
      const children = EG.getChildren(g1, parent.id);
      expect(children).toHaveLength(1);
      expect(children[0]?.data).toBe("child");
      expect(children[0]?.metadata.depth).toBe(1);
    })
  );

  it.effect(
    "generates distinct node ids",
    Effect.fnUntraced(function* () {
      const a = yield* EG.makeNode("a");
      const b = yield* EG.makeNode("b");
      expect(a.id).not.toBe(b.id);
    })
  );
});

describe("Catamorphism", () => {
  it.effect(
    "counts nodes via a bottom-up fold (1 + sum of children)",
    Effect.fnUntraced(function* () {
      const g0 = yield* EG.singleton("root");
      const root = EG.getRoots(g0)[0]!;
      const c1 = yield* EG.makeNode("c1", O.some(root.id));
      const g1 = EG.addNode(g0, c1);
      const c2 = yield* EG.makeNode("c2", O.some(root.id));
      const g2 = EG.addNode(g1, c2);
      const gc = yield* EG.makeNode("gc", O.some(c1.id));
      const g3 = EG.addNode(g2, gc);
      const counts = yield* EG.cata<string, number>(
        g3,
        (_node, children) => 1 + A.reduce(children, 0, (s, n) => s + n)
      );
      expect(counts).toHaveLength(1);
      expect(counts[0]).toBe(4);
    })
  );

  it.effect(
    "collects data bottom-up",
    Effect.fnUntraced(function* () {
      const g0 = yield* EG.singleton("root");
      const root = EG.getRoots(g0)[0]!;
      const c1 = yield* EG.makeNode("a", O.some(root.id));
      const g1 = EG.addNode(g0, c1);
      const collected = yield* EG.cata(
        g1,
        (node, children): ReadonlyArray<string> => A.prepend(A.flatten(children), node.data)
      );
      expect(collected[0]).toContain("root");
      expect(collected[0]).toContain("a");
    })
  );
});

describe("Anamorphism", () => {
  it.effect(
    "unfolds a bounded tree from a numeric seed",
    Effect.fnUntraced(function* () {
      const g = yield* EG.ana<string, number>(2, (n) => Effect.succeed([`n${n}`, n > 0 ? [n - 1] : []] as const));
      expect(EG.size(g)).toBe(3);
      expect(EG.getRoots(g)).toHaveLength(1);
    })
  );
});

describe("Functor map", () => {
  it.effect(
    "map preserves structure and transforms data",
    Effect.fnUntraced(function* () {
      const g0 = yield* EG.singleton("root");
      const root = EG.getRoots(g0)[0]!;
      const c1 = yield* EG.makeNode("child", O.some(root.id));
      const g1 = EG.addNode(g0, c1);
      const mapped = EG.map(g1, (s) => s.toUpperCase());
      expect(EG.size(mapped)).toBe(2);
      const mappedRoot = EG.getRoots(mapped)[0]!;
      expect(mappedRoot.data).toBe("ROOT");
      const children = EG.getChildren(mapped, mappedRoot.id);
      expect(children[0]?.data).toBe("CHILD");
    })
  );
});

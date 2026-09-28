import * as EG from "@beep/nlp-processing/Graph/EffectGraph";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const assertSchemaRoundTrip = Effect.fn("assertSchemaRoundTrip")(function* <
  Schema extends S.Codec<unknown, unknown, never, never>,
>(schema: Schema, value: Schema["Type"], label: string) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value), label).toBe(true);
});

describe("EffectGraph construction", () => {
  it.effect.prop(
    "round-trips schema-derived node ids and metadata",
    { NodeId: Arbitrary.schema(EG.NodeId), NodeMetadata: Arbitrary.schema(EG.NodeMetadata) },
    (values) =>
      Effect.gen(function* () {
        yield* assertSchemaRoundTrip(EG.NodeId, values.NodeId, "EG.NodeId");
        yield* assertSchemaRoundTrip(EG.NodeMetadata, values.NodeMetadata, "EG.NodeMetadata");
      }),
    { arbitrary: fcRuns(50) }
  );

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

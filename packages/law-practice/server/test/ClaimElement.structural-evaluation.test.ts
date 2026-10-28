import { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { compareStructuralFamily, StructuralEvaluationError } from "./evaluation/Structural.ts";

const decode = S.decodeUnknownEffect(S.Array(ClaimElementTree));
const fixture = (path = "1.a", producer = "llm", head = "sensor", start = 13) => {
  const introduced = { startChar: 0, endChar: 8, quote: "A sensor" };
  const referring = { startChar: start, endChar: start + 10, quote: "the sensor" };
  return {
    claimNumber: 1,
    producer,
    elements: [
      {
        path: "1",
        kind: "preamble-subject",
        anchor: introduced,
        terms: [{ anchor: introduced, determiner: "a", head: "sensor" }],
      },
      { path, kind: "limitation", anchor: referring, terms: [{ anchor: referring, determiner: "the", head }] },
    ],
    edges: [
      { kind: "part-of", child: path, parent: "1" },
      { kind: "antecedent", referring: { path, anchor: referring }, introducing: { path: "1", anchor: introduced } },
    ],
  };
};

describe("strict source-anchored structural measurement", () => {
  it.effect("accepts a consistent path renaming and different producer metadata", () =>
    Effect.gen(function* () {
      const gold = yield* decode([fixture()]);
      const predicted = yield* decode([fixture("1.b", "rule")]);
      const score = yield* Effect.fromOption(A.head(yield* compareStructuralFamily(gold, predicted)));
      assert.isTrue(score.strict);
    })
  );
  it.effect("rejects changed lexical heads and exact span shifts", () =>
    Effect.gen(function* () {
      const gold = yield* decode([fixture()]);
      for (const changed of [fixture("1.a", "rule", "camera"), fixture("1.a", "rule", "sensor", 14)]) {
        const scores = yield* compareStructuralFamily(gold, yield* decode([changed]));
        assert.isTrue(A.every(scores, (score) => !score.strict));
      }
    })
  );
  it.effect("compares typed edges as a multiset and keeps their diagnostic denominator", () =>
    Effect.gen(function* () {
      const raw = fixture("1.b", "rule");
      const gold = yield* decode([fixture()]);
      const predicted = yield* decode([{ ...raw, edges: A.take(raw.edges, 1) }]);
      const scores = yield* compareStructuralFamily(gold, predicted);
      assert.deepStrictEqual(
        A.map(scores, (score) => [score.strict, score.goldEdges, score.predictedEdges, score.matchedEdges]),
        [[false, 2, 1, 1]]
      );
    })
  );
  it.effect("retains a missing prediction as a failed selected claim", () =>
    Effect.gen(function* () {
      const scores = yield* compareStructuralFamily(yield* decode([fixture()]), []);
      assert.deepStrictEqual(
        A.map(scores, (score) => [score.strict, score.predictionMissing, score.goldEdges]),
        [[false, true, 2]]
      );
    })
  );
  it.effect("distinguishes identical source spans in different claims under the shared mapping", () =>
    Effect.gen(function* () {
      const dependent = (donor: string) => {
        const raw = fixture("2.a", "rule");
        return {
          ...raw,
          claimNumber: 2,
          elements: A.map(raw.elements, (element) => ({ ...element, path: element.path === "1" ? "2" : "2.a" })),
          edges: [
            { kind: "part-of", child: "2.a", parent: "2" },
            { kind: "depends-on-element", dependent: "2", ancestor: "1" },
            {
              kind: "antecedent",
              referring: { path: "2.a", anchor: { startChar: 13, endChar: 23, quote: "the sensor" } },
              introducing: { path: donor, anchor: { startChar: 0, endChar: 8, quote: "A sensor" } },
            },
          ],
        };
      };
      const gold = yield* decode([fixture(), dependent("1")]);
      const correct = yield* compareStructuralFamily(gold, yield* decode([fixture("1.b", "rule"), dependent("1")]));
      assert.isTrue(A.every(correct, (score) => score.strict));
      const wrong = yield* compareStructuralFamily(gold, yield* decode([fixture("1.b", "rule"), dependent("2")]));
      assert.deepStrictEqual(
        A.map(wrong, (score) => score.strict),
        [true, false]
      );
    })
  );

  it.effect("preserves the order of functional text and term parts", () =>
    Effect.gen(function* () {
      const raw = fixture();
      const owner = { startChar: 13, endChar: 24, quote: "the sensor!" };
      const parts = [
        { kind: "term", term: { path: "1.a", anchor: { startChar: 13, endChar: 23, quote: "the sensor" } } },
        { kind: "text", anchor: { startChar: 23, endChar: 24, quote: "!" } },
      ];
      const make = (reverse: boolean) => ({
        ...raw,
        elements: A.map(raw.elements, (element) =>
          element.path === "1.a" ? { ...element, kind: "functional-relation", anchor: owner } : element
        ),
        edges: A.append(raw.edges, { kind: "functional", element: "1.a", parts: reverse ? A.reverse(parts) : parts }),
      });
      const gold = yield* decode([make(false)]);
      const score = yield* compareStructuralFamily(gold, yield* decode([make(true)]));
      assert.deepStrictEqual(
        A.map(score, (value) => [value.strict, value.matchedEdges, value.goldEdges]),
        [[false, 2, 3]]
      );
    })
  );
  it.effect("rejects ambiguous node identities instead of choosing edge-specific mappings", () =>
    Effect.gen(function* () {
      const gold = yield* decode([fixture()]);
      const error = yield* Effect.flip(compareStructuralFamily(A.appendAll(gold, gold), gold));
      assert.isTrue(S.is(StructuralEvaluationError)(error));
    })
  );
});

// A positive control on the complete frozen corpus guards against an always-false scorer.
describe("frozen corpus scorer control", () => {
  it.layer(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))((it) => {
    it.effect("accepts every reference against itself without invoking production decomposition", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const freezePath = yield* path.fromFileUrl(
          new URL("../../../../goals/claim-element-antecedent-check/research/reference-freeze.json", import.meta.url)
        );
        const freeze = yield* S.decodeEffect(
          S.fromJsonString(S.Struct({ families: S.Array(S.Struct({ familyId: S.String })) }))
        )(yield* fs.readFileString(freezePath));
        let passed = 0;
        for (const family of freeze.families) {
          const filename = yield* path.fromFileUrl(
            new URL(
              `../../domain/test/fixtures/claim-element/positive/${family.familyId}/expected.json`,
              import.meta.url
            )
          );
          const trees = yield* ClaimElementTree.pipe(
            S.Array,
            S.fromJsonString,
            S.decodeEffect
          )(yield* fs.readFileString(filename));
          const scores = yield* compareStructuralFamily(trees, trees);
          assert.isTrue(A.every(scores, (score) => score.strict));
          passed += scores.length;
        }
        assert.strictEqual(freeze.families.length, 60);
        assert.strictEqual(passed, 538);
      })
    );
  });
});

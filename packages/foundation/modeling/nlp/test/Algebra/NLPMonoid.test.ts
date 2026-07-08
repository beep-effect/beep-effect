/**
 * Property-based tests ("proofs") for NLP-specific monoid laws.
 *
 * Verifies the NLP monoids satisfy the monoid laws. Note: `SentenceConcat` is a
 * "near-monoid" — it satisfies the identity laws but NOT strict associativity
 * (punctuation normalization is not associative), so only identity is asserted
 * for it, exactly as in the legacy property suite.
 *
 * Property-based coverage for Effect v4's
 * `effect/testing/FastCheck`.
 */

import * as NLP from "@beep/nlp/Algebra/NLPMonoid";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { BagOfWords } from "@beep/nlp/Algebra/NLPMonoid";

const mutableHashMapEquals = <K, V>(
  a: MutableHashMap.MutableHashMap<K, V>,
  b: MutableHashMap.MutableHashMap<K, V>
): boolean => {
  if (MutableHashMap.size(a) !== MutableHashMap.size(b)) return false;
  for (const [key, value] of a) {
    if (!O.contains(MutableHashMap.get(b, key), value)) return false;
  }
  return true;
};

const lookupNumber = (map: MutableHashMap.MutableHashMap<string, number>, key: string): number =>
  O.getOrElse(MutableHashMap.get(map, key), () => -1);

const hashSetEquals = <A>(a: HashSet.HashSet<A>, b: HashSet.HashSet<A>): boolean => {
  if (HashSet.size(a) !== HashSet.size(b)) return false;
  for (const elem of a) {
    if (!HashSet.has(b, elem)) return false;
  }
  return true;
};

const testMonoidLaws = <A>(
  name: string,
  monoid: { empty: A; combine: (x: A, y: A) => A },
  arbitrary: fc.Arbitrary<A>,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
) => {
  describe(`${name} Monoid Laws`, () => {
    it("satisfies left identity", () => {
      fc.assert(fc.property(arbitrary, (x) => equals(monoid.combine(monoid.empty, x), x)));
    });
    it("satisfies right identity", () => {
      fc.assert(fc.property(arbitrary, (x) => equals(monoid.combine(x, monoid.empty), x)));
    });
    it("satisfies associativity", () => {
      fc.assert(
        fc.property(arbitrary, arbitrary, arbitrary, (x, y, z) => {
          const left = monoid.combine(monoid.combine(x, y), z);
          const right = monoid.combine(x, monoid.combine(y, z));
          return equals(left, right);
        })
      );
    });
  });
};

// Token monoids
describe("Token Monoids", () => {
  testMonoidLaws("TokenConcat", NLP.TokenConcat, fc.string());

  describe("TokenBagOfWords", () => {
    const bowArbitrary: fc.Arbitrary<BagOfWords> = fc
      .dictionary(fc.string(), fc.integer({ min: 1, max: 100 }))
      .map((dict) => MutableHashMap.fromIterable(R.toEntries(dict)));
    testMonoidLaws("TokenBagOfWords", NLP.TokenBagOfWords, bowArbitrary, mutableHashMapEquals);
  });

  describe("TokenSetUnion", () => {
    const setArbitrary: fc.Arbitrary<HashSet.HashSet<string>> = fc.array(fc.string()).map(HashSet.fromIterable);
    testMonoidLaws("TokenSetUnion", NLP.TokenSetUnion, setArbitrary, hashSetEquals);
  });
});

// Sentence monoids
describe("Sentence Monoids", () => {
  describe("SentenceConcat (near-monoid: identity only)", () => {
    it("satisfies left identity", () => {
      fc.assert(fc.property(fc.string(), (x) => NLP.SentenceConcat.combine(NLP.SentenceConcat.empty, x) === x));
    });
    it("satisfies right identity", () => {
      fc.assert(fc.property(fc.string(), (x) => NLP.SentenceConcat.combine(x, NLP.SentenceConcat.empty) === x));
    });
  });

  testMonoidLaws(
    "SentenceArray",
    NLP.SentenceArray,
    fc.array(fc.string()),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  );
});

// Document monoids
describe("Document Monoids", () => {
  testMonoidLaws("DocumentText", NLP.DocumentText, fc.string());

  describe("DocumentStats", () => {
    const statsArbitrary = fc.record({
      wordCount: fc.integer({ min: 0, max: 1000 }),
      sentenceCount: fc.integer({ min: 0, max: 100 }),
      charCount: fc.integer({ min: 0, max: 10000 }),
    });
    const statsEquals = S.toEquivalence(NLP.DocumentStatistics);
    testMonoidLaws("DocumentStats", NLP.DocumentStats, statsArbitrary, statsEquals);

    it("round-trips schema-derived document statistics values", () => {
      fc.assert(
        fc.property(S.toArbitrary(NLP.DocumentStatistics), (stats) => {
          const encoded = Effect.runSync(S.encodeEffect(NLP.DocumentStatistics)(stats));
          const decoded = Effect.runSync(S.decodeUnknownEffect(NLP.DocumentStatistics)(encoded));

          expect(statsEquals(decoded, stats)).toBe(true);
        })
      );
    });
  });
});

// Linguistic monoids
describe("Linguistic Monoids", () => {
  it("round-trips schema-derived dependency edges", () => {
    const edgeEquals = S.toEquivalence(NLP.DependencyEdge);

    fc.assert(
      fc.property(S.toArbitrary(NLP.DependencyEdge), (edge) => {
        const encoded = Effect.runSync(S.encodeEffect(NLP.DependencyEdge)(edge));
        const decoded = Effect.runSync(S.decodeUnknownEffect(NLP.DependencyEdge)(encoded));

        expect(edgeEquals(decoded, edge)).toBe(true);
      })
    );
  });

  describe("AnnotationMap", () => {
    const annotationArbitrary: fc.Arbitrary<MutableHashMap.MutableHashMap<number, string>> = fc
      .array(fc.tuple(fc.integer(), fc.string()))
      .map(MutableHashMap.fromIterable);
    testMonoidLaws("AnnotationMap", NLP.AnnotationMap<number, string>(), annotationArbitrary, mutableHashMapEquals);
  });
});

describe("TextAnalysis", () => {
  it("round-trips schema-derived text analysis values", () => {
    const analysisEquals = S.toEquivalence(NLP.TextAnalysis);

    fc.assert(
      fc.property(S.toArbitrary(NLP.TextAnalysis), (analysis) => {
        const encoded = Effect.runSync(S.encodeEffect(NLP.TextAnalysis)(analysis));
        const decoded = Effect.runSync(S.decodeUnknownEffect(NLP.TextAnalysis)(encoded));

        expect(analysisEquals(decoded, analysis)).toBe(true);
      })
    );
  });
});

// Utility functions
describe("Utility Functions", () => {
  it("bagOfWordsToTF normalizes frequencies", () => {
    const bow: BagOfWords = MutableHashMap.make(["the", 2], ["cat", 1], ["sat", 1]);
    const tf = NLP.bagOfWordsToTF(bow);
    expect(lookupNumber(tf, "the")).toBeCloseTo(0.5);
    expect(lookupNumber(tf, "cat")).toBeCloseTo(0.25);
    expect(lookupNumber(tf, "sat")).toBeCloseTo(0.25);
  });

  it("computeTFIDF calculates TF-IDF scores", () => {
    const tf = MutableHashMap.make(["common", 0.5], ["rare", 0.1]);
    const df = MutableHashMap.make(["common", 100], ["rare", 1]);
    const tfidf = NLP.computeTFIDF(tf, { df, totalDocs: 100 });
    expect(lookupNumber(tfidf, "common")).toBeCloseTo(0);
    expect(lookupNumber(tfidf, "rare")).toBeGreaterThan(0);
  });
});

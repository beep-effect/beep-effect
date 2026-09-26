import { fcRuns } from "@beep/test-utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
/**
 * Property-based tests ("proofs") for NLP-specific monoid laws.
 *
 * Verifies the NLP monoids satisfy the monoid laws. Note: `SentenceConcat` is a
 * "near-monoid" — it satisfies the identity laws but NOT strict associativity
 * (punctuation normalization is not associative), so only identity is asserted
 * for it, exactly as in the legacy property suite.
 *
 * Property-based coverage for Effect v4's
 * `effect/Arbitrary`.
 */

import * as NLP from "@beep/nlp/Algebra/NLPMonoid";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { BagOfWords } from "@beep/nlp/Algebra/NLPMonoid";

const decodeNLPDependencyEdge = S.decodeEffect(NLP.DependencyEdge);
const decodeNLPDocumentStatistics = S.decodeEffect(NLP.DocumentStatistics);
const decodeNLPTextAnalysis = S.decodeEffect(NLP.TextAnalysis);
const encodeNLPDependencyEdge = S.encodeEffect(NLP.DependencyEdge);
const encodeNLPDocumentStatistics = S.encodeEffect(NLP.DocumentStatistics);
const encodeNLPTextAnalysis = S.encodeEffect(NLP.TextAnalysis);

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
  arbitrary: Arbitrary.Arbitrary<A>,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
) => {
  describe(`${name} Monoid Laws`, () => {
    it.prop("satisfies left identity", [arbitrary], ([x]) => equals(monoid.combine(monoid.empty, x), x), {
      arbitrary: fcRuns(100),
    });

    it.prop("satisfies right identity", [arbitrary], ([x]) => equals(monoid.combine(x, monoid.empty), x), {
      arbitrary: fcRuns(100),
    });

    it.prop(
      "satisfies associativity",
      [arbitrary, arbitrary, arbitrary],
      ([x, y, z]) => {
        const left = monoid.combine(monoid.combine(x, y), z);
        const right = monoid.combine(x, monoid.combine(y, z));
        return equals(left, right);
      },
      { arbitrary: fcRuns(100) }
    );
  });
};

// Token monoids
describe("Token Monoids", () => {
  testMonoidLaws("TokenConcat", NLP.TokenConcat, Arbitrary.schema(S.String));

  describe("TokenBagOfWords", () => {
    const bowArbitrary: Arbitrary.Arbitrary<BagOfWords> = Arbitrary.all([
      Arbitrary.schema(S.String),
      Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(100))),
    ]).pipe(
      Arbitrary.map(([key, value]) => ({ [key]: value })),
      Arbitrary.map((dict) => MutableHashMap.fromIterable(R.toEntries(dict)))
    );
    testMonoidLaws("TokenBagOfWords", NLP.TokenBagOfWords, bowArbitrary, mutableHashMapEquals);
  });

  describe("TokenSetUnion", () => {
    const setArbitrary = S.String.pipe(S.HashSet, Arbitrary.schema);
    testMonoidLaws("TokenSetUnion", NLP.TokenSetUnion, setArbitrary, hashSetEquals);
  });
});

// Sentence monoids
describe("Sentence Monoids", () => {
  describe("SentenceConcat (near-monoid: identity only)", () => {
    it.prop(
      "satisfies left identity",
      [Arbitrary.schema(S.String)],
      ([x]) => NLP.SentenceConcat.combine(NLP.SentenceConcat.empty, x) === x,
      { arbitrary: fcRuns(100) }
    );

    it.prop(
      "satisfies right identity",
      [Arbitrary.schema(S.String)],
      ([x]) => NLP.SentenceConcat.combine(x, NLP.SentenceConcat.empty) === x,
      { arbitrary: fcRuns(100) }
    );
  });

  testMonoidLaws(
    "SentenceArray",
    NLP.SentenceArray,
    Arbitrary.schema(S.Array(S.String).check(S.isMinLength(0), S.isMaxLength(10))),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  );
});

// Document monoids
describe("Document Monoids", () => {
  testMonoidLaws("DocumentText", NLP.DocumentText, Arbitrary.schema(S.String));

  describe("DocumentStats", () => {
    const statsArbitrary = Arbitrary.all({
      wordCount: Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1000))),
      sentenceCount: Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(100))),
      charCount: Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(10000))),
    });
    const statsEquals = S.toEquivalence(NLP.DocumentStatistics);
    testMonoidLaws("DocumentStats", NLP.DocumentStats, statsArbitrary, statsEquals);

    it.prop(
      "round-trips schema-derived document statistics values",
      [Arbitrary.schema(NLP.DocumentStatistics)],
      ([stats]) => {
        const encoded = Effect.runSync(encodeNLPDocumentStatistics(stats));
        const decoded = Effect.runSync(decodeNLPDocumentStatistics(encoded));

        expect(statsEquals(decoded, stats)).toBe(true);

        return true;
      },
      { arbitrary: fcRuns(100) }
    );
  });
});

// Linguistic monoids
describe("Linguistic Monoids", () => {
  const edgeEquals = S.toEquivalence(NLP.DependencyEdge);
  it.prop(
    "round-trips schema-derived dependency edges",
    [Arbitrary.schema(NLP.DependencyEdge)],
    ([edge]) => {
      const encoded = Effect.runSync(encodeNLPDependencyEdge(edge));
      const decoded = Effect.runSync(decodeNLPDependencyEdge(encoded));

      expect(edgeEquals(decoded, edge)).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(100) }
  );

  describe("AnnotationMap", () => {
    const annotationArbitrary: Arbitrary.Arbitrary<MutableHashMap.MutableHashMap<number, string>> = Arbitrary.schema(
      S.Int.check(S.isBetween({ minimum: 0, maximum: 10 }))
    ).pipe(
      Arbitrary.flatMap((count) =>
        Arbitrary.all(A.replicate(Arbitrary.all([Arbitrary.schema(S.Int), Arbitrary.schema(S.String)]), count))
      ),
      Arbitrary.map(MutableHashMap.fromIterable)
    );
    testMonoidLaws("AnnotationMap", NLP.AnnotationMap<number, string>(), annotationArbitrary, mutableHashMapEquals);
  });
});

describe("TextAnalysis", () => {
  const analysisEquals = S.toEquivalence(NLP.TextAnalysis);
  it.prop(
    "round-trips schema-derived text analysis values",
    [Arbitrary.schema(NLP.TextAnalysis)],
    ([analysis]) => {
      const encoded = Effect.runSync(encodeNLPTextAnalysis(analysis));
      const decoded = Effect.runSync(decodeNLPTextAnalysis(encoded));

      expect(analysisEquals(decoded, analysis)).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(100) }
  );
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

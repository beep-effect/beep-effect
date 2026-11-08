import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";

const sourceKey = "source-part-of-speech-control";
const lexicon = HashMap.fromIterable<string, string>([
  ["a", "DET"],
  ["an", "DET"],
  ["the", "DET"],
  ["said", "DET"],
  ["that", "SCONJ"],
  ["and", "CCONJ"],
  ["to", "PART"],
  ["of", "ADP"],
  ["on", "ADP"],
  ["comprising", "VERB"],
  ["arranged", "VERB"],
  ["extend", "VERB"],
  ["including", "VERB"],
  ["detects", "VERB"],
  ["stores", "VERB"],
  ["reaches", "VERB"],
  ["echo", "VERB"],
  ["erasing", "VERB"],
  ["extending", "VERB"],
  ["removing", "VERB"],
  ["drilling", "VERB"],
  ["downwardly", "ADV"],
  ["upwardly", "ADV"],
  ["left", "ADJ"],
  ["capable", "ADJ"],
  ["presents", "VERB"],
  ["right", "ADJ"],
]);

const evidenceFor = (text: string) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey,
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "explicit-source-control",
    assetDigest: "test-only",
    tokens: A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
      const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
      const isWord = O.isSome(Str.match(/^[\p{L}\p{N}]/u)(match[0]));
      return ClaimLexicalToken.make({
        anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
        pos: O.getOrElse(HashMap.get(lexicon, Str.toLowerCase(match[0])), () => (isWord ? "NOUN" : "PUNCT")),
        lemma: O.none(),
      });
    }),
    lexicalWorkConsumed: 0,
  });

const inputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey,
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });

const treeOf = Effect.fn("SourcePartOfSpeechTest.treeOf")(function* (text: string, withEvidence: boolean) {
  const prepared = yield* prepareClaimInspection(inputOf(text));
  const result = yield* decomposePreparedClaimRoles(prepared, withEvidence ? [evidenceFor(text)] : []);
  assert.deepStrictEqual(result.plans, []);
  const decomposition = O.getOrThrow(A.head(result.decompositions));
  assert.strictEqual(decomposition.status, "decomposed");
  return decomposition.status === "decomposed" ? decomposition.tree : yield* Effect.die("undecomposed control");
});
const quotesOf = (tree: ClaimElementTree) =>
  A.flatMap(tree.elements, ({ terms }) => A.map(terms, ({ anchor }) => anchor.quote));
const spansOf = (tree: ClaimElementTree) => A.map(A.drop(tree.elements, 1), ({ anchor }) => anchor.quote);

// The orphan continuation makes the source planner decline, so these exercise the fallback route.
const refused = (body: string) => `A system comprising ${body}; and stores the signal.`;

describe("part-of-speech bounded fallback terms", () => {
  it.effect("omits a verb from bare mentions only when aligned evidence supplies its tag", () =>
    Effect.gen(function* () {
      const text = refused("a unit that detects a signal");
      const bounded = yield* treeOf(text, true);
      const evidenceFree = yield* treeOf(text, false);
      assert.isFalse(A.contains(quotesOf(bounded), "stores"));
      assert.isTrue(A.contains(quotesOf(bounded), "the signal"));
      assert.isTrue(A.contains(quotesOf(evidenceFree), "stores"));
    })
  );

  it.effect("ends a determiner mention at an agreeing finite verb", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("a unit that detects the scan reaches a limit"), true);
      assert.isTrue(A.contains(quotesOf(tree), "the scan"));
      assert.isFalse(A.contains(quotesOf(tree), "the scan reaches"));
    })
  );

  it.effect("keeps compounds whose inner or final word the provider mistags as a verb", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("an image erasing apparatus on the pulse echo"), true);
      assert.isTrue(A.contains(quotesOf(tree), "an image erasing apparatus"));
      assert.isTrue(A.contains(quotesOf(tree), "the pulse echo"));
    })
  );

  it.effect("keeps a parenthetical abbreviation inside its mention", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("a user equipment (UE)"), true);
      assert.isTrue(A.contains(quotesOf(tree), "a user equipment (UE)"));
    })
  );

  it.effect("keeps coordinated and adverbial premodifiers with their head", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("the left and right posts on a downwardly extending left post"), true);
      assert.isTrue(A.contains(quotesOf(tree), "the left and right posts"));
      assert.isTrue(A.contains(quotesOf(tree), "a downwardly extending left post"));
    })
  );
});

describe("part-of-speech boundary rules", () => {
  it.effect("ends a mention at a trailing adjective but keeps one that modifies a following noun", () =>
    Effect.gen(function* () {
      const trailing = yield* treeOf(refused("a tab capable on a shaft"), true);
      const modifying = yield* treeOf(refused("a tab left post on a shaft"), true);
      assert.isTrue(A.contains(quotesOf(trailing), "a tab"));
      assert.isFalse(A.contains(quotesOf(trailing), "a tab capable"));
      assert.isTrue(A.contains(quotesOf(modifying), "a tab left post"));
    })
  );

  it.effect("cuts an inflected verb before a modifier unless it is a participial modifier", () =>
    Effect.gen(function* () {
      const finite = yield* treeOf(refused("the cabinet presents left bends"), true);
      const participial = yield* treeOf(refused("the image erasing left apparatus"), true);
      assert.isTrue(A.contains(quotesOf(finite), "the cabinet"));
      assert.isFalse(A.contains(quotesOf(finite), "the cabinet presents left bends"));
      assert.isTrue(A.contains(quotesOf(participial), "the image erasing left apparatus"));
    })
  );

  it.effect("joins coordinated adverbs and a coordinator directly before the head", () =>
    Effect.gen(function* () {
      const adverbs = yield* treeOf(refused("the upwardly and downwardly extending posts"), true);
      const headAfterCoordinator = yield* treeOf(refused("the left and posts"), true);
      assert.isTrue(A.contains(quotesOf(adverbs), "the upwardly and downwardly extending posts"));
      assert.isTrue(A.contains(quotesOf(headAfterCoordinator), "the left and posts"));
    })
  );
});

describe("parallel coordinate fallback elements", () => {
  it.effect("splits parallel items but not an inner list or an absolute clause", () =>
    Effect.gen(function* () {
      const parallel = yield* treeOf(refused("a seat bottom, a seat back"), true);
      const innerList = yield* treeOf(refused("a system including a terminal, a network"), true);
      const absolute = yield* treeOf(refused("a nut on a shaft, said nut being seated"), true);
      assert.deepStrictEqual(spansOf(parallel), ["a seat bottom", "a seat back", "stores the signal"]);
      assert.deepStrictEqual(spansOf(innerList), ["a system including a terminal, a network", "stores the signal"]);
      assert.deepStrictEqual(spansOf(absolute), ["a nut on a shaft, said nut being seated", "stores the signal"]);
    })
  );

  it.effect("splits parallel gerund steps and classifies them as functional", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("removing a plate, drilling a hole"), true);
      assert.deepStrictEqual(spansOf(tree), ["removing a plate", "drilling a hole", "stores the signal"]);
      assert.strictEqual(O.getOrThrow(A.get(tree.elements, 1)).kind, "functional-relation");
    })
  );

  it.effect("leaves the evidence-free segmentation unchanged", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("a seat bottom, a seat back"), false);
      assert.deepStrictEqual(spansOf(tree), ["a seat bottom, a seat back", "stores the signal"]);
    })
  );

  it.effect("never reports a declined plan as complete coverage", () =>
    Effect.gen(function* () {
      const text = refused("a seat bottom, a seat back");
      const prepared = yield* prepareClaimInspection(inputOf(text));
      const report = yield* inspectPreparedClaimRoles(prepared, [evidenceFor(text)]);
      assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "partial");
    })
  );
});

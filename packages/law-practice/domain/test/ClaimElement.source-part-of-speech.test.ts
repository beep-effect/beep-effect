import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  decomposeClaim,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
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
  ["supplies", "VERB"],
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
  ["processing", "VERB"],
  ["joint", "ADJ"],
  ["subassembly", "ADV"],
  ["presents", "VERB"],
  ["right", "ADJ"],
]);

const wholeHyphenatedTokens = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;
const splitHyphenatedTokens = /[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
const evidenceFor = (text: string, tokenPattern: RegExp = wholeHyphenatedTokens) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey,
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "explicit-source-control",
    assetDigest: "test-only",
    tokens: A.map(A.fromIterable(Str.matchAll(tokenPattern)(text)), (match) => {
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

  it.effect("applies no tag to a word the provider split differently", () =>
    Effect.gen(function* () {
      const text = refused("a plate on data-processing");
      const prepared = yield* prepareClaimInspection(inputOf(text));
      const split = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text, splitHyphenatedTokens)]);
      const whole = yield* treeOf(text, false);
      const decomposition = O.getOrThrow(A.head(split.decompositions));
      assert.isTrue(A.contains(quotesOf(whole), "data-processing"));
      assert.strictEqual(decomposition.status, "decomposed");
      if (decomposition.status === "decomposed")
        assert.isTrue(A.contains(quotesOf(decomposition.tree), "data-processing"));
    })
  );

  it.effect("keeps a compound whose final word the provider mistags as an adjective", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("the knee joint includes a plate"), true);
      assert.isTrue(A.contains(quotesOf(tree), "the knee joint"));
      assert.isFalse(A.contains(quotesOf(tree), "the knee"));
    })
  );

  it.effect("treats a word before a parenthetical reference numeral as nominal", () =>
    Effect.gen(function* () {
      const numbered = yield* treeOf(refused("said elastic subassembly (6) on a plate"), true);
      const unnumbered = yield* treeOf(refused("said elastic subassembly on a plate"), true);
      assert.isTrue(A.contains(quotesOf(numbered), "said elastic subassembly"));
      assert.isTrue(A.contains(quotesOf(unnumbered), "said elastic"));
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

describe("restated preamble subjects", () => {
  const preambleOf = (tree: ClaimElementTree) => O.getOrThrow(A.head(tree.elements)).anchor.quote;

  it.effect("runs the preamble through a restated head noun before the real transition", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(
        "A method for coating a plate comprising a shaft, the method comprising: removing a cover; and stores the signal.",
        true
      );
      assert.strictEqual(preambleOf(tree), "A method for coating a plate comprising a shaft, the method");
    })
  );

  it.effect("keeps the first transition for another noun, a finite verb or no evidence", () =>
    Effect.gen(function* () {
      const otherNoun = yield* treeOf(
        "A method comprising a shaft, the plate comprising a tab; and stores the signal.",
        true
      );
      const finiteVerb = yield* treeOf(
        "A knee joint comprising a shaft, the knee joint includes a tab; and stores the signal.",
        true
      );
      const evidenceFree = yield* treeOf(
        "A method comprising a shaft, the method comprising a tab; and stores the signal.",
        false
      );
      assert.strictEqual(preambleOf(otherNoun), "A method");
      assert.strictEqual(preambleOf(finiteVerb), "A knee joint");
      assert.strictEqual(preambleOf(evidenceFree), "A method");
    })
  );
});

describe("part-of-speech element kinds", () => {
  const kindOf = (tree: ClaimElementTree, quote: string) =>
    O.map(
      A.findFirst(tree.elements, ({ anchor }) => anchor.quote === quote),
      ({ kind }) => kind
    );

  it.effect("classifies an element with a tagged finite verb as functional", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("the module supplies power"), true);
      const evidenceFree = yield* treeOf(refused("the module supplies power"), false);
      assert.deepStrictEqual(kindOf(tree, "the module supplies power"), O.some("functional-relation"));
      assert.deepStrictEqual(kindOf(evidenceFree, "the module supplies power"), O.some("limitation"));
    })
  );

  it.effect("keeps a noun phrase with a participial modifier or a mistagged compound as a limitation", () =>
    Effect.gen(function* () {
      const participial = yield* treeOf(refused("an erasing plate"), true);
      const compound = yield* treeOf(refused("a pulse echo signal"), true);
      assert.deepStrictEqual(kindOf(participial, "an erasing plate"), O.some("limitation"));
      assert.deepStrictEqual(kindOf(compound, "a pulse echo signal"), O.some("limitation"));
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

  it.effect("nests a composed list of three or more items under its subject", () =>
    Effect.gen(function* () {
      const text = refused("the rod comprises a plate, a cover (2), and a base");
      const tree = yield* treeOf(text, true);
      const kindOf = (quote: string) =>
        O.map(
          A.findFirst(tree.elements, ({ anchor }) => anchor.quote === quote),
          ({ kind }) => kind
        );
      assert.deepStrictEqual(spansOf(tree), [
        "the rod comprises a plate, a cover (2), and a base",
        "a plate",
        "a cover (2)",
        "a base",
        "stores the signal",
      ]);
      assert.deepStrictEqual(kindOf("the rod comprises a plate, a cover (2), and a base"), O.some("limitation"));
      const edges = A.filter(tree.edges, ({ kind }) => kind === "part-of");
      assert.deepStrictEqual(
        A.map(edges, (edge) => (edge.kind === "part-of" ? edge.parent : "")),
        ["1", "1.a", "1.a", "1.a", "1"]
      );
    })
  );

  it.effect("does not split list items at a comma inside parentheses", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("the rod comprises a plate (a tab, a pin), a cover, and a base"), true);
      assert.deepStrictEqual(A.drop(spansOf(tree), 1), [
        "a plate (a tab, a pin)",
        "a cover",
        "a base",
        "stores the signal",
      ]);
    })
  );

  it.effect("keeps a two-object composition flat and does not nest without evidence", () =>
    Effect.gen(function* () {
      const twoObjects = refused("the rod comprises a plate and a cover");
      const threeObjects = refused("the rod comprises a plate, a cover, and a base");
      const flat = yield* treeOf(twoObjects, true);
      const evidenceFree = yield* treeOf(threeObjects, false);
      assert.deepStrictEqual(spansOf(flat), ["the rod comprises a plate and a cover", "stores the signal"]);
      assert.deepStrictEqual(spansOf(evidenceFree), [
        "the rod comprises a plate, a cover, and a base",
        "stores the signal",
      ]);
    })
  );

  it.effect("does not nest when the subject holds a comma or an item lacks a determiner", () =>
    Effect.gen(function* () {
      const commaSubject = yield* treeOf(refused("the rod, as built, comprises a plate, a cover, and a base"), true);
      const bareItem = yield* treeOf(refused("the rod comprises a plate, covers, and a base"), true);
      assert.isFalse(A.contains(spansOf(commaSubject), "a cover"));
      assert.isFalse(A.contains(spansOf(bareItem), "a plate"));
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

describe("definite reference selection", () => {
  const introducerOf = (tree: ClaimElementTree, referring: string): ReadonlyArray<string> =>
    A.flatMap(tree.edges, (edge) =>
      edge.kind === "antecedent" && edge.referring.anchor.quote === referring
        ? [`${edge.introducing.anchor.startChar}:${edge.introducing.anchor.quote}`]
        : []
    );
  const strictTreeOf = (text: string) => {
    const claim = PatentClaim.cases.independent.make({
      claimNumber: 1,
      claimText: text,
      preamble: "A system",
      transition: "comprising",
      body: Str.slice(Str.length("A system comprising "))(text),
    });
    return decomposeClaim(claim, [claim]);
  };
  const repeated = refused("a rod; a plate; a plate; the plate is mounted on the rod");

  it.effect("binds repeated exact introducers to the nearest earlier one", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(repeated, false);
      const nearest = Str.lastIndexOf("a plate")(repeated);
      assert.deepStrictEqual(introducerOf(tree, "the plate"), [`${O.getOrThrow(nearest)}:a plate`]);
    })
  );

  it.effect("leaves repeated introducers unresolved on the strict decomposition route", () =>
    Effect.gen(function* () {
      const tree = yield* strictTreeOf(repeated);
      assert.deepStrictEqual(introducerOf(tree, "the plate"), []);
    })
  );

  it.effect("binds a multi-word head to its unique introducer with added modifiers", () =>
    Effect.gen(function* () {
      const text = refused("a left rigid barrier post; the left barrier post is mounted on the rod");
      const start = O.getOrThrow(Str.indexOf("a left rigid")(text));
      const inspection = yield* treeOf(text, false);
      const strict = yield* strictTreeOf(text);
      assert.deepStrictEqual(introducerOf(inspection, "the left barrier post"), [`${start}:a left rigid barrier post`]);
      assert.deepStrictEqual(introducerOf(strict, "the left barrier post"), []);
    })
  );

  it.effect("does not bind a single-word head across several modifiers", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(refused("an ablation lesion zone; the zone is mounted on the rod"), false);
      assert.deepStrictEqual(introducerOf(tree, "the zone"), []);
    })
  );

  it.effect("does not bind a multi-word head whose words are out of order or end differently", () =>
    Effect.gen(function* () {
      const reordered = yield* treeOf(
        refused("a barrier left post; the left barrier post is mounted on the rod"),
        false
      );
      const otherLast = yield* treeOf(
        refused("a left barrier post cover; the left barrier post is mounted on the rod"),
        false
      );
      assert.deepStrictEqual(introducerOf(reordered, "the left barrier post"), []);
      assert.deepStrictEqual(introducerOf(otherLast, "the left barrier post"), []);
    })
  );

  it.effect("ignores a leading quantifier in the referring head", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(
        refused("a first rigid barrier post; the at least one first barrier post is mounted on the rod"),
        false
      );
      assert.strictEqual(introducerOf(tree, "the at least one first barrier post").length, 1);
    })
  );
});

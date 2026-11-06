import {
  ClaimInputCollection,
  ClaimInputRecord,
  decomposeClaim,
  decomposeClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";

const inspect = Effect.fn("NominalGrammarTest.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const rows = yield* decomposeClaimInput(
    ClaimInputCollection.make({
      sourceKey: "synthetic-nominal-grammar",
      records: A.map(texts, (canonicalText, index) =>
        ClaimInputRecord.cases.text.make({
          sourceOrdinal: index + 1,
          numberText: O.some(`${index + 1}`),
          sourceText: canonicalText,
          canonicalText,
        })
      ),
    })
  );
  assert.isTrue(A.every(rows, (row) => row.status === "decomposed"));
  return A.getSomes(A.map(rows, (row) => (row.status === "decomposed" ? O.some(row.tree) : O.none())));
});
const treeOf = Effect.fn("NominalGrammarTest.treeOf")(function* (text: string) {
  const trees = yield* inspect([text]);
  return O.getOrThrow(A.head(trees));
});
const bodyTerms = (tree: ClaimElementTree) => A.flatMap(A.drop(tree.elements, 1), (element) => element.terms);
const heads = (tree: ClaimElementTree) => A.map(bodyTerms(tree), (term) => term.head);

describe("inspection nominal grammar", () => {
  it.effect("retains a complete subject before its explicit copula", () =>
    Effect.gen(function* () {
      for (const phrase of [
        "the upper backrest support body",
        "the electrically conductive plate",
        "the oxidant gas supply plate",
      ]) {
        const tree = yield* treeOf(`A fixture comprising ${phrase} is connected to a frame.`);
        assert.strictEqual(O.getOrThrow(A.head(bodyTerms(tree))).anchor.quote, phrase);
      }
    })
  );
  it.effect("keeps finite transitive predicates out of a nominal subject", () =>
    Effect.gen(function* () {
      for (const clause of [
        "the rods support a body",
        "the rods support body weight",
        "the rods support body weight is zero",
      ]) {
        const tree = yield* treeOf(`A fixture comprising ${clause}.`);
        assert.strictEqual(O.getOrThrow(A.head(heads(tree))), "rods");
      }
    })
  );
  it.effect("recognizes coordinated participles modifying one count head", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising a roller lifting and lowering device.");
      assert.deepStrictEqual(heads(tree), ["roller lifting and lowering device"]);
    })
  );
  it.effect("resumes at an explicit object after coordinated participial actions", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising a device lifting and lowering a rod.");
      assert.deepStrictEqual(heads(tree), ["device", "rod"]);
    })
  );
  it.effect("keeps unrelated determiner coordination and quantity heads", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising a housing and a sensor; the one or more sensors are active.");
      assert.deepStrictEqual(A.take(heads(tree), 3), ["housing", "sensor", "sensors"]);
    })
  );
  it.effect("leaves ambiguous mass-object coordination at the original boundary", () =>
    Effect.gen(function* () {
      const text = "A fixture comprising a valve regulating and lowering pressure.";
      const claims = yield* normalizePatentClaims([["1", text]]);
      const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      const refined = yield* treeOf(text);
      assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
    })
  );
  it.effect("keeps quoted predicates and conjunctions in their literal source names", () =>
    Effect.gen(function* () {
      const text = 'A fixture comprising a "lifting and lowering" device; a "support is" body.';
      const claims = yield* normalizePatentClaims([["1", text]]);
      const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      const refined = yield* treeOf(text);
      assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
    })
  );
  it.effect("keeps strict decomposition's observable lexical contract", () =>
    Effect.gen(function* () {
      const text = "A fixture comprising the upper backrest support body is fixed.";
      const claims = yield* normalizePatentClaims([["1", text]]);
      const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.strictEqual(O.getOrThrow(A.head(heads(strict))), "upper backrest");
    })
  );
  it.effect("does not consume a finite predicate across an intervening adverb", () =>
    Effect.gen(function* () {
      for (const adverb of ["directly", "slowly", "never"]) {
        const tree = yield* treeOf(`A fixture comprising the rods ${adverb} support body weight is zero.`);
        const first = O.getOrThrow(A.head(heads(tree)));
        assert.isFalse(Str.includes("support")(first));
      }
    })
  );
  it.effect("does not cross unrelated coordination or an earlier predicate to find a participle pair", () =>
    Effect.gen(function* () {
      for (const body of [
        "a housing and roller lifting and lowering device",
        "a rod extending toward lifting and lowering device",
        "a rod toward lifting and lowering device",
      ]) {
        const text = `A fixture comprising ${body}.`;
        const claims = yield* normalizePatentClaims([["1", text]]);
        const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        const tree = yield* treeOf(text);
        assert.deepStrictEqual(bodyTerms(tree), bodyTerms(strict));
      }
    })
  );
  it.effect("preserves UTF-16 anchors in repaired Unicode subjects", () =>
    Effect.gen(function* () {
      const text = "A fixture comprising the 𝛀 support body is connected to a frame.";
      const tree = yield* treeOf(text);
      const term = O.getOrThrow(A.head(bodyTerms(tree)));
      assert.strictEqual(term.anchor.quote, "the 𝛀 support body");
      assert.strictEqual(Str.slice(term.anchor.startChar, term.anchor.endChar)(text), term.anchor.quote);
    })
  );
  it.effect("keeps reference-parenthesis ambiguity at its existing boundary", () =>
    Effect.gen(function* () {
      const text = "A fixture comprising the support body (12) is connected to a frame.";
      const claims = yield* normalizePatentClaims([["1", text]]);
      const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      const tree = yield* treeOf(text);
      assert.deepStrictEqual(bodyTerms(tree), bodyTerms(strict));
    })
  );
  it.effect("uses repaired noun ownership in current and ancestor trees", () =>
    Effect.gen(function* () {
      const trees = yield* inspect([
        "A fixture comprising a roller lifting and lowering device.",
        "The fixture of claim 1 wherein the roller lifting and lowering device is connected to a rod.",
      ]);
      const child = O.getOrThrow(A.last(trees));
      assert.isTrue(A.some(child.edges, (edge) => edge.kind === "antecedent" && edge.introducing.path === "1.a"));
    })
  );
  it.effect("extracts a colon parent's terms from its owned header only", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(
        "A fixture comprising the upper backrest support body is provided with: a panel; a sensor."
      );
      const parent = O.getOrThrow(A.findFirst(tree.elements, (element) => element.path === "1.a"));
      assert.strictEqual(O.getOrThrow(A.head(parent.terms)).head, "upper backrest support body");
      assert.strictEqual(
        A.countBy(parent.terms, (term) => term.head === "panel"),
        0
      );
    })
  );
  it.effect("recognizes a coordinated modifier at the start of its noun phrase", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising a lifting and lowering device.");
      assert.deepStrictEqual(heads(tree), ["lifting and lowering device"]);
    })
  );
  it.effect("keeps complete reciprocal arguments as functional source text", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising the panels are equal in area to each other.");
      assert.isFalse(A.some(heads(tree), (head) => head === "other"));
    })
  );
  it.effect("preserves distributive each-other modifiers and quoted reciprocal names", () =>
    Effect.gen(function* () {
      for (const body of ["a mount for each other component", 'a "one another" sensor']) {
        const text = `A fixture comprising ${body}.`;
        const claims = yield* normalizePatentClaims([["1", text]]);
        const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        const refined = yield* treeOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
  it.effect("separates a completed noun phrase from its relation and resumes at the complement", () =>
    Effect.gen(function* () {
      for (const relation of ["due to", "opposite to", "relative to", "perpendicular to"]) {
        const tree = yield* treeOf(`A fixture comprising the panel ${relation} a sensor.`);
        assert.deepStrictEqual(heads(tree), ["panel", "sensor"]);
      }
    })
  );
  it.effect("preserves prenominal relation words and quoted relation names", () =>
    Effect.gen(function* () {
      for (const body of ["an opposite direction detector", "a relative position sensor", 'a "due to" label']) {
        const text = `A fixture comprising ${body}.`;
        const claims = yield* normalizePatentClaims([["1", text]]);
        const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        const refined = yield* treeOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
  it.effect("requires a lexical relation complement before changing the nominal boundary", () =>
    Effect.gen(function* () {
      for (const body of [
        "the panel opposite to, and a sensor",
        "the panel relative to is mounted",
        "the panel opposite to (12)",
        "the panel due to a.",
      ]) {
        const text = `A fixture comprising ${body}.`;
        const claims = yield* normalizePatentClaims([["1", text]]);
        const strict = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        const refined = yield* treeOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
});

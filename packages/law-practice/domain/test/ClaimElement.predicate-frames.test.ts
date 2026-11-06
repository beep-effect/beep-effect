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

const inspect = Effect.fn("PredicateFramesTest.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const rows = yield* decomposeClaimInput(
    ClaimInputCollection.make({
      sourceKey: "synthetic-predicate-frames",
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
const treeOf = Effect.fn("PredicateFramesTest.treeOf")(function* (text: string) {
  const trees = yield* inspect([text]);
  return O.getOrThrow(A.head(trees));
});
const bodyTerms = (tree: ClaimElementTree) => A.flatMap(A.drop(tree.elements, 1), (element) => element.terms);
const heads = (tree: ClaimElementTree) => A.map(bodyTerms(tree), (term) => term.head);
const strictOf = Effect.fn("PredicateFramesTest.strictOf")(function* (text: string) {
  const claims = yield* normalizePatentClaims([["1", text]]);
  return yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
});

describe("inspection predicate frames", () => {
  it.effect("consumes licensed unknown verbs while retaining explicit objects", () =>
    Effect.gen(function* () {
      for (const introducer of ["configured to", "adapted to", "operable to", "arranged to", "so as to"]) {
        const tree = yield* treeOf(`A fixture comprising a mechanism ${introducer} encircle the panel.`);
        assert.deepStrictEqual(heads(tree), ["mechanism", "panel"]);
      }
    })
  );
  it.effect("retains coordinated objects and successive licensed predicates", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(
        "A fixture comprising a mechanism configured to encircle a panel and a rod; a tool adapted to engrave the panel."
      );
      assert.deepStrictEqual(heads(tree), ["mechanism", "panel", "rod", "tool", "panel"]);
    })
  );
  it.effect("retains quantified objects without consuming their source", () =>
    Effect.gen(function* () {
      for (const object of ["at least one panel", "one or more panels", "a plurality of panels"]) {
        const text = `A fixture comprising a mechanism configured to encircle ${object}.`;
        const tree = yield* treeOf(text);
        assert.isFalse(A.some(heads(tree), (head) => Str.includes("encircle")(head)));
        assert.isTrue(A.some(bodyTerms(tree), (term) => term.anchor.quote === object));
      }
    })
  );
  it.effect("preserves prepositional to, unlicensed verbs, names and quantity conflicts", () =>
    Effect.gen(function* () {
      for (const body of [
        "a link to a cover plate",
        "a mechanism to encircle the panel",
        "a welded joint",
        "the embedded controller covers only said panels",
        "a workpiece to be inspected",
        "a link to John the programmer",
        "a link to port A",
        "a mechanism configured to all the panels",
        "a mechanism configured to both the terminals",
        "a mechanism configured to such a device",
        "a mechanism configured to approximately a meter",
        "a mechanism configured to only the sensor",
        "a mechanism configured to twice the voltage",
        "a mechanism configured to encircle A",
        "a mechanism configured to encircle (12) the panel",
        "a mechanism configured to encircle the claim 1",
        "a mechanism configured to encircle the",
      ]) {
        const text = `A fixture comprising ${body}.`;
        const refined = yield* treeOf(text);
        const strict = yield* strictOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
  it.effect("declines quantity, grammatical-function and ambiguous multiplier verb slots", () =>
    Effect.gen(function* () {
      for (const body of [
        "a mechanism configured to half a wavelength",
        "a mechanism configured to one-half a wavelength",
        "a mechanism configured to once a day",
        "a mechanism configured to about a meter",
        "a mechanism configured to around a panel",
        "a mechanism configured to beneath a panel",
        "a mechanism adapted to double the voltage",
        "a mechanism adapted to triple the voltage",
        "a mechanism configured to several a panel",
      ]) {
        const text = `A fixture comprising ${body}.`;
        const refined = yield* treeOf(text);
        const strict = yield* strictOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
  it.effect("declines full known finite forms even when their base lemma is absent", () =>
    Effect.gen(function* () {
      for (const verb of ["controls", "samples", "outputs"]) {
        const text = `A fixture comprising the oxidant supply plate ${verb} body weight has a surface.`;
        const refined = yield* treeOf(text);
        const strict = yield* strictOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
  it.effect("preserves complete and incomplete quoted predicate names", () =>
    Effect.gen(function* () {
      for (const body of [
        'a "configured to encircle" mechanism',
        'a mechanism configured to "encircle" the panel',
        'a mechanism "so as to encircle" the panel',
        'a "so as to encircle the panel',
        "a ‘so as to encircle the panel",
      ]) {
        const text = `A fixture comprising ${body}.`;
        const refined = yield* treeOf(text);
        const strict = yield* strictOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
  it.effect("leaves strict decomposition unchanged for newly licensed verbs", () =>
    Effect.gen(function* () {
      const text = "A fixture comprising a mechanism configured to encircle the panel.";
      const strict = yield* strictOf(text);
      const refined = yield* treeOf(text);
      assert.isTrue(A.some(heads(strict), (head) => head === "encircle"));
      assert.isFalse(A.some(heads(refined), (head) => head === "encircle"));
    })
  );
  it.effect("preserves UTF-16 anchors and functional partitions around the consumed predicate", () =>
    Effect.gen(function* () {
      const text = "A fixture comprising a 𝛀 mechanism is configured to encircle the panel.";
      const tree = yield* treeOf(text);
      for (const term of bodyTerms(tree))
        assert.strictEqual(Str.slice(term.anchor.startChar, term.anchor.endChar)(text), term.anchor.quote);
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) =>
            edge.kind === "functional" &&
            A.some(edge.parts, (part) => part.kind === "text" && Str.includes("encircle")(part.anchor.quote))
        )
      );
    })
  );
  it.effect("recovers structurally singular compound subjects before has", () =>
    Effect.gen(function* () {
      for (const subject of [
        "the oxidant gas supply plate",
        "the gas supply plate",
        "the support body",
        "said oxidant gas supply plate",
        "an oxidant gas supply plate",
      ]) {
        const tree = yield* treeOf(`A fixture comprising ${subject} has a surface.`);
        assert.strictEqual(O.getOrThrow(A.head(bodyTerms(tree))).anchor.quote, subject);
      }
      const trees = yield* inspect([
        "A fixture comprising an oxidant gas supply plate has a surface.",
        "The fixture of claim 1 wherein the oxidant gas supply plate has a coating.",
      ]);
      const child = O.getOrThrow(A.last(trees));
      assert.isTrue(A.some(heads(child), (head) => head === "oxidant gas supply plate"));
      assert.isTrue(A.some(child.edges, (edge) => edge.kind === "antecedent" && edge.introducing.path === "1.a"));
    })
  );
  it.effect("uses explicit plural quantities independently of internal gas modifiers", () =>
    Effect.gen(function* () {
      for (const subject of ["a plurality of oxidant gas supply plates", "the one or more oxidant gas supply plates"]) {
        const tree = yield* treeOf(`A fixture comprising ${subject} have a surface.`);
        assert.strictEqual(O.getOrThrow(A.head(bodyTerms(tree))).anchor.quote, subject);
      }
    })
  );
  it.effect("declines mismatches, ambiguous number, labels and unsupported complements", () =>
    Effect.gen(function* () {
      for (const body of [
        "the oxidant gas supply plates has a surface",
        "the oxidant gas supply plate have a surface",
        "a gas supply plate have a surface",
        "the gas supply status has a surface",
        "the gas supply means have a surface",
        'the "HAS" supply label has a surface',
        "the gas supply plate has 12",
        "the gas supply plate has A device",
        "the gas supply plate has the claim 1",
        "the gas supply plate has a",
        "the gas supply plate (12) has a surface",
        "the gas supply plate that has a surface",
        "a frame with the gas supply plate has a surface",
        "the rods directly support body weight has a surface",
        "the gas supply plate supports body weight has a surface",
        "the units supply valves",
        "a has label",
        "the have control",
      ]) {
        const text = `A fixture comprising ${body}.`;
        const refined = yield* treeOf(text);
        const strict = yield* strictOf(text);
        assert.deepStrictEqual(bodyTerms(refined), bodyTerms(strict));
      }
    })
  );
  it.effect("shares the predicate strategy with ancestor extraction", () =>
    Effect.gen(function* () {
      const trees = yield* inspect([
        "A fixture comprising a mechanism configured to encircle a panel.",
        "The fixture of claim 1 wherein the panel is attached to a rod.",
      ]);
      const child = O.getOrThrow(A.last(trees));
      assert.isTrue(A.some(child.edges, (edge) => edge.kind === "antecedent" && edge.introducing.path === "1.a"));
    })
  );
});

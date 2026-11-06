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

const inspect = Effect.fn("OwnershipTest.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const rows = yield* decomposeClaimInput(
    ClaimInputCollection.make({
      sourceKey: "synthetic-source-ownership",
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
const lastTree = Effect.fn("OwnershipTest.lastTree")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const trees = yield* inspect(texts);
  return O.getOrThrow(A.last(trees));
});
const targets = (tree: ClaimElementTree, quote: string) =>
  A.getSomes(
    A.map(tree.edges, (edge) =>
      edge.kind === "antecedent" && edge.referring.anchor.quote === quote
        ? O.some(edge.introducing.anchor.quote)
        : O.none()
    )
  );
const twoOwners = "A fixture comprising a screw with a threaded shaft; a nut with a cylindrical shaft.";

describe("inspection source ownership", () => {
  it.effect("uses an explicit of owner to distinguish compatible part heads", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([twoOwners, "The fixture of claim 1 wherein the shaft of the nut is polished."]);
      assert.deepStrictEqual(targets(tree, "the shaft"), ["a cylindrical shaft"]);
    })
  );
  it.effect("uses an existing owner composition scope across an actual dependency chain", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A method comprising a screw with a threaded shaft.",
        "The method of claim 1 wherein a nut with a cylindrical shaft is provided.",
        "The method of claim 2 wherein said nut further comprises a flange at a base of the shaft.",
      ]);
      assert.deepStrictEqual(targets(tree, "the shaft"), ["a cylindrical shaft"]);
    })
  );
  it.effect("retains a referring ancestor owner's own reference provenance", () =>
    Effect.gen(function* () {
      for (const body of ["the nut has a cylindrical shaft", "a cylindrical shaft of the nut is provided"]) {
        const tree = yield* lastTree([
          "A fixture comprising a nut; a screw with a threaded shaft.",
          `The fixture of claim 1 wherein ${body}.`,
          "The fixture of claim 2 wherein the nut's shaft is coated.",
        ]);
        assert.deepStrictEqual(targets(tree, "the nut's shaft"), ["a cylindrical shaft"]);
        assert.isFalse(
          A.some(tree.edges, (edge) => edge.kind === "antecedent" && !Str.startsWith("3")(edge.referring.path))
        );
      }
    })
  );
  it.effect("does not bind an ancestor owner using unrelated or alternative-only earlier claims", () =>
    Effect.gen(function* () {
      for (const dependency of ["claim 2", "claims 1 or 2"]) {
        const tree = yield* lastTree([
          "A fixture comprising a nut; a screw with a threaded shaft.",
          "A fixture comprising a sleeve.",
          `The fixture of ${dependency} wherein the nut has a cylindrical shaft.`,
          "The fixture of claim 3 wherein the nut's shaft is coated.",
        ]);
        assert.deepStrictEqual(targets(tree, "the nut's shaft"), []);
      }
    })
  );
  it.effect("does not choose globally nearest or unknown-owner candidates", () =>
    Effect.gen(function* () {
      for (const body of ["the shaft is polished", "the shaft of the sleeve is polished"]) {
        const tree = yield* lastTree([twoOwners, `The fixture of claim 1 wherein ${body}.`]);
        assert.deepStrictEqual(targets(tree, "the shaft"), []);
      }
    })
  );
  it.effect("does not replace an explicit unknown owner with a surrounding composition scope", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        twoOwners,
        "The fixture of claim 1 wherein the nut has a flange at a base of the shaft of the sleeve.",
      ]);
      assert.deepStrictEqual(targets(tree, "the shaft"), []);
    })
  );
  it.effect("keeps multiple compatible parts under one owner ambiguous", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A fixture comprising a nut with a cylindrical shaft; said nut having a polished shaft.",
        "The fixture of claim 1 wherein the shaft of the nut is coated.",
      ]);
      assert.deepStrictEqual(targets(tree, "the shaft"), []);
    })
  );
  it.effect("rejects a different owner's edge and preserves a supported local back-reference", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A fixture comprising a membrane with an edge; a cap of which the edge is provided with a recess, the recess exposing the edge.",
      ]);
      const cap = O.getOrThrow(A.findFirst(tree.elements, (element) => Str.startsWith("a cap")(element.anchor.quote)));
      const capEdges = A.filter(cap.terms, (term) => term.anchor.quote === "the edge");
      const first = O.getOrThrow(A.head(capEdges));
      const second = O.getOrThrow(A.last(capEdges));
      assert.isFalse(
        A.some(
          tree.edges,
          (edge) => edge.kind === "antecedent" && edge.referring.anchor.startChar === first.anchor.startChar
        )
      );
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.startChar === second.anchor.startChar &&
            edge.introducing.path === cap.path &&
            edge.introducing.anchor.startChar === first.anchor.startChar
        )
      );
      assert.isFalse(A.some(targets(tree, "the edge"), (quote) => quote === "an edge"));
    })
  );
  it.effect("does not infer ownership from near or transfer a partitive owner's other parts", () =>
    Effect.gen(function* () {
      for (const body of [
        "a portion of the nut is attached to the shaft",
        "the nut is near the screw and the shaft is coated",
        "the nut has a flange near the shaft",
        "the nut has a flange near a base of the shaft",
      ]) {
        const tree = yield* lastTree([twoOwners, `The fixture of claim 1 wherein ${body}.`]);
        assert.deepStrictEqual(targets(tree, "the shaft"), []);
      }
    })
  );
  it.effect("requires a positive spatial part in the composition chain", () =>
    Effect.gen(function* () {
      for (const middle of ["photograph", "diagram", "view", "context", "description"]) {
        const tree = yield* lastTree([
          twoOwners,
          `The fixture of claim 1 wherein the nut has a flange in a ${middle} of the shaft.`,
        ]);
        assert.deepStrictEqual(targets(tree, "the shaft"), []);
      }
      for (const middle of ["base", "region", "surface"]) {
        const tree = yield* lastTree([
          twoOwners,
          `The fixture of claim 1 wherein the nut has a flange in a ${middle} of the shaft.`,
        ]);
        assert.deepStrictEqual(targets(tree, "the shaft"), ["a cylindrical shaft"]);
      }
    })
  );
  it.effect("does not treat every of-which relative as part ownership", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A fixture comprising a housing with a sensor; a signal of which the sensor is aware.",
      ]);
      assert.deepStrictEqual(targets(tree, "the sensor"), ["a sensor"]);
    })
  );
  it.effect("recognizes explicit possessive ownership without changing lexical heads", () =>
    Effect.gen(function* () {
      for (const apostrophe of ["'", "’"]) {
        const quote = `the nut${apostrophe}s shaft`;
        const tree = yield* lastTree([twoOwners, `The fixture of claim 1 wherein ${quote} is coated.`]);
        assert.deepStrictEqual(targets(tree, quote), ["a cylindrical shaft"]);
        assert.isTrue(
          A.some(
            A.flatMap(tree.elements, (element) => element.terms),
            (term) => term.anchor.quote === quote && term.head === Str.slice(4)(quote)
          )
        );
      }
    })
  );
  it.effect("declines owner aliases without a unique source binding", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A fixture comprising a nut with a threaded shaft; a nut with a cylindrical shaft.",
        "The fixture of claim 1 wherein the nut's shaft is coated.",
      ]);
      assert.deepStrictEqual(targets(tree, "the nut's shaft"), []);
    })
  );
  it.effect("does not borrow an owner from a sibling or only one alternative dependency", () =>
    Effect.gen(function* () {
      for (const dependency of ["claim 1", "claims 1 or 2"]) {
        const tree = yield* lastTree([
          "A fixture comprising a screw with a threaded shaft.",
          "The fixture of claim 1 wherein a nut with a cylindrical shaft is provided.",
          `The fixture of ${dependency} wherein the nut's shaft is coated.`,
        ]);
        assert.deepStrictEqual(targets(tree, "the nut's shaft"), []);
      }
    })
  );
  it.effect("does not normalize a possessive when the proposed donor has no ownership proof", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A fixture comprising a nut; a cylindrical shaft.",
        "The fixture of claim 1 wherein the nut's shaft is coated.",
      ]);
      assert.deepStrictEqual(targets(tree, "the nut's shaft"), []);
    })
  );
  it.effect("retains ordinary unique antecedents when no ownership proof applies", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A fixture comprising a sensor; a frame coupled to the sensor.",
        "The fixture of claim 1 wherein the sensor is mounted.",
      ]);
      assert.deepStrictEqual(targets(tree, "the sensor"), ["a sensor"]);
    })
  );
  it.effect("adds only an explicit uniquely bound part-location dependency", () =>
    Effect.gen(function* () {
      const tree = yield* lastTree([
        "A fixture comprising a nut with a bore.",
        "The fixture of claim 1 further comprising two indentations in opposite sides of the nut.",
      ]);
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a" && edge.ancestor === "1.a"
        )
      );
      const negative = yield* lastTree([
        "A fixture comprising a nut with a bore.",
        "The fixture of claim 1 further comprising two indentations in a tray near the nut.",
      ]);
      assert.isFalse(A.some(negative.edges, (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a"));
    })
  );
  it.effect("preserves quoted names, numeric references and exact source anchors", () =>
    Effect.gen(function* () {
      const texts: A.NonEmptyReadonlyArray<string> = [
        'A fixture comprising a "shaft of the nut" label; a nut (12) with a cylindrical shaft; a screw (13) with a threaded shaft.',
        "The fixture of claim 1 wherein the shaft of the nut (12) is coated.",
      ];
      const tree = yield* lastTree(texts);
      const source = O.getOrThrow(A.get(texts, 1));
      assert.deepStrictEqual(targets(tree, "the shaft"), ["a cylindrical shaft"]);
      for (const term of A.flatMap(tree.elements, (element) => element.terms))
        assert.strictEqual(Str.slice(term.anchor.startChar, term.anchor.endChar)(source), term.anchor.quote);
    })
  );
  it.effect("does not read a colon parent's child terms as its own ownership relationship", () =>
    Effect.gen(function* () {
      const trees = yield* inspect([
        "A fixture comprising a nut with: a shaft; a screw with a cylindrical shaft.",
        "The fixture of claim 1 wherein the nut's shaft is coated.",
      ]);
      const first = O.getOrThrow(A.head(trees));
      const header = O.getOrThrow(A.findFirst(first.elements, (element) => element.path === "1.a"));
      assert.deepStrictEqual(
        A.map(header.terms, (term) => term.head),
        ["nut"]
      );
      assert.deepStrictEqual(targets(O.getOrThrow(A.last(trees)), "the nut's shaft"), []);
    })
  );
  it.effect("preserves UTF-16 positions while binding an explicit Unicode owner", () =>
    Effect.gen(function* () {
      const text = "The fixture of claim 1 wherein the shaft of the 𝛀 nut is coated.";
      const tree = yield* lastTree([
        "A fixture comprising a 𝛀 nut with a cylindrical shaft; a screw with a threaded shaft.",
        text,
      ]);
      assert.deepStrictEqual(targets(tree, "the shaft"), ["a cylindrical shaft"]);
      for (const term of A.flatMap(tree.elements, (element) => element.terms))
        assert.strictEqual(Str.slice(term.anchor.startChar, term.anchor.endChar)(text), term.anchor.quote);
    })
  );
  it.effect("leaves strict decomposition's original ambiguous-head contract unchanged", () =>
    Effect.gen(function* () {
      const texts: A.NonEmptyReadonlyArray<string> = [
        twoOwners,
        "The fixture of claim 1 wherein the shaft of the nut is polished.",
      ];
      const claims = yield* normalizePatentClaims(A.map(texts, (text, index) => [`${index + 1}`, text]));
      const strict = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
      assert.deepStrictEqual(targets(strict, "the shaft"), []);
      const refined = yield* lastTree(texts);
      assert.deepStrictEqual(targets(refined, "the shaft"), ["a cylindrical shaft"]);
    })
  );
});

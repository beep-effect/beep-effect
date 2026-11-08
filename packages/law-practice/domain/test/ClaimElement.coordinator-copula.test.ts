import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimTerm,
  decomposeClaim,
  decomposeClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";

const inspect = Effect.fn("CoordinatorCopulaTest.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const records = yield* decomposeClaimInput(
    ClaimInputCollection.make({
      sourceKey: "synthetic-coordinator-copula",
      records: A.map(texts, (text, index) =>
        ClaimInputRecord.cases.text.make({
          sourceOrdinal: index + 1,
          numberText: O.some(`${index + 1}`),
          sourceText: text,
          canonicalText: text,
        })
      ),
    })
  );
  return A.map(records, (record) => {
    if (record.status !== "decomposed") throw new Error("expected a decomposed source control");
    return record.tree;
  });
});
const bodyTerms = (tree: ClaimElementTree) => A.flatMap(A.drop(tree.elements, 1), (element) => element.terms);
const strictTree = Effect.fn("CoordinatorCopulaTest.strictTree")(function* (text: string) {
  const claims = yield* normalizePatentClaims([["1", text]]);
  return yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
});
const assertFunctionalCoverage = (tree: ClaimElementTree) => {
  for (const edge of tree.edges) {
    if (edge.kind !== "functional") continue;
    const element = O.getOrThrow(A.findFirst(tree.elements, (candidate) => candidate.path === edge.element));
    assert.strictEqual(
      A.join("")(A.map(edge.parts, (part) => (part.kind === "text" ? part.anchor.quote : part.term.anchor.quote))),
      element.anchor.quote
    );
  }
};

describe("inspection coordinator before a copula", () => {
  it.effect("keeps a coordinated predicate out of its preceding nominal", () =>
    Effect.gen(function* () {
      const text = "A system comprising a plate that is coupled to the housing and/or is coated.";
      const records = yield* decomposeClaimInput(
        ClaimInputCollection.make({
          sourceKey: "synthetic-coordinator-copula",
          records: [
            ClaimInputRecord.cases.text.make({
              sourceOrdinal: 1,
              numberText: O.some("1"),
              sourceText: text,
              canonicalText: text,
            }),
          ],
        })
      );
      const record = O.getOrThrow(A.head(records));
      if (record.status !== "decomposed") throw new Error("expected a decomposed source control");
      assert.deepStrictEqual(
        A.flatMap(A.drop(record.tree.elements, 1), (element) => A.map(element.terms, (term) => term.anchor.quote)),
        ["a plate", "the housing"]
      );
    })
  );
  for (const coordinator of ["and", "or", "and/or"]) {
    for (const copula of ["is", "are", "was", "were"]) {
      it.effect(`closes an exact source nominal before ${coordinator} ${copula}`, () =>
        Effect.gen(function* () {
          const plural = copula === "are" || copula === "were";
          const noun = plural ? "housings" : "housing";
          const subject = plural ? "plates" : "a plate";
          const text = `A system comprising ${subject} that ${copula} coupled to the ${noun} ${coordinator} ${copula} coated.`;
          const trees = yield* inspect([text]);
          const tree = O.getOrThrow(A.head(trees));
          assert.deepStrictEqual(
            A.map(bodyTerms(tree), (term) => term.anchor.quote),
            [subject, `the ${noun}`]
          );
          const term = O.getOrThrow(A.last(bodyTerms(tree)));
          const startChar = O.getOrThrow(Str.indexOf(`the ${noun}`)(text));
          assert.deepStrictEqual(
            term,
            ClaimTerm.make({
              anchor: TextAnchor.make({ startChar, endChar: startChar + noun.length + 4, quote: `the ${noun}` }),
              determiner: "the",
              head: noun,
            })
          );
          assertFunctionalCoverage(tree);
          const strict = yield* strictTree(text);
          assert.deepStrictEqual(
            A.map(bodyTerms(strict), (term) => term.anchor.quote),
            [subject, `the ${noun}${coordinator === "and/or" ? " and/or" : ""}`]
          );
        })
      );
    }
  }
  it.effect("uses the same boundary for a bare nominal without a stray coordinator", () =>
    Effect.gen(function* () {
      const trees = yield* inspect(["A system comprising a plate that is coupled to housing and/or is coated."]);
      const tree = O.getOrThrow(A.head(trees));
      assert.deepStrictEqual(
        A.map(bodyTerms(tree), (term) => term.anchor.quote),
        ["a plate", "housing"]
      );
      assertFunctionalCoverage(tree);
    })
  );
  it.effect("closes a leading nominal in the existing copular subject planner", () =>
    Effect.gen(function* () {
      const trees = yield* inspect(["A system comprising the housing and/or is coated."]);
      const tree = O.getOrThrow(A.head(trees));
      assert.deepStrictEqual(
        A.map(bodyTerms(tree), (term) => term.anchor.quote),
        ["the housing"]
      );
      assertFunctionalCoverage(tree);
    })
  );
  it.effect("retains exact UTF-16 coordinates after a quoted supplementary character", () =>
    Effect.gen(function* () {
      const text = 'A system comprising a "🧩 plate" that is coupled to the housing and/or is coated.';
      const trees = yield* inspect([text]);
      const tree = O.getOrThrow(A.head(trees));
      const term = O.getOrThrow(A.findFirst(bodyTerms(tree), (candidate) => candidate.head === "housing"));
      const startChar = O.getOrThrow(Str.indexOf("the housing")(text));
      assert.deepStrictEqual(
        term.anchor,
        TextAnchor.make({ startChar, endChar: startChar + 11, quote: "the housing" })
      );
      assertFunctionalCoverage(tree);
    })
  );
  it.effect("uses the same source anchor for current and reconstructed ancestor terms", () =>
    Effect.gen(function* () {
      const trees = yield* inspect([
        "A system comprising a plate that is coupled to a housing and/or is coated.",
        "The system of claim 1 wherein the housing includes a liner.",
      ]);
      const parent = O.getOrThrow(A.head(trees));
      const child = O.getOrThrow(A.last(trees));
      const housing = O.getOrThrow(A.findFirst(bodyTerms(parent), (term) => term.head === "housing"));
      const edge = O.getOrThrow(
        A.findFirst(
          child.edges,
          (candidate) => candidate.kind === "antecedent" && candidate.referring.anchor.quote === "the housing"
        )
      );
      if (edge.kind !== "antecedent") throw new Error("expected the selected antecedent");
      assert.deepStrictEqual(edge.introducing.anchor, housing.anchor);
      assert.strictEqual(edge.introducing.path, "1.a");
      assertFunctionalCoverage(parent);
      assertFunctionalCoverage(child);
    })
  );
  for (const body of [
    'a "housing and/or" is coated',
    'a "housing and/or is coated"',
    "the housing and/or the panel",
    "the signal intensity and/or line width",
    "the housing and/or",
    "the housing and/or vapor",
    "the housing+and/or is coated",
    "the housing and/or+is coated",
    "the housing and/or, is coated",
    "the housing and/or (4) is coated",
    'the housing and/or "is" coated',
    "and/or is coated",
    "the upper electrically conductive plate and is coated",
  ]) {
    it.effect(`preserves existing lexical behavior without a boundary witness: ${body}`, () =>
      Effect.gen(function* () {
        const text = `A system comprising ${body}.`;
        const trees = yield* inspect([text]);
        const current = O.getOrThrow(A.head(trees));
        const strict = yield* strictTree(text);
        assert.deepStrictEqual(current.elements, strict.elements);
        assert.deepStrictEqual(current.edges, strict.edges);
        assertFunctionalCoverage(current);
      })
    );
  }
});

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

const inspect = Effect.fn("CompositionEnumerationTest.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const outcomes = yield* decomposeClaimInput(
    ClaimInputCollection.make({
      sourceKey: "synthetic-composition-enumeration",
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
  assert.isTrue(A.every(outcomes, ({ status }) => status === "decomposed"));
  return A.getSomes(A.map(outcomes, (outcome) => (outcome.status === "decomposed" ? O.some(outcome.tree) : O.none())));
});

describe("closed flat composition enumerations in inspection", () => {
  it.effect("retains a two-object enumeration as a limitation with exact existing mentions", () =>
    Effect.gen(function* () {
      for (const clause of [
        "the module includes a bracket and a bushing",
        "the module includes a bracket (2) and a bushing (3)",
        "said module further comprises an axle [2a] and a bushing [3]",
      ]) {
        const text = `A fixture comprising a module; ${clause}.`;
        const trees = yield* inspect([text]);
        const tree = O.getOrThrow(A.head(trees));
        const element = O.getOrThrow(A.findFirst(tree.elements, ({ path }) => path === "1.b"));
        assert.strictEqual(element.kind, "limitation");
        assert.strictEqual(element.anchor.quote, clause);
        assert.deepStrictEqual(
          A.map(element.terms, ({ determiner }) => determiner),
          [Str.startsWith("said")(clause) ? "said" : "the", Str.includes("an axle")(clause) ? "an" : "a", "a"]
        );
        assert.strictEqual(element.terms.length, 3);
        assert.deepStrictEqual(
          A.map(element.terms, ({ anchor }) => anchor.quote),
          [
            Str.startsWith("said")(clause) ? "said module" : "the module",
            Str.includes("an axle")(clause) ? "an axle" : "a bracket",
            "a bushing",
          ]
        );
        for (const term of element.terms) {
          assert.strictEqual(Str.slice(term.anchor.startChar, term.anchor.endChar)(text), term.anchor.quote);
        }
        assert.isFalse(A.some(tree.edges, (edge) => edge.kind === "functional" && edge.element === element.path));
      }
    })
  );

  it.effect("retains descriptive, relative, action and nonclosed enumerations as functional", () =>
    Effect.gen(function* () {
      for (const clause of [
        "the module which includes a bracket and a bushing",
        "the module includes a bracket and a bushing that rotates",
        "the module includes a bracket and a bushing rotates",
        "the module includes a bracket and a bushing coupled to the module",
        "the module includes a bracket of steel and a bushing",
        "the module includes a bracket and a bushing in a housing",
        "the module includes a bracket and a bushing in storage",
        "the module includes a bracket and a bushing and a washer",
        "the module includes a bracket or a bushing",
        "the module includes the bracket and a bushing",
        "the module includes a bracket and bushing",
        "the module includes a bracket and a bushing respectively",
      ]) {
        const trees = yield* inspect([`A fixture comprising a module; ${clause}.`]);
        const tree = O.getOrThrow(A.head(trees));
        const element = O.getOrThrow(A.findFirst(tree.elements, ({ path }) => path === "1.b"));
        assert.strictEqual(element.kind, "functional-relation", clause);
      }
    })
  );

  it.effect("preserves donor anchors through a descendant's actual dependency chain", () =>
    Effect.gen(function* () {
      const texts: A.NonEmptyReadonlyArray<string> = [
        "A fixture comprising a module; the module includes a bracket (2) and a bushing (3).",
        "The fixture of claim 1 wherein the bushing is rigid.",
        "The fixture of claim 2 wherein the bracket is mounted to the bushing.",
      ];
      const trees = yield* inspect(texts);
      const parent = O.getOrThrow(A.head(trees));
      const donor = O.getOrThrow(A.findFirst(parent.elements, ({ path }) => path === "1.b"));
      assert.strictEqual(donor.kind, "limitation");
      const bracket = O.getOrThrow(A.findFirst(donor.terms, ({ head }) => head === "bracket"));
      const descendant = O.getOrThrow(A.last(trees));
      const edge = O.getOrThrow(
        A.findFirst(
          descendant.edges,
          (value) => value.kind === "antecedent" && value.referring.anchor.quote === "the bracket"
        )
      );
      assert.strictEqual(edge.kind, "antecedent");
      if (edge.kind === "antecedent") {
        assert.strictEqual(edge.introducing.path, "1.b");
        assert.deepStrictEqual(edge.introducing.anchor, bracket.anchor);
      }
    })
  );

  it.effect("preserves the strict decomposer's existing composition classification", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a module; the module includes a bracket and a bushing."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      const element = O.getOrThrow(A.findFirst(tree.elements, ({ path }) => path === "1.b"));
      assert.strictEqual(element.kind, "functional-relation");
    })
  );
});

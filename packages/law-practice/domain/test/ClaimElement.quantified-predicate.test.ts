import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("quantified predicate objects and infinitive results", () => {
  it.effect("keeps quantified action objects out of the preamble subject head", () =>
    Effect.gen(function* () {
      for (const quantity of ["at least one", "one or more"]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A lamp projecting ${quantity} beam comprising a source.`],
          ["2", "The lamp of claim 1 wherein the source is covered."],
        ]);
        const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
        const root = O.getOrThrow(A.head(trees));
        assert.deepStrictEqual(
          A.map(O.getOrThrow(A.head(root.elements)).terms, (t) => t.anchor.quote),
          ["A lamp", `${quantity} beam`]
        );
        assert.isTrue(
          A.some(
            O.getOrThrow(A.last(trees)).edges,
            (e) => e.kind === "antecedent" && e.referring.path === "2" && e.introducing.anchor.quote === "A lamp"
          )
        );
      }
    })
  );

  it.effect("links a later mention to a bare result after to form", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising illuminating sources to form distinct beam patterns."],
        ["2", "The method of claim 1 wherein the distinct beam patterns include a narrow pattern."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
      assert.isTrue(
        A.some(
          tree.edges,
          (e) =>
            e.kind === "antecedent" &&
            e.referring.anchor.quote === "the distinct beam patterns" &&
            e.introducing.anchor.quote === "distinct beam patterns"
        )
      );
    })
  );

  it.effect("retains nominal form and projecting-unit names", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a form; a projecting unit; a projecting bracket."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (e) => e.terms),
          (t) => t.anchor.quote
        ),
        ["A fixture", "a form", "a projecting unit", "a projecting bracket"]
      );
    })
  );
});
